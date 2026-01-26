'use client';

import React from 'react';
import { useDownload } from '@/components/DownloadProvider';
import PageLayout from '@/components/PageLayout';
import {
  Trash2,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function DownloadsPage() {
  const { tasks, clearCompletedTasks } = useDownload();
  const taskList = Object.values(tasks).sort(
    (a, b) => b.startTime - a.startTime
  );

  return (
    <PageLayout activePath='/downloads'>
      <div className='max-w-4xl mx-auto p-6'>
        <div className='flex items-center justify-between mb-8'>
          <h1 className='text-2xl font-bold flex items-center gap-2'>
            <Download className='w-6 h-6 text-green-500' />
            下載管理中心
          </h1>
          {taskList.some(
            (t) => t.status === 'completed' || t.status === 'failed'
          ) && (
            <button
              onClick={clearCompletedTasks}
              className='flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors'
            >
              <Trash2 className='w-4 h-4' />
              清空已完成
            </button>
          )}
        </div>

        {taskList.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-20 text-gray-500'>
            <Download className='w-16 h-16 mb-4 opacity-20' />
            <p>目前沒有下載任務</p>
            <p className='text-sm mt-2'>在影片播放頁面點擊下載按鈕即可開始</p>
          </div>
        ) : (
          <div className='space-y-4'>
            {taskList.map((task) => (
              <div
                key={task.id}
                className='bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm'
              >
                <div className='flex items-start justify-between mb-2'>
                  <div className='flex-1 min-w-0'>
                    <h3 className='font-medium truncate pr-4'>{task.title}</h3>
                    <div className='flex items-center gap-2 mt-1'>
                      {task.status === 'downloading' && (
                        <span className='flex items-center gap-1 text-xs text-blue-500'>
                          <Loader2 className='w-3 h-3 animate-spin' />
                          正在下載...
                        </span>
                      )}
                      {task.status === 'completed' && (
                        <span className='flex items-center gap-1 text-xs text-green-500'>
                          <CheckCircle className='w-3 h-3' />
                          已完成
                        </span>
                      )}
                      {task.status === 'failed' && (
                        <span
                          className='flex items-center gap-1 text-xs text-red-500'
                          title={task.error}
                        >
                          <AlertCircle className='w-3 h-3' />
                          下載失敗
                        </span>
                      )}
                    </div>
                  </div>
                  <span className='text-sm font-mono font-bold text-gray-600 dark:text-gray-400'>
                    {Math.round(task.progress)}%
                  </span>
                </div>

                <div className='w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden'>
                  <div
                    className={`h-full transition-all duration-300 ${
                      task.status === 'downloading'
                        ? 'bg-blue-500'
                        : task.status === 'completed'
                        ? 'bg-green-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>

                {task.status === 'failed' && task.error && (
                  <p className='text-[10px] text-red-400 mt-2 italic'>
                    錯誤: {task.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className='mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 rounded-lg'>
          <h4 className='text-sm font-bold text-yellow-800 dark:text-yellow-400 mb-1 flex items-center gap-1'>
            <AlertCircle className='w-4 h-4' />
            重要提示
          </h4>
          <p className='text-xs text-yellow-700 dark:text-yellow-500 leading-relaxed'>
            下載中心僅支援在「頁面不刷新」的情況下維持任務。如果您重整網頁或完全關閉瀏覽器，
            進行中的下載任務將會被系統中斷，且已抓取的緩存會丟失。
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
