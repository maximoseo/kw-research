import 'server-only';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getDb } from '@/server/db';

export async function logActivity(params: {
  userId: string;
  projectId: string;
  runId?: string;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  const id = randomUUID();
  await db.run(sql`
    INSERT INTO project_activity (id, user_id, project_id, run_id, event_type, message, metadata_json, created_at)
    VALUES (${id}, ${params.userId}, ${params.projectId}, ${params.runId || null}, ${params.eventType}, ${params.message}, ${JSON.stringify(params.metadata || {})}, datetime('now'))
  `);
  return id;
}

export async function getProjectActivity(projectId: string, limit = 20) {
  const db = getDb();
  return db.all(sql`
    SELECT * FROM project_activity WHERE project_id = ${projectId} ORDER BY created_at DESC LIMIT ${limit}
  `);
}
