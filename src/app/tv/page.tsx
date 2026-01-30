/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */
'use client';

import React, { useEffect, useState } from 'react';

import { getDoubanCategories, getDoubanRecommends } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

import { TVSettingsPanel } from '@/components/tv/TVSettingsPanel';
import { TVVideoCard } from '@/components/tv/TVVideoCard';
import { TVVideoPlayer } from '@/components/tv/TVVideoPlayer';

export default function TVHomePage() {
  const [selectedMovie, setSelectedMovie] = useState<DoubanItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Data State
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotAnimation, setHotAnimation] = useState<DoubanItem[]>([]);
  const [hotVariety, setHotVariety] = useState<DoubanItem[]>([]);
  const [movieCategory, setMovieCategory] = useState<
    '热门电影' | '最新电影' | '豆瓣高分' | '冷门佳片'
  >('热门电影');

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDetail, setVideoDetail] = useState<any>(null);
  const [isSearchingSources, setIsSearchingSources] = useState(false);
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState(0);

  // Auth State
  const [user, setUser] = useState<string | null>(null);

  // Filter State
  const [filterMode, setFilterMode] = useState<
    'all' | 'movie' | 'tv' | 'anime' | 'variety'
  >('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Search Fallback State
  const [manualSearchResults, setManualSearchResults] = useState<any[]>([]);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [disabledSources, setDisabledSources] = useState<string[]>([]);
  const [enabledSources, setEnabledSources] = useState<string[]>([]);
  const [allSearchResults, setAllSearchResults] = useState<any[]>([]);
  const [showSwitchList, setShowSwitchList] = useState(false);

  // Check Auth
  useEffect(() => {
    // 載入設置 (改用黑名單邏輯以支援自動添加新源)
    const saved = localStorage.getItem('tv_disabled_sources');
    if (saved) {
      try {
        setDisabledSources(JSON.parse(saved));
      } catch (e) {
        /* ignore */
      }
    } else {
      // 兼容舊版設定：如果發現舊版白名單，則嘗試遷移或直接重置
      const oldSaved = localStorage.getItem('tv_source_filter');
      if (oldSaved) {
        // 舊版存在，為了避免混亂，直接重置為全部啟用 (空黑名單)
        // 或者我們可以嘗試計算黑名單，但這需要獲取所有源，比較複雜且容易出錯
        // 用戶已經遇到問題，直接重置是最好的
        localStorage.removeItem('tv_source_filter');
      }
      // 默認全部啟用 (空黑名單)
      setDisabledSources([]);
    }

    // 讀取可用源列表，並依黑名單計算啟用源
    fetch('/api/sources')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.data)) {
          const all = data.data.map((s: any) => s.key);
          const enabled = all.filter(
            (k: string) => !disabledSources.includes(k)
          );
          setEnabledSources(enabled);
        }
      })
      .catch(() => {
        setEnabledSources([]);
      });

    // Dynamic import to avoid SSR issues with document.cookie
    import('@/lib/auth').then(({ getAuthInfoFromBrowserCookie }) => {
      const info = getAuthInfoFromBrowserCookie();
      if (info?.username) {
        setUser(info.username);
      }
    });
  }, []);

  const handleToggleSource = (key: string) => {
    setDisabledSources((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key) // 如果在黑名單中，移除 (啟用)
        : [...prev, key]; // 如果不在黑名單中，加入 (禁用)
      localStorage.setItem('tv_disabled_sources', JSON.stringify(next));
      // 同步 enabledSources
      setEnabledSources((prevEnabled) => {
        const setAll = new Set(prevEnabled.concat(key));
        const enabled = Array.from(setAll).filter((k) => !next.includes(k));
        return enabled;
      });
      return next;
    });
  };

  const handleLogout = () => {
    document.cookie = 'auth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    setUser(null);
  };

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Reset current lists
        setHotMovies([]);
        setHotTvShows([]);
        setHotAnimation([]);
        setHotVariety([]);

        // Determine what to fetch based on filterMode
        const promises = [];

        if (filterMode === 'all' || filterMode === 'movie') {
          if (movieCategory === '热门电影') {
            promises.push(
              getDoubanCategories({
                kind: 'movie',
                category: '热门',
                type: '全部',
              }).then((res) =>
                res.code === 200 ? setHotMovies(res.list) : null
              )
            );
          } else {
            // 使用列表接口按標籤獲取
            const tagMap: Record<string, string> = {
              最新电影: '最新',
              豆瓣高分: '豆瓣高分',
              冷门佳片: '冷门佳片',
            };
            const tag = tagMap[movieCategory] || '热门';
            promises.push(
              import('@/lib/douban.client').then(({ getDoubanList }) =>
                getDoubanList({
                  tag,
                  type: 'movie',
                  pageLimit: 20,
                  pageStart: 0,
                }).then((res) =>
                  res.code === 200 ? setHotMovies(res.list) : null
                )
              )
            );
          }
        }

        if (filterMode === 'all' || filterMode === 'tv') {
          promises.push(
            getDoubanRecommends({
              kind: 'tv',
              category: '电视剧',
            }).then((res) =>
              res.code === 200 ? setHotTvShows(res.list) : null
            )
          );
        }

        if (filterMode === 'all' || filterMode === 'anime') {
          promises.push(
            getDoubanRecommends({
              kind: 'tv',
              category: '动漫',
            }).then((res) =>
              res.code === 200 ? setHotAnimation(res.list) : null
            )
          );
        }

        if (filterMode === 'all' || filterMode === 'variety') {
          // Optional: Add variety support if needed, mapped to 'show'
          promises.push(
            getDoubanRecommends({
              kind: 'tv',
              category: '综艺',
            }).then((res) =>
              res.code === 200 ? setHotVariety(res.list) : null
            )
          );
        }

        await Promise.all(promises);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch TV data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filterMode]);

  // Fetch Video Source when a movie is selected
  useEffect(() => {
    if (!selectedMovie) {
      setVideoDetail(null);
      setSelectedEpisodeIndex(0);
      setManualSearchResults([]);
      return;
    }

    const searchSource = async () => {
      try {
        setIsSearchingSources(true);
        setVideoDetail(null);
        setManualSearchResults([]);

        // 1. Search for sources
        const searchRes = await fetch(
          `/api/search?q=${encodeURIComponent(selectedMovie.title)}`
        );
        const searchData = await searchRes.json();
        let results = searchData.results || [];

        // 0. Filter by disabled sources (Blacklist)
        if (disabledSources.length > 0) {
          results = results.filter(
            (r: any) => !disabledSources.includes(r.source)
          );
        }
        // 保留所有搜尋結果以便換源顯示
        setAllSearchResults(results);

        if (results.length === 0) {
          setIsSearchingSources(false);
          return;
        }

        // 2. Fuzzy Matching Strategy
        // Priority 1: Exact Title Match
        let match = results.find((r: any) => r.title === selectedMovie.title);

        // Priority 2: Title inclusion (ignore spaces/case)
        if (!match) {
          const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
          const target = normalize(selectedMovie.title);
          match = results.find(
            (r: any) =>
              normalize(r.title).includes(target) ||
              target.includes(normalize(r.title))
          );
        }

        if (match) {
          // 3. Fetch Details
          const detailRes = await fetch(
            `/api/detail?source=${match.source}&id=${match.id}`
          );
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            setVideoDetail(detailData);
            // 若為單集內容，直接自動播放
            if (detailData?.episodes && detailData.episodes.length === 1) {
              setSelectedEpisodeIndex(0);
              setIsPlaying(true);
            }
          } else {
            // Auto-match failed (e.g. 500 error), fallback to manual
            console.warn('Auto-match source failed:', match.source);
            setManualSearchResults(results);
          }
        } else {
          // If automatic matching fails or is unsure, populate manual list
          setManualSearchResults(results);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to search sources', err);
      } finally {
        setIsSearchingSources(false);
      }
    };

    searchSource();
  }, [selectedMovie]);

  const handleManualSelect = async (source: any) => {
    try {
      setIsSearchingSources(true);
      const detailRes = await fetch(
        `/api/detail?source=${source.source}&id=${source.id}`
      );
      if (!detailRes.ok) {
        throw new Error('Source unavailable');
      }
      const detailData = await detailRes.json();
      setVideoDetail(detailData);
      setManualSearchResults([]); // Clear manual list after selection
    } catch (e) {
      console.error(e);
      // Maybe show a toast or alert here? For now, we rely on the user seeing it didn't work or staying on the list
      // But clearing videoDetail might be safer if we want to show "Unavailable"
      // setVideoDetail(null);
    } finally {
      setIsSearchingSources(false);
    }
  };

  return (
    <div className='flex flex-col space-y-12 p-10 pb-20 relative'>
      {/* Top Navigation */}
      <header className='flex items-center justify-between z-20 relative'>
        <h1 className='text-4xl font-extrabold tracking-tighter text-blue-500'>
          LunaTV{' '}
          <span className='text-white text-2xl ml-2 font-normal opacity-50'>
            TV Mode
          </span>
        </h1>
        <div className='flex items-center space-x-6'>
          {/* User Info */}
          {user ? (
            <div className='flex items-center space-x-4 bg-gray-900/80 px-4 py-2 rounded-full border border-gray-700'>
              <span className='text-gray-300'>Hi, {user}</span>
              <button
                data-tv-focusable='true'
                onClick={handleLogout}
                className='text-sm text-red-400 hover:text-red-300 focus:text-white px-2 py-1 rounded'
              >
                登出
              </button>
            </div>
          ) : (
            <div className='px-4 py-2 text-gray-500'>未登入</div>
          )}

          <button
            data-tv-focusable='true'
            className='px-6 py-2 rounded-full border-2 border-gray-800 focus:border-blue-500 focus:bg-blue-600 outline-none transition-all flex items-center gap-2'
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <span>
              分類:{' '}
              {filterMode === 'all'
                ? '全部'
                : filterMode === 'movie'
                ? '電影'
                : filterMode === 'tv'
                ? '電視劇'
                : filterMode === 'anime'
                ? '動漫'
                : '綜藝'}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${
                isFilterOpen ? 'rotate-180' : ''
              }`}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M19 9l-7 7-7-7'
              />
            </svg>
          </button>
          {(filterMode === 'all' || filterMode === 'movie') && (
            <div className='flex items-center gap-2'>
              <span className='text-gray-400'>電影分類:</span>
              <select
                data-tv-focusable='true'
                className='px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg outline-none focus:border-blue-500'
                value={movieCategory}
                onChange={(e) => setMovieCategory(e.target.value as any)}
              >
                <option value='热门电影'>热门电影</option>
                <option value='最新电影'>最新电影</option>
                <option value='豆瓣高分'>豆瓣高分</option>
                <option value='冷门佳片'>冷门佳片</option>
              </select>
            </div>
          )}

          <button
            data-tv-focusable='true'
            className='px-6 py-2 rounded-full border-2 border-gray-800 focus:border-blue-500 focus:bg-blue-600 outline-none transition-all flex items-center gap-2'
            onClick={() => setIsSettingsOpen(true)}
          >
            <svg
              className='w-4 h-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
              />
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
              />
            </svg>
            <span>設定</span>
          </button>
        </div>
      </header>

      <TVSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        enabledSources={enabledSources}
        onToggleSource={handleToggleSource}
      />

      {/* Filter Dropdown (Visual Only for TV, mapped to Focus) */}
      {isFilterOpen && (
        <div className='absolute top-24 right-10 bg-gray-900 border border-gray-700 rounded-xl p-2 flex flex-col gap-2 z-30 shadow-2xl animate-in fade-in slide-in-from-top-4'>
          {[
            { id: 'all', label: '全部' },
            { id: 'movie', label: '電影' },
            { id: 'tv', label: '電視劇' },
            { id: 'anime', label: '動漫' },
            { id: 'variety', label: '綜藝' },
          ].map((bg) => (
            <button
              key={bg.id}
              data-tv-focusable='true'
              autoFocus={filterMode === bg.id}
              className={`px-8 py-3 rounded-lg text-left text-lg transition-colors ${
                filterMode === bg.id
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-800 text-gray-300'
              } focus:bg-blue-500 focus:text-white outline-none`}
              onClick={() => {
                setFilterMode(bg.id as any);
                setIsFilterOpen(false);
              }}
            >
              {bg.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading Skeleton or Real Data */}
      {loading ? (
        <div className='text-2xl text-gray-500 animate-pulse'>
          正在載入精彩內容...
        </div>
      ) : (
        <>
          {/* 熱門電影 */}
          {(filterMode === 'all' || filterMode === 'movie') &&
            hotMovies.length > 0 && (
              <section>
                <h2 className='text-2xl font-semibold mb-6 ml-2 border-l-4 border-blue-500 pl-4'>
                  熱門電影
                </h2>
                <div className='flex space-x-8 overflow-x-auto pb-8 scrollbar-hide px-2'>
                  {hotMovies.map((movie) => (
                    <TVVideoCard
                      key={'movie-' + movie.id}
                      movie={movie}
                      onSelect={() => setSelectedMovie(movie)}
                    />
                  ))}
                </div>
              </section>
            )}

          {/* 熱門劇集 */}
          {(filterMode === 'all' || filterMode === 'tv') &&
            hotTvShows.length > 0 && (
              <section>
                <h2 className='text-2xl font-semibold mb-6 ml-2 border-l-4 border-green-500 pl-4'>
                  熱門劇集
                </h2>
                <div className='flex space-x-8 overflow-x-auto pb-8 scrollbar-hide px-2'>
                  {hotTvShows.map((show) => (
                    <TVVideoCard
                      key={'tv-' + show.id}
                      movie={show}
                      onSelect={() => setSelectedMovie(show)}
                    />
                  ))}
                </div>
              </section>
            )}

          {/* 熱門動漫 */}
          {(filterMode === 'all' || filterMode === 'anime') &&
            hotAnimation.length > 0 && (
              <section>
                <h2 className='text-2xl font-semibold mb-6 ml-2 border-l-4 border-pink-500 pl-4'>
                  熱門動漫
                </h2>
                <div className='flex space-x-8 overflow-x-auto pb-8 scrollbar-hide px-2'>
                  {hotAnimation.map((anim) => (
                    <TVVideoCard
                      key={'anim-' + anim.id}
                      movie={anim}
                      onSelect={() => setSelectedMovie(anim)}
                    />
                  ))}
                </div>
              </section>
            )}

          {/* 熱門綜藝 */}
          {(filterMode === 'all' || filterMode === 'variety') &&
            hotVariety.length > 0 && (
              <section>
                <h2 className='text-2xl font-semibold mb-6 ml-2 border-l-4 border-yellow-500 pl-4'>
                  熱門綜藝
                </h2>
                <div className='flex space-x-8 overflow-x-auto pb-8 scrollbar-hide px-2'>
                  {hotVariety.map((v) => (
                    <TVVideoCard
                      key={'variety-' + v.id}
                      movie={v}
                      onSelect={() => setSelectedMovie(v)}
                    />
                  ))}
                </div>
              </section>
            )}
        </>
      )}

      {/* 詳情模式 */}
      {selectedMovie && (
        <div className='fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-20 animate-in fade-in zoom-in duration-300'>
          <div className='max-w-7xl w-full flex space-x-16'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={processImageUrl(selectedMovie.poster)}
              className='w-96 rounded-2xl shadow-2xl border-4 border-white/10'
              alt=''
              referrerPolicy='no-referrer'
            />
            <div className='flex-1 flex flex-col justify-center space-y-8'>
              <h1 className='text-7xl font-bold'>{selectedMovie.title}</h1>
              <p className='text-3xl text-gray-400'>
                {selectedMovie.year} ·{' '}
                {selectedMovie.rate ? `${selectedMovie.rate}分` : '暫無評分'}
              </p>

              {/* 播放區域邏輯 */}
              <div className='space-y-4'>
                <h3 className='text-xl font-semibold text-blue-400'>
                  {isSearchingSources
                    ? '正在搜尋線路...'
                    : videoDetail
                    ? '播放列表'
                    : manualSearchResults.length > 0
                    ? '請選擇可用片源 (自動匹配失敗)'
                    : '暫無可用線路'}
                </h3>
                {allSearchResults.length > 0 && (
                  <div className='pt-2'>
                    <button
                      data-tv-focusable='true'
                      className='px-6 py-2 rounded-xl border-2 border-gray-800 bg-gray-900 text-gray-200 hover:border-yellow-500 focus:border-yellow-500 outline-none'
                      onClick={() => {
                        const next = !showSwitchList;
                        setShowSwitchList(next);
                        setManualSearchResults(next ? allSearchResults : []);
                      }}
                    >
                      {showSwitchList ? '關閉換源' : '換源'}
                    </button>
                  </div>
                )}

                {/* 1. 正常顯示集數 */}
                {videoDetail && (
                  <div className='flex flex-wrap gap-4 max-h-[300px] overflow-y-auto pr-4 scrollbar-hide'>
                    {videoDetail.episodes?.map((ep: string, index: number) => (
                      <button
                        key={index}
                        data-tv-focusable='true'
                        className={`px-8 py-3 rounded-xl text-xl font-medium border-2 transition-all outline-none ${
                          selectedEpisodeIndex === index
                            ? 'border-blue-500 bg-blue-600'
                            : 'border-gray-800 bg-gray-900 focus:border-blue-400 focus:bg-gray-800'
                        }`}
                        onClick={() => {
                          setSelectedEpisodeIndex(index);
                          setIsPlaying(true);
                        }}
                      >
                        {videoDetail.episodes.length > 1
                          ? `第 ${index + 1} 集`
                          : '立即播放'}
                      </button>
                    ))}
                  </div>
                )}

                {/* 2. 顯示手動搜尋結果/換源列表 */}
                {manualSearchResults.length > 0 && (
                  <div className='flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-4'>
                    {manualSearchResults.map((res: any, idx: number) => (
                      <button
                        key={idx}
                        data-tv-focusable='true'
                        className='px-6 py-4 rounded-xl text-left border-2 border-gray-800 hover:border-yellow-500 focus:border-yellow-500 bg-gray-900 transition-all flex justify-between'
                        onClick={() => handleManualSelect(res)}
                      >
                        <span className='text-lg font-bold text-white'>
                          {res.title}
                        </span>
                        <span className='text-gray-400'>
                          {res.type_name} · {res.year}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* 3. 真的沒救了 */}
                {!isSearchingSources &&
                  !videoDetail &&
                  manualSearchResults.length === 0 && (
                    <div className='p-6 bg-red-900/20 border border-red-500/30 rounded-xl'>
                      <p className='text-red-400 text-xl'>
                        抱歉，找不到 "{selectedMovie.title}" 的相關播放資源。
                      </p>
                    </div>
                  )}
              </div>

              <div className='flex space-x-6 pt-8'>
                <button
                  data-tv-focusable='true'
                  className='px-12 py-4 bg-gray-800 rounded-xl text-2xl font-bold focus:ring-8 focus:ring-gray-600 outline-none transition-all hover:bg-gray-700'
                  onClick={() => setSelectedMovie(null)}
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 全螢幕播放器模式 */}
      {isPlaying && selectedMovie && videoDetail && (
        <div className='fixed inset-0 z-[100] bg-black'>
          <TVVideoPlayer
            url={videoDetail.episodes[selectedEpisodeIndex]}
            title={`${selectedMovie.title}${
              videoDetail.episodes.length > 1
                ? ` - 第 ${selectedEpisodeIndex + 1} 集`
                : ''
            }`}
            poster={selectedMovie.poster}
            onClose={() => setIsPlaying(false)}
            onEnded={() => {
              if (selectedEpisodeIndex < videoDetail.episodes.length - 1) {
                setSelectedEpisodeIndex(selectedEpisodeIndex + 1);
              } else {
                setIsPlaying(false);
              }
            }}
            onError={(e) => {
              console.error('Playback error:', e);
              setIsPlaying(false);
              // Open switch source list
              if (allSearchResults.length > 0) {
                setManualSearchResults(allSearchResults);
                setShowSwitchList(true);
              }
            }}
          />
        </div>
      )}

      {/* CSS 修補 */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
