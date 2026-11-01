import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FaFolder, FaSearch, FaTrash } from 'react-icons/fa';
import { formatBytes, type Repository } from '@sciehub/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { formatNumber, timeAgo } from '@/lib/utils';

const PAGE = 20;

export function ReposTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<Repository[]>([]);
  const [target, setTarget] = useState<Repository | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminRepos', search, offset],
    queryFn: () => api<{ items: Repository[]; total: number }>(`/admin/repos?search=${encodeURIComponent(search)}&limit=${PAGE}&offset=${offset}`),
  });

  useEffect(() => {
    if (offset === 0) setItems(data?.items ?? []);
    else if (data) setItems((prev) => [...prev, ...data.items]);
  }, [data, offset]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setItems([]);
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['adminRepos'] });
    queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/repos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setTarget(null);
      refresh();
      toast('Repository deleted', 'info');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  const total = data?.total ?? 0;
  const hasMore = items.length < total;

  return (
    <div>
      <form onSubmit={onSearch} className="relative max-w-sm">
        <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value === '') {
              setOffset(0);
              setItems([]);
            }
          }}
          placeholder="Search repositories…"
          className="pl-9"
        />
      </form>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
        {isLoading && offset === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No repositories found.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((repo) => (
              <li key={repo.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <FaFolder className="h-4 w-4 text-accent" />
                <Link to={`/repos/${repo.id}`} className="min-w-0 max-w-[18rem] flex-1 truncate font-medium hover:text-accent">
                  {repo.name}
                </Link>
                <Badge variant="outline">{repo.levelName}</Badge>
                <Badge variant="secondary">{repo.categoryName}</Badge>
                <Badge variant="outline">{repo.resourceTypeName}</Badge>
                <Link to={`/users/${repo.owner.username}`} className="text-xs text-muted-foreground hover:text-accent">
                  @{repo.owner.username}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {repo.fileCount} files · {formatBytes(repo.totalBytes)} · {formatNumber(repo.downloadCount)} downloads · {timeAgo(repo.createdAt)}
                </span>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setTarget(repo)}>
                  <FaTrash className="h-3.5 w-3.5 text-error" /> Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => setOffset((o) => o + PAGE)}>
            Load more
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(v) => !v && setTarget(null)}
        title={`Delete “${target?.name}”?`}
        description={`This permanently removes the repository and all ${target?.fileCount ?? 0} of its files. This cannot be undone.`}
        confirmLabel="Delete repository"
        busy={deleteMutation.isPending}
        onConfirm={() => target && deleteMutation.mutate(target.id)}
      />
    </div>
  );
}
