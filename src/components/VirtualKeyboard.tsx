'use client';

import { ArrowUp, ChevronLeft, Delete, Hash, Type } from 'lucide-react';
import React, { useState } from 'react';

interface VirtualKeyboardProps {
  onInput: (char: string) => void;
  onDelete: () => void;
  onEnter?: () => void;
  className?: string;
}

export function VirtualKeyboard({
  onInput,
  onDelete,
  onEnter,
  className = '',
}: VirtualKeyboardProps) {
  const [mode, setMode] = useState<'ABC' | '123'>('ABC');
  const [isCaps, setIsCaps] = useState(false);

  const keysABC = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ];

  const keys123 = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '@'],
  ];

  const handleKeyClick = (key: string) => {
    let char = key;
    if (mode === 'ABC' && isCaps) {
      char = char.toUpperCase();
    }
    onInput(char);
  };

  const currentKeys = mode === 'ABC' ? keysABC : keys123;

  return (
    <div
      className={`bg-gray-100 dark:bg-zinc-800 p-2 rounded-xl shadow-lg select-none ${className}`}
    >
      <div className='flex flex-col gap-1.5'>
        {currentKeys.map((row, rowIndex) => (
          <div key={rowIndex} className='flex justify-center gap-1.5'>
            {row.map((key) => (
              <button
                key={key}
                type='button'
                data-tv-focusable='true'
                onClick={() => handleKeyClick(key)}
                className='h-10 w-8 sm:w-10 flex items-center justify-center rounded bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-sm active:bg-gray-200 dark:active:bg-zinc-600 focus:bg-green-100 dark:focus:bg-green-900 focus:ring-2 focus:ring-green-500 focus:outline-none transition-colors text-lg font-medium'
              >
                {isCaps ? key.toUpperCase() : key}
              </button>
            ))}
          </div>
        ))}

        <div className='flex justify-center gap-1.5 mt-1'>
          {/* 切换模式 */}
          <button
            type='button'
            data-tv-focusable='true'
            onClick={() => setMode(mode === 'ABC' ? '123' : 'ABC')}
            className='h-10 px-3 flex items-center justify-center rounded bg-gray-200 dark:bg-zinc-600 text-gray-700 dark:text-gray-200 shadow-sm active:bg-gray-300 focus:ring-2 focus:ring-green-500 focus:outline-none'
          >
            {mode === 'ABC' ? <Hash size={18} /> : <Type size={18} />}
          </button>

          {/* 大小写 (仅在 ABC 模式下显示) */}
          {mode === 'ABC' && (
            <button
              type='button'
              data-tv-focusable='true'
              onClick={() => setIsCaps(!isCaps)}
              className={`h-10 px-3 flex items-center justify-center rounded shadow-sm active:bg-gray-300 focus:ring-2 focus:ring-green-500 focus:outline-none ${
                isCaps
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-zinc-600 text-gray-700 dark:text-gray-200'
              }`}
            >
              <ArrowUp size={18} />
            </button>
          )}

          {/* 空格 */}
          <button
            type='button'
            data-tv-focusable='true'
            onClick={() => onInput(' ')}
            className='h-10 flex-1 max-w-[120px] flex items-center justify-center rounded bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-sm active:bg-gray-200 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm'
          >
            Space
          </button>

          {/* 删除 */}
          <button
            type='button'
            data-tv-focusable='true'
            onClick={onDelete}
            className='h-10 px-3 flex items-center justify-center rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow-sm active:bg-red-200 focus:ring-2 focus:ring-red-500 focus:outline-none'
          >
            <Delete size={18} />
          </button>
          
          {/* Enter (如果有提供) */}
          {onEnter && (
             <button
              type='button'
              data-tv-focusable='true'
              onClick={onEnter}
              className='h-10 px-3 flex items-center justify-center rounded bg-green-600 text-white shadow-sm active:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none'
            >
              <ChevronLeft className="rotate-180" size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
