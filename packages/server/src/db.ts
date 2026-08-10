import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  CATEGORIES,
  categoryName,
  type Comment,
  type FileType,
  type Group,
  type GroupMember,
  type HomeData,
  type Resource,
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

CREATE TABLE IF NOT EXISTS resources (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  file_type     TEXT NOT NULL,
  file_size     TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  uploader_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id      TEXT REFERENCES groups(id) ON DELETE SET NULL,
  category_id   TEXT NOT NULL,
  tags          TEXT NOT NULL DEFAULT '[]',
  download_count INTEGER NOT NULL DEFAULT 0,
  view_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (resource_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_resources_created ON resources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_uploader ON resources(uploader_id);
CREATE INDEX IF NOT EXISTS idx_resources_group ON resources(group_id);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category_id);
CREATE INDEX IF NOT EXISTS idx_groups_created ON groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_resource ON comments(resource_id);
`);

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

// Every resource SELECT aliases the uploader columns with uploader_* so one
// row maps straight into a Resource object.
const RESOURCE_SELECT = `
SELECT r.*,
  u.username AS uploader_username, u.nickname AS uploader_nickname,
  u.avatar_url AS uploader_avatar, u.bio AS uploader_bio, u.created_at AS uploader_created_at,
  g.name AS group_name,
  (SELECT COUNT(*) FROM comments c WHERE c.resource_id = r.id) AS comment_count,
  (SELECT COUNT(*) FROM favorites f WHERE f.resource_id = r.id) AS favorite_count,
  (SELECT COUNT(*) FROM resources r2 WHERE r2.uploader_id = r.uploader_id) AS uploader_upload_count,
  (SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = r.uploader_id) AS uploader_group_count,
  (SELECT COALESCE(SUM(r3.download_count), 0) FROM resources r3 WHERE r3.uploader_id = r.uploader_id) AS uploader_total_downloads
FROM resources r
JOIN users u ON u.id = r.uploader_id
LEFT JOIN groups g ON g.id = r.group_id
`;

function mapResource(row: any, favoriteIds: Set<string>): Resource {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    fileType: row.file_type,
    fileSize: row.file_size,
    filePath: row.file_path,
    uploaderId: row.uploader_id,
    uploader: {
      id: row.uploader_id,
      username: row.uploader_username,
      nickname: row.uploader_nickname,
      avatarUrl: row.uploader_avatar,
      bio: row.uploader_bio,
      createdAt: row.uploader_created_at,
      uploadCount: row.uploader_upload_count,
      groupCount: row.uploader_group_count,
      totalDownloads: row.uploader_total_downloads,
    },
    groupId: row.group_id ?? '',
    groupName: row.group_name ?? '',
    categoryId: row.category_id,
    categoryName: categoryName(row.category_id),
    tags: safeJson(row.tags),
    downloadCount: row.download_count,
    viewCount: row.view_count,
    commentCount: row.comment_count,
    favoriteCount: row.favorite_count,
    createdAt: row.created_at,
    isFavorite: favoriteIds.has(row.id),
  };
}

const GROUP_SELECT = `
SELECT g.*,
  u.username AS creator_username, u.nickname AS creator_nickname,
  u.avatar_url AS creator_avatar, u.bio AS creator_bio, u.created_at AS creator_created_at,
  u.id AS creator_id,
  (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
  (SELECT COUNT(*) FROM resources r WHERE r.group_id = g.id) AS resource_count,
  (SELECT COUNT(*) FROM resources r2 WHERE r2.uploader_id = g.creator_id) AS creator_upload_count,
  (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.user_id = g.creator_id) AS creator_group_count,
  (SELECT COALESCE(SUM(r3.download_count), 0) FROM resources r3 WHERE r3.uploader_id = g.creator_id) AS creator_total_downloads
FROM groups g
JOIN users u ON u.id = g.creator_id
`;

function mapGroup(row: any, memberGroupIds: Set<string>, adminGroupIds: Set<string>): Group {
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
      uploadCount: row.creator_upload_count,
      groupCount: row.creator_group_count,
      totalDownloads: row.creator_total_downloads,
    },
    memberCount: row.member_count,
    resourceCount: row.resource_count,
    createdAt: row.created_at,
    isMember: memberGroupIds.has(row.id),
    isAdmin: adminGroupIds.has(row.id),
  };
}

function mapUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    createdAt: row.created_at,
    uploadCount: row.upload_count,
    groupCount: row.group_count,
    totalDownloads: row.total_downloads,
  };
}

function safeJson(value: string | null, fallback: unknown[] = []): any[] {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const USER_SELECT = `
SELECT u.*,
  (SELECT COUNT(*) FROM resources r WHERE r.uploader_id = u.id) AS upload_count,
  (SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = u.id) AS group_count,
  (SELECT COALESCE(SUM(r2.download_count), 0) FROM resources r2 WHERE r2.uploader_id = u.id) AS total_downloads
FROM users u
`;

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
// Resources
// ---------------------------------------------------------------------------

export function favoriteIdsForUser(userId: string | null): Set<string> {
  const set = new Set<string>();
  if (!userId) return set;
  const rows = db.prepare(`SELECT resource_id FROM favorites WHERE user_id = ?`).all(userId) as any[];
  for (const r of rows) set.add(r.resource_id);
  return set;
}

export interface ListResourcesArgs {
  search?: string;
  category?: string;
  sort?: 'recent' | 'popular' | 'views';
  groupId?: string;
  uploaderId?: string;
  limit: number;
  offset: number;
}

export function listResources(
  args: ListResourcesArgs,
  currentUserId: string | null,
): { items: Resource[]; total: number } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (args.search) {
    where.push(`(r.title LIKE ? OR r.description LIKE ?)`);
    params.push(`%${args.search}%`, `%${args.search}%`);
  }
  if (args.category) {
    where.push(`r.category_id = ?`);
    params.push(args.category);
  }
  if (args.groupId) {
    where.push(`r.group_id = ?`);
    params.push(args.groupId);
  }
  if (args.uploaderId) {
    where.push(`r.uploader_id = ?`);
    params.push(args.uploaderId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const orderBy =
    args.sort === 'popular'
      ? 'ORDER BY r.download_count DESC, r.view_count DESC'
      : args.sort === 'views'
        ? 'ORDER BY r.view_count DESC'
        : 'ORDER BY r.created_at DESC';

  const total = (db.prepare(`SELECT COUNT(*) AS c FROM resources r ${whereSql}`).get(...params) as any).c;
  const rows = db
    .prepare(`${RESOURCE_SELECT} ${whereSql} ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, args.limit, args.offset) as any[];

  const favorites = favoriteIdsForUser(currentUserId);
  return { items: rows.map((r) => mapResource(r, favorites)), total };
}

