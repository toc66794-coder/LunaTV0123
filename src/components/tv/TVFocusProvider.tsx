/* eslint-disable no-console */
'use client';

import React, { createContext, useContext, useEffect } from 'react';

interface TVFocusContextType {
  focusElement: (id: string) => void;
}

const TVFocusContext = createContext<TVFocusContextType | null>(null);

export function TVFocusProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const focusableElements = Array.from(
        document.querySelectorAll('[data-tv-focusable="true"]')
      ) as HTMLElement[];

      if (focusableElements.length === 0) return;

      const current = document.activeElement as HTMLElement;
      const isCurrentlyFocusable = current?.dataset?.tvFocusable === 'true';

      if (!isCurrentlyFocusable) {
        focusableElements[0].focus();
        return;
      }

      const currentRect = current.getBoundingClientRect();
      let bestTarget: HTMLElement | null = null;
      let minDistance = Infinity;

      focusableElements.forEach((el) => {
        if (el === current) return;
        const rect = el.getBoundingClientRect();

        // 簡單的空間方向判定
        let isMatch = false;
        if (e.key === 'ArrowRight') isMatch = rect.left >= currentRect.right;
        if (e.key === 'ArrowLeft') isMatch = rect.right <= currentRect.left;
        if (e.key === 'ArrowDown') isMatch = rect.top >= currentRect.bottom;
        if (e.key === 'ArrowUp') isMatch = rect.bottom <= currentRect.top;

        if (isMatch) {
          // 計算中心點距離 (歐幾里德距離)
          const dist = Math.sqrt(
            Math.pow(
              rect.left +
                rect.width / 2 -
                (currentRect.left + currentRect.width / 2),
              2
            ) +
              Math.pow(
                rect.top +
                  rect.height / 2 -
                  (currentRect.top + currentRect.height / 2),
                2
              )
          );
          if (dist < minDistance) {
            minDistance = dist;
            bestTarget = el;
          }
        }
      });

      if (bestTarget) {
        (bestTarget as HTMLElement).focus();
        (bestTarget as HTMLElement).scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <TVFocusContext.Provider
      value={{ focusElement: (id) => console.log('Focusing', id) }}
    >
      <div className='tv-root bg-black min-h-screen text-white overflow-hidden p-8'>
        {children}
      </div>
    </TVFocusContext.Provider>
  );
}

export const useTvFocus = () => {
  const context = useContext(TVFocusContext);
  if (!context)
    throw new Error('useTvFocus must be used within TVFocusProvider');
  return context;
};
