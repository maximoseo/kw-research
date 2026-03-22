import { z } from 'zod';
import { callAiJson } from '../ai';

const serpIntentScoreSchema = z.object({
  domain: z.string(),
  url: z.string(),
  intentOverlapScore: z.number().min(0).max(1).describe('How much search intent overlaps with target (0-1)'),
  sharedKeywordThemes: z.array(z.string()).describe('Keyword themes both businesses would target'),
  competitiveIntensity: z.enum(['high', 'medium', 'low']).describe('How directly they compete in search'),
  reasoning: z.string(),
});

export const serpIntentAnalysisSchema = z.object({
  scoredCompetitors: z.array(serpIntentScoreSchema),
  topKeywordThemes: z.array(z.string()).describe('Most contested keyword themes across all competitors'),
});

export type SerpIntentAnalysis = z.infer<typeof serpIntentAnalysisSchema>;

export async function runSerpIntentAgent(params: {
  targetBusiness: {
    businessName: string;
    businessType: string;
    primaryServices: string[];
    serviceArea?: string;
    niche: string;
  };
  competitors: Array<{ url: string; domain: string; name: string; snippet?: string }>;
  market: string;
  language: string;
}): Promise<SerpIntentAnalysis> {
  const competitorList = params.competitors
    .map((c, i) => `${i + 1}. ${c.name} — ${c.domain} (${c.url})\n   ${c.snippet || ''}`)
    .join('\n');

  return callAiJson({
    system: `You are a SERP Intent Similarity Agent. Your job is to assess how much search engine keyword overlap exists between a target business and each competitor candidate.

Think about:
- What keywords would each business target?
- Do they serve the same search intent (informational, commercial, transactional, navigational)?
- Would they appear on the same search results pages?
- Are they competing for the same local keywords?

Score intent overlap from 0 (no overlap) to 1 (identical keyword targets).
"high" competitive intensity means they directly fight for the same search terms.`,
    prompt: `Target Business:
Name: ${params.targetBusiness.businessName}
Type: ${params.targetBusiness.businessType}
Services: ${params.targetBusiness.primaryServices.join(', ')}
Service Area: ${params.targetBusiness.serviceArea || 'Not specified'}
Niche: ${params.targetBusiness.niche}
Market: ${params.market}
Language: ${params.language}

Competitor Candidates:
${competitorList || '(none)'}

Assess search intent overlap for each competitor.`,
    schema: serpIntentAnalysisSchema,
    modelTier: 'sonnet',
    maxTokens: 4000,
  });
}
