import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FaArrowRight,
  FaCartPlus,
  FaCoins,
  FaDollarSign,
  FaDownload,
  FaFire,
  FaSearch,
  FaShieldAlt,
  FaStar,
  FaTrophy,
  FaUsers,
  FaWallet,
} from 'react-icons/fa';
import { formatBytes, formatPrice, PLATFORM_FEE_RATE, type HomeData } from '@sciehub/shared';
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
    Icon: FaCartPlus,
    title: 'Buy premium resources',
    description:
      'Pay once, keep forever. Hand-picked study notes, past papers, and guides — all from trusted sellers in the community.',
  },
  {
    Icon: FaCoins,
    title: 'Sell & earn rewards',
    description:
      `Set a fair price, publish your work, and get paid. Platform fee is only ${Math.round(
        PLATFORM_FEE_RATE * 100,
      )}% — you keep the rest.`,
  },
  {
    Icon: FaDownload,
    title: 'Free resources, always',
    description:
      'Millions of free notes and materials shared by students. No paywalls, no sign-up tricks — just knowledge.',
  },
  {
    Icon: FaUsers,
    title: 'Study groups',
    description: 'Join subject communities, request membership, and discover repositories shared by members.',
  },
  {
    Icon: FaSearch,
    title: 'Smart search & filters',
    description:
      'Search across repos and groups, then filter by price range, ratings, and category to find exactly what you need.',
  },
  {
    Icon: FaShieldAlt,
    title: 'Buyer protection',
    description:
      'Verified sellers, purchase history, honest reviews, and a fair refund policy when the content is misrepresented.',
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
        title="Discover · Buy · Sell Top Study Resources"
        description="SCIEHub Marketplace — buy premium study notes, sell your own work, and share free materials with the international high school community."
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(56_189_248_/_0.14),transparent_60%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-4 py-18 text-center sm:px-6 sm:py-24 lg:px-8">
          <Badge className="animate-fade-in-up mb-6 border-accent/30 bg-accent/10 text-accent">
            <FaCoins className="mr-1 h-3 w-3" aria-hidden />
            SCIEHub Marketplace — share free or sell your work
          </Badge>
          <h1
            className="animate-fade-in-up mx-auto max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            Discover · Buy · Sell
            <br />
            <span className="bg-gradient-to-r from-accent via-sky-400 to-success bg-clip-text text-transparent">
              Top Study Resources.
            </span>
          </h1>
          <p
            className="animate-fade-in-up mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
            style={{ animationDelay: '160ms' }}
          >
            Find the exact notes, past papers and guides you need — for free or at a fair price.
            Publish your own work and earn from every sale.
          </p>
          <div
            className="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: '240ms' }}
          >
            <Button size="lg" asChild>
              <Link to="/marketplace">
                Browse marketplace <FaArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/upload">
                <FaDollarSign className="h-4 w-4" />
                Upload & Sell
              </Link>
            </Button>
          </div>

          {data && (
            <div
              className="animate-fade-in-up mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6"
              style={{ animationDelay: '320ms' }}
            >
              {[
                { label: 'Resources', value: data.stats.repos, accent: true },
                { label: 'Files', value: data.stats.files },
                { label: 'Free repos', value: data.stats.freeRepos },
                { label: 'Students', value: data.stats.users },
                { label: 'Sales', value: data.stats.totalSales },
                { label: 'Paid out', value: data.stats.totalRevenue, money: true },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border bg-surface px-4 py-3 text-left"
                >
                  <div
                    className={`text-xl font-bold sm:text-2xl ${
                      stat.accent ? 'text-accent' : 'text-foreground'
                    } tabular-nums`}
                  >
                    {stat.money ? `¥${formatNumber(stat.value)}` : formatNumber(stat.value)}
                  </div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Top sellers + free resources row */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          {/* Trending / Hot */}
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaFire className="h-5 w-5 text-warning" aria-hidden />
                <h2 className="text-xl font-bold sm:text-2xl">Trending now</h2>
              </div>
              <Link to="/marketplace" className="text-sm font-medium text-accent hover:underline">
                View all →
              </Link>
            </div>
            {isLoading || !data ? (
              <RepoGridSkeleton />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {data.hotRepos.slice(0, 4).map((repo, i) => (
                  <RepositoryCard key={repo.id} repo={repo} index={i} showGroups={false} />
                ))}
              </div>
            )}
          </div>

          {/* Top sellers */}
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaTrophy className="h-5 w-5 text-warning" aria-hidden />
                <h2 className="text-xl font-bold sm:text-2xl">Top sellers</h2>
              </div>
              <Link to="/leaderboard?type=sales" className="text-sm font-medium text-accent hover:underline">
                Full ranking →
              </Link>
            </div>
            {isLoading || !data ? (
              <ContributorsSkeleton />
            ) : (data.topSellers ?? []).length === 0 ? (
              <p className="rounded-lg border border-border bg-surface py-12 text-center text-sm text-muted-foreground">
                No sales yet — be the first seller!
              </p>
            ) : (
              <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
                {(data.topSellers ?? []).slice(0, 5).map((entry, i) => (
                  <Link
                    key={entry.user.id}
                    to={`/users/${entry.user.username}`}
                    className="animate-fade-in-up flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-2"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span className="w-6 text-center text-xs font-bold text-muted-foreground">
                      #{i + 1}
                    </span>
                    <UserAvatar
                      nickname={entry.user.nickname}
                      username={entry.user.username}
                      avatarUrl={entry.user.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{entry.user.nickname}</div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 text-success">
                          <FaWallet className="h-3 w-3" />
                          {(entry.totalRevenue ?? 0) > 0
                            ? formatPrice(entry.totalRevenue!, 'CNY').replace('CN¥', '¥')
                            : 'earnings'}
                        </span>
                        <span>·</span>
                        <span>{formatNumber(entry.totalSales ?? 0)} sales</span>
                      </div>
                    </div>
                    {(entry.averageRating ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-xs text-warning">
                        <FaStar className="h-3 w-3 fill-warning/80" />
                        <span className="font-semibold tabular-nums">
                          {Number(entry.averageRating).toFixed(1)}
                        </span>
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Free resources */}
      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaDownload className="h-5 w-5 text-success" aria-hidden />
              <h2 className="text-xl font-bold sm:text-2xl">Free for everyone</h2>
              <Badge variant="outline" className="ml-1 border-success/40 text-success">
                No purchase needed
              </Badge>
            </div>
            <Link
              to="/free"
              className="text-sm font-medium text-accent hover:underline"
            >
              Browse all free →
            </Link>
          </div>
          {isLoading || !data ? (
            <RepoGridSkeleton />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(data.freeRepos ?? []).map((repo, i) => (
                <RepositoryCard key={repo.id} repo={repo} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Top contributors */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaUsers className="h-5 w-5 text-accent" aria-hidden />
            <h2 className="text-xl font-bold sm:text-2xl">Top sharers</h2>
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
              <div
                key={entry.user.id}
                className="animate-fade-in-up rounded-lg border border-border bg-surface p-5 text-center"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="text-xs font-semibold text-muted-foreground">#{i + 1}</div>
                <div className="mt-2 flex justify-center">
                  <UserAvatar
                    nickname={entry.user.nickname}
                    username={entry.user.username}
                    avatarUrl={entry.user.avatarUrl}
                    size="lg"
                  />
                </div>
                <Link
                  to={`/users/${entry.user.username}`}
                  className="mt-2 block truncate text-sm font-semibold hover:text-accent"
                >
                  {entry.user.nickname}
                </Link>
                <div className="mt-1 text-sm font-bold text-accent">{entry.fileCount} files</div>
                <div className="text-xs text-muted-foreground">{formatBytes(entry.totalBytes)} shared</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active groups */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
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
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center text-xl font-bold sm:text-2xl">
          A marketplace built for students, by students
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(56_189_248_/_0.14),transparent_65%)]"
            aria-hidden
          />
          <div className="relative">
            <h2 className="text-2xl font-bold sm:text-3xl">Ready to sell what you know?</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Publish a resource today, set your own price, and start earning from every download.
              Your notes could help thousands of students — and pay for your next semester.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/upload">
                  <FaDollarSign className="h-4 w-4" />
                  Start selling
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/marketplace">Browse marketplace</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
