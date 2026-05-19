-- Run step events for pipeline state persistence
CREATE TABLE IF NOT EXISTS run_step_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES research_runs(id),
  step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_run_step_events_run ON run_step_events(run_id, step);
