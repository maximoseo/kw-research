import 'server-only';
import { sql } from 'drizzle-orm';
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

  await db.run(sql`
    INSERT INTO saved_views (id, user_id, project_id, name, view_type, state_json, created_at, updated_at)
    VALUES (${id}, ${input.userId}, ${input.projectId}, ${input.name}, ${input.viewType}, ${JSON.stringify(input.state)}, ${now}, ${now})
  `);

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
  const rows = await db.all(sql`
    SELECT * FROM saved_views WHERE user_id = ${userId} AND project_id = ${projectId} ORDER BY updated_at DESC
  `);
  return rows as SavedView[];
}

export async function deleteView(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.run(sql`
    DELETE FROM saved_views WHERE id = ${id} AND user_id = ${userId}
  `);
  return result.rowsAffected > 0;
}
