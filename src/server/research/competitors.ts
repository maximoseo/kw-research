import * as cheerio from 'cheerio';
import { fetchWithTimeout } from './http';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompetitorCandidate = {
  name: string;
  url: string;
  domain: string;
  snippet: string;
  confidence: number;
  sources: string[]; // which queries found it
};

export type DiscoveryDiagnostics = {
  queriesAttempted: number;
  queriesSucceeded: number;
  queriesFailed: number;
  totalRawResults: number;
  filteredByBlocklist: number;
  filteredByOwnDomain: number;
  retries: number;
};

export type DiscoveryResult = {
  candidates: CompetitorCandidate[];
  diagnostics: DiscoveryDiagnostics;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLOCKED_DOMAINS = new Set([
  'yelp.com', 'yellowpages.com', 'indeed.com', 'glassdoor.com', 'g2.com', 'capterra.com',
  'trustpilot.com', 'bbb.org', 'facebook.com', 'linkedin.com', 'twitter.com', 'x.com',
  'instagram.com', 'youtube.com', 'tiktok.com', 'pinterest.com', 'reddit.com',
  'wikipedia.org', 'wikihow.com', 'quora.com', 'medium.com',
  'amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'alibaba.com',
  'craigslist.org', 'nextdoor.com', 'angi.com', 'angieslist.com', 'homeadvisor.com',
  'thumbtack.com', 'bark.com', 'houzz.com',
  'nytimes.com', 'cnn.com', 'bbc.com', 'forbes.com', 'bloomberg.com',
]);

const BLOCKED_TLDS = ['.gov', '.edu', '.mil'];

/** CSS selectors tried in order — first one that yields results wins. */
const RESULT_SELECTORS = [
  'a.result__a',
  '.result__title a',
  '.links_main a',
  'a[data-testid="result-title-a"]',
  '.web-result a.result-title',
];

const COMMON_SUBDOMAINS = new Set([
  'www', 'www2', 'www3', 'm', 'mobile', 'en', 'blog', 'shop', 'store', 'app',
]);

const MAX_QUERIES = 6;
const MAX_RESULTS_PER_QUERY = 8;
const MAX_FINAL_RESULTS = 15;
const MAX_RETRIES = 2;
const RETRY_BACKOFFS_MS = [1_000, 3_000];
const RATE_LIMIT_BACKOFF_MS = 5_000;

// ---------------------------------------------------------------------------
// Helpers — domain handling
// ---------------------------------------------------------------------------

function normalizeDomain(hostname: string): string {
  let domain = hostname.toLowerCase().replace(/:\d+$/, '');
  const firstLabel = domain.split('.')[0];
  if (COMMON_SUBDOMAINS.has(firstLabel)) {
    domain = domain.slice(firstLabel.length + 1);
  }
  return domain;
}

function isBlockedDomain(domain: string): boolean {
  if (BLOCKED_DOMAINS.has(domain)) return true;
  for (const blocked of BLOCKED_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }
  for (const tld of BLOCKED_TLDS) {
    if (domain.endsWith(tld)) return true;
  }
  return false;
}

function isSubdomainOf(candidate: string, parent: string): boolean {
  return candidate === parent || candidate.endsWith(`.${parent}`);
}

// ---------------------------------------------------------------------------
// Helpers — URL handling
// ---------------------------------------------------------------------------

function normalizeResultUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, 'https://duckduckgo.com');
    const redirectTarget = url.searchParams.get('uddg');
    if (redirectTarget) {
      const decoded = decodeURIComponent(redirectTarget);
      new URL(decoded); // validate
      return decoded;
    }
    url.hash = '';
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function extractDomain(url: string): string {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Helpers — fetch with retry & backoff
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: { timeoutMs: number },
): Promise<{ response: Response | null; retries: number }> {
  let retries = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          console.warn(
            `[competitors] Rate limited (429), backing off ${RATE_LIMIT_BACKOFF_MS}ms before retry ${attempt + 1}`,
          );
          await sleep(RATE_LIMIT_BACKOFF_MS);
          retries++;
          continue;
        }
        console.warn('[competitors] Rate limited (429), exhausted retries');
        return { response: null, retries };
      }

      if (!response.ok) {
        if (attempt < MAX_RETRIES) {
          const backoff = RETRY_BACKOFFS_MS[attempt] ?? RETRY_BACKOFFS_MS.at(-1)!;
          console.warn(
            `[competitors] HTTP ${response.status}, retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
          );
          await sleep(backoff);
          retries++;
          continue;
        }
        console.warn(`[competitors] HTTP ${response.status}, exhausted retries`);
        return { response: null, retries };
      }

      return { response, retries };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (attempt < MAX_RETRIES) {
        const backoff = RETRY_BACKOFFS_MS[attempt] ?? RETRY_BACKOFFS_MS.at(-1)!;
        console.warn(
          `[competitors] Fetch error (attempt ${attempt + 1}/${MAX_RETRIES}): ${msg}. Retrying in ${backoff}ms`,
        );
        await sleep(backoff);
        retries++;
        continue;
      }
      console.warn(`[competitors] Fetch failed after ${MAX_RETRIES} retries: ${msg}`);
      return { response: null, retries };
    }
  }

  return { response: null, retries };
}

// ---------------------------------------------------------------------------
// Helpers — HTML parsing
// ---------------------------------------------------------------------------

function extractResultsFromHtml(
  html: string,
  maxResults: number,
): Array<{ name: string; href: string; snippet: string }> {
  const $ = cheerio.load(html);
  const results: Array<{ name: string; href: string; snippet: string }> = [];

  for (const selector of RESULT_SELECTORS) {
    const elements = $(selector);
    if (elements.length === 0) continue;

    elements.each((_index, element) => {
      if (results.length >= maxResults) return false;

      const href = normalizeResultUrl($(element).attr('href') || '');
      if (!href || href === '#') return;

      const name = $(element).text().trim();
      const container = $(element).closest('.result, .web-result, [data-testid="web-result"]');
      const snippet = container
        .find('.result__snippet, .result-snippet, [data-testid="result-snippet"]')
        .text()
        .trim();

      results.push({ name, href, snippet });
    });

    // Use the first selector that produces results
    if (results.length > 0) break;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers — scoring
// ---------------------------------------------------------------------------

function computeConfidence(params: {
  queryCount: number;
  totalQueries: number;
  hasSnippet: boolean;
}): number {
  let score = 0;
  // Multi-query appearance: up to 40 pts
  score += Math.min(40, (params.queryCount / Math.max(1, params.totalQueries)) * 40);
  // Has a snippet: 20 pts
  if (params.hasSnippet) score += 20;
  // Passed blocklist filter (always true at call-site): 20 pts
  score += 20;
  // Not a subdomain of own domain (always true at call-site): 20 pts
  score += 20;
  return Math.round(score);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function discoverCompetitors(params: {
  homepageUrl: string;
  language: 'English' | 'Hebrew';
  market: string;
  suggestedQueries: string[];
}): Promise<DiscoveryResult> {
  const ownDomain = extractDomain(params.homepageUrl);
  const queries = params.suggestedQueries.slice(0, MAX_QUERIES);

  const diagnostics: DiscoveryDiagnostics = {
    queriesAttempted: queries.length,
    queriesSucceeded: 0,
    queriesFailed: 0,
    totalRawResults: 0,
    filteredByBlocklist: 0,
    filteredByOwnDomain: 0,
    retries: 0,
  };

  // domain → accumulated data
  const domainMap = new Map<
    string,
    { name: string; url: string; domain: string; snippet: string; sources: string[] }
  >();

  for (const query of queries) {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const { response, retries } = await fetchWithRetry(searchUrl, { timeoutMs: 15_000 });
    diagnostics.retries += retries;

    if (!response) {
      diagnostics.queriesFailed++;
      console.warn(`[competitors] Query failed: "${query}"`);
      continue;
    }

    let html: string;
    try {
      html = await response.text();
    } catch (error) {
      diagnostics.queriesFailed++;
      console.warn(
        `[competitors] Failed to read response for "${query}": ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    diagnostics.queriesSucceeded++;
    const rawResults = extractResultsFromHtml(html, MAX_RESULTS_PER_QUERY);
    diagnostics.totalRawResults += rawResults.length;

    for (const result of rawResults) {
      const domain = extractDomain(result.href);
      if (!domain) continue;

      if (ownDomain && isSubdomainOf(domain, ownDomain)) {
        diagnostics.filteredByOwnDomain++;
        continue;
      }

      if (isBlockedDomain(domain)) {
        diagnostics.filteredByBlocklist++;
        continue;
      }

      const existing = domainMap.get(domain);
      if (existing) {
        if (!existing.sources.includes(query)) existing.sources.push(query);
        if (result.snippet.length > existing.snippet.length) existing.snippet = result.snippet;
        if (result.name.length > existing.name.length) existing.name = result.name;
      } else {
        domainMap.set(domain, {
          name: result.name,
          url: result.href,
          domain,
          snippet: result.snippet,
          sources: [query],
        });
      }
    }
  }

  const totalQueries = queries.length;
  const candidates: CompetitorCandidate[] = Array.from(domainMap.values())
    .map((entry) => ({
      ...entry,
      confidence: computeConfidence({
        queryCount: entry.sources.length,
        totalQueries,
        hasSnippet: entry.snippet.length > 0,
      }),
    }))
    .sort((a, b) => b.confidence - a.confidence || b.sources.length - a.sources.length)
    .slice(0, MAX_FINAL_RESULTS);

  console.warn(
    `[competitors] Discovery complete: ${diagnostics.queriesSucceeded}/${diagnostics.queriesAttempted} queries succeeded, ` +
      `${diagnostics.totalRawResults} raw results, ${diagnostics.filteredByBlocklist} blocked, ` +
      `${diagnostics.filteredByOwnDomain} own-domain, ${candidates.length} candidates returned, ` +
      `${diagnostics.retries} retries`,
  );

  return { candidates, diagnostics };
}
