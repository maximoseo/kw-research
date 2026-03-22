import * as cheerio from 'cheerio';
import { fetchWithTimeout } from './http';
import { firecrawlMap, isFirecrawlConfigured } from './firecrawl';

// ---------------------------------------------------------------------------
// resolveCanonicalHomepage
// ---------------------------------------------------------------------------

export async function resolveCanonicalHomepage(url: string): Promise<string> {
  try {
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `https://${normalized}`;
    }
    normalized = normalized.replace(/\/+$/, '');

    const res = await fetchWithTimeout(normalized, { timeoutMs: 15_000, method: 'HEAD' });
    const final = res.url ?? normalized;
    return final.replace(/\/+$/, '');
  } catch {
    // If the fetch fails, return the best-effort normalized URL
    let fallback = url.trim();
    if (!/^https?:\/\//i.test(fallback)) {
      fallback = `https://${fallback}`;
    }
    return fallback.replace(/\/+$/, '');
  }
}

// ---------------------------------------------------------------------------
// discoverSitemapUrl
// ---------------------------------------------------------------------------

const SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/wp-sitemap.xml',
];

async function isValidSitemap(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, { timeoutMs: 10_000 });
    if (!res.ok) return false;

    const text = await res.text();
    const head = text.slice(0, 500).toLowerCase();

    // Reject HTML error pages
    if (head.includes('<html') || head.includes('<!doctype')) return false;

    // Must look like actual XML sitemap content
    return head.includes('<urlset') || head.includes('<sitemapindex');
  } catch {
    return false;
  }
}

async function parseSitemapFromRobotsTxt(origin: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`, { timeoutMs: 10_000 });
    if (!res.ok) return null;

    const text = await res.text();
    const lines = text.split('\n');

    for (const line of lines) {
      const match = line.match(/^\s*Sitemap:\s*(.+)/i);
      if (match) {
        const candidate = match[1].trim();
        if (await isValidSitemap(candidate)) {
          return candidate;
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function findSitemapViaFirecrawl(origin: string): Promise<string | null> {
  if (!isFirecrawlConfigured()) return null;

  try {
    const links = await firecrawlMap(origin);
    if (!links) return null;

    const sitemapLinks = links.filter(
      (l) => /sitemap/i.test(l) && /\.xml/i.test(l),
    );

    for (const candidate of sitemapLinks) {
      if (await isValidSitemap(candidate)) {
        return candidate;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function discoverSitemapUrl(homepage: string): Promise<string | null> {
  try {
    const origin = new URL(homepage).origin;

    // 1. Try well-known paths
    for (const path of SITEMAP_PATHS) {
      const candidate = `${origin}${path}`;
      if (await isValidSitemap(candidate)) {
        return candidate;
      }
    }

    // 2. Parse robots.txt
    const fromRobots = await parseSitemapFromRobotsTxt(origin);
    if (fromRobots) return fromRobots;

    // 3. Firecrawl map fallback
    const fromFirecrawl = await findSitemapViaFirecrawl(origin);
    if (fromFirecrawl) return fromFirecrawl;

    return null;
  } catch (err) {
    console.warn(
      '[discovery] Failed to discover sitemap:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// discoverAboutPage
// ---------------------------------------------------------------------------

const ABOUT_PATHS = [
  '/about',
  '/about-us',
  '/about/',
  '/about-us/',
  '/company',
  '/our-story',
  '/who-we-are',
];

const ABOUT_KEYWORDS = ['about', 'company', 'story', 'who-we-are'];

function scoreAboutUrl(href: string): number {
  const lower = href.toLowerCase();
  let score = 0;
  if (/\/about\/?$/i.test(lower)) score += 10;
  if (/\/about-us\/?$/i.test(lower)) score += 9;
  if (/\/company\/?$/i.test(lower)) score += 7;
  if (/\/our-story\/?$/i.test(lower)) score += 6;
  if (/\/who-we-are\/?$/i.test(lower)) score += 6;
  if (/about/i.test(lower)) score += 3;
  if (/company/i.test(lower)) score += 2;
  if (/story/i.test(lower)) score += 1;
  return score;
}

async function headCheck(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD', timeoutMs: 10_000 });
    return res.ok;
  } catch {
    return false;
  }
}

async function findAboutInHomepageHtml(homepage: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(homepage, { timeoutMs: 10_000 });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);
    const origin = new URL(homepage).origin;

    const candidates: { url: string; score: number }[] = [];

    $('nav a, footer a, header a').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().toLowerCase();
      if (!href) return;

      const hrefLower = href.toLowerCase();
      const isAboutLike =
        ABOUT_KEYWORDS.some((kw) => hrefLower.includes(kw)) ||
        ABOUT_KEYWORDS.some((kw) => text.includes(kw));

      if (!isAboutLike) return;

      try {
        const resolved = new URL(href, homepage).toString();
        if (!resolved.startsWith(origin)) return;

        candidates.push({
          url: resolved.replace(/\/+$/, ''),
          score: scoreAboutUrl(resolved),
        });
      } catch {
        // skip invalid URLs
      }
    });

    if (candidates.length === 0) return null;

    // Dedupe and sort by score descending
    const seen = new Set<string>();
    const unique = candidates.filter((c) => {
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });
    unique.sort((a, b) => b.score - a.score);

    return unique[0].url;
  } catch {
    return null;
  }
}

async function findAboutViaFirecrawl(homepage: string): Promise<string | null> {
  if (!isFirecrawlConfigured()) return null;

  try {
    const origin = new URL(homepage).origin;
    const links = await firecrawlMap(homepage);
    if (!links) return null;

    const candidates = links
      .filter((l) => {
        try {
          return new URL(l).origin === origin;
        } catch {
          return false;
        }
      })
      .filter((l) => ABOUT_KEYWORDS.some((kw) => l.toLowerCase().includes(kw)))
      .map((url) => ({ url: url.replace(/\/+$/, ''), score: scoreAboutUrl(url) }))
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      return candidates[0].url;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function discoverAboutPage(homepage: string): Promise<string | null> {
  try {
    const origin = new URL(homepage).origin;

    // 1. Try common paths with HEAD requests
    for (const path of ABOUT_PATHS) {
      const candidate = `${origin}${path}`;
      if (await headCheck(candidate)) {
        return candidate;
      }
    }

    // 2. Parse homepage HTML for about links
    const fromHtml = await findAboutInHomepageHtml(homepage);
    if (fromHtml) return fromHtml;

    // 3. Firecrawl map fallback
    const fromFirecrawl = await findAboutViaFirecrawl(homepage);
    if (fromFirecrawl) return fromFirecrawl;

    return null;
  } catch (err) {
    console.warn(
      '[discovery] Failed to discover about page:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
