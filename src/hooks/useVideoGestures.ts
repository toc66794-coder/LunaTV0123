import { useCallback, useRef } from 'react';

interface UseVideoGesturesOptions {
  onVolumeChange?: (delta: number) => void;
  onBrightnessChange?: (delta: number) => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  videoContainerRef: React.RefObject<HTMLDivElement>;
}

interface TouchInfo {
  startX: number;
  startY: number;
  startTime: number;
  lastY: number;
  isLeft: boolean; // true = 左側, false = 右側
}

const DOUBLE_TAP_DELAY = 300; // 雙擊間隔時間 (ms)
const SWIPE_THRESHOLD = 10; // 滑動閾值 (px)
const SEEK_TIME = 10; // 快進/後退秒數

export const useVideoGestures = ({
  onVolumeChange,
  onBrightnessChange,
  onSeekBackward,
  onSeekForward,
  videoContainerRef,
}: UseVideoGesturesOptions) => {
  const touchInfo = useRef<TouchInfo | null>(null);
  const lastTapTime = useRef<number>(0);
  const lastTapSide = useRef<'left' | 'right' | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!videoContainerRef.current) return;

      const touch = e.touches[0];
      const rect = videoContainerRef.current.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const containerWidth = rect.width;

      // 判斷是左側還是右側 (左側 < 50%, 右側 >= 50%)
      const isLeft = x < containerWidth / 2;

      touchInfo.current = {
        startX: x,
        startY: y,
        startTime: Date.now(),
        lastY: y,
        isLeft,
      };
    },
    [videoContainerRef]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchInfo.current) return;

      const touch = e.touches[0];
      if (!videoContainerRef.current) return;

      const rect = videoContainerRef.current.getBoundingClientRect();
      const currentY = touch.clientY - rect.top;
      const deltaY = touchInfo.current.lastY - currentY; // 向上為正,向下為負

      // 檢查是否超過滑動閾值
      const totalDeltaY = Math.abs(currentY - touchInfo.current.startY);
      if (totalDeltaY < SWIPE_THRESHOLD) return;

      // 根據左右側調整音量或亮度
      if (touchInfo.current.isLeft) {
        // 左側調整亮度
        if (onBrightnessChange) {
          onBrightnessChange(deltaY);
        }
      } else {
        // 右側調整音量
        if (onVolumeChange) {
          onVolumeChange(deltaY);
        }
      }

      touchInfo.current.lastY = currentY;
    },
    [onVolumeChange, onBrightnessChange, videoContainerRef]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchInfo.current || !videoContainerRef.current) return;

      const endTime = Date.now();
      const duration = endTime - touchInfo.current.startTime;
      const rect = videoContainerRef.current.getBoundingClientRect();

      // 使用 changedTouches 獲取結束時的觸摸點
      const touch = e.changedTouches[0];
      const endY = touch.clientY - rect.top;
      const deltaY = Math.abs(endY - touchInfo.current.startY);

      // 如果是快速點擊且沒有明顯滑動,檢查是否為雙擊
      if (duration < 200 && deltaY < SWIPE_THRESHOLD) {
        const currentSide = touchInfo.current.isLeft ? 'left' : 'right';
        const timeSinceLastTap = endTime - lastTapTime.current;

        // 檢查是否為雙擊 (同一側且在時間範圍內)
        if (
          timeSinceLastTap < DOUBLE_TAP_DELAY &&
          lastTapSide.current === currentSide
        ) {
          // 雙擊事件
          if (currentSide === 'left' && onSeekBackward) {
            onSeekBackward();
          } else if (currentSide === 'right' && onSeekForward) {
            onSeekForward();
          }
          // 重置雙擊狀態
          lastTapTime.current = 0;
          lastTapSide.current = null;
        } else {
          // 記錄第一次點擊
          lastTapTime.current = endTime;
          lastTapSide.current = currentSide;
        }
      }

      touchInfo.current = null;
    },
    [onSeekBackward, onSeekForward, videoContainerRef]
  );

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
};
