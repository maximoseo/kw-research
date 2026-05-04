import { NextResponse } from 'next/server';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { getSerpData } from '@/server/research/serp';
import {
  detectSerpFeatures,
  detectOpportunities,
  buildFeaturesSummary,
} from '@/lib/serp-features';
import type { KeywordSerpFeatures, SerpFeaturesResult } from '@/lib/serp-features';

const MAX_KEYWORDS = 50;
const BATCH_SIZE = 5; // Process 5 at a time to avoid rate limiting

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

  if (!body.keywords || !Array.isArray(body.keywords) || body.keywords.length === 0) {
    return NextResponse.json({ error: 'keywords array is required.' }, { status: 400 });
  }

  // Normalize and deduplicate keywords
  const keywords = [...new Set(body.keywords.map((k: string) => k.trim()).filter(Boolean))];
  if (keywords.length > MAX_KEYWORDS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_KEYWORDS} keywords allowed.` },
      { status: 400 },
    );
  }

  const results: KeywordSerpFeatures[] = [];
  const errors: string[] = [];

  // Process in batches
  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    const batch = keywords.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (keyword): Promise<KeywordSerpFeatures> => {
        try {
          const serpData = await getSerpData(keyword);
          const features = detectSerpFeatures(keyword, serpData.results);
          const opportunities = detectOpportunities(keyword, features, serpData.results);

          return {
            keyword,
            features,
            opportunities,
          };
        } catch (err) {
          console.warn(`[serp-features] Error for "${keyword}":`, err instanceof Error ? err.message : err);
          // Return minimal result on error
          return {
            keyword,
            features: [],
            opportunities: [],
          };
        }
      }),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push(result.reason?.message || 'Unknown error');
      }
    }
  }

  const summary = buildFeaturesSummary(results);

  const response: SerpFeaturesResult = { results, summary };

  return NextResponse.json(response);
}
