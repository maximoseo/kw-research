import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { callAiJson } from '@/server/research/ai';
import { db } from '@/server/db/client';
import { serpResults } from '@/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { createHash, randomUUID } from 'crypto';
import { searchCache } from '@/server/db/schema';

/* ─────────────────────────────────────────────
   Request schema — single keyword or batch
   ───────────────────────────────────────────── */

const tpRequestSchema = z.object({
  keywords: z.array(
    z.object({
      keyword: z.string().min(1),
      volume: z.number().min(0).nullable().optional(),
    }),
  ).max(50),
});

/* ─────────────────────────────────────────────
   Response shape
   ───────────────────────────────────────────── */

interface TrafficPotentialResult {
  keyword: string;
  volume: number | null;
  trafficPotential: number | null;
  relatedKeywordCount: number | null;
  explanation: string | null;
  factor: number | null;
}

/* ─────────────────────────────────────────────
   TP estimation via AI (fallback/no-SERP)
   ───────────────────────────────────────────── */

const tpEstimationSchema = z.object({
  estimates: z.array(
    z.object({
      keyword: z.string(),
      trafficPotential: z.number(),
      relatedKeywordCount: z.number(),
      explanation: z.string(),
    }),
  ),
});

async function estimateWithAI(
  keywords: Array<{ keyword: string; volume: number | null }>,
): Promise<TrafficPotentialResult[]> {
  const prompt = keywords
    .map(
      (k, i) =>
        `${i + 1}. "${k.keyword}" — monthly search volume: ${k.volume ?? 'unknown'}`,
    )
    .join('\n');

  const result = await callAiJson<z.infer<typeof tpEstimationSchema>>({
    schema: tpEstimationSchema,
    system: `You are an SEO keyword analyst specialized in Traffic Potential estimation.

Traffic Potential = the total organic traffic a top-ranking page receives from ALL keywords it ranks for, NOT just the target keyword. A page that ranks for a head term also ranks for dozens/hundreds of related long-tail variants.

Estimation guidelines:
- Short head terms (1-2 words, e.g. "CRM software"): TP = volume × 2.5–4.0 (many variants)
- Medium terms (2-3 words, e.g. "best CRM for startups"): TP = volume × 1.8–3.0
- Long-tail terms (4+ words, e.g. "how to choose CRM for small business"): TP = volume × 1.2–2.0
- Very specific/navigational terms (brand names, "login", "pricing"): TP = volume × 1.0–1.5
- Informational "how to" / "what is" terms: TP = volume × 1.5–2.5
- Commercial "best" / "vs" / "review" terms: TP = volume × 1.3–2.2
- Transactional "buy" / "price" terms: TP = volume × 1.0–1.5

For relatedKeywordCount, estimate how many related long-tail keywords the top page would rank for.

Return valid JSON only — no prose before or after.`,
    prompt: `Estimate Traffic Potential (total organic traffic from all related keywords) for these keywords:\n\n${prompt}`,
    modelTier: 'haiku',
    maxTokens: 4096,
  });

  return result.estimates.map((est: { keyword: string; trafficPotential: number; relatedKeywordCount: number; explanation: string }) => {
    const kw = keywords.find(
      (k) => k.keyword.toLowerCase().trim() === est.keyword.toLowerCase().trim(),
    );
    const volume = kw?.volume ?? null;
    const factor =
      volume && volume > 0
        ? Math.round((est.trafficPotential / volume) * 100) / 100
        : null;
    return {
      keyword: est.keyword,
      volume,
      trafficPotential: est.trafficPotential,
      relatedKeywordCount: est.relatedKeywordCount,
      explanation: est.explanation,
      factor,
    };
  });
}

/* ─────────────────────────────────────────────
   Cache helpers (reuse search_cache table, 24h TTL)
   ───────────────────────────────────────────── */

const TP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function tpCacheKey(keyword: string): string {
  return createHash('md5')
    .update(`tp:v1:${keyword.toLowerCase().trim()}`)
    .digest('hex');
}

async function getTPCacheEntry(
  queryHash: string,
): Promise<TrafficPotentialResult | null> {
  const row = await db
    .select({ results: searchCache.results, expiresAt: searchCache.expiresAt })
    .from(searchCache)
    .where(eq(searchCache.queryHash, queryHash))
    .get();

  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    await db.delete(searchCache).where(eq(searchCache.queryHash, queryHash));
    return null;
  }

  try {
    return JSON.parse(row.results);
  } catch {
    return null;
  }
}

async function setTPCacheEntry(
  userId: string,
  queryHash: string,
  result: TrafficPotentialResult,
): Promise<void> {
  const now = Date.now();
  const expiresAt = now + TP_CACHE_TTL_MS;

  const existing = await db
    .select({ id: searchCache.id })
    .from(searchCache)
    .where(eq(searchCache.queryHash, queryHash))
    .get();

  const payload = JSON.stringify(result);

  if (existing) {
    await db
      .update(searchCache)
      .set({ results: payload, expiresAt, createdAt: now })
      .where(eq(searchCache.id, existing.id));
  } else {
    await db.insert(searchCache).values({
      id: randomUUID(),
      userId,
      queryHash,
      results: payload,
      createdAt: now,
      expiresAt,
    });
  }
}

