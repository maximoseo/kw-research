import { z } from 'zod';
import { callAiJson } from '../ai';

const validatedCompetitorSchema = z.object({
  url: z.string(),
  domain: z.string(),
  isRelevant: z.boolean().describe('Is this a real business competitor in the same niche?'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  relevanceScore: z.number().min(0).max(1).describe('Composite relevance score: avg of businessTypeScore, serviceOverlapScore, geoOverlapScore, intentOverlapScore'),
  businessTypeMatch: z.boolean().describe('Same type of business?'),
  businessTypeScore: z.number().min(0).max(1).describe('How closely the business type matches (0-1)'),
  serviceOverlap: z.boolean().describe('Offers similar services?'),
  serviceOverlapScore: z.number().min(0).max(1).describe('Degree of service overlap (0-1)'),
  geoRelevance: z.boolean().describe('Serves same geographic area?'),
  geoOverlapScore: z.number().min(0).max(1).describe('Degree of geographic overlap (0-1)'),
  intentOverlapScore: z.number().min(0).max(1).describe('How much search intent overlaps (0-1)'),
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
    system: `You are a strict Competitor Validation Agent. Your job is to validate whether candidate competitor domains are REAL business competitors of the target site. Be aggressive about rejecting non-competitors.

HARD REJECT (isRelevant=false, relevanceScore ≤ 0.1) — these are NEVER competitors:
- Directory / aggregator / listing sites (Yelp, Yellow Pages, G2, Capterra, Angi, HomeAdvisor, Thumbtack, Houzz, Bark, etc.)
- Social media profiles or pages (LinkedIn, Facebook, Twitter/X, Instagram, YouTube, TikTok, Pinterest)
- Marketplaces (Amazon, eBay, Etsy, Walmart, Alibaba)
- News / media / blog platforms (Forbes, Bloomberg, CNN, Medium, Substack)
- User-generated content sites (Wikipedia, Quora, Reddit, WikiHow)
- Government (.gov) or educational (.edu) sites
- The target business's own domain or subdomains
- Job boards (Indeed, Glassdoor)
- Review sites (Trustpilot, BBB)

REJECT (isRelevant=false, relevanceScore ≤ 0.2):
- Businesses in a completely different industry with no service overlap
- National or global brands that do NOT serve the same local market and have no evidence of operating in the target's service area
- Businesses that share an industry label but provide fundamentally different services (e.g. a software company vs a plumbing company both labeled "tech")

REQUIRE to accept (isRelevant=true):
- There must be evidence of SAME-SERVICE overlap (not just same broad industry)
- For local businesses: candidate must plausibly serve the same geographic area
- Candidate must target the same customer segment

SCORING — compute four sub-scores and average them for relevanceScore:
- businessTypeScore (0-1): How closely the business type/model matches
- serviceOverlapScore (0-1): Degree of overlap in actual services offered
- geoOverlapScore (0-1): Degree of geographic overlap (1.0 = same city, 0.5 = same state/region, 0.2 = same country only, 0.0 = no overlap)
- intentOverlapScore (0-1): Would they compete for the same search keywords?

Confidence scoring (separate from relevanceScore):
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
