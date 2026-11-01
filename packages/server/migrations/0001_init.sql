-- SCIEHub initial D1 schema (mirrors the former better-sqlite3 schema).

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  username        TEXT UNIQUE NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  nickname        TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  avatar_url      TEXT NOT NULL DEFAULT '',
  bio             TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  is_admin        INTEGER NOT NULL DEFAULT 0,
  is_suspended    INTEGER NOT NULL DEFAULT 0,
  token_version   INTEGER NOT NULL DEFAULT 0,
  deactivated_at  TEXT,
  wallet_balance  REAL NOT NULL DEFAULT 0,
  total_sales     INTEGER NOT NULL DEFAULT 0,
  total_purchases INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id TEXT NOT NULL,
  creator_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id  TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_requests (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_group_requests_group ON group_requests(group_id, status);

CREATE TABLE IF NOT EXISTS repos (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  owner_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id   TEXT NOT NULL,
  tags          TEXT NOT NULL DEFAULT '[]',
  view_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  pricing_type  TEXT NOT NULL DEFAULT 'free',
  price         REAL NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'CNY',
  total_sales   INTEGER NOT NULL DEFAULT 0,
  total_revenue REAL NOT NULL DEFAULT 0,
  preview_image TEXT
);
CREATE INDEX IF NOT EXISTS idx_repos_created ON repos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repos_owner ON repos(owner_id);
CREATE INDEX IF NOT EXISTS idx_repos_category ON repos(category_id);
CREATE INDEX IF NOT EXISTS idx_repos_pricing ON repos(pricing_type);
CREATE INDEX IF NOT EXISTS idx_repos_price ON repos(price);

CREATE TABLE IF NOT EXISTS repo_groups (
  repo_id  TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (repo_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_repo_groups_group ON repo_groups(group_id);

CREATE TABLE IF NOT EXISTS files (
  id             TEXT PRIMARY KEY,
  repo_id        TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  file_type      TEXT NOT NULL,
  file_size      TEXT NOT NULL,
  file_bytes     INTEGER NOT NULL DEFAULT 0,
  file_path      TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  view_count     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  is_preview     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_files_repo ON files(repo_id);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  repo_id    TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_repo ON comments(repo_id);

CREATE TABLE IF NOT EXISTS favorites (
  repo_id    TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (repo_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

CREATE TABLE IF NOT EXISTS login_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  email      TEXT NOT NULL,
  success    INTEGER NOT NULL DEFAULT 0,
  ip         TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  order_no        TEXT UNIQUE NOT NULL,
  buyer_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_id         TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  repo_name       TEXT NOT NULL,
  repo_owner_id   TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      REAL NOT NULL DEFAULT 0,
  total_amount    REAL NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'CNY',
  platform_fee    REAL NOT NULL DEFAULT 0,
  seller_earning  REAL NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TEXT NOT NULL,
  paid_at         TEXT,
  refunded_at     TEXT,
  cancelled_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_repo ON orders(repo_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(order_no);

CREATE TABLE IF NOT EXISTS purchases (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_id      TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  price        REAL NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'CNY',
  purchased_at TEXT NOT NULL,
  UNIQUE(user_id, repo_id)
);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_repo ON purchases(repo_id);

CREATE TABLE IF NOT EXISTS reviews (
  id            TEXT PRIMARY KEY,
  repo_id       TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating        INTEGER NOT NULL,
  title         TEXT NOT NULL DEFAULT '',
  content       TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, repo_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_repo ON reviews(repo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  amount        REAL NOT NULL,
  balance_after REAL NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'CNY',
  description   TEXT NOT NULL DEFAULT '',
  order_id      TEXT REFERENCES orders(id) ON DELETE SET NULL,
  reference_id  TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_type ON wallet_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_wallet_order ON wallet_transactions(order_id);

-- Payment/refund invariants are enforced in SQLite so a D1 batch cannot
-- double-charge, pay without funds, or refund an order twice.
CREATE TRIGGER IF NOT EXISTS trg_order_pay_pending
BEFORE UPDATE OF status ON orders
WHEN OLD.status <> 'pending' AND NEW.status = 'paid'
BEGIN
  SELECT RAISE(ABORT, 'order_not_pending');
END;

CREATE TRIGGER IF NOT EXISTS trg_order_pay_funds
BEFORE UPDATE OF status ON orders
WHEN NEW.status = 'paid'
  AND (SELECT wallet_balance FROM users WHERE id = NEW.buyer_id) < NEW.total_amount
BEGIN
  SELECT RAISE(ABORT, 'insufficient_balance');
END;

CREATE TRIGGER IF NOT EXISTS trg_order_refund_once
BEFORE UPDATE OF status ON orders
WHEN OLD.status = 'refunded' AND NEW.status = 'refunded'
BEGIN
  SELECT RAISE(ABORT, 'order_already_refunded');
END;
