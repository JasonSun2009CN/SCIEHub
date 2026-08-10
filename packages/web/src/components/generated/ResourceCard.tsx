import { Link } from 'react-router-dom';
import { FaComment, FaDownload, FaEye, FaHeart } from 'react-icons/fa';
import type { Resource } from '@sciehub/shared';
import { Badge } from '@/components/ui/badge';
import { FileTypeIcon } from './FileTypeIcon';
import { cn, formatNumber, timeAgo } from '@/lib/utils';

interface ResourceCardProps {
  resource: Resource;
  index?: number;
  showGroup?: boolean;
}

export function ResourceCard({ resource, index = 0, showGroup = true }: ResourceCardProps) {
  return (
    <div
      className={cn(
        'card-hover group animate-fade-in-up flex flex-col rounded-lg border border-border bg-surface p-5 hover:border-accent',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        <FileTypeIcon type={resource.fileType} className="mt-0.5 h-8 w-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <Link to={`/resources/${resource.id}`}>
            <h3 className="line-clamp-1 font-semibold transition-colors group-hover:text-accent">
              {resource.title}
            </h3>
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{resource.description}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Link to={`/users/${resource.uploader.username}`} className="font-medium hover:text-accent">
          {resource.uploader.nickname}
        </Link>
        {showGroup && resource.groupId && (
          <Link to={`/groups/${resource.groupId}`} className="hover:text-accent">
            {resource.groupName}
          </Link>
        )}
        <span className="ml-auto">{timeAgo(resource.createdAt)}</span>
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
        <span title="Downloads" className="flex items-center gap-1">
          <FaDownload className="h-3 w-3" /> {formatNumber(resource.downloadCount)}
        </span>
        <span title="Views" className="flex items-center gap-1">
          <FaEye className="h-3 w-3" /> {formatNumber(resource.viewCount)}
        </span>
        <span title="Comments" className="flex items-center gap-1">
          <FaComment className="h-3 w-3" /> {formatNumber(resource.commentCount)}
        </span>
        <span title="Favorites" className="flex items-center gap-1">
          <FaHeart className="h-3 w-3" /> {formatNumber(resource.favoriteCount)}
        </span>
        <span className="ml-auto hidden text-muted-foreground sm:block">{resource.fileSize}</span>
      </div>

      {resource.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {resource.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="cursor-pointer hover:text-accent">
              #{tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
