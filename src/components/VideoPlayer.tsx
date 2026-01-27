/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
'use client';

import Artplayer from 'artplayer';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import React from 'react';

interface VideoPlayerProps extends React.HTMLAttributes<HTMLDivElement> {
  option: any;
  getInstance: (art: any) => void;
  className?: string;
  style?: React.CSSProperties;
  blockAdEnabled: boolean;
  onBlockAdToggle: () => void;
  skipConfig: any;
  onSkipConfigChange: (newConfig: any) => void;
  onNextEpisode: () => void;
  onOpenSettings: () => void;
  onStartDownload: () => void;
  downloadTasks: any;
  lastVolume: number;
  lastPlaybackRate: number;
}

const VideoPlayer = forwardRef<HTMLDivElement, VideoPlayerProps>(
  (
    {
      option,
      getInstance,
      className,
      style,
      blockAdEnabled,
      onBlockAdToggle,
      skipConfig,
      onSkipConfigChange,
      onNextEpisode,
      onOpenSettings,
      onStartDownload,
      downloadTasks,
      lastVolume,
      lastPlaybackRate,
      ...rest
    },
    ref
  ) => {
    const artRef = useRef<HTMLDivElement>(null);
    const artInstanceRef = useRef<Artplayer | null>(null);

    // 同步外部 Ref
    useImperativeHandle(ref, () => artRef.current as HTMLDivElement);

    const blockAdEnabledRef = useRef(blockAdEnabled);
    const skipConfigRef = useRef(skipConfig);
    const downloadTasksRef = useRef(downloadTasks);
    const lastVolumeRef = useRef(lastVolume);
    const lastPlaybackRateRef = useRef(lastPlaybackRate);

    useEffect(() => {
      blockAdEnabledRef.current = blockAdEnabled;
      skipConfigRef.current = skipConfig;
      downloadTasksRef.current = downloadTasks;
      lastVolumeRef.current = lastVolume;
      lastPlaybackRateRef.current = lastPlaybackRate;

      if (artInstanceRef.current && (window as any).refreshCustomControls) {
        (window as any).refreshCustomControls();
      }
    }, [
      blockAdEnabled,
      skipConfig,
      downloadTasks,
      lastVolume,
      lastPlaybackRate,
    ]);

    useEffect(() => {
      if (!artRef.current) return;

      const art = new Artplayer({
        ...option,
        container: artRef.current,
        customType: {
          m3u8: async function (video: HTMLVideoElement, url: string) {
            const { default: Hls } = await import('hls.js');
            if (!Hls) return;

            if (video.hls) {
              video.hls.destroy();
            }

            let hlsLoader = Hls.DefaultConfig.loader;
            if (blockAdEnabledRef.current) {
              class CustomHlsJsLoader extends (Hls.DefaultConfig
                .loader as any) {
                constructor(config: any) {
                  super(config);
                  const load = this.load.bind(this);
                  this.load = function (
                    context: any,
                    config: any,
                    callbacks: any
                  ) {
                    if (
                      context.type === 'manifest' ||
                      context.type === 'level'
                    ) {
                      const onSuccess = callbacks.onSuccess;
                      callbacks.onSuccess = function (
                        response: any,
                        stats: any,
                        context: any
                      ) {
                        if (
                          response.data &&
                          typeof response.data === 'string'
                        ) {
                          try {
                            response.data = response.data
                              .split('\n')
                              .filter(
                                (line: string) =>
                                  !line.includes('#EXT-X-DISCONTINUITY')
                              )
                              .join('\n');
                          } catch (e) {
                            console.warn('Error processing manifest:', e);
                          }
                        }
                        return onSuccess(response, stats, context, null);
                      };
                    }
                    load(context, config, callbacks);
                  };
                }
              }
              hlsLoader = CustomHlsJsLoader as any;
            }

            const hls = new Hls({
              debug: false,
              enableWorker: true,
              lowLatencyMode: true,
              maxBufferLength: 30,
              backBufferLength: 30,
              maxBufferSize: 60 * 1000 * 1000,
              loader: hlsLoader,
            });

            hls.loadSource(url);
            hls.attachMedia(video);
            video.hls = hls;

            if (!video.querySelector('source')) {
              const source = document.createElement('source');
              source.src = url;
              video.appendChild(source);
            }
            video.disableRemotePlayback = false;
            if (video.hasAttribute('disableRemotePlayback')) {
              video.removeAttribute('disableRemotePlayback');
            }

            hls.on(Hls.Events.ERROR, (event: any, data: any) => {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    hls.destroy();
                    break;
                }
              }
            });
          },
        },
        settings: [
          {
            html: '跳過片頭片尾',
            icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>',
            selector: [
              {
                html: '開關設定',
                switch: skipConfigRef.current.enable,
                onSwitch: function (item: any) {
                  onSkipConfigChange({
                    ...skipConfigRef.current,
                    enable: !item.switch,
                  });
                  return !item.switch;
                },
              },
              {
                html: '設當前為片頭',
                onClick: function () {
                  const time = art.currentTime;
                  onSkipConfigChange({
                    ...skipConfigRef.current,
                    intro_time: time,
                  });
                  art.notice.show = `已設片頭: ${Math.round(time)}s`;
                },
              },
              {
                html: '設當前為片尾',
                onClick: function () {
                  const duration = art.duration;
                  const time = art.currentTime;
                  const offset = -(duration - time);
                  onSkipConfigChange({
                    ...skipConfigRef.current,
                    outro_time: offset,
                  });
                  art.notice.show = `已設片尾: ${Math.round(offset)}s`;
                },
              },
              {
                html: '預設片頭: 30s',
                onClick: function () {
                  onSkipConfigChange({
                    ...skipConfigRef.current,
                    intro_time: 30,
                  });
                  art.notice.show = '片頭設為 30s';
                },
              },
              {
                html: '預設片頭: 60s',
                onClick: function () {
                  onSkipConfigChange({
                    ...skipConfigRef.current,
                    intro_time: 60,
                  });
                  art.notice.show = '片頭設為 60s';
                },
              },
              {
                html: '預設片頭: 90s',
                onClick: function () {
                  onSkipConfigChange({
                    ...skipConfigRef.current,
                    intro_time: 90,
                  });
                  art.notice.show = '片頭設為 90s';
                },
              },
              {
                html: '清除設定',
                onClick: function () {
                  onSkipConfigChange({
                    enable: false,
                    intro_time: 0,
                    outro_time: 0,
                  });
                  art.notice.show = '設定已清除';
                },
              },
            ],
          },
          {
            html: '全部設定',
            icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
            tooltip: '打開進階設定',
            onClick: function () {
              onOpenSettings();
            },
          },
        ],
        controls: [
          {
            position: 'left',
            index: 13,
            html: '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/></svg></i>',
            tooltip: '播放下一集',
            click: function () {
              onNextEpisode();
            },
          },
        ],
        layers: [
          {
            name: 'custom-controls',
            html: `
              <div id="artplayer-custom-controls" style="
                position: absolute;
                top: 10px;
                right: 10px;
                display: flex;
                gap: 8px;
                z-index: 100;
                pointer-events: auto;
              ">
                <div id="ad-btn-container"></div>
                <div id="speed-btns-container" style="display: flex; gap: 4px;"></div>
                <div id="download-btn-container"></div>
                <div id="settings-btn-container"></div>
              </div>
            `,
            style: {
              display: 'none',
            },
          },
        ],
      });

      artInstanceRef.current = art;

      (window as any).toggleAdBlock = onBlockAdToggle;
      (window as any).startDownload = onStartDownload;
      (window as any).openSettings = onOpenSettings;
      (window as any).setPlaySpeed = (s: number) => {
        art.playbackRate = s;
      };

      const updateCustomControls = () => {
        if (!art || !art.template || !art.template.$container) return;
        const $controls = art.template.$container.querySelector(
          '#artplayer-custom-controls'
        );
        if (!$controls) return;

        const adContainer = $controls.querySelector('#ad-btn-container');
        if (adContainer) {
          const enabled = blockAdEnabledRef.current;
          adContainer.innerHTML = `
              <button onclick="window.toggleAdBlock()" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: ${
                enabled ? 'rgba(34, 197, 94, 0.9)' : 'rgba(107, 114, 128, 0.7)'
              }; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.744c0 5.273 3.69 9.689 8.602 10.71a11.99 11.99 0 008.602-10.71c0-1.299-.206-2.55-.586-3.725A12.147 12.147 0 0112 2.714z"/></svg>
              </button>
            `;
        }

        const speedContainer = $controls.querySelector('#speed-btns-container');
        if (speedContainer) {
          const speeds = [0.5, 1, 1.5, 2, 3];
          const currentRate = art.playbackRate;
          speedContainer.innerHTML = speeds
            .map(
              (s) => `
              <button onclick="window.setPlaySpeed(${s})" style="width: 34px; height: 32px; border-radius: 16px; border: none; background: ${
                Math.abs(currentRate - s) < 0.1
                  ? 'rgba(59, 130, 246, 0.9)'
                  : 'rgba(0, 0, 0, 0.5)'
              }; color: white; cursor: pointer; font-size: 10px; font-weight: 800; backdrop-filter: blur(8px); transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">${s}x</button>
            `
            )
            .join('');
        }

        const downloadContainer = $controls.querySelector(
          '#download-btn-container'
        );
        if (downloadContainer) {
          const task = downloadTasksRef.current[option.url];
          const isDownloading = task?.status === 'downloading';
          const isCompleted = task?.status === 'completed';

          downloadContainer.innerHTML = `
              <button onclick="window.startDownload()" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: ${
                isDownloading
                  ? 'rgba(59, 130, 246, 0.9)'
                  : isCompleted
                  ? 'rgba(34, 197, 94, 0.9)'
                  : 'rgba(0, 0, 0, 0.5)'
              }; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                ${
                  isDownloading
                    ? `<span style="font-size: 9px; font-weight: 900;">${Math.round(
                        task.progress
                      )}%</span>`
                    : isCompleted
                    ? `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>`
                    : `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>`
                }
              </button>
            `;
        }

        const settingsContainer = $controls.querySelector(
          '#settings-btn-container'
        );
        if (settingsContainer) {
          settingsContainer.innerHTML = `
              <button onclick="window.openSettings()" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: rgba(0, 0, 0, 0.5); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </button>
            `;
        }
      };

      updateCustomControls();
      (window as any).refreshCustomControls = updateCustomControls;

      art.on('video:ratechange', updateCustomControls);
      art.on('control', (state: boolean) => {
        const $layer = art.layers['custom-controls'];
        if ($layer) $layer.style.display = state ? 'flex' : 'none';
      });

      // --- 內部手勢與狀態機實作 ---
      let startX = 0;
      let startY = 0;
      let startTime = 0;
      let activeGestureMode: 'none' | 'seeking' | 'adjusting' | 'longpress' =
        'none';
      let longPressTimer: NodeJS.Timeout | null = null;
      let speedBeforeLongPress = 1;
      let lastTapTime = 0;
      let lastTapSide: 'left' | 'right' | null = null;

      const $container = art.template.$container;
      if (!$container) return;

      const handleTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        const rect = $container.getBoundingClientRect();
        startX = touch.clientX - rect.left;
        startY = touch.clientY - rect.top;
        startTime = Date.now();
        activeGestureMode = 'none';

        // 啟動長按計時器 (500ms)
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          if (activeGestureMode === 'none') {
            activeGestureMode = 'longpress';
            speedBeforeLongPress = art.playbackRate;
            art.playbackRate = 3;
            art.notice.show = '🚀 3x 速播放中';
            if (navigator.vibrate) navigator.vibrate(50);
          }
        }, 500);
      };

      const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        const rect = $container.getBoundingClientRect();
        const currentX = touch.clientX - rect.left;
        const currentY = touch.clientY - rect.top;

        const deltaX = Math.abs(currentX - startX);
        const deltaY = Math.abs(currentY - startY);

        // 如果已經在長按模式，完全鎖定（不允許任何其他手勢）
        if (activeGestureMode === 'longpress') {
          if (e.cancelable) e.preventDefault();
          // 長按期間不取消，直到手指離開
          return;
        }

        // 如果還在長按計時中且移動明顯，取消計時器
        if (longPressTimer && (deltaX > 40 || deltaY > 40)) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }

        // 判斷移動方向（降低最小閾值）
        const minMoveThreshold = 10;
        if (deltaX < minMoveThreshold && deltaY < minMoveThreshold) {
          return; // 移動太小，不處理
        }

        // 如果已經進入某個模式，持續該模式（鎖定方向）
        if (activeGestureMode === 'seeking') {
          // 已經在水平滑動模式，繼續
          return;
        }

        if (activeGestureMode === 'adjusting') {
          // 已經在垂直調整模式，繼續執行
          if (e.cancelable) e.preventDefault();

          const yChange = startY - currentY;
          const xPercent = startX / rect.width;

          if (xPercent < 0.3) {
            // 左側：亮度調整
            const change = yChange * 0.8;
            if (art.video) {
              const current =
                art.video.style.filter.match(/brightness\((\d+)%\)/)?.[1] ||
                '100';
              const next = Math.max(
                50,
                Math.min(200, parseInt(current) + change)
              );
              art.video.style.filter = `brightness(${next}%)`;
              art.notice.show = `☀️ 亮度: ${Math.round(next)}%`;
            }
          } else if (xPercent > 0.7) {
            // 右側：音量調整
            const volumeChange = yChange * 0.005;
            const newVolume = Math.max(
              0,
              Math.min(1, art.volume + volumeChange)
            );
            art.volume = newVolume;
            art.notice.show = `🔊 音量: ${Math.round(newVolume * 100)}%`;
          }

          startY = currentY; // 更新起點，實現連續調整
          return;
        }

        // 首次判定方向（使用容差比例，允許傾斜）
        const horizontalTolerance = 0.6; // 水平優先需要 deltaX > deltaY * 1.67
        const verticalTolerance = 0.6; // 垂直優先需要 deltaY > deltaX * 1.67

        // 判定為水平：deltaX 明顯大於 deltaY
        if (
          deltaX > deltaY / horizontalTolerance &&
          deltaX > minMoveThreshold
        ) {
          activeGestureMode = 'seeking';
          // 不 preventDefault，讓 ArtPlayer 的原生手勢處理
          return;
        }

        // 判定為垂直：deltaY 明顯大於 deltaX（允許一定傾斜）
        if (deltaY > deltaX / verticalTolerance && deltaY > minMoveThreshold) {
          activeGestureMode = 'adjusting';
          // 立即執行第一次調整
          if (e.cancelable) e.preventDefault();

          const yChange = startY - currentY;
          const xPercent = startX / rect.width;

          if (xPercent < 0.3) {
            // 左側：亮度調整
            const change = yChange * 0.8;
            if (art.video) {
              const current =
                art.video.style.filter.match(/brightness\((\d+)%\)/)?.[1] ||
                '100';
              const next = Math.max(
                50,
                Math.min(200, parseInt(current) + change)
              );
              art.video.style.filter = `brightness(${next}%)`;
              art.notice.show = `☀️ 亮度: ${Math.round(next)}%`;
            }
          } else if (xPercent > 0.7) {
            // 右側：音量調整
            const volumeChange = yChange * 0.005;
            const newVolume = Math.max(
              0,
              Math.min(1, art.volume + volumeChange)
            );
            art.volume = newVolume;
            art.notice.show = `🔊 音量: ${Math.round(newVolume * 100)}%`;
          }

          startY = currentY;
          return;
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (longPressTimer) clearTimeout(longPressTimer);

        // 長按模式結束
        if (activeGestureMode === 'longpress') {
          art.playbackRate = speedBeforeLongPress;
          art.notice.show = '';
          activeGestureMode = 'none';
          lastTapTime = 0;
          lastTapSide = null;
          return;
        }

        // 進度調整或亮度/音量調整結束
        if (
          activeGestureMode === 'seeking' ||
          activeGestureMode === 'adjusting'
        ) {
          activeGestureMode = 'none';
          lastTapTime = 0;
          lastTapSide = null;
          return;
        }

        // 雙擊檢測（只在快速點擊時觸發）
        const touch = e.changedTouches[0];
        const rect = $container.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const xPercent = x / rect.width;
        const now = Date.now();

        if (now - startTime < 250) {
          let side: 'left' | 'right' | null = null;
          if (xPercent < 0.25) side = 'left';
          else if (xPercent > 0.75) side = 'right';

          if (side) {
            if (now - lastTapTime < 300 && lastTapSide === side) {
              // 雙擊成功
              if (side === 'left') {
                art.seek = Math.max(0, art.currentTime - 10);
                art.notice.show = '⏪ 後退 10 秒';
              } else {
                art.seek = Math.min(art.duration, art.currentTime + 10);
                art.notice.show = '⏩ 快進 10 秒';
              }
              lastTapTime = 0;
              lastTapSide = null;
            } else {
              lastTapTime = now;
              lastTapSide = side;
            }
          }
        }

        activeGestureMode = 'none';
      };

      $container.addEventListener('touchstart', handleTouchStart, {
        passive: false,
      });
      $container.addEventListener('touchmove', handleTouchMove, {
        passive: false,
      });
      $container.addEventListener('touchend', handleTouchEnd, {
        passive: false,
      });

      if (getInstance) getInstance(art);

      return () => {
        $container.removeEventListener('touchstart', handleTouchStart);
        $container.removeEventListener('touchmove', handleTouchMove);
        $container.removeEventListener('touchend', handleTouchEnd);
        if (art && art.destroy) {
          if (art.video && (art.video as any).hls) {
            (art.video as any).hls.destroy();
          }
          art.destroy();
        }
        artInstanceRef.current = null;
        if (getInstance) getInstance(null);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [option.url, blockAdEnabled]);

    // 移除舊的 gestureHandlers useEffect

    // 從 rest 中排除已經手動綁定的 event handlers
    const {
      onTouchStart: _ts,
      onTouchMove: _tm,
      onTouchEnd: _te,
      onMouseDown: _md,
      onMouseMove: _mm,
      onMouseUp: _mu,
      onMouseLeave: _ml,
      onContextMenu: _cm,
      ...divProps
    } = rest as any;

    return (
      <div
        ref={artRef}
        className={className}
        style={{
          ...style,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          touchAction: 'none',
        }}
        {...divProps}
      />
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
