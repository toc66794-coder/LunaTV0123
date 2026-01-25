/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef, useState } from 'react';

import DownloadGuide from './DownloadGuide';
import { downloadM3U8InBrowser } from '@/lib/m3u8-downloader';

interface SkipConfig {
  enable: boolean;
  intro_time: number;
  outro_time: number;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpeed: number;
  onSpeedChange: (speed: number) => void;
  blockAdEnabled: boolean;
  onBlockAdToggle: () => void;
  skipConfig: SkipConfig;
  onSkipConfigChange: (config: SkipConfig) => void;
  artPlayerRef: React.MutableRefObject<any>;
  videoUrl?: string;
  videoTitle?: string;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

const formatTime = (seconds: number): string => {
  if (seconds === 0) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (hours === 0) {
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  } else {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
};

export default function SettingsPanel({
  isOpen,
  onClose,
  currentSpeed,
  onSpeedChange,
  blockAdEnabled,
  onBlockAdToggle,
  skipConfig,
  onSkipConfigChange,
  artPlayerRef,
  videoUrl = '',
  videoTitle = '影片',
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [showDownload, setShowDownload] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // 點擊外部關閉
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // ESC 鍵關閉
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSetIntro = () => {
    const currentTime = artPlayerRef.current?.currentTime || 0;
    if (currentTime > 0) {
      onSkipConfigChange({
        ...skipConfig,
        intro_time: currentTime,
      });
    }
  };

  const handleSetOutro = () => {
    const outroTime =
      -(
        (artPlayerRef.current?.duration || 0) -
        (artPlayerRef.current?.currentTime || 0)
      ) || 0;
    if (outroTime < 0) {
      onSkipConfigChange({
        ...skipConfig,
        outro_time: outroTime,
      });
    }
  };

  const handleDeleteSkipConfig = () => {
    onSkipConfigChange({
      enable: false,
      intro_time: 0,
      outro_time: 0,
    });
  };

  const handleBrowserDownload = async () => {
    if (!videoUrl) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    const result = await downloadM3U8InBrowser(
      videoUrl,
      videoTitle,
      (progress) => {
        setDownloadProgress(Math.round(progress));
      }
    );

    setIsDownloading(false);

    if (!result.success) {
      alert(
        '下載失敗,可能受 CORS 限制。請使用"複製連結"功能並使用專業工具下載。'
      );
    }
  };

  return (
    <div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in'>
      <div
        ref={panelRef}
        className='bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto'
      >
        {/* 標題欄 */}
        <div className='sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl'>
          <h2 className='text-xl font-bold text-gray-900 dark:text-white'>
            播放器設定
          </h2>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors'
            aria-label='關閉'
          >
            <svg
              className='w-5 h-5 text-gray-500 dark:text-gray-400'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        <div className='p-6 space-y-6'>
          {/* 播放速度 */}
          <div>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-3'>
              播放速度
            </h3>
            <div className='grid grid-cols-4 gap-2'>
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  onClick={() => onSpeedChange(speed)}
                  className={`py-3 px-4 rounded-lg font-medium transition-all ${
                    currentSpeed === speed
                      ? 'bg-green-500 text-white shadow-lg scale-105'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* 去廣告 */}
          <div className='border-t border-gray-200 dark:border-gray-700 pt-6'>
            <div className='flex items-center justify-between'>
              <div>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                  去廣告
                </h3>
                <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
                  自動過濾視頻中的廣告片段
                </p>
              </div>
              <button
                onClick={onBlockAdToggle}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  blockAdEnabled
                    ? 'bg-green-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    blockAdEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 跳過片頭片尾 */}
          <div className='border-t border-gray-200 dark:border-gray-700 pt-6'>
            <div className='flex items-center justify-between mb-4'>
              <div>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                  跳過片頭片尾
                </h3>
                <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
                  自動跳過設定的時間段
                </p>
              </div>
              <button
                onClick={() =>
                  onSkipConfigChange({
                    ...skipConfig,
                    enable: !skipConfig.enable,
                  })
                }
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  skipConfig.enable
                    ? 'bg-green-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    skipConfig.enable ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className='space-y-3'>
              {/* 設置片頭 */}
              <div className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg'>
                <div className='flex items-center gap-3'>
                  <svg
                    className='w-5 h-5 text-gray-600 dark:text-gray-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <circle cx='5' cy='12' r='2' fill='currentColor' />
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M9 12L17 12M17 6L17 18'
                    />
                  </svg>
                  <div>
                    <div className='text-sm font-medium text-gray-900 dark:text-white'>
                      片頭時間
                    </div>
                    <div className='text-xs text-gray-500 dark:text-gray-400'>
                      {skipConfig.intro_time === 0
                        ? '未設置'
                        : formatTime(skipConfig.intro_time)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSetIntro}
                  className='px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors'
                >
                  設為當前
                </button>
              </div>

              {/* 設置片尾 */}
              <div className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg'>
                <div className='flex items-center gap-3'>
                  <svg
                    className='w-5 h-5 text-gray-600 dark:text-gray-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M7 6L7 18M7 12L15 12'
                    />
                    <circle cx='19' cy='12' r='2' fill='currentColor' />
                  </svg>
                  <div>
                    <div className='text-sm font-medium text-gray-900 dark:text-white'>
                      片尾時間
                    </div>
                    <div className='text-xs text-gray-500 dark:text-gray-400'>
                      {skipConfig.outro_time >= 0
                        ? '未設置'
                        : `-${formatTime(-skipConfig.outro_time)}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSetOutro}
                  className='px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors'
                >
                  設為當前
                </button>
              </div>

              {/* 刪除配置 */}
              {(skipConfig.intro_time !== 0 || skipConfig.outro_time < 0) && (
                <button
                  onClick={handleDeleteSkipConfig}
                  className='w-full py-2 text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors'
                >
                  清除片頭片尾設定
                </button>
              )}
            </div>
          </div>

          {/* 下載影片 */}
          {videoUrl && (
            <div className='border-t border-gray-200 dark:border-gray-700 pt-6'>
              <button
                onClick={() => setShowDownload(!showDownload)}
                className='w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2'
              >
                <svg
                  className='w-5 h-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                  />
                </svg>
                {showDownload ? '隱藏下載選項' : '下載影片'}
              </button>

              {showDownload && (
                <div className='mt-4 space-y-3'>
                  {/* 瀏覽器下載 (實驗性) */}
                  <div className='p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg'>
                    <button
                      onClick={handleBrowserDownload}
                      disabled={isDownloading}
                      className='w-full py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2'
                    >
                      {isDownloading ? (
                        <>
                          <svg
                            className='animate-spin h-5 w-5'
                            fill='none'
                            viewBox='0 0 24 24'
                          >
                            <circle
                              className='opacity-25'
                              cx='12'
                              cy='12'
                              r='10'
                              stroke='currentColor'
                              strokeWidth='4'
                            />
                            <path
                              className='opacity-75'
                              fill='currentColor'
                              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                            />
                          </svg>
                          下載中 {downloadProgress}%
                        </>
                      ) : (
                        <>🌐 瀏覽器下載 (實驗性)</>
                      )}
                    </button>
                    <p className='text-xs text-yellow-800 dark:text-yellow-200 mt-2'>
                      ⚠️ 可能受 CORS 限制,建議使用下方的專業工具下載
                    </p>
                  </div>

                  {/* 下載指南 */}
                  <DownloadGuide m3u8Url={videoUrl} videoTitle={videoTitle} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按鈕 */}
        <div className='sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 rounded-b-2xl'>
          <button
            onClick={onClose}
            className='w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors shadow-lg'
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
