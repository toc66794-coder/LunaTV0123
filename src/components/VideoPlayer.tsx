/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
'use client';

import Artplayer from 'artplayer';
import artplayerPluginChromecast from 'artplayer-plugin-chromecast';
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

    // --- 省電模式邏輯 (Top Level Hooks) ---
    const [saverEnabled, setSaverEnabled] = React.useState(false);
    const [isDimmed, setIsDimmed] = React.useState(false);
    const saverTimerRef = useRef<NodeJS.Timeout | null>(null);
    const saverEnabledRef = useRef(saverEnabled);

    // 重置省電計時器
    const resetSaverTimer = () => {
      if (saverTimerRef.current) clearTimeout(saverTimerRef.current);
      setIsDimmed(false);

      if (saverEnabledRef.current) {
        saverTimerRef.current = setTimeout(() => {
          console.log('[LunaTV] Timer fired! Dimming screen...');
          setIsDimmed(true);
        }, 5000); // 5秒無操作進入黑屏
      }
    };

    // 同步 Ref
    useEffect(() => {
      saverEnabledRef.current = saverEnabled;
      if (saverEnabled) {
        resetSaverTimer();
        if (artInstanceRef.current)
          artInstanceRef.current.notice.show = '省電模式已開啟 (5秒後黑屏)';
      } else {
        if (saverTimerRef.current) clearTimeout(saverTimerRef.current);
        setIsDimmed(false);
        if (artInstanceRef.current)
          artInstanceRef.current.notice.show = '省電模式已關閉';
      }
      // 觸發 UI 更新 (按鈕顏色)
      if (typeof (window as any).refreshCustomControls === 'function') {
        (window as any).refreshCustomControls();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saverEnabled]);

    // 綁定全域交互以重置計時器
    useEffect(() => {
      if (!saverEnabled) return;
      const events = [
        'touchstart',
        'touchmove',
        'click',
        'mousemove',
        'keydown',
      ];
      const handler = () => resetSaverTimer();
      events.forEach((ev) => window.addEventListener(ev, handler));
      return () => {
        events.forEach((ev) => window.removeEventListener(ev, handler));
        if (saverTimerRef.current) clearTimeout(saverTimerRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saverEnabled]);

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
      console.log('[LunaTV] Player Version: 2.1 (ScreenSaver Added)');
      if (!artRef.current) return;

      const art = new Artplayer({
        ...option,
        url: blockAdEnabledRef.current
          ? `/api/m3u8-proxy?url=${encodeURIComponent(option.url)}`
          : option.url,
        container: artRef.current,
        plugins: [artplayerPluginChromecast({})],
        customType: {
          m3u8: async function (video: HTMLVideoElement, url: string) {
            const { default: Hls } = await import('hls.js');
            if (!Hls) return;

            if (video.hls) {
              video.hls.destroy();
            }

            const hls = new Hls({
              debug: false,
              enableWorker: true,
              lowLatencyMode: true,
              maxBufferLength: 30,
              backBufferLength: 30,
              maxBufferSize: 60 * 1000 * 1000,
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
                <div id="saver-btn-container"></div>
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

      // 將 setSaverEnabled 暴露給 window
      (window as any).toggleSaverMode = () => {
        setSaverEnabled((prev) => !prev);
      };

      const updateCustomControls = () => {
        if (!art || !art.template || !art.template.$container) return;
        const $controls = art.template.$container.querySelector(
          '#artplayer-custom-controls'
        );
        if (!$controls) return;

        // --- Ad Block Button ---
        const adContainer = $controls.querySelector('#ad-btn-container');
        if (adContainer) {
          const enabled = blockAdEnabledRef.current;
          adContainer.innerHTML = `
            <button onclick="window.toggleAdBlock()" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: ${
              enabled ? 'rgba(34, 197, 94, 0.9)' : 'rgba(107, 114, 128, 0.7)'
            }; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" title="去廣告開關">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.744c0 5.273 3.69 9.689 8.602 10.71a11.99 11.99 0 008.602-10.71c0-1.299-.206-2.55-.586-3.725A12.147 12.147 0 0112 2.714z"/></svg>
            </button>
          `;
        }

        // --- Screen Saver Button (New Independent Container) ---
        const saverContainer = $controls.querySelector('#saver-btn-container');
        if (saverContainer) {
          const saverOn = saverEnabledRef.current;
          console.log('[LunaTV] Rendering Saver Button. State:', saverOn);
          saverContainer.innerHTML = `
            <button onclick="window.toggleSaverMode()" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: ${
              saverOn ? 'rgba(16, 185, 129, 0.9)' : 'rgba(107, 114, 128, 0.7)'
            }; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" title="省電模式 (黑屏)">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
            </button>
          `;
        }

        // --- Other Buttons ---
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
      let currentBrightness = 100; // 內部維護精確亮度值

      const $container = art.template.$container;
      if (!$container) return;

      const handleTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        const rect = $container.getBoundingClientRect();
        startX = touch.clientX - rect.left;
        startY = touch.clientY - rect.top;
        startTime = Date.now();
        activeGestureMode = 'none';

        // 初始化亮度值
        if (art.video) {
          const styleFilter = art.video.style.filter;
          const match = styleFilter.match(/brightness\((\d+)%\)/);
          if (match) {
            currentBrightness = parseInt(match[1], 10);
          } else {
            // 如果沒有設置，預設為 100
            currentBrightness = 100;
          }
        }

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
          e.stopPropagation(); // 阻止事件冒泡
          e.stopImmediatePropagation(); // 阻止同元素其他事件
          return;
        }

        // 如果還在長按計時中且移動明顯，取消計時器
        if (longPressTimer && (deltaX > 20 || deltaY > 20)) {
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
          return;
        }

        if (activeGestureMode === 'adjusting') {
          if (e.cancelable) e.preventDefault();

          const yChange = startY - currentY;
          const xPercent = startX / rect.width;

          if (xPercent < 0.3) {
            // 左側：亮度調整 (平滑化處理)
            // 降低靈敏度係數
            const sensitivity = 0.5;
            const change = yChange * sensitivity;

            // 基於記錄的起始值計算，而不是每次都讀 DOM
            // 這裡我們需要的是增量更新
            // 但為了平滑，我們使用 currentBrightness 累積
            const targetBrightness = Math.max(
              10,
              Math.min(200, currentBrightness + change)
            );

            // 應用到 DOM
            if (art.video) {
              art.video.style.filter = `brightness(${Math.round(
                targetBrightness
              )}%)`;
            }
            art.notice.show = `☀️ 亮度: ${Math.round(targetBrightness)}%`;

            // 注意：這裡不更新 currentBrightness，因為 startY 未重置
            // 這種模式下是 "拖曳距離 -> 亮度變化量" 的映射
            // 如果要實現 "增量累積"，需要重置 startY
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

          // 重置起點，實現平滑增量更新
          startY = currentY;
          // 對於亮度，更新基準值
          if (xPercent < 0.3) {
            const change = yChange * 0.5;
            currentBrightness = Math.max(
              10,
              Math.min(200, currentBrightness + change)
            );
          }

          return;
        }

        // 首次判定方向
        const horizontalTolerance = 0.6;
        const verticalTolerance = 0.6;

        if (
          deltaX > deltaY / horizontalTolerance &&
          deltaX > minMoveThreshold
        ) {
          activeGestureMode = 'seeking';
          return;
        }

        if (deltaY > deltaX / verticalTolerance && deltaY > minMoveThreshold) {
          activeGestureMode = 'adjusting';
          if (e.cancelable) e.preventDefault();
          // 初始化亮度基準值 (防止跳變)
          if (art.video) {
            const styleFilter = art.video.style.filter;
            const match = styleFilter.match(/brightness\((\d+)%\)/);
            currentBrightness = match ? parseInt(match[1], 10) : 100;
          }
          return;
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (longPressTimer) clearTimeout(longPressTimer);

        // 長按模式結束
        if (activeGestureMode === 'longpress') {
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

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

        // 雙擊檢測
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

      // 使用 capture 選項確保我們先於 Artplayer 內部處理
      const eventOptions = { passive: false, capture: true };

      $container.addEventListener('touchstart', handleTouchStart, eventOptions);
      $container.addEventListener('touchmove', handleTouchMove, eventOptions);
      $container.addEventListener('touchend', handleTouchEnd, eventOptions);

      if (getInstance) getInstance(art);

      return () => {
        $container.removeEventListener(
          'touchstart',
          handleTouchStart,
          eventOptions
        );
        $container.removeEventListener(
          'touchmove',
          handleTouchMove,
          eventOptions
        );
        $container.removeEventListener(
          'touchend',
          handleTouchEnd,
          eventOptions
        );
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

    // --- 省電模式 Overlay 控制 (DOM 操作以支援全螢幕) ---
    useEffect(() => {
      const art = artInstanceRef.current;
      if (!art || !art.template || !art.template.$container) return;

      const OVERLAY_ID = 'luna-saver-overlay';
      let overlay = art.template.$container.querySelector(
        `#${OVERLAY_ID}`
      ) as HTMLElement;

      if (isDimmed) {
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = OVERLAY_ID;
          overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: #000000;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.5);
            cursor: pointer;
            font-family: system-ui, sans-serif;
            pointer-events: auto;
          `;
          overlay.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 12px; filter: drop-shadow(0 0 10px rgba(255,255,255,0.2));">⚡</div>
            <div style="font-size: 14px; font-weight: 500;">省電模式</div>
            <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">觸碰喚醒</div>
          `;

          // 阻擋事件冒泡，避免點擊穿透到播放器
          const stopEvent = (e: Event) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
          };

          overlay.addEventListener('touchstart', stopEvent, { passive: false });
          overlay.addEventListener(
            'touchmove',
            (e) => {
              e.preventDefault();
              stopEvent(e);
            },
            { passive: false }
          );
          overlay.addEventListener('touchend', stopEvent, { passive: false });
          overlay.addEventListener('click', stopEvent);

          // 點擊任意處喚醒
          overlay.addEventListener('click', () => {
            resetSaverTimer();
          });
          overlay.addEventListener(
            'touchstart',
            () => {
              resetSaverTimer();
            },
            { passive: false }
          );

          art.template.$container.appendChild(overlay);
        }
      } else {
        if (overlay) {
          overlay.remove();
        }
      }

      // Cleanup function
      return () => {
        // 我們不在此移除，因為需要在 isDimmed 變化時處理，
        // 且 component unmount 時 art 可能已經 destroyed，
        // 但為了保險起見，可以嘗試移除
        if (overlay && !isDimmed) overlay.remove();
      };
    }, [isDimmed]);

    return (
      <div
        className={className}
        style={{
          ...style,
          position: 'relative',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          touchAction: 'none',
        }}
        {...divProps}
      >
        <div
          ref={artRef}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