export function getResourceById(id: string, currentUserId: string | null, incrementView = true): Resource | null {
  const row = db.prepare(`${RESOURCE_SELECT} WHERE r.id = ?`).get(id) as any;
  if (!row) return null;
  if (incrementView) {
    db.prepare(`UPDATE resources SET view_count = view_count + 1 WHERE id = ?`).run(id);
    row.view_count += 1;
  }
  return mapResource(row, favoriteIdsForUser(currentUserId));
}

export function getRelatedResources(resource: Resource, limit = 4): Resource[] {
  const rows = db
    .prepare(
      `${RESOURCE_SELECT} WHERE r.category_id = ? AND r.id != ? ORDER BY r.download_count DESC LIMIT ?`,
    )
    .all(resource.categoryId, resource.id, limit) as any[];
  return rows.map((r) => mapResource(r, new Set()));
}

export function createResource(input: {
  title: string;
  description: string;
  fileType: FileType;
  fileSize: string;
  filePath: string;
  uploaderId: string;
  groupId: string | null;
  categoryId: string;
  tags: string[];
}): Resource {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO resources (id, title, description, file_type, file_size, file_path, uploader_id, group_id, category_id, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.title,
    input.description,
    input.fileType,
    input.fileSize,
    input.filePath,
    input.uploaderId,
    input.groupId,
    input.categoryId,
    JSON.stringify(input.tags),
    now,
  );
  return getResourceById(id, input.uploaderId, false)!;
}

