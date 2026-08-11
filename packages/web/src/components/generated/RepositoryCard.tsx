import { Link } from 'react-router-dom';
import { FaBook, FaComment, FaDownload, FaEye, FaFolder, FaHeart } from 'react-icons/fa';
import { formatBytes, type Repository } from '@sciehub/shared';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from './UserAvatar';
import { cn, formatNumber, timeAgo } from '@/lib/utils';

interface RepositoryCardProps {
  repo: Repository;
  index?: number;
  showGroups?: boolean;
}

export function RepositoryCard({ repo, index = 0, showGroups = true }: RepositoryCardProps) {
  return (
    <div
      className={cn(
        'card-hover group animate-fade-in-up flex flex-col rounded-lg border border-border bg-surface p-5 hover:border-accent',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
          <FaFolder className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Link to={`/repos/${repo.id}`}>
            <h3 className="line-clamp-1 font-semibold transition-colors group-hover:text-accent">{repo.name}</h3>
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{repo.description || 'No description provided.'}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Link to={`/users/${repo.owner.username}`} className="font-medium hover:text-accent">
          {repo.owner.nickname}
        </Link>
        {showGroups &&
          repo.groupNames.slice(0, 2).map((g) => (
            <span key={g} className="rounded-full bg-surface-2 px-2 py-0.5">
              {g}
            </span>
          ))}
        <span className="ml-auto">{timeAgo(repo.createdAt)}</span>
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
        <span title="Files" className="flex items-center gap-1">
          <FaBook className="h-3 w-3" /> {repo.fileCount}
        </span>
        <span title="Total size">{formatBytes(repo.totalBytes)}</span>
        <span title="Downloads" className="flex items-center gap-1">
          <FaDownload className="h-3 w-3" /> {formatNumber(repo.downloadCount)}
        </span>
        <span title="Views" className="flex items-center gap-1">
          <FaEye className="h-3 w-3" /> {formatNumber(repo.viewCount)}
        </span>
        <span title="Comments" className="flex items-center gap-1">
          <FaComment className="h-3 w-3" /> {formatNumber(repo.commentCount)}
        </span>
        <span title="Favorites" className="flex items-center gap-1">
          <FaHeart className="h-3 w-3" /> {formatNumber(repo.favoriteCount)}
        </span>
      </div>

      {repo.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {repo.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary">
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <UserAvatar
          nickname={repo.owner.nickname}
          username={repo.owner.username}
          avatarUrl={repo.owner.avatarUrl}
          size="sm"
        />
        <span className="text-xs text-muted-foreground">
          {repo.owner.nickname} · {repo.categoryName}
        </span>
      </div>
    </div>
  );
}
