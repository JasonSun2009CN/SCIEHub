import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  categoryName,
  type AdminReportItem,
  type Comment,
  type Currency,
  type FileType,
  generateOrderNo,
  type Group,
  type GroupMember,
  type GroupRequest,
  type HomeData,
  type LeaderboardEntry,
  type LoginLog,
  type Order,
  type OrderStatus,
  type PurchaseRecord,
  type RepoFile,
  type Report,
  type ReportTarget,
  type Repository,
  type Review,
  type ReviewRating,
  type TransactionType,
  type User,
  type WalletOverview,
  type WalletTransaction,
} from '@sciehub/shared';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

db.exec(`
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
/* idx_repos_pricing / idx_repos_price are created below, after ensureColumns(),
   so databases created before the pricing migration don't fail on a missing column. */

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

-- ---------------------------------------------------------------------------
-- Marketplace tables
-- ---------------------------------------------------------------------------

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
`);

// Idempotent migration: add columns to databases created before newer features.
function ensureColumns(): void {
  const userCols = (db.prepare(`PRAGMA table_info(users)`).all() as any[]).map((c) => c.name);
  if (!userCols.includes('is_admin')) db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`);
  if (!userCols.includes('is_suspended')) db.exec(`ALTER TABLE users ADD COLUMN is_suspended INTEGER NOT NULL DEFAULT 0`);
  if (!userCols.includes('token_version')) db.exec(`ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0`);
  if (!userCols.includes('deactivated_at')) db.exec(`ALTER TABLE users ADD COLUMN deactivated_at TEXT`);
  if (!userCols.includes('wallet_balance')) db.exec(`ALTER TABLE users ADD COLUMN wallet_balance REAL NOT NULL DEFAULT 0`);
  if (!userCols.includes('total_sales')) db.exec(`ALTER TABLE users ADD COLUMN total_sales INTEGER NOT NULL DEFAULT 0`);
  if (!userCols.includes('total_purchases')) db.exec(`ALTER TABLE users ADD COLUMN total_purchases INTEGER NOT NULL DEFAULT 0`);

  const repoCols = (db.prepare(`PRAGMA table_info(repos)`).all() as any[]).map((c) => c.name);
  if (!repoCols.includes('pricing_type')) db.exec(`ALTER TABLE repos ADD COLUMN pricing_type TEXT NOT NULL DEFAULT 'free'`);
  if (!repoCols.includes('price')) db.exec(`ALTER TABLE repos ADD COLUMN price REAL NOT NULL DEFAULT 0`);
  if (!repoCols.includes('currency')) db.exec(`ALTER TABLE repos ADD COLUMN currency TEXT NOT NULL DEFAULT 'CNY'`);
  if (!repoCols.includes('total_sales')) db.exec(`ALTER TABLE repos ADD COLUMN total_sales INTEGER NOT NULL DEFAULT 0`);
  if (!repoCols.includes('total_revenue')) db.exec(`ALTER TABLE repos ADD COLUMN total_revenue REAL NOT NULL DEFAULT 0`);
  if (!repoCols.includes('preview_image')) db.exec(`ALTER TABLE repos ADD COLUMN preview_image TEXT`);

  const fileCols = (db.prepare(`PRAGMA table_info(files)`).all() as any[]).map((c) => c.name);
  if (!fileCols.includes('is_preview')) db.exec(`ALTER TABLE files ADD COLUMN is_preview INTEGER NOT NULL DEFAULT 0`);
}
ensureColumns();

// Indexes on columns added by ensureColumns (must run after the migration).
db.exec(`
CREATE INDEX IF NOT EXISTS idx_repos_pricing ON repos(pricing_type);
CREATE INDEX IF NOT EXISTS idx_repos_price ON repos(price);
`);

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function safeJson(value: string | null, fallback: string[] = []): string[] {
  try {
    const parsed = value ? JSON.parse(value) : fallback;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function splitCsv(value: string | null): string[] {
  return value ? String(value).split(',').filter(Boolean) : [];
}

const USER_SELECT = `
SELECT u.*,
  (SELECT COUNT(*) FROM repos r WHERE r.owner_id = u.id) AS repo_count,
  (SELECT COUNT(*) FROM files f JOIN repos r ON r.id = f.repo_id WHERE r.owner_id = u.id) AS file_count,
  (SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = u.id) AS group_count,
  (SELECT COALESCE(SUM(f2.download_count), 0) FROM files f2 JOIN repos r2 ON r2.id = f2.repo_id WHERE r2.owner_id = u.id) AS total_downloads,
  (SELECT COALESCE(SUM(f3.file_bytes), 0) FROM files f3 JOIN repos r3 ON r3.id = f3.repo_id WHERE r3.owner_id = u.id) AS total_bytes
FROM users u
`;

function mapUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    createdAt: row.created_at,
    repoCount: row.repo_count,
    fileCount: row.file_count,
    groupCount: row.group_count,
    totalDownloads: row.total_downloads,
    totalBytes: row.total_bytes,
    walletBalance: Number(row.wallet_balance ?? 0),
    totalSales: Number(row.total_sales ?? 0),
    totalPurchases: Number(row.total_purchases ?? 0),
    isAdmin: Boolean(row.is_admin),
    isSuspended: Boolean(row.is_suspended),
  };
}

const REPO_SELECT = `
SELECT p.*,
  u.username AS owner_username, u.nickname AS owner_nickname,
  u.avatar_url AS owner_avatar, u.bio AS owner_bio, u.created_at AS owner_created_at,
  (SELECT COUNT(*) FROM repos r0 WHERE r0.owner_id = u.id) AS owner_repo_count,
  (SELECT COUNT(*) FROM files f0 JOIN repos r0 ON r0.id = f0.repo_id WHERE r0.owner_id = u.id) AS owner_file_count,
  (SELECT COUNT(*) FROM group_members gm0 WHERE gm0.user_id = u.id) AS owner_group_count,
  (SELECT COALESCE(SUM(f1.download_count), 0) FROM files f1 JOIN repos r1 ON r1.id = f1.repo_id WHERE r1.owner_id = u.id) AS owner_total_downloads,
  (SELECT COALESCE(SUM(f2.file_bytes), 0) FROM files f2 JOIN repos r2 ON r2.id = f2.repo_id WHERE r2.owner_id = u.id) AS owner_total_bytes,
  (SELECT COALESCE(u.wallet_balance, 0) FROM users u2 WHERE u2.id = u.id) AS owner_wallet_balance,
  (SELECT COALESCE(u.total_sales, 0) FROM users u3 WHERE u3.id = u.id) AS owner_total_sales,
  (SELECT COALESCE(u.total_purchases, 0) FROM users u4 WHERE u4.id = u.id) AS owner_total_purchases,
  (SELECT COUNT(*) FROM files f WHERE f.repo_id = p.id) AS file_count,
  (SELECT COALESCE(SUM(f.file_bytes), 0) FROM files f WHERE f.repo_id = p.id) AS total_bytes,
  (SELECT COALESCE(SUM(f.download_count), 0) FROM files f WHERE f.repo_id = p.id) AS download_count,
  (SELECT COUNT(*) FROM comments c WHERE c.repo_id = p.id) AS comment_count,
  (SELECT COUNT(*) FROM favorites fv WHERE fv.repo_id = p.id) AS favorite_count,
  (SELECT COUNT(*) FROM reviews rv WHERE rv.repo_id = p.id) AS review_count,
  (SELECT COALESCE(AVG(rv.rating), 0) FROM reviews rv WHERE rv.repo_id = p.id) AS average_rating,
  (SELECT group_concat(g.id, ',') FROM repo_groups rg JOIN groups g ON g.id = rg.group_id WHERE rg.repo_id = p.id) AS group_ids,
  (SELECT group_concat(g.name, ',') FROM repo_groups rg JOIN groups g ON g.id = rg.group_id WHERE rg.repo_id = p.id) AS group_names
FROM repos p
JOIN users u ON u.id = p.owner_id
`;

function mapRepo(row: any, favoriteIds: Set<string>, purchasedIds: Set<string>): Repository {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    ownerId: row.owner_id,
    owner: {
      id: row.owner_id,
      username: row.owner_username,
      nickname: row.owner_nickname,
      avatarUrl: row.owner_avatar,
      bio: row.owner_bio,
      createdAt: row.owner_created_at,
      repoCount: row.owner_repo_count,
      fileCount: row.owner_file_count,
      groupCount: row.owner_group_count,
      totalDownloads: row.owner_total_downloads,
      totalBytes: row.owner_total_bytes,
      walletBalance: Number(row.owner_wallet_balance ?? 0),
      totalSales: Number(row.owner_total_sales ?? 0),
      totalPurchases: Number(row.owner_total_purchases ?? 0),
    },
    categoryId: row.category_id,
    categoryName: categoryName(row.category_id),
    tags: safeJson(row.tags),
    fileCount: row.file_count,
    totalBytes: row.total_bytes,
    downloadCount: row.download_count,
    viewCount: row.view_count,
    commentCount: row.comment_count,
    favoriteCount: row.favorite_count,
    reviewCount: row.review_count,
    averageRating: Number(row.average_rating ?? 0),
    groupIds: splitCsv(row.group_ids),
    groupNames: splitCsv(row.group_names),
    createdAt: row.created_at,
    pricingType: (row.pricing_type ?? 'free') as 'free' | 'paid',
    price: Number(row.price ?? 0),
    currency: (row.currency ?? 'CNY') as Currency,
    totalSales: Number(row.total_sales ?? 0),
    totalRevenue: Number(row.total_revenue ?? 0),
    isFavorite: favoriteIds.has(row.id),
    isOwner: false,
    isPurchased: purchasedIds.has(row.id),
    previewImageUrl: row.preview_image ?? undefined,
  };
}

function mapFile(row: any): RepoFile {
  return {
    id: row.id,
    repoId: row.repo_id,
    title: row.title,
    description: row.description ?? '',
    fileType: row.file_type,
    fileSize: row.file_size,
    fileBytes: row.file_bytes,
    filePath: row.file_path,
    downloadCount: row.download_count,
    viewCount: row.view_count,
    createdAt: row.created_at,
    isPreview: Boolean(row.is_preview),
  };
}

const GROUP_SELECT = `
SELECT g.*,
  u.username AS creator_username, u.nickname AS creator_nickname,
  u.avatar_url AS creator_avatar, u.bio AS creator_bio, u.created_at AS creator_created_at,
  (SELECT COUNT(*) FROM repos r0 WHERE r0.owner_id = g.creator_id) AS creator_repo_count,
  (SELECT COUNT(*) FROM files f0 JOIN repos r0 ON r0.id = f0.repo_id WHERE r0.owner_id = g.creator_id) AS creator_file_count,
  (SELECT COUNT(*) FROM group_members gm0 WHERE gm0.user_id = g.creator_id) AS creator_group_count,
  (SELECT COALESCE(SUM(f1.download_count), 0) FROM files f1 JOIN repos r1 ON r1.id = f1.repo_id WHERE r1.owner_id = g.creator_id) AS creator_total_downloads,
  (SELECT COALESCE(SUM(f2.file_bytes), 0) FROM files f2 JOIN repos r2 ON r2.id = f2.repo_id WHERE r2.owner_id = g.creator_id) AS creator_total_bytes,
  (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
  (SELECT COUNT(*) FROM repo_groups rg WHERE rg.group_id = g.id) AS repo_count
FROM groups g
JOIN users u ON u.id = g.creator_id
`;

function mapGroup(
  row: any,
  memberGroupIds: Set<string>,
  adminGroupIds: Set<string>,
  pendingRequests: Map<string, 'pending'>,
): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    categoryId: row.category_id,
    categoryName: categoryName(row.category_id),
    creatorId: row.creator_id,
    creator: {
      id: row.creator_id,
      username: row.creator_username,
      nickname: row.creator_nickname,
      avatarUrl: row.creator_avatar,
      bio: row.creator_bio,
      createdAt: row.creator_created_at,
      repoCount: row.creator_repo_count,
      fileCount: row.creator_file_count,
      groupCount: row.creator_group_count,
      totalDownloads: row.creator_total_downloads,
      totalBytes: row.creator_total_bytes,
      walletBalance: 0,
      totalSales: 0,
      totalPurchases: 0,
    },
    memberCount: row.member_count,
    repoCount: row.repo_count,
    createdAt: row.created_at,
    isMember: memberGroupIds.has(row.id),
    isAdmin: adminGroupIds.has(row.id),
    joinStatus: pendingRequests.get(row.id) ?? null,
  };
}

function mapMember(row: any): GroupMember {
  return {
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    user: mapUser(row),
  };
}

function mapOrder(row: any, buyer: User, seller: User): Order {
  return {
    id: row.id,
    orderNo: row.order_no,
    buyerId: row.buyer_id,
    buyer,
    sellerId: row.seller_id,
    seller,
    repoId: row.repo_id,
    repoName: row.repo_name,
    repoOwnerId: row.repo_owner_id,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    totalAmount: Number(row.total_amount),
    currency: row.currency as Currency,
    platformFee: Number(row.platform_fee),
    sellerEarning: Number(row.seller_earning),
    status: row.status as OrderStatus,
    createdAt: row.created_at,
    paidAt: row.paid_at ?? undefined,
    refundedAt: row.refunded_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
  };
}

function mapReview(row: any, user: User): Review {
  return {
    id: row.id,
    repoId: row.repo_id,
    userId: row.user_id,
    user,
    rating: row.rating as ReviewRating,
    title: row.title ?? '',
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    helpfulCount: Number(row.helpful_count),
  };
}

function mapWalletTx(row: any, user?: User): WalletTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    user: user ?? ({} as User),
    type: row.type as TransactionType,
    amount: Number(row.amount),
    balanceAfter: Number(row.balance_after),
    currency: row.currency as Currency,
    description: row.description ?? '',
    orderId: row.order_id ?? undefined,
    referenceId: row.reference_id ?? undefined,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Purchased / favorite helpers
// ---------------------------------------------------------------------------

export function purchasedRepoIdsForUser(userId: string | null): Set<string> {
  const set = new Set<string>();
  if (!userId) return set;
  const rows = db.prepare(`SELECT repo_id FROM purchases WHERE user_id = ?`).all(userId) as any[];
  for (const r of rows) set.add(r.repo_id);
  return set;
}

export function favoriteRepoIdsForUser(userId: string | null): Set<string> {
  const set = new Set<string>();
  if (!userId) return set;
  const rows = db.prepare(`SELECT repo_id FROM favorites WHERE user_id = ?`).all(userId) as any[];
  for (const r of rows) set.add(r.repo_id);
  return set;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function getUserById(id: string): User | null {
  const row = db.prepare(`${USER_SELECT} WHERE u.id = ?`).get(id) as any;
  return row ? mapUser(row) : null;
}

export function getUserByUsername(username: string): User | null {
  const row = db.prepare(`${USER_SELECT} WHERE u.username = ?`).get(username) as any;
  return row ? mapUser(row) : null;
}

export function getUserByEmail(email: string): User | null {
  const row = db.prepare(`${USER_SELECT} WHERE u.email = ?`).get(email) as any;
  return row ? mapUser(row) : null;
}

export function createUser(input: {
  username: string;
  email: string;
  nickname: string;
  passwordHash: string;
  avatarUrl: string;
}): User {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, username, email, nickname, password_hash, avatar_url, bio, created_at, wallet_balance, total_sales, total_purchases)
     VALUES (?, ?, ?, ?, ?, ?, '', ?, 0, 0, 0)`,
  ).run(id, input.username, input.email, input.nickname, input.passwordHash, input.avatarUrl, now);
  return getUserById(id)!;
}

