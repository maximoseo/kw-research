CREATE TABLE IF NOT EXISTS content_map (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keyword_id TEXT NOT NULL,
  page_url TEXT NOT NULL,
  page_title TEXT,
  mapped_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_map_user_id ON content_map(user_id);
CREATE INDEX IF NOT EXISTS idx_content_map_user_keyword ON content_map(user_id, keyword_id);
