import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const response = await fetch(url);
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
    const newLines = lines
      .filter((line) => !line.includes('#EXT-X-DISCONTINUITY'))
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Check if it's a URI line (not empty, not starting with #, or starts with HLS tags that contain URIs like #EXT-X-KEY)
        if (trimmed.startsWith('#')) {
          // Handle #EXT-X-KEY URI resolution if needed, though often keys are absolute or we ignore for now to keep simple
          // Simplified: just return standard tags
          return line;
        }

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