export function updateUserProfile(
  id: string,
  patch: { nickname?: string; bio?: string; avatarUrl?: string },
): User | null {
  db.prepare(
    `UPDATE users SET nickname = COALESCE(?, nickname), bio = COALESCE(?, bio), avatar_url = COALESCE(?, avatar_url) WHERE id = ?`,
  ).run(patch.nickname ?? null, patch.bio ?? null, patch.avatarUrl ?? null, id);
  return getUserById(id);
}

export function getUserPasswordHash(id: string): string | null {
  const row = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(id) as any;
  return row?.password_hash ?? null;
}

export function setUserPassword(id: string, hash: string): void {
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hash, id);
}

export function adjustWalletBalance(userId: string, delta: number): number {
  db.prepare(`UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?`).run(delta, userId);
  return Number((db.prepare(`SELECT wallet_balance FROM users WHERE id = ?`).get(userId) as any).wallet_balance);
}

export function incrementUserSales(userId: string, amountRevenue: number = 0): void {
  db.prepare(`UPDATE users SET total_sales = total_sales + 1 WHERE id = ?`).run(userId);
  if (amountRevenue) {
    // revenue tracking could be added; for now total_sales count is enough
  }
}

export function incrementUserPurchases(userId: string): void {
  db.prepare(`UPDATE users SET total_purchases = total_purchases + 1 WHERE id = ?`).run(userId);
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export interface ListReposArgs {
  search?: string;
  category?: string;
  sort?: 'recent' | 'popular' | 'views' | 'price_asc' | 'price_desc' | 'rating' | 'sales';
  pricingType?: 'free' | 'paid';
  ownerId?: string;
  groupId?: string;
  minPrice?: number;
  maxPrice?: number;
  limit: number;
  offset: number;
}

export function listRepos(args: ListReposArgs, currentUserId: string | null): { items: Repository[]; total: number } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (args.search) {
    where.push(`(p.name LIKE ? OR p.description LIKE ?)`);
    params.push(`%${args.search}%`, `%${args.search}%`);
  }
  if (args.category) {
    where.push(`p.category_id = ?`);
    params.push(args.category);
  }
  if (args.pricingType) {
    where.push(`p.pricing_type = ?`);
    params.push(args.pricingType);
  }
  if (args.minPrice !== undefined) {
    where.push(`p.price >= ?`);
    params.push(args.minPrice);
  }
  if (args.maxPrice !== undefined) {
    where.push(`p.price <= ?`);
    params.push(args.maxPrice);
  }
  if (args.ownerId) {
    where.push(`p.owner_id = ?`);
    params.push(args.ownerId);
  }
  if (args.groupId) {
    where.push(`p.id IN (SELECT repo_id FROM repo_groups WHERE group_id = ?)`);
    params.push(args.groupId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const orderBy =
    args.sort === 'popular'
      ? 'ORDER BY download_count DESC, view_count DESC'
      : args.sort === 'views'
        ? 'ORDER BY p.view_count DESC'
        : args.sort === 'price_asc'
          ? "ORDER BY CASE WHEN p.pricing_type='free' THEN 0 ELSE 1 END ASC, p.price ASC"
          : args.sort === 'price_desc'
            ? "ORDER BY CASE WHEN p.pricing_type='free' THEN 0 ELSE 1 END DESC, p.price DESC"
            : args.sort === 'rating'
              ? 'ORDER BY average_rating DESC NULLS LAST, review_count DESC'
              : args.sort === 'sales'
                ? 'ORDER BY p.total_sales DESC, p.total_revenue DESC'
                : 'ORDER BY p.created_at DESC';

  const total = (db.prepare(`SELECT COUNT(*) AS c FROM repos p ${whereSql}`).get(...params) as any).c;
  const rows = db.prepare(`${REPO_SELECT} ${whereSql} ${orderBy} LIMIT ? OFFSET ?`).all(...params, args.limit, args.offset) as any[];

  const favorites = favoriteRepoIdsForUser(currentUserId);
  const purchased = purchasedRepoIdsForUser(currentUserId);
  return { items: rows.map((r) => mapRepo(r, favorites, purchased)), total };
}

export function getRepoById(id: string, currentUserId: string | null, incrementView = false): Repository | null {
  const row = db.prepare(`${REPO_SELECT} WHERE p.id = ?`).get(id) as any;
  if (!row) return null;
  if (incrementView) {
    db.prepare(`UPDATE repos SET view_count = view_count + 1 WHERE id = ?`).run(id);
    row.view_count += 1;
  }
  const repo = mapRepo(row, favoriteRepoIdsForUser(currentUserId), purchasedRepoIdsForUser(currentUserId));
  repo.isOwner = currentUserId === repo.ownerId;
  return repo;
}

export function listRepoFiles(repoId: string): RepoFile[] {
  const rows = db
    .prepare(`SELECT * FROM files WHERE repo_id = ? ORDER BY is_preview DESC, created_at DESC`)
    .all(repoId) as any[];
  return rows.map(mapFile);
}

export function getRepoFileById(fileId: string): RepoFile | null {
  const row = db.prepare(`SELECT * FROM files WHERE id = ?`).get(fileId) as any;
  return row ? mapFile(row) : null;
}

export function createRepo(input: {
  name: string;
  description: string;
  categoryId: string;
  tags: string[];
  ownerId: string;
  pricingType: 'free' | 'paid';
  price: number;
  currency: Currency;
  previewImageUrl?: string;
}): Repository {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO repos (id, name, description, owner_id, category_id, tags, created_at, pricing_type, price, currency, total_sales, total_revenue, preview_image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
  ).run(
    id,
    input.name,
    input.description,
    input.ownerId,
    input.categoryId,
    JSON.stringify(input.tags),
    now,
    input.pricingType,
    input.price,
    input.currency,
    input.previewImageUrl ?? null,
  );
  return getRepoById(id, input.ownerId, false)!;
}

export function updateRepo(
  id: string,
  patch: {
    name?: string;
    description?: string;
    categoryId?: string;
    tags?: string[];
    pricingType?: 'free' | 'paid';
    price?: number;
    currency?: Currency;
    previewImageUrl?: string | null;
  },
): Repository | null {
  db.prepare(
    `UPDATE repos SET
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       category_id = COALESCE(?, category_id),
       tags = COALESCE(?, tags),
       pricing_type = COALESCE(?, pricing_type),
       price = COALESCE(?, price),
       currency = COALESCE(?, currency),
       preview_image = COALESCE(?, preview_image)
     WHERE id = ?`,
  ).run(
    patch.name ?? null,
    patch.description ?? null,
    patch.categoryId ?? null,
    patch.tags ? JSON.stringify(patch.tags) : null,
    patch.pricingType ?? null,
    patch.price ?? null,
    patch.currency ?? null,
    patch.previewImageUrl !== undefined ? (patch.previewImageUrl ?? null) : undefined,
    id,
  );
  return getRepoById(id, null, false);
}

export function deleteRepo(id: string): void {
  db.prepare(`DELETE FROM repos WHERE id = ?`).run(id);
}

export function addFileToRepo(input: {
  repoId: string;
  title: string;
  description: string;
  fileType: FileType;
  fileSize: string;
  fileBytes: number;
  filePath: string;
  isPreview?: boolean;
}): RepoFile {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO files (id, repo_id, title, description, file_type, file_size, file_bytes, file_path, created_at, is_preview)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.repoId,
    input.title,
    input.description,
    input.fileType,
    input.fileSize,
    input.fileBytes,
    input.filePath,
    now,
    input.isPreview ? 1 : 0,
  );
  return getRepoFileById(id)!;
}

export function incrementFileDownload(fileId: string): void {
  db.prepare(`UPDATE files SET download_count = download_count + 1 WHERE id = ?`).run(fileId);
}

export function incrementRepoSales(repoId: string, revenue: number): void {
  db.prepare(`UPDATE repos SET total_sales = total_sales + 1, total_revenue = total_revenue + ? WHERE id = ?`).run(revenue, repoId);
}

export function hasUserPurchasedRepo(userId: string, repoId: string): boolean {
  return Boolean(db.prepare(`SELECT 1 FROM purchases WHERE user_id = ? AND repo_id = ?`).get(userId, repoId));
}

export function listReposByOwner(userId: string): Repository[] {
  const rows = db.prepare(`${REPO_SELECT} WHERE p.owner_id = ? ORDER BY p.created_at DESC`).all(userId) as any[];
  return rows.map((r) => mapRepo(r, favoriteRepoIdsForUser(userId), purchasedRepoIdsForUser(userId)));
}

export function listFavorites(userId: string): Repository[] {
  const rows = db
    .prepare(
      `${REPO_SELECT} JOIN favorites fv ON fv.repo_id = p.id WHERE fv.user_id = ? ORDER BY fv.created_at DESC`,
    )
    .all(userId) as any[];
  return rows.map((r) => mapRepo(r, favoriteRepoIdsForUser(userId), purchasedRepoIdsForUser(userId)));
}

export function listPurchases(userId: string): PurchaseRecord[] {
  const rows = db
    .prepare(
      `SELECT p.*, pr.*
       FROM purchases p
       JOIN repos pr ON pr.id = p.repo_id
       WHERE p.user_id = ?
       ORDER BY p.purchased_at DESC`,
    )
    .all(userId) as any[];
  const favs = favoriteRepoIdsForUser(userId);
  const purchased = purchasedRepoIdsForUser(userId);
  return rows.map((row) => {
    // Repo SELECT enriched fields require separate query, fallback minimal
    const repo = getRepoById(row.repo_id, userId) ?? ({} as Repository);
    return {
      id: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      repoId: row.repo_id,
      repo,
      price: Number(row.price),
      currency: row.currency as Currency,
      purchasedAt: row.purchased_at,
    };
  });
}

export function getPurchaseByOrder(orderId: string): PurchaseRecord | null {
  const row = db.prepare(`SELECT * FROM purchases WHERE order_id = ?`).get(orderId) as any;
  if (!row) return null;
  const repo = getRepoById(row.repo_id, row.user_id) ?? ({} as Repository);
  return {
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    repoId: row.repo_id,
    repo,
    price: Number(row.price),
    currency: row.currency as Currency,
    purchasedAt: row.purchased_at,
  };
}

export function toggleFavoriteRepo(repoId: string, userId: string): boolean {
  const existing = db.prepare(`SELECT 1 FROM favorites WHERE repo_id = ? AND user_id = ?`).get(repoId, userId);
  if (existing) {
    db.prepare(`DELETE FROM favorites WHERE repo_id = ? AND user_id = ?`).run(repoId, userId);
    return false;
  }
  db.prepare(`INSERT INTO favorites (repo_id, user_id, created_at) VALUES (?, ?, ?)`).run(
    repoId,
    userId,
    new Date().toISOString(),
  );
  return true;
}

export function isRepoSharedWithGroup(repoId: string, groupId: string): boolean {
  return Boolean(db.prepare(`SELECT 1 FROM repo_groups WHERE repo_id = ? AND group_id = ?`).get(repoId, groupId));
}

export function shareRepoToGroup(repoId: string, groupId: string): void {
  db.prepare(`INSERT OR IGNORE INTO repo_groups (repo_id, group_id) VALUES (?, ?)`).run(repoId, groupId);
}

export function unshareRepoFromGroup(repoId: string, groupId: string): void {
  db.prepare(`DELETE FROM repo_groups WHERE repo_id = ? AND group_id = ?`).run(repoId, groupId);
}

export function listReposInGroup(groupId: string, currentUserId: string | null): Repository[] {
  const rows = db
    .prepare(
      `${REPO_SELECT}
       JOIN repo_groups rg ON rg.repo_id = p.id
       WHERE rg.group_id = ?
       ORDER BY rg.rowid DESC`,
    )
    .all(groupId) as any[];
  return rows.map((r) => mapRepo(r, favoriteRepoIdsForUser(currentUserId), purchasedRepoIdsForUser(currentUserId)));
}

export function listRecentRepos(limit: number, currentUserId: string | null): Repository[] {
  const rows = db.prepare(`${REPO_SELECT} ORDER BY p.created_at DESC LIMIT ?`).all(limit) as any[];
  return rows.map((r) => mapRepo(r, favoriteRepoIdsForUser(currentUserId), purchasedRepoIdsForUser(currentUserId)));
}

export function listHotRepos(limit: number, currentUserId: string | null): Repository[] {
  const rows = db
    .prepare(`${REPO_SELECT} ORDER BY download_count DESC, p.total_sales DESC, p.view_count DESC LIMIT ?`)
    .all(limit) as any[];
  return rows.map((r) => mapRepo(r, favoriteRepoIdsForUser(currentUserId), purchasedRepoIdsForUser(currentUserId)));
}

export function listFreeRepos(limit: number, currentUserId: string | null): Repository[] {
  const rows = db
    .prepare(`${REPO_SELECT} WHERE p.pricing_type = 'free' ORDER BY p.created_at DESC LIMIT ?`)
    .all(limit) as any[];
  return rows.map((r) => mapRepo(r, favoriteRepoIdsForUser(currentUserId), purchasedRepoIdsForUser(currentUserId)));
}

// ---------------------------------------------------------------------------
// Orders / Checkout
// ---------------------------------------------------------------------------

export function createOrder(input: {
  buyerId: string;
  sellerId: string;
  repoId: string;
  repoName: string;
  repoOwnerId: string;
  quantity?: number;
  unitPrice: number;
  currency: Currency;
  platformFee: number;
  sellerEarning: number;
}): Order {
  const id = randomUUID();
  const now = new Date().toISOString();
  const orderNo = generateOrderNo();
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  const totalAmount = input.unitPrice * quantity;
  db.prepare(
    `INSERT INTO orders (id, order_no, buyer_id, seller_id, repo_id, repo_name, repo_owner_id, quantity, unit_price, total_amount, currency, platform_fee, seller_earning, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(
    id,
    orderNo,
    input.buyerId,
    input.sellerId,
    input.repoId,
    input.repoName,
    input.repoOwnerId,
    quantity,
    input.unitPrice,
    totalAmount,
    input.currency,
    input.platformFee,
    input.sellerEarning,
    now,
  );
  return getOrderById(id)!;
}

export function getOrderById(id: string): Order | null {
  const row = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as any;
  if (!row) return null;
  const buyer = getUserById(row.buyer_id) ?? ({} as User);
  const seller = getUserById(row.seller_id) ?? ({} as User);
  return mapOrder(row, buyer, seller);
}

export function getOrderByNo(orderNo: string): Order | null {
  const row = db.prepare(`SELECT * FROM orders WHERE order_no = ?`).get(orderNo) as any;
  if (!row) return null;
  const buyer = getUserById(row.buyer_id) ?? ({} as User);
  const seller = getUserById(row.seller_id) ?? ({} as User);
  return mapOrder(row, buyer, seller);
}

export function listOrdersByBuyer(userId: string, limit = 50, offset = 0): { items: Order[]; total: number } {
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE buyer_id = ?`).get(userId) as any).c;
  const rows = db
    .prepare(`SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(userId, limit, offset) as any[];
  const sellerCache = new Map<string, User>();
  const items = rows.map((row) => {
    let seller = sellerCache.get(row.seller_id);
    if (!seller) {
      seller = getUserById(row.seller_id) ?? ({} as User);
      sellerCache.set(row.seller_id, seller);
    }
    const buyer = getUserById(row.buyer_id) ?? ({} as User);
    return mapOrder(row, buyer, seller);
  });
  return { items, total };
}

export function listOrdersBySeller(userId: string, limit = 50, offset = 0): { items: Order[]; total: number } {
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE seller_id = ?`).get(userId) as any).c;
  const rows = db
    .prepare(`SELECT * FROM orders WHERE seller_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(userId, limit, offset) as any[];
  const buyerCache = new Map<string, User>();
  const items = rows.map((row) => {
    let buyer = buyerCache.get(row.buyer_id);
    if (!buyer) {
      buyer = getUserById(row.buyer_id) ?? ({} as User);
      buyerCache.set(row.buyer_id, buyer);
    }
    const seller = getUserById(row.seller_id) ?? ({} as User);
    return mapOrder(row, buyer, seller);
  });
  return { items, total };
}

export function listUserOrders(args: {
  userId: string;
  role: 'buyer' | 'seller';
  status?: OrderStatus;
  limit?: number;
  offset?: number;
}): { items: Order[]; total: number } {
  const { userId, role, status } = args;
  const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
  const offset = Math.max(Number(args.offset) || 0, 0);
  const column = role === 'seller' ? 'seller_id' : 'buyer_id';
  const where = [`${column} = ?`];
  const params: unknown[] = [userId];
  if (status) {
    where.push(`status = ?`);
    params.push(status);
  }
  const whereSql = where.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE ${whereSql}`).get(...params) as any).c;
  const rows = db
    .prepare(`SELECT * FROM orders WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as any[];
  const personCache = new Map<string, User>();
  const items = rows.map((row) => {
    const buyerId = role === 'seller' ? row.buyer_id : userId;
    const sellerId = role === 'buyer' ? row.seller_id : userId;
    let buyer = personCache.get(buyerId);
    if (!buyer) {
      buyer = getUserById(buyerId) ?? ({} as User);
      personCache.set(buyerId, buyer);
    }
    let seller = personCache.get(sellerId);
    if (!seller) {
      seller = getUserById(sellerId) ?? ({} as User);
      personCache.set(sellerId, seller);
    }
    return mapOrder(row, buyer, seller);
  });
  return { items, total };
}

export interface PayOrderResult {
  success: boolean;
  order?: Order;
  purchase?: PurchaseRecord;
  error?: string;
  code?: string;
}

export function payOrderWithWallet(orderId: string, buyerId: string): PayOrderResult {
  const order = getOrderById(orderId);
  if (!order) return { success: false, error: 'Order not found', code: 'order_not_found' };
  if (order.buyerId !== buyerId) return { success: false, error: 'Not your order', code: 'not_your_order' };
  if (order.status !== 'pending') {
    return { success: false, error: `Order is already ${order.status}`, code: 'already_paid' };
  }
  if (order.totalAmount > 0) {
    const buyer = getUserById(buyerId);
    if (!buyer || buyer.walletBalance < order.totalAmount) {
      return { success: false, error: 'Insufficient wallet balance', code: 'insufficient_balance' };
    }
  }

  const tx = db.transaction(() => {
    const now = new Date().toISOString();
    // Mark order paid
    db.prepare(`UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?`).run(now, order.id);

    // Charge buyer wallet
    if (order.totalAmount > 0) {
      const buyerNewBal = adjustWalletBalance(buyerId, -order.totalAmount);
      recordWalletTx({
        userId: buyerId,
        type: 'purchase',
        amount: -order.totalAmount,
        balanceAfter: buyerNewBal,
        currency: order.currency,
        description: `Purchase: ${order.repoName}`,
        orderId: order.id,
      });
    }

    // Create purchase record (UNIQUE protects against double purchase)
    db.prepare(
      `INSERT OR IGNORE INTO purchases (id, order_id, user_id, repo_id, price, currency, purchased_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(randomUUID(), order.id, buyerId, order.repoId, order.unitPrice, order.currency, now);

    // Credit seller wallet + record sale transaction
    if (order.sellerEarning > 0) {
      const sellerNewBal = adjustWalletBalance(order.sellerId, order.sellerEarning);
      recordWalletTx({
        userId: order.sellerId,
        type: 'sale',
        amount: order.sellerEarning,
        balanceAfter: sellerNewBal,
        currency: order.currency,
        description: `Sale: ${order.repoName} (order ${order.orderNo})`,
        orderId: order.id,
      });
    }

    // Increment counters
    incrementRepoSales(order.repoId, order.sellerEarning);
    incrementUserSales(order.sellerId);
    incrementUserPurchases(buyerId);
  });

  try {
    tx();
    return { success: true, order: getOrderById(orderId)!, purchase: getPurchaseByOrder(orderId) ?? undefined };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Payment failed', code: 'payment_failed' };
  }
}

