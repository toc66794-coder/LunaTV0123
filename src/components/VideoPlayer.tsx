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
                          response.data = response.data
                            .split('\n')
                            .filter(
                              (line: string) =>
                                !line.includes('#EXT-X-DISCONTINUITY')
                            )
                            .join('\n');
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

      if (getInstance) getInstance(art);

      return () => {
        if (art && art.destroy) {
          if (art.video && (art.video as any).hls) {
            (art.video as any).hls.destroy();
          }
          art.destroy();
        }
        artInstanceRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [option.url, blockAdEnabled]);

    useEffect(() => {
      const container = artRef.current;
      if (!container) return;

      // 使用 capture: true 確保優先於 ArtPlayer 內部元素獲取事件
      // 使用 native handlers 並在組件卸載時清理
      const onTouchStart = (e: TouchEvent) => {
        rest.onTouchStart?.(e as any);
      };
      const onTouchMove = (e: TouchEvent) => {
        rest.onTouchMove?.(e as any);
      };
      const onTouchEnd = (e: TouchEvent) => {
        rest.onTouchEnd?.(e as any);
      };
      const onContextMenu = (e: MouseEvent) => {
        rest.onContextMenu?.(e as any);
      };

      container.addEventListener('touchstart', onTouchStart, {
        passive: false,
        capture: true,
      });
      container.addEventListener('touchmove', onTouchMove, {
        passive: false,
        capture: true,
      });
      container.addEventListener('touchend', onTouchEnd, {
        passive: false,
        capture: true,
      });
      container.addEventListener('contextmenu', onContextMenu, {
        capture: true,
      });

      return () => {
        container.removeEventListener('touchstart', onTouchStart, {
          capture: true,
        });
        container.removeEventListener('touchmove', onTouchMove, {
          capture: true,
        });
        container.removeEventListener('touchend', onTouchEnd, {
          capture: true,
        });
        container.removeEventListener('contextmenu', onContextMenu, {
          capture: true,
        });
      };
    }, [rest]);

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
        // 保留 React 事件處理程序作為備選
        onMouseDown={rest.onMouseDown}
        onMouseMove={rest.onMouseMove}
        onMouseUp={rest.onMouseUp}
        onMouseLeave={rest.onMouseLeave}
        onTouchStart={rest.onTouchStart}
        onTouchMove={rest.onTouchMove}
        onTouchEnd={rest.onTouchEnd}
      />
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
