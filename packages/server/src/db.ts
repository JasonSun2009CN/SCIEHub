import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  categoryName,
  type Comment,
  type FileType,
  type Group,
  type GroupMember,
  type GroupRequest,
  type HomeData,
  type LeaderboardEntry,
  type RepoFile,
  type Report,
  type ReportTarget,
  type Repository,
  type User,
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
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  nickname      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url    TEXT NOT NULL DEFAULT '',
  bio           TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
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
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  view_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_repos_created ON repos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repos_owner ON repos(owner_id);
CREATE INDEX IF NOT EXISTS idx_repos_category ON repos(category_id);

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
  created_at     TEXT NOT NULL
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

// Every user SELECT aliases the aggregates so one row maps into a User object.
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
  (SELECT COUNT(*) FROM files f WHERE f.repo_id = p.id) AS file_count,
  (SELECT COALESCE(SUM(f.file_bytes), 0) FROM files f WHERE f.repo_id = p.id) AS total_bytes,
  (SELECT COALESCE(SUM(f.download_count), 0) FROM files f WHERE f.repo_id = p.id) AS download_count,
  (SELECT COUNT(*) FROM comments c WHERE c.repo_id = p.id) AS comment_count,
  (SELECT COUNT(*) FROM favorites fv WHERE fv.repo_id = p.id) AS favorite_count,
  (SELECT group_concat(g.id, ',') FROM repo_groups rg JOIN groups g ON g.id = rg.group_id WHERE rg.repo_id = p.id) AS group_ids,
  (SELECT group_concat(g.name, ',') FROM repo_groups rg JOIN groups g ON g.id = rg.group_id WHERE rg.repo_id = p.id) AS group_names
FROM repos p
JOIN users u ON u.id = p.owner_id
`;

function mapRepo(row: any, favoriteIds: Set<string>): Repository {
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
    groupIds: splitCsv(row.group_ids),
    groupNames: splitCsv(row.group_names),
    createdAt: row.created_at,
    isFavorite: favoriteIds.has(row.id),
    isOwner: false,
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
    `INSERT INTO users (id, username, email, nickname, password_hash, avatar_url, bio, created_at)
     VALUES (?, ?, ?, ?, ?, ?, '', ?)`,
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

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export function favoriteRepoIdsForUser(userId: string | null): Set<string> {
  const set = new Set<string>();
  if (!userId) return set;
  const rows = db.prepare(`SELECT repo_id FROM favorites WHERE user_id = ?`).all(userId) as any[];
  for (const r of rows) set.add(r.repo_id);
  return set;
}

export interface ListReposArgs {
  search?: string;
  category?: string;
  sort?: 'recent' | 'popular' | 'views';
  ownerId?: string;
  groupId?: string;
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
        : 'ORDER BY p.created_at DESC';

  const total = (db.prepare(`SELECT COUNT(*) AS c FROM repos p ${whereSql}`).get(...params) as any).c;
  const rows = db.prepare(`${REPO_SELECT} ${whereSql} ${orderBy} LIMIT ? OFFSET ?`).all(...params, args.limit, args.offset) as any[];

  const favorites = favoriteRepoIdsForUser(currentUserId);
  return { items: rows.map((r) => mapRepo(r, favorites)), total };
}

export function getRepoById(id: string, currentUserId: string | null, incrementView = false): Repository | null {
  const row = db.prepare(`${REPO_SELECT} WHERE p.id = ?`).get(id) as any;
  if (!row) return null;
  if (incrementView) {
    db.prepare(`UPDATE repos SET view_count = view_count + 1 WHERE id = ?`).run(id);
    row.view_count += 1;
  }
  const repo = mapRepo(row, favoriteRepoIdsForUser(currentUserId));
  repo.isOwner = currentUserId === repo.ownerId;
  return repo;
}

export function listRepoFiles(repoId: string): RepoFile[] {
  const rows = db
    .prepare(`SELECT * FROM files WHERE repo_id = ? ORDER BY created_at DESC`)
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
}): Repository {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO repos (id, name, description, owner_id, category_id, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.name, input.description, input.ownerId, input.categoryId, JSON.stringify(input.tags), now);
  return getRepoById(id, input.ownerId, false)!;
}

export function updateRepo(
  id: string,
  patch: { name?: string; description?: string; categoryId?: string; tags?: string[] },
): Repository | null {
  db.prepare(
    `UPDATE repos SET name = COALESCE(?, name), description = COALESCE(?, description), category_id = COALESCE(?, category_id), tags = COALESCE(?, tags) WHERE id = ?`,
  ).run(
    patch.name ?? null,
    patch.description ?? null,
    patch.categoryId ?? null,
    patch.tags ? JSON.stringify(patch.tags) : null,
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
}): RepoFile {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO files (id, repo_id, title, description, file_type, file_size, file_bytes, file_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  );
  return getRepoFileById(id)!;
}

export function incrementFileDownload(fileId: string): void {
  db.prepare(`UPDATE files SET download_count = download_count + 1 WHERE id = ?`).run(fileId);
}

export function listReposByOwner(userId: string): Repository[] {
  const rows = db.prepare(`${REPO_SELECT} WHERE p.owner_id = ? ORDER BY p.created_at DESC`).all(userId) as any[];
  return rows.map((r) => mapRepo(r, favoriteRepoIdsForUser(userId)));
}

export function listFavorites(userId: string): Repository[] {
  const rows = db
    .prepare(
      `${REPO_SELECT} JOIN favorites fv ON fv.repo_id = p.id WHERE fv.user_id = ? ORDER BY fv.created_at DESC`,
    )
    .all(userId) as any[];
  return rows.map((r) => mapRepo(r, favoriteRepoIdsForUser(userId)));
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
  return rows.map((r) => mapRepo(r, favoriteRepoIdsForUser(currentUserId)));
}

export function listRecentRepos(limit: number, currentUserId: string | null): Repository[] {
  const rows = db.prepare(`${REPO_SELECT} ORDER BY p.created_at DESC LIMIT ?`).all(limit) as any[];
  return rows.map((r) => mapRepo(r, favoriteRepoIdsForUser(currentUserId)));
}

export function listHotRepos(limit: number, currentUserId: string | null): Repository[] {
  const rows = db
    .prepare(`${REPO_SELECT} ORDER BY download_count DESC, p.view_count DESC LIMIT ?`)
    .all(limit) as any[];
  return rows.map((r) => mapRepo(r, favoriteRepoIdsForUser(currentUserId)));
}

// ---------------------------------------------------------------------------
// Comments
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
              (SELECT COALESCE(SUM(f3.file_bytes), 0) FROM files f3 JOIN repos r4 ON r4.id = f3.repo_id WHERE r4.owner_id = u.id) AS total_bytes
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

/** Map of groupId -> request status for the user's pending join requests. */
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

/** Returns 'created' | 'pending' | 'already-member'. */
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
              (SELECT COALESCE(SUM(f3.file_bytes), 0) FROM files f3 JOIN repos r4 ON r4.id = f3.repo_id WHERE r4.owner_id = u.id) AS total_bytes
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
              (SELECT COALESCE(SUM(f3.file_bytes), 0) FROM files f3 JOIN repos r4 ON r4.id = f3.repo_id WHERE r4.owner_id = u.id) AS total_bytes
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
    return { user, repoCount: user.repoCount, fileCount: user.fileCount, totalBytes: user.totalBytes, totalDownloads: user.totalDownloads };
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
// Helpers
// ---------------------------------------------------------------------------

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
  return 'other';
}

export function closeDb(): void {
  db.close();
}
