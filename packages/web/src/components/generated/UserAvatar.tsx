import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@sciehub/shared';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
} as const;

interface UserAvatarProps {
  nickname: string;
  username: string;
  avatarUrl?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export function UserAvatar({ nickname, username, avatarUrl, size = 'md', className }: UserAvatarProps) {
  const isColor = avatarUrl?.startsWith('#');
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {avatarUrl && !isColor && <AvatarImage src={avatarUrl} alt={nickname} />}
      <AvatarFallback
        className="font-semibold"
        style={
          isColor && avatarUrl
            ? { backgroundColor: avatarUrl, color: '#0c1014' }
            : undefined
        }
      >
        {initials(nickname || username)}
      </AvatarFallback>
    </Avatar>
  );
}
