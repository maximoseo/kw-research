import { NextResponse } from 'next/server';
import { competitorDiscoverySchema } from '@/lib/validation';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { validateResearchSourceUrls } from '@/server/research/preflight';
import {
  analyzeCompetitiveLandscape,
  buildSiteEvidence,
  type AiAvailabilityState,
} from '@/server/research/pipeline';

function normalizeComparableUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
    return `${url.origin}${normalizedPath}${url.search}`;
  } catch {
    return value.trim();
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await request.json();
    const parsed = competitorDiscoverySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid discovery input.' },
        { status: 400 },
      );
    }

    const issues = await validateResearchSourceUrls(parsed.data);
    if (issues.length) {
      return NextResponse.json({ error: issues[0], issues }, { status: 400 });
    }

    const input = {
      ...parsed.data,
      notes: '',
      mode: 'fresh' as const,
      targetRows: 220,
      existingResearchSummary: null,
    };
    const aiState: AiAvailabilityState = { enabled: true };
    const { sitemapUrls, pageSnapshots, existingContentMap } = await buildSiteEvidence(input);
    const discovery = await analyzeCompetitiveLandscape({
      input,
      pageSnapshots,
      existingContentMap,
      aiState,
      manualCompetitorUrls: parsed.data.competitorUrls,
    });

    const existingUrls = new Set(parsed.data.competitorUrls.map(normalizeComparableUrl));
    const competitors = discovery.suggestedCompetitors.map((competitor) => ({
      ...competitor,
      alreadyIncluded: existingUrls.has(normalizeComparableUrl(competitor.url)),
    }));

    return NextResponse.json({
      competitors,
      competitorUrls: discovery.competitorUrls,
      addedCount: competitors.filter((competitor) => !competitor.alreadyIncluded).length,
      siteSummary: {
        businessSummary: discovery.siteUnderstanding.businessSummary,
        offerings: discovery.siteUnderstanding.offerings.slice(0, 5),
      },
      evidence: {
        sitemapUrlCount: sitemapUrls.length,
        pageEvidenceCount: pageSnapshots.length,
      },
      aiUsed: aiState.enabled,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to discover competitors automatically.' }, { status: 500 });
  }
}
