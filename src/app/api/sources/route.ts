import { NextResponse } from 'next/server';

import { getAvailableApiSites } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const sites = await getAvailableApiSites();
    return NextResponse.json({
      success: true,
      data: sites.map((site) => ({
        key: site.key,
        name: site.name,
      })),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to available sources:', error);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
