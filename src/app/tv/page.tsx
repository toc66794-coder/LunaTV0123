'use client';

import React, { useEffect, useState } from 'react';

import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';

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

      {/* 詳情模式 (開發中) */}
      {selectedMovie && (
        <div className='fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-20 animate-in fade-in zoom-in duration-300'>
          <div className='max-w-6xl w-full flex space-x-12'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedMovie.poster}
              className='w-80 rounded-2xl shadow-2xl'
              alt=''
            />
            <div className='flex-1 space-y-6'>
              <h1 className='text-6xl font-bold'>{selectedMovie.title}</h1>
              <p className='text-2xl text-gray-400'>
                {selectedMovie.year} ·{' '}
                {selectedMovie.rate ? `${selectedMovie.rate}分` : '暫無評分'}
              </p>
              <div className='flex space-x-4 pt-10'>
                <button
                  data-tv-focusable='true'
                  autoFocus
                  className='px-12 py-4 bg-blue-600 rounded-xl text-2xl font-bold focus:ring-8 focus:ring-blue-400 outline-none transition-all hover:bg-blue-700'
                  onClick={() => setIsPlaying(true)}
                >
                  立即播放
                </button>
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
      {isPlaying && selectedMovie && (
        <div className='fixed inset-0 z-[100] bg-black'>
          <TVVideoPlayer
            url='https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' // 暫時使用測試源，後續接上真實 M3U8
            title={selectedMovie.title}
            poster={selectedMovie.poster}
            onClose={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
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
