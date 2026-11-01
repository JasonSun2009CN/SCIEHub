import type {
  AdminReportItem,
  Comment,
  CommunityPost,
  Currency,
  EducationLevel,
  FileType,
  Group,
  GroupMember,
  GroupRequest,
  HomeData,
  LeaderboardEntry,
  LoginLog,
  Order,
  OrderStatus,
  PurchaseRecord,
  PurchaseRequest,
  PurchaseRequestStatus,
  RepoFile,
  Report,
  ReportTarget,
  Repository,
  ResourceType,
  Review,
  ReviewRating,
  TransactionType,
  User,
  WalletOverview,
  WalletTransaction,
} from '@sciehub/shared';
import {
  categoryName,
  generateOrderNo,
  levelName,
  resourceTypeName,
} from '@sciehub/shared';
import { getDb } from './runtime.js';
import { deleteUpload } from './storage.js';

type Row = Record<string, any>;
type BindValue = any;

async function one<T = Row>(sql: string, ...params: BindValue[]): Promise<T | null> {
  return await getDb()
    .prepare(sql)
    .bind(...params)
    .first<T>();
}

async function all<T = Row>(sql: string, ...params: BindValue[]): Promise<T[]> {
  const result = await getDb()
    .prepare(sql)
    .bind(...params)
    .all<T>();
  return result.results ?? [];
}

async function run(sql: string, ...params: BindValue[]) {
  return await getDb()
    .prepare(sql)
    .bind(...params)
    .run();
}

async function batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
  return await getDb().batch(statements);
}

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
    canBuy: row.can_buy === undefined ? true : Boolean(row.can_buy),
    canPublishFree: row.can_publish_free === undefined ? true : Boolean(row.can_publish_free),
    canPublishPaid: row.can_publish_paid === undefined ? true : Boolean(row.can_publish_paid),
    canChat: row.can_chat === undefined ? true : Boolean(row.can_chat),
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

function anonymousUser(id: string): User {
  return {
    id,
    username: '',
    nickname: 'Anonymous',
    avatarUrl: '',
    bio: '',
    createdAt: '',
    repoCount: 0,
    fileCount: 0,
    groupCount: 0,
    totalDownloads: 0,
    totalBytes: 0,
    walletBalance: 0,
    totalSales: 0,
    totalPurchases: 0,
  };
}

