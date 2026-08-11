import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FaArrowRight, FaFire, FaSearch, FaShareAlt, FaTrophy, FaUsers } from 'react-icons/fa';
import { formatBytes, type HomeData } from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RepositoryCard } from '@/components/generated/RepositoryCard';
import { GroupCard } from '@/components/generated/GroupCard';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { formatNumber } from '@/lib/utils';

const FEATURES = [
  {
    Icon: FaShareAlt,
    title: 'Share repositories',
    description: 'Build your own study repository — multiple files, one organised home — and share it with classmates.',
  },
  {
    Icon: FaUsers,
    title: 'Study groups',
    description: 'Join subject communities, request membership and discover repositories shared by members.',
  },
  {
    Icon: FaSearch,
    title: 'Smart search',
    description: 'Search across repositories, files and groups to find exactly the material you need, fast.',
  },
];

function RepoGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border bg-surface p-5">
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          <div className="flex gap-4 border-t border-border pt-3">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ContributorsSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['home'],
    queryFn: () => api<HomeData>('/home'),
  });

  return (
    <div>
      <PageMeta
        title="Home"
        description="SCIEHub — build study repositories, share materials, join subject groups and excel. For international high school students."
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(56_189_248_/_0.12),transparent_60%)]" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <Badge className="animate-fade-in-up mb-6">Built for international high school students</Badge>
          <h1 className="animate-fade-in-up mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl" style={{ animationDelay: '80ms' }}>
            Share, Collaborate,
            <span className="bg-gradient-to-r from-accent via-sky-400 to-success bg-clip-text text-transparent">
              {' '}Excel.
            </span>
          </h1>
          <p className="animate-fade-in-up mx-auto mt-6 max-w-xl text-lg text-muted-foreground" style={{ animationDelay: '160ms' }}>
            Create your own study repositories, upload multiple files, and share them with your subject groups.
          </p>
          <div className="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '240ms' }}>
            <Button size="lg" asChild>
              <Link to="/feed">
                Explore repositories <FaArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/upload">Create a repository</Link>
            </Button>
          </div>

          {data && (
            <div className="animate-fade-in-up mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-5" style={{ animationDelay: '320ms' }}>
              {[
                { label: 'Repositories', value: data.stats.repos },
                { label: 'Files', value: data.stats.files },
                { label: 'Study groups', value: data.stats.groups },
                { label: 'Students', value: data.stats.users },
                { label: 'Downloads', value: data.stats.downloads },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border bg-surface px-4 py-3">
                  <div className="text-xl font-bold text-accent sm:text-2xl">{formatNumber(stat.value)}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trending repos */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaFire className="h-5 w-5 text-warning" aria-hidden />
            <h2 className="text-xl font-bold sm:text-2xl">Trending repositories</h2>
          </div>
          <Link to="/feed" className="text-sm font-medium text-accent hover:underline">
            View all →
          </Link>
        </div>
        {isLoading || !data ? (
          <RepoGridSkeleton />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.hotRepos.map((repo, i) => (
              <RepositoryCard key={repo.id} repo={repo} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Top contributors */}
      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaTrophy className="h-5 w-5 text-warning" aria-hidden />
              <h2 className="text-xl font-bold sm:text-2xl">Top contributors</h2>
            </div>
            <Link to="/leaderboard" className="text-sm font-medium text-accent hover:underline">
              Full leaderboard →
            </Link>
          </div>
          {isLoading || !data ? (
            <ContributorsSkeleton />
          ) : data.topContributors.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface py-12 text-center text-sm text-muted-foreground">
              No contributions yet — be the first to share!
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {data.topContributors.map((entry, i) => (
                <div key={entry.user.id} className="animate-fade-in-up rounded-lg border border-border bg-surface p-5 text-center" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="text-xs font-semibold text-muted-foreground">#{i + 1}</div>
                  <div className="mt-2 flex justify-center">
                    <UserAvatar nickname={entry.user.nickname} username={entry.user.username} avatarUrl={entry.user.avatarUrl} size="lg" />
                  </div>
                  <Link to={`/users/${entry.user.username}`} className="mt-2 block truncate text-sm font-semibold hover:text-accent">
                    {entry.user.nickname}
                  </Link>
                  <div className="mt-1 text-sm font-bold text-accent">{entry.fileCount} files</div>
                  <div className="text-xs text-muted-foreground">{formatBytes(entry.totalBytes)} shared</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Active groups */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaUsers className="h-5 w-5 text-accent" aria-hidden />
            <h2 className="text-xl font-bold sm:text-2xl">Active study groups</h2>
          </div>
          <Link to="/groups" className="text-sm font-medium text-accent hover:underline">
            View all →
          </Link>
        </div>
        {isLoading || !data ? (
          <RepoGridSkeleton />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.activeGroups.map((group, i) => (
              <GroupCard key={group.id} group={group} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center text-xl font-bold sm:text-2xl">Everything you need to study smarter</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ Icon, title, description }, i) => (
            <div
              key={title}
              className="animate-fade-in-up rounded-lg border border-border bg-surface p-6"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-10 text-center sm:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(56_189_248_/_0.14),transparent_65%)]" aria-hidden />
          <div className="relative">
            <h2 className="text-2xl font-bold sm:text-3xl">Ready to share what you know?</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Create a repository, upload your notes, and share it with your study groups. Every contribution makes the community stronger.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/auth">Get started</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/upload">Create a repository</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
