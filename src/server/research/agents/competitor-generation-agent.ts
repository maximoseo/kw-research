import { z } from 'zod';
import { callAiJson } from '../ai';

const generatedCompetitorSchema = z.object({
  domain: z.string().describe('Competitor domain (e.g. example.com)'),
  url: z.string().describe('Full URL of the competitor homepage'),
  name: z.string().describe('Business/brand name'),
  reasoning: z.string().describe('Why this is a real competitor'),
  confidence: z.number().min(0).max(1).describe('Confidence 0-1 this is a genuine competitor'),
  serviceOverlap: z.array(z.string()).describe('Overlapping services/offerings'),
});

export const competitorGenerationSchema = z.object({
  competitors: z.array(generatedCompetitorSchema).describe('AI-generated competitor candidates'),
  searchStrategy: z.string().describe('Brief description of how competitors were identified'),
});

export type GeneratedCompetitors = z.infer<typeof competitorGenerationSchema>;

export async function runCompetitorGenerationAgent(params: {
  siteProfile: {
    businessName: string;
    businessType: string;
    primaryServices: string[];
    serviceArea?: string;
    niche: string;
    city?: string;
    state?: string;
    country?: string;
  };
  market: string;
  language: string;
  existingCompetitorDomains?: string[];
}): Promise<GeneratedCompetitors> {
  const excludeList = params.existingCompetitorDomains?.length
    ? `\n\nDo NOT include these already-known domains: ${params.existingCompetitorDomains.join(', ')}`
    : '';

  return callAiJson({
    system: `You are a Competitor Generation Agent for an SEO research system. Your job is to identify REAL business competitors based on a detailed site profile.

RULES:
- Generate 10-15 competitor candidates to give downstream validation enough to work with
- Only suggest real businesses with real websites that you are confident actually exist
- Focus on businesses that compete for the same customers and search keywords
- For LOCAL/REGIONAL businesses (service area is a specific city, metro, state, or region):
  * Prioritize competitors operating in that SAME geographic area first
  * Include regional players that serve adjacent areas too
  * Do NOT pad the list with national chains unless they genuinely have a local presence
- Every competitor MUST actually offer the same core services as the target — not just be in the same broad industry
- Include reasoning for each competitor explaining exactly what services overlap and why they compete
- Include a mix of direct competitors (same services, same area) and indirect competitors (adjacent services, similar area)
- Never suggest directory sites, social media, marketplaces, news sites, or government sites
- Never suggest the target business itself
- Confidence of 0.7+ means you are highly confident this is a real competing domain
- Confidence below 0.4 means speculative — only include if no better options exist`,
    prompt: `Generate 10-15 competitor candidates for this business:

Business: ${params.siteProfile.businessName}
Type: ${params.siteProfile.businessType}
Services: ${params.siteProfile.primaryServices.join(', ')}
Niche: ${params.siteProfile.niche}
Service Area: ${params.siteProfile.serviceArea || 'Not specified'}
City: ${params.siteProfile.city || 'Not specified'}
State: ${params.siteProfile.state || 'Not specified'}
Country: ${params.siteProfile.country || 'Not specified'}
Market: ${params.market}
Language: ${params.language}${excludeList}

For each candidate, include:
- The specific services they offer that overlap with the target
- Why they are a genuine competitor (not just in the same broad industry)
- Their geographic relevance to the target's service area

Return structured results with confidence scores.`,
    schema: competitorGenerationSchema,
    modelTier: 'opus',
    maxTokens: 4000,
  });
}
