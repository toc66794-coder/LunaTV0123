/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
'use client';

import { useEffect, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { toSimplified } from '@/lib/chinese';

interface PrewarmerProps {
  items: Array<{ title: string; year?: string }>;
}

/**
 * Prewarmer 組件：管理員專用背景預熱器
 * 邏輯：獲取列表中的影片 -> 檢查快取 -> 未命中則背景測速 -> 儲存結果
 */
export default function Prewarmer({ items }: PrewarmerProps) {
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const processedRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
    if (timerRef.current) clearTimeout(timerRef.current);

    // 啟動預熱隊列
    const startPrewarming = async () => {
      // 隨機選取未處理的項目
      const pendingItems = items.filter(
        (item) => !processedRef.current.has(`${item.title}_${item.year || ''}`)
      );

      if (pendingItems.length === 0) return;

      // 每次處理 1 個項目，間隔 10 秒（避免負擔過重與 API 限制）
      const item = pendingItems[0];
      const key = `${item.title}_${item.year || ''}`;
      processedRef.current.add(key);

      try {
        // 1. 檢查遠端是否已有快取
        const checkRes = await fetch(
          `/api/admin/cache?title=${encodeURIComponent(item.title)}&year=${
            item.year || ''
          }`
        );
        const checkData = await checkRes.json();

        if (checkData.hit) {
          console.log(`[Prewarmer] Hit: ${item.title}`);
        } else {
          console.log(`[Prewarmer] Warming up: ${item.title}...`);

          // 2. 背景執行測速流程
          const searchTitle = toSimplified(item.title);
          await fetch(`/api/search/ws?q=${encodeURIComponent(searchTitle)}`);

          // 註：這僅觸發後端搜尋與緩存，真正的詳細測速在播放頁面完成後會自動沈澱到快取。
          console.log(`[Prewarmer] Search triggered for: ${item.title}`);
        }
      } catch (e) {
        console.warn(`[Prewarmer] Failed for ${item.title}`, e);
      }

      // 排程下一個
      timerRef.current = setTimeout(startPrewarming, 15000);
    };

    // 延遲 5 秒後開始，讓路給主要頁面載入
    timerRef.current = setTimeout(startPrewarming, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [items, isAuthorized]);

  return null; // 不佔用 UI 空間
}
