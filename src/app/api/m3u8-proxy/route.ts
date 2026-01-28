import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
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

    return new NextResponse(modifiedContent, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
