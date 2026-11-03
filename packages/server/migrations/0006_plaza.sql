-- Plaza / campus wall: image + text posts with likes and comments.

CREATE TABLE IF NOT EXISTS plaza_posts (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL DEFAULT '',
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plaza_posts_created ON plaza_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plaza_posts_user ON plaza_posts(user_id);

CREATE TABLE IF NOT EXISTS plaza_images (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL REFERENCES plaza_posts(id) ON DELETE CASCADE,
  image_key  TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plaza_images_post ON plaza_images(post_id, sort_order);

CREATE TABLE IF NOT EXISTS plaza_likes (
  post_id    TEXT NOT NULL REFERENCES plaza_posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_plaza_likes_user ON plaza_likes(user_id);

CREATE TABLE IF NOT EXISTS plaza_comments (
  id           TEXT PRIMARY KEY,
  post_id      TEXT NOT NULL REFERENCES plaza_posts(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plaza_comments_post ON plaza_comments(post_id, created_at);