/* ─────────────────────────────────────────────
   SERP-based TP estimation
   ───────────────────────────────────────────── */

async function estimateFromSERP(keyword: string, volume: number | null): Promise<TrafficPotentialResult | null> {
  const now = Date.now();
  const SERP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  const serpRows = await db
    .select()
    .from(serpResults)
    .where(
      and(
        eq(serpResults.keywordText, keyword),
        gt(serpResults.fetchedAt, now - SERP_CACHE_TTL_MS),
      ),
    )
    .orderBy(serpResults.position)
    .all();

  if (!serpRows || serpRows.length === 0) return null;

  // Collect unique top-ranking domains
  const topDomains = new Set<string>();
  for (const row of serpRows) {
    if (row.position <= 5 && row.domain) {
      topDomains.add(row.domain);
    }
  }

  if (topDomains.size === 0) return null;

  // Check if any of these domains have serp_results for OTHER keywords
  // This tells us roughly how many other keywords these domains rank for
  const relatedCounts = await Promise.all(
    [...topDomains].map(async (domain) => {
      const count = await db
        .select()
        .from(serpResults)
        .where(
          and(
            eq(serpResults.domain, domain),
            gt(serpResults.fetchedAt, now - SERP_CACHE_TTL_MS),
          ),
        )
        .all();
      return count.length;
    }),
  );

  const maxRelated = Math.max(...relatedCounts, 0);
  const avgRelated = Math.round(
    relatedCounts.reduce((a, b) => a + b, 0) / relatedCounts.length,
  );

  // Base factor on SERP diversity: more domains and more related keywords = higher TP
  const domainDiversity = topDomains.size; // 1-5
  const relatedKWSignal = Math.min(maxRelated, 50); // cap at 50

  // Heuristic: TP factor = 1.0 + (domainDiversity * 0.15) + (relatedKWSignal / 50 * 0.5)
  const factor =
    1.0 +
    domainDiversity * 0.15 +
    (relatedKWSignal / 50) * 0.5 +
    // Bonus for long-tail keywords (they tend to rank for more variants)
    (keyword.split(' ').length >= 4 ? 0.3 : 0);

  const tp = volume ? Math.round(volume * Math.min(factor, 4.0)) : null;
  const relatedKeywordCount = Math.max(avgRelated, 5);

  return {
    keyword,
    volume,
    trafficPotential: tp,
    relatedKeywordCount,
    explanation: `Estimated from SERP data: top ${topDomains.size} ranking domains average ${avgRelated} related keywords each across the index.`,
    factor: Math.round(factor * 100) / 100,
  };
}

/* ─────────────────────────────────────────────
   Main handler
   ───────────────────────────────────────────── */

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = tpRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request. Provide keywords array with {keyword, volume?} objects (max 50).' },
        { status: 400 },
      );
    }

    const { keywords } = parsed.data;
    if (keywords.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const results: TrafficPotentialResult[] = [];
    const uncached: Array<{ keyword: string; volume: number | null }> = [];

    // Check cache first
    for (const kw of keywords) {
      const kwClean = { keyword: kw.keyword, volume: kw.volume ?? null };
      const hash = tpCacheKey(kwClean.keyword);
      const cached = await getTPCacheEntry(hash);
      if (cached) {
        // Update volume if different from cached
        results.push({
          ...cached,
          volume: kwClean.volume ?? cached.volume,
          trafficPotential: cached.trafficPotential
            ? kwClean.volume && kwClean.volume > 0 && cached.factor
              ? Math.round(kwClean.volume * cached.factor)
              : cached.trafficPotential
            : null,
        });
      } else {
        uncached.push(kwClean);
      }
    }

    // Process uncached keywords
    if (uncached.length > 0) {
      const serpResults: TrafficPotentialResult[] = [];
      const aiKeywords: Array<{ keyword: string; volume: number | null }> = [];

      // Try SERP-based estimation first
      for (const kw of uncached) {
        const serpEstimate = await estimateFromSERP(kw.keyword, kw.volume ?? null);
        if (serpEstimate) {
          serpResults.push(serpEstimate);
        } else {
          aiKeywords.push(kw);
        }
      }

      // Fallback to AI estimation for remaining keywords
      let aiResults: TrafficPotentialResult[] = [];
      if (aiKeywords.length > 0) {
        try {
          aiResults = await estimateWithAI(aiKeywords);
        } catch (err) {
          console.warn('[traffic-potential] AI estimation failed:', err);
          // Return basic estimates for failed keywords
          aiResults = aiKeywords.map((kw) => ({
            keyword: kw.keyword,
            volume: kw.volume ?? null,
            trafficPotential: kw.volume ? Math.round(kw.volume * 1.8) : null,
            relatedKeywordCount: null,
            explanation: 'AI estimation unavailable. Using default multiplier (1.8×).',
            factor: 1.8,
          }));
        }
      }

      const allFresh = [...serpResults, ...aiResults];

      // Cache results
      for (const r of allFresh) {
        const hash = tpCacheKey(r.keyword);
        await setTPCacheEntry(user.id, hash, r).catch((err) => {
          console.warn('[traffic-potential] Cache write failed:', err);
        });
        results.push(r);
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[traffic-potential] Error:', error);
    const message = error instanceof Error ? error.message : 'Traffic potential estimation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
