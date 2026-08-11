import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FaBook, FaDownload, FaTrophy } from 'react-icons/fa';
import { formatBytes, type LeaderboardEntry } from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { cn, formatNumber } from '@/lib/utils';

const MEDALS = ['text-warning', 'text-muted-foreground', 'text-[#cd7f32]'];

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-8 w-8" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeaderboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api<{ items: LeaderboardEntry[] }>('/leaderboard'),
  });

  const entries = data?.items ?? [];
  const podium = entries.slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMeta title="Leaderboard" description="SCIEHub's top contributors — ranked by files shared and total size." />
      <div className="text-center">
        <FaTrophy className="mx-auto h-10 w-10 text-warning" />
        <h1 className="mt-3 text-2xl font-bold">Community leaderboard</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Celebrating the students who share the most — ranked by files shared, with total size shown alongside.
        </p>
      </div>

      {isLoading ? (
        <div className="mt-8">
          <SkeletonRows />
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-surface py-16 text-center text-sm text-muted-foreground">
          No contributions yet. Share your first repository to claim the top spot!
          <div className="mt-3">
            <Link to="/upload" className="text-accent hover:underline">Create a repository →</Link>
          </div>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {podium.map((entry, i) => (
              <div
                key={entry.user.id}
                className={cn(
                  'animate-fade-in-up rounded-lg border border-border bg-surface p-6 text-center',
                  i === 0 && 'border-warning bg-gradient-to-b from-warning/10 to-transparent',
                )}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className={cn('text-sm font-bold', MEDALS[i])}>#{i + 1}</div>
                <div className="mt-3 flex justify-center">
                  <UserAvatar nickname={entry.user.nickname} username={entry.user.username} avatarUrl={entry.user.avatarUrl} size="lg" />
                </div>
                <Link to={`/users/${entry.user.username}`} className="mt-2 block truncate font-semibold hover:text-accent">
                  {entry.user.nickname}
                </Link>
                <div className="mt-1 text-2xl font-bold text-accent">{entry.fileCount}</div>
                <div className="text-xs text-muted-foreground">files shared</div>
                <div className="mt-2 text-sm font-medium">{formatBytes(entry.totalBytes)}</div>
                <div className="text-xs text-muted-foreground">total size</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="mt-8 overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Contributor</th>
                  <th className="px-4 py-3 text-right">Files</th>
                  <th className="px-4 py-3 text-right">Total size</th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">Repositories</th>
                  <th className="hidden px-4 py-3 text-right md:table-cell">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry, i) => (
                  <tr key={entry.user.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3 font-bold text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar nickname={entry.user.nickname} username={entry.user.username} avatarUrl={entry.user.avatarUrl} size="sm" />
                        <Link to={`/users/${entry.user.username}`} className="font-medium hover:text-accent">
                          {entry.user.nickname}
                        </Link>
                        <span className="hidden text-xs text-muted-foreground sm:inline">@{entry.user.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-accent">{entry.fileCount}</td>
                    <td className="px-4 py-3 text-right">{formatBytes(entry.totalBytes)}</td>
                    <td className="hidden px-4 py-3 text-right sm:table-cell">{entry.repoCount}</td>
                    <td className="hidden px-4 py-3 text-right md:table-cell">
                      <span className="inline-flex items-center gap-1">
                        <FaDownload className="h-3 w-3" /> {formatNumber(entry.totalDownloads)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <FaBook className="h-3.5 w-3.5" /> Ranked by number of files shared; total size shown for reference.
          </p>
        </>
      )}
    </div>
  );
}
