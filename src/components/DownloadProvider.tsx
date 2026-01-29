'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

import { downloadM3U8InBrowser } from '@/lib/m3u8-downloader';

export interface DownloadTask {
  id: string; // 使用 URL 作為 ID
  url: string;
  title: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
  startTime: number;
}

interface DownloadContextType {
  tasks: Record<string, DownloadTask>;
  addDownloadTask: (
    url: string,
    title: string,
    epIndex: number
  ) => Promise<void>;
  clearCompletedTasks: () => void;
  activeCount: number;
}

const DownloadContext = createContext<DownloadContextType | undefined>(
  undefined
);

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Record<string, DownloadTask>>({});
  const tasksRef = useRef<Record<string, DownloadTask>>({});

  // 更新任務狀態的輔助函數
  const updateTask = useCallback(
    (id: string, updates: Partial<DownloadTask>) => {
      const newTask = { ...tasksRef.current[id], ...updates };
      tasksRef.current[id] = newTask;
      setTasks({ ...tasksRef.current });
    },
    []
  );

  const addDownloadTask = useCallback(
    async (url: string, title: string, epIndex: number) => {
      // 防止重複添加
      if (tasksRef.current[url]) {
        return;
      }

      const filename = `${title} - 第${epIndex + 1}集`;
      const newTask: DownloadTask = {
        id: url,
        url,
        title: filename,
        progress: 0,
        status: 'downloading',
        startTime: Date.now(),
      };

      tasksRef.current[url] = newTask;
      setTasks({ ...tasksRef.current });

      try {
        const result = await downloadM3U8InBrowser(url, filename, (p) => {
          updateTask(url, { progress: p });
        });

        if (result.success) {
          updateTask(url, { status: 'completed', progress: 100 });
        } else {
          updateTask(url, { status: 'failed', error: result.error });
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        updateTask(url, { status: 'failed', error: err.message || '未知錯誤' });
      }
    },
    [updateTask]
  );

  const clearCompletedTasks = useCallback(() => {
    const newTasks: Record<string, DownloadTask> = {};
    Object.entries(tasksRef.current).forEach(([id, task]) => {
      if (task.status === 'downloading' || task.status === 'pending') {
        newTasks[id] = task;
      }
    });
    tasksRef.current = newTasks;
    setTasks({ ...newTasks });
  }, []);

  const activeCount = Object.values(tasks).filter(
    (t) => t.status === 'downloading'
  ).length;

  return (
    <DownloadContext.Provider
      value={{ tasks, addDownloadTask, clearCompletedTasks, activeCount }}
    >
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload() {
  const context = useContext(DownloadContext);
  if (context === undefined) {
    throw new Error('useDownload must be used within a DownloadProvider');
  }
  return context;
}
