import { z } from 'zod';
import { callAiJson } from '../ai';

export const siteProfileSchema = z.object({
  businessName: z.string().describe('Company or business name'),
  businessType: z.string().describe('Type: local service, SaaS, ecommerce, agency, etc.'),
  primaryServices: z.array(z.string()).describe('Main services/products offered'),
  serviceArea: z.string().optional().describe('Geographic service area if applicable'),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  language: z.string().describe('Primary language of the site'),
  niche: z.string().describe('Business niche/industry'),
  targetAudience: z.string().optional().describe('Who they serve'),
  uniqueSellingPoints: z.array(z.string()).optional().describe('Key differentiators'),
});

export type SiteProfile = z.infer<typeof siteProfileSchema>;

export async function runSiteProfileAgent(params: {
  homepage: string;
  pageEvidence: Array<{ url: string; title: string; headings: string[]; snippet: string }>;
}): Promise<SiteProfile> {
  const evidenceText = params.pageEvidence
    .map((p) => `URL: ${p.url}\nTitle: ${p.title}\nHeadings: ${p.headings.join(', ')}\nSnippet: ${p.snippet}`)
    .join('\n---\n');

  return callAiJson({
    system: `You are a Site Profile Discovery Agent. Your job is to extract a structured business profile from website evidence. Be precise and factual — only report what you can confidently determine from the evidence. If something is unclear, say "unknown" rather than guessing.`,
    prompt: `Analyze this website and extract its business profile.

Homepage: ${params.homepage}

Page Evidence:
${evidenceText || '(no page evidence available — infer from the homepage URL only)'}

Extract the business profile with all available details.`,
    schema: siteProfileSchema,
    modelTier: 'sonnet',
    maxTokens: 2000,
  });
}
