import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FaCheck, FaFlag, FaSpinner, FaTrash, FaUndo } from 'react-icons/fa';
import type { AdminReportItem } from '@sciehub/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { cn, timeAgo } from '@/lib/utils';

type Filter = 'all' | 'open' | 'resolved';
const PAGE = 20;

export function ReportsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('open');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<AdminReportItem[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AdminReportItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminReports', filter, offset],
    queryFn: () => api<{ items: AdminReportItem[]; total: number }>(`/admin/reports?status=${filter === 'all' ? '' : filter}&limit=${PAGE}&offset=${offset}`),
  });

  useEffect(() => {
    if (offset === 0) setItems(data?.items ?? []);
    else if (data) setItems((prev) => [...prev, ...data.items]);
  }, [data, offset]);

  useEffect(() => {
    setOffset(0);
    setItems([]);
  }, [filter]);

  const merged = items;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['adminReports'] });
    queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'open' | 'resolved' }) =>
      api(`/admin/reports/${id}`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      refresh();
      toast('Report updated', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (report: AdminReportItem) => {
      const path =
        report.targetType === 'repo'
          ? `/admin/repos/${report.targetId}`
          : `/admin/comments/${report.targetId}`;
      return api(path, { method: 'DELETE' });
    },
    onSuccess: (_data, report) => {
      setDeleteTarget(null);
      // Also close the report since its target is gone.
      api(`/admin/reports/${report.id}`, { method: 'PATCH', json: { status: 'resolved' } }).catch(() => undefined);
      refresh();
      toast('Violating content deleted and report resolved', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  const total = data?.total ?? 0;
  const hasMore = merged.length < total;

  return (
    <div>
      <div className="flex items-center gap-2">
        {(['open', 'all', 'resolved'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === f ? 'bg-accent-subtle text-accent' : 'bg-surface-2 text-muted-foreground hover:text-foreground',
            )}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border/75 bg-surface/75 shadow-soft">
        {isLoading && offset === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : merged.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No reports here.</p>
        ) : (
          <ul className="divide-y divide-border">
            {merged.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <FaFlag className={r.status === 'open' ? 'h-4 w-4 text-warning' : 'h-4 w-4 text-muted-foreground'} />
                <Badge variant={r.status === 'open' ? 'warning' : 'secondary'}>
                  {r.status === 'open' ? 'Open' : 'Resolved'}
                </Badge>
                <Badge variant="outline">{r.targetType}</Badge>
                <Link to={`/repos/${r.targetRepoId ?? r.targetId}`} className="min-w-0 max-w-[16rem] truncate text-accent hover:underline">
                  {r.targetName || '(deleted)'}
                </Link>
                <span className="text-muted-foreground">{r.reason}</span>
                <span className="text-xs text-muted-foreground">
                  {r.reporter.nickname} · {timeAgo(r.createdAt)}
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  {r.status === 'open' ? (
                    <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: r.id, status: 'resolved' })}>
                      <FaCheck className="h-3.5 w-3.5 text-success" /> Resolve
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: r.id, status: 'open' })}>
                      <FaUndo className="h-3.5 w-3.5" /> Reopen
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(r)} disabled={deleteMutation.isPending}>
                    <FaTrash className="h-3.5 w-3.5 text-error" /> Delete target
                  </Button>
                </span>
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
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Delete this ${deleteTarget?.targetType === 'repo' ? 'repository' : 'comment'}?`}
        description={`“${deleteTarget?.targetName ?? 'Target'}” will be removed immediately. The report will be marked resolved.`}
        confirmLabel="Delete"
        busy={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
      />
    </div>
  );
}
