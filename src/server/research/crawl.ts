import { gunzipSync } from 'zlib';
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import { getCrawlLimits } from '@/lib/env';
import { fetchWithTimeout } from './http';
import { dedupeStrings, normalizeWhitespace } from './utils';

type SitemapDocument =
  | { type: 'urlset'; urls: string[] }
  | { type: 'index'; sitemaps: string[] };

export type PageSnapshot = {
  url: string;
  title: string;
  description: string;
  headings: string[];
  body: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  removeNSPrefix: true,
});

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function maybeGunzip(url: string, buffer: Buffer): Buffer | null {
  if (url.endsWith('.gz')) {
    try {
      return gunzipSync(buffer);
    } catch {
      console.warn(`[crawl] gzip decompression failed for ${url}`);
      return null;
    }
  }

  return buffer;
}

function parseSitemapXml(xml: string): SitemapDocument {
  const parsed = parser.parse(xml);
  if (parsed.sitemapindex) {
    return {
      type: 'index',
      sitemaps: toArray(parsed.sitemapindex.sitemap).map((entry) => entry.loc).filter(Boolean),
    };
  }

  return {
    type: 'urlset',
    urls: toArray(parsed.urlset?.url).map((entry) => entry.loc).filter(Boolean),
  };
}

function isContentLikeUrl(url: string) {
  return !/\.(jpe?g|png|gif|svg|webp|avif|pdf|zip|xml|gz)$/i.test(url);
}

export async function fetchSitemapUrls(rootSitemapUrl: string) {
  if (!rootSitemapUrl) {
    console.warn('[crawl] fetchSitemapUrls called with empty URL');
    return [];
  }
  try {
    new URL(rootSitemapUrl);
  } catch {
    console.warn(`[crawl] fetchSitemapUrls called with invalid URL: ${rootSitemapUrl}`);
    return [];
  }

  const limits = getCrawlLimits();
  const seenSitemaps = new Set<string>();
  const seenUrls = new Set<string>();
  const queue = [rootSitemapUrl];

  while (queue.length && seenSitemaps.size < limits.maxSitemaps && seenUrls.size < limits.maxUrls) {
    const sitemapUrl = queue.shift()!;
    if (seenSitemaps.has(sitemapUrl)) {
      continue;
    }

    seenSitemaps.add(sitemapUrl);

    let response: Response;
    try {
      response = await fetchWithTimeout(sitemapUrl, { timeoutMs: 15_000 });
    } catch (err) {
      console.warn(`[crawl] Failed to fetch sitemap ${sitemapUrl}:`, err);
      continue;
    }
    if (!response.ok) {
      console.warn(`[crawl] Sitemap ${sitemapUrl} returned HTTP ${response.status}`);
      continue;
    }

    const arrayBuffer = await response.arrayBuffer();
    const decompressed = maybeGunzip(sitemapUrl, Buffer.from(arrayBuffer));
    if (!decompressed) {
      continue;
    }
    const xml = decompressed.toString('utf8');

    const prefix = xml.slice(0, 1000).toLowerCase();
    if (prefix.includes('<!doctype html') || prefix.includes('<html')) {
      console.warn(`[crawl] Sitemap ${sitemapUrl} returned HTML instead of XML, skipping`);
      continue;
    }
    if (!prefix.includes('<urlset') && !prefix.includes('<sitemapindex')) {
      console.warn(`[crawl] Sitemap ${sitemapUrl} does not look like valid sitemap XML, skipping`);
      continue;
    }

    let parsed: SitemapDocument;
    try {
      parsed = parseSitemapXml(xml);
    } catch (err) {
      console.warn(`[crawl] Failed to parse sitemap XML from ${sitemapUrl}:`, err);
      continue;
    }

    if (parsed.type === 'index') {
      for (const child of parsed.sitemaps) {
        if (!seenSitemaps.has(child)) {
          queue.push(child);
        }
      }
      continue;
    }

    for (const url of parsed.urls) {
      if (seenUrls.size >= limits.maxUrls) {
        break;
      }

      if (isContentLikeUrl(url)) {
        seenUrls.add(url);
      }
    }
  }

  return [...seenUrls];
}

export async function fetchPageSnapshot(url: string, htmlBytes = getCrawlLimits().maxHtmlBytes): Promise<PageSnapshot | null> {
  try {
    const response = await fetchWithTimeout(url, { timeoutMs: 15_000 });
    if (!response.ok) {
      console.warn(`[crawl] fetchPageSnapshot ${url} returned HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      console.warn(`[crawl] fetchPageSnapshot ${url} has non-HTML content-type: ${contentType}`);
      return null;
    }

    const html = (await response.text()).slice(0, htmlBytes);
    const $ = cheerio.load(html);

    $('script, style, noscript, svg').remove();

    const title = normalizeWhitespace($('title').first().text());
    const description = normalizeWhitespace($('meta[name="description"]').attr('content') || '');
    const headings = dedupeStrings(
      $('h1, h2, h3')
        .toArray()
        .map((element) => normalizeWhitespace($(element).text()))
        .filter(Boolean),
    ).slice(0, 12);

    const body = normalizeWhitespace(
      $('main, article, body')
        .first()
        .text()
        .slice(0, 10_000),
    ).slice(0, 4_500);

    return {
      url,
      title,
      description,
      headings,
      body,
    };
  } catch (err) {
    console.warn(`[crawl] fetchPageSnapshot failed for ${url}:`, err);
    return null;
  }
}

export function buildExistingContentMap(urls: string[], pageSnapshots: PageSnapshot[]) {
  const pages = pageSnapshots.map((snapshot) => {
    const parsed = new URL(snapshot.url);
    return {
      url: snapshot.url,
      path: parsed.pathname,
      title: snapshot.title,
      headings: snapshot.headings,
      topicFingerprint: normalizeWhitespace(
        [snapshot.title, snapshot.headings.join(' '), parsed.pathname.replace(/[-_/]+/g, ' ')]
          .join(' ')
          .toLowerCase(),
      ),
    };
  });

  return {
    urlCount: urls.length,
    sampledPageCount: pageSnapshots.length,
    pages,
    paths: urls.map((url) => new URL(url).pathname),
  };
}
