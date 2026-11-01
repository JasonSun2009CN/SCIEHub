import { Link } from 'react-router-dom';
import {
  FaBook,
  FaCheck,
  FaComment,
  FaDownload,
  FaEye,
  FaFolder,
  FaHeart,
  FaStar,
  FaTag,
} from 'react-icons/fa';
import { classificationLabel, formatBytes, formatPrice, type Repository } from '@sciehub/shared';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from './UserAvatar';
import { cn, formatNumber, timeAgo } from '@/lib/utils';

interface RepositoryCardProps {
  repo: Repository;
  index?: number;
  showGroups?: boolean;
}

function PriceBadge({ repo }: { repo: Repository }) {
  if (repo.pricingType === 'free') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
        <FaTag className="h-2.5 w-2.5" />
        FREE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">
      <FaTag className="h-2.5 w-2.5" />
      {formatPrice(repo.price, repo.currency)}
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
    <div
      className={cn(
        'card-hover group relative animate-fade-in-up flex flex-col rounded-lg border border-border bg-surface p-5 hover:border-accent',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Purchased check mark */}
      {repo.isPurchased && (
        <span
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success shadow-sm"
          title="You already own this resource"
        >
          <FaCheck className="h-2.5 w-2.5" />
          Purchased
        </span>
      )}

      {/* Preview image banner */}
      {repo.previewImageUrl && (
        <Link
          to={`/repos/${repo.id}`}
          className="mb-4 -mx-2 -mt-2 block aspect-[16/7] overflow-hidden rounded-md bg-surface-2"
          aria-hidden
        >
          <img
            src={repo.previewImageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>
      )}

      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
          <FaFolder className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <Link to={`/repos/${repo.id}`} className="min-w-0 flex-1">
              <h3 className="line-clamp-1 font-semibold transition-colors group-hover:text-accent">
                {repo.name}
              </h3>
            </Link>
            <PriceBadge repo={repo} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {repo.description || 'No description provided.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline">{repo.levelName}</Badge>
            <Badge variant="secondary">{repo.resourceTypeName}</Badge>
          </div>
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
        <RatingRow repo={repo} />
        {(repo.totalSales ?? 0) > 0 && (
          <span className="ml-auto text-[11px] font-semibold text-accent/90">
            {repo.totalSales} sold
          </span>
        )}
        {!repo.totalSales && <span className="ml-auto">{timeAgo(repo.createdAt)}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
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
          {repo.owner.nickname} · {classificationLabel(repo.levelId, repo.categoryId, repo.resourceType)}
        </span>
      </div>
    </div>
  );
}