export function incrementDownload(id: string): void {
  db.prepare(`UPDATE resources SET download_count = download_count + 1 WHERE id = ?`).run(id);
}

export function listRecentResources(limit: number, currentUserId: string | null): Resource[] {
  const rows = db.prepare(`${RESOURCE_SELECT} ORDER BY r.created_at DESC LIMIT ?`).all(limit) as any[];
  return rows.map((r) => mapResource(r, favoriteIdsForUser(currentUserId)));
}

export function listResourcesByUploader(username: string): Resource[] {
  const rows = db
    .prepare(`${RESOURCE_SELECT} WHERE u.username = ? ORDER BY r.created_at DESC`)
    .all(username) as any[];
  return rows.map((r) => mapResource(r, new Set()));
}

export function listFavorites(userId: string): Resource[] {
  const rows = db
    .prepare(
      `${RESOURCE_SELECT}
       JOIN favorites f ON f.resource_id = r.id
       WHERE f.user_id = ? ORDER BY f.created_at DESC`,
    )
    .all(userId) as any[];
  return rows.map((r) => mapResource(r, new Set([...favoriteIdsForUser(userId)])));
}

export function toggleFavorite(resourceId: string, userId: string): boolean {
  const existing = db
    .prepare(`SELECT 1 FROM favorites WHERE resource_id = ? AND user_id = ?`)
    .get(resourceId, userId);
  if (existing) {
    db.prepare(`DELETE FROM favorites WHERE resource_id = ? AND user_id = ?`).run(resourceId, userId);
    return false;
  }
  db.prepare(`INSERT INTO favorites (resource_id, user_id, created_at) VALUES (?, ?, ?)`).run(
    resourceId,
    userId,
    new Date().toISOString(),
  );
  return true;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export function listComments(resourceId: string): Comment[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.resource_id, c.user_id, c.content, c.created_at,
              u.username AS user_username, u.nickname AS user_nickname, u.avatar_url AS user_avatar,
              u.bio AS user_bio, u.created_at AS user_created_at,
              (SELECT COUNT(*) FROM resources r WHERE r.uploader_id = u.id) AS user_upload_count,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = u.id) AS user_group_count,
              (SELECT COALESCE(SUM(r2.download_count), 0) FROM resources r2 WHERE r2.uploader_id = u.id) AS user_total_downloads
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.resource_id = ?
       ORDER BY c.created_at ASC`,
    )
    .all(resourceId) as any[];
  return rows.map((row) => ({
    id: row.id,
    resourceId: row.resource_id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      username: row.user_username,
      nickname: row.user_nickname,
      avatarUrl: row.user_avatar,
      bio: row.user_bio,
      createdAt: row.user_created_at,
      uploadCount: row.user_upload_count,
      groupCount: row.user_group_count,
      totalDownloads: row.user_total_downloads,
    },
  }));
}

export function createComment(resourceId: string, userId: string, content: string): Comment {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO comments (id, resource_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    resourceId,
    userId,
    content,
    now,
  );
  return listComments(resourceId).find((c) => c.id === id)!;
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

export interface ListGroupsArgs {
  search?: string;
  category?: string;
  sort?: 'members' | 'resources' | 'recent';
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
      : args.sort === 'resources'
        ? 'ORDER BY resource_count DESC'
        : 'ORDER BY g.created_at DESC';

  const rows = db
    .prepare(`${GROUP_SELECT} ${whereSql} ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, args.limit, args.offset) as any[];

  const memberIds = memberGroupIdsForUser(currentUserId);
  const adminIds = adminGroupIdsForUser(currentUserId);
  return rows.map((r) => mapGroup(r, memberIds, adminIds));
}

