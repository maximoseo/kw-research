import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getDb } from '@/server/db/client';
import { searchCache } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { ResearchIntent } from '@/lib/research';
import { callAiJson } from '@/server/research/ai';
import { z } from 'zod';
import crypto from 'crypto';

const BATCH_SIZE = 50;

const classifySchema = z.object({
  results: z.array(
    z.object({
      keyword: z.string(),
      intent: z.enum(['Informational', 'Commercial', 'Transactional', 'Navigational']),
    })
  ),
});

function hashKeyword(keyword: string): string {
  return crypto
    .createHash('sha256')
    .update(`intent:${keyword.trim().toLowerCase()}:v1`)
    .digest('hex');
}

interface IntentCacheEntry {
  keyword: string;
  intent: ResearchIntent;
}

async function getCachedIntents(
  userId: string,
  keywords: string[],
): Promise<{ cached: Map<string, ResearchIntent>; uncached: string[] }> {
  const db = getDb();
  const hashes = keywords.map((kw) => hashKeyword(kw));
  const cached = new Map<string, ResearchIntent>();

  // Query in batches to avoid SQLite limits
  const BATCH = 100;
  for (let i = 0; i < hashes.length; i += BATCH) {
    const batch = hashes.slice(i, i + BATCH);
    const rows = await db
      .select({ queryHash: searchCache.queryHash, results: searchCache.results })
      .from(searchCache)
      .where(and(eq(searchCache.userId, userId), ...batch.map((h) => eq(searchCache.queryHash, h))))
      .all();

    for (const row of rows) {
      try {
        const entry = JSON.parse(row.results) as IntentCacheEntry;
        if (entry.intent) {
          cached.set(entry.keyword, entry.intent);
        }
      } catch {
        // Ignore malformed cache entries
      }
    }
  }

  const uncached = keywords.filter((kw) => !cached.has(kw));
  return { cached, uncached };
}

async function cacheIntents(
  userId: string,
  results: Array<{ keyword: string; intent: ResearchIntent }>,
): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

  for (const r of results) {
    try {
      const hash = hashKeyword(r.keyword);
      // Check if entry already exists
      const existing = await db
        .select({ id: searchCache.id })
        .from(searchCache)
        .where(
          and(eq(searchCache.queryHash, hash), eq(searchCache.userId, userId)),
        )
        .get();

      if (existing) {
        await db
          .update(searchCache)
          .set({
            results: JSON.stringify({ keyword: r.keyword, intent: r.intent } satisfies IntentCacheEntry),
            expiresAt,
          })
          .where(eq(searchCache.id, existing.id))
          .run();
      } else {
        await db
          .insert(searchCache)
          .values({
            id: crypto.randomUUID(),
            userId,
            queryHash: hash,
            results: JSON.stringify({ keyword: r.keyword, intent: r.intent } satisfies IntentCacheEntry),
            createdAt: now,
            expiresAt,
          })
          .run();
      }
    } catch {
      // Skip cache write errors — classification result is still returned
    }
  }
}

async function classifyBatch(keywords: string[]): Promise<Array<{ keyword: string; intent: ResearchIntent }>> {
  const prompt = `Classify the search intent of each keyword below into one of four categories:

- Informational: The user wants to learn something, find information, or get answers to questions. (e.g., "how to", "what is", "guide", "tutorial", "benefits of", "why")
- Commercial: The user is researching options before making a purchase decision — comparing products, reading reviews, or evaluating solutions. (e.g., "best", "vs", "review", "top", "comparison", "alternatives")
- Transactional: The user intends to complete a specific action — buy, sign up, download, or get pricing. (e.g., "buy", "price", "discount", "free trial", "sign up", "download", "cheap")
- Navigational: The user wants to reach a specific website, brand, or page. (e.g., "login", brand names, product names + website, "support", "contact")

Keywords:
${keywords.map((kw, i) => `${i + 1}. ${kw}`).join('\n')}

Return ONLY a JSON array with objects containing "keyword" (original keyword text) and "intent" (one of: Informational, Commercial, Transactional, Navigational) for every keyword.`;

  const result = await callAiJson({
    schema: classifySchema,
    system: 'You are a search intent classifier. Classify each keyword into exactly one of four intents: Informational, Commercial, Transactional, or Navigational. Be precise and consistent.',
    prompt,
    maxTokens: 4096,
    modelTier: 'haiku',
  });

  return result.results.map((r: { keyword: string; intent: string }) => ({
    keyword: r.keyword,
    intent: r.intent as ResearchIntent,
  }));
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { keywords: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.keywords || !Array.isArray(body.keywords)) {
    return NextResponse.json(
      { error: 'keywords must be a non-empty array of strings' },
      { status: 400 },
    );
  }

  const keywords = body.keywords
    .filter((kw: unknown) => typeof kw === 'string' && kw.trim().length > 0)
    .map((kw: string) => kw.trim());

  if (keywords.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // Check cache first
  const { cached, uncached } = await getCachedIntents(user.id, keywords);

  const results: Array<{ keyword: string; intent: string }> = [];

  // Add cached results
  for (const kw of keywords) {
    const intent = cached.get(kw);
    if (intent) {
      results.push({ keyword: kw, intent });
    }
  }

  // Classify uncached keywords in batches
  if (uncached.length > 0) {
    const newResults: Array<{ keyword: string; intent: ResearchIntent }> = [];

    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
      const batch = uncached.slice(i, i + BATCH_SIZE);
      try {
        const classified = await classifyBatch(batch);
        newResults.push(...classified);
        results.push(...classified);
      } catch (error) {
        return NextResponse.json(
          {
            error:
              'Intent classification failed. Ensure ANTHROPIC_API_KEY is configured, then try again.',
            detail: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 502 },
        );
      }
    }

    // Cache the new results (fire-and-forget pattern, don't block response)
    cacheIntents(user.id, newResults).catch(() => {});
  }

  return NextResponse.json({ results });
}
