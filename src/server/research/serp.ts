import { createHash, randomUUID } from 'crypto';
import { eq, and, lt } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { serpResults } from '@/server/db/schema';
import { getFirecrawlApiKey } from '@/lib/env';
import { fetchWithTimeout } from './http';

export type SerpContentType = 'blog' | 'product' | 'video' | 'forum' | 'news' | 'tool';

export interface SerpResult {
  position: number;
  url: string;
  title: string;
  snippet: string;
  content_type: SerpContentType;
  domain: string;
}

export interface SerpData {
  results: SerpResult[];
  distribution: { type: SerpContentType; count: number; label: string }[];
  missingTypes: SerpContentType[];
  fetchedAt: number;
}

const SERP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ALL_CONTENT_TYPES: SerpContentType[] = ['blog', 'product', 'video', 'forum', 'news', 'tool'];

const CONTENT_TYPE_LABELS: Record<SerpContentType, string> = {
  blog: 'Blog Post',
  product: 'Product Page',
  video: 'Video',
  forum: 'Forum / Q&A',
  news: 'News / PR',
  tool: 'Tool / App',
};

/**
 * Generate a deterministic cache key for a keyword.
 */
function serpCacheKey(keyword: string): string {
  return createHash('md5')
    .update(`serp:${keyword.toLowerCase().trim()}`)
    .digest('hex');
}

/**
 * Analyze URL, title, and snippet to classify content type.
 */
export function analyzeContentType(
  url: string,
  title: string,
  snippet: string,
): SerpContentType {
  const combined = `${url} ${title} ${snippet}`.toLowerCase();

  // Video signals
  if (
    /youtube\.com|vimeo\.com|dailymotion\.com|\/watch|\/v\/|\/video\b/.test(url) ||
    /\b(video|watch|tutorial video|how.to video)\b/.test(title) ||
    /\bvideo\b/.test(snippet.slice(0, 100))
  ) {
    return 'video';
  }

  // Forum/Q&A signals
  if (
    /reddit\.com|quora\.com|stackoverflow\.com|stackexchange\.com|forum\.|discourse\.|\/questions?\/|\/thread\b/.test(url) ||
    /\b(forum|q&a|question|answer|discussion|thread)\b/.test(title) ||
    /\b(reddit|forum|community)\b/.test(combined)
  ) {
    return 'forum';
  }

  // News signals
  if (
    /news\.|\/news\/|press|reuters\.com|bloomberg\.com|cnn\.com|bbc\.com|\/article\/\d{4}/.test(url) ||
    /\b(news|press release|announces|announced|launches|launched|breaking|latest)\b/.test(title)
  ) {
    return 'news';
  }

  // Product page signals
  if (
    /\/products?\b|\/pricing\b|\/plans?\b|\/purchase|\/checkout|\/buy\b|pricing\.|plans?\./.test(url) ||
    /\b(pricing|plans?|buy|purchase|subscription|free trial|demo|sign up|get started)\b/i.test(title) ||
    /\b(pricing|plan|buy|purchase|subscription|sign.up)\b/.test(combined)
  ) {
    return 'product';
  }

  // Tool / App signals
  if (
    /\.app\b|\.(io|ai|dev)\b.*\/(tool|app|generator|checker|calculator|analyzer|scanner)\b/.test(url) ||
    /\b(tool|generator|checker|calculator|analyzer|scanner|app|software|platform|dashboard)\b/i.test(title)
  ) {
    return 'tool';
  }

  // Default to blog
  return 'blog';
}

/**
 * Extract domain from URL.
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ── DuckDuckGo HTML scraping fallback (no API key needed) ──

interface DDGOrganicResult {
  title: string;
  url: string;
  snippet: string;
}

async function searchWithDuckDuckGo(keyword: string): Promise<DDGOrganicResult[]> {
  const params = new URLSearchParams({ q: keyword });
  const url = `https://html.duckduckgo.com/html/?${params.toString()}`;

  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SEOKeywordResearch/1.0)',
      'Accept': 'text/html',
    },
    timeoutMs: 10_000,
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo returned HTTP ${response.status}`);
  }

  const html = await response.text();

  // Extract organic results from the HTML
  // DDG HTML result structure: <a class="result__a" href="...">title</a> + <a class="result__snippet">snippet</a>
  const results: DDGOrganicResult[] = [];
  const linkRegex = /<a\s+(?:[^>]*?\s+)?class="result__a"(?:[^>]*?\s+)?href="([^"]*)"[^>]*>([^<]*)<\s*\/\s*a\s*>/gi;
  const snippetRegex = /<a\s+(?:[^>]*?\s+)?class="result__snippet"[^>]*>([^<]*)<\s*\/\s*a\s*>/gi;

  let linkMatch: RegExpExecArray | null;
  const links: Array<{ url: string; title: string; index: number }> = [];
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    links.push({ url: linkMatch[1], title: linkMatch[2].trim(), index: linkMatch.index });
  }

  const snippets: Array<{ text: string; index: number }> = [];
  while ((linkMatch = snippetRegex.exec(html)) !== null) {
    snippets.push({ text: linkMatch[1].trim(), index: linkMatch.index });
  }

  // Match links to nearest following snippet
  for (let i = 0; i < links.length && results.length < 10; i++) {
    const link = links[i];
    // Find snippet that appears after this link's position
    const snippet = snippets.find((s) => s.index > link.index);
    results.push({
      url: link.url,
      title: link.title,
      snippet: snippet?.text ?? '',
    });
  }

  return results.slice(0, 10);
}

// ── Firecrawl search (API key required) ──

async function searchWithFirecrawl(keyword: string): Promise<DDGOrganicResult[]> {
  // Dynamic import to avoid requiring the module at parse time
  const FirecrawlApp = (await import('@mendable/firecrawl-js')).default;
  const apiKey = getFirecrawlApiKey();
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY not configured');
  }

  const client = new FirecrawlApp({ apiKey });
  const data = await client.search(keyword, { limit: 10, sources: ['web'] });

  const results: DDGOrganicResult[] = [];
  // Firecrawl search data structure: { web: Array<SearchResultWeb | Document> }
  const items = data.web ?? [];
  if (!items.length) {
    return results;
  }

  for (const item of items) {
    // SearchResultWeb has url, title, description; Document has different shape
    const webItem = item as { url?: string; title?: string; description?: string };
    results.push({
      title: webItem.title || '',
      url: webItem.url || '',
      snippet: webItem.description || '',
    });
  }

  return results.slice(0, 10);
}

// ── Main fetch function ──

/**
 * Fetch top 10 SERP results for a keyword.
 * Tries Firecrawl first (if configured), falls back to DuckDuckGo.
 */
