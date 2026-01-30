/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
'use client';

import Artplayer from 'artplayer';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { filterAdsFromM3U8 } from '@/lib/utils';

import { setFocusScope } from './TVFocusProvider';

// Speed presets (0.5x to 3x in 0.25x increments)
const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];

interface TVVideoPlayerProps {
  url: string;
  poster?: string;
  title?: string;
  onEnded?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onClose?: () => void;
}

export function TVVideoPlayer({
  url,
  poster,
  title: _title,
  onEnded,
  onNext,
  onPrev,
  onClose,
}: TVVideoPlayerProps) {
  const artRef = useRef<HTMLDivElement>(null);
  const artInstance = useRef<Artplayer | null>(null);

  // UI State
  const [showControls, setShowControls] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showMenu, setShowMenu] = useState(false);
  const [showSpeedIndicator, setShowSpeedIndicator] = useState(false);
  const [seekingState, setSeekingState] = useState<
    'forward' | 'backward' | null
  >(null);

  // Refs for key press tracking
  const keyPressTime = useRef<Record<string, number>>({});
  const longPressTimer = useRef<Record<string, NodeJS.Timeout>>({});
  const seekingInterval = useRef<NodeJS.Timeout | null>(null);
  const speedIndicatorTimer = useRef<NodeJS.Timeout | null>(null);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const originalSpeed = useRef<number>(1);

  // Helper to show controls
  const wakeControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (!showMenu) setShowControls(false);
    }, 4000);
  }, [showMenu]);

  // Show speed indicator with auto-hide
  const showSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    setShowSpeedIndicator(true);

    if (speedIndicatorTimer.current) {
      clearTimeout(speedIndicatorTimer.current);
    }

    speedIndicatorTimer.current = setTimeout(() => {
      setShowSpeedIndicator(false);
    }, 3000);
  }, []);

  // Increase speed
  const increaseSpeed = useCallback(() => {
    if (!artInstance.current) return;
    const art = artInstance.current;
    const currentIndex = SPEED_PRESETS.findIndex(
      (s) => Math.abs(s - art.playbackRate) < 0.01
    );
    const nextIndex =
      currentIndex >= SPEED_PRESETS.length - 1 ? 0 : currentIndex + 1;
    const newSpeed = SPEED_PRESETS[nextIndex];

    art.playbackRate = newSpeed;
    showSpeedChange(newSpeed);
    art.notice.show = `⏱️ ${newSpeed}x`;
  }, [showSpeedChange]);

  // Decrease speed
  const decreaseSpeed = useCallback(() => {
    if (!artInstance.current) return;
    const art = artInstance.current;
    const currentIndex = SPEED_PRESETS.findIndex(
      (s) => Math.abs(s - art.playbackRate) < 0.01
    );
    const nextIndex =
      currentIndex <= 0 ? SPEED_PRESETS.length - 1 : currentIndex - 1;
    const newSpeed = SPEED_PRESETS[nextIndex];

    art.playbackRate = newSpeed;
    showSpeedChange(newSpeed);
    art.notice.show = `⏱️ ${newSpeed}x`;
  }, [showSpeedChange]);

  // Reset speed to 1x
  const resetSpeed = useCallback(() => {
    if (!artInstance.current) return;
    const art = artInstance.current;
    art.playbackRate = 1;
    showSpeedChange(1);
    art.notice.show = '⏱️ 1.0x (已重置)';
  }, [showSpeedChange]);

  // Start continuous seeking
  const startSeeking = useCallback((direction: 'forward' | 'backward') => {
    if (!artInstance.current) return;
    const art = artInstance.current;

    // Save original speed and set to 2x for seeking
    originalSpeed.current = art.playbackRate;
    art.playbackRate = 2;
    setSeekingState(direction);

    if (direction === 'forward') {
      art.notice.show = '⏩⏩ 2x 快進中';
    } else {
      art.notice.show = '⏪⏪ 2x 快退中';
    }

    // Start seeking interval
    seekingInterval.current = setInterval(() => {
      if (!artInstance.current) return;
      const currentArt = artInstance.current;

      if (direction === 'forward') {
        currentArt.seek = Math.min(
          currentArt.duration,
          currentArt.currentTime + 2
        );
      } else {
        currentArt.seek = Math.max(0, currentArt.currentTime - 2);
      }
    }, 1000);
  }, []);

  // Stop continuous seeking
  const stopSeeking = useCallback(() => {
    if (!artInstance.current) return;
    const art = artInstance.current;

    if (seekingInterval.current) {
      clearInterval(seekingInterval.current);
      seekingInterval.current = null;
    }

    // Restore original speed
    art.playbackRate = originalSpeed.current;
    setSeekingState(null);
    art.notice.show = `已恢復 ${originalSpeed.current}x 播放`;
  }, []);

  // Handle short press (single click)
  const handleShortPress = useCallback(
    (key: string) => {
      if (!artInstance.current) return;
      const art = artInstance.current;

      switch (key) {
        case 'ArrowLeft':
        case 'Rewind':
          art.seek = Math.max(0, art.currentTime - 10);
          art.notice.show = '⏪ -10s';
          break;
        case 'ArrowRight':
        case 'FastForward':
          art.seek = Math.min(duration, art.currentTime + 10);
          art.notice.show = '⏩ +10s';
          break;
        case 'ArrowUp':
          increaseSpeed();
          break;
        case 'ArrowDown':
          decreaseSpeed();
          break;
        case 'Enter':
        case 'OK':
        case 'MediaPlayPause':
        case ' ':
          art.toggle();
          break;
      }
    },
    [duration, increaseSpeed, decreaseSpeed]
  );

  // Handle long press
  const handleLongPress = useCallback(
    (key: string) => {
      switch (key) {
        case 'ArrowLeft':
        case 'Rewind':
          startSeeking('backward');
          break;
        case 'ArrowRight':
        case 'FastForward':
          startSeeking('forward');
          break;
        case 'Enter':
        case 'OK':
          resetSpeed();
          break;
      }
    },
    [startSeeking, resetSpeed]
  );

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (!artInstance.current) return;
      wakeControls();

      const key = e.key;

      // Handle special keys
      if (key === 'Escape' || key === 'Back' || key === 'Backspace') {
        if (showMenu) {
          setShowMenu(false);
          e.preventDefault();
          return;
        }
        if (onClose) onClose();
        e.preventDefault();
        return;
      }

      if (key === 'PageUp' || key === 'ChannelUp') {
        if (onPrev) onPrev();
        e.preventDefault();
        return;
      }

      if (key === 'PageDown' || key === 'ChannelDown') {
        if (onNext) onNext();
        e.preventDefault();
        return;
      }

      if (key === 'Menu' || key === 'm' || key === 'M') {
        setShowMenu((prev) => !prev);
        e.preventDefault();
        return;
      }

      // Track key press time for long press detection
      if (!keyPressTime.current[key]) {
        keyPressTime.current[key] = Date.now();

        // Set long press timer (500ms)
        longPressTimer.current[key] = setTimeout(() => {
          handleLongPress(key);
        }, 500);
      }

      e.preventDefault();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      const pressTime = Date.now() - (keyPressTime.current[key] || 0);

      // Clear long press timer
      if (longPressTimer.current[key]) {
        clearTimeout(longPressTimer.current[key]);
        delete longPressTimer.current[key];
      }

      // If it was a long press on seek keys, stop seeking
      if (
        (key === 'ArrowLeft' ||
          key === 'ArrowRight' ||
          key === 'Rewind' ||
          key === 'FastForward') &&
        pressTime >= 500
      ) {
        stopSeeking();
      } else if (pressTime < 500) {
        // Short press
        handleShortPress(key);
      }

      // Reset press time
      keyPressTime.current[key] = 0;
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, {
        capture: true,
      } as any);
      window.removeEventListener('keyup', handleKeyUp, {
        capture: true,
      } as any);
    };
  }, [
    duration,
    onClose,
    onNext,
    onPrev,
    showMenu,
    wakeControls,
    handleLongPress,
    handleShortPress,
    stopSeeking,
  ]);

  // Set focus scope
  useEffect(() => {
    setFocusScope(artRef.current?.parentElement || null);
    return () => setFocusScope(null);
  }, []);

  // Initialize Artplayer
  useEffect(() => {
    if (!artRef.current) return;

    const art = new Artplayer({
      container: artRef.current,
      url,
      poster,
      autoplay: true,
      playbackRate: true,
      fullscreen: true,
      fullscreenWeb: true,
      customType: {
        m3u8: async function (video: HTMLVideoElement, u: string) {
          const { default: Hls } = await import('hls.js');
          if (!Hls) return;

          class CustomHlsJsLoader extends (Hls as any).DefaultConfig.loader {
            constructor(config: any) {
              super(config);
              const load = (this as any).load.bind(this);
              (this as any).load = function (
                context: any,
                config: any,
                callbacks: any
              ) {
                if (context.type === 'manifest' || context.type === 'level') {
                  const onSuccess = callbacks.onSuccess;
                  callbacks.onSuccess = function (
                    response: any,
                    stats: any,
                    ctx: any
                  ) {
                    if (response.data && typeof response.data === 'string') {
                      response.data = filterAdsFromM3U8(response.data);
                    }
                    return onSuccess(response, stats, ctx, null);
                  };
                }
                load(context, config, callbacks);
              };
            }
          }

          const hls = new (Hls as any)({ loader: CustomHlsJsLoader });
          hls.loadSource(u);
          hls.attachMedia(video);
          (video as any).hls = hls;
        },
      },
    });

    artInstance.current = art;

    art.on('ready', () => {
      setDuration(art.duration || 0);
    });

    art.on('video:timeupdate', () => setCurrentTime(art.currentTime));

    art.on('video:ended', () => {
      if (onEnded) onEnded();
      if (onNext) onNext();
    });

    return () => {
      try {
        if ((art as any).video && (art as any).video.hls) {
          (art as any).video.hls.destroy();
        }
        art.destroy();
      } catch (e) {
        void e;
      }
      artInstance.current = null;
    };
  }, [url, poster, onEnded, onNext]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (seekingInterval.current) clearInterval(seekingInterval.current);
      if (speedIndicatorTimer.current)
        clearTimeout(speedIndicatorTimer.current);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);

      // Copy ref value to local variable for cleanup
      const timers = longPressTimer.current;
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className='w-full h-full relative'>
      <div
        ref={artRef}
        className='w-full h-full'
        style={{ width: '100%', height: '100%' }}
      />

      {/* Transparent mask to prevent Artplayer's default controls */}
      <div
        ref={maskRef}
        className='absolute inset-0 z-50'
        style={{ background: 'transparent', pointerEvents: 'auto' }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />

      {/* Speed Indicator (Large - Center) */}
      {showSpeedIndicator && (
        <div className='absolute inset-0 z-[60] flex items-center justify-center pointer-events-none'>
          <div className='bg-black/80 backdrop-blur-sm border-2 border-blue-500 rounded-3xl px-12 py-8 animate-in zoom-in fade-in duration-200'>
            <div className='text-6xl font-bold text-white'>⏱️ {speed}x</div>
          </div>
        </div>
      )}

      {/* Speed Indicator (Small - Top Left) */}
      {!showSpeedIndicator && speed !== 1 && (
        <div className='absolute top-4 left-4 z-[55] bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full'>
          <span className='text-white text-sm font-semibold'>⏱️ {speed}x</span>
        </div>
      )}

      {/* Seeking Indicator */}
      {seekingState && (
        <div className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] pointer-events-none'>
          <div className='bg-black/80 backdrop-blur-sm border-2 border-yellow-500 rounded-3xl px-12 py-8'>
            <div className='text-5xl font-bold text-white'>
              {seekingState === 'forward' ? '⏩⏩ 2x 快進中' : '⏪⏪ 2x 快退中'}
            </div>
          </div>
        </div>
      )}

      {/* Menu */}
      {showMenu && (
        <div className='absolute inset-0 z-[60] flex items-center justify-center bg-black/60'>
          <div className='bg-gray-900/80 border border-gray-700 rounded-2xl px-6 py-4 text-white'>
            <div className='text-lg font-semibold'>播放設定</div>
            <div className='mt-3 text-sm opacity-80'>
              按下方向鍵選擇，Back/Esc 關閉
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {showControls && (
        <div className='absolute bottom-4 left-0 right-0 z-[55] flex items-center justify-center'>
          <div className='px-4 py-2 rounded-full bg-black/50 text-white text-sm'>
            {Math.floor(currentTime)} / {Math.floor(duration)} · {speed}x
          </div>
        </div>
      )}
    </div>
  );
}
