import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FaArrowRight,
  FaBookOpen,
  FaComments,
  FaDownload,
  FaFire,
  FaImage,
  FaLayerGroup,
  FaSearch,
  FaShieldAlt,
  FaUsers,
} from 'react-icons/fa';
import { formatBytes, type HomeData } from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RepositoryCard } from '@/components/generated/RepositoryCard';
import { GroupCard } from '@/components/generated/GroupCard';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { formatNumber } from '@/lib/utils';

const FEATURES = [
  {
    Icon: FaDownload,
    title: 'Everything is free',
    description: 'Notes, practice and past papers download directly. No checkout, no paywall.',
  },
  {
    Icon: FaLayerGroup,
    title: 'Built for your syllabus',
    description: 'Filter by IGCSE, AS, A Level, IB or AP — then narrow down to subject and type.',
  },
  {
    Icon: FaComments,
    title: 'A study community',
    description: 'Ask in The Commons, share campus moments in the Plaza, or join a subject group.',
  },
  {
    Icon: FaShieldAlt,
    title: 'Shared responsibly',
    description:
      'Publish only your own work. If your notes were uploaded without permission, contact the admin for removal.',
  },
];

function RepoGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="panel space-y-4 p-5">
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          <div className="flex gap-4 border-t border-border/60 pt-3">
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
    <div className="space-y-3 panel p-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/60 px-4 py-3">
      <div className="font-display text-2xl tabular-nums text-foreground">{formatNumber(value)}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['home'],
    queryFn: () => api<HomeData>('/home'),
  });

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(search.trim() ? `/library?q=${encodeURIComponent(search.trim())}` : '/library');
  };

  return (
    <div>
      <PageMeta
        title="Free notes first — a student-built study library"
        description="SCIEHub is a free study library and social space for IGCSE, AS/A Level, IB and AP. Download notes and past papers, join The Commons and post on the Plaza."
      />

      <section className="relative overflow-hidden border-b border-border/70">
        <div className="pointer-events-none absolute inset-0 grid-fade opacity-70" aria-hidden />
        <div className="section-shell relative py-16 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="animate-fade-in-up">
              <Badge className="mb-5 border-accent/25 bg-accent-subtle px-3 py-1 text-accent">
                <FaBookOpen className="mr-1.5 h-3 w-3" aria-hidden />
                Free study library + campus community
              </Badge>
              <h1 className="font-display text-4xl leading-[1.03] tracking-tight sm:text-6xl lg:text-[4.4rem]">
                Free notes first.
                <br />
                <span className="italic text-accent">Built by students.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Download free notes, practice sets and past papers across IGCSE, AS/A Level, IB and
                AP. Then talk study in The Commons or post campus life on the Plaza.
              </p>

              <form onSubmit={onSearch} className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <FaSearch
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search IG Physics notes, A Level past papers…"
                    className="h-12 rounded-full bg-surface pl-11 pr-4 text-[15px] shadow-soft"
                    aria-label="Search study resources"
                  />
                </div>
                <Button type="submit" size="lg" className="shrink-0">
                  Search library <FaArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { label: 'Resource library', to: '/library' },
                  { label: 'Past papers', to: '/library?resourceType=past-paper' },
                  { label: 'IG Math', to: '/library?level=ig&category=math' },
                  { label: 'The Commons', to: '/community' },
                  { label: 'Plaza', to: '/plaza' },
                ].map((chip) => (
                  <Link
                    key={chip.label}
                    to={chip.to}
                    className="rounded-full border border-border/70 bg-surface/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    {chip.label}
                  </Link>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <FaDownload className="h-3.5 w-3.5 text-success" /> Free downloads, no checkout
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FaShieldAlt className="h-3.5 w-3.5 text-accent" /> Admin-moderated
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FaImage className="h-3.5 w-3.5 text-warning" /> Photo posts on the Plaza
                </span>
              </div>
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
              <div className="panel relative overflow-hidden p-5 sm:p-6">
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl"
                  aria-hidden
                />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Live on SCIEHub</p>
                    <p className="mt-1 font-display text-2xl">A free study shelf</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-subtle px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Open
                  </span>
                </div>
                <div className="relative mt-5 grid grid-cols-2 gap-2.5">
                  <Stat label="Resources" value={data?.stats.repos ?? 0} />
                  <Stat label="Files" value={data?.stats.files ?? 0} />
                  <Stat label="Students" value={data?.stats.users ?? 0} />
                  <Stat label="Study groups" value={data?.stats.groups ?? 0} />
                </div>
                <div className="relative mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" asChild>
                    <Link to="/community">
                      <FaComments className="h-3.5 w-3.5" /> The Commons
                    </Link>
                  </Button>
                  <Button variant="secondary" size="sm" asChild>
                    <Link to="/plaza">
                      <FaImage className="h-3.5 w-3.5" /> Plaza
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Library + social cards */}
      <section className="section-shell py-12 sm:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Two places to be</p>
            <h2 className="mt-1 font-display text-3xl sm:text-4xl">Library and community</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Study resources live in the library. Questions, campus life and photos live in the
            community.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Link
            to="/library"
            className="card-hover group relative overflow-hidden rounded-2xl border border-success/25 bg-success-subtle p-6 sm:p-8"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success">
              <FaDownload className="h-5 w-5" />
            </span>
            <h3 className="relative mt-6 font-display text-3xl">Resource library</h3>
            <p className="relative mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Notes, practice and past papers, classified by level, subject and type. Everything is
              free to download.
            </p>
            <span className="link-arrow relative mt-5">
              Browse library <FaArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          <Link
            to="/plaza"
            className="card-hover group relative overflow-hidden rounded-2xl border border-accent/25 bg-accent-subtle p-6 sm:p-8"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <FaImage className="h-5 w-5" />
            </span>
            <h3 className="relative mt-6 font-display text-3xl">The Plaza</h3>
            <p className="relative mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              A campus wall for photos and updates, with likes and comments. Post by username or
              anonymously.
            </p>
            <span className="link-arrow relative mt-5">
              Open the Plaza <FaArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </section>

      {/* Free shelf */}
      <section className="border-y border-border/70 bg-surface/35">
        <div className="section-shell py-12 sm:py-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">The main shelf</p>
              <h2 className="mt-1 font-display text-3xl">Free for everyone</h2>
            </div>
            <Link to="/library" className="link-arrow">
              Browse all <FaArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {isLoading || !data ? (
            <RepoGridSkeleton />
          ) : data.freeRepos.length === 0 ? (
            <EmptyPanel text="No resources yet — share the first one." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.freeRepos.slice(0, 6).map((repo, i) => (
                <RepositoryCard key={repo.id} repo={repo} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trending */}
      <section className="section-shell py-12 sm:py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Most read this week</p>
            <h2 className="mt-1 flex items-center gap-2 font-display text-3xl">
              <FaFire className="h-5 w-5 text-warning" aria-hidden />
              Trending resources
            </h2>
          </div>
          <Link to="/library?sort=popular" className="link-arrow">
            View all <FaArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {isLoading || !data ? (
          <RepoGridSkeleton />
        ) : data.hotRepos.length === 0 ? (
          <EmptyPanel text="Nothing trending yet — publish the first resource." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.hotRepos.slice(0, 6).map((repo, i) => (
              <RepositoryCard key={repo.id} repo={repo} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Community */}
      <section className="border-y border-border/70 bg-surface/35">
        <div className="section-shell grid gap-10 py-12 sm:py-16 lg:grid-cols-2">
          <div>
            <div className="mb-6 flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Community</p>
                <h2 className="mt-1 flex items-center gap-2 font-display text-3xl">
                  <FaUsers className="h-5 w-5 text-accent" aria-hidden />
                  Top sharers
                </h2>
              </div>
              <Link to="/leaderboard" className="link-arrow">
                Full board <FaArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {isLoading || !data ? (
              <ContributorsSkeleton />
            ) : data.topContributors.length === 0 ? (
              <EmptyPanel text="No contributions yet — be the first to share." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.topContributors.slice(0, 4).map((entry, i) => (
                  <div key={entry.user.id} className="panel flex items-center gap-3 p-4">
                    <span className="w-4 text-center font-display text-lg text-muted-foreground">
                      {i + 1}
                    </span>
                    <UserAvatar
                      nickname={entry.user.nickname}
                      username={entry.user.username}
                      avatarUrl={entry.user.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/users/${entry.user.username}`}
                        className="block truncate text-sm font-semibold hover:text-accent"
                      >
                        {entry.user.nickname}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">
                        {entry.fileCount} files · {formatBytes(entry.totalBytes)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-6 flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Study together</p>
                <h2 className="mt-1 flex items-center gap-2 font-display text-3xl">
                  <FaUsers className="h-5 w-5 text-accent" aria-hidden />
                  Active groups
                </h2>
              </div>
              <Link to="/groups" className="link-arrow">
                View all <FaArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {isLoading || !data ? (
              <RepoGridSkeleton />
            ) : data.activeGroups.length === 0 ? (
              <EmptyPanel text="No groups yet — create one for your subject." />
            ) : (
              <div className="space-y-3">
                {data.activeGroups.slice(0, 3).map((group, i) => (
                  <GroupCard key={group.id} group={group} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section-shell py-14 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Why SCIEHub</p>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl">
            A study space that stays free
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            No marketplace, no checkout, no paid tiers. Just resources, questions and campus life.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ Icon, title, description }, i) => (
            <div
              key={title}
              className="animate-fade-in-up rounded-2xl border border-border/70 bg-surface/60 p-6 transition-colors hover:border-accent/35"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section-shell pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-surface px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-0 grid-fade opacity-60" aria-hidden />
          <div className="relative mx-auto max-w-2xl">
            <p className="eyebrow">Give something back</p>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl">
              Share your notes. Join the conversation.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              Publish under your username or anonymously. Everything you share stays free for the
              next student.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/upload">
                  <FaBookOpen className="h-4 w-4" />
                  Publish a resource
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/plaza">Open the Plaza</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="panel-muted px-6 py-14 text-center text-sm text-muted-foreground">{text}</div>
  );
}
