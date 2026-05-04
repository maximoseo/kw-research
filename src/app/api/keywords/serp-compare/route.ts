import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getSerpData, ALL_CONTENT_TYPES, type SerpContentType } from '@/server/research/serp';

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { keywords?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const keywords = body.keywords;

  if (!keywords || !Array.isArray(keywords) || keywords.length < 2 || keywords.length > 3) {
    return NextResponse.json(
      { error: 'keywords array must contain 2–3 keyword strings.' },
      { status: 400 },
    );
  }

  const trimmed = keywords.map((k) => String(k).trim()).filter(Boolean);
  if (trimmed.length < 2) {
    return NextResponse.json(
      { error: 'At least 2 non-empty keywords are required.' },
      { status: 400 },
    );
  }

  try {
    // Fetch SERP data for all keywords in parallel
    const serpDataList = await Promise.all(
      trimmed.map(async (kw) => {
        try {
          return { keyword: kw, data: await getSerpData(kw) };
        } catch (err) {
          console.warn(`[serp-compare] Failed to fetch SERP for "${kw}":`, err);
          return { keyword: kw, data: null };
        }
      }),
    );

    // Build per-keyword results
    const results = serpDataList.map(({ keyword, data }) => {
      const topResults =
        data?.results.map((r) => ({
          rank: r.position,
          title: r.title,
          url: r.url,
          domain: r.domain,
          contentType: r.content_type,
        })) ?? [];

      // Content type breakdown
      const contentTypeBreakdown: Record<string, number> = {};
      for (const type of ALL_CONTENT_TYPES) {
        contentTypeBreakdown[type] = 0;
      }
      if (data) {
        for (const d of data.distribution) {
          contentTypeBreakdown[d.type] = d.count;
        }
      }

      const uniqueDomains = [...new Set(topResults.map((r) => r.domain))];

      return {
        keyword,
        topResults,
        contentTypeBreakdown,
        uniqueDomains,
        missingTypes: data?.missingTypes ?? [],
        fetchedAt: data?.fetchedAt ?? Date.now(),
      };
    });

    // Compute shared domains (domains that appear in ALL keyword results)
    const domainSets = results.map((r) => new Set(r.uniqueDomains));
    const sharedDomains = [...domainSets[0]]
      .filter((domain) => domainSets.slice(1).every((set) => set.has(domain)))
      .slice(0, 20);

    // Compute opportunities
    const opportunities: string[] = [];

    // Missing content types across all keywords
    const allMissingTypeSets = results.map((r) => new Set(r.missingTypes));
    if (allMissingTypeSets.length >= 2) {
      const missingAcrossAll = [...allMissingTypeSets[0]].filter((type) =>
        allMissingTypeSets.slice(1).every((set) => set.has(type)),
      );
      if (missingAcrossAll.length > 0) {
        const typeLabels: Record<string, string> = {
          blog: 'blog posts',
          product: 'product pages',
          video: 'videos',
          forum: 'forum/Q&A content',
          news: 'news/PR content',
          tool: 'tools/apps',
        };
        const labels = missingAcrossAll.map((t) => typeLabels[t] ?? t).join(', ');
        opportunities.push(`Content types missing across ALL keywords: ${labels} — opportunity to fill these gaps`);
      }
    }

    // Low count of a specific content type across all keywords
    for (const type of ALL_CONTENT_TYPES) {
      const totalCount = results.reduce(
        (sum, r) => sum + (r.contentTypeBreakdown[type] || 0),
        0,
      );
      const typeLabel = type === 'video' ? 'video result' : `${type} result`;
      if (totalCount === 0) {
        opportunities.push(`No ${typeLabel}s found across any keyword — huge content gap opportunity`);
      } else if (totalCount === 1) {
        opportunities.push(`Only 1 ${typeLabel} across all keywords — low competition content gap`);
      } else if (totalCount <= 2 && results.length >= 3) {
        opportunities.push(`Only ${totalCount} ${typeLabel}s across ${results.length} keywords — potential content gap`);
      }
    }

    // Shared domains opportunity
    if (sharedDomains.length > 0) {
      const domainList = sharedDomains.slice(0, 3).join(', ');
      const andMore = sharedDomains.length > 3 ? ` and ${sharedDomains.length - 3} more` : '';
      opportunities.push(
        `${sharedDomains.length} domain${sharedDomains.length === 1 ? '' : 's'} rank${sharedDomains.length === 1 ? 's' : ''} for ALL keywords: ${domainList}${andMore} — analyze what they're doing right`,
      );
    }

    // Deduplicate opportunities (first 8)
    const uniqueOpportunities = [...new Set(opportunities)].slice(0, 8);

    return NextResponse.json({
      results,
      sharedDomains,
      opportunities: uniqueOpportunities,
    });
  } catch (err) {
    console.error('[serp-compare] Error:', err);
    return NextResponse.json(
      { error: 'Failed to compare SERP data.' },
      { status: 500 },
    );
  }
}
