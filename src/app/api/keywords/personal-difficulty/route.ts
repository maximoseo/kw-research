import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { searchCache } from '@/server/db/schema';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getSerpData } from '@/server/research/serp';
import { callAiJson } from '@/server/research/ai';

/* ─────────────────────────────────────────────
   Schema
   ───────────────────────────────────────────── */

const requestSchema = z.object({
  keyword: z.string().min(1, 'keyword is required'),
  domain: z.string().min(1, 'domain is required'),
  projectId: z.string().optional(),
});

const aiResponseSchema = z.object({
  personalDifficulty: z.number().min(0).max(100),
  genericDifficulty: z.number().min(0).max(100),
  explanation: z.string(),
  confidence: z.number().min(0).max(100),
  gapToTop3: z.number().min(0).max(100),
});

const API_RESPONSE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

/* ─────────────────────────────────────────────
   Cache helpers
   ───────────────────────────────────────────── */

function personalDiffHash(keyword: string, domain: string): string {
  return createHash('md5')
    .update(`persdiff:${keyword.toLowerCase().trim()}|${domain.toLowerCase().trim()}`)
    .digest('hex');
}

async function getCachedPersonalDiff(hash: string): Promise<object | null> {
  const row = await db
    .select({ results: searchCache.results, expiresAt: searchCache.expiresAt })
    .from(searchCache)
    .where(eq(searchCache.queryHash, hash))
    .get();

  if (!row || row.expiresAt <= Date.now()) return null;
  try {
    return JSON.parse(row.results);
  } catch {
    return null;
  }
}

async function setCachedPersonalDiff(userId: string, hash: string, data: object): Promise<void> {
  const now = Date.now();
  const expiresAt = now + API_RESPONSE_TTL_MS;

  const existing = await db
    .select({ id: searchCache.id })
    .from(searchCache)
    .where(eq(searchCache.queryHash, hash))
    .get();

  if (existing) {
    await db
      .update(searchCache)
      .set({ results: JSON.stringify(data), expiresAt, createdAt: now })
      .where(eq(searchCache.id, existing.id));
  } else {
    await db.insert(searchCache).values({
      id: randomUUID(),
      userId,
      queryHash: hash,
      results: JSON.stringify(data),
      createdAt: now,
      expiresAt,
    });
  }
}

/* ─────────────────────────────────────────────
   SERP landscape analysis
   ───────────────────────────────────────────── */

interface SerpLandscape {
  uniqueDomains: number;
  highAuthorityCount: number;
  ugcCount: number;
  domainCounts: Record<string, number>;
  serpSummary: string;
  contentDistribution: string;
}

function buildSerpLandscape(
  serpData: Awaited<ReturnType<typeof getSerpData>>,
): SerpLandscape {
  const HIGH_AUTHORITY = new Set([
    'wikipedia.org', 'amazon.com', 'youtube.com', 'facebook.com',
    'linkedin.com', 'nytimes.com', 'forbes.com', 'medium.com',
    'reddit.com', 'quora.com', 'bbc.com', 'cnn.com', 'instagram.com',
    'twitter.com', 'x.com', 'microsoft.com', 'apple.com', 'google.com',
    'nih.gov', 'mayoclinic.org', 'webmd.com', 'healthline.com',
  ]);

  const domainCounts: Record<string, number> = {};
  let highAuthorityCount = 0;
  let ugcCount = 0;

  for (const r of serpData.results) {
    domainCounts[r.domain] = (domainCounts[r.domain] || 0) + 1;

    const isHighAuth =
      HIGH_AUTHORITY.has(r.domain) ||
      r.domain.endsWith('.gov') ||
      r.domain.endsWith('.edu') ||
      [...HIGH_AUTHORITY].some((d) => r.domain.endsWith(`.${d}`));
    if (isHighAuth) highAuthorityCount++;

    if (r.content_type === 'forum' || r.content_type === 'video') {
      ugcCount++;
    }
  }

  const uniqueDomains = Object.keys(domainCounts).length;

  const serpSummary = serpData.results
    .map((r) => `${r.position}. ${r.domain} — "${r.title.slice(0, 80)}" [${r.content_type}]`)
    .join('\n');

  const contentDistribution = serpData.distribution
    .map((d) => `${d.label}: ${d.count}`)
    .join(', ');

  return {
    uniqueDomains,
    highAuthorityCount,
    ugcCount,
    domainCounts,
    serpSummary,
    contentDistribution,
  };
}

/* ─────────────────────────────────────────────
   Fallback heuristic (no AI available)
   ───────────────────────────────────────────── */

