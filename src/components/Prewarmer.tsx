/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
'use client';

import { useEffect, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { toSimplified } from '@/lib/chinese';
import { preferBestSource } from '@/lib/video-logic';

interface PrewarmerProps {
  items: Array<{ title: string; year?: string }>;
  onCacheUpdate?: (key: string) => void;
}

/**
 * Prewarmer 組件：管理員專用背景預熱器
 * 升級版：雙頻掃描模式
 * 1. 監控輪詢 (500ms)：快速檢查哪些影片已在快取中
 * 2. 深度預熱 (3-5s)：針對未命中的項目，執行完整的搜尋與最優源選擇
 */
export default function Prewarmer({ items, onCacheUpdate }: PrewarmerProps) {
  const [userRole, setUserRole] = useState<string | undefined>(undefined);

  // 用於追蹤已由「監控輪詢」檢查過的項目
  const checkedRef = useRef<Set<string>>(new Set());
  // 待深度預熱的隊列
  const prewarmQueueRef = useRef<Array<{ title: string; year?: string }>>([]);
  // 標記是否正在進行深度預熱，避免並發
  const isWarmingRef = useRef<boolean>(false);

  const monitorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const workerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化獲取用戶角色
  useEffect(() => {
    const auth = getAuthInfoFromBrowserCookie();
    if (auth?.role) {
      setUserRole(auth.role);
    }
  }, []);

  // 僅管理員/站長處於作用狀態
  const isAuthorized = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    if (!isAuthorized || !items || items.length === 0) return;

    // 清理舊定時器
    if (monitorTimerRef.current) clearTimeout(monitorTimerRef.current);
    if (workerTimerRef.current) clearTimeout(workerTimerRef.current);

    // 輔助函數：清理標題以進行模糊匹配
    const cleanTitle = (str: string) => {
      return str
        .toLowerCase()
        .replace(/\s+/g, '') // 去除空格
        .replace(/[：:，,。.！!？?（）()[\]【】\-_]/g, ''); // 去除標點
    };

    /**
     * 1. 監控輪詢 (Fast Loop) - 升級版：批量檢查
     * 目的：一次性消耗 pendingItems 列表，大幅減少 API 請求次數
     */
    const startMonitor = async () => {
      const pendingItems = items.filter(
        (item) => !checkedRef.current.has(`${item.title}_${item.year || ''}`)
      );

      if (pendingItems.length === 0) {
        monitorTimerRef.current = setTimeout(startMonitor, 10000); // 全部檢查完畢，長休 10 秒
        return;
      }

      console.log(
        `[Prewarmer] 🕵️ Batch checking ${pendingItems.length} items...`
      );

      try {
        // 使用批量查模式
        const res = await fetch('/api/admin/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: pendingItems }),
        });

        const data = await res.json();

        if (data.results) {
          Object.entries(data.results).forEach(([key, hit]) => {
            checkedRef.current.add(key);
            if (hit) {
              // console.log(`[Prewarmer] ⚡ Hit: ${key}`);
              if (onCacheUpdate) onCacheUpdate(key);
            } else {
              // 找出對應的 item 加入預熱隊列
              const [title, year] = key.split('_');
              const item = pendingItems.find(
                (it) => it.title === title && (it.year || '') === year
              );
              if (item) {
                console.log(`[Prewarmer] 🛒 Queueing for prewarm: ${title}`);
                prewarmQueueRef.current.push(item);
              }
            }
          });
        }
      } catch (e) {
        console.warn(`[Prewarmer] Batch monitor failed`, e);
      }

      // 批量處理後休眠較長時間，避免頻繁請求
      monitorTimerRef.current = setTimeout(startMonitor, 30000);
    };

    /**
     * 2. 深度預熱工作員 (Slow Worker)
     * 目的：針對隊列中的項目進行搜尋、測速、選擇最優源
     */
    const startWorker = async () => {
      if (isWarmingRef.current || prewarmQueueRef.current.length === 0) {
        workerTimerRef.current = setTimeout(startWorker, 1000);
        return;
      }

      isWarmingRef.current = true;
      const item = prewarmQueueRef.current.shift();
      if (!item) {
        isWarmingRef.current = false;
        workerTimerRef.current = setTimeout(startWorker, 1000);
        return;
      }

      try {
        console.log(`[Prewarmer] 🔥 Deep prewarming: ${item.title}...`);

        const searchTitle = toSimplified(item.title);
        const searchRes = await fetch(
          `/api/search?q=${encodeURIComponent(searchTitle)}`
        );

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const results = searchData.results || [];

          // 模糊匹配過濾
          const targetClean = cleanTitle(item.title);
          const candidates = results.filter((r: any) => {
            const resultClean = cleanTitle(r.title);
            const titleMatch =
              targetClean.includes(resultClean) ||
              resultClean.includes(targetClean);
            const yearMatch = !item.year || r.year === item.year || !r.year;
            return titleMatch && yearMatch;
          });

          if (candidates.length > 0) {
            // 獲取候選源的詳細播放信息
            const detailedCandidates = await Promise.all(
              candidates.slice(0, 5).map(async (c: any) => {
                const dRes = await fetch(
                  `/api/detail?source=${c.source}&id=${c.id}`
                );
                return dRes.ok ? await dRes.json() : null;
              })
            );

            const validCandidates = detailedCandidates.filter(Boolean);

            if (validCandidates.length > 0) {
              // 整合「最優源選擇」邏輯
              console.log(
                `[Prewarmer] Analyzing ${validCandidates.length} sources for ${item.title}`
              );
              const bestSource = await preferBestSource(validCandidates);

              // 寫入快取
              await fetch('/api/admin/cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: item.title,
                  year: item.year,
                  source: bestSource.source,
                  id: bestSource.id,
                  source_name: bestSource.source_name,
                }),
              });

              console.log(
                `[Prewarmer] ✅ Optimized cache saved: ${item.title}`
              );
              if (onCacheUpdate) {
                onCacheUpdate(`${item.title}_${item.year || ''}`);
              }
            }
          } else {
            console.log(`[Prewarmer] ❌ No match found: ${item.title}`);
          }
        }
      } catch (e) {
        console.warn(`[Prewarmer] Worker failed for ${item.title}`, e);
      } finally {
        isWarmingRef.current = false;
        // 深度預熱完成後，間隔 3-5 秒再開始下一個
        workerTimerRef.current = setTimeout(startWorker, 3000);
      }
    };

    // 啟動雙頻掃描
    monitorTimerRef.current = setTimeout(startMonitor, 2000); // 延遲啟動
    workerTimerRef.current = setTimeout(startWorker, 5000); // 工作員更晚啟動

    return () => {
      if (monitorTimerRef.current) clearTimeout(monitorTimerRef.current);
      if (workerTimerRef.current) clearTimeout(workerTimerRef.current);
    };
  }, [items, isAuthorized, onCacheUpdate]);

  return null;
}
