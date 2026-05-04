import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getRunForUser } from '@/server/research/repository';
import { fetchKeywordMetrics } from '@/server/research/keyword-metrics';
import { firecrawlScrape, isFirecrawlConfigured } from '@/server/research/firecrawl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GapKeyword = {
  keyword: string;
  volume: number;
  difficulty: number;
  opportunityScore: number;
  source: string; // which competitor domain it came from
  contentSnippet: string;
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const gapAnalysisSchema = z.object({
  projectId: z.string().min(1),
  userDomain: z.string().min(1),
  competitorDomains: z
    .array(z.string().min(1))
    .min(1, 'At least one competitor domain is required.')
    .max(3, 'Maximum 3 competitor domains allowed.'),
});

// ---------------------------------------------------------------------------
// DuckDuckGo discovery
// ---------------------------------------------------------------------------

function extractDomain(raw: string): string {
  try {
    const url = raw.startsWith('http') ? raw : `https://${raw}`;
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return raw.toLowerCase().replace(/^www\./i, '');
  }
}

interface DuckDuckGoResult {
  title: string;
  href: string;
  snippet: string;
}

async function searchDuckDuckGo(query: string): Promise<DuckDuckGoResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];

    const html = await res.text();

    // Simple regex-based extraction (no cheerio needed for this lightweight task)
    const results: DuckDuckGoResult[] = [];
    const resultBlocks = html.split(/<div[^>]*class="[^"]*result[^"]*"[^>]*>/gi).slice(1);

    for (const block of resultBlocks) {
      if (results.length >= 15) break;

      const linkMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"/i);
      const titleMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*>([^<]*)<\/a>/i);
      const snippetMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([^<]*)<\/a>/i);

      const href = linkMatch?.[1] || '';
      const title = (titleMatch?.[1] || '').replace(/<\/?[^>]+>/g, '').trim();
      const snippet = (snippetMatch?.[1] || '').replace(/<\/?[^>]+>/g, '').trim();

      if (href && title) {
        results.push({ title, href, snippet });
      }
    }

    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Keyword extraction from snippets
// ---------------------------------------------------------------------------

function extractKeywordsFromSnippets(
  results: DuckDuckGoResult[],
  competitorDomain: string,
): Map<string, { sources: string[]; snippets: string[] }> {
  const keywordMap = new Map<string, { sources: string[]; snippets: string[] }>();

  for (const result of results) {
    const title = result.title.toLowerCase();
    const snippet = result.snippet.toLowerCase();
    const resultDomain = extractDomain(result.href);

    // Only consider results from the competitor domain
    if (!resultDomain.includes(competitorDomain.replace(/^www\./i, '')) &&
        !competitorDomain.includes(resultDomain)) {
      continue;
    }

    // Extract potential keyword phrases from title
    const cleanTitle = result.title
      .replace(/[-|:•–—].*$/, '') // Remove after separators (subtitle)
      .trim();

    if (cleanTitle.length >= 3 && cleanTitle.length <= 120) {
      const key = cleanTitle.toLowerCase();
      const existing = keywordMap.get(key);
      if (existing) {
        if (!existing.sources.includes(resultDomain)) {
          existing.sources.push(resultDomain);
        }
        if (result.snippet && !existing.snippets.includes(result.snippet)) {
          existing.snippets.push(result.snippet.slice(0, 200));
        }
      } else {
        keywordMap.set(key, {
          sources: [resultDomain],
          snippets: result.snippet ? [result.snippet.slice(0, 200)] : [],
        });
      }
    }
  }

  return keywordMap;
}

// ---------------------------------------------------------------------------
// Difficulty estimation
// ---------------------------------------------------------------------------

