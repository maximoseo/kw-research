import 'server-only';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getDb } from '@/server/db';

export type RunReviewStatus = 'not_reviewed' | 'in_review' | 'approved' | 'needs_rerun';

export interface RunReview {
  id: string;
  run_id: string;
  user_id: string;
  status: RunReviewStatus;
  notes: string | null;
  reviewed_at: string | null;
  updated_at: string;
}

export async function getRunReview(runId: string): Promise<RunReview | undefined> {
  const db = getDb();
  const rows = await db.all(sql`SELECT * FROM run_reviews WHERE run_id = ${runId}`);
  return (rows[0] as RunReview) ?? undefined;
}

export async function setRunReview(params: {
  userId: string;
  runId: string;
  status: RunReviewStatus;
  notes?: string;
}) {
  const db = getDb();
  const existing = await getRunReview(params.runId);
  if (existing) {
    await db.run(sql`
      UPDATE run_reviews SET status = ${params.status}, notes = ${params.notes || null},
        reviewed_at = CASE WHEN ${params.status} IN ('approved','needs_rerun') THEN datetime('now') ELSE reviewed_at END,
        updated_at = datetime('now')
      WHERE run_id = ${params.runId}
    `);
  } else {
    await db.run(sql`
      INSERT INTO run_reviews (id, run_id, user_id, status, notes, updated_at)
      VALUES (${randomUUID()}, ${params.runId}, ${params.userId}, ${params.status}, ${params.notes || null}, datetime('now'))
    `);
  }
}

export async function createNotification(params: {
  userId: string;
  projectId?: string;
  runId?: string;
  type: string;
  title: string;
  body?: string;
}) {
  const db = getDb();
  await db.run(sql`
    INSERT INTO notifications (id, user_id, project_id, run_id, type, title, body, created_at)
    VALUES (${randomUUID()}, ${params.userId}, ${params.projectId || null}, ${params.runId || null}, ${params.type}, ${params.title}, ${params.body || null}, datetime('now'))
  `);
}

export async function getUserNotifications(userId: string, limit = 20) {
  const db = getDb();
  return db.all(sql`
    SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY read_at IS NULL DESC, created_at DESC LIMIT ${limit}
  `);
}

export async function markNotificationRead(notificationId: string) {
  const db = getDb();
  await db.run(sql`UPDATE notifications SET read_at = datetime('now') WHERE id = ${notificationId}`);
}