export function getGroupById(id: string, currentUserId: string | null): Group | null {
  const row = db.prepare(`${GROUP_SELECT} WHERE g.id = ?`).get(id) as any;
  if (!row) return null;
  return mapGroup(row, memberGroupIdsForUser(currentUserId), adminGroupIdsForUser(currentUserId));
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
  const row = db.prepare(`SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`).get(
    groupId,
    userId,
  ) as any;
  return row?.role ?? null;
}

export function joinGroup(groupId: string, userId: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`,
  ).run(groupId, userId, new Date().toISOString());
}

export function leaveGroup(groupId: string, userId: string): void {
  db.prepare(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`).run(groupId, userId);
}

export function listGroupMembers(groupId: string): GroupMember[] {
  const rows = db
    .prepare(
      `SELECT gm.user_id, gm.role, gm.joined_at,
              u.username AS user_username, u.nickname AS user_nickname, u.avatar_url AS user_avatar,
              u.bio AS user_bio, u.created_at AS user_created_at,
              (SELECT COUNT(*) FROM resources r WHERE r.uploader_id = u.id) AS user_upload_count,
              (SELECT COUNT(*) FROM group_members g2 WHERE g2.user_id = u.id) AS user_group_count,
              (SELECT COALESCE(SUM(r2.download_count), 0) FROM resources r2 WHERE r2.uploader_id = u.id) AS user_total_downloads
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY gm.role DESC, gm.joined_at ASC`,
    )
    .all(groupId) as any[];
  return rows.map((row) => ({
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    user: {
      id: row.user_id,
      username: row.user_username,
      nickname: row.user_nickname,
      avatarUrl: row.user_avatar,
      bio: row.user_bio,
      createdAt: row.user_created_at,
      uploadCount: row.user_upload_count,
      groupCount: row.user_group_count,
      totalDownloads: row.user_total_downloads,
    },
  }));
}

export function listGroupResources(groupId: string, currentUserId: string | null): Resource[] {
  const rows = db
    .prepare(`${RESOURCE_SELECT} WHERE r.group_id = ? ORDER BY r.created_at DESC`)
    .all(groupId) as any[];
  return rows.map((r) => mapResource(r, favoriteIdsForUser(currentUserId)));
}

export function listGroupsByMember(userId: string): Group[] {
  const rows = db
    .prepare(
      `${GROUP_SELECT} JOIN group_members gm ON gm.group_id = g.id WHERE gm.user_id = ? ORDER BY gm.joined_at DESC`,
    )
    .all(userId) as any[];
  const memberIds = memberGroupIdsForUser(userId);
  const adminIds = adminGroupIdsForUser(userId);
  return rows.map((r) => mapGroup(r, memberIds, adminIds));
}

export function listActiveGroups(limit: number, currentUserId: string | null): Group[] {
  const rows = db
    .prepare(
      `${GROUP_SELECT}
       ORDER BY member_count DESC, resource_count DESC
       LIMIT ?`,
    )
    .all(limit) as any[];
  const memberIds = memberGroupIdsForUser(currentUserId);
  const adminIds = adminGroupIdsForUser(currentUserId);
  return rows.map((r) => mapGroup(r, memberIds, adminIds));
}

// ---------------------------------------------------------------------------
// Home / search / stats
// ---------------------------------------------------------------------------

export function getStats(): HomeData['stats'] {
  const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as any).c;
  return {
    resources: count('resources'),
    groups: count('groups'),
    users: count('users'),
    downloads: (db.prepare(`SELECT COALESCE(SUM(download_count), 0) AS c FROM resources`).get() as any).c,
  };
}

export function searchAll(q: string, currentUserId: string | null): { resources: Resource[]; groups: Group[] } {
  const resources = listResources({ search: q, limit: 8, offset: 0 }, currentUserId).items;
  const groups = listGroups({ search: q, limit: 8, offset: 0 }, currentUserId);
  return { resources, groups };
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

function daysAgo(days: number, hourOffset = 0): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000 - hourOffset * 60 * 60 * 1000);
  return d.toISOString();
}

