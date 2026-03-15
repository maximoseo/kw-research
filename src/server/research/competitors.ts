import * as cheerio from 'cheerio';
import { fetchWithTimeout } from './http';

export type CompetitorCandidate = {
  name: string;
  url: string;
  domain: string;
  snippet: string;
};

function normalizeResultUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl, 'https://duckduckgo.com');
    const redirectTarget = url.searchParams.get('uddg');
    if (redirectTarget) {
      return decodeURIComponent(redirectTarget);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function baseDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function discoverCompetitors(params: {
  homepageUrl: string;
  language: 'English' | 'Hebrew';
  market: string;
  suggestedQueries: string[];
}) {
  const ownDomain = baseDomain(params.homepageUrl);
  const queries = params.suggestedQueries.slice(0, 4);
  const results: CompetitorCandidate[] = [];

  for (const query of queries) {
    const response = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      timeoutMs: 15_000,
    }).catch(() => null);

    if (!response?.ok) {
      continue;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    $('a.result__a').each((_index, element) => {
      const href = normalizeResultUrl($(element).attr('href') || '');
      const domain = baseDomain(href);
      if (!href || !domain || domain === ownDomain || results.some((entry) => entry.domain === domain)) {
        return;
      }

      const result = $(element).closest('.result');
      const snippet = result.find('.result__snippet').text().trim();
      results.push({
        name: $(element).text().trim(),
        url: href,
        domain,
        snippet,
      });
    });
  }

  return results.slice(0, 5);
}
