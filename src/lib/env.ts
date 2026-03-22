import path from 'path';
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  SESSION_SECRET: z.string().min(16).default('dev-session-secret-dev-session-secret'),
  DATABASE_URL: z.string().optional(),
  DATA_DIR: z.string().optional(),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().min(5000).default(15_000),
  AI_MAX_RETRIES: z.coerce.number().min(0).max(5).default(0),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  SEARCH_USER_AGENT: z
    .string()
    .default('Mozilla/5.0 (compatible; MaximoSEOResearchBot/1.0; +https://maximo-seo.ai)'),
  CRAWL_MAX_SITEMAPS: z.coerce.number().min(1).max(100).default(20),
  CRAWL_MAX_URLS: z.coerce.number().min(50).max(5000).default(1500),
  CRAWL_MAX_PAGE_FETCHES: z.coerce.number().min(5).max(200).default(60),
  CRAWL_MAX_HTML_BYTES: z.coerce.number().min(10_000).max(2_000_000).default(400_000),
  RUNNER_POLL_INTERVAL_MS: z.coerce.number().min(1000).max(30_000).default(3000),
  RUNNER_STALE_LOCK_MS: z.coerce.number().min(60_000).max(3_600_000).default(900_000),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  KEYWORDS_EVERYWHERE_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
});

const env = envSchema.parse(process.env);

export function getDataDir() {
  return path.resolve(env.DATA_DIR || '.data');
}

export function getDatabaseUrl() {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  return `file:${path.join(getDataDir(), 'kw-research.db')}`;
}

export function getUploadsDir() {
  return path.join(getDataDir(), 'uploads');
}

export function getReportsDir() {
  return path.join(getDataDir(), 'reports');
}

export function getAppUrl() {
  return env.NEXT_PUBLIC_APP_URL;
}

export function getAiRequestTimeoutMs() {
  return env.AI_REQUEST_TIMEOUT_MS;
}

export function getAiMaxRetries() {
  return env.AI_MAX_RETRIES;
}

export function getSearchUserAgent() {
  return env.SEARCH_USER_AGENT;
}

export function getRunnerPollIntervalMs() {
  return env.RUNNER_POLL_INTERVAL_MS;
}

export function getRunnerStaleLockMs() {
  return env.RUNNER_STALE_LOCK_MS;
}

export function getCrawlLimits() {
  return {
    maxSitemaps: env.CRAWL_MAX_SITEMAPS,
    maxUrls: env.CRAWL_MAX_URLS,
    maxPageFetches: env.CRAWL_MAX_PAGE_FETCHES,
    maxHtmlBytes: env.CRAWL_MAX_HTML_BYTES,
  };
}

export function getConfiguredModels() {
  return {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    anthropicModel: env.ANTHROPIC_MODEL,
    openAiApiKey: env.OPENAI_API_KEY,
    openAiModel: env.OPENAI_MODEL,
  };
}

export function getSessionSecret() {
  return env.SESSION_SECRET;
}

export function getGoogleClientId() {
  return env.GOOGLE_CLIENT_ID;
}

export function getGoogleClientSecret() {
  return env.GOOGLE_CLIENT_SECRET;
}

export function isGoogleOAuthConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function getKeywordsEverywhereApiKey() {
  return env.KEYWORDS_EVERYWHERE_API_KEY;
}

export function getFirecrawlApiKey() {
  return env.FIRECRAWL_API_KEY;
}