function heuristicEstimate(
  landscape: SerpLandscape,
  userDomain: string,
): {
  personalDifficulty: number;
  genericDifficulty: number;
  explanation: string;
  confidence: number;
  gapToTop3: number;
} {
  // Generic difficulty: driven by SERP composition
  let generic = 35;
  generic += landscape.highAuthorityCount * 6;   // each known authority adds difficulty
  generic -= landscape.ugcCount * 5;              // UGC signals easier ranking
  generic += Math.max(0, (6 - landscape.uniqueDomains)) * 4; // low diversity = harder
  generic = Math.max(5, Math.min(95, generic));

  // Personal difficulty: adjust based on user domain strength signals
  const userTld = userDomain.split('.').pop()?.toLowerCase() ?? '';
  const isGovEdu = userTld === 'gov' || userTld === 'edu';
  const isOrg = userTld === 'org';
  const userAppearsInSerp = landscape.domainCounts[userDomain] !== undefined;

  let personal = generic;
  if (userAppearsInSerp) personal -= 20;           // already ranking = advantage
  else if (isGovEdu) personal -= 15;               // high-trust TLD
  else if (isOrg) personal -= 5;                    // moderate trust
  else personal += 5;                               // typical .com competition

  personal = Math.max(0, Math.min(100, personal));

  const gapToTop3 = Math.max(0, Math.round(personal * 0.6));

  const parts: string[] = [];
  if (landscape.highAuthorityCount >= 5) parts.push('high-authority domains dominate');
  if (landscape.ugcCount >= 3) parts.push('UGC content signals opportunity');
  if (landscape.uniqueDomains <= 4) parts.push('few domains control the SERP');
  if (userAppearsInSerp) parts.push('your domain already appears in results');
  if (isGovEdu) parts.push(`.${userTld} domains carry trust signals`);

  return {
    personalDifficulty: personal,
    genericDifficulty: generic,
    explanation:
      parts.length > 0
        ? `Heuristic estimate: ${parts.join('; ')}.`
        : 'Estimated from SERP landscape composition.',
    confidence: 25,
    gapToTop3,
  };
}

/* ─────────────────────────────────────────────
   POST handler
   ───────────────────────────────────────────── */

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 },
    );
  }

  const { keyword, domain } = parsed.data;
  const cacheHash = personalDiffHash(keyword, domain);

  // 1. Check cache (48h)
  const cached = await getCachedPersonalDiff(cacheHash);
  if (cached) {
    return NextResponse.json(cached);
  }

  // 2. Fetch SERP data
  const serpData = await getSerpData(keyword);

  if (!serpData.results.length) {
    const fallback = {
      keyword,
      personalDifficulty: 50,
      genericDifficulty: 50,
      explanation: 'No SERP data available for this keyword.',
      confidence: 5,
      gapToTop3: 0,
    };
    return NextResponse.json(fallback);
  }

  // 3. Build landscape analysis
  const landscape = buildSerpLandscape(serpData);

  // 4. Try Claude analysis
  try {
    const system = `You are an SEO analyst. Estimate personalized keyword difficulty for a specific domain.

Given SERP data and a user's domain, return a JSON object with:
- personalDifficulty (0-100): How hard for THIS specific domain. 0 = trivially easy, 100 = nearly impossible
- genericDifficulty (0-100): How hard for an average/new site
- explanation (string): 1-2 sentences with reasoning
- confidence (0-100): Your confidence in this estimate
- gapToTop3 (0-100): Estimated difficulty gap between user domain and the top 3 results

Consider: authority of ranking domains, content types, domain diversity, whether weak sites rank, and the user domain's characteristics.`;

    const prompt = `Keyword: "${keyword}"
User domain: ${domain}

SERP Top 10:
${landscape.serpSummary}

Domain diversity: ${landscape.uniqueDomains} unique domains / 10 positions
High-authority domains: ${landscape.highAuthorityCount}/10
UGC/forum/video results: ${landscape.ugcCount}/10
Content distribution: ${landscape.contentDistribution}

Estimate personal difficulty for ${domain} to rank for "${keyword}".`;

    const result = await callAiJson({
      schema: aiResponseSchema,
      system,
      prompt,
      maxTokens: 1024,
      modelTier: 'haiku',
    });

    const response = { keyword, ...result };
    await setCachedPersonalDiff(user.id, cacheHash, response);
    return NextResponse.json(response);
  } catch (err) {
    console.warn(
      '[personal-difficulty] AI analysis failed, using heuristic:',
      err instanceof Error ? err.message : err,
    );
  }

  // 5. Fallback heuristic
  const heuristic = heuristicEstimate(landscape, domain);
  const response = { keyword, ...heuristic };
  await setCachedPersonalDiff(user.id, cacheHash, response);
  return NextResponse.json(response);
}
