import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getContentMappingsForUser } from '@/server/research/content-map-repository';
import type { PageStats } from '@/server/research/content-map-repository';

export async function GET(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const mappings = await getContentMappingsForUser(user.id);

    // Group by page URL
    const pageMap = new Map<string, {
      pageUrl: string;
      pageTitle: string | null;
      keywordCount: number;
      keywordIds: string[];
    }>();

    for (const m of mappings) {
      const existing = pageMap.get(m.pageUrl);
      if (existing) {
        existing.keywordCount++;
        existing.keywordIds.push(m.keywordId);
        if (!existing.pageTitle && m.pageTitle) {
          existing.pageTitle = m.pageTitle;
        }
      } else {
        pageMap.set(m.pageUrl, {
          pageUrl: m.pageUrl,
          pageTitle: m.pageTitle,
          keywordCount: 1,
          keywordIds: [m.keywordId],
        });
      }
    }

    const pages = Array.from(pageMap.values());

    // Count unmapped: we can't know total keywords from here,
    // but we can return the grouped data. The client will calculate unmapped.
    // For stats, we return keywordIds so client can look up data.
    return NextResponse.json({
      pages: pages.map((p) => ({
        pageUrl: p.pageUrl,
        pageTitle: p.pageTitle,
        keywordCount: p.keywordCount,
        keywordIds: p.keywordIds,
      })),
    });
  } catch (error) {
    console.error('content-map/pages GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
