import 'server-only';
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
  return db.get('SELECT * FROM run_reviews WHERE run_id = ?', [runId]) as RunReview | undefined;
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
    await db.run(
      `UPDATE run_reviews SET status = ?, notes = ?, reviewed_at = CASE WHEN ? IN ('approved','needs_rerun') THEN datetime('now') ELSE reviewed_at END, updated_at = datetime('now') WHERE run_id = ?`,
      [params.status, params.notes || null, params.status, params.runId],
    );
  } else {
    await db.run(
      `INSERT INTO run_reviews (id, run_id, user_id, status, notes, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [randomUUID(), params.runId, params.userId, params.status, params.notes || null],
    );
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
  await db.run(
    `INSERT INTO notifications (id, user_id, project_id, run_id, type, title, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [randomUUID(), params.userId, params.projectId || null, params.runId || null, params.type, params.title, params.body || null],
  );
}

export async function getUserNotifications(userId: string, limit = 20) {
  const db = getDb();
  return db.all(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY read_at IS NULL DESC, created_at DESC LIMIT ?`,
    [userId, limit],
  );
}

export async function markNotificationRead(notificationId: string) {
  const db = getDb();
  await db.run(`UPDATE notifications SET read_at = datetime('now') WHERE id = ?`, [notificationId]);
}
