import 'server-only';
import { randomUUID } from 'crypto';
import { getDb } from '@/server/db';

export type ActionType = 'write_article' | 'update_page' | 'create_brief' | 'investigate_serp' | 'merge_cannibalized' | 'other';
export type ActionStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

export interface KeywordAction {
  id: string;
  project_id: string;
  run_id: string | null;
  keyword: string;
  cluster: string | null;
  action_type: ActionType;
  status: ActionStatus;
  owner_label: string | null;
  due_at: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export async function createAction(params: {
  userId: string;
  projectId: string;
  runId?: string;
  keyword: string;
  cluster?: string;
  actionType: ActionType;
  ownerLabel?: string;
  dueAt?: string;
  notes?: string;
}) {
  const db = getDb();
  const id = randomUUID();
  await db.run(
    `INSERT INTO keyword_actions (id, project_id, run_id, keyword, cluster, action_type, status, owner_label, due_at, notes, created_by_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, params.projectId, params.runId || null, params.keyword, params.cluster || null, params.actionType, params.ownerLabel || null, params.dueAt || null, params.notes || null, params.userId],
  );
  return id;
}

export async function getProjectActions(projectId: string, status?: ActionStatus) {
  const db = getDb();
  if (status) {
    return db.all('SELECT * FROM keyword_actions WHERE project_id = ? AND status = ? ORDER BY created_at DESC', [projectId, status]);
  }
  return db.all('SELECT * FROM keyword_actions WHERE project_id = ? ORDER BY created_at DESC', [projectId]);
}

export async function updateActionStatus(actionId: string, status: ActionStatus) {
  const db = getDb();
  await db.run('UPDATE keyword_actions SET status = ?, updated_at = datetime(\'now\') WHERE id = ?', [status, actionId]);
}
