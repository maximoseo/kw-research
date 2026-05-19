import 'server-only';
import { randomUUID } from 'crypto';
import { getDb } from '@/server/db';

export interface SavedView {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  view_type: string;
  state_json: string;
  created_at: string;
  updated_at: string;
}

export interface CreateViewInput {
  userId: string;
  projectId: string;
  name: string;
  viewType: string;
  state: Record<string, unknown>;
}

export async function createView(input: CreateViewInput): Promise<SavedView> {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO saved_views (id, user_id, project_id, name, view_type, state_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.userId, input.projectId, input.name, input.viewType, JSON.stringify(input.state), now, now],
  );

  return {
    id,
    user_id: input.userId,
    project_id: input.projectId,
    name: input.name,
    view_type: input.viewType,
    state_json: JSON.stringify(input.state),
    created_at: now,
    updated_at: now,
  };
}

export async function getUserViews(userId: string, projectId: string): Promise<SavedView[]> {
  const db = getDb();
  return db.all(
    `SELECT * FROM saved_views WHERE user_id = ? AND project_id = ? ORDER BY updated_at DESC`,
    [userId, projectId],
  ) as Promise<SavedView[]>;
}

export async function deleteView(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.run(
    `DELETE FROM saved_views WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
  return result.changes > 0;
}
