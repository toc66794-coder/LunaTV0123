import { useCallback, useRef } from 'react';

interface UseLongPressOptions {
  onLongPress?: () => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  onClick?: () => void;
  longPressDelay?: number;
  moveThreshold?: number;
}

interface TouchPosition {
  x: number;
  y: number;
}

export const useLongPress = ({
  onLongPress,
  onLongPressStart,
  onLongPressEnd,
  onClick,
  longPressDelay = 500,
  moveThreshold = 10,
}: UseLongPressOptions) => {
  const isLongPress = useRef(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const startPosition = useRef<TouchPosition | null>(null);
  const isActive = useRef(false); // Valid touch sequence active
  const hasTriggered = useRef(false); // Long press has triggered

  const clearTimer = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      // Ignore if already active
      if (isActive.current) return;

      isActive.current = true;
      isLongPress.current = false;
      hasTriggered.current = false;
      startPosition.current = { x: clientX, y: clientY };

      pressTimer.current = setTimeout(() => {
        if (!isActive.current) return;

        isLongPress.current = true;
        hasTriggered.current = true;

        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        // Trigger Long Press Start
        if (onLongPressStart) onLongPressStart();
        if (onLongPress) onLongPress();
      }, longPressDelay);
    },
    [onLongPress, onLongPressStart, longPressDelay]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!startPosition.current || !isActive.current) return;

      const distance = Math.sqrt(
        Math.pow(clientX - startPosition.current.x, 2) +
          Math.pow(clientY - startPosition.current.y, 2)
      );

      // If moved beyond threshold
      if (distance > moveThreshold) {
        // If we were already long pressing, end it
        if (hasTriggered.current) {
          if (onLongPressEnd) onLongPressEnd();
        }

        clearTimer();
        isActive.current = false;
        isLongPress.current = false;
        hasTriggered.current = false;
      }
    },
    [clearTimer, moveThreshold, onLongPressEnd]
  );

  const handleEnd = useCallback(() => {
    clearTimer();

    // 如果長按已經觸發過,無論 isActive 狀態如何都要調用 onLongPressEnd
    if (hasTriggered.current) {
      // Long press ended - always call onLongPressEnd to restore playback rate
      if (onLongPressEnd) onLongPressEnd();
    } else if (isActive.current) {
      // Click triggered (only if was active and never triggered long press)
      if (onClick) onClick();
    }

    // Reset interaction state
    isLongPress.current = false;
    hasTriggered.current = false;
    isActive.current = false;
    startPosition.current = null;
  }, [clearTimer, onClick, onLongPressEnd]);

  // Touch Event Handlers
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    },
    [handleStart]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    },
    [handleMove]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // Always prevent default if we handled a long press to avoid context menus
      if (hasTriggered.current) {
        if (e.cancelable) e.preventDefault();
      }
      handleEnd();
    },
    [handleEnd]
  );

  // Mouse Support
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleStart(e.clientX, e.clientY);
    },
    [handleStart]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const onMouseUp = useCallback(
    (_e: React.MouseEvent) => {
      handleEnd();
    },
    [handleEnd]
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave: onMouseUp,
  };
};