export function refundOrder(orderId: string, adminId: string, reason = ''): PayOrderResult {
  const order = getOrderById(orderId);
  if (!order) return { success: false, error: 'Order not found', code: 'order_not_found' };
  if (order.status !== 'paid') {
    return { success: false, error: 'Only paid orders can be refunded', code: 'not_refundable' };
  }

  const tx = db.transaction(() => {
    const now = new Date().toISOString();
    db.prepare(`UPDATE orders SET status = 'refunded', refunded_at = ? WHERE id = ?`).run(now, order.id);

    // Reverse buyer charge
    if (order.totalAmount > 0) {
      const bal = adjustWalletBalance(order.buyerId, order.totalAmount);
      recordWalletTx({
        userId: order.buyerId,
        type: 'refund',
        amount: order.totalAmount,
        balanceAfter: bal,
        currency: order.currency,
        description: `Refund for order ${order.orderNo}${reason ? ` - ${reason}` : ''}`,
        orderId: order.id,
      });
    }
    // Reverse seller credit
    if (order.sellerEarning > 0) {
      const bal2 = adjustWalletBalance(order.sellerId, -order.sellerEarning);
      recordWalletTx({
        userId: order.sellerId,
        type: 'refund',
        amount: -order.sellerEarning,
        balanceAfter: bal2,
        currency: order.currency,
        description: `Reverse earning for refunded order ${order.orderNo}`,
        orderId: order.id,
      });
    }
    // Remove purchase record (user loses access)
    db.prepare(`DELETE FROM purchases WHERE order_id = ?`).run(order.id);
    // Roll back repo sales counters (approximate: decrement by 1, revenue subtract seller earning)
    db.prepare(`UPDATE repos SET total_sales = MAX(0, total_sales - 1), total_revenue = MAX(0, total_revenue - ?) WHERE id = ?`).run(order.sellerEarning, order.repoId);
    db.prepare(`UPDATE users SET total_sales = MAX(0, total_sales - 1) WHERE id = ?`).run(order.sellerId);
    db.prepare(`UPDATE users SET total_purchases = MAX(0, total_purchases - 1) WHERE id = ?`).run(order.buyerId);
  });

  try {
    tx();
    return { success: true, order: getOrderById(orderId)! };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Refund failed', code: 'refund_failed' };
  }
}

