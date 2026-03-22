import { z } from 'zod';
import { callAiJson } from '../ai';

export const qualityJudgmentSchema = z.object({
  overallScore: z.number().min(0).max(10).describe('Overall quality score 0-10'),
  competitorQuality: z.enum(['excellent', 'good', 'acceptable', 'poor', 'failed']),
  shouldRetry: z.boolean().describe('Should the system retry with different approach?'),
  issues: z.array(z.string()).describe('List of quality issues found'),
  recommendations: z.array(z.string()).describe('Recommendations for improvement'),
  passesQualityGate: z.boolean().describe('Does this output meet minimum quality standards?'),
});

export type QualityJudgment = z.infer<typeof qualityJudgmentSchema>;

export async function runJudgeAgent(params: {
  siteProfile: { businessName: string; businessType: string; niche: string; serviceArea?: string };
  competitors: Array<{ url: string; confidence: number; isRelevant: boolean }>;
  totalCandidatesBeforeFiltering: number;
}): Promise<QualityJudgment> {
  const relevantCount = params.competitors.filter((c) => c.isRelevant).length;
  const highConfCount = params.competitors.filter((c) => c.confidence >= 0.7).length;

  // Check source diversity: count unique sources across competitors
  const uniqueDomains = new Set(params.competitors.map((c) => {
    try { return new URL(c.url).hostname.replace(/^www\./, ''); } catch { return c.url; }
  }));

  return callAiJson({
    system: `You are a strict Quality Control Judge for a competitor discovery system. Your job is to assess whether the discovery results are good enough to show to the user. Apply these hard rules BEFORE your subjective assessment:

HARD RULES (override your subjective judgment):
1. MINIMUM 3 relevant competitors required to pass the quality gate. If fewer than 3 are relevant, set passesQualityGate=false and shouldRetry=true.
2. If fewer than 3 HIGH-CONFIDENCE competitors (confidence ≥ 0.7), set shouldRetry=true even if passesQualityGate might be true — we need more signal.
3. SOURCE DIVERSITY matters: if all relevant competitors come from the same discovery source (e.g. all from ai-generation or all from a single search query), penalize the score by 2 points — the system needs breadth.
4. All competitors should be in the same niche as the target business.
5. Geographic relevance matters for local businesses.

QUALITY TIERS:
- "excellent": ≥ 5 relevant competitors, ≥ 3 high-confidence, good diversity
- "good": ≥ 3 relevant competitors, ≥ 2 high-confidence
- "acceptable": 3 relevant competitors with moderate confidence
- "poor": 2 relevant competitors (shouldRetry=true)
- "failed": 0-1 relevant competitors (shouldRetry=true)`,
    prompt: `Target: ${params.siteProfile.businessName} (${params.siteProfile.businessType}, ${params.siteProfile.niche})
Service Area: ${params.siteProfile.serviceArea || 'Not specified'}

Discovery Results:
- Total candidates before filtering: ${params.totalCandidatesBeforeFiltering}
- Validated competitors: ${params.competitors.length}
- Relevant: ${relevantCount}
- High confidence (>0.7): ${highConfCount}
- Unique domains: ${uniqueDomains.size}

Competitor details:
${params.competitors.map((c, i) => `${i + 1}. ${c.url} — relevant: ${c.isRelevant}, confidence: ${c.confidence}`).join('\n')}

Apply the hard rules first, then assess overall quality and whether this should be shown to the user or retried.`,
    schema: qualityJudgmentSchema,
    modelTier: 'sonnet',
    maxTokens: 2000,
  });
}
