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
    const origin = baseUrl.origin;
    const baseDir = baseUrl.pathname.substring(
      0,
      baseUrl.pathname.lastIndexOf('/') + 1
    );
    const search = baseUrl.search; // 獲取原始 URL 的 Query String (包含 ?)

    // 輔助函式：將相對路徑轉換為絕對路徑
    const resolveUri = (uri: string) => {
      const cleanUri = uri.replace(/["']/g, ''); // 移除引號
      if (cleanUri.startsWith('http')) return uri; // 已經是絕對路徑

      let absolute;
      if (cleanUri.startsWith('/')) {
        absolute = `${origin}${cleanUri}`;
      } else {
        absolute = `${origin}${baseDir}${cleanUri}`;
      }

      // 如果路徑中沒有 ?，則補上原始 URL 的 Query String
      if (!absolute.includes('?')) {
        absolute += search;
      }

      // 如果原本有引號，補回來
      return uri.startsWith('"') ? `"${absolute}"` : absolute;
    };

    const lines = content.split('\n');
    let isMaster = false;
    const newLines = lines.map((line: string, index: number) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // 1. 檢測是否為 Master Playlist
      if (trimmed.startsWith('#EXT-X-STREAM-INF')) {
        isMaster = true;
      }

      // 2. 處理標籤中的 URI (例如 #EXT-X-KEY:URI="...")
      if (trimmed.startsWith('#')) {
        if (trimmed.includes('URI=')) {
          return trimmed.replace(/URI=([^,]+)/, (match: string, p1: string) => {
            return `URI=${resolveUri(p1)}`;
          });
        }
        return line;
      }

      // 3. 處理純片段路徑
      const resolved = resolveUri(trimmed);

      // 如果是 Master Playlist 的子列表，需要遞迴代理
      if (
        isMaster &&
        (trimmed.endsWith('.m3u8') || trimmed.includes('.m3u8?'))
      ) {
        // 取得絕對路徑
        const absoluteUrl = resolved.startsWith('"')
          ? resolved.slice(1, -1)
          : resolved;
        // 封裝進代理，注意這裡要用當前請求的 origin 作為代理的前綴
        const proxyPrefix = `${request.nextUrl.origin}${request.nextUrl.pathname}`;
        return `${proxyPrefix}?url=${encodeURIComponent(absoluteUrl)}`;
      }

      return resolved;
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
