import { z } from 'zod';
import { callAiJson } from '../ai';

const validatedCompetitorSchema = z.object({
  url: z.string(),
  domain: z.string(),
  isRelevant: z.boolean().describe('Is this a real business competitor in the same niche?'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  businessTypeMatch: z.boolean().describe('Same type of business?'),
  serviceOverlap: z.boolean().describe('Offers similar services?'),
  geoRelevance: z.boolean().describe('Serves same geographic area?'),
  reasoning: z.string().describe('Brief reasoning for this assessment'),
});

export const competitorValidationSchema = z.object({
  validatedCompetitors: z.array(validatedCompetitorSchema),
  overallQuality: z.enum(['strong', 'moderate', 'weak', 'insufficient']),
  summary: z.string(),
});

export type CompetitorValidationResult = z.infer<typeof competitorValidationSchema>;

export async function runCompetitorValidationAgent(params: {
  siteProfile: {
    businessName: string;
    businessType: string;
    primaryServices: string[];
    serviceArea?: string;
    niche: string;
  };
  candidates: Array<{ url: string; domain: string; name: string; snippet: string }>;
}): Promise<CompetitorValidationResult> {
  const candidateText = params.candidates
    .map((c, i) => `${i + 1}. ${c.name} — ${c.url}\n   Domain: ${c.domain}\n   Snippet: ${c.snippet}`)
    .join('\n');

  return callAiJson({
    system: `You are a Competitor Validation Agent. Your job is to validate whether candidate competitor domains are REAL business competitors of the target site.

REJECT these types of results:
- Directory sites (Yelp, Yellow Pages, G2, Capterra, etc.)
- Social media platforms (LinkedIn, Facebook, Twitter, etc.)
- Marketplaces (Amazon, eBay, Etsy, etc.)
- News/media sites (Forbes, Bloomberg, CNN, etc.)
- Wikipedia, Quora, Reddit, Medium, or other content platforms
- Government (.gov) or educational (.edu) sites
- The target business's own domain or subdomains
- Businesses in completely different industries
- Generic national brands with no local/service overlap

ACCEPT competitors that:
- Offer the same or very similar services
- Serve the same geographic area (if local)
- Target the same customer segments
- Would compete for the same search keywords

Score confidence from 0 to 1, where:
- 0.8-1.0: Strong competitor (same niche, same area, same services)
- 0.5-0.8: Moderate competitor (some overlap)
- 0.2-0.5: Weak competitor (tangential overlap)
- 0.0-0.2: Not a competitor (reject)`,
    prompt: `Target Business:
Name: ${params.siteProfile.businessName}
Type: ${params.siteProfile.businessType}
Services: ${params.siteProfile.primaryServices.join(', ')}
Service Area: ${params.siteProfile.serviceArea || 'Not specified'}
Niche: ${params.siteProfile.niche}

Candidate Competitors:
${candidateText || '(no candidates)'}

Validate each candidate and assess overall quality.`,
    schema: competitorValidationSchema,
    modelTier: 'sonnet',
    maxTokens: 4000,
  });
}
