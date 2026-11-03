import { Link } from 'react-router-dom';
import {
  FaBook,
  FaComment,
  FaDownload,
  FaEye,
  FaFolder,
  FaHeart,
  FaStar,
  FaTag,
  FaUserSecret,
} from 'react-icons/fa';
import { classificationLabel, formatBytes, type Repository } from '@sciehub/shared';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from './UserAvatar';
import { cn, formatNumber, timeAgo } from '@/lib/utils';

interface RepositoryCardProps {
  repo: Repository;
  index?: number;
  showGroups?: boolean;
}

function FreeBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-subtle px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-success">
      <FaTag className="h-2.5 w-2.5" />
      Free
    </span>
  );
}

function RatingRow({ repo }: { repo: Repository }) {
  if ((repo.reviewCount ?? 0) === 0) return null;
  const rating = Number(repo.averageRating ?? 0);
  return (
    <span className="flex items-center gap-1 text-xs text-warning">
      <FaStar className="h-3 w-3 fill-warning/90" />
      <span className="font-semibold tabular-nums">{rating.toFixed(1)}</span>
      <span className="text-muted-foreground">({repo.reviewCount})</span>
    </span>
  );
}

export function RepositoryCard({ repo, index = 0, showGroups = true }: RepositoryCardProps) {
  return (
    <article
      className={cn(
        'card-hover group relative flex animate-fade-in-up flex-col rounded-2xl border border-border/75 bg-surface/75 p-5 shadow-soft',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {repo.previewImageUrl && (
        <Link
          to={`/repos/${repo.id}`}
          className="mb-4 -mx-1 -mt-1 block aspect-[16/7] overflow-hidden rounded-xl bg-surface-2"
          aria-hidden
        >
          <img
            src={repo.previewImageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </Link>
      )}

      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
          <FaFolder className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/repos/${repo.id}`} className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight transition-colors group-hover:text-accent">
                {repo.name}
              </h3>
            </Link>
            <FreeBadge />
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {repo.description || 'No description provided.'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="outline">{repo.levelName}</Badge>
        <Badge variant="secondary">{repo.resourceTypeName}</Badge>
        {repo.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="secondary">
            #{tag}
          </Badge>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {repo.isAnonymous ? (
          <span className="inline-flex items-center gap-1 font-medium">
            <FaUserSecret className="h-3 w-3 text-accent" /> Anonymous
          </span>
        ) : (
          <Link to={`/users/${repo.owner.username}`} className="font-medium hover:text-accent">
            {repo.owner.nickname}
          </Link>
        )}
        {showGroups &&
          repo.groupNames.slice(0, 1).map((group) => (
            <span key={group} className="rounded-full bg-surface-2 px-2 py-0.5">
              {group}
            </span>
          ))}
        <RatingRow repo={repo} />
        <span className="ml-auto">{timeAgo(repo.createdAt)}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
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

      <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
        <UserAvatar
          nickname={repo.owner.nickname}
          username={repo.owner.username}
          avatarUrl={repo.owner.avatarUrl}
          size="sm"
        />
        <span className="truncate text-xs text-muted-foreground">
          {repo.isAnonymous
            ? `Anonymous · ${classificationLabel(repo.levelId, repo.categoryId, repo.resourceType)}`
            : classificationLabel(repo.levelId, repo.categoryId, repo.resourceType)}
        </span>
      </div>
    </article>
  );
}
