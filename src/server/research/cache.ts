import { createHash, randomUUID } from 'crypto';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { searchCache } from '@/server/db/schema';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SearchCachePayload {
  projectId: string;
  homepageUrl: string;
  aboutUrl: string;
  sitemapUrl: string;
  brandName: string;
  language: string;
  market: string;
  competitorUrls: string[];
  notes: string;
  targetRows: number;
  mode: 'fresh' | 'expand';
  existingResearchSummary: unknown;
}

/**
 * Generate a deterministic MD5 hash from a cacheable payload.
 * Used to lookup and store cached results for identical search parameters.
 */
export function hashSearchParams(payload: SearchCachePayload): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('md5').update(canonical).digest('hex');
}

/**
 * Retrieve a valid (non-expired) cached result for the given query hash.
 * Returns null if no cache entry exists, or if the entry has expired.
 */
export async function getCacheEntry(
  queryHash: string,
): Promise<string | null> {
  const row = await db
    .select({ results: searchCache.results, expiresAt: searchCache.expiresAt })
    .from(searchCache)
    .where(eq(searchCache.queryHash, queryHash))
    .get();

  if (!row) {
    return null;
  }

  // Check if expired
  if (row.expiresAt <= Date.now()) {
    // Clean up this expired entry
    await db
      .delete(searchCache)
      .where(eq(searchCache.queryHash, queryHash));
    return null;
  }

  return row.results;
}

/**
 * Store search results in the cache with a 24-hour TTL.
 * If a cache entry already exists for this query hash, it will be updated (upsert).
 */
export async function setCacheEntry(
  userId: string,
  queryHash: string,
  results: string,
): Promise<void> {
  const now = Date.now();
  const expiresAt = now + CACHE_TTL_MS;

  // Check if an entry already exists for this query hash
  const existing = await db
    .select({ id: searchCache.id })
    .from(searchCache)
    .where(eq(searchCache.queryHash, queryHash))
    .get();

  if (existing) {
    await db
      .update(searchCache)
      .set({ results, expiresAt, createdAt: now })
      .where(eq(searchCache.id, existing.id));
  } else {
    await db.insert(searchCache).values({
      id: randomUUID(),
      userId,
      queryHash,
      results,
      createdAt: now,
      expiresAt,
    });
  }
}

/**
 * Delete all expired cache entries.
 * Should be called periodically (e.g., during app startup, or via a cron endpoint).
 */
export async function deleteExpiredEntries(): Promise<number> {
  // With libSQL/drizzle, non-returning delete resolves to the raw ResultSet
  const result = await db
    .delete(searchCache)
    .where(lt(searchCache.expiresAt, Date.now()));

  // libSQL ResultSet has rowsAffected; drizzle passes through the raw run result
  if (result && typeof result === 'object' && 'rowsAffected' in result) {
    return (result as { rowsAffected: number }).rowsAffected;
  }
  return 0;
}
