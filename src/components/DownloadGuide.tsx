'use client';

import { useState } from 'react';

interface DownloadGuideProps {
  m3u8Url: string;
  videoTitle: string;
}

export default function DownloadGuide({
  m3u8Url,
  videoTitle,
}: DownloadGuideProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(m3u8Url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('複製失敗:', error);
    }
  };

  return (
    <div className='space-y-4'>
      {/* 播放連結顯示 */}
      <div className='bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg'>
        <p className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          播放連結:
        </p>
        <code className='text-xs break-all text-gray-600 dark:text-gray-400 block'>
          {m3u8Url}
        </code>
      </div>

      {/* 複製按鈕 */}
      <button
        onClick={copyLink}
        className={`w-full py-3 rounded-lg font-semibold transition-all ${
          copied
            ? 'bg-green-500 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {copied ? '✅ 已複製到剪貼板' : '📋 複製下載連結'}
      </button>

      {/* 推薦工具 */}
      <div className='text-sm space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4'>
        <p className='font-semibold text-gray-900 dark:text-white'>
          推薦下載工具:
        </p>
        <ul className='space-y-2'>
          <li className='flex items-start gap-2'>
            <span className='text-green-500 mt-0.5'>▸</span>
            <div>
              <a
                href='https://github.com/nilaoda/N_m3u8DL-CLI/releases'
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline font-medium'
              >
                N_m3u8DL-CLI
              </a>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-0.5'>
                支持 Windows/Mac/Linux,功能最強大
              </p>
            </div>
          </li>
          <li className='flex items-start gap-2'>
            <span className='text-green-500 mt-0.5'>▸</span>
            <div>
              <a
                href='https://ffmpeg.org/download.html'
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline font-medium'
              >
                FFmpeg
              </a>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-0.5'>
                跨平台專業工具,需命令行操作
              </p>
            </div>
          </li>
        </ul>
      </div>

      {/* 使用說明 */}
      <details className='text-sm border border-gray-200 dark:border-gray-700 rounded-lg'>
        <summary className='cursor-pointer font-semibold p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors'>
          📖 使用說明
        </summary>
        <div className='p-3 pt-0 space-y-4'>
          <div>
            <p className='font-medium text-gray-900 dark:text-white mb-2'>
              方法 1: N_m3u8DL-CLI
            </p>
            <code className='block bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto'>
              N_m3u8DL-CLI &quot;{m3u8Url}&quot; --workDir
              &quot;./Downloads&quot; --saveName &quot;{videoTitle}&quot;
            </code>
          </div>

          <div>
            <p className='font-medium text-gray-900 dark:text-white mb-2'>
              方法 2: FFmpeg
            </p>
            <code className='block bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto'>
              ffmpeg -i &quot;{m3u8Url}&quot; -c copy &quot;{videoTitle}
              .mp4&quot;
            </code>
          </div>

          <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded space-y-2'>
            <p className='text-xs text-yellow-800 dark:text-yellow-200'>
              💡 提示: 使用專業工具下載更穩定,支持斷點續傳和多線程下載
            </p>
            <p className='text-xs text-yellow-800 dark:text-yellow-200 font-semibold'>
              ⚠️ 重要: 請使用上方完整命令(包含 --saveName 參數),否則檔名會是 URL
              中的檔名而非中文片名
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
