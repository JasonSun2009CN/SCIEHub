import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FaPlus, FaSearch, FaSpinner, FaUsers } from 'react-icons/fa';
import { CATEGORIES, type Group } from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { GroupCard } from '@/components/generated/GroupCard';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';

const PAGE_SIZE = 12;

function GroupsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-5">
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex gap-4 border-t border-border pt-3">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GroupsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const sort = searchParams.get('sort') ?? 'recent';
  const paramsKey = JSON.stringify({ q, category, sort });

  const [searchInput, setSearchInput] = useState(q);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<Group[]>([]);
  const currentKey = useRef(paramsKey);

  useEffect(() => {
    currentKey.current = paramsKey;
  }, [paramsKey]);

  const { data, isLoading } = useQuery({
    queryKey: ['groups', paramsKey, offset],
    queryFn: () =>
      api<{ items: Group[]; total: number }>(
        `/groups?search=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&sort=${encodeURIComponent(sort)}&limit=${PAGE_SIZE}&offset=${offset}`,
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
    setSearchParams(next, { replace: true });
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setParam('q', searchInput.trim());
  };

  // Create-group dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      api<{ group: Group }>('/groups', {
        method: 'POST',
        json: { name: newName.trim(), description: newDesc.trim(), categoryId: newCategory },
      }),
    onSuccess: (result) => {
      setDialogOpen(false);
      setNewName('');
      setNewDesc('');
      setNewCategory('');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['myGroups'] });
      toast('Group created', 'success');
      navigate(`/groups/${result.group.id}`);
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Could not create group', 'error');
    },
  });

  const openCreateDialog = () => {
    if (!user) {
      navigate('/auth', { state: { from: '/groups' } });
      return;
    }
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageMeta title="Groups" description="Browse study groups on SCIEHub." />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl">
            <FaUsers className="h-6 w-6 text-accent" /> Study groups
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Join a subject community or start your own.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <FaPlus className="h-4 w-4" /> Create group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a study group</DialogTitle>
              <DialogDescription>Bring classmates together around a subject you care about.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">Group name *</Label>
                <Input
                  id="group-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. IB Biology HL Study Group"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-desc">Description</Label>
                <Textarea
                  id="group-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What will members share and discuss here?"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || !newCategory || createMutation.isPending}
              >
                {createMutation.isPending && <FaSpinner className="h-4 w-4 animate-spin" />}
                Create group
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form onSubmit={onSearch} className="relative min-w-0 flex-1 max-w-sm">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search groups…" className="pl-9" />
        </form>
        <Select value={category} onValueChange={(v) => setParam('category', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-44">
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
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Newest first</SelectItem>
            <SelectItem value="members">Most members</SelectItem>
            <SelectItem value="repos">Most repositories</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">{total} group{total === 1 ? '' : 's'}</span>
      </div>

      <div className="mt-6">
        {isLoading && offset === 0 ? (
          <GroupsSkeleton />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border/75 bg-surface/75 shadow-soft py-16 text-center">
            <FaUsers className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No groups found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search or be the first to start one.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((group, i) => (
              <GroupCard key={group.id} group={group} index={i} />
            ))}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={() => setOffset((o) => o + PAGE_SIZE)} disabled={isLoading}>
            {isLoading ? <FaSpinner className="h-4 w-4 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
