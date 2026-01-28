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
    // 使用 response.url 作為基礎，這能自動處理網址重定向 (Redirect) 的問題
    const finalUrl = new URL(response.url);
    const origin = finalUrl.origin;
    const baseDir = finalUrl.pathname.substring(
      0,
      finalUrl.pathname.lastIndexOf('/') + 1
    );
    const originUrl = new URL(url);
    const search = originUrl.search; // 保留原始請求的 Token/Query

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

      // 如果路徑中沒有 ?，則補上原始 URL 的 Query String (Token)
      if (!absolute.includes('?')) {
        absolute += search;
      }

      // 如果原本有引號，補回來
      return uri.startsWith('"') ? `"${absolute}"` : absolute;
    };

    const lines = content.split('\n');
    let isNextLineVariant = false; // 用於追蹤下一行是否為子播放列表

    const newLines = lines.map((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // 1. 處理標籤
      if (trimmed.startsWith('#')) {
        // 如果偵測到子列表標籤，標記下一行為 Variant
        if (trimmed.startsWith('#EXT-X-STREAM-INF')) {
          isNextLineVariant = true;
        }

        // 處理標籤中的 URI (例如 #EXT-X-KEY:URI="...")
        if (trimmed.includes('URI=')) {
          return trimmed.replace(
            /URI=([^,]+)/,
            (_match: string, p1: string) => {
              return `URI=${resolveUri(p1)}`;
            }
          );
        }
        return line;
      }

      // 2. 處理路徑行
      const resolved = resolveUri(trimmed);

      // 如果當前行是子列表 (由上一行的 #EXT-X-STREAM-INF 觸發)
      if (isNextLineVariant) {
        isNextLineVariant = false; // 重置狀態
        // 取得絕對路徑
        const absoluteUrl = resolved.startsWith('"')
          ? resolved.slice(1, -1)
          : resolved;
        // 遞迴封裝進代理
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
