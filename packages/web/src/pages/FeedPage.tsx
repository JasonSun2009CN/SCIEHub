import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FaBook, FaSearch, FaSpinner, FaUsers } from 'react-icons/fa';
import { CATEGORIES, type Group, type HomeData, type Repository, type RepoListResult } from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RepositoryCard } from '@/components/generated/RepositoryCard';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/utils';

const PAGE_SIZE = 12;

const HOT_TAGS = ['ib', 'alevel', 'igcse', 'ap', 'math', 'physics', 'chemistry', 'economics', 'python', 'exam'];

function SidebarBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function FeedPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const sort = searchParams.get('sort') ?? 'recent';
  const paramsKey = JSON.stringify({ q, category, sort });

  const [searchInput, setSearchInput] = useState(q);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<Repository[]>([]);

  const currentKey = useRef(paramsKey);
  useEffect(() => {
    currentKey.current = paramsKey;
  }, [paramsKey]);

  const { data, isLoading } = useQuery({
    queryKey: ['repos', paramsKey, offset],
    queryFn: () =>
      api<RepoListResult>(
        `/repos?search=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&sort=${encodeURIComponent(sort)}&limit=${PAGE_SIZE}&offset=${offset}`,
      ),
  });

  useEffect(() => {
    if (paramsKey !== currentKey.current) return; // stale response from a previous filter
    if (offset === 0) setItems(data?.items ?? []);
    else setItems((prev) => [...prev, ...(data?.items ?? [])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, offset, paramsKey]);

  const total = data?.total ?? 0;
  const hasMore = items.length < total;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setParam('q', searchInput.trim());
  };

  const { data: myGroups } = useQuery({
    queryKey: ['myGroups', user?.username],
    queryFn: () => api<{ items: Group[] }>(`/users/${user!.username}/groups`),
    enabled: Boolean(user),
  });

  const { data: home } = useQuery({
    queryKey: ['home'],
    queryFn: () => api<HomeData>('/home'),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageMeta title="Feed" description="Browse and search shared study repositories on SCIEHub." />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left sidebar */}
        <aside className="hidden space-y-6 lg:col-span-2 lg:block">
          <SidebarBlock title="My groups">
            {user ? (
              <ul className="space-y-1">
                {(myGroups?.items ?? []).slice(0, 6).map((group) => (
                  <li key={group.id}>
                    <Link
                      to={`/groups/${group.id}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      <FaUsers className="h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="truncate">{group.name}</span>
                    </Link>
                  </li>
                ))}
                {(myGroups?.items?.length ?? 0) === 0 && (
                  <p className="px-2 text-xs text-muted-foreground">
                    You haven't joined any groups yet.{' '}
                    <Link to="/groups" className="text-accent hover:underline">Browse groups</Link>
                  </p>
                )}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                <Link to="/auth" className="text-accent hover:underline">Sign in</Link> to see your groups.
              </p>
            )}
          </SidebarBlock>

          <SidebarBlock title="Popular tags">
            <div className="flex flex-wrap gap-1.5">
              {HOT_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setParam('q', tag)}
                  className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                    q === tag ? 'bg-accent-subtle text-accent' : 'bg-surface-2 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </SidebarBlock>
        </aside>

        {/* Main column */}
        <div className="lg:col-span-7">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <form onSubmit={onSearch} className="relative min-w-0 flex-1">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search repositories…"
                className="pl-9"
                aria-label="Search repositories"
              />
            </form>
            <Select value={category} onValueChange={(v) => setParam('category', v === 'all' ? '' : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setParam('sort', v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="popular">Most downloaded</SelectItem>
                <SelectItem value="views">Most viewed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {isLoading && offset === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3 rounded-lg border border-border bg-surface p-5">
                  <div className="flex gap-3">
                    <Skeleton className="h-8 w-8" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                  <div className="flex gap-4 border-t border-border pt-3">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface py-16 text-center">
                <FaBook className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-medium">No repositories found</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a different search term or be the first to share one.</p>
              </div>
            ) : (
              items.map((repo, i) => (
                <RepositoryCard key={repo.id} repo={repo} index={i} />
              ))
            )}
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => setOffset((o) => o + PAGE_SIZE)} disabled={isLoading}>
                {isLoading ? <FaSpinner className="h-4 w-4 animate-spin" /> : null}
                Load more
              </Button>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="hidden lg:col-span-3 lg:block">
          <SidebarBlock title="Recently shared">
            <ul className="space-y-3">
              {(home?.recentRepos ?? []).slice(0, 7).map((r) => (
                <li key={r.id}>
                  <Link to={`/repos/${r.id}`} className="group flex items-start gap-2.5">
                    <FaBook className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="min-w-0">
                      <span className="line-clamp-1 block text-sm group-hover:text-accent">{r.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.owner.nickname} · {timeAgo(r.createdAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {(home?.recentRepos?.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground">Nothing shared yet.</p>
              )}
            </ul>
          </SidebarBlock>

          {q && (
            <div className="mt-6 rounded-lg border border-accent bg-accent-subtle p-4 text-sm">
              <span className="font-medium">Showing results for “{q}”</span>
              <button onClick={() => setParam('q', '')} className="mt-1 block cursor-pointer text-accent hover:underline">
                Clear search
              </button>
            </div>
          )}

          <div className="mt-6">
            <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted-foreground">
              {total} repository{total === 1 ? '' : 'ies'}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
