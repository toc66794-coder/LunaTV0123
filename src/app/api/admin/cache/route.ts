/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * 快取 API 路由
 * GET: 檢查資源是否有快取
 * POST: 儲存測速後的最佳來源 (限管理員)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const year = searchParams.get('year');

  if (!title) {
    return NextResponse.json({ error: '缺少標題' }, { status: 400 });
  }

  try {
    const cacheKey = `cache:fast_source:${title}_${year || ''}`;

    // 從資料庫讀取快取 (使用 GLOBAL 命名空間)
    const cacheData = await db.get('GLOBAL', cacheKey);

    if (cacheData) {
      return NextResponse.json({ hit: true, data: cacheData });
    }

    return NextResponse.json({ hit: false });
  } catch (error) {
    console.error('查詢快取失敗:', error);
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminConfig = await getConfig();
    const username = authInfo.username;

    // 權限校驗：僅限 owner 或 admin
    if (username !== process.env.USERNAME) {
      const userEntry = adminConfig.UserConfig.Users.find(
        (u) => u.username === username
      );
      if (
        !userEntry ||
        (userEntry.role !== 'admin' && userEntry.role !== 'owner')
      ) {
        return NextResponse.json({ error: '權限不足' }, { status: 403 });
      }
    }

    const body = await request.json();

    // 模式 A: 批量查詢 (如果 body 包含 items 數組)
    if (Array.isArray(body.items)) {
      const results: Record<string, boolean> = {};
      const checkPromises = body.items.map(
        async (item: { title: string; year?: string }) => {
          const cacheKey = `cache:fast_source:${item.title}_${item.year || ''}`;
          const data = await db.get('GLOBAL', cacheKey);
          results[`${item.title}_${item.year || ''}`] = !!data;
        }
      );
      await Promise.all(checkPromises);
      return NextResponse.json({ results });
    }

    // 模式 B: 儲存單筆快取
    const { title, year, source, id, source_name } = body;
    if (!title || !source || !id) {
      return NextResponse.json({ error: '參數不足' }, { status: 400 });
    }

    const cacheKey = `cache:fast_source:${title}_${year || ''}`;
    const payload = {
      source,
      id,
      source_name,
      updateTime: Date.now(),
      expireAt: Date.now() + 24 * 60 * 60 * 1000, // 24小時後過期
    };

    // 寫入 Upstash Redis (TTL 為 24 小時)
    await db.set('GLOBAL', cacheKey, payload, 24 * 60 * 60);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('快取操作失敗:', error);
    return NextResponse.json(
      { error: '操作失敗', details: (error as Error).message },
      { status: 500 }
    );
  }
}