// ---------------------------------------------------------------------------
// Comments / Reviews
// ---------------------------------------------------------------------------

export function listRepoComments(repoId: string): Comment[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.repo_id, c.user_id, c.content, c.created_at,
              u.username AS username, u.nickname AS nickname, u.avatar_url AS avatar_url,
              u.bio AS bio, u.created_at AS user_created_at,
              (SELECT COUNT(*) FROM repos r WHERE r.owner_id = u.id) AS repo_count,
              (SELECT COUNT(*) FROM files f JOIN repos r2 ON r2.id = f.repo_id WHERE r2.owner_id = u.id) AS file_count,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = u.id) AS group_count,
              (SELECT COALESCE(SUM(f2.download_count), 0) FROM files f2 JOIN repos r3 ON r3.id = f2.repo_id WHERE r3.owner_id = u.id) AS total_downloads,
              (SELECT COALESCE(SUM(f3.file_bytes), 0) FROM files f3 JOIN repos r4 ON r4.id = f3.repo_id WHERE r4.owner_id = u.id) AS total_bytes,
              u.wallet_balance AS owner_wallet_balance,
              u.total_sales AS owner_total_sales,
              u.total_purchases AS owner_total_purchases
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.repo_id = ?
       ORDER BY c.created_at ASC`,
    )
    .all(repoId) as any[];
  return rows.map((row) => ({
    id: row.id,
    repoId: row.repo_id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
    user: mapUser(row),
  }));
}

export function commentExists(commentId: string): boolean {
  return Boolean(db.prepare(`SELECT 1 FROM comments WHERE id = ?`).get(commentId));
}

export function createRepoComment(repoId: string, userId: string, content: string): Comment {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO comments (id, repo_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    repoId,
    userId,
    content,
    now,
  );
  return listRepoComments(repoId).find((c) => c.id === id)!;
}

export function listRepoReviews(repoId: string): Review[] {
  const rows = db
    .prepare(
      `SELECT rv.*,
              u.username AS username, u.nickname AS nickname, u.avatar_url AS avatar_url,
              u.bio AS bio, u.created_at AS user_created_at,
              (SELECT COUNT(*) FROM repos r WHERE r.owner_id = u.id) AS repo_count,
              (SELECT COUNT(*) FROM files f JOIN repos r2 ON r2.id = f.repo_id WHERE r2.owner_id = u.id) AS file_count,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = u.id) AS group_count,
              (SELECT COALESCE(SUM(f2.download_count), 0) FROM files f2 JOIN repos r3 ON r3.id = f2.repo_id WHERE r3.owner_id = u.id) AS total_downloads,
              (SELECT COALESCE(SUM(f3.file_bytes), 0) FROM files f3 JOIN repos r4 ON r4.id = f3.repo_id WHERE r4.owner_id = u.id) AS total_bytes,
              u.wallet_balance AS owner_wallet_balance,
              u.total_sales AS owner_total_sales,
              u.total_purchases AS owner_total_purchases
       FROM reviews rv
       JOIN users u ON u.id = rv.user_id
       WHERE rv.repo_id = ?
       ORDER BY rv.created_at DESC`,
    )
    .all(repoId) as any[];
  return rows.map((row) => mapReview(row, mapUser(row)));
}

export function canUserReviewRepo(userId: string, repoId: string): boolean {
  // Must have purchased, and not already reviewed
  const purchased = hasUserPurchasedRepo(userId, repoId);
  if (!purchased) {
    // Owner or free resource also allowed? Owner always. Free: allow everyone.
    const repo = getRepoById(repoId, null);
    if (!repo) return false;
    if (repo.ownerId === userId) return true;
    if (repo.pricingType === 'free') return true;
    return false;
  }
  const reviewed = Boolean(db.prepare(`SELECT 1 FROM reviews WHERE user_id = ? AND repo_id = ?`).get(userId, repoId));
  return !reviewed;
}

export function createReview(input: {
  repoId: string;
  userId: string;
  rating: ReviewRating;
  title?: string;
  content: string;
}): Review {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO reviews (id, repo_id, user_id, rating, title, content, created_at, updated_at, helpful_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  ).run(id, input.repoId, input.userId, input.rating, input.title ?? '', input.content, now, now);
  return listRepoReviews(input.repoId).find((r) => r.id === id)!;
}

export function updateReview(id: string, patch: { rating?: ReviewRating; title?: string; content?: string }): Review | null {
  const row = db.prepare(`SELECT repo_id FROM reviews WHERE id = ?`).get(id) as any;
  if (!row) return null;
  db.prepare(
    `UPDATE reviews SET
       rating = COALESCE(?, rating),
       title = COALESCE(?, title),
       content = COALESCE(?, content),
       updated_at = ?
     WHERE id = ?`,
  ).run(
    patch.rating ?? null,
    patch.title ?? null,
    patch.content ?? null,
    new Date().toISOString(),
    id,
  );
  return listRepoReviews(row.repo_id).find((r) => r.id === id) ?? null;
}

export function deleteReview(id: string): void {
  db.prepare(`DELETE FROM reviews WHERE id = ?`).run(id);
}

export function getReviewById(id: string): Review | null {
  const row = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(id) as any;
  if (!row) return null;
  const user = getUserById(row.user_id) ?? ({} as User);
  return mapReview(row, user);
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export function recordWalletTx(input: {
  userId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  currency: Currency;
  description: string;
  orderId?: string;
  referenceId?: string;
}): WalletTransaction {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, currency, description, order_id, reference_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.userId,
    input.type,
    input.amount,
    input.balanceAfter,
    input.currency,
    input.description,
    input.orderId ?? null,
    input.referenceId ?? null,
    now,
  );
  const user = getUserById(input.userId) ?? ({} as User);
  return mapWalletTx({ ...input, id, created_at: now }, user);
}

export function getWalletOverview(userId: string): WalletOverview {
  const user = getUserById(userId) ?? ({} as User);
  const balance = user.walletBalance ?? 0;
  const totalIncome = Number(
    (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS c FROM wallet_transactions WHERE user_id = ? AND amount > 0`).get(userId) as any).c,
  );
  const totalExpense = Math.abs(
    Number(
      (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS c FROM wallet_transactions WHERE user_id = ? AND amount < 0`).get(userId) as any).c,
    ),
  );
  const rows = db
    .prepare(`SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`)
    .all(userId) as any[];
  const u = getUserById(userId);
  return {
    balance,
    currency: 'CNY',
    totalIncome,
    totalExpense,
    pendingEarnings: 0,
    recentTransactions: rows.map((row) => mapWalletTx(row, u ?? undefined)),
  };
}

export function listWalletTransactions(args: {
  userId: string;
  type?: TransactionType;
  limit?: number;
  offset?: number;
}): { items: WalletTransaction[]; total: number } {
  const { userId, type } = args;
  const limit = Math.min(Math.max(Number(args.limit) || 30, 1), 100);
  const offset = Math.max(Number(args.offset) || 0, 0);
  const where = [`user_id = ?`];
  const params: unknown[] = [userId];
  if (type) {
    where.push(`type = ?`);
    params.push(type);
  }
  const whereSql = where.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM wallet_transactions WHERE ${whereSql}`).get(...params) as any).c;
  const rows = db
    .prepare(`SELECT * FROM wallet_transactions WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as any[];
  const u = getUserById(userId);
  return {
    items: rows.map((row) => mapWalletTx(row, u ?? undefined)),
    total,
  };
}

export function topUpWallet(userId: string, amount: number, currency: Currency): WalletOverview {
  const bal = adjustWalletBalance(userId, amount);
  recordWalletTx({
    userId,
    type: 'topup',
    amount,
    balanceAfter: bal,
    currency,
    description: 'Wallet top-up (admin)',
    referenceId: `topup_${Date.now()}`,
  });
  return getWalletOverview(userId);
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export function memberGroupIdsForUser(userId: string | null): Set<string> {
  const set = new Set<string>();
  if (!userId) return set;
  const rows = db.prepare(`SELECT group_id FROM group_members WHERE user_id = ?`).all(userId) as any[];
  for (const r of rows) set.add(r.group_id);
  return set;
}

export function adminGroupIdsForUser(userId: string | null): Set<string> {
  const set = new Set<string>();
  if (!userId) return set;
  const rows = db
    .prepare(`SELECT group_id FROM group_members WHERE user_id = ? AND role = 'admin'`)
    .all(userId) as any[];
  for (const r of rows) set.add(r.group_id);
  return set;
}

export function pendingRequestsForUser(userId: string | null): Map<string, 'pending'> {
  const map = new Map<string, 'pending'>();
  if (!userId) return map;
  const rows = db
    .prepare(`SELECT group_id FROM group_requests WHERE user_id = ? AND status = 'pending'`)
    .all(userId) as any[];
  for (const r of rows) map.set(r.group_id, 'pending');
  return map;
}

export interface ListGroupsArgs {
  search?: string;
  category?: string;
  sort?: 'members' | 'repos' | 'recent';
  limit: number;
  offset: number;
}

export function listGroups(args: ListGroupsArgs, currentUserId: string | null): Group[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (args.search) {
    where.push(`(g.name LIKE ? OR g.description LIKE ?)`);
    params.push(`%${args.search}%`, `%${args.search}%`);
  }
  if (args.category) {
    where.push(`g.category_id = ?`);
    params.push(args.category);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const orderBy =
    args.sort === 'members'
      ? 'ORDER BY member_count DESC'
      : args.sort === 'repos'
        ? 'ORDER BY repo_count DESC'
        : 'ORDER BY g.created_at DESC';

  const rows = db.prepare(`${GROUP_SELECT} ${whereSql} ${orderBy} LIMIT ? OFFSET ?`).all(...params, args.limit, args.offset) as any[];
  const memberIds = memberGroupIdsForUser(currentUserId);
  const adminIds = adminGroupIdsForUser(currentUserId);
  const pending = pendingRequestsForUser(currentUserId);
  return rows.map((r) => mapGroup(r, memberIds, adminIds, pending));
}

export function getGroupById(id: string, currentUserId: string | null): Group | null {
  const row = db.prepare(`${GROUP_SELECT} WHERE g.id = ?`).get(id) as any;
  if (!row) return null;
  return mapGroup(
    row,
    memberGroupIdsForUser(currentUserId),
    adminGroupIdsForUser(currentUserId),
    pendingRequestsForUser(currentUserId),
  );
}

export function createGroup(input: {
  name: string;
  description: string;
  categoryId: string;
  creatorId: string;
}): Group {
  const id = randomUUID();
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO groups (id, name, description, category_id, creator_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id,
      input.name,
      input.description,
      input.categoryId,
      input.creatorId,
      now,
    );
    db.prepare(`INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'admin', ?)`).run(
      id,
      input.creatorId,
      now,
    );
  });
  tx();
  return getGroupById(id, input.creatorId)!;
}

export function updateGroup(
  id: string,
  patch: { name?: string; description?: string; categoryId?: string },
): Group | null {
  db.prepare(
    `UPDATE groups SET name = COALESCE(?, name), description = COALESCE(?, description), category_id = COALESCE(?, category_id) WHERE id = ?`,
  ).run(patch.name ?? null, patch.description ?? null, patch.categoryId ?? null, id);
  return getGroupById(id, null);
}

export function deleteGroup(id: string): void {
  db.prepare(`DELETE FROM groups WHERE id = ?`).run(id);
}

export function groupRole(groupId: string, userId: string): 'admin' | 'member' | null {
  const row = db.prepare(`SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`).get(groupId, userId) as any;
  return row?.role ?? null;
}

export function requestToJoin(groupId: string, userId: string): 'created' | 'pending' | 'already-member' {
  if (groupRole(groupId, userId)) return 'already-member';
  const existing = db
    .prepare(`SELECT id FROM group_requests WHERE group_id = ? AND user_id = ? AND status = 'pending'`)
    .get(groupId, userId);
  if (existing) return 'pending';
  db.prepare(
    `INSERT INTO group_requests (id, group_id, user_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)`,
  ).run(randomUUID(), groupId, userId, new Date().toISOString());
  return 'created';
}

export function leaveGroup(groupId: string, userId: string): void {
  db.prepare(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`).run(groupId, userId);
  db.prepare(`UPDATE group_requests SET status = 'rejected', decided_at = ? WHERE group_id = ? AND user_id = ? AND status = 'pending'`).run(
    new Date().toISOString(),
    groupId,
    userId,
  );
}