export async function fetchSerpResultsRaw(keyword: string): Promise<DDGOrganicResult[]> {
  // Try Firecrawl first if configured
  if (getFirecrawlApiKey()) {
    try {
      return await searchWithFirecrawl(keyword);
    } catch (err) {
      console.warn(`[serp] Firecrawl search failed for "${keyword}", falling back to DDG:`, err instanceof Error ? err.message : err);
    }
  }

  // Fallback to DuckDuckGo
  return searchWithDuckDuckGo(keyword);
}

/**
 * Fetch SERP results with caching.
 * Results are cached per keyword for 7 days.
 */
export async function getSerpData(keyword: string): Promise<SerpData> {
  const cacheKey = serpCacheKey(keyword);
  const now = Date.now();

  // Check cache
  const cached = await db
    .select()
    .from(serpResults)
    .where(
      and(
        eq(serpResults.keywordId, cacheKey),
        eq(serpResults.keywordText, keyword),
      ),
    )
    .orderBy(serpResults.position)
    .all();

  // If we have fresh cached results, use them
  if (cached.length > 0 && cached[0].fetchedAt > now - SERP_CACHE_TTL_MS) {
    return buildSerpDataFromCache(cached);
  }

  // Delete stale cache entries for this keyword
  if (cached.length > 0) {
    await db
      .delete(serpResults)
      .where(eq(serpResults.keywordId, cacheKey));
  }

  // Fetch fresh results
  let raw: DDGOrganicResult[];
  try {
    raw = await fetchSerpResultsRaw(keyword);
  } catch (err) {
    console.warn(`[serp] Failed to fetch SERP for "${keyword}":`, err instanceof Error ? err.message : err);
    return { results: [], distribution: [], missingTypes: [...ALL_CONTENT_TYPES], fetchedAt: now };
  }

  if (!raw.length) {
    return { results: [], distribution: [], missingTypes: [...ALL_CONTENT_TYPES], fetchedAt: now };
  }

  // Insert into cache
  const serpResultRows = raw.map((r, i) => {
    const domain = extractDomain(r.url);
    const contentType = analyzeContentType(r.url, r.title, r.snippet);
    return {
      id: randomUUID(),
      keywordId: cacheKey,
      keywordText: keyword,
      runId: null,
      position: i + 1,
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      content_type: contentType,
      domain,
      fetchedAt: now,
    };
  });

  // Insert in batches to avoid too many concurrent inserts
  for (const row of serpResultRows) {
    await db.insert(serpResults).values(row);
  }

  return buildSerpDataFromCache(serpResultRows);
}

function buildSerpDataFromCache(
  rows: Array<{
    position: number;
    url: string;
    title: string;
    snippet: string;
    content_type: string;
    domain: string;
    fetchedAt: number;
  }>,
): SerpData {
  const results: SerpResult[] = rows.map((r) => ({
    position: r.position,
    url: r.url,
    title: r.title,
    snippet: r.snippet,
    content_type: r.content_type as SerpContentType,
    domain: r.domain,
  }));

  // Build distribution
  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.content_type] = (counts[r.content_type] || 0) + 1;
  }

  const distribution = ALL_CONTENT_TYPES.map((type) => ({
    type,
    count: counts[type] || 0,
    label: CONTENT_TYPE_LABELS[type],
  })).filter((d) => d.count > 0);

  const presentTypes = new Set(distribution.map((d) => d.type));
  const missingTypes = ALL_CONTENT_TYPES.filter((t) => !presentTypes.has(t));

  return {
    results,
    distribution,
    missingTypes,
    fetchedAt: rows[0]?.fetchedAt ?? Date.now(),
  };
}

export { CONTENT_TYPE_LABELS, ALL_CONTENT_TYPES };