export function seedIfEmpty(): void {
  const existing = (db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as any).c;
  if (existing > 0) return;

  const users = [
    ['alice', 'alice@sciehub.io', 'Alice Chen', '#38bdf8', 'IB HL: Math AA, Physics. Sharing my notes!', daysAgo(60)],
    ['bob', 'bob@sciehub.io', 'Bob Liu', '#34d399', 'A-Level candidate — Economics & CS.', daysAgo(58)],
    ['carol', 'carol@sciehub.io', 'Carol Wang', '#f87171', 'IGCSE season survivor. Science is my jam.', daysAgo(55)],
    ['dave', 'dave@sciehub.io', 'Dave Zhou', '#fbbf24', 'Chemistry & Biology notes archive.', daysAgo(52)],
    ['emma', 'emma@sciehub.io', 'Emma Zhao', '#a78bfa', 'AP Stats & Calc BC tutor, occasional poet.', daysAgo(40)],
    ['frank', 'frank@sciehub.io', 'Frank Xu', '#f472b6', 'Economics essays & data sets.', daysAgo(33)],
  ] as const;

  const passwordHash = bcrypt.hashSync('password123', 10);
  const insertUser = db.prepare(
    `INSERT INTO users (id, username, email, nickname, password_hash, avatar_url, bio, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const userIds: Record<string, string> = {};
  for (const [username, email, nickname, avatar, bio, createdAt] of users) {
    const id = randomUUID();
    userIds[username] = id;
    insertUser.run(id, username, email, nickname, passwordHash, avatar, bio, createdAt);
  }

  const groups = [
    ['IB Math AA HL Study Group', 'math', 'alice', 'Past papers, notes and weekly problem sets for Math AA HL.', daysAgo(40)],
    ['A-Level Economics Club', 'economics', 'bob', 'Essays, data response practice and exam technique.', daysAgo(38)],
    ['IGCSE Science Hub', 'physics', 'carol', 'Physics, Chemistry and Biology resources for IGCSE.', daysAgo(35)],
    ['AP Calculus Prep', 'math', 'emma', 'AB/BC content, cheat sheets and FRQ walkthroughs.', daysAgo(30)],
    ['Computer Science Society', 'cs', 'dave', 'Code, algorithm notes and project inspiration.', daysAgo(28)],
    ['English Literature Circle', 'language', 'emma', 'Quote banks, analysis templates and essay feedback.', daysAgo(20)],
  ] as const;

  const insertGroup = db.prepare(
    `INSERT INTO groups (id, name, description, category_id, creator_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertMember = db.prepare(
    `INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`,
  );
  const groupIds: Record<string, string> = {};
  for (const [name, category, creator, description, createdAt] of groups) {
    const id = randomUUID();
    groupIds[name] = id;
    insertGroup.run(id, name, description, category, userIds[creator], createdAt);
    insertMember.run(id, userIds[creator], 'admin', createdAt);
  }

  const membership: Array<[string, string, string]> = [
    ['IB Math AA HL Study Group', 'emma', 'member'],
    ['IB Math AA HL Study Group', 'dave', 'member'],
    ['A-Level Economics Club', 'frank', 'member'],
    ['IGCSE Science Hub', 'alice', 'member'],
    ['AP Calculus Prep', 'dave', 'member'],
    ['Computer Science Society', 'bob', 'member'],
    ['English Literature Circle', 'carol', 'member'],
    ['IGCSE Science Hub', 'dave', 'member'],
  ];
  for (const [group, user, role] of membership) {
    insertMember.run(groupIds[group], userIds[user], role, daysAgo(15));
  }

  const resources: Array<{
    title: string;
    description: string;
    type: FileType;
    size: string;
    ext: string;
    uploader: string;
    group?: string;
    category: string;
    tags: string[];
    downloads: number;
    views: number;
    created: string;
  }> = [
    {
      title: 'IB Math AA HL — Differentiation Notes',
      description: 'Comprehensive notes on differentiation: chain rule, implicit, optimisation. Includes worked examples from past papers.',
      type: 'pdf', size: '2.4 MB', ext: 'pdf', uploader: 'alice', group: 'IB Math AA HL Study Group', category: 'math',
      tags: ['ib', 'math', 'calculus', 'notes'], downloads: 142, views: 830, created: daysAgo(12),
    },
    {
      title: 'A-Level Economics Essay Bank',
      description: '30 high-scoring essay plans across micro & macro. Mark scheme breakdowns included.',
      type: 'doc', size: '1.8 MB', ext: 'docx', uploader: 'bob', group: 'A-Level Economics Club', category: 'economics',
      tags: ['alevel', 'economics', 'essays'], downloads: 98, views: 512, created: daysAgo(9),
    },
    {
      title: 'IGCSE Physics Formula Sheet',
      description: 'Every formula you need for Paper 2, organised by topic with unit hints.',
      type: 'pdf', size: '640 KB', ext: 'pdf', uploader: 'carol', group: 'IGCSE Science Hub', category: 'physics',
      tags: ['igcse', 'physics', 'formula'], downloads: 203, views: 1104, created: daysAgo(15),
    },
    {
      title: 'AP Calculus BC Cheat Sheet',
      description: 'One-page review of series, polar, parametrics and integration techniques.',
      type: 'pdf', size: '1.1 MB', ext: 'pdf', uploader: 'emma', group: 'AP Calculus Prep', category: 'math',
      tags: ['ap', 'calculus', 'cheat-sheet'], downloads: 176, views: 921, created: daysAgo(6),
    },
    {
      title: 'Organic Chemistry Reaction Map',
      description: 'Visual map of reactions, reagents and conditions for organic chemistry.',
      type: 'image', size: '3.2 MB', ext: 'png', uploader: 'carol', group: 'IGCSE Science Hub', category: 'chemistry',
      tags: ['chemistry', 'organic', 'map'], downloads: 87, views: 640, created: daysAgo(4),
    },
    {
      title: 'Python Basics: Loops & Functions',
      description: 'Beginner-friendly notes and exercises for loops, list comprehensions and functions.',
      type: 'code', size: '18 KB', ext: 'py', uploader: 'dave', group: 'Computer Science Society', category: 'cs',
      tags: ['python', 'beginner', 'exercises'], downloads: 54, views: 388, created: daysAgo(7),
    },
    {
      title: 'Macbeth Quote Bank',
      description: 'Key quotes grouped by theme (ambition, guilt, supernatural) with analysis prompts.',
      type: 'doc', size: '920 KB', ext: 'docx', uploader: 'emma', group: 'English Literature Circle', category: 'language',
      tags: ['english', 'macbeth', 'quotes'], downloads: 71, views: 445, created: daysAgo(10),
    },
    {
      title: 'IB Physics IA Sample Lab',
      description: 'A scored sample IA on pendulum motion with examiner comments annotated.',
      type: 'doc', size: '2.0 MB', ext: 'docx', uploader: 'alice', group: 'IB Math AA HL Study Group', category: 'physics',
      tags: ['ib', 'physics', 'ia'], downloads: 133, views: 754, created: daysAgo(11),
    },
    {
      title: 'Demand & Supply Diagrams Pack',
      description: 'Editable diagrams for essays — price ceilings, taxes and externalities.',
      type: 'pdf', size: '1.5 MB', ext: 'pdf', uploader: 'bob', group: 'A-Level Economics Club', category: 'economics',
      tags: ['alevel', 'economics', 'diagrams'], downloads: 62, views: 401, created: daysAgo(3),
    },
    {
      title: 'Integration Techniques Slides',
      description: 'Slides covering u-sub, parts, partial fractions and trig substitution.',
      type: 'ppt', size: '4.6 MB', ext: 'pptx', uploader: 'emma', group: 'AP Calculus Prep', category: 'math',
      tags: ['ap', 'calculus', 'slides'], downloads: 119, views: 672, created: daysAgo(5),
    },
    {
      title: 'SQL Practice Queries',
      description: '20 practice problems with solutions — joins, subqueries, aggregation.',
      type: 'code', size: '9 KB', ext: 'sql', uploader: 'dave', group: 'Computer Science Society', category: 'cs',
      tags: ['sql', 'database', 'practice'], downloads: 43, views: 296, created: daysAgo(2),
    },
    {
      title: 'Stoichiometry Workbook',
      description: 'Step-by-step workbook from mole concept to limiting reagents, with answer key.',
      type: 'pdf', size: '2.8 MB', ext: 'pdf', uploader: 'alice', group: 'IGCSE Science Hub', category: 'chemistry',
      tags: ['igcse', 'chemistry', 'stoichiometry'], downloads: 158, views: 830, created: daysAgo(8),
    },
    {
      title: 'IGCSE Maths Past Paper Walkthrough',
      description: 'Timed walkthrough of a full past paper with examiner tips per question.',
      type: 'pdf', size: '3.5 MB', ext: 'pdf', uploader: 'carol', category: 'exam',
      tags: ['igcse', 'maths', 'past-paper'], downloads: 210, views: 1290, created: daysAgo(14),
    },
  ];

  const insertResource = db.prepare(
    `INSERT INTO resources (id, title, description, file_type, file_size, file_path, uploader_id, group_id, category_id, tags, download_count, view_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of resources) {
    // Write a real placeholder file so demo downloads work out of the box.
    const fileName = `seed-${Math.random().toString(36).slice(2, 8)}.${r.ext}`;
    fs.writeFileSync(
      path.join(config.uploadDir, fileName),
      `# ${r.title}\n\nPlaceholder file for the SCIEHub demo. Upload your own resources to replace these.\n`,
    );
    insertResource.run(
      randomUUID(),
      r.title,
      r.description,
      r.type,
      r.size,
      `/uploads/${fileName}`,
      userIds[r.uploader],
      r.group ? groupIds[r.group] : null,
      r.category,
      JSON.stringify(r.tags),
      r.downloads,
      r.views,
      r.created,
    );
  }

  const comments: Array<[string, string, string, string]> = [
    ['IB Math AA HL — Differentiation Notes', 'emma', 'These saved me before mocks. The optimisation examples are gold.', daysAgo(11)],
    ['IB Math AA HL — Differentiation Notes', 'dave', 'Could you add the chain rule proof appendix?', daysAgo(10)],
    ['IGCSE Physics Formula Sheet', 'alice', 'Printing this for every paper from now on.', daysAgo(14)],
    ['A-Level Economics Essay Bank', 'frank', 'The mark scheme breakdowns are super helpful.', daysAgo(8)],
    ['AP Calculus BC Cheat Sheet', 'dave', 'The series tests table is exactly what I needed.', daysAgo(5)],
    ['Macbeth Quote Bank', 'carol', 'Theme-grouped quotes make essay planning so much faster.', daysAgo(9)],
  ];
  const insertComment = db.prepare(
    `INSERT INTO comments (id, resource_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  for (const [title, author, content, createdAt] of comments) {
    const resourceId = (db.prepare(`SELECT id FROM resources WHERE title = ?`).get(title) as any).id;
    insertComment.run(randomUUID(), resourceId, userIds[author], content, createdAt);
  }

  const favorites: Array<[string, string, string]> = [
    ['IGCSE Physics Formula Sheet', 'alice', daysAgo(13)],
    ['IB Math AA HL — Differentiation Notes', 'dave', daysAgo(10)],
    ['AP Calculus BC Cheat Sheet', 'dave', daysAgo(4)],
    ['A-Level Economics Essay Bank', 'frank', daysAgo(7)],
    ['Macbeth Quote Bank', 'carol', daysAgo(8)],
  ];
  const insertFavorite = db.prepare(
    `INSERT INTO favorites (resource_id, user_id, created_at) VALUES (?, ?, ?)`,
  );
  for (const [title, user, createdAt] of favorites) {
    const resourceId = (db.prepare(`SELECT id FROM resources WHERE title = ?`).get(title) as any).id;
    insertFavorite.run(resourceId, userIds[user], createdAt);
  }

  const _categories = CATEGORIES; // keep the import referenced for future category APIs
  void _categories;
}

export function closeDb(): void {
  db.close();
}