function estimateDifficulty(keyword: string): number {
  const lower = keyword.toLowerCase();
  let score = 30; // baseline

  // Longer keywords tend to be less competitive
  const wordCount = keyword.split(/\s+/).length;
  if (wordCount >= 4) score -= 15;
  else if (wordCount >= 3) score -= 8;

  // Commercial intent → high competition
  if (/\b(buy|price|pricing|review|best|top|vs|versus|cheap|discount)\b/.test(lower)) {
    score += 15;
  }

  // Transactional → high competition
  if (/\b(buy|order|hire|rent|sign\s*up|subscribe|free\s*trial)\b/.test(lower)) {
    score += 20;
  }

  // Navigational/brand → very high
  if (/\b(login|sign\s*in|app|download|official)\b/.test(lower)) {
    score += 25;
  }

  return Math.min(100, Math.max(0, score));
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let parsed: z.infer<typeof gapAnalysisSchema>;
  try {
    const json = await request.json();
    const result = gapAnalysisSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid input.' },
        { status: 400 },
      );
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { userDomain, competitorDomains } = parsed;
  const userDomainClean = extractDomain(userDomain);

  // Get the user's existing keywords from all completed runs
  const existingKeywordSet = new Set<string>();

  // Strategy: try to get keywords from the most recent completed run
  try {
    const { listRunsForProject } = await import('@/server/research/repository');
    const runs = await listRunsForProject(user.id, parsed.projectId, 10);
    const completedRuns = runs.filter((r) => r.status === 'completed');

    for (const run of completedRuns.slice(0, 3)) {
      const detail = await getRunForUser(user.id, run.id);
      if (detail?.rows) {
        for (const row of detail.rows) {
          // Add primary keyword and all cluster keywords
          existingKeywordSet.add(row.primaryKeyword.toLowerCase().trim());
          for (const kw of row.keywords || []) {
            existingKeywordSet.add(kw.toLowerCase().trim());
          }
        }
      }
    }
  } catch {
    // If no runs exist, the set is empty — all competitor keywords are gaps
  }

  // Collect keywords from competitors
  const allGapKeywords: GapKeyword[] = [];
  const errors: string[] = [];

  // Search queries to discover competitor content
  const searchQueries = [
    '',  // empty = just domain search
    'best',
    'guide',
    'review',
    'vs',
    'how to',
  ];

  for (const compDomain of competitorDomains) {
    const compDomainClean = extractDomain(compDomain);
    let competitorKeywordsFound = false;

    // Try Firecrawl first for rich content
    if (isFirecrawlConfigured()) {
      try {
        const pageUrl = compDomain.startsWith('http') ? compDomain : `https://${compDomain}`;
        const scrapeResult = await firecrawlScrape(pageUrl);
        if (scrapeResult?.markdown) {
          // Extract potential keywords from headings and bold text
          const headings = scrapeResult.markdown.match(/^#{1,3}\s+(.+)$/gm);
          if (headings) {
            for (const h of headings) {
              const cleaned = h.replace(/^#{1,3}\s+/, '').trim();
              if (cleaned.length >= 3 && cleaned.length <= 120) {
                const lowerKw = cleaned.toLowerCase();
                if (!existingKeywordSet.has(lowerKw)) {
                  const difficulty = estimateDifficulty(cleaned);
                  allGapKeywords.push({
                    keyword: cleaned,
                    volume: 0, // will be enriched below
                    difficulty,
                    opportunityScore: 0, // will be recalculated
                    source: compDomainClean,
                    contentSnippet: '',
                  });
                  competitorKeywordsFound = true;
                }
              }
            }
          }

          // Also extract bold/strong text
          const boldTexts = scrapeResult.markdown.match(/\*\*(.+?)\*\*/g);
          if (boldTexts) {
            for (const bt of boldTexts.slice(0, 20)) {
              const cleaned = bt.replace(/\*\*/g, '').trim();
              if (cleaned.length >= 3 && cleaned.length <= 120 && !cleaned.startsWith('#')) {
                const lowerKw = cleaned.toLowerCase();
                if (!existingKeywordSet.has(lowerKw) && !allGapKeywords.some((g) => g.keyword.toLowerCase() === lowerKw)) {
                  const difficulty = estimateDifficulty(cleaned);
                  allGapKeywords.push({
                    keyword: cleaned,
                    volume: 0,
                    difficulty,
                    opportunityScore: 0,
                    source: compDomainClean,
                    contentSnippet: '',
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        errors.push(`Failed to scrape ${compDomain}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // DuckDuckGo search for competitor keywords
    for (const sq of searchQueries) {
      const query = sq ? `site:${compDomainClean} ${sq}` : `site:${compDomainClean}`;
      let ddgResults: DuckDuckGoResult[] = [];
      try {
        ddgResults = await searchDuckDuckGo(query);
      } catch {
        continue;
      }

      const extracted = extractKeywordsFromSnippets(ddgResults, compDomainClean);

      for (const [keyword, meta] of extracted) {
        // Skip if user already has this keyword
        if (existingKeywordSet.has(keyword)) continue;

        // Skip if already collected
        const existing = allGapKeywords.find((g) => g.keyword.toLowerCase() === keyword);
        if (existing) {
          if (!existing.contentSnippet && meta.snippets.length > 0) {
            existing.contentSnippet = meta.snippets[0];
          }
          continue;
        }

        const difficulty = estimateDifficulty(keyword);
        allGapKeywords.push({
          keyword: keyword.charAt(0).toUpperCase() + keyword.slice(1),
          volume: 0,
          difficulty,
          opportunityScore: 0,
          source: compDomainClean,
          contentSnippet: meta.snippets[0] || '',
        });
        competitorKeywordsFound = true;
      }
    }

    if (!competitorKeywordsFound && errors.length === 0) {
      errors.push(`No keywords found for ${compDomainClean}. The domain may not be indexed or may have very little content.`);
    }
  }

  // Deduplicate by keyword
  const seen = new Set<string>();
  const deduped: GapKeyword[] = [];
  for (const kw of allGapKeywords) {
    const lower = kw.keyword.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      deduped.push(kw);
    }
  }

  // Enrich with volume estimates
  for (const kw of deduped) {
    try {
      const metrics = await fetchKeywordMetrics({
        keyword: kw.keyword,
        language: 'English',
        market: 'US',
      });
      kw.volume = metrics.searchVolume ?? 250;
    } catch {
      kw.volume = 250;
    }
  }

  // Calculate opportunity scores: volume × (100 - difficulty) / 100
  for (const kw of deduped) {
    kw.opportunityScore = Math.round((kw.volume * (100 - kw.difficulty)) / 100);
  }

  // Sort by opportunity score descending
  deduped.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return NextResponse.json({
    gapKeywords: deduped,
    totalFound: deduped.length,
    userKeywordCount: existingKeywordSet.size,
    competitorDomains: competitorDomains.map(extractDomain),
    errors: errors.length > 0 ? errors : undefined,
  });
}
