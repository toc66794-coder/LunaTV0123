import { useCallback, useRef } from 'react';

interface UseVideoGesturesOptions {
  onVolumeChange?: (delta: number) => void;
  onBrightnessChange?: (delta: number) => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  longPressDelay?: number;
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

      const isLeft = xPercent < 0.25;

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
        // 增加 !state.current.hasTriggeredDragging 判定：
        // 如果使用者已經開始拉動音量/亮度，則不再觸發長按加速
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
    [videoContainerRef, onLongPressStart, longPressDelay]
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

      // 如果長按已啟動，鎖定音量/亮度
      if (state.current.isLongPressActive) return;

      // 判斷是否應該觸發拖動
      if (!state.current.hasTriggeredDragging) {
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
  return {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
    onTouchStart: (e: React.TouchEvent | TouchEvent) => {
      /* eslint-disable no-console */
      console.log('[Gestures] native onTouchStart');
      const event = (e as React.TouchEvent).nativeEvent || (e as TouchEvent);
      if (event.stopPropagation) event.stopPropagation();
      if (event.cancelable && event.preventDefault) event.preventDefault();
      const touch =
        (e as TouchEvent).touches?.[0] ||
        (e as TouchEvent).changedTouches?.[0] ||
        (e as React.TouchEvent).touches?.[0];
      if (touch) handleStart(touch.clientX, touch.clientY, true);
    },
    onTouchMove: (e: React.TouchEvent | TouchEvent) => {
      const event = (e as React.TouchEvent).nativeEvent || (e as TouchEvent);
      if (event.cancelable && event.preventDefault) event.preventDefault();
      const touch =
        (e as TouchEvent).touches?.[0] || (e as React.TouchEvent).touches?.[0];
      if (touch) handleMove(touch.clientX, touch.clientY);
    },
    onTouchEnd: (e: React.TouchEvent | TouchEvent) => {
      console.log('[Gestures] native onTouchEnd');
      const touch =
        (e as TouchEvent).changedTouches?.[0] ||
        (e as React.TouchEvent).changedTouches?.[0];
      if (touch) handleEnd(touch.clientX, touch.clientY);
      /* eslint-enable no-console */
    },
    onMouseDown: (e: React.MouseEvent) => {
      e.stopPropagation();
      handleStart(e.clientX, e.clientY);
    },
    onMouseMove: (e: React.MouseEvent) => {
      e.stopPropagation();
      handleMove(e.clientX, e.clientY);
    },
    onMouseUp: (e: React.MouseEvent) => {
      e.stopPropagation();
      handleEnd(e.clientX, e.clientY);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      e.stopPropagation();
      handleEnd(e.clientX, e.clientY);
    },
  };
};
