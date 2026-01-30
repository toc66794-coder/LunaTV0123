/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
'use client';

import Artplayer from 'artplayer';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { filterAdsFromM3U8 } from '@/lib/utils';

import { setFocusScope } from './TVFocusProvider';

// Speed presets (0.5x to 3x in 0.25x increments)
const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];

interface SkipConfig {
  enable: boolean;
  intro_time: number;
  outro_time: number;
}

interface TVVideoPlayerProps {
  url: string;
  poster?: string;
  title?: string;
  currentEpisode?: number;
  totalEpisodes?: number;
  onEnded?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onEpisodeSelect?: (episode: number) => void;
  onClose?: () => void;
}

type MenuMode = 'main' | 'skip' | 'episodes' | null;

export function TVVideoPlayer({
  url,
  poster,
  title: _title,
  currentEpisode = 1,
  totalEpisodes = 1,
  onEnded,
  onNext,
  onPrev,
  onEpisodeSelect,
  onClose,
}: TVVideoPlayerProps) {
  const artRef = useRef<HTMLDivElement>(null);
  const artInstance = useRef<Artplayer | null>(null);

  // UI State
  const [showControls, setShowControls] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [menuMode, setMenuMode] = useState<MenuMode>(null);
  const [menuSelection, setMenuSelection] = useState(0);
  const [showSpeedIndicator, setShowSpeedIndicator] = useState(false);
  const [seekingState, setSeekingState] = useState<
    'forward' | 'backward' | null
  >(null);

  // Skip Config State
  const [skipConfig, setSkipConfig] = useState<SkipConfig>({
    enable: false,
    intro_time: 0,
    outro_time: 0,
  });

  // Episode Selector State
  const [selectedEpisode, setSelectedEpisode] = useState(currentEpisode);

  // Refs for key press tracking
  const keyPressTime = useRef<Record<string, number>>({});
  const longPressTimer = useRef<Record<string, NodeJS.Timeout>>({});
  const seekingInterval = useRef<NodeJS.Timeout | null>(null);
  const speedIndicatorTimer = useRef<NodeJS.Timeout | null>(null);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);
  const skipCheckTimer = useRef<NodeJS.Timeout | null>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const originalSpeed = useRef<number>(1);

  // Helper to show controls
  const wakeControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (!menuMode) setShowControls(false);
    }, 4000);
  }, [menuMode]);

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

    originalSpeed.current = art.playbackRate;
    art.playbackRate = 2;
    setSeekingState(direction);

    if (direction === 'forward') {
      art.notice.show = '⏩⏩ 2x 快進中';
    } else {
      art.notice.show = '⏪⏪ 2x 快退中';
    }

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

    art.playbackRate = originalSpeed.current;
    setSeekingState(null);
    art.notice.show = `已恢復 ${originalSpeed.current}x 播放`;
  }, []);

  // Menu navigation
  const handleMenuNavigation = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back') => {
      if (!menuMode) return;

      if (direction === 'back') {
        if (menuMode === 'main') {
          setMenuMode(null);
        } else {
          setMenuMode('main');
          setMenuSelection(0);
        }
        return;
      }

      if (menuMode === 'main') {
        const menuItems = ['片頭片尾跳過', '集數選擇', '關閉選單'];

        if (direction === 'up') {
          setMenuSelection((prev) =>
            prev > 0 ? prev - 1 : menuItems.length - 1
          );
        } else if (direction === 'down') {
          setMenuSelection((prev) =>
            prev < menuItems.length - 1 ? prev + 1 : 0
          );
        } else if (direction === 'ok') {
          if (menuSelection === 0) {
            setMenuMode('skip');
            setMenuSelection(0);
          } else if (menuSelection === 1) {
            setMenuMode('episodes');
            setSelectedEpisode(currentEpisode);
          } else {
            setMenuMode(null);
          }
        }
      } else if (menuMode === 'skip') {
        const skipItems = [
          '開關跳過',
          '設定片頭結束點',
          '設定片尾開始點',
          '清除設定',
          '返回',
        ];

        if (direction === 'up') {
          setMenuSelection((prev) =>
            prev > 0 ? prev - 1 : skipItems.length - 1
          );
        } else if (direction === 'down') {
          setMenuSelection((prev) =>
            prev < skipItems.length - 1 ? prev + 1 : 0
          );
        } else if (direction === 'ok') {
          if (menuSelection === 0) {
            setSkipConfig((prev) => ({ ...prev, enable: !prev.enable }));
            if (artInstance.current) {
              artInstance.current.notice.show = skipConfig.enable
                ? '已關閉跳過'
                : '已開啟跳過';
            }
          } else if (menuSelection === 1) {
            setSkipConfig((prev) => ({
              ...prev,
              intro_time: Math.floor(currentTime),
            }));
            if (artInstance.current) {
              artInstance.current.notice.show = `片頭結束點：${Math.floor(
                currentTime
              )}s`;
            }
          } else if (menuSelection === 2) {
            const outroTime = Math.floor(currentTime - duration);
            setSkipConfig((prev) => ({ ...prev, outro_time: outroTime }));
            if (artInstance.current) {
              artInstance.current.notice.show = `片尾開始點：結尾前 ${Math.abs(
                outroTime
              )}s`;
            }
          } else if (menuSelection === 3) {
            setSkipConfig({ enable: false, intro_time: 0, outro_time: 0 });
            if (artInstance.current) {
              artInstance.current.notice.show = '已清除跳過設定';
            }
          } else {
            setMenuMode('main');
            setMenuSelection(0);
          }
        }
      } else if (menuMode === 'episodes') {
        if (direction === 'left') {
          setSelectedEpisode((prev) => Math.max(1, prev - 1));
        } else if (direction === 'right') {
          setSelectedEpisode((prev) => Math.min(totalEpisodes, prev + 1));
        } else if (direction === 'ok') {
          if (onEpisodeSelect && selectedEpisode !== currentEpisode) {
            onEpisodeSelect(selectedEpisode);
          }
          setMenuMode(null);
        }
      }
    },
    [
      menuMode,
      menuSelection,
      skipConfig,
      currentTime,
      duration,
      currentEpisode,
      totalEpisodes,
      selectedEpisode,
      onEpisodeSelect,
    ]
  );

  // Handle short press (single click)
  const handleShortPress = useCallback(
    (key: string) => {
      if (!artInstance.current) return;
      const art = artInstance.current;

      // If menu is open, handle menu navigation
      if (menuMode) {
        if (key === 'ArrowUp') handleMenuNavigation('up');
        else if (key === 'ArrowDown') handleMenuNavigation('down');
        else if (key === 'ArrowLeft') handleMenuNavigation('left');
        else if (key === 'ArrowRight') handleMenuNavigation('right');
        else if (key === 'Enter' || key === 'OK') handleMenuNavigation('ok');
        return;
      }

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
    [duration, increaseSpeed, decreaseSpeed, menuMode, handleMenuNavigation]
  );

  // Handle long press
  const handleLongPress = useCallback(
    (key: string) => {
      if (menuMode) return; // Disable long press in menu

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
    [menuMode, startSeeking, resetSpeed]
  );

  // Skip intro/outro check
  useEffect(() => {
    if (!skipConfig.enable || !artInstance.current) return;

    const checkSkip = () => {
      if (!artInstance.current) return;
      const art = artInstance.current;
      const time = art.currentTime;

      // Skip intro
      if (skipConfig.intro_time > 0 && time < skipConfig.intro_time) {
        art.seek = skipConfig.intro_time;
        art.notice.show = `⏭️ 已跳過片頭 (至 ${skipConfig.intro_time}s)`;
      }

      // Skip outro
      if (skipConfig.outro_time < 0 && duration > 0) {
        const outroStart = duration + skipConfig.outro_time;
        if (time > outroStart) {
          if (onNext) {
            onNext();
            art.notice.show = '⏭️ 已跳過片尾，播放下一集';
          } else {
            art.pause();
            art.notice.show = '⏭️ 已跳過片尾';
          }
        }
      }
    };

    skipCheckTimer.current = setInterval(checkSkip, 1500);

    return () => {
      if (skipCheckTimer.current) {
        clearInterval(skipCheckTimer.current);
      }
    };
  }, [skipConfig, duration, onNext]);

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
        if (menuMode) {
          handleMenuNavigation('back');
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
        setMenuMode((prev) => (prev ? null : 'main'));
        setMenuSelection(0);
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
    menuMode,
    wakeControls,
    handleLongPress,
    handleShortPress,
    stopSeeking,
    handleMenuNavigation,
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
      if (skipCheckTimer.current) clearInterval(skipCheckTimer.current);

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

      {/* Transparent mask */}
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

      {/* Settings Menu */}
      {menuMode && (
        <div className='absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm'>
          <div className='bg-gray-900/95 border-2 border-gray-700 rounded-3xl p-8 min-w-[600px] max-w-[800px]'>
            {menuMode === 'main' && (
              <>
                <h2 className='text-3xl font-bold text-white mb-6'>播放設定</h2>
                <div className='space-y-3'>
                  {['片頭片尾跳過', '集數選擇', '關閉選單'].map(
                    (item, index) => (
                      <div
                        key={index}
                        className={`px-6 py-4 rounded-xl text-xl font-medium transition-all ${
                          menuSelection === index
                            ? 'bg-blue-600 text-white scale-105'
                            : 'bg-gray-800 text-gray-300'
                        }`}
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>
              </>
            )}

            {menuMode === 'skip' && (
              <>
                <h2 className='text-3xl font-bold text-white mb-6'>
                  片頭片尾跳過設定
                </h2>
                <div className='space-y-3'>
                  {[
                    `${skipConfig.enable ? '✓ 已開啟' : '✗ 已關閉'} 跳過功能`,
                    `設定片頭結束點 (當前: ${skipConfig.intro_time}s)`,
                    `設定片尾開始點 (當前: 結尾前 ${Math.abs(
                      skipConfig.outro_time
                    )}s)`,
                    '清除所有設定',
                    '返回上一層',
                  ].map((item, index) => (
                    <div
                      key={index}
                      className={`px-6 py-4 rounded-xl text-lg font-medium transition-all ${
                        menuSelection === index
                          ? 'bg-blue-600 text-white scale-105'
                          : 'bg-gray-800 text-gray-300'
                      }`}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </>
            )}

            {menuMode === 'episodes' && (
              <>
                <h2 className='text-3xl font-bold text-white mb-6'>選擇集數</h2>
                <div className='flex items-center justify-center gap-4 mb-6'>
                  <button className='text-4xl text-gray-400'>←</button>
                  <div className='text-6xl font-bold text-white'>
                    第 {selectedEpisode} 集
                  </div>
                  <button className='text-4xl text-gray-400'>→</button>
                </div>
                <div className='text-center text-gray-400 text-lg'>
                  共 {totalEpisodes} 集 · 使用左右鍵選擇 · OK 確認
                </div>
              </>
            )}

            <div className='mt-6 text-center text-sm text-gray-500'>
              使用方向鍵選擇 · OK 確認 · Back 返回
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar with Skip Markers */}
      {showControls && (
        <div className='absolute bottom-0 left-0 right-0 z-[55]'>
          {/* Skip Markers */}
          {skipConfig.enable && duration > 0 && (
            <div className='relative h-1 bg-gray-800'>
              <div
                className='absolute top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all'
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              {skipConfig.intro_time > 0 && (
                <div
                  className='absolute top-0 h-full w-1 bg-yellow-500'
                  style={{
                    left: `${(skipConfig.intro_time / duration) * 100}%`,
                  }}
                />
              )}
              {skipConfig.outro_time < 0 && (
                <div
                  className='absolute top-0 h-full w-1 bg-red-500'
                  style={{
                    left: `${
                      ((duration + skipConfig.outro_time) / duration) * 100
                    }%`,
                  }}
                />
              )}
            </div>
          )}

          {/* Time Display */}
          <div className='flex items-center justify-center py-3'>
            <div className='px-6 py-2 rounded-full bg-black/60 backdrop-blur-sm text-white text-base font-medium'>
              {Math.floor(currentTime)} / {Math.floor(duration)} · {speed}x
              {skipConfig.enable && ' · ⏭️ 跳過已啟用'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
