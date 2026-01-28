'use client';

import React, { useEffect, useState } from 'react';

import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem, SearchResult } from '@/lib/types';

import { TVVideoCard } from '@/components/tv/TVVideoCard';
import { TVVideoPlayer } from '@/components/tv/TVVideoPlayer';

export default function TVHomePage() {
  const [selectedMovie, setSelectedMovie] = useState<DoubanItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Real Data State
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotAnimation, setHotAnimation] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Video Source & Episodes State
  const [isSearchingSources, setIsSearchingSources] = useState(false);
  const [videoDetail, setVideoDetail] = useState<SearchResult | null>(null);
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState(0);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [movies, tvs, anims] = await Promise.all([
          getDoubanCategories({
            kind: 'movie',
            category: '热门',
            type: '全部',
          }),
          getDoubanCategories({ kind: 'tv', category: '热门', type: '电视剧' }),
          getDoubanCategories({ kind: 'tv', category: '热门', type: '动漫' }),
        ]);

        if (movies.code === 200) setHotMovies(movies.list);
        if (tvs.code === 200) setHotTvShows(tvs.list);
        if (anims.code === 200) setHotAnimation(anims.list);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch TV data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch Video Source when a movie is selected
  useEffect(() => {
    if (!selectedMovie) {
      setVideoDetail(null);
      setSelectedEpisodeIndex(0);
      return;
    }

    const searchSource = async () => {
      try {
        setIsSearchingSources(true);
        // 1. 搜尋播放源
        const searchRes = await fetch(
          `/api/search?q=${encodeURIComponent(selectedMovie.title)}`
        );
        const searchData = await searchRes.json();
        const results = searchData.results || [];

        // 2. 匹配最精確的源 (標題一致且年份接近)
        const match = results.find(
          (r: any) =>
            r.title.includes(selectedMovie.title) ||
            selectedMovie.title.includes(r.title)
        );

        if (match) {
          // 3. 獲取詳細集數資訊
          const detailRes = await fetch(
            `/api/detail?source=${match.source}&id=${match.id}`
          );
          const detailData = await detailRes.json();
          setVideoDetail(detailData);
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

  return (
    <div className='flex flex-col space-y-12 p-10 pb-20'>
      {/* 頂部導航欄 */}
      <header className='flex items-center justify-between'>
        <h1 className='text-4xl font-extrabold tracking-tighter text-blue-500'>
          LunaTV{' '}
          <span className='text-white text-2xl ml-2 font-normal opacity-50'>
            TV Mode
          </span>
        </h1>
        <div className='flex space-x-6'>
          <button
            data-tv-focusable='true'
            className='px-6 py-2 rounded-full border-2 border-gray-800 focus:border-blue-500 focus:bg-blue-600 outline-none transition-all'
          >
            搜尋
          </button>
          <button
            data-tv-focusable='true'
            className='px-6 py-2 rounded-full border-2 border-gray-800 focus:border-blue-500 focus:bg-blue-600 outline-none transition-all'
          >
            設定
          </button>
        </div>
      </header>

      {/* Loading Skeleton or Real Data */}
      {loading ? (
        <div className='text-2xl text-gray-500 animate-pulse'>
          正在載入精彩內容...
        </div>
      ) : (
        <>
          {/* 熱門電影 */}
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

          {/* 熱門劇集 */}
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

          {/* 熱門動漫 */}
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
        </>
      )}

      {/* 詳情模式 */}
      {selectedMovie && (
        <div className='fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-20 animate-in fade-in zoom-in duration-300'>
          <div className='max-w-7xl w-full flex space-x-16'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedMovie.poster}
              className='w-96 rounded-2xl shadow-2xl border-4 border-white/10'
              alt=''
            />
            <div className='flex-1 flex flex-col justify-center space-y-8'>
              <h1 className='text-7xl font-bold'>{selectedMovie.title}</h1>
              <p className='text-3xl text-gray-400'>
                {selectedMovie.year} ·{' '}
                {selectedMovie.rate ? `${selectedMovie.rate}分` : '暫無評分'}
              </p>

              {/* 集數選擇列表 */}
              <div className='space-y-4'>
                <h3 className='text-xl font-semibold text-blue-400'>
                  {isSearchingSources ? '正在搜尋線路...' : '播放列表'}
                </h3>
                <div className='flex flex-wrap gap-4 max-h-[300px] overflow-y-auto pr-4 scrollbar-hide'>
                  {videoDetail?.episodes?.map((ep: string, index: number) => (
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
                  {!isSearchingSources && !videoDetail && (
                    <p className='text-gray-500 italic'>暫無可用線路</p>
                  )}
                </div>
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