function mapRepo(row: any, favoriteIds: Set<string>, purchasedIds: Set<string>): Repository {
  const isAnonymous = Boolean(row.is_anonymous);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    ownerId: row.owner_id,
    owner: isAnonymous
      ? anonymousUser(row.owner_id)
      : {
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
    levelId: (row.level_id ?? 'other') as EducationLevel,
    levelName: levelName(row.level_id),
    resourceType: (row.resource_type ?? 'other') as ResourceType,
    resourceTypeName: resourceTypeName(row.resource_type),
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
    isAnonymous,
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

export async function purchasedRepoIdsForUser(userId: string | null): Promise<Set<string>> {
  const set = new Set<string>();
  if (!userId) return set;
  const rows = await all(`SELECT repo_id FROM purchases WHERE user_id = ?`, userId) as any[];
  for (const r of rows) set.add(r.repo_id);
  return set;
}

export async function favoriteRepoIdsForUser(userId: string | null): Promise<Set<string>> {
  const set = new Set<string>();
  if (!userId) return set;
  const rows = await all(`SELECT repo_id FROM favorites WHERE user_id = ?`, userId) as any[];
  for (const r of rows) set.add(r.repo_id);
  return set;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUserById(id: string): Promise<User | null> {
  const row = await one(`${USER_SELECT} WHERE u.id = ?`, id) as any;
  return row ? mapUser(row) : null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const row = await one(`${USER_SELECT} WHERE u.username = ?`, username) as any;
  return row ? mapUser(row) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const row = await one(`${USER_SELECT} WHERE u.email = ?`, email) as any;
  return row ? mapUser(row) : null;
}

export async function createUser(input: {
  username: string;
  email: string;
  nickname: string;
  passwordHash: string;
  avatarUrl: string;
}): Promise<User> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(`INSERT INTO users (id, username, email, nickname, password_hash, avatar_url, bio, created_at, wallet_balance, total_sales, total_purchases)
     VALUES (?, ?, ?, ?, ?, ?, '', ?, 0, 0, 0)`, id, input.username, input.email, input.nickname, input.passwordHash, input.avatarUrl, now);
  return (await getUserById(id))!;
}

export async function updateUserProfile(
  id: string,
  patch: { nickname?: string; bio?: string; avatarUrl?: string },
): Promise<User | null> {
  await run(`UPDATE users SET nickname = COALESCE(?, nickname), bio = COALESCE(?, bio), avatar_url = COALESCE(?, avatar_url) WHERE id = ?`, patch.nickname ?? null, patch.bio ?? null, patch.avatarUrl ?? null, id);
  return await getUserById(id);
}

export async function getUserPasswordHash(id: string): Promise<string | null> {
  const row = await one(`SELECT password_hash FROM users WHERE id = ?`, id) as any;
  return row?.password_hash ?? null;
}

export async function setUserPassword(id: string, hash: string): Promise<void> {
  await run(`UPDATE users SET password_hash = ? WHERE id = ?`, hash, id);
}

export async function adjustWalletBalance(userId: string, delta: number): Promise<number> {
  await run(`UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?`, delta, userId);
  return Number((await one(`SELECT wallet_balance FROM users WHERE id = ?`, userId) as any).wallet_balance);
}

export async function incrementUserSales(userId: string, amountRevenue: number = 0): Promise<void> {
  await run(`UPDATE users SET total_sales = total_sales + 1 WHERE id = ?`, userId);
  if (amountRevenue) {
    // revenue tracking could be added; for now total_sales count is enough
  }
}

export async function incrementUserPurchases(userId: string): Promise<void> {
  await run(`UPDATE users SET total_purchases = total_purchases + 1 WHERE id = ?`, userId);
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export interface ListReposArgs {
  search?: string;
  category?: string;
  level?: string;
  resourceType?: string;
  sort?: 'recent' | 'popular' | 'views' | 'price_asc' | 'price_desc' | 'rating' | 'sales';
  pricingType?: 'free' | 'paid';
  ownerId?: string;
  groupId?: string;
  minPrice?: number;
  maxPrice?: number;
  limit: number;
  offset: number;
}

export async function listRepos(args: ListReposArgs, currentUserId: string | null): Promise<{ items: Repository[]; total: number }> {
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
  if (args.level) {
    where.push(`p.level_id = ?`);
    params.push(args.level);
  }
  if (args.resourceType) {
    where.push(`p.resource_type = ?`);
    params.push(args.resourceType);
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

  const total = (await one(`SELECT COUNT(*) AS c FROM repos p ${whereSql}`, ...params) as any).c;
  const rows = await all(`${REPO_SELECT} ${whereSql} ${orderBy} LIMIT ? OFFSET ?`, ...params, args.limit, args.offset) as any[];

  const favorites = await favoriteRepoIdsForUser(currentUserId);
  const purchased = await purchasedRepoIdsForUser(currentUserId);
  return { items: rows.map((r) => mapRepo(r, favorites, purchased)), total };
}

export async function getRepoById(id: string, currentUserId: string | null, incrementView = false): Promise<Repository | null> {
  const row = await one(`${REPO_SELECT} WHERE p.id = ?`, id) as any;
  if (!row) return null;
  if (incrementView) {
    await run(`UPDATE repos SET view_count = view_count + 1 WHERE id = ?`, id);
    row.view_count += 1;
  }
  const repo = mapRepo(row, await favoriteRepoIdsForUser(currentUserId), await purchasedRepoIdsForUser(currentUserId));
  repo.isOwner = currentUserId === repo.ownerId;
  return repo;
}

export async function listRepoFiles(repoId: string): Promise<RepoFile[]> {
  const rows = await all(`SELECT * FROM files WHERE repo_id = ? ORDER BY is_preview DESC, created_at DESC`, repoId) as any[];
  return rows.map(mapFile);
}

export async function getRepoFileById(fileId: string): Promise<RepoFile | null> {
  const row = await one(`SELECT * FROM files WHERE id = ?`, fileId) as any;
  return row ? mapFile(row) : null;
}

export async function createRepo(input: {
  name: string;
  description: string;
  categoryId: string;
  levelId: EducationLevel;
  resourceType: ResourceType;
  tags: string[];
  ownerId: string;
  pricingType: 'free' | 'paid';
  price: number;
  currency: Currency;
  isAnonymous?: boolean;
  previewImageUrl?: string;
}): Promise<Repository> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(`INSERT INTO repos (id, name, description, owner_id, category_id, level_id, resource_type, tags, created_at, pricing_type, price, currency, total_sales, total_revenue, is_anonymous, preview_image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`, id, input.name, input.description, input.ownerId, input.categoryId, input.levelId, input.resourceType, JSON.stringify(input.tags), now, input.pricingType, input.price, input.currency, input.isAnonymous ? 1 : 0, input.previewImageUrl ?? null);
  return (await getRepoById(id, input.ownerId, false))!;
}

export async function updateRepo(
  id: string,
  patch: {
    name?: string;
    description?: string;
    categoryId?: string;
    levelId?: EducationLevel;
    resourceType?: ResourceType;
    tags?: string[];
    pricingType?: 'free' | 'paid';
    price?: number;
    currency?: Currency;
    isAnonymous?: boolean;
    previewImageUrl?: string | null;
  },
): Promise<Repository | null> {
  await run(`UPDATE repos SET
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       category_id = COALESCE(?, category_id),
       level_id = COALESCE(?, level_id),
       resource_type = COALESCE(?, resource_type),
       tags = COALESCE(?, tags),
       pricing_type = COALESCE(?, pricing_type),
       price = COALESCE(?, price),
       currency = COALESCE(?, currency),
       is_anonymous = COALESCE(?, is_anonymous),
       preview_image = COALESCE(?, preview_image)
     WHERE id = ?`, patch.name ?? null, patch.description ?? null, patch.categoryId ?? null, patch.levelId ?? null, patch.resourceType ?? null, patch.tags ? JSON.stringify(patch.tags) : null, patch.pricingType ?? null, patch.price ?? null, patch.currency ?? null, patch.isAnonymous === undefined ? null : patch.isAnonymous ? 1 : 0, patch.previewImageUrl === undefined ? null : patch.previewImageUrl, id);
  return await getRepoById(id, null, false);
}

export async function deleteRepo(id: string): Promise<void> {
  const files = await listRepoFiles(id);
  for (const file of files) await deleteUpload(file.filePath);
  await run(`DELETE FROM repos WHERE id = ?`, id);
}

export async function addFileToRepo(input: {
  repoId: string;
  title: string;
  description: string;
  fileType: FileType;
  fileSize: string;
  fileBytes: number;
  filePath: string;
  isPreview?: boolean;
}): Promise<RepoFile> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(`INSERT INTO files (id, repo_id, title, description, file_type, file_size, file_bytes, file_path, created_at, is_preview)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, input.repoId, input.title, input.description, input.fileType, input.fileSize, input.fileBytes, input.filePath, now, input.isPreview ? 1 : 0);
  return (await getRepoFileById(id))!;
}

export async function incrementFileDownload(fileId: string): Promise<void> {
  await run(`UPDATE files SET download_count = download_count + 1 WHERE id = ?`, fileId);
}

export async function incrementRepoSales(repoId: string, revenue: number): Promise<void> {
  await run(`UPDATE repos SET total_sales = total_sales + 1, total_revenue = total_revenue + ? WHERE id = ?`, revenue, repoId);
}

export async function hasUserPurchasedRepo(userId: string, repoId: string): Promise<boolean> {
  return Boolean(await one(`SELECT 1 FROM purchases WHERE user_id = ? AND repo_id = ?`, userId, repoId));
}

export async function listReposByOwner(userId: string): Promise<Repository[]> {
  const rows = await all(`${REPO_SELECT} WHERE p.owner_id = ? ORDER BY p.created_at DESC`, userId) as any[];
  const favorites = await favoriteRepoIdsForUser(userId);
  const purchased = await purchasedRepoIdsForUser(userId);
  return rows.map((r) => mapRepo(r, favorites, purchased));
}

export async function listFavorites(userId: string): Promise<Repository[]> {
  const rows = await all(`${REPO_SELECT} JOIN favorites fv ON fv.repo_id = p.id WHERE fv.user_id = ? ORDER BY fv.created_at DESC`, userId) as any[];
  const favorites = await favoriteRepoIdsForUser(userId);
  const purchased = await purchasedRepoIdsForUser(userId);
  return rows.map((r) => mapRepo(r, favorites, purchased));
}

export async function listPurchases(userId: string): Promise<PurchaseRecord[]> {
  const rows = await all(`SELECT p.*, pr.*
       FROM purchases p
       JOIN repos pr ON pr.id = p.repo_id
       WHERE p.user_id = ?
       ORDER BY p.purchased_at DESC`, userId) as any[];
  const items: PurchaseRecord[] = [];
  for (const row of rows) {
    // Repo SELECT enriched fields require separate query, fallback minimal
    const repo = (await getRepoById(row.repo_id, userId)) ?? ({} as Repository);
    items.push({
      id: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      repoId: row.repo_id,
      repo,
      price: Number(row.price),
      currency: row.currency as Currency,
      purchasedAt: row.purchased_at,
    });
  }
  return items;
}

export async function getPurchaseByOrder(orderId: string): Promise<PurchaseRecord | null> {
  const row = await one(`SELECT * FROM purchases WHERE order_id = ?`, orderId) as any;
  if (!row) return null;
  const repo = await getRepoById(row.repo_id, row.user_id) ?? ({} as Repository);
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

export async function toggleFavoriteRepo(repoId: string, userId: string): Promise<boolean> {
  const existing = await one(`SELECT 1 FROM favorites WHERE repo_id = ? AND user_id = ?`, repoId, userId);
  if (existing) {
    await run(`DELETE FROM favorites WHERE repo_id = ? AND user_id = ?`, repoId, userId);
    return false;
  }
  await run(`INSERT INTO favorites (repo_id, user_id, created_at) VALUES (?, ?, ?)`, repoId, userId, new Date().toISOString());
  return true;
}

export async function isRepoSharedWithGroup(repoId: string, groupId: string): Promise<boolean> {
  return Boolean(await one(`SELECT 1 FROM repo_groups WHERE repo_id = ? AND group_id = ?`, repoId, groupId));
}

export async function shareRepoToGroup(repoId: string, groupId: string): Promise<void> {
  await run(`INSERT OR IGNORE INTO repo_groups (repo_id, group_id) VALUES (?, ?)`, repoId, groupId);
}

export async function unshareRepoFromGroup(repoId: string, groupId: string): Promise<void> {
  await run(`DELETE FROM repo_groups WHERE repo_id = ? AND group_id = ?`, repoId, groupId);
}

export async function listReposInGroup(groupId: string, currentUserId: string | null): Promise<Repository[]> {
  const rows = await all(`${REPO_SELECT}
       JOIN repo_groups rg ON rg.repo_id = p.id
       WHERE rg.group_id = ?
       ORDER BY rg.rowid DESC`, groupId) as any[];
  const favorites = await favoriteRepoIdsForUser(currentUserId);
  const purchased = await purchasedRepoIdsForUser(currentUserId);
  return rows.map((r) => mapRepo(r, favorites, purchased));
}

export async function listRecentRepos(limit: number, currentUserId: string | null): Promise<Repository[]> {
  const rows = await all(`${REPO_SELECT} ORDER BY p.created_at DESC LIMIT ?`, limit) as any[];
  const favorites = await favoriteRepoIdsForUser(currentUserId);
  const purchased = await purchasedRepoIdsForUser(currentUserId);
  return rows.map((r) => mapRepo(r, favorites, purchased));
}

export async function listHotRepos(limit: number, currentUserId: string | null): Promise<Repository[]> {
  const rows = await all(`${REPO_SELECT} ORDER BY download_count DESC, p.total_sales DESC, p.view_count DESC LIMIT ?`, limit) as any[];
  const favorites = await favoriteRepoIdsForUser(currentUserId);
  const purchased = await purchasedRepoIdsForUser(currentUserId);
  return rows.map((r) => mapRepo(r, favorites, purchased));
}

export async function listFreeRepos(limit: number, currentUserId: string | null): Promise<Repository[]> {
  const rows = await all(`${REPO_SELECT} WHERE p.pricing_type = 'free' ORDER BY p.created_at DESC LIMIT ?`, limit) as any[];
  const favorites = await favoriteRepoIdsForUser(currentUserId);
  const purchased = await purchasedRepoIdsForUser(currentUserId);
  return rows.map((r) => mapRepo(r, favorites, purchased));
}

// ---------------------------------------------------------------------------
// Orders / Checkout
// ---------------------------------------------------------------------------

export async function createOrder(input: {
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
}): Promise<Order> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const orderNo = generateOrderNo();
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  const totalAmount = input.unitPrice * quantity;
  await run(`INSERT INTO orders (id, order_no, buyer_id, seller_id, repo_id, repo_name, repo_owner_id, quantity, unit_price, total_amount, currency, platform_fee, seller_earning, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`, id, orderNo, input.buyerId, input.sellerId, input.repoId, input.repoName, input.repoOwnerId, quantity, input.unitPrice, totalAmount, input.currency, input.platformFee, input.sellerEarning, now);
  return (await getOrderById(id))!;
}

export async function getOrderById(id: string): Promise<Order | null> {
  const row = await one(`SELECT * FROM orders WHERE id = ?`, id) as any;
  if (!row) return null;
  const buyer = await getUserById(row.buyer_id) ?? ({} as User);
  const seller = await getUserById(row.seller_id) ?? ({} as User);
  return mapOrder(row, buyer, seller);
}

export async function getOrderByNo(orderNo: string): Promise<Order | null> {
  const row = await one(`SELECT * FROM orders WHERE order_no = ?`, orderNo) as any;
  if (!row) return null;
  const buyer = await getUserById(row.buyer_id) ?? ({} as User);
  const seller = await getUserById(row.seller_id) ?? ({} as User);
  return mapOrder(row, buyer, seller);
}

export async function listOrdersByBuyer(userId: string, limit = 50, offset = 0): Promise<{ items: Order[]; total: number }> {
  const total = (await one(`SELECT COUNT(*) AS c FROM orders WHERE buyer_id = ?`, userId) as any).c;
  const rows = await all(`SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`, userId, limit, offset) as any[];
  const sellerCache = new Map<string, User>();
  const items: Order[] = [];
  for (const row of rows) {
    let seller = sellerCache.get(row.seller_id);
    if (!seller) {
      seller = (await getUserById(row.seller_id)) ?? ({} as User);
      sellerCache.set(row.seller_id, seller);
    }
    const buyer = (await getUserById(row.buyer_id)) ?? ({} as User);
    items.push(mapOrder(row, buyer, seller));
  }
  return { items, total };
}

export async function listOrdersBySeller(userId: string, limit = 50, offset = 0): Promise<{ items: Order[]; total: number }> {
  const total = (await one(`SELECT COUNT(*) AS c FROM orders WHERE seller_id = ?`, userId) as any).c;
  const rows = await all(`SELECT * FROM orders WHERE seller_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`, userId, limit, offset) as any[];
  const buyerCache = new Map<string, User>();
  const items: Order[] = [];
  for (const row of rows) {
    let buyer = buyerCache.get(row.buyer_id);
    if (!buyer) {
      buyer = (await getUserById(row.buyer_id)) ?? ({} as User);
      buyerCache.set(row.buyer_id, buyer);
    }
    const seller = (await getUserById(row.seller_id)) ?? ({} as User);
    items.push(mapOrder(row, buyer, seller));
  }
  return { items, total };
}

export async function listUserOrders(args: {
  userId: string;
  role: 'buyer' | 'seller';
  status?: OrderStatus;
  limit?: number;
  offset?: number;
}): Promise<{ items: Order[]; total: number }> {
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
  const total = (await one(`SELECT COUNT(*) AS c FROM orders WHERE ${whereSql}`, ...params) as any).c;
  const rows = await all(`SELECT * FROM orders WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, ...params, limit, offset) as any[];
  const personCache = new Map<string, User>();
  const items: Order[] = [];
  for (const row of rows) {
    const buyerId = role === 'seller' ? row.buyer_id : userId;
    const sellerId = role === 'buyer' ? row.seller_id : userId;
    let buyer = personCache.get(buyerId);
    if (!buyer) {
      buyer = (await getUserById(buyerId)) ?? ({} as User);
      personCache.set(buyerId, buyer);
    }
    let seller = personCache.get(sellerId);
    if (!seller) {
      seller = (await getUserById(sellerId)) ?? ({} as User);
      personCache.set(sellerId, seller);
    }
    items.push(mapOrder(row, buyer, seller));
  }
  return { items, total };
}

export interface PayOrderResult {
  success: boolean;
  order?: Order;
  purchase?: PurchaseRecord;
  error?: string;
  code?: string;
}

export async function payOrderWithWallet(orderId: string, buyerId: string): Promise<PayOrderResult> {
  const order = await getOrderById(orderId);
  if (!order) return { success: false, error: 'Order not found', code: 'order_not_found' };
  if (order.buyerId !== buyerId) return { success: false, error: 'Not your order', code: 'not_your_order' };
  if (order.status !== 'pending') {
    return { success: false, error: `Order is already ${order.status}`, code: 'already_paid' };
  }
  if (order.totalAmount > 0) {
    const buyer = await getUserById(buyerId);
    if (!buyer || buyer.walletBalance < order.totalAmount) {
      return { success: false, error: 'Insufficient wallet balance', code: 'insufficient_balance' };
    }
  }

  const now = new Date().toISOString();
  const db = getDb();
  const statements: D1PreparedStatement[] = [
    // The DB trigger checks the buyer balance and that the order is still pending.
    db
      .prepare(`UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending'`)
      .bind(now, order.id),
  ];

  const buyerNewBal = order.buyer.walletBalance - order.totalAmount;
  const sellerNewBal = order.seller.walletBalance + order.sellerEarning;

  if (order.totalAmount > 0) {
    statements.push(
      db
        .prepare(`UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?`)
        .bind(order.totalAmount, buyerId),
      db
        .prepare(
          `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, currency, description, order_id, reference_id, created_at)
           VALUES (?, ?, 'purchase', ?, ?, ?, ?, ?, NULL, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          buyerId,
          -order.totalAmount,
          buyerNewBal,
          order.currency,
          `Purchase: ${order.repoName}`,
          order.id,
          now,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT OR IGNORE INTO purchases (id, order_id, user_id, repo_id, price, currency, purchased_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), order.id, buyerId, order.repoId, order.unitPrice, order.currency, now),
  );

  if (order.sellerEarning > 0) {
    statements.push(
      db
        .prepare(`UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?`)
        .bind(order.sellerEarning, order.sellerId),
      db
        .prepare(
          `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, currency, description, order_id, reference_id, created_at)
           VALUES (?, ?, 'sale', ?, ?, ?, ?, ?, NULL, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          order.sellerId,
          order.sellerEarning,
          sellerNewBal,
          order.currency,
          `Sale: ${order.repoName} (order ${order.orderNo})`,
          order.id,
          now,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        `UPDATE repos SET total_sales = total_sales + 1, total_revenue = total_revenue + ? WHERE id = ?`,
      )
      .bind(order.sellerEarning, order.repoId),
    db.prepare(`UPDATE users SET total_sales = total_sales + 1 WHERE id = ?`).bind(order.sellerId),
    db.prepare(`UPDATE users SET total_purchases = total_purchases + 1 WHERE id = ?`).bind(buyerId),
  );

  try {
    await batch(statements);
    const updated = await getOrderById(orderId);
    const purchase = await getPurchaseByOrder(orderId);
    return { success: true, order: updated ?? undefined, purchase: purchase ?? undefined };
  } catch (err: any) {
    const message = String(err?.message ?? 'Payment failed');
    const code = message.includes('insufficient_balance')
      ? 'insufficient_balance'
      : message.includes('order_not_pending')
        ? 'already_paid'
        : 'payment_failed';
    return { success: false, error: message, code };
  }
}

export async function refundOrder(orderId: string, adminId: string, reason = ''): Promise<PayOrderResult> {
  const order = await getOrderById(orderId);
  if (!order) return { success: false, error: 'Order not found', code: 'order_not_found' };
  if (order.status !== 'paid') {
    return { success: false, error: 'Only paid orders can be refunded', code: 'not_refundable' };
  }

  const now = new Date().toISOString();
  const db = getDb();
  const buyerNewBal = order.buyer.walletBalance + order.totalAmount;
  const sellerNewBal = order.seller.walletBalance - order.sellerEarning;
  const statements: D1PreparedStatement[] = [
    // The DB trigger rejects a second refund of the same order.
    db.prepare(`UPDATE orders SET status = 'refunded', refunded_at = ? WHERE id = ?`).bind(now, order.id),
  ];

  if (order.totalAmount > 0) {
    statements.push(
      db
        .prepare(`UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?`)
        .bind(order.totalAmount, order.buyerId),
      db
        .prepare(
          `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, currency, description, order_id, reference_id, created_at)
           VALUES (?, ?, 'refund', ?, ?, ?, ?, ?, NULL, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          order.buyerId,
          order.totalAmount,
          buyerNewBal,
          order.currency,
          `Refund for order ${order.orderNo}${reason ? ` - ${reason}` : ''}`,
          order.id,
          now,
        ),
    );
  }

  if (order.sellerEarning > 0) {
    statements.push(
      db
        .prepare(`UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?`)
        .bind(order.sellerEarning, order.sellerId),
      db
        .prepare(
          `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, currency, description, order_id, reference_id, created_at)
           VALUES (?, ?, 'refund', ?, ?, ?, ?, ?, NULL, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          order.sellerId,
          -order.sellerEarning,
          sellerNewBal,
          order.currency,
          `Reverse earning for refunded order ${order.orderNo}`,
          order.id,
          now,
        ),
    );
  }

  statements.push(
    db.prepare(`DELETE FROM purchases WHERE order_id = ?`).bind(order.id),
    db
      .prepare(
        `UPDATE repos SET total_sales = MAX(0, total_sales - 1), total_revenue = MAX(0, total_revenue - ?) WHERE id = ?`,
      )
      .bind(order.sellerEarning, order.repoId),
    db.prepare(`UPDATE users SET total_sales = MAX(0, total_sales - 1) WHERE id = ?`).bind(order.sellerId),
    db
      .prepare(`UPDATE users SET total_purchases = MAX(0, total_purchases - 1) WHERE id = ?`)
      .bind(order.buyerId),
  );

  try {
    await batch(statements);
    const updated = await getOrderById(orderId);
    return { success: true, order: updated ?? undefined };
  } catch (err: any) {
    const message = String(err?.message ?? 'Refund failed');
    const code = message.includes('order_already_refunded') ? 'not_refundable' : 'refund_failed';
    return { success: false, error: message, code };
  }
}

// ---------------------------------------------------------------------------
// Contact-based purchase requests
// ---------------------------------------------------------------------------

async function mapPurchaseRequest(
  row: any,
  includeBuyerEmail: boolean,
): Promise<PurchaseRequest | null> {
  const repo = await getRepoById(row.repo_id, null, false);
  if (!repo) return null;
  const buyer = (await getUserById(row.buyer_id)) ?? ({} as User);
  const seller = (await getUserById(row.seller_id)) ?? ({} as User);
  return {
    id: row.id,
    repoId: row.repo_id,
    repo,
    buyerId: row.buyer_id,
    buyer,
    sellerId: row.seller_id,
    seller,
    buyerEmail: includeBuyerEmail ? row.buyer_email : undefined,
    message: row.message ?? '',
    status: row.status as PurchaseRequestStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function hasCompletedPurchaseRequest(repoId: string, buyerId: string): Promise<boolean> {
  return Boolean(
    await one(
      `SELECT 1 FROM purchase_requests WHERE repo_id = ? AND buyer_id = ? AND status = 'completed'`,
      repoId,
      buyerId,
    ),
  );
}

export async function hasPendingPurchaseRequest(repoId: string, buyerId: string): Promise<boolean> {
  return Boolean(
    await one(
      `SELECT 1 FROM purchase_requests WHERE repo_id = ? AND buyer_id = ? AND status IN ('pending', 'contacted')`,
      repoId,
      buyerId,
    ),
  );
}

export async function getPurchaseRequestForBuyer(
  repoId: string,
  buyerId: string,
): Promise<PurchaseRequest | null> {
  const row = await one(
    `SELECT * FROM purchase_requests WHERE repo_id = ? AND buyer_id = ? AND status IN ('pending', 'contacted', 'completed') ORDER BY created_at DESC LIMIT 1`,
    repoId,
    buyerId,
  );
  return row ? mapPurchaseRequest(row, false) : null;
}

export async function createPurchaseRequest(input: {
  repoId: string;
  buyerId: string;
  sellerId: string;
  buyerEmail: string;
  message: string;
}): Promise<PurchaseRequest> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(
    `INSERT INTO purchase_requests (id, repo_id, buyer_id, seller_id, buyer_email, message, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    id,
    input.repoId,
    input.buyerId,
    input.sellerId,
    input.buyerEmail,
    input.message,
    now,
    now,
  );
  return (await mapPurchaseRequest(
    await one(`SELECT * FROM purchase_requests WHERE id = ?`, id),
    true,
  ))!;
}

export async function getPurchaseRequestById(
  id: string,
  includeBuyerEmail = false,
): Promise<PurchaseRequest | null> {
  const row = await one(`SELECT * FROM purchase_requests WHERE id = ?`, id);
  return row ? mapPurchaseRequest(row, includeBuyerEmail) : null;
}

export async function listPurchaseRequests(userId: string): Promise<{
  incoming: PurchaseRequest[];
  outgoing: PurchaseRequest[];
}> {
  const incomingRows = await all(
    `SELECT * FROM purchase_requests WHERE seller_id = ? ORDER BY created_at DESC LIMIT 100`,
    userId,
  );
  const outgoingRows = await all(
    `SELECT * FROM purchase_requests WHERE buyer_id = ? ORDER BY created_at DESC LIMIT 100`,
    userId,
  );
  const incoming: PurchaseRequest[] = [];
  for (const row of incomingRows) {
    const item = await mapPurchaseRequest(row, true);
    if (item) incoming.push(item);
  }
  const outgoing: PurchaseRequest[] = [];
  for (const row of outgoingRows) {
    const item = await mapPurchaseRequest(row, false);
    if (item) outgoing.push(item);
  }
  return { incoming, outgoing };
}

export async function updatePurchaseRequestStatus(
  id: string,
  status: PurchaseRequestStatus,
): Promise<void> {
  await run(
    `UPDATE purchase_requests SET status = ?, updated_at = ? WHERE id = ?`,
    status,
    new Date().toISOString(),
    id,
  );
}

export async function countPendingPurchaseRequests(sellerId: string): Promise<number> {
  return Number(
    (await one(
      `SELECT COUNT(*) AS c FROM purchase_requests WHERE seller_id = ? AND status = 'pending'`,
      sellerId,
    ) as any).c,
  );
}

// ---------------------------------------------------------------------------
// Community board
// ---------------------------------------------------------------------------

const COMMUNITY_SELECT = `
SELECT cp.*,
  u.username AS username, u.nickname AS nickname, u.avatar_url AS avatar_url,
  u.bio AS bio, u.created_at AS user_created_at,
  (SELECT COUNT(*) FROM repos r WHERE r.owner_id = u.id) AS repo_count,
  (SELECT COUNT(*) FROM files f JOIN repos r2 ON r2.id = f.repo_id WHERE r2.owner_id = u.id) AS file_count,
  (SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = u.id) AS group_count,
  (SELECT COALESCE(SUM(f2.download_count), 0) FROM files f2 JOIN repos r3 ON r3.id = f2.repo_id WHERE r3.owner_id = u.id) AS total_downloads,
  (SELECT COALESCE(SUM(f3.file_bytes), 0) FROM files f3 JOIN repos r4 ON r4.id = f3.repo_id WHERE r4.owner_id = u.id) AS total_bytes,
  u.wallet_balance AS wallet_balance,
  u.total_sales AS total_sales,
  u.total_purchases AS total_purchases
FROM community_posts cp
JOIN users u ON u.id = cp.user_id
`;

function mapCommunityPost(row: any, currentUserId: string | null): CommunityPost {
  const isAnonymous = Boolean(row.is_anonymous);
  const author = isAnonymous
    ? anonymousUser(row.user_id)
    : {
        ...mapUser(row),
        createdAt: row.user_created_at,
      };
  return {
    id: row.id,
    userId: row.user_id,
    author,
    content: row.content,
    isAnonymous,
    createdAt: row.created_at,
    isOwn: currentUserId === row.user_id,
  };
}

export async function listCommunityPosts(
  limit = 80,
  currentUserId: string | null = null,
): Promise<CommunityPost[]> {
  const rows = await all(
    `${COMMUNITY_SELECT} ORDER BY cp.created_at DESC LIMIT ?`,
    Math.min(Math.max(limit, 1), 200),
  ) as any[];
  return rows.reverse().map((row) => mapCommunityPost(row, currentUserId));
}

export async function getCommunityPostById(
  id: string,
  currentUserId: string | null = null,
): Promise<CommunityPost | null> {
  const row = await one(`${COMMUNITY_SELECT} WHERE cp.id = ?`, id) as any;
  return row ? mapCommunityPost(row, currentUserId) : null;
}

export async function createCommunityPost(input: {
  userId: string;
  content: string;
  isAnonymous: boolean;
}): Promise<CommunityPost> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(
    `INSERT INTO community_posts (id, user_id, content, is_anonymous, created_at) VALUES (?, ?, ?, ?, ?)`,
    id,
    input.userId,
    input.content,
    input.isAnonymous ? 1 : 0,
    now,
  );
  return (await getCommunityPostById(id, input.userId))!;
}

export async function deleteCommunityPost(id: string): Promise<void> {
  await run(`DELETE FROM community_posts WHERE id = ?`, id);
}

// ---------------------------------------------------------------------------
// Comments / Reviews
// ---------------------------------------------------------------------------

export async function listRepoComments(repoId: string): Promise<Comment[]> {
  const rows = await all(`SELECT c.id, c.repo_id, c.user_id, c.content, c.created_at,
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
       ORDER BY c.created_at ASC`, repoId) as any[];
  return rows.map((row) => ({
    id: row.id,
    repoId: row.repo_id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
    user: mapUser(row),
  }));
}

export async function commentExists(commentId: string): Promise<boolean> {
  return Boolean(await one(`SELECT 1 FROM comments WHERE id = ?`, commentId));
}

export async function createRepoComment(repoId: string, userId: string, content: string): Promise<Comment> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(`INSERT INTO comments (id, repo_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`, id, repoId, userId, content, now);
  return (await listRepoComments(repoId)).find((c) => c.id === id)!;
}

export async function listRepoReviews(repoId: string): Promise<Review[]> {
  const rows = await all(`SELECT rv.*,
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
       ORDER BY rv.created_at DESC`, repoId) as any[];
  return rows.map((row) => mapReview(row, mapUser(row)));
}

export async function canUserReviewRepo(userId: string, repoId: string): Promise<boolean> {
  // A legacy purchase or a completed contact request unlocks reviews.
  const purchased = await hasUserPurchasedRepo(userId, repoId);
  const completedRequest = await hasCompletedPurchaseRequest(repoId, userId);
  if (!purchased && !completedRequest) {
    // Owner or free resource also allowed? Owner always. Free: allow everyone.
    const repo = await getRepoById(repoId, null);
    if (!repo) return false;
    if (repo.ownerId === userId) return true;
    if (repo.pricingType === 'free') return true;
    return false;
  }
  const reviewed = Boolean(await one(`SELECT 1 FROM reviews WHERE user_id = ? AND repo_id = ?`, userId, repoId));
  return !reviewed;
}

export async function createReview(input: {
  repoId: string;
  userId: string;
  rating: ReviewRating;
  title?: string;
  content: string;
}): Promise<Review> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(`INSERT INTO reviews (id, repo_id, user_id, rating, title, content, created_at, updated_at, helpful_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`, id, input.repoId, input.userId, input.rating, input.title ?? '', input.content, now, now);
  return (await listRepoReviews(input.repoId)).find((r) => r.id === id)!;
}

export async function updateReview(id: string, patch: { rating?: ReviewRating; title?: string; content?: string }): Promise<Review | null> {
  const row = await one(`SELECT repo_id FROM reviews WHERE id = ?`, id) as any;
  if (!row) return null;
  await run(`UPDATE reviews SET
       rating = COALESCE(?, rating),
       title = COALESCE(?, title),
       content = COALESCE(?, content),
       updated_at = ?
     WHERE id = ?`, patch.rating ?? null, patch.title ?? null, patch.content ?? null, new Date().toISOString(), id);
  return (await listRepoReviews(row.repo_id)).find((r) => r.id === id) ?? null;
}

export async function deleteReview(id: string): Promise<void> {
  await run(`DELETE FROM reviews WHERE id = ?`, id);
}

export async function getReviewById(id: string): Promise<Review | null> {
  const row = await one(`SELECT * FROM reviews WHERE id = ?`, id) as any;
  if (!row) return null;
  const user = await getUserById(row.user_id) ?? ({} as User);
  return mapReview(row, user);
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export async function recordWalletTx(input: {
  userId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  currency: Currency;
  description: string;
  orderId?: string;
  referenceId?: string;
}): Promise<WalletTransaction> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(`INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, currency, description, order_id, reference_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, input.userId, input.type, input.amount, input.balanceAfter, input.currency, input.description, input.orderId ?? null, input.referenceId ?? null, now);
  const user = await getUserById(input.userId) ?? ({} as User);
  return mapWalletTx({ ...input, id, created_at: now }, user);
}

export async function getWalletOverview(userId: string): Promise<WalletOverview> {
  const user = await getUserById(userId) ?? ({} as User);
  const balance = user.walletBalance ?? 0;
  const totalIncome = Number(
    (await one(`SELECT COALESCE(SUM(amount), 0) AS c FROM wallet_transactions WHERE user_id = ? AND amount > 0`, userId) as any).c,
  );
  const totalExpense = Math.abs(
    Number(
      (await one(`SELECT COALESCE(SUM(amount), 0) AS c FROM wallet_transactions WHERE user_id = ? AND amount < 0`, userId) as any).c,
    ),
  );
  const rows = await all(`SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, userId) as any[];
  const u = await getUserById(userId);
  return {
    balance,
    currency: 'CNY',
    totalIncome,
    totalExpense,
    pendingEarnings: 0,
    recentTransactions: rows.map((row) => mapWalletTx(row, u ?? undefined)),
  };
}

export async function listWalletTransactions(args: {
  userId: string;
  type?: TransactionType;
  limit?: number;
  offset?: number;
}): Promise<{ items: WalletTransaction[]; total: number }> {
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
  const total = (await one(`SELECT COUNT(*) AS c FROM wallet_transactions WHERE ${whereSql}`, ...params) as any).c;
  const rows = await all(`SELECT * FROM wallet_transactions WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, ...params, limit, offset) as any[];
  const u = await getUserById(userId);
  return {
    items: rows.map((row) => mapWalletTx(row, u ?? undefined)),
    total,
  };
}

export async function topUpWallet(userId: string, amount: number, currency: Currency): Promise<WalletOverview> {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');
  const balanceAfter = user.walletBalance + amount;
  const now = new Date().toISOString();
  const db = getDb();
  await batch([
    db
      .prepare(`UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?`)
      .bind(amount, userId),
    db
      .prepare(
        `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, currency, description, order_id, reference_id, created_at)
         VALUES (?, ?, 'topup', ?, ?, ?, ?, NULL, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        userId,
        amount,
        balanceAfter,
        currency,
        'Wallet top-up (admin)',
        `topup_${Date.now()}`,
        now,
      ),
  ]);
  return await getWalletOverview(userId);
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function memberGroupIdsForUser(userId: string | null): Promise<Set<string>> {
  const set = new Set<string>();
  if (!userId) return set;
  const rows = await all(`SELECT group_id FROM group_members WHERE user_id = ?`, userId) as any[];
  for (const r of rows) set.add(r.group_id);
  return set;
}

export async function adminGroupIdsForUser(userId: string | null): Promise<Set<string>> {
  const set = new Set<string>();
  if (!userId) return set;
  const rows = await all(`SELECT group_id FROM group_members WHERE user_id = ? AND role = 'admin'`, userId) as any[];
  for (const r of rows) set.add(r.group_id);
  return set;
}

export async function pendingRequestsForUser(userId: string | null): Promise<Map<string, 'pending'>> {
  const map = new Map<string, 'pending'>();
  if (!userId) return map;
  const rows = await all(`SELECT group_id FROM group_requests WHERE user_id = ? AND status = 'pending'`, userId) as any[];
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

export async function listGroups(args: ListGroupsArgs, currentUserId: string | null): Promise<Group[]> {
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

  const rows = await all(`${GROUP_SELECT} ${whereSql} ${orderBy} LIMIT ? OFFSET ?`, ...params, args.limit, args.offset) as any[];
  const memberIds = await memberGroupIdsForUser(currentUserId);
  const adminIds = await adminGroupIdsForUser(currentUserId);
  const pending = await pendingRequestsForUser(currentUserId);
  return rows.map((r) => mapGroup(r, memberIds, adminIds, pending));
}

export async function getGroupById(id: string, currentUserId: string | null): Promise<Group | null> {
  const row = await one(`${GROUP_SELECT} WHERE g.id = ?`, id) as any;
  if (!row) return null;
  return mapGroup(
    row,
    await memberGroupIdsForUser(currentUserId),
    await adminGroupIdsForUser(currentUserId),
    await pendingRequestsForUser(currentUserId),
  );
}

export async function createGroup(input: {
  name: string;
  description: string;
  categoryId: string;
  creatorId: string;
}): Promise<Group> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = getDb();
  await batch([
    db
      .prepare(
        `INSERT INTO groups (id, name, description, category_id, creator_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, input.name, input.description, input.categoryId, input.creatorId, now),
    db
      .prepare(
        `INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'admin', ?)`,
      )
      .bind(id, input.creatorId, now),
  ]);
  return (await getGroupById(id, input.creatorId))!;
}

export async function updateGroup(
  id: string,
  patch: { name?: string; description?: string; categoryId?: string },
): Promise<Group | null> {
  await run(`UPDATE groups SET name = COALESCE(?, name), description = COALESCE(?, description), category_id = COALESCE(?, category_id) WHERE id = ?`, patch.name ?? null, patch.description ?? null, patch.categoryId ?? null, id);
  return await getGroupById(id, null);
}

export async function deleteGroup(id: string): Promise<void> {
  await run(`DELETE FROM groups WHERE id = ?`, id);
}

export async function groupRole(groupId: string, userId: string): Promise<'admin' | 'member' | null> {
  const row = await one(`SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`, groupId, userId) as any;
  return row?.role ?? null;
}

export async function requestToJoin(groupId: string, userId: string): Promise<'created' | 'pending' | 'already-member'> {
  if (await groupRole(groupId, userId)) return 'already-member';
  const existing = await one(`SELECT id FROM group_requests WHERE group_id = ? AND user_id = ? AND status = 'pending'`, groupId, userId);
  if (existing) return 'pending';
  await run(`INSERT INTO group_requests (id, group_id, user_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)`, crypto.randomUUID(), groupId, userId, new Date().toISOString());
  return 'created';
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  await run(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`, groupId, userId);
  await run(`UPDATE group_requests SET status = 'rejected', decided_at = ? WHERE group_id = ? AND user_id = ? AND status = 'pending'`, new Date().toISOString(), groupId, userId);
}

export async function listGroupRequests(groupId: string): Promise<GroupRequest[]> {
  const rows = await all(`SELECT gr.id, gr.group_id, gr.user_id, gr.status, gr.created_at,
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
       ORDER BY (gr.status = 'pending') DESC, gr.created_at ASC`, groupId) as any[];
  return rows.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    status: row.status,
    createdAt: row.created_at,
    user: mapUser(row),
  }));
}

export async function getGroupRequestById(requestId: string): Promise<GroupRequest | null> {
  const row = await one(`SELECT * FROM group_requests WHERE id = ?`, requestId) as any;
  if (!row) return null;
  const full = (await listGroupRequests(row.group_id)).find((r) => r.id === requestId);
  return full ?? null;
}

export async function approveRequest(requestId: string): Promise<void> {
  const request = await one(`SELECT * FROM group_requests WHERE id = ? AND status = 'pending'`, requestId) as any;
  if (!request) return;
  const now = new Date().toISOString();
  const db = getDb();
  await batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`,
      )
      .bind(request.group_id, request.user_id, now),
    db
      .prepare(`UPDATE group_requests SET status = 'approved', decided_at = ? WHERE id = ?`)
      .bind(now, requestId),
  ]);
}

export async function rejectRequest(requestId: string): Promise<void> {
  await run(`UPDATE group_requests SET status = 'rejected', decided_at = ? WHERE id = ?`, new Date().toISOString(), requestId);
}

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const rows = await all(`SELECT gm.user_id, gm.role, gm.joined_at,
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
       ORDER BY gm.role DESC, gm.joined_at ASC`, groupId) as any[];
  return rows.map(mapMember);
}

export async function listGroupsByMember(userId: string): Promise<Group[]> {
  const rows = await all(`${GROUP_SELECT} JOIN group_members gm ON gm.group_id = g.id WHERE gm.user_id = ? ORDER BY gm.joined_at DESC`, userId) as any[];
  const memberIds = await memberGroupIdsForUser(userId);
  const adminIds = await adminGroupIdsForUser(userId);
  const pending = await pendingRequestsForUser(userId);
  return rows.map((r) => mapGroup(r, memberIds, adminIds, pending));
}

export async function listActiveGroups(limit: number, currentUserId: string | null): Promise<Group[]> {
  const rows = await all(`${GROUP_SELECT} ORDER BY member_count DESC, repo_count DESC LIMIT ?`, limit) as any[];
  const memberIds = await memberGroupIdsForUser(currentUserId);
  const adminIds = await adminGroupIdsForUser(currentUserId);
  const pending = await pendingRequestsForUser(currentUserId);
  return rows.map((r) => mapGroup(r, memberIds, adminIds, pending));
}

// ---------------------------------------------------------------------------
// Leaderboard / stats / search / reports
// ---------------------------------------------------------------------------

export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const rows = await all(`${USER_SELECT}
       ORDER BY file_count DESC, total_bytes DESC
       LIMIT ?`, limit) as any[];
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

export async function getTopSellers(limit = 20): Promise<LeaderboardEntry[]> {
  const rows = await all(`SELECT u.*,
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
       LIMIT ?`, limit) as any[];
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

export async function getStats(): Promise<HomeData['stats']> {
  const count = async (table: string) => (await one(`SELECT COUNT(*) AS c FROM ${table}`) as any).c;
  return {
    repos: await count('repos'),
    files: await count('files'),
    groups: await count('groups'),
    users: await count('users'),
    downloads: (await one(`SELECT COALESCE(SUM(download_count), 0) AS c FROM files`) as any).c,
    totalSales: (await one(`SELECT COALESCE(SUM(total_sales), 0) AS c FROM repos`) as any).c,
    totalRevenue: (await one(`SELECT COALESCE(SUM(total_revenue), 0) AS c FROM repos`) as any).c,
    freeRepos: (await one(`SELECT COUNT(*) AS c FROM repos WHERE pricing_type = 'free'`) as any).c,
  };
}

export async function searchAll(q: string, currentUserId: string | null): Promise<{ repos: Repository[]; groups: Group[] }> {
  const repos = (await listRepos({ search: q, limit: 8, offset: 0 }, currentUserId)).items;
  const groups = await listGroups({ search: q, limit: 8, offset: 0 }, currentUserId);
  return { repos, groups };
}

export async function createReport(input: {
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
}): Promise<Report> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(`INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)`, id, input.reporterId, input.targetType, input.targetId, input.reason, now);
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

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await run(`UPDATE users SET is_admin = ? WHERE id = ?`, isAdmin ? 1 : 0, userId);
}

export async function setUserSuspended(userId: string, suspended: boolean): Promise<void> {
  await run(`UPDATE users SET is_suspended = ? WHERE id = ?`, suspended ? 1 : 0, userId);
}

export async function setUserCanBuy(userId: string, allowed: boolean): Promise<void> {
  await run(`UPDATE users SET can_buy = ? WHERE id = ?`, allowed ? 1 : 0, userId);
}

export async function setUserCanPublishFree(userId: string, allowed: boolean): Promise<void> {
  await run(`UPDATE users SET can_publish_free = ? WHERE id = ?`, allowed ? 1 : 0, userId);
}

export async function setUserCanPublishPaid(userId: string, allowed: boolean): Promise<void> {
  await run(`UPDATE users SET can_publish_paid = ? WHERE id = ?`, allowed ? 1 : 0, userId);
}

export async function setUserCanChat(userId: string, allowed: boolean): Promise<void> {
  await run(`UPDATE users SET can_chat = ? WHERE id = ?`, allowed ? 1 : 0, userId);
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const row = await one(`SELECT email FROM users WHERE id = ?`, userId) as any;
  return row?.email ?? null;
}

export async function deleteUser(userId: string): Promise<void> {
  await run(`DELETE FROM users WHERE id = ?`, userId);
}

export async function listAdminUsers(args: {
  search?: string;
  offset: number;
  limit: number;
}): Promise<{ items: User[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (args.search) {
    where.push(`(u.username LIKE ? OR u.nickname LIKE ? OR u.email LIKE ?)`);
    params.push(`%${args.search}%`, `%${args.search}%`, `%${args.search}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await one(`SELECT COUNT(*) AS c FROM users u ${whereSql}`, ...params) as any).c;
  const rows = await all(`${USER_SELECT} ${whereSql} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, ...params, args.limit, args.offset) as any[];
  return {
    items: rows.map((row) => {
      const user = mapUser(row);
      user.email = row.email;
      return user;
    }),
    total,
  };
}

export async function listReports(args: {
  status?: string;
  offset: number;
  limit: number;
}): Promise<{ items: AdminReportItem[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (args.status) {
    where.push(`rp.status = ?`);
    params.push(args.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await one(`SELECT COUNT(*) AS c FROM reports rp ${whereSql}`, ...params) as any).c;
  const rows = await all(`SELECT rp.*,
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
       LIMIT ? OFFSET ?`, ...params, args.limit, args.offset) as any[];
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

export async function getAdminOverview(): Promise<{
  stats: HomeData['stats'];
  comments: number;
  openReports: number;
  orders: number;
  revenue: number;
}> {
  const stats = await getStats();
  return {
    stats,
    comments: (await one(`SELECT COUNT(*) AS c FROM comments`) as any).c,
    openReports: await countOpenReports(),
    orders: (await one(`SELECT COUNT(*) AS c FROM orders WHERE status = 'paid'`) as any).c,
    revenue: stats.totalRevenue,
  };
}

export async function countOpenReports(): Promise<number> {
  return (await one(`SELECT COUNT(*) AS c FROM reports WHERE status = 'open'`) as any).c;
}

export async function setReportStatus(reportId: string, status: 'open' | 'resolved'): Promise<void> {
  await run(`UPDATE reports SET status = ? WHERE id = ?`, status, reportId);
}

export async function deleteComment(commentId: string): Promise<void> {
  await run(`DELETE FROM comments WHERE id = ?`, commentId);
}

export async function deleteFileById(fileId: string): Promise<RepoFile | null> {
  const file = await getRepoFileById(fileId);
  if (!file) return null;
  await deleteUpload(file.filePath);
  await run(`DELETE FROM files WHERE id = ?`, fileId);
  return file;
}

export async function listAllOrders(args: {
  status?: OrderStatus;
  search?: string;
  offset: number;
  limit: number;
}): Promise<{ items: Order[]; total: number }> {
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
  const total = (await one(`SELECT COUNT(*) AS c FROM orders o ${whereSql}`, ...params) as any).c;
  const rows = await all(`SELECT o.* FROM orders o ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`, ...params, args.limit, args.offset) as any[];
  const items: Order[] = [];
  for (const row of rows) {
    const buyer = (await getUserById(row.buyer_id)) ?? ({} as User);
    const seller = (await getUserById(row.seller_id)) ?? ({} as User);
    items.push(mapOrder(row, buyer, seller));
  }
  return { items, total };
}

// ---------------------------------------------------------------------------
// Account lifecycle & login history
// ---------------------------------------------------------------------------

export async function deleteUserWithFiles(userId: string): Promise<void> {
  let offset = 0;
  while (true) {
    const page = await listRepos({ ownerId: userId, limit: 100, offset }, null);
    for (const repo of page.items) {
      for (const file of await listRepoFiles(repo.id)) await deleteUpload(file.filePath);
    }
    if (page.items.length < 100) break;
    offset += 100;
  }
  await deleteUser(userId);
}

export async function deleteUsersDeactivatedBefore(beforeIso: string): Promise<number> {
  const rows = await all(`SELECT id FROM users WHERE deactivated_at IS NOT NULL AND deactivated_at < ?`, beforeIso) as any[];
  for (const r of rows) await deleteUserWithFiles(r.id);
  return rows.length;
}

export async function countAdmins(): Promise<number> {
  return (await one(`SELECT COUNT(*) AS c FROM users WHERE is_admin = 1`) as any).c;
}

export async function getTokenVersion(userId: string): Promise<number> {
  return (await one(`SELECT token_version FROM users WHERE id = ?`, userId) as any)?.token_version ?? 0;
}

export async function bumpTokenVersion(userId: string): Promise<void> {
  await run(`UPDATE users SET token_version = token_version + 1 WHERE id = ?`, userId);
}

export async function setDeactivated(userId: string): Promise<void> {
  await run(`UPDATE users SET deactivated_at = ? WHERE id = ?`, new Date().toISOString(), userId);
}

export async function clearDeactivated(userId: string): Promise<void> {
  await run(`UPDATE users SET deactivated_at = NULL WHERE id = ?`, userId);
}

export async function getDeactivatedAt(userId: string): Promise<string | null> {
  return ((await one(`SELECT deactivated_at FROM users WHERE id = ?`, userId) as any)?.deactivated_at ?? null) as string | null;
}

export async function logLogin(input: {
  userId: string | null;
  email: string;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  await run(`INSERT INTO login_logs (id, user_id, email, success, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, crypto.randomUUID(), input.userId, input.email, input.success ? 1 : 0, input.ip ?? '', input.userAgent ?? '', new Date().toISOString());
}

export async function listUserLogins(userId: string, limit = 30): Promise<LoginLog[]> {
  const rows = await all(`SELECT * FROM login_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`, userId, limit) as any[];
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

export async function getUserCount(): Promise<number> {
  return (await one(`SELECT COUNT(*) AS c FROM users`) as any).c;
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
