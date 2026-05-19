-- Saved views for research dashboard
CREATE TABLE IF NOT EXISTS saved_views (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  view_type TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_saved_views_user ON saved_views(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_project ON saved_views(project_id);
