import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// 初始化 Redis 客戶端
const redis = new Redis({
  url: process.env.UPSTASH_URL || '',
  token: process.env.UPSTASH_TOKEN || '',
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // 生成快取 Key (URL 的 Base64)
  const cacheKey = `m3u8_cache:${Buffer.from(url).toString('base64')}`;

  try {
    // 1. 嘗試從 Redis 獲取快取
    try {
      const cachedContent = await redis.get<string>(cacheKey);
      if (cachedContent) {
        // eslint-disable-next-line no-console
        console.log('[Proxy] Cache Hit:', url);
        return new NextResponse(cachedContent, {
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'X-Cache': 'HIT',
          },
        });
      }
    } catch (redisError) {
      // eslint-disable-next-line no-console
      console.error('[Proxy] Redis Read Error:', redisError);
      // Redis 失敗則繼續執行，不中斷請求
    }

    const headers: Record<string, string> = {
      'User-Agent':
        request.headers.get('user-agent') ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // 某些源需要特定的 Referer，這裡嘗試使用原 URL 的 Origin 作為 Referer
    const targetUrl = new URL(url);
    headers['Referer'] = targetUrl.origin;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      return new NextResponse(`Failed to fetch m3u8: ${response.statusText}`, {
        status: response.status,
      });
    }

    const content = await response.text();
    const baseUrl = new URL(url);
    const baseDir = baseUrl.pathname.substring(
      0,
      baseUrl.pathname.lastIndexOf('/') + 1
    );
    const origin = baseUrl.origin;

    const lines = content.split('\n');
    const newLines = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      // It is a segment URI
      try {
        // If absolute, return as is
        new URL(trimmed);
        return trimmed;
      } catch {
        // Relative URL - resolve against base
        if (trimmed.startsWith('/')) {
          // Absolute path relative to domain
          return `${origin}${trimmed}`;
        } else {
          // Relative path relative to current directory
          return `${origin}${baseDir}${trimmed}`;
        }
      }
    });

    const modifiedContent = newLines.join('\n');

    // 2. 將結果存入 Redis (TTL 300秒 / 5分鐘)
    try {
      await redis.set(cacheKey, modifiedContent, { ex: 300 });
      // eslint-disable-next-line no-console
      console.log('[Proxy] Cache Set:', url);
    } catch (redisError) {
      // eslint-disable-next-line no-console
      console.error('[Proxy] Redis Write Error:', redisError);
    }

    return new NextResponse(modifiedContent, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
