import { randomUUID } from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { contentBriefs } from '@/server/db/schema';

export type ContentBriefDbRow = {
  id: string;
  userId: string;
  title: string;
  keywords: string;
  brief: string;
  createdAt: number;
};

export type ContentBriefSummary = {
  id: string;
  title: string;
  keywords: string[];
  createdAt: number;
};

export type ContentBriefFull = ContentBriefSummary & {
  brief: GeneratedContentBrief;
};

export type BriefSection = {
  heading: 'H2' | 'H3';
  text: string;
};

export type GeneratedContentBrief = {
  targetKeyword: string;
  secondaryKeywords: string[];
  recommendedWordCount: number;
  titles: string[];
  outline: BriefSection[];
  keyPoints: string[];
  competitorGap: string;
  uniqueAngle: string;
};

export async function saveContentBrief(
  userId: string,
  title: string,
  keywords: string[],
  brief: GeneratedContentBrief,
): Promise<ContentBriefDbRow> {
  const row: ContentBriefDbRow = {
    id: randomUUID(),
    userId,
    title,
    keywords: JSON.stringify(keywords),
    brief: JSON.stringify(brief),
    createdAt: Date.now(),
  };

  await db.insert(contentBriefs).values(row).run();
  return row;
}

export async function getContentBriefsForUser(userId: string): Promise<ContentBriefSummary[]> {
  const rows = await db
    .select()
    .from(contentBriefs)
    .where(eq(contentBriefs.userId, userId))
    .orderBy(desc(contentBriefs.createdAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    keywords: JSON.parse(row.keywords) as string[],
    createdAt: row.createdAt,
  }));
}

export async function getContentBriefById(
  id: string,
  userId: string,
): Promise<ContentBriefFull | null> {
  const rows = await db
    .select()
    .from(contentBriefs)
    .where(and(eq(contentBriefs.id, id), eq(contentBriefs.userId, userId)))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    title: row.title,
    keywords: JSON.parse(row.keywords) as string[],
    createdAt: row.createdAt,
    brief: JSON.parse(row.brief) as GeneratedContentBrief,
  };
}

export async function deleteContentBrief(id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(contentBriefs)
    .where(and(eq(contentBriefs.id, id), eq(contentBriefs.userId, userId)))
    .run();

  return result.rowsAffected > 0;
}
