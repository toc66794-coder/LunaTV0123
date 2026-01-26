import { useCallback, useRef } from 'react';

interface UseVideoGesturesOptions {
  onVolumeChange?: (delta: number) => void;
  onBrightnessChange?: (delta: number) => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  videoContainerRef: React.RefObject<HTMLDivElement>;
  longPressDelay?: number;
}

interface TouchInfo {
  startX: number;
  startY: number;
  startTime: number;
  lastY: number;
  isLeft: boolean;
  isLongPressActive: boolean;
  hasMovedSignificantly: boolean;
}

const DOUBLE_TAP_DELAY = 300;
const SWIPE_THRESHOLD = 10;
const MOVE_THRESHOLD = 50; // 用於判定長按是否中斷的靈敏度
const VERTICAL_DRAG_THRESHOLD = 30; // 手指垂直方向必須拉動超過 30px 才觸發音量/亮度

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
  const touchInfo = useRef<TouchInfo | null>(null);
  const lastTapTime = useRef<number>(0);
  const lastTapSide = useRef<'left' | 'right' | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!videoContainerRef.current) return;

      const touch = e.touches[0];
      const rect = videoContainerRef.current.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const xPercent = x / rect.width;

      let isLeft = false;
      if (xPercent < 0.25) {
        isLeft = true;
      } else if (xPercent > 0.75) {
        isLeft = false;
      } else {
        // 中間區域不處理手勢，但仍支援長按（如果需要全畫面長按）
        // 這裡我們暫定全畫面支援長按，但只有兩側支援滑動
      }

      touchInfo.current = {
        startX: x,
        startY: y,
        startTime: Date.now(),
        lastY: y,
        isLeft,
        isLongPressActive: false,
        hasMovedSignificantly: false,
      };

      // 啟動長按定時器
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = setTimeout(() => {
        if (touchInfo.current && !touchInfo.current.hasMovedSignificantly) {
          touchInfo.current.isLongPressActive = true;
          if (onLongPressStart) onLongPressStart();
          if (navigator.vibrate) navigator.vibrate(50);
        }
      }, longPressDelay);
    },
    [videoContainerRef, onLongPressStart, longPressDelay]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchInfo.current || !videoContainerRef.current) return;

      const touch = e.touches[0];
      const rect = videoContainerRef.current.getBoundingClientRect();
      const currentX = touch.clientX - rect.left;
      const currentY = touch.clientY - rect.top;

      const deltaX = Math.abs(currentX - touchInfo.current.startX);
      const deltaY = Math.abs(currentY - touchInfo.current.startY);

      // 如果移動過大，取消待發送的長按觸發
      if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
        touchInfo.current.hasMovedSignificantly = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }

      // 如果長按已啟動，鎖定音量/亮度調整
      if (touchInfo.current.isLongPressActive) return;

      // 檢查垂直移動是否超過閾值 (解決問題 1)
      if (deltaY < VERTICAL_DRAG_THRESHOLD) return;

      const yChange = touchInfo.current.lastY - currentY;
      const xPercent = touchInfo.current.startX / rect.width;

      if (xPercent < 0.25) {
        if (onBrightnessChange) onBrightnessChange(yChange);
      } else if (xPercent > 0.75) {
        if (onVolumeChange) onVolumeChange(yChange);
      }

      touchInfo.current.lastY = currentY;
    },
    [onVolumeChange, onBrightnessChange, videoContainerRef]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (!touchInfo.current || !videoContainerRef.current) return;

      // 如果長按曾啟動過，結束它並返回 (解決問題 2)
      if (touchInfo.current.isLongPressActive) {
        if (onLongPressEnd) onLongPressEnd();
        touchInfo.current = null;
        if (e.cancelable) e.preventDefault();
        return;
      }

      const endTime = Date.now();
      const duration = endTime - touchInfo.current.startTime;
      const rect = videoContainerRef.current.getBoundingClientRect();
      const touch = e.changedTouches[0];
      const endX = touch.clientX - rect.left;
      const endY = touch.clientY - rect.top;

      const movedX = Math.abs(endX - touchInfo.current.startX);
      const movedY = Math.abs(endY - touchInfo.current.startY);

      // 快速點擊且沒怎麼動 -> 檢查雙擊
      if (
        duration < 200 &&
        movedX < SWIPE_THRESHOLD &&
        movedY < SWIPE_THRESHOLD
      ) {
        const xPercent = touchInfo.current.startX / rect.width;
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

      touchInfo.current = null;
    },
    [onLongPressEnd, onSeekBackward, onSeekForward, videoContainerRef]
  );

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
};
