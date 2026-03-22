import { NextResponse } from 'next/server';
import { competitorDiscoverySchema } from '@/lib/validation';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import {
  analyzeCompetitiveLandscape,
  buildSiteEvidence,
  type AiAvailabilityState,
} from '@/server/research/pipeline';
import { fetchWithTimeout } from '@/server/research/http';

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

/** Lightweight homepage reachability check — only blocks on the homepage. */
async function validateHomepageReachable(homepageUrl: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(homepageUrl, { timeoutMs: 12_000 });
    if (!response.ok) return `Homepage URL returned HTTP ${response.status}.`;
    return null;
  } catch (error) {
    return `Homepage could not be fetched. ${error instanceof Error ? error.message : ''}`.trim();
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

    // Only validate homepage reachability — about/sitemap will be auto-discovered
    const homepageIssue = await validateHomepageReachable(parsed.data.homepageUrl);
    if (homepageIssue) {
      return NextResponse.json({ error: homepageIssue, issues: [homepageIssue] }, { status: 400 });
    }

    const input = {
      ...parsed.data,
      notes: '',
      mode: 'fresh' as const,
      targetRows: 220,
      existingResearchSummary: null,
    };
    const aiState: AiAvailabilityState = { enabled: true };
    const { sitemapUrls, pageSnapshots, existingContentMap, discoveryMeta } = await buildSiteEvidence(input);
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

    const totalCandidates = discovery.discoveredCompetitors?.length ?? competitors.length;
    const methods: string[] = [];
    if (discoveryMeta?.sitemapSource) methods.push(`sitemap: ${discoveryMeta.sitemapSource}`);
    if (discoveryMeta?.aboutSource) methods.push(`about: ${discoveryMeta.aboutSource}`);
    if (totalCandidates > 0) methods.push('DuckDuckGo search');
    if (discovery.siteProfile) methods.push('AI site profiling');
    if (discovery.validationResult) methods.push('AI competitor validation');

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
      discoveryMeta: discoveryMeta ?? null,
      metadata: { methods, totalCandidates },
      aiUsed: aiState.enabled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[competitors/discover] Pipeline error:', message, error);
    
    const isTimeout = message.includes('abort') || message.includes('timeout');
    const isAiError = message.includes('AI provider') || message.includes('API key') || message.includes('Anthropic') || message.includes('OpenAI');
    
    const userMessage = isAiError
      ? 'AI service is temporarily unavailable. Please check your API configuration and try again.'
      : isTimeout
        ? 'Discovery timed out. The target site may be slow or unreachable. Please try again.'
        : `Competitor discovery failed: ${message.slice(0, 200)}`;
    
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
