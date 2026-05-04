import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { callAiJson } from '@/server/research/ai';
import { getCacheEntry, setCacheEntry } from '@/server/research/cache';
import { createHash } from 'crypto';
import { z } from 'zod';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

export interface KeywordCluster {
  name: string;
  keywords: string[];
}

const clustersSchema = z.object({
  clusters: z.array(
    z.object({
      name: z.string().min(1),
      keywords: z.array(z.string().min(1)),
    }),
  ),
});

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function hashKeywordList(keywords: string[]): string {
  const canonical = keywords
    .map((k) => k.toLowerCase().trim())
    .sort()
    .join('\n');
  return createHash('md5').update(`clusters:${canonical}`).digest('hex');
}

const SYSTEM_PROMPT = `You are an SEO keyword research assistant. Group the given keywords into 4-8 logical topic clusters.

Rules:
- Each keyword must appear in exactly one cluster
- Every keyword from the input list must be assigned (no keywords left out)
- Cluster names should be descriptive and concise (2-5 words)
- Group by topic/intent similarity, not alphabetically
- If a group would have only 1 keyword, merge it with the most relevant larger group unless the keyword is truly unique

Return JSON:
{
  "clusters": [
    { "name": "Descriptive Topic Name", "keywords": ["keyword 1", "keyword 2", ...] },
    ...
  ]
}`;

function buildPrompt(keywords: string[]): string {
  const keywordList = keywords.map((k, i) => `${i + 1}. ${k}`).join('\n');
  return `Group these ${keywords.length} keywords into 4-8 logical topic clusters:\n\n${keywordList}\n\nReturn JSON with clusters array.`;
}

/* ─────────────────────────────────────────────
   POST handler
   ───────────────────────────────────────────── */

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request body
  let body: { keywords?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const keywords = body.keywords;
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return NextResponse.json(
      { error: 'keywords array is required and must not be empty.' },
      { status: 400 },
    );
  }

  if (keywords.length > 500) {
    return NextResponse.json(
      { error: 'Maximum 500 keywords per clustering request.' },
      { status: 400 },
    );
  }

  // Normalize keywords
  const normalized = keywords
    .map((k) => String(k).trim())
    .filter((k) => k.length > 0);

  if (normalized.length === 0) {
    return NextResponse.json(
      { error: 'No valid keywords after trimming.' },
      { status: 400 },
    );
  }

  const queryHash = hashKeywordList(normalized);

  // Check cache first
  try {
    const cached = await getCacheEntry(queryHash);
    if (cached) {
      const parsed = clustersSchema.safeParse(JSON.parse(cached));
      if (parsed.success) {
        // Validate that all input keywords are present in the cached result
        const cachedKeywords = new Set(
          parsed.data.clusters.flatMap((c) => c.keywords.map((k) => k.toLowerCase().trim())),
        );
        const allPresent = normalized.every((k) =>
          cachedKeywords.has(k.toLowerCase().trim()),
        );
        if (allPresent) {
          return NextResponse.json({ clusters: parsed.data.clusters, cached: true });
        }
      }
    }
  } catch {
    // Cache miss or corrupt — proceed to AI
  }

  // Generate via Claude AI
  try {
    const result = await callAiJson({
      schema: clustersSchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(normalized),
      maxTokens: 4096,
      modelTier: 'sonnet',
    });

    // Cache the result for 24h
    try {
      await setCacheEntry(user.id, queryHash, JSON.stringify(result));
    } catch {
      // Non-critical if caching fails
    }

    return NextResponse.json({ clusters: result.clusters, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate clusters';
    console.error('[POST /api/keywords/cluster] AI error:', message);

    return NextResponse.json(
      { error: 'AI service unavailable. Please check your API configuration and try again.' },
      { status: 503 },
    );
  }
}
