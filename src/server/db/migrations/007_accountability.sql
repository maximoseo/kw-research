-- Project activity log
CREATE TABLE IF NOT EXISTS project_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  run_id TEXT REFERENCES research_runs(id),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_project_activity_project ON project_activity(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activity_user ON project_activity(user_id);

-- Run reviews
CREATE TABLE IF NOT EXISTS run_reviews (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES research_runs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'not_reviewed',
  notes TEXT,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_run_reviews_run ON run_reviews(run_id);

-- Keyword actions / tasks
CREATE TABLE IF NOT EXISTS keyword_actions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  run_id TEXT REFERENCES research_runs(id),
  keyword TEXT NOT NULL,
  cluster TEXT,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  owner_label TEXT,
  due_at TEXT,
  notes TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_keyword_actions_project ON keyword_actions(project_id, status);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  run_id TEXT REFERENCES research_runs(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at, created_at DESC);
