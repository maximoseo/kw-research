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

function maybeGunzip(url: string, buffer: Buffer) {
  if (url.endsWith('.gz')) {
    try {
      return gunzipSync(buffer);
    } catch {
      return buffer;
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
    const response = await fetchWithTimeout(sitemapUrl, { timeoutMs: 15_000 });
    if (!response.ok) {
      continue;
    }

    const arrayBuffer = await response.arrayBuffer();
    const xml = maybeGunzip(sitemapUrl, Buffer.from(arrayBuffer)).toString('utf8');
    const parsed = parseSitemapXml(xml);

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
  const response = await fetchWithTimeout(url, { timeoutMs: 15_000 });
  if (!response.ok) {
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
