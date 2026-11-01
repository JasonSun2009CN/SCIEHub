import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FaBan, FaCheck, FaCoins, FaSearch, FaShieldAlt, FaTrash } from 'react-icons/fa';
import { formatBytes, type User } from '@sciehub/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatNumber } from '@/lib/utils';

const PAGE = 20;

export function UsersTab() {
  const { user: me, refresh: refreshAuth } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<User[]>([]);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers', search, offset],
    queryFn: () => api<{ items: User[]; total: number }>(`/admin/users?search=${encodeURIComponent(search)}&limit=${PAGE}&offset=${offset}`),
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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] });

  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { isAdmin?: boolean; isSuspended?: boolean } }) =>
      api(`/admin/users/${id}`, { method: 'PATCH', json: patch }),
    onSuccess: () => {
      refresh();
      toast('User updated', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const stepDownMutation = useMutation({
    mutationFn: () => api(`/admin/users/${me!.id}`, { method: 'PATCH', json: { isAdmin: false } }),
    onSuccess: async () => {
      toast('You are no longer an admin.', 'info');
      await refreshAuth();
      queryClient.clear();
      navigate('/');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not step down', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleteUser(null);
      refresh();
      toast('User deleted', 'info');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
  });

  const topupMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api(`/admin/users/${id}/topup`, { method: 'POST', json: { amount, currency: 'CNY' } }),
    onSuccess: () => {
      refresh();
      toast('Wallet topped up', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Top-up failed', 'error'),
  });

  const onTopup = (u: User) => {
    const raw = window.prompt(`Enter top-up amount (¥) for @${u.username}:`, '10');
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      toast('Amount must be a positive number ≤ 1,000,000', 'error');
      return;
    }
    topupMutation.mutate({ id: u.id, amount });
  };

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
          placeholder="Search by username, name or email…"
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
          <p className="py-12 text-center text-sm text-muted-foreground">No users found.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <UserAvatar nickname={u.nickname} username={u.username} avatarUrl={u.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link to={`/users/${u.username}`} className="font-medium hover:text-accent">
                    {u.nickname}
                  </Link>
                  <span className="text-xs text-muted-foreground"> @{u.username} · {u.email}</span>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {u.repoCount} repos · {u.fileCount} files · {formatBytes(u.totalBytes)} · joined {formatDate(u.createdAt)} ·{' '}
                    wallet{' '}
                    <span className="font-semibold text-accent tabular-nums">
                      ¥{formatNumber(u.walletBalance)}
                    </span>
                  </div>
                </div>
                {u.isAdmin && <Badge variant="warning">Admin</Badge>}
                {u.isSuspended && <Badge variant="error">Banned</Badge>}
                <div className="flex items-center gap-1">
                  {me?.id === u.id && u.isAdmin ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => stepDownMutation.mutate()}
                      title="Give up admin (transfer to someone else first)"
                      disabled={stepDownMutation.isPending}
                    >
                      <FaShieldAlt className="h-3.5 w-3.5 text-warning" /> Step down
                    </Button>
                  ) : me?.id !== u.id ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => patchMutation.mutate({ id: u.id, patch: { isAdmin: !u.isAdmin } })}
                      title={u.isAdmin ? 'Revoke admin' : 'Make admin'}
                    >
                      <FaShieldAlt className={u.isAdmin ? 'h-3.5 w-3.5 text-warning' : 'h-3.5 w-3.5'} />
                    </Button>
                  ) : null}
                  {me?.id !== u.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => patchMutation.mutate({ id: u.id, patch: { isSuspended: !u.isSuspended } })}
                      title={u.isSuspended ? 'Unban account' : 'Ban account'}
                    >
                      {u.isSuspended ? (
                        <FaCheck className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <FaBan className="h-3.5 w-3.5 text-warning" />
                      )}
                    </Button>
                  )}
                  {me?.id !== u.id && (
                    <Button size="sm" variant="ghost" onClick={() => onTopup(u)} title="Top up wallet">
                      <FaCoins className="h-3.5 w-3.5 text-accent" />
                    </Button>
                  )}
                  {me?.id !== u.id && (
                    <Button size="sm" variant="ghost" onClick={() => setDeleteUser(u)}>
                      <FaTrash className="h-3.5 w-3.5 text-error" />
                    </Button>
                  )}
                </div>
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
        open={Boolean(deleteUser)}
        onOpenChange={(v) => !v && setDeleteUser(null)}
        title={`Delete @${deleteUser?.username}?`}
        description="This permanently removes the user, all their repositories, files, comments and memberships. This cannot be undone."
        confirmLabel="Delete user"
        busy={deleteMutation.isPending}
        onConfirm={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
      />
    </div>
  );
}
