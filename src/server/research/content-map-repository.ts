import { randomUUID } from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { contentMap } from '@/server/db/schema';

export type ContentMapEntry = {
  id: string;
  userId: string;
  keywordId: string;
  pageUrl: string;
  pageTitle: string | null;
  mappedAt: number;
};

export type PageStats = {
  pageUrl: string;
  pageTitle: string | null;
  keywordCount: number;
  combinedVolume: number;
  avgDifficulty: number;
};

export async function getContentMappingsForUser(userId: string): Promise<ContentMapEntry[]> {
  const rows = await db
    .select()
    .from(contentMap)
    .where(eq(contentMap.userId, userId))
    .orderBy(sql`${contentMap.mappedAt} DESC`);

  return rows as ContentMapEntry[];
}

export async function getContentMappingById(id: string, userId: string): Promise<ContentMapEntry | null> {
  const rows = await db
    .select()
    .from(contentMap)
    .where(and(eq(contentMap.id, id), eq(contentMap.userId, userId)))
    .limit(1);

  return rows.length > 0 ? (rows[0] as ContentMapEntry) : null;
}

export async function createContentMapping(
  userId: string,
  keywordId: string,
  pageUrl: string,
  pageTitle?: string | null,
): Promise<ContentMapEntry> {
  const entry: ContentMapEntry = {
    id: randomUUID(),
    userId,
    keywordId,
    pageUrl,
    pageTitle: pageTitle ?? null,
    mappedAt: Date.now(),
  };

  await db.insert(contentMap).values(entry).run();
  return entry;
}

export async function updateContentMapping(
  id: string,
  userId: string,
  updates: { pageUrl?: string; pageTitle?: string | null; keywordId?: string },
): Promise<ContentMapEntry | null> {
  const existing = await getContentMappingById(id, userId);
  if (!existing) return null;

  const setData: Record<string, unknown> = { mappedAt: Date.now() };
  if (updates.pageUrl !== undefined) setData.pageUrl = updates.pageUrl;
  if (updates.pageTitle !== undefined) setData.pageTitle = updates.pageTitle;
  if (updates.keywordId !== undefined) setData.keywordId = updates.keywordId;

  await db
    .update(contentMap)
    .set(setData)
    .where(and(eq(contentMap.id, id), eq(contentMap.userId, userId)))
    .run();

  return getContentMappingById(id, userId);
}

export async function deleteContentMapping(id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(contentMap)
    .where(and(eq(contentMap.id, id), eq(contentMap.userId, userId)))
    .run();

  return result.rowsAffected > 0;
}

export async function getPageStats(userId: string): Promise<PageStats[]> {
  const result = await db
    .select({
      pageUrl: contentMap.pageUrl,
      pageTitle: contentMap.pageTitle,
      keywordCount: sql<number>`COUNT(*)`,
      combinedVolume: sql<number>`0`,
      avgDifficulty: sql<number>`0`,
    })
    .from(contentMap)
    .where(eq(contentMap.userId, userId))
    .groupBy(contentMap.pageUrl)
    .orderBy(sql`keywordCount DESC`)
    .run();

  return (result.rows as unknown) as PageStats[];
}

export async function getMappingByKeyword(
  userId: string,
  keywordId: string,
): Promise<ContentMapEntry | null> {
  const rows = await db
    .select()
    .from(contentMap)
    .where(and(eq(contentMap.userId, userId), eq(contentMap.keywordId, keywordId)))
    .limit(1);

  return rows.length > 0 ? (rows[0] as ContentMapEntry) : null;
}
