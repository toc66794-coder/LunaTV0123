import { NextRequest, NextResponse } from 'next/server';

import {
  type TMDbMovie,
  type TMDbTVShow,
  getPersonCredits,
  searchPerson,
} from '@/lib/tmdb.client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 演員搜尋 API（支援多語言）
 * GET /api/tmdb/actor?q=演員名字
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: '請提供演員名字 (q)' }, { status: 400 });
  }

  try {
    console.log(`[TMDb] Actor Search Query: "${query}"`);

    // 多語言並行搜尋（處理翻譯差異）
    const results = await Promise.all([
      searchPerson(query, 1, 'zh-TW')
        .then((r) => r.results)
        .catch((err) => {
          console.error(`[TMDb] zh-TW search failed:`, err.message);
          return [];
        }),
      searchPerson(query, 1, 'zh-CN')
        .then((r) => r.results)
        .catch((err) => {
          console.error(`[TMDb] zh-CN search failed:`, err.message);
          return [];
        }),
      searchPerson(query, 1, 'en')
        .then((r) => r.results)
        .catch((err) => {
          console.error(`[TMDb] en search failed:`, err.message);
          return [];
        }),
    ]);

    // 合併結果並去重（根據 TMDb ID）
    const allResults = results.flat();
    const uniqueResults = Array.from(
      new Map(allResults.map((item) => [item.id, item])).values()
    );

    if (uniqueResults.length === 0) {
      console.log(`[TMDb] No results found for "${query}"`);
      return NextResponse.json({
        found: false,
        message: '找不到該演員',
      });
    }

    // 取得第一個結果（最相關）
    const actor = uniqueResults[0];

    // 獲取演員的作品列表
    const credits = await getPersonCredits(actor.id);

    // 合併電影和電視劇，按人氣排序
    const allWorks = credits.cast
      .map((work) => ({
        ...work,
        media_type: 'title' in work ? 'movie' : 'tv',
      }))
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 40); // 只返回前 20 部作品

    return NextResponse.json({
      found: true,
      actor: {
        id: actor.id,
        name: actor.name,
        profile_url: actor.profile_path
          ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
          : null,
        known_for_department: actor.known_for_department,
      },
      works: allWorks.map((work) => {
        const isMovie = 'title' in work;
        // Type assertion for character property (exists in cast credits)
        const castWork = work as typeof work & { character?: string };
        return {
          id: work.id,
          title: isMovie
            ? (work as TMDbMovie).title
            : (work as TMDbTVShow).name,
          year: isMovie
            ? (work as TMDbMovie).release_date?.split('-')[0]
            : (work as TMDbTVShow).first_air_date?.split('-')[0],
          rating: work.vote_average?.toFixed(1),
          poster_url: work.poster_path
            ? `https://image.tmdb.org/t/p/w500${work.poster_path}`
            : null,
          media_type: isMovie ? 'movie' : 'tv',
          character: castWork.character || '',
        };
      }),
      total_works: credits.cast.length,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('演員搜尋失敗:', error);
    return NextResponse.json(
      {
        error: '演員搜尋失敗',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
