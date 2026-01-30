/* eslint-disable no-console */
'use client';

import React, { createContext, useContext, useEffect } from 'react';

interface TVFocusContextType {
  focusElement: (id: string) => void;
}

const TVFocusContext = createContext<TVFocusContextType | null>(null);

export function TVFocusProvider({
  children,
  className = 'bg-black min-h-screen text-white overflow-hidden p-8',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    // 確保只初始化一次
    ensureFocusManager();
  }, []);

  return (
    <TVFocusContext.Provider
      value={{ focusElement: (id) => console.log('Focusing', id) }}
    >
      <div className={`tv-root ${className}`}>{children}</div>
    </TVFocusContext.Provider>
  );
}

// Singleton pattern to manage focus listener
let isFocusManagerInitialized = false;

export const setFocusScope = (scope: string | HTMLElement | null) => {
  // Placeholder for focus scope management
  console.log('Setting focus scope:', scope);
};

export const ensureFocusManager = () => {
  if (typeof window === 'undefined') return;
  if (isFocusManagerInitialized) return;

  isFocusManagerInitialized = true;

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore inputs unless it's navigation keys
    const isInput = ['INPUT', 'TEXTAREA'].includes(
      (document.activeElement as HTMLElement).tagName
    );

    if (isInput) {
      // Only allow Up/Down to navigate out of inputs, Left/Right might be for cursor
      // But if the user wants to navigate out horizontally, they might be stuck too.
      // For TV interface with Virtual Keyboard, we usually prioritize navigation.
      // Let's allow Up/Down to escape always.
      if (!['ArrowUp', 'ArrowDown'].includes(e.key)) {
        return;
      }
      // If Up/Down, we continue to spatial navigation logic
    }

    // 獲取所有可聚焦元素
    const focusableElements = Array.from(
      document.querySelectorAll(
        '[data-tv-focusable="true"]:not([disabled]):not([style*="display: none"])'
      )
    ) as HTMLElement[];

    if (focusableElements.length === 0) return;

    const current = document.activeElement as HTMLElement;
    const isCurrentlyFocusable = current?.dataset?.tvFocusable === 'true';

    // 聚焦可見元素邏輯 (當前無焦點時)
    if (!isCurrentlyFocusable) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        // 嘗試找到視野內的第一個元素
        const visible = focusableElements.find((el) => {
          const rect = el.getBoundingClientRect();
          return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
          );
        });
        (visible || focusableElements[0]).focus();
      }
      return;
    }

    // Enter 鍵觸發點擊
    if (e.key === 'Enter') {
      e.preventDefault();
      current.click();
      return;
    }

    // 導航邏輯
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key))
      return;

    e.preventDefault();

    const currentRect = current.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2,
    };

    let bestTarget: HTMLElement | null = null;
    let minDistance = Infinity;

    focusableElements.forEach((el) => {
      if (el === current) return;
      const rect = el.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      // 方向判定
      let isValidDirection = false;
      // 權重：主要方向距離 vs 次要方向偏移
      let primaryDist = 0;
      let secondaryDist = 0;

      switch (e.key) {
        case 'ArrowRight':
          isValidDirection =
            rect.left >= currentRect.left + currentRect.width * 0.1; // 放寬判定
          primaryDist = center.x - currentCenter.x;
          secondaryDist = Math.abs(center.y - currentCenter.y);
          break;
        case 'ArrowLeft':
          isValidDirection =
            rect.right <= currentRect.right - currentRect.width * 0.1; // 放寬判定
          primaryDist = currentCenter.x - center.x;
          secondaryDist = Math.abs(center.y - currentCenter.y);
          break;
        case 'ArrowDown':
          isValidDirection =
            rect.top >= currentRect.top + currentRect.height * 0.1;
          primaryDist = center.y - currentCenter.y;
          secondaryDist = Math.abs(center.x - currentCenter.x);
          break;
        case 'ArrowUp':
          isValidDirection =
            rect.bottom <= currentRect.bottom - currentRect.height * 0.1;
          primaryDist = currentCenter.y - center.y;
          secondaryDist = Math.abs(center.x - currentCenter.x);
          break;
      }

      if (isValidDirection && primaryDist > 0) {
        // 歐幾里德距離權重計算
        // 增加 secondaryDist 的權重，優先選擇直線上的元素
        const score = primaryDist + secondaryDist * 2.5;

        if (score < minDistance) {
          minDistance = score;
          bestTarget = el;
        }
      }
    });

    if (bestTarget) {
      (bestTarget as HTMLElement).focus();
      (bestTarget as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  // 注意：這裡我們沒有提供 removeEventListener，因為我們希望它是全域單例且持續存在的
  // 在 Next.js 頁面切換時，如果組件卸載，我們可能需要清理，但這個 Singleton 模式假設是在 App 層級或 Page 層級初始化
  // 為了安全，我們可以提供一個 cleanup 方法，但在此案例中，簡單處理即可
};

export const useTvFocus = () => {
  const context = useContext(TVFocusContext);
  if (!context)
    throw new Error('useTvFocus must be used within TVFocusProvider');
  return context;
};