export function listGroupRequests(groupId: string): GroupRequest[] {
  const rows = db
    .prepare(
      `SELECT gr.id, gr.group_id, gr.user_id, gr.status, gr.created_at,
              u.username AS username, u.nickname AS nickname, u.avatar_url AS avatar_url,
              u.bio AS bio, u.created_at AS user_created_at,
              (SELECT COUNT(*) FROM repos r WHERE r.owner_id = u.id) AS repo_count,
              (SELECT COUNT(*) FROM files f JOIN repos r2 ON r2.id = f.repo_id WHERE r2.owner_id = u.id) AS file_count,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = u.id) AS group_count,
              (SELECT COALESCE(SUM(f2.download_count), 0) FROM files f2 JOIN repos r3 ON r3.id = f2.repo_id WHERE r3.owner_id = u.id) AS total_downloads,
              (SELECT COALESCE(SUM(f3.file_bytes), 0) FROM files f3 JOIN repos r4 ON r4.id = f3.repo_id WHERE r4.owner_id = u.id) AS total_bytes,
              u.wallet_balance AS owner_wallet_balance,
              u.total_sales AS owner_total_sales,
              u.total_purchases AS owner_total_purchases
       FROM group_requests gr
       JOIN users u ON u.id = gr.user_id
       WHERE gr.group_id = ?
       ORDER BY (gr.status = 'pending') DESC, gr.created_at ASC`,
    )
    .all(groupId) as any[];
  return rows.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    status: row.status,
    createdAt: row.created_at,
    user: mapUser(row),
  }));
}

