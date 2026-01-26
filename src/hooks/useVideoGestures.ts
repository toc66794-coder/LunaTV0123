import { useCallback, useMemo, useRef } from 'react';

interface UseVideoGesturesOptions {
  onVolumeChange?: (delta: number) => void;
  onBrightnessChange?: (delta: number) => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  longPressDelay?: number;
  isFullscreen?: boolean;
}

interface InteractionState {
  startX: number;
  startY: number;
  startTime: number;
  lastY: number;
  isLeft: boolean;
  isLongPressActive: boolean;
  hasMovedSignificantlyForLongPress: boolean;
  hasTriggeredDragging: boolean;
}

const DOUBLE_TAP_DELAY = 300;
const SWIPE_THRESHOLD = 10;
const LONG_PRESS_MOVE_THRESHOLD = 50; // 用於判定長按是否中斷
const DRAG_START_THRESHOLD = 30; // 垂直方向拉動超過 30px 才真正開始計算音量/亮度

export const useVideoGestures = ({
  onVolumeChange,
  onBrightnessChange,
  onSeekBackward,
  onSeekForward,
  onLongPressStart,
  onLongPressEnd,
  videoContainerRef,
  longPressDelay = 500,
  isFullscreen = false,
}: UseVideoGesturesOptions) => {
  const state = useRef<InteractionState | null>(null);
  const lastTapTime = useRef<number>(0);
  const lastTapSide = useRef<'left' | 'right' | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleStart = useCallback(
    (clientX: number, clientY: number, isTouch = false) => {
      if (!videoContainerRef.current) return;

      const rect = videoContainerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const xPercent = x / rect.width;

      // 如果是全螢幕，稍微往內縮一點區域判定，避開小米系統回退手勢區域
      const sideMargin = isFullscreen ? 0.3 : 0.25;
      const isLeft = xPercent < sideMargin;

      state.current = {
        startX: x,
        startY: y,
        startTime: Date.now(),
        lastY: y,
        isLeft,
        isLongPressActive: false,
        hasMovedSignificantlyForLongPress: false,
        hasTriggeredDragging: false,
      };

      // 啟動長按定時器
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = setTimeout(() => {
        if (
          state.current &&
          !state.current.hasMovedSignificantlyForLongPress &&
          !state.current.hasTriggeredDragging
        ) {
          state.current.isLongPressActive = true;
          if (onLongPressStart) onLongPressStart();
          if (isTouch && navigator.vibrate) navigator.vibrate(50);
        }
      }, longPressDelay);
    },
    [videoContainerRef, onLongPressStart, longPressDelay, isFullscreen]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!state.current || !videoContainerRef.current) return;

      const rect = videoContainerRef.current.getBoundingClientRect();
      const currentX = clientX - rect.left;
      const currentY = clientY - rect.top;

      const deltaX = Math.abs(currentX - state.current.startX);
      const deltaYFromStart = Math.abs(currentY - state.current.startY);

      // 判定長按中斷
      if (
        deltaX > LONG_PRESS_MOVE_THRESHOLD ||
        deltaYFromStart > LONG_PRESS_MOVE_THRESHOLD
      ) {
        state.current.hasMovedSignificantlyForLongPress = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }

      // 如果長按已啟動，鎖定音量/亮度，禁止其他操作
      if (state.current.isLongPressActive) return;

      // 判斷是否應該觸發拖動
      if (!state.current.hasTriggeredDragging) {
        // 如果水平移動太明顯，判定為非音量/亮度操作 (例如使用者想捲動或只是帶過)
        if (deltaX > 100) {
          return;
        }

        if (deltaYFromStart > DRAG_START_THRESHOLD) {
          state.current.hasTriggeredDragging = true;
          // 關鍵點：觸發瞬間將 lastY 設為當前位置，防止數值突跳
          state.current.lastY = currentY;
        } else {
          return;
        }
      }

      // 執行拖動邏輯
      const yChange = state.current.lastY - currentY;
      if (state.current.isLeft) {
        if (onBrightnessChange) onBrightnessChange(yChange);
      } else {
        const xPercent = currentX / rect.width;
        // 如果起點就在右側 1/4，或是滑動過程中保持在右側
        if (state.current.startX / rect.width > 0.75 || xPercent > 0.75) {
          if (onVolumeChange) onVolumeChange(yChange);
        }
      }

      state.current.lastY = currentY;
    },
    [onVolumeChange, onBrightnessChange, videoContainerRef]
  );

  const handleEnd = useCallback(
    (clientX: number, clientY: number, _preventDefault = false) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (!state.current || !videoContainerRef.current) return;

      // 處理長按結束
      if (state.current.isLongPressActive) {
        if (onLongPressEnd) onLongPressEnd();
        // 關鍵：長按結束後重置雙擊判定，防止長按後的下一次點擊誤判為雙加
        lastTapTime.current = 0;
        state.current = null;
        return;
      }

      const rect = videoContainerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const xPercent = x / rect.width;
      const endTime = Date.now();
      const duration = endTime - state.current.startTime;

      const movedX = Math.abs(x - state.current.startX);
      const movedY = Math.abs(clientY - rect.top - state.current.startY);

      // 判定雙擊/單擊 (快速點擊且沒怎麼動)
      if (
        duration < 250 &&
        movedX < SWIPE_THRESHOLD &&
        movedY < SWIPE_THRESHOLD
      ) {
        let side: 'left' | 'right' | null = null;
        if (xPercent < 0.25) side = 'left';
        else if (xPercent > 0.75) side = 'right';

        if (side) {
          const timeSinceLastTap = endTime - lastTapTime.current;
          if (
            timeSinceLastTap < DOUBLE_TAP_DELAY &&
            lastTapSide.current === side
          ) {
            if (side === 'left' && onSeekBackward) onSeekBackward();
            else if (side === 'right' && onSeekForward) onSeekForward();
            lastTapTime.current = 0;
            lastTapSide.current = null;
          } else {
            lastTapTime.current = endTime;
            lastTapSide.current = side;
          }
        }
      }

      state.current = null;
    },
    [onLongPressEnd, onSeekBackward, onSeekForward, videoContainerRef]
  );
  return useMemo(
    () => ({
      onTouchStart: (e: TouchEvent) => {
        const touch = e.touches[0];
        if (touch) handleStart(touch.clientX, touch.clientY, true);
      },
      onTouchMove: (e: TouchEvent) => {
        if (e.cancelable) {
          if (
            isFullscreen ||
            state.current?.hasTriggeredDragging ||
            state.current?.isLongPressActive
          ) {
            e.preventDefault();
          }
        }
        const touch = e.touches[0];
        if (touch) handleMove(touch.clientX, touch.clientY);
      },
      onTouchEnd: (e: TouchEvent) => {
        const touch = e.changedTouches[0];
        if (touch) handleEnd(touch.clientX, touch.clientY);
      },
      onMouseDown: (e: MouseEvent) => {
        handleStart(e.clientX, e.clientY);
      },
      onMouseMove: (e: MouseEvent) => {
        handleMove(e.clientX, e.clientY);
      },
      onMouseUp: (e: MouseEvent) => {
        handleEnd(e.clientX, e.clientY);
      },
      onMouseLeave: (e: MouseEvent) => {
        handleEnd(e.clientX, e.clientY);
      },
      onContextMenu: (e: MouseEvent) => {
        e.preventDefault();
      },
    }),
    [handleEnd, handleMove, handleStart, isFullscreen]
  );
};
