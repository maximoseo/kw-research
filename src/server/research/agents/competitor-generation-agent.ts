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
- Only suggest real businesses with real websites that you are confident actually exist
- Focus on businesses that compete for the same customers and search keywords
- Prioritize same-geographic-area competitors for local businesses
- Include a mix of direct competitors (same services) and indirect competitors (adjacent services)
- Never suggest directory sites, social media, marketplaces, news sites, or government sites
- Never suggest the target business itself
- Confidence of 0.7+ means you are highly confident this is a real competing domain
- Confidence below 0.4 means speculative — only include if no better options exist
- Aim for 5-10 high-quality competitors`,
    prompt: `Generate competitor candidates for this business:

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

Identify real business competitors that serve similar customers and would compete for the same SEO keywords. Return structured results with confidence scores.`,
    schema: competitorGenerationSchema,
    modelTier: 'opus',
    maxTokens: 4000,
  });
}