export function getGroupRequestById(requestId: string): GroupRequest | null {
  const row = db.prepare(`SELECT * FROM group_requests WHERE id = ?`).get(requestId) as any;
  if (!row) return null;
  const full = listGroupRequests(row.group_id).find((r) => r.id === requestId);
  return full ?? null;
}

export function approveRequest(requestId: string): void {
  const request = db.prepare(`SELECT * FROM group_requests WHERE id = ? AND status = 'pending'`).get(requestId) as any;
  if (!request) return;
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`,
    ).run(request.group_id, request.user_id, new Date().toISOString());
    db.prepare(`UPDATE group_requests SET status = 'approved', decided_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      requestId,
    );
  });
  tx();
}

export function rejectRequest(requestId: string): void {
  db.prepare(`UPDATE group_requests SET status = 'rejected', decided_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    requestId,
  );
}

export function listGroupMembers(groupId: string): GroupMember[] {
  const rows = db
    .prepare(
      `SELECT gm.user_id, gm.role, gm.joined_at,
              u.username AS username, u.nickname AS nickname, u.avatar_url AS avatar_url,
              u.bio AS bio, u.created_at AS user_created_at,
              (SELECT COUNT(*) FROM repos r WHERE r.owner_id = u.id) AS repo_count,
              (SELECT COUNT(*) FROM files f JOIN repos r2 ON r2.id = f.repo_id WHERE r2.owner_id = u.id) AS file_count,
              (SELECT COUNT(*) FROM group_members g2 WHERE g2.user_id = u.id) AS group_count,
              (SELECT COALESCE(SUM(f2.download_count), 0) FROM files f2 JOIN repos r3 ON r3.id = f2.repo_id WHERE r3.owner_id = u.id) AS total_downloads,
              (SELECT COALESCE(SUM(f3.file_bytes), 0) FROM files f3 JOIN repos r4 ON r4.id = f3.repo_id WHERE r4.owner_id = u.id) AS total_bytes,
              u.wallet_balance AS owner_wallet_balance,
              u.total_sales AS owner_total_sales,
              u.total_purchases AS owner_total_purchases
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY gm.role DESC, gm.joined_at ASC`,
    )
    .all(groupId) as any[];
  return rows.map(mapMember);
}

export function listGroupsByMember(userId: string): Group[] {
  const rows = db
    .prepare(
      `${GROUP_SELECT} JOIN group_members gm ON gm.group_id = g.id WHERE gm.user_id = ? ORDER BY gm.joined_at DESC`,
    )
    .all(userId) as any[];
  const memberIds = memberGroupIdsForUser(userId);
  const adminIds = adminGroupIdsForUser(userId);
  const pending = pendingRequestsForUser(userId);
  return rows.map((r) => mapGroup(r, memberIds, adminIds, pending));
}

export function listActiveGroups(limit: number, currentUserId: string | null): Group[] {
  const rows = db
    .prepare(`${GROUP_SELECT} ORDER BY member_count DESC, repo_count DESC LIMIT ?`)
    .all(limit) as any[];
  const memberIds = memberGroupIdsForUser(currentUserId);
  const adminIds = adminGroupIdsForUser(currentUserId);
  const pending = pendingRequestsForUser(currentUserId);
  return rows.map((r) => mapGroup(r, memberIds, adminIds, pending));
}

// ---------------------------------------------------------------------------
// Leaderboard / stats / search / reports
// ---------------------------------------------------------------------------

export function getLeaderboard(limit = 50): LeaderboardEntry[] {
  const rows = db
    .prepare(
      `${USER_SELECT}
       ORDER BY file_count DESC, total_bytes DESC
       LIMIT ?`,
    )
    .all(limit) as any[];
  return rows.map((row) => {
    const user = mapUser(row);
    return {
      user,
      repoCount: user.repoCount,
      fileCount: user.fileCount,
      totalBytes: user.totalBytes,
      totalDownloads: user.totalDownloads,
      totalSales: user.totalSales,
      totalRevenue: 0, // per user revenue not tracked in users table yet; skip
    };
  });
}

export function getTopSellers(limit = 20): LeaderboardEntry[] {
  const rows = db
    .prepare(
      `SELECT u.*,
         (SELECT COUNT(*) FROM repos r WHERE r.owner_id = u.id) AS repo_count,
         (SELECT COUNT(*) FROM files f JOIN repos r ON r.id = f.repo_id WHERE r.owner_id = u.id) AS file_count,
         (SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = u.id) AS group_count,
         (SELECT COALESCE(SUM(f2.download_count), 0) FROM files f2 JOIN repos r2 ON r2.id = f2.repo_id WHERE r2.owner_id = u.id) AS total_downloads,
         (SELECT COALESCE(SUM(f3.file_bytes), 0) FROM files f3 JOIN repos r3 ON r3.id = f3.repo_id WHERE r3.owner_id = u.id) AS total_bytes,
         (SELECT COALESCE(SUM(r4.total_revenue), 0) FROM repos r4 WHERE r4.owner_id = u.id) AS seller_revenue,
         (SELECT AVG(rv.rating) FROM reviews rv JOIN repos r5 ON r5.id = rv.repo_id WHERE r5.owner_id = u.id) AS seller_rating
       FROM users u
       WHERE u.total_sales > 0
       ORDER BY u.total_sales DESC
       LIMIT ?`,
    )
    .all(limit) as any[];
  return rows.map((row) => {
    const user = mapUser(row);
    return {
      user,
      repoCount: user.repoCount,
      fileCount: user.fileCount,
      totalBytes: user.totalBytes,
      totalDownloads: user.totalDownloads,
      totalSales: user.totalSales,
      totalRevenue: Number(row.seller_revenue ?? 0),
      averageRating: Number(row.seller_rating ?? 0),
    };
  });
}

export function getStats(): HomeData['stats'] {
  const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as any).c;
  return {
    repos: count('repos'),
    files: count('files'),
    groups: count('groups'),
    users: count('users'),
    downloads: (db.prepare(`SELECT COALESCE(SUM(download_count), 0) AS c FROM files`).get() as any).c,
    totalSales: (db.prepare(`SELECT COALESCE(SUM(total_sales), 0) AS c FROM repos`).get() as any).c,
    totalRevenue: (db.prepare(`SELECT COALESCE(SUM(total_revenue), 0) AS c FROM repos`).get() as any).c,
    freeRepos: (db.prepare(`SELECT COUNT(*) AS c FROM repos WHERE pricing_type = 'free'`).get() as any).c,
  };
}

export function searchAll(q: string, currentUserId: string | null): { repos: Repository[]; groups: Group[] } {
  const repos = listRepos({ search: q, limit: 8, offset: 0 }, currentUserId).items;
  const groups = listGroups({ search: q, limit: 8, offset: 0 }, currentUserId);
  return { repos, groups };
}

export function createReport(input: {
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
}): Report {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)`,
  ).run(id, input.reporterId, input.targetType, input.targetId, input.reason, now);
  return {
    id,
    reporterId: input.reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    createdAt: now,
    status: 'open',
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function setUserAdmin(userId: string, isAdmin: boolean): void {
  db.prepare(`UPDATE users SET is_admin = ? WHERE id = ?`).run(isAdmin ? 1 : 0, userId);
}

export function setUserSuspended(userId: string, suspended: boolean): void {
  db.prepare(`UPDATE users SET is_suspended = ? WHERE id = ?`).run(suspended ? 1 : 0, userId);
}

export function deleteUser(userId: string): void {
  db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
}

export function listAdminUsers(args: {
  search?: string;
  offset: number;
  limit: number;
}): { items: User[]; total: number } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (args.search) {
    where.push(`(u.username LIKE ? OR u.nickname LIKE ? OR u.email LIKE ?)`);
    params.push(`%${args.search}%`, `%${args.search}%`, `%${args.search}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM users u ${whereSql}`).get(...params) as any).c;
  const rows = db
    .prepare(`${USER_SELECT} ${whereSql} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, args.limit, args.offset) as any[];
  return {
    items: rows.map((row) => {
      const user = mapUser(row);
      user.email = row.email;
      return user;
    }),
    total,
  };
}

export function listReports(args: {
  status?: string;
  offset: number;
  limit: number;
}): { items: AdminReportItem[]; total: number } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (args.status) {
    where.push(`rp.status = ?`);
    params.push(args.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM reports rp ${whereSql}`).get(...params) as any).c;
  const rows = db
    .prepare(
      `SELECT rp.*,
              u.username AS username, u.nickname AS nickname, u.avatar_url AS avatar_url,
              u.bio AS bio, u.created_at AS user_created_at,
              (SELECT COUNT(*) FROM repos r WHERE r.owner_id = u.id) AS repo_count,
              (SELECT COUNT(*) FROM files f JOIN repos r2 ON r2.id = f.repo_id WHERE r2.owner_id = u.id) AS file_count,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = u.id) AS group_count,
              (SELECT COALESCE(SUM(f2.download_count), 0) FROM files f2 JOIN repos r3 ON r3.id = f2.repo_id WHERE r3.owner_id = u.id) AS total_downloads,
              (SELECT COALESCE(SUM(f3.file_bytes), 0) FROM files f3 JOIN repos r4 ON r4.id = f3.repo_id WHERE r4.owner_id = u.id) AS total_bytes,
              u.wallet_balance AS owner_wallet_balance,
              u.total_sales AS owner_total_sales,
              u.total_purchases AS owner_total_purchases,
              CASE rp.target_type
                WHEN 'repo' THEN (SELECT name FROM repos WHERE id = rp.target_id)
                WHEN 'comment' THEN (SELECT r.name FROM comments c JOIN repos r ON r.id = c.repo_id WHERE c.id = rp.target_id)
                WHEN 'review' THEN (SELECT r.name FROM reviews rv JOIN repos r ON r.id = rv.repo_id WHERE rv.id = rp.target_id)
              END AS target_name,
              CASE rp.target_type
                WHEN 'repo' THEN rp.target_id
                WHEN 'comment' THEN (SELECT c.repo_id FROM comments c WHERE c.id = rp.target_id)
                WHEN 'review' THEN (SELECT rv.repo_id FROM reviews rv WHERE rv.id = rp.target_id)
              END AS target_repo_id
       FROM reports rp
       JOIN users u ON u.id = rp.reporter_id
       ${whereSql}
       ORDER BY rp.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, args.limit, args.offset) as any[];
  return {
    items: rows.map((row) => ({
      id: row.id,
      reporterId: row.reporter_id,
      targetType: row.target_type,
      targetId: row.target_id,
      reason: row.reason,
      createdAt: row.created_at,
      status: row.status,
      reporter: mapUser(row),
      targetName: row.target_name ?? '',
      targetRepoId: row.target_repo_id ?? null,
    })),
    total,
  };
}

export function getAdminOverview(): {
  stats: HomeData['stats'];
  comments: number;
  openReports: number;
  orders: number;
  revenue: number;
} {
  return {
    stats: getStats(),
    comments: (db.prepare(`SELECT COUNT(*) AS c FROM comments`).get() as any).c,
    openReports: countOpenReports(),
    orders: (db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE status = 'paid'`).get() as any).c,
    revenue: getStats().totalRevenue,
  };
}

