import 'server-only';

import FirecrawlApp from '@mendable/firecrawl-js';
import { getFirecrawlApiKey } from '@/lib/env';
import { log } from '@/server/log';

let client: InstanceType<typeof FirecrawlApp> | null = null;

function getClient(): InstanceType<typeof FirecrawlApp> {
  if (!client) {
    const apiKey = getFirecrawlApiKey();
    if (!apiKey) {
      throw new Error('FIRECRAWL_API_KEY is not configured');
    }
    client = new FirecrawlApp({ apiKey });
  }
  return client;
}

export function isFirecrawlConfigured(): boolean {
  return Boolean(getFirecrawlApiKey());
}

export async function firecrawlScrape(
  url: string,
): Promise<{ content: string; markdown: string; metadata: Record<string, unknown> } | null> {
  if (!isFirecrawlConfigured()) {
    console.warn('[firecrawl] Skipping scrape — FIRECRAWL_API_KEY not set');
    return null;
  }

  try {
    log.info(`[firecrawl] Scraping: ${url}`);
    const app = getClient();
    const doc = await Promise.race([
      app.scrape(url),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firecrawl scrape timed out')), 20_000),
      ),
    ]);

    log.info(
      `[firecrawl] Scrape complete for ${url} — ` +
        `content: ${doc.markdown?.length ?? 0} chars`,
    );

    return {
      content: doc.markdown ?? '',
      markdown: doc.markdown ?? '',
      metadata: (doc.metadata as Record<string, unknown>) ?? {},
    };
  } catch (err) {
    console.warn(`[firecrawl] Scrape error for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function firecrawlMap(url: string): Promise<string[] | null> {
  if (!isFirecrawlConfigured()) {
    console.warn('[firecrawl] Skipping map — FIRECRAWL_API_KEY not set');
    return null;
  }

  try {
    log.info(`[firecrawl] Mapping: ${url}`);
    const app = getClient();
    const result = await Promise.race([
      app.map(url),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firecrawl map timed out')), 30_000),
      ),
    ]);

    const links = result.links?.map((entry) => entry.url) ?? [];
    log.info(`[firecrawl] Map complete for ${url} — ${links.length} links found`);
    return links;
  } catch (err) {
    console.warn(`[firecrawl] Map error for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
