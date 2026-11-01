-- Anonymous free publishing + the shared community board.

ALTER TABLE repos ADD COLUMN is_anonymous INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_repos_anonymous ON repos(is_anonymous);

CREATE TABLE IF NOT EXISTS community_posts (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_community_created ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_user ON community_posts(user_id);
