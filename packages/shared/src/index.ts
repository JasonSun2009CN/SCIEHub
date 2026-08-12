// Domain types shared between the frontend and backend.

export type FileType = 'pdf' | 'doc' | 'ppt' | 'image' | 'code' | 'other';

export interface User {
  id: string;
  username: string;
  nickname: string;
  /** An image URL, or a color hex like '#38bdf8' meaning "render initials on this color". */
  avatarUrl: string;
  bio: string;
  createdAt: string;
  repoCount: number;
  fileCount: number;
  groupCount: number;
  totalDownloads: number;
  totalBytes: number;
  isAdmin?: boolean;
  isSuspended?: boolean;
  /** Only populated by admin endpoints — never exposed on public user objects. */
  email?: string;
}

/** A user-owned repository of study files (GitHub-style). */
export interface Repository {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  owner: User;
  categoryId: string;
  categoryName: string;
  tags: string[];
  fileCount: number;
  totalBytes: number;
  downloadCount: number;
  viewCount: number;
  commentCount: number;
  favoriteCount: number;
  groupIds: string[];
  groupNames: string[];
  createdAt: string;
  isFavorite?: boolean;
  isOwner?: boolean;
}

/** A single file inside a repository. */
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
  /** Current user's membership-request status, when they asked to join. */
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

/** One recorded sign-in attempt, shown on the user's "login history" screen. */
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
}

export type ReportTarget = 'repo' | 'comment';

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  createdAt: string;
  status: 'open' | 'resolved';
}

/** A report enriched for the admin console (reporter + resolved target info). */
export interface AdminReportItem extends Report {
  reporter: User;
  targetName: string;
  targetRepoId: string | null;
}

export const REPORT_REASONS = [
  { id: 'harassment', label: 'Harassment or abuse' },
  { id: 'copyright', label: 'Copyright violation' },
  { id: 'plagiarism', label: 'Plagiarism' },
  { id: 'spam', label: 'Spam or misleading' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'other', label: 'Other' },
] as const;

export interface Category {
  id: string;
  name: string;
}

export const CATEGORIES: Category[] = [
  { id: 'math', name: 'Mathematics' },
  { id: 'physics', name: 'Physics' },
  { id: 'chemistry', name: 'Chemistry' },
  { id: 'biology', name: 'Biology' },
  { id: 'economics', name: 'Economics' },
  { id: 'cs', name: 'Computer Science' },
  { id: 'language', name: 'Languages' },
  { id: 'history', name: 'History' },
  { id: 'art', name: 'Arts & Humanities' },
  { id: 'exam', name: 'Exam Prep' },
  { id: 'other', name: 'Other' },
];

export function categoryName(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? 'Other';
}

export type GroupSort = 'members' | 'repos' | 'recent';
export type RepoSort = 'recent' | 'popular' | 'views';

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
}

export interface HomeData {
  stats: HomeStats;
  hotRepos: Repository[];
  activeGroups: Group[];
  recentRepos: Repository[];
  topContributors: LeaderboardEntry[];
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

/** 43 bytes -> "43 B"; 1_500_000 -> "1.4 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
