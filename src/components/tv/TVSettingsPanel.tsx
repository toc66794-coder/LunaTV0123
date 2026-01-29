'use client';

import React, { useEffect, useState } from 'react';

import { ensureFocusManager } from './TVFocusProvider';

interface Source {
  key: string;
  name: string;
}

interface TVSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Current disabled source keys (Blacklist)
  disabledSources: string[];
  onToggleSource: (key: string) => void;
}

export function TVSettingsPanel({
  isOpen,
  onClose,
  disabledSources,
  onToggleSource,
}: TVSettingsPanelProps) {
  const [availableSources, setAvailableSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);

  // 初始化全域焦點管理器
  useEffect(() => {
    ensureFocusManager();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/sources')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setAvailableSources(data.data);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleClearCache = () => {
    if (confirm('確定要清除所有快取數據並重新整理嗎？')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleResetSources = () => {
    if (
      confirm('確定要重置並啟用所有可用播放源嗎？這將解決「沒有資源」的問題。')
    ) {
      localStorage.removeItem('tv_source_filter');
      localStorage.removeItem('tv_disabled_sources');
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-[60] bg-black/90 flex items-center justify-center animate-in fade-in duration-200'>
      <div className='w-full max-w-4xl bg-gray-900 border border-gray-700 rounded-2xl p-8 shadow-2xl flex flex-col max-h-[80vh]'>
        <h2 className='text-3xl font-bold text-white mb-8 border-l-4 border-blue-500 pl-4'>
          設定
        </h2>

        <div className='flex-1 overflow-y-auto pr-4 space-y-8'>
          {/* Source Management Section */}
          <section>
            <h3 className='text-xl font-semibold text-gray-300 mb-4'>
              播放源管理 (過濾搜尋結果)
            </h3>
            {loading ? (
              <div className='text-gray-500'>正在讀取源列表...</div>
            ) : (
              <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                {availableSources.map((source) => {
                  const isEnabled = !disabledSources.includes(source.key);
                  return (
                    <button
                      key={source.key}
                      data-tv-focusable='true'
                      onClick={() => onToggleSource(source.key)}
                      className={`px-4 py-3 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                        isEnabled
                          ? 'border-blue-500 bg-blue-900/30 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-400'
                      } focus:scale-105 focus:ring-2 focus:ring-blue-400 outline-none`}
                    >
                      <span className='truncate mr-2'>{source.name}</span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isEnabled
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-500'
                        }`}
                      >
                        {isEnabled && (
                          <svg
                            className='w-3 h-3 text-white'
                            fill='none'
                            viewBox='0 0 24 24'
                            stroke='currentColor'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={3}
                              d='M5 13l4 4L19 7'
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <p className='text-sm text-gray-500 mt-2'>
              * 關閉的源將不會出現在自動匹配或手動搜尋結果中。
            </p>
          </section>

          <hr className='border-gray-800' />

          {/* System Actions */}
          <section>
            <h3 className='text-xl font-semibold text-gray-300 mb-4'>
              系統操作
            </h3>
            <div className='flex flex-wrap gap-4'>
              <button
                data-tv-focusable='true'
                onClick={handleResetSources}
                className='px-6 py-3 rounded-xl bg-blue-900/40 border border-blue-800 text-blue-200 focus:bg-blue-800 focus:text-white transition-all outline-none'
              >
                重置並啟用所有源
              </button>

              <button
                data-tv-focusable='true'
                onClick={handleClearCache}
                className='px-6 py-3 rounded-xl bg-red-900/40 border border-red-800 text-red-200 focus:bg-red-800 focus:text-white transition-all outline-none'
              >
                清除快取並重整
              </button>
            </div>
          </section>
        </div>

        <div className='mt-8 flex justify-end pt-4 border-t border-gray-800'>
          <button
            data-tv-focusable='true'
            onClick={onClose}
            className='px-10 py-3 rounded-xl bg-gray-800 text-white font-bold text-xl hover:bg-gray-700 focus:bg-white focus:text-black transition-all outline-none'
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
