import { Link } from 'react-router-dom';
import { FaFolder, FaUsers } from 'react-icons/fa';
import type { Group } from '@sciehub/shared';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from './UserAvatar';
import { cn, formatNumber, timeAgo } from '@/lib/utils';

interface GroupCardProps {
  group: Group;
  index?: number;
}

export function GroupCard({ group, index = 0 }: GroupCardProps) {
  return (
    <div
      className={cn(
        'card-hover group animate-fade-in-up flex flex-col rounded-lg border border-border bg-surface p-5 hover:border-accent',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/groups/${group.id}`} className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
            <FaUsers className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-1 font-semibold transition-colors group-hover:text-accent">{group.name}</h3>
            <span className="text-xs text-muted-foreground">{group.categoryName}</span>
          </div>
        </Link>
        {group.isMember && <Badge variant="success">Joined</Badge>}
      </div>

      <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted-foreground">{group.description}</p>

      <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <FaUsers className="h-3 w-3" /> {formatNumber(group.memberCount)} members
        </span>
        <span className="flex items-center gap-1">
          <FaFolder className="h-3 w-3" /> {formatNumber(group.resourceCount)} resources
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <UserAvatar
          nickname={group.creator.nickname}
          username={group.creator.username}
          avatarUrl={group.creator.avatarUrl}
          size="sm"
        />
        <Link to={`/users/${group.creator.username}`} className="text-xs font-medium hover:text-accent">
          {group.creator.nickname}
        </Link>
        <span className="ml-auto text-xs text-muted-foreground">{timeAgo(group.createdAt)}</span>
      </div>
    </div>
  );
}
