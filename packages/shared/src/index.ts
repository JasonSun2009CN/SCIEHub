// Domain types shared between the frontend and backend.

export type FileType = 'pdf' | 'doc' | 'ppt' | 'image' | 'code' | 'audio' | 'video' | 'archive' | 'other';
export type PricingType = 'free' | 'paid';
export type EducationLevel = 'ig' | 'as' | 'a-level' | 'ib' | 'ap' | 'other';
export type ResourceType = 'notes' | 'practice' | 'past-paper' | 'other';
export type Currency = 'CNY' | 'USD';
export type OrderStatus = 'pending' | 'paid' | 'refunded' | 'cancelled';
export type ReviewRating = 1 | 2 | 3 | 4 | 5;
export type TransactionType = 'purchase' | 'sale' | 'refund' | 'topup' | 'withdraw';

export interface User {
  id: string;
  username: string;
  nickname: string;
  avatarUrl: string;
  bio: string;
  createdAt: string;
  repoCount: number;
  fileCount: number;
  groupCount: number;
  totalDownloads: number;
  totalBytes: number;
  walletBalance: number;
  totalSales: number;
  totalPurchases: number;
  isAdmin?: boolean;
  isSuspended?: boolean;
  canBuy?: boolean;
  canPublishFree?: boolean;
  canPublishPaid?: boolean;
  canChat?: boolean;
  email?: string;
}

export interface Repository {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  owner: User;
  categoryId: string;
  categoryName: string;
  levelId: EducationLevel;
  levelName: string;
  resourceType: ResourceType;
  resourceTypeName: string;
  tags: string[];
  fileCount: number;
  totalBytes: number;
  downloadCount: number;
  viewCount: number;
  commentCount: number;
  favoriteCount: number;
  reviewCount: number;
  averageRating: number;
  groupIds: string[];
  groupNames: string[];
  createdAt: string;
  pricingType: PricingType;
  price: number;
  currency: Currency;
  totalSales: number;
  totalRevenue: number;
  isFavorite?: boolean;
  isOwner?: boolean;
  isPurchased?: boolean;
  isAnonymous: boolean;
  previewImageUrl?: string;
}

export interface CommunityPost {
  id: string;
  userId: string;
  author: User;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
  isOwn?: boolean;
}

export interface RepoFile {
  id: string;
  repoId: string;
  title: string;
  description: string;
  fileType: FileType;
  fileSize: string;
  fileBytes: number;
  filePath: string;
  downloadCount: number;
  viewCount: number;
  createdAt: string;
  isPreview: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  creatorId: string;
  creator: User;
  memberCount: number;
  repoCount: number;
  createdAt: string;
  isMember?: boolean;
  isAdmin?: boolean;
  joinStatus?: 'pending' | 'rejected' | null;
}

export interface GroupMember {
  userId: string;
  user: User;
  role: 'admin' | 'member';
  joinedAt: string;
}

export interface GroupRequest {
  id: string;
  groupId: string;
  userId: string;
  user: User;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Comment {
  id: string;
  repoId: string;
  userId: string;
  user: User;
  content: string;
  createdAt: string;
}

export interface LoginLog {
  id: string;
  userId: string | null;
  email: string;
  success: boolean;
  ip: string;
  userAgent: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  user: User;
  repoCount: number;
  fileCount: number;
  totalBytes: number;
  totalDownloads: number;
  totalSales: number;
  totalRevenue: number;
  averageRating?: number;
}

export type ReportTarget = 'repo' | 'comment' | 'review';

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  createdAt: string;
  status: 'open' | 'resolved';
}

export interface AdminReportItem extends Report {
  reporter: User;
  targetName: string;
  targetRepoId: string | null;
}

export const REPORT_REASONS = [
  { id: 'harassment', label: 'Harassment or abuse' },
  { id: 'copyright', label: 'Copyright violation / DMCA' },
  { id: 'plagiarism', label: 'Plagiarism or stolen content' },
  { id: 'spam', label: 'Spam or misleading' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'pricing', label: 'Pricing scam or overcharge' },
  { id: 'quality', label: 'False advertising / poor quality' },
  { id: 'other', label: 'Other' },
] as const;

export interface Category {
  id: string;
  name: string;
}

/** Curriculum / qualification level, kept separate from the subject. */
export interface Level {
  id: EducationLevel;
  name: string;
  shortName: string;
}

export const LEVELS: Level[] = [
  { id: 'ig', name: 'IGCSE / IG', shortName: 'IG' },
  { id: 'as', name: 'AS Level', shortName: 'AS' },
  { id: 'a-level', name: 'A Level', shortName: 'A Level' },
  { id: 'ib', name: 'IB', shortName: 'IB' },
  { id: 'ap', name: 'AP', shortName: 'AP' },
  { id: 'other', name: 'Other', shortName: 'Other' },
];

export function levelName(id: string): string {
  return LEVELS.find((level) => level.id === id)?.name ?? 'Other';
}

export interface ResourceTypeOption {
  id: ResourceType;
  name: string;
}