export function countOpenReports(): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM reports WHERE status = 'open'`).get() as any).c;
}

export function setReportStatus(reportId: string, status: 'open' | 'resolved'): void {
  db.prepare(`UPDATE reports SET status = ? WHERE id = ?`).run(status, reportId);
}

export function deleteComment(commentId: string): void {
  db.prepare(`DELETE FROM comments WHERE id = ?`).run(commentId);
}

export function deleteFileById(fileId: string): RepoFile | null {
  const file = getRepoFileById(fileId);
  if (!file) return null;
  db.prepare(`DELETE FROM files WHERE id = ?`).run(fileId);
  return file;
}

export function listAllOrders(args: {
  status?: OrderStatus;
  search?: string;
  offset: number;
  limit: number;
}): { items: Order[]; total: number } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (args.status) {
    where.push(`o.status = ?`);
    params.push(args.status);
  }
  if (args.search) {
    where.push(`(o.order_no LIKE ? OR o.repo_name LIKE ?)`);
    params.push(`%${args.search}%`, `%${args.search}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM orders o ${whereSql}`).get(...params) as any).c;
  const rows = db
    .prepare(`SELECT o.* FROM orders o ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, args.limit, args.offset) as any[];
  const items = rows.map((row) => {
    const buyer = getUserById(row.buyer_id) ?? ({} as User);
    const seller = getUserById(row.seller_id) ?? ({} as User);
    return mapOrder(row, buyer, seller);
  });
  return { items, total };
}

