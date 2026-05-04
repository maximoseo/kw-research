import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { callAiJson } from '@/server/research/ai';

const enrichRequestSchema = z.object({
  keywords: z.array(z.string()).max(50),
  projectId: z.string().optional(),
});

const enrichResponseSchema = z.object({
  enriched: z.array(
    z.object({
      keyword: z.string(),
      searchVolume: z.number().nullable().optional(),
      difficulty: z.number().nullable().optional(),
      confidence: z.enum(['high', 'medium', 'low']).optional(),
    }),
  ),
});

type EnrichResponse = z.infer<typeof enrichResponseSchema>;

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = enrichRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request. Provide keywords array (max 50).' },
        { status: 400 },
      );
    }

    const { keywords } = parsed.data;

    if (keywords.length === 0) {
      return NextResponse.json({ enriched: [] });
    }

    const result = await callAiJson<EnrichResponse>({
      schema: enrichResponseSchema,
      system: `You are a keyword data enrichment assistant. Your job is to estimate SEO metrics for keywords.

For each keyword, estimate:
- searchVolume: monthly search volume (integer, realistic based on keyword broadness)
- difficulty: SEO difficulty score from 0-100 (0=easy, 100=extremely competitive)
- confidence: how confident your estimates are (high/medium/low)

Be realistic. Use your knowledge of SEO trends and search behavior. Do not inflate numbers.
Return valid JSON only — no prose before or after.`,
      prompt: JSON.stringify({
        task: 'Estimate monthly search volume and SEO difficulty (0-100) for these keywords.',
        keywords,
        instructions: [
          'Estimate realistic searchVolume (monthly searches) for each keyword.',
          'Estimate difficulty 0-100 (higher = more competitive).',
          'Very broad terms (e.g. "marketing") = high volume, high difficulty.',
          'Long-tail specific terms = lower volume, lower difficulty.',
          'Commercial/buying intent terms = medium-high difficulty.',
          'Informational terms = variable difficulty.',
          'Return valid JSON array in "enriched" field.',
        ].join('\n'),
      }),
      modelTier: 'haiku',
      maxTokens: 4096,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[keywords] Enrich error:', error);
    const message = error instanceof Error ? error.message : 'Enrichment failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
