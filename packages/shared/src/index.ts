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
  uploadCount: number;
  groupCount: number;
  totalDownloads: number;
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  fileType: FileType;
  fileSize: string;
  /** Server-relative path, e.g. /uploads/xxx.pdf */
  filePath: string;
  uploaderId: string;
  uploader: User;
  groupId: string;
  groupName: string;
  categoryId: string;
  categoryName: string;
  tags: string[];
  downloadCount: number;
  viewCount: number;
  commentCount: number;
  favoriteCount: number;
  createdAt: string;
  isFavorite?: boolean;
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
  resourceCount: number;
  createdAt: string;
  isMember?: boolean;
  isAdmin?: boolean;
}

export interface GroupMember {
  userId: string;
  user: User;
  role: 'admin' | 'member';
  joinedAt: string;
}

export interface Comment {
  id: string;
  resourceId: string;
  userId: string;
  user: User;
  content: string;
  createdAt: string;
}

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

export type GroupSort = 'members' | 'resources' | 'recent';
export type ResourceSort = 'recent' | 'popular' | 'views';

export interface ResourceListResult {
  items: Resource[];
  total: number;
}

export interface HomeStats {
  resources: number;
  groups: number;
  users: number;
  downloads: number;
}

export interface HomeData {
  stats: HomeStats;
  hotResources: Resource[];
  activeGroups: Group[];
  recentUploads: Resource[];
}

export interface SearchResult {
  resources: Resource[];
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
