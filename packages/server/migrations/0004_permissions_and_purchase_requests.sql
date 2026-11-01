-- Granular admin permissions + contact-based purchase requests.
-- Paid content is arranged off-platform: the seller receives the buyer's email.

ALTER TABLE users ADD COLUMN can_buy INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN can_publish_free INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN can_publish_paid INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN can_chat INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS purchase_requests (
  id          TEXT PRIMARY KEY,
  repo_id     TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  buyer_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_email TEXT NOT NULL,
  message     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_requests_seller ON purchase_requests(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_buyer ON purchase_requests(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_repo ON purchase_requests(repo_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON purchase_requests(status);