// ---------------------------------------------------------------------------
// Account lifecycle & login history
// ---------------------------------------------------------------------------

export function deleteUserWithFiles(userId: string): void {
  const repos = listRepos({ ownerId: userId, limit: 100, offset: 0 }, null).items;
  for (const repo of repos) {
    for (const file of listRepoFiles(repo.id)) {
      try {
        fs.unlinkSync(path.join(config.uploadDir, path.basename(file.filePath)));
      } catch {
        // fine
      }
    }
  }
  deleteUser(userId);
}

export function deleteUsersDeactivatedBefore(beforeIso: string): number {
  const rows = db
    .prepare(`SELECT id FROM users WHERE deactivated_at IS NOT NULL AND deactivated_at < ?`)
    .all(beforeIso) as any[];
  for (const r of rows) deleteUserWithFiles(r.id);
  return rows.length;
}

export function countAdmins(): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM users WHERE is_admin = 1`).get() as any).c;
}

export function getTokenVersion(userId: string): number {
  return (db.prepare(`SELECT token_version FROM users WHERE id = ?`).get(userId) as any)?.token_version ?? 0;
}

export function bumpTokenVersion(userId: string): void {
  db.prepare(`UPDATE users SET token_version = token_version + 1 WHERE id = ?`).run(userId);
}

export function setDeactivated(userId: string): void {
  db.prepare(`UPDATE users SET deactivated_at = ? WHERE id = ?`).run(new Date().toISOString(), userId);
}

export function clearDeactivated(userId: string): void {
  db.prepare(`UPDATE users SET deactivated_at = NULL WHERE id = ?`).run(userId);
}

export function getDeactivatedAt(userId: string): string | null {
  return ((db.prepare(`SELECT deactivated_at FROM users WHERE id = ?`).get(userId) as any)?.deactivated_at ?? null) as string | null;
}

export function logLogin(input: {
  userId: string | null;
  email: string;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
}): void {
  db.prepare(
    `INSERT INTO login_logs (id, user_id, email, success, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    input.userId,
    input.email,
    input.success ? 1 : 0,
    input.ip ?? '',
    input.userAgent ?? '',
    new Date().toISOString(),
  );
}

export function listUserLogins(userId: string, limit = 30): LoginLog[] {
  const rows = db
    .prepare(`SELECT * FROM login_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(userId, limit) as any[];
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    email: r.email,
    success: Boolean(r.success),
    ip: r.ip,
    userAgent: r.user_agent,
    createdAt: r.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getUserCount(): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as any).c;
}

export function inferFileType(name: string): FileType {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'rtf', 'md', 'odt'].includes(ext)) return 'doc';
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) return 'ppt';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'avif'].includes(ext)) return 'image';
  if (
    ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'sql', 'sh', 'html', 'css', 'json'].includes(
      ext,
    )
  )
    return 'code';
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'].includes(ext)) return 'video';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archive';
  return 'other';
}

export function closeDb(): void {
  db.close();
}
