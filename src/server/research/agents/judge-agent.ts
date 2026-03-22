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

  return callAiJson({
    system: `You are a Quality Control Judge for a competitor discovery system. Your job is to assess whether the discovery results are good enough to show to the user.

Quality criteria:
- At least 3 relevant competitors found for "good" quality
- At least 5 relevant competitors found for "excellent" quality
- High confidence scores (>0.7) on at least half the results for "good" quality
- All competitors should be in the same niche as the target business
- Geographic relevance matters for local businesses

If quality is "poor" or "failed", set shouldRetry=true so the system can try alternative approaches.
If fewer than 2 relevant competitors, this is "failed".
If 2-3 relevant competitors with decent confidence, this is "acceptable".`,
    prompt: `Target: ${params.siteProfile.businessName} (${params.siteProfile.businessType}, ${params.siteProfile.niche})
Service Area: ${params.siteProfile.serviceArea || 'Not specified'}

Discovery Results:
- Total candidates before filtering: ${params.totalCandidatesBeforeFiltering}
- Validated competitors: ${params.competitors.length}
- Relevant: ${relevantCount}
- High confidence (>0.7): ${highConfCount}

Competitor details:
${params.competitors.map((c, i) => `${i + 1}. ${c.url} — relevant: ${c.isRelevant}, confidence: ${c.confidence}`).join('\n')}

Assess overall quality and whether this should be shown to the user or retried.`,
    schema: qualityJudgmentSchema,
    modelTier: 'sonnet',
    maxTokens: 2000,
  });
}