export const RESOURCE_TYPES: ResourceTypeOption[] = [
  { id: 'notes', name: 'Notes' },
  { id: 'practice', name: 'Practice Questions' },
  { id: 'past-paper', name: 'Past Papers' },
  { id: 'other', name: 'Other' },
];

export function resourceTypeName(id: string): string {
  return RESOURCE_TYPES.find((type) => type.id === id)?.name ?? 'Other';
}

/** Subject catalogue shared by IG, AS/A-level, IB and AP resources. */
export const CATEGORIES: Category[] = [
  { id: 'math', name: 'Mathematics' },
  { id: 'further-math', name: 'Further Mathematics' },
  { id: 'physics', name: 'Physics' },
  { id: 'chemistry', name: 'Chemistry' },
  { id: 'biology', name: 'Biology' },
  { id: 'english', name: 'English Literature / Language' },
  { id: 'chinese', name: 'Chinese' },
  { id: 'cs', name: 'Computer Science' },
  { id: 'history', name: 'History' },
  { id: 'geography', name: 'Geography' },
  { id: 'economics', name: 'Economics' },
  { id: 'business', name: 'Business Studies' },
  { id: 'psychology', name: 'Psychology' },
  { id: 'sociology', name: 'Sociology' },
  { id: 'art', name: 'Art & Design' },
  { id: 'music', name: 'Music' },
  { id: 'ict', name: 'ICT' },
  { id: 'other', name: 'Other' },
];

export function categoryName(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? 'Other';
}

/** Display label such as “IG · Mathematics · Notes”. */
export function classificationLabel(
  levelId: string,
  categoryId: string,
  resourceType: string,
): string {
  return `${LEVELS.find((level) => level.id === levelId)?.shortName ?? 'Other'} · ${categoryName(categoryId)} · ${resourceTypeName(resourceType)}`;
}

export type GroupSort = 'members' | 'repos' | 'recent';
export type RepoSort = 'recent' | 'popular' | 'views' | 'price_asc' | 'price_desc' | 'rating' | 'sales';
export type MarketplaceZone = 'all' | 'free' | 'paid';

export interface RepoListResult {
  items: Repository[];
  total: number;
}

export interface HomeStats {
  repos: number;
  files: number;
  groups: number;
  users: number;
  downloads: number;
  totalSales: number;
  totalRevenue: number;
  freeRepos: number;
}

export interface HomeData {
  stats: HomeStats;
  hotRepos: Repository[];
  activeGroups: Group[];
  recentRepos: Repository[];
  topSellers: LeaderboardEntry[];
  topContributors: LeaderboardEntry[];
  freeRepos: Repository[];
}

export interface SearchResult {
  repos: Repository[];
  groups: Group[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

// ---------------------------------------------------------------------------
// Commerce / Marketplace types
// ---------------------------------------------------------------------------

export interface Order {
  id: string;
  orderNo: string;
  buyerId: string;
  buyer: User;
  sellerId: string;
  seller: User;
  repoId: string;
  repoName: string;
  repoOwnerId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: Currency;
  platformFee: number;
  sellerEarning: number;
  status: OrderStatus;
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;
  cancelledAt?: string;
}

export interface PurchaseRecord {
  id: string;
  orderId: string;
  userId: string;
  repoId: string;
  repo: Repository;
  price: number;
  currency: Currency;
  purchasedAt: string;
}

export type PurchaseRequestStatus = 'pending' | 'contacted' | 'completed' | 'declined' | 'cancelled';

export interface PurchaseRequest {
  id: string;
  repoId: string;
  repo: Repository;
  buyerId: string;
  buyer: User;
  sellerId: string;
  seller: User;
  /** Only returned to the seller (and admins); never to the buyer. */
  buyerEmail?: string;
  message: string;
  status: PurchaseRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  repoId: string;
  userId: string;
  user: User;
  rating: ReviewRating;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  helpfulCount: number;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  user: User;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  currency: Currency;
  description: string;
  orderId?: string;
  referenceId?: string;
  createdAt: string;
}

export interface WalletOverview {
  balance: number;
  currency: Currency;
  totalIncome: number;
  totalExpense: number;
  pendingEarnings: number;
  recentTransactions: WalletTransaction[];
}

export const CURRENCIES: { code: Currency; symbol: string; name: string }[] = [
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
];

export function currencySymbol(code: Currency): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export function formatPrice(amount: number, currency: Currency): string {
  if (amount === 0) return 'Free';
  const symbol = currencySymbol(currency);
  return `${symbol}${amount.toFixed(2)}`;
}

export const PLATFORM_FEE_RATE = 0.10; // 10% platform fee
export const MIN_WITHDRAW_AMOUNT = 10;
export const MAX_FILE_PRICE = 9999;

export const AVATAR_COLORS = [
  '#38bdf8',
  '#34d399',
  '#f87171',
  '#fbbf24',
  '#a78bfa',
  '#f472b6',
  '#60a5fa',
  '#fb923c',
  '#4ade80',
  '#e879f9',
];

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function generateOrderNo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SC${date}${rand}`;
}
