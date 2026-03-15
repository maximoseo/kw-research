import { createResearchSchema, type CreateResearchInput } from '@/lib/validation';
import { fetchWithTimeout } from './http';

async function validateReachableUrl(url: string, label: string) {
  try {
    const response = await fetchWithTimeout(url, { timeoutMs: 12_000 });
    if (!response.ok) {
      return `${label} returned HTTP ${response.status}.`;
    }

    return null;
  } catch (error) {
    return `${label} could not be fetched. ${error instanceof Error ? error.message : ''}`.trim();
  }
}

export async function validateResearchSources(input: CreateResearchInput) {
  const issues = await Promise.all([
    validateReachableUrl(input.homepageUrl, 'Homepage URL'),
    validateReachableUrl(input.aboutUrl, 'About page URL'),
    validateReachableUrl(input.sitemapUrl, 'Sitemap URL'),
  ]);

  const sitemapCheck = issues[2];
  if (!sitemapCheck) {
    try {
      const response = await fetchWithTimeout(input.sitemapUrl, { timeoutMs: 12_000 });
      const contentType = response.headers.get('content-type') || '';
      const body = (await response.text()).slice(0, 800);
      if (!/(xml|text\/plain|application\/gzip)/i.test(contentType) && !/<(urlset|sitemapindex)/i.test(body)) {
        issues[2] = 'Sitemap URL is reachable, but it did not look like a sitemap XML document.';
      }
    } catch {
      // Ignore secondary verification failures because the primary fetch already passed.
    }
  }

  return issues.filter(Boolean) as string[];
}

export function parseResearchInput(payload: Record<string, FormDataEntryValue | null>) {
  return createResearchSchema.safeParse({
    homepageUrl: payload.homepageUrl,
    aboutUrl: payload.aboutUrl,
    sitemapUrl: payload.sitemapUrl,
    brandName: payload.brandName,
    language: payload.language,
    market: payload.market,
    competitorUrls: payload.competitorUrls,
    notes: payload.notes,
    mode: payload.mode,
    targetRows: payload.targetRows,
  });
}
