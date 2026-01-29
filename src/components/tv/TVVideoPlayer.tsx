/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
'use client';

import Artplayer from 'artplayer';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { filterAdsFromM3U8 } from '@/lib/utils';

import { setFocusScope } from './TVFocusProvider';

// import { useTvFocus } from './TVFocusProvider'; // Temporarily commented out if unused

interface TVVideoPlayerProps {
  url: string;
  poster?: string;
  title?: string;
  onEnded?: () => void;
  onNext?: () => void;
  onClose?: () => void;
}

export function TVVideoPlayer({
  url,
  poster,
  title,
  onEnded,
  onNext,
  onClose,
}: TVVideoPlayerProps) {
  const artRef = useRef<HTMLDivElement>(null);
  const artInstance = useRef<Artplayer | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showMenu, setShowMenu] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Timer for hiding controls
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Helper to show controls
  const wakeControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (!showMenu) setShowControls(false); // Make sure menu isn't open
    }, 4000);
  }, [showMenu]);

  // Handle remote keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If player not ready, ignore
      if (!artInstance.current) return;
      const art = artInstance.current;

      wakeControls();

      switch (e.key) {
        case 'Enter':
        case 'OK': // Some TVs use OK
          art.toggle();
          break;
        case 'ArrowLeft':
          art.seek = Math.max(0, art.currentTime - 10);
          art.notice.show = '⏪ -10s';
          break;
        case 'ArrowRight':
          art.seek = Math.min(duration, art.currentTime + 10);
          art.notice.show = '⏩ +10s';
          break;
        case 'ArrowUp':
          setShowMenu((prev) => !prev);
          break;
        case 'ArrowDown':
          // Just show controls (already done by wakeControls)
          break;
        case 'Escape':
        case 'Back':
        case 'Backspace': // Some remotes map Back to Backspace
          if (showMenu) {
            setShowMenu(false);
            e.preventDefault();
            return;
          }
          if (onClose) onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration, onNext, onClose, wakeControls, showMenu]);

  // Focus scope management: when player overlay mounts, restrict TV focus to overlay
  useEffect(() => {
    const el = overlayRef.current;
    if (el) {
      setFocusScope(el);
      const firstFocusable = el.querySelector(
        '[data-tv-focusable="true"]'
      ) as HTMLElement | null;
      if (firstFocusable) firstFocusable.focus();
    }
    return () => {
      setFocusScope(null);
    };
  }, []);

  // Initialize Player
  useEffect(() => {
    if (!artRef.current) return;

    // Direct HLS config similar to VideoPlayer.tsx but simplified for TV
    const art = new Artplayer({
      container: artRef.current,
      url: url,
      poster: poster,
      title: title,
      volume: 1,
      isLive: false,
      muted: false,
      autoplay: true,
      autoSize: true,
      autoMini: false,
      setting: true,
      loop: false,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      subtitleOffset: true,
      miniProgressBar: false, // We build our own
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoPlayback: true,
      airplay: true,
      theme: '#23ade5',
      moreVideoAttr: {
        crossOrigin: 'anonymous',
      },
      customType: {
        m3u8: async function (video: HTMLVideoElement, url: string) {
          const { default: Hls } = await import('hls.js');
          if (!Hls) return;

          // Check for ad block setting (default true)
          let blockAdEnabled = true;
          if (typeof window !== 'undefined') {
            const v = localStorage.getItem('enable_blockad');
            if (v !== null) blockAdEnabled = v === 'true';
          }

          class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
            constructor(config: any) {
              super(config);
              const load = this.load.bind(this);
              this.load = function (context: any, config: any, callbacks: any) {
                if (context.type === 'manifest' || context.type === 'level') {
                  const onSuccess = callbacks.onSuccess;
                  callbacks.onSuccess = function (
                    response: any,
                    stats: any,
                    context: any
                  ) {
                    if (response.data && typeof response.data === 'string') {
                      response.data = filterAdsFromM3U8(response.data);
                    }
                    return onSuccess(response, stats, context, null);
                  };
                }
                load(context, config, callbacks);
              };
            }
          }

          if (Hls.isSupported()) {
            const hls = new Hls({
              debug: false,
              enableWorker: true,
              lowLatencyMode: true,
              loader: blockAdEnabled
                ? CustomHlsJsLoader
                : Hls.DefaultConfig.loader,
            });
            hls.loadSource(url);
            hls.attachMedia(video);
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
          }
        },
      },
    } as any); // Type assertion to bypass missing title prop in Artplayer definition

    art.on('ready', () => {
      setLoading(false);
      setDuration(art.duration);
      setIsPlaying(true);
      wakeControls();
    });

    art.on('play', () => setIsPlaying(true));
    art.on('pause', () => setIsPlaying(false));
    art.on('video:timeupdate' as any, () => setCurrentTime(art.currentTime));
    art.on('video:ratechange', () => setSpeed(art.playbackRate));
    art.on('video:ended', () => {
      if (onEnded) onEnded();
    });

    // Custom "Long Press OK" Logic check using plain events or internal state?
    // Implementing simple logic: if we see rapid switching or specialized logic needed, we add it.
    // For now the keydown listener above handles basics.

    artInstance.current = art;

    return () => {
      if (artInstance.current) artInstance.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Format helper
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  return (
    <div className='fixed inset-0 bg-black z-50'>
      <div ref={artRef} className='w-full h-full' />

      {/* TV Custom Overlay */}
      <div
        ref={overlayRef}
        className={`absolute inset-0 pointer-events-auto transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.9), transparent 40%)',
        }}
      >
        {/* Top Bar: Title & Status */}
        <div className='absolute top-0 left-0 right-0 p-8 flex justify-between items-start'>
          <h2 className='text-3xl font-bold text-white drop-shadow-md'>
            {title || 'Unknown Title'}
          </h2>
          <div className='flex space-x-4'>
            <span className='px-3 py-1 bg-white/20 rounded text-lg font-mono'>
              {speed}x
            </span>
            {loading && (
              <span className='text-blue-400 animate-pulse text-lg'>
                Loading...
              </span>
            )}
          </div>
        </div>

        {/* Center: Play/Pause Icon State */}
        <div className='absolute inset-0 flex items-center justify-center'>
          {!isPlaying && !loading && (
            <div className='w-24 h-24 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white/30'>
              <svg
                className='w-12 h-12 text-white ml-2'
                fill='currentColor'
                viewBox='0 0 24 24'
              >
                <path d='M8 5v14l11-7z' />
              </svg>
            </div>
          )}
        </div>

        {/* Bottom Bar: Progress & Info */}
        <div className='absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/80 to-transparent'>
          <div className='flex items-center justify-between mb-4'>
            <span className='text-2xl font-mono text-gray-200'>
              {formatTime(currentTime)}
            </span>
            <span className='text-2xl font-mono text-gray-400'>
              {formatTime(duration)}
            </span>
          </div>

          {/* Progress Bar Container */}
          <div className='h-4 bg-gray-700 rounded-full overflow-hidden relative mb-8'>
            <div
              className='h-full bg-blue-500 transition-all duration-200 ease-linear'
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>

          {/* Interactive Controls for Touch/Remote */}
          <div className='flex items-center justify-center space-x-6 pb-4'>
            <button
              data-tv-focusable='true'
              onClick={() => {
                if (artInstance.current) {
                  artInstance.current.seek = Math.max(
                    0,
                    artInstance.current.currentTime - 10
                  );
                }
              }}
              className='p-4 rounded-full bg-white/10 hover:bg-white/20 focus:bg-blue-600 transition-all outline-none'
              title='快退 10s'
            >
              <svg
                className='w-8 h-8 text-white'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z'
                />
              </svg>
            </button>

            <button
              data-tv-focusable='true'
              onClick={() => {
                if (artInstance.current) artInstance.current.toggle();
              }}
              className='p-6 rounded-full bg-blue-600 hover:bg-blue-500 focus:bg-white focus:text-blue-600 text-white transition-all outline-none transform hover:scale-110 focus:scale-110'
              title={isPlaying ? '暫停' : '播放'}
            >
              {isPlaying ? (
                <svg
                  className='w-10 h-10'
                  fill='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path d='M6 4h4v16H6V4zm8 0h4v16h-4V4z' />
                </svg>
              ) : (
                <svg
                  className='w-10 h-10'
                  fill='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path d='M8 5v14l11-7z' />
                </svg>
              )}
            </button>

            <button
              data-tv-focusable='true'
              onClick={() => {
                if (artInstance.current) {
                  artInstance.current.seek = Math.min(
                    duration,
                    artInstance.current.currentTime + 10
                  );
                }
              }}
              className='p-4 rounded-full bg-white/10 hover:bg-white/20 focus:bg-blue-600 transition-all outline-none'
              title='快進 10s'
            >
              <svg
                className='w-8 h-8 text-white'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M13 10V3L4 14h7v7l9-11h-7z' // Icon placeholder replaced with fast forward if needed, using lightning for now or better
                />
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z'
                />
              </svg>
            </button>

            <button
              data-tv-focusable='true'
              onClick={() => setShowMenu(true)}
              className='p-4 rounded-full bg-white/10 hover:bg-white/20 focus:bg-blue-600 transition-all outline-none ml-4'
              title='設定'
            >
              <svg
                className='w-8 h-8 text-white'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
                />
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                />
              </svg>
            </button>
          </div>

          <div className='text-center text-gray-500 text-sm mt-2'>
            [OK] 暫停/播放 · [←/→] 快退/快進 · [↑] 設定選單
          </div>
        </div>
      </div>

      {/* Settings Menu Overlay (Toggled by UP arrow) */}
      {showMenu && (
        <div className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-900/95 p-8 rounded-2xl shadow-2xl border border-gray-700 min-w-[400px]'>
          <h3 className='text-2xl font-bold mb-6 text-white text-center'>
            Settings
          </h3>
          <div className='space-y-4'>
            <div className='flex justify-between items-center text-xl text-gray-300'>
              <span>Speed</span>
              <div className='flex space-x-2'>
                {[1.0, 1.5, 2.0].map((s) => (
                  <span
                    key={s}
                    className={`px-3 py-1 rounded ${
                      speed === s ? 'bg-blue-600 text-white' : 'bg-gray-800'
                    }`}
                  >
                    {s}x
                  </span>
                ))}
              </div>
            </div>
            {/* More settings placeholders */}
            <div className='text-center text-gray-500 mt-4 text-base'>
              Press [↓] or [Back] to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
