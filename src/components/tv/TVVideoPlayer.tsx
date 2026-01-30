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
  title: _title,
  onEnded,
  onNext,
  onClose,
}: TVVideoPlayerProps) {
  const artRef = useRef<HTMLDivElement>(null);
  const artInstance = useRef<Artplayer | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showMenu, setShowMenu] = useState(false);
  const maskRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const incSpeed = () => {
      if (!artInstance.current) return;
      const art = artInstance.current;
      const next = Math.min(
        3,
        Math.round((art.playbackRate + 0.25) * 100) / 100
      );
      art.playbackRate = next;
      setSpeed(next);
      art.notice.show = `⏱️ ${next}x`;
    };
    const decSpeed = () => {
      if (!artInstance.current) return;
      const art = artInstance.current;
      const next = Math.max(
        0.5,
        Math.round((art.playbackRate - 0.25) * 100) / 100
      );
      art.playbackRate = next;
      setSpeed(next);
      art.notice.show = `⏱️ ${next}x`;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!artInstance.current) return;
      const art = artInstance.current;
      wakeControls();
      const code = (e.code || '').toString();
      switch (e.key) {
        case 'Enter':
        case 'OK':
        case 'MediaPlayPause':
          art.toggle();
          break;
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
          setShowMenu((prev) => !prev);
          break;
        case 'ArrowDown':
          break;
        default:
          if (code === 'Digit1') {
            art.playbackRate = 1;
            setSpeed(1);
            art.notice.show = '⏱️ 1.0x';
          } else if (code === 'Digit2') {
            art.playbackRate = 1.5;
            setSpeed(1.5);
            art.notice.show = '⏱️ 1.5x';
          } else if (code === 'Digit3') {
            art.playbackRate = 2;
            setSpeed(2);
            art.notice.show = '⏱️ 2.0x';
          } else if (code === 'Digit4') {
            art.playbackRate = 3;
            setSpeed(3);
            art.notice.show = '⏱️ 3.0x';
          } else if (e.key === '+' || e.key === '=') {
            incSpeed();
          } else if (e.key === '-' || e.key === '_') {
            decSpeed();
          } else if (
            e.key === 'Escape' ||
            e.key === 'Back' ||
            e.key === 'Backspace'
          ) {
            if (showMenu) {
              setShowMenu(false);
              e.preventDefault();
              return;
            }
            if (onClose) onClose();
          }
          break;
      }
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, {
        capture: true,
      } as any);
    };
  }, [duration, onClose, showMenu, wakeControls]);

  useEffect(() => {
    setFocusScope(artRef.current?.parentElement || null);
    return () => setFocusScope(null);
  }, []);

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

  return (
    <div className='w-full h-full relative'>
      <div
        ref={artRef}
        className='w-full h-full'
        style={{ width: '100%', height: '100%' }}
      />
      <div
        ref={maskRef}
        className='absolute inset-0 z-50'
        style={{ background: 'transparent', pointerEvents: 'auto' }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />
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
