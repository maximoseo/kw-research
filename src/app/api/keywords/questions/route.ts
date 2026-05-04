import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { callAiJson } from '@/server/research/ai';
import { getCacheEntry, setCacheEntry } from '@/server/research/cache';
import { createHash } from 'crypto';
import { z } from 'zod';

export interface QuestionResult {
  question: string;
  estimatedVolume: 'high' | 'medium' | 'low';
}

const questionsSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      estimatedVolume: z.enum(['high', 'medium', 'low']),
    }),
  ),
});

function hashKeyword(keyword: string): string {
  const canonical = `questions:${keyword.toLowerCase().trim()}`;
  return createHash('md5').update(canonical).digest('hex');
}

const SYSTEM_PROMPT = `You are an SEO keyword research assistant. Generate 15-20 common real search questions related to the given keyword.

These should be actual questions people type into Google search. Include who/what/when/where/why/how questions as well as comparison and list-based queries (e.g., "best X for Y", "X vs Y").

For each question, estimate the search volume tier:
- "high": very commonly searched (top 20% of questions on this topic)
- "medium": moderately searched
- "low": niche or long-tail

Return a JSON object with a "questions" array. Each item has "question" (string) and "estimatedVolume" ("high" | "medium" | "low").

Distribute volumes naturally: ~20% high, ~40% medium, ~40% low.`;

function buildPrompt(keyword: string): string {
  return `Generate 15-20 common real search questions related to "${keyword}". Include who/what/when/where/why/how questions. People ask these in Google. Include different angles and intents. Return as JSON.`;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  if (!keyword || !keyword.trim()) {
    return NextResponse.json({ error: 'keyword is required.' }, { status: 400 });
  }

  const trimmedKeyword = keyword.trim();
  const queryHash = hashKeyword(trimmedKeyword);

  // Check cache first
  try {
    const cached = await getCacheEntry(queryHash);
    if (cached) {
      const parsed = questionsSchema.safeParse(JSON.parse(cached));
      if (parsed.success) {
        return NextResponse.json({ questions: parsed.data.questions, cached: true });
      }
    }
  } catch {
    // Cache miss or corrupt — proceed to AI
  }

  // Generate via Claude AI
  try {
    const result = await callAiJson({
      schema: questionsSchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(trimmedKeyword),
      maxTokens: 2048,
      modelTier: 'haiku',
    });

    // Cache the result for 24h
    try {
      await setCacheEntry(user.id, queryHash, JSON.stringify(result));
    } catch {
      // Non-critical if caching fails
    }

    return NextResponse.json({ questions: result.questions, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate questions';
    console.error('[GET /api/keywords/questions] AI error:', message);

    // Return a helpful error instead of crashing
    return NextResponse.json(
      { error: 'AI service unavailable. Please check your API configuration and try again.' },
      { status: 503 },
    );
  }
}
