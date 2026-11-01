import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FaBookOpen, FaSearch, FaSlidersH, FaSpinner, FaTimes } from 'react-icons/fa';
import {
  CATEGORIES,
  LEVELS,
  RESOURCE_TYPES,
  type MarketplaceZone,
  type Repository,
  type RepoListResult,
} from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RepositoryCard } from '@/components/generated/RepositoryCard';
import { cn, formatNumber } from '@/lib/utils';

const PAGE_SIZE = 12;

const ZONE_TABS: { zone: MarketplaceZone; to: string; label: string }[] = [
  { zone: 'free', to: '/free', label: 'Free' },
  { zone: 'all', to: '/marketplace', label: 'All resources' },
  { zone: 'paid', to: '/paid', label: 'Paid' },
];

export function FeedPage({ zone = 'all' }: { zone?: MarketplaceZone }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const level = searchParams.get('level') ?? '';
  const resourceType = searchParams.get('resourceType') ?? '';
  const sort = searchParams.get('sort') ?? 'recent';
  const lockedPricing = zone === 'free' || zone === 'paid' ? zone : '';
  const pricingType = lockedPricing || searchParams.get('pricingType') || '';
  const paramsKey = JSON.stringify({ q, category, level, resourceType, sort, pricingType });

  const [searchInput, setSearchInput] = useState(q);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<Repository[]>([]);

  const currentKey = useRef(paramsKey);
  useEffect(() => {
    currentKey.current = paramsKey;
  }, [paramsKey]);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const { data, isLoading } = useQuery({
    queryKey: ['repos', paramsKey, offset],
    queryFn: () =>
      api<RepoListResult>(
        `/repos?search=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&level=${encodeURIComponent(level)}&resourceType=${encodeURIComponent(resourceType)}&sort=${encodeURIComponent(sort)}&pricingType=${encodeURIComponent(pricingType)}&limit=${PAGE_SIZE}&offset=${offset}`,
      ),
  });

  useEffect(() => {
    if (paramsKey !== currentKey.current) return;
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
    setOffset(0);
    setItems([]);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setOffset(0);
    setItems([]);
    setSearchInput('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setParam('q', searchInput.trim());
  };

  const pageTitle =
    zone === 'free' ? 'Free resources' : zone === 'paid' ? 'Paid resources' : 'The study shelf';
  const pageSubtitle =
    zone === 'free'
      ? 'The main shelf: notes, practice and past papers you can download without paying.'
      : zone === 'paid'
        ? 'Optional full packs. Request contact with the seller and arrange payment off-platform.'
        : 'Free-first resources for IGCSE, AS/A Level, IB and AP — with optional paid packs.';

  const activeFilters = [
    q ? { key: 'q', label: `Search: ${q}` } : null,
    level ? { key: 'level', label: LEVELS.find((item) => item.id === level)?.name ?? level } : null,
    category
      ? { key: 'category', label: CATEGORIES.find((item) => item.id === category)?.name ?? category }
      : null,
    resourceType
      ? {
          key: 'resourceType',
          label: RESOURCE_TYPES.find((item) => item.id === resourceType)?.name ?? resourceType,
        }
      : null,
    !lockedPricing && pricingType ? { key: 'pricingType', label: pricingType } : null,
    sort !== 'recent' ? { key: 'sort', label: 'Custom sort' } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="section-shell py-10 sm:py-14">
      <PageMeta title={pageTitle} description={pageSubtitle} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Study shelf</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl">{pageTitle}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-surface/70 p-1">
          {ZONE_TABS.map((tab) => (
            <Link
              key={tab.zone}
              to={tab.to}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                zone === tab.zone
                  ? 'bg-accent-subtle text-accent'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Filter panel */}
      <div className="panel mt-8 p-4 sm:p-5">
        <form onSubmit={onSearch} className="flex flex-col gap-2.5 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <FaSearch
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search titles, descriptions and tags…"
              className="h-11 rounded-full pl-11"
              aria-label="Search resources"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={level} onValueChange={(v) => setParam('level', v === 'all' ? '' : v)}>
              <SelectTrigger className="h-11 w-[8.5rem] rounded-full">
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {LEVELS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={category}
              onValueChange={(v) => setParam('category', v === 'all' ? '' : v)}
            >
              <SelectTrigger className="h-11 w-[10rem] rounded-full">
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {CATEGORIES.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={resourceType}
              onValueChange={(v) => setParam('resourceType', v === 'all' ? '' : v)}
            >
              <SelectTrigger className="h-11 w-[10rem] rounded-full">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {RESOURCE_TYPES.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!lockedPricing && (
              <Select
                value={pricingType}
                onValueChange={(v) => setParam('pricingType', v === 'all' ? '' : v)}
              >
                <SelectTrigger className="h-11 w-[7.5rem] rounded-full">
                  <SelectValue placeholder="Pricing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All pricing</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={sort} onValueChange={(v) => setParam('sort', v)}>
              <SelectTrigger className="h-11 w-[9.5rem] rounded-full">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Newest</SelectItem>
                <SelectItem value="popular">Most downloaded</SelectItem>
                <SelectItem value="views">Most viewed</SelectItem>
                <SelectItem value="sales">Best selling</SelectItem>
                <SelectItem value="rating">Top rated</SelectItem>
                <SelectItem value="price_asc">Price: low → high</SelectItem>
                <SelectItem value="price_desc">Price: high → low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>

        {activeFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <FaSlidersH className="h-3 w-3" /> Filters
            </span>
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setParam(filter.key, '')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/70 bg-surface-2/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
              >
                {filter.label}
                <FaTimes className="h-2.5 w-2.5" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 cursor-pointer text-xs font-semibold text-accent hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{formatNumber(total)}</span>{' '}
          resource{total === 1 ? '' : 's'}
        </p>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Showing {items.length} of {formatNumber(total)}
        </p>
      </div>

      <div className="mt-5">
        {isLoading && offset === 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="panel space-y-4 p-5">
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
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
        ) : items.length === 0 ? (
          <div className="panel px-6 py-20 text-center">
            <FaBookOpen className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="mt-4 font-display text-2xl">Nothing on this shelf yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Try removing a filter, searching a broader subject, or publish the first resource for
              this combination.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
              <Button asChild>
                <Link to="/upload">Publish a resource</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((repo, i) => (
              <RepositoryCard key={repo.id} repo={repo} index={i} />
            ))}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            disabled={isLoading}
          >
            {isLoading ? <FaSpinner className="h-4 w-4 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
