import React from 'react';

import { DoubanItem } from '@/lib/types';

interface TVVideoCardProps {
  movie: DoubanItem;
  onSelect: () => void;
}

export function TVVideoCard({ movie, onSelect }: TVVideoCardProps) {
  return (
    <div
      data-tv-focusable='true'
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect();
      }}
      className='group relative flex-shrink-0 w-64 h-96 bg-gray-900 rounded-xl overflow-hidden transition-all duration-300 transform focus:scale-110 focus:ring-4 focus:ring-blue-500 focus:outline-none focus:z-10 shadow-lg hover:shadow-2xl'
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={movie.poster}
        alt={movie.title}
        className='w-full h-full object-cover opacity-80 group-focus:opacity-100 transition-opacity'
      />

      {/* 底部資訊遮罩 */}
      <div className='absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent'>
        <h3 className='text-xl font-bold truncate'>{movie.title}</h3>
        <p className='text-sm text-gray-400 opacity-0 group-focus:opacity-100 transition-opacity'>
          {movie.year || '2024'} · {movie.rate ? `${movie.rate}分` : 'HD'}
        </p>
      </div>

      {/* 聚焦時的發光效果 */}
      <div className='absolute inset-0 border-4 border-transparent group-focus:border-blue-500 pointer-events-none rounded-xl' />
    </div>
  );
}
