'use client';

import React, { useState } from 'react';

import { TVVideoCard } from '@/components/tv/TVVideoCard';

// 測試用 mock 資料
const MOCK_MOVIES = [
  {
    id: '1',
    title: '星際效應',
    poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6vS6o6y6vRvHT.jpg',
    year: '2014',
    quality: '4K',
  },
  {
    id: '2',
    title: '全面啟動',
    poster: 'https://image.tmdb.org/t/p/w500/9gk7Fn9sVAsS9696G1o10neS9v3.jpg',
    year: '2010',
    quality: 'HD',
  },
  {
    id: '3',
    title: '黑暗騎士',
    poster: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDO92SMRvqc6mCEOIeS.jpg',
    year: '2008',
    quality: 'HD',
  },
  {
    id: '4',
    title: '奧本海默',
    poster: 'https://image.tmdb.org/t/p/w500/8Gxv2mYgiFAao4XoRJs6sSTrVsW.jpg',
    year: '2023',
    quality: '4K',
  },
  {
    id: '5',
    title: '敦克爾克',
    poster: 'https://image.tmdb.org/t/p/w500/ebSnODmB9sr896O9W6pD8H60aO2.jpg',
    year: '2017',
    quality: 'HD',
  },
  {
    id: '6',
    title: '天能',
    poster: 'https://image.tmdb.org/t/p/w500/k68nPLbU61R3bbpdyuxqXq9X905.jpg',
    year: '2020',
    quality: '4K',
  },
];

import { TVVideoPlayer } from '@/components/tv/TVVideoPlayer';

export default function TVHomePage() {
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className='flex flex-col space-y-12'>
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

      {/* 熱門推薦行李表 */}
      <section>
        <h2 className='text-2xl font-semibold mb-6 ml-2'>熱門推薦</h2>
        <div className='flex space-x-6 overflow-x-auto pb-12 scrollbar-hide px-2'>
          {MOCK_MOVIES.map((movie) => (
            <TVVideoCard
              key={movie.id}
              movie={movie}
              onSelect={() => setSelectedMovie(movie)}
            />
          ))}
        </div>
      </section>

      {/* 最近觀看行李表 */}
      <section>
        <h2 className='text-2xl font-semibold mb-6 ml-2'>最近觀看</h2>
        <div className='flex space-x-6 overflow-x-auto pb-12 scrollbar-hide px-2'>
          {MOCK_MOVIES.slice()
            .reverse()
            .map((movie) => (
              <TVVideoCard
                key={`recent-${movie.id}`}
                movie={movie}
                onSelect={() => setSelectedMovie(movie)}
              />
            ))}
        </div>
      </section>

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
                {selectedMovie.year} · {selectedMovie.quality}
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
