import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FaBan, FaDesktop, FaExclamationTriangle, FaHistory, FaLock, FaSignOutAlt, FaSpinner, FaTrash } from 'react-icons/fa';
import type { LoginLog } from '@sciehub/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';
import { parseUA, timeAgo } from '@/lib/utils';

export function AccountSafetySection() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['myLogins'],
    queryFn: () => api<{ items: LoginLog[] }>('/users/me/logins'),
    enabled: Boolean(user),
  });

  const revokeMutation = useMutation({
    mutationFn: () => api('/users/me/logins/revoke', { method: 'POST' }),
    onSuccess: () => {
      logout();
      toast('Signed out all devices. Please sign in again.', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not sign out devices', 'error'),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => api('/users/me/deactivate', { method: 'POST' }),
    onSuccess: () => {
      logout();
      toast('Your account is deactivated. Sign in again within 30 days to restore it.', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not deactivate', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api('/users/me', { method: 'DELETE', json: { password: deletePassword } }),
    onSuccess: () => {
      setDeleteOpen(false);
      logout();
      toast('Your account has been permanently deleted.', 'info');
      navigate('/');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not delete account', 'error'),
  });

  return (
    <div className="space-y-8">
      {/* Login history */}
      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <FaHistory className="h-4 w-4 text-accent" /> Login history
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Every sign-in attempt on your account. Check regularly to spot someone else using it — a stolen password looks
          like logins you don't recognise.
        </p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{data?.items?.length ?? 0} recent attempts</span>
          <Button variant="outline" size="sm" onClick={() => revokeMutation.mutate()} disabled={revokeMutation.isPending}>
            {revokeMutation.isPending ? <FaSpinner className="h-3.5 w-3.5 animate-spin" /> : <FaSignOutAlt className="h-3.5 w-3.5" />}
            Sign out all devices
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {(data?.items ?? []).map((log) => {
              const { browser, os } = parseUA(log.userAgent);
              return (
                <li key={log.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <Badge variant={log.success ? 'success' : 'error'}>
                    {log.success ? 'Success' : 'Failed'}
                  </Badge>
                  <FaDesktop className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">{log.ip || '—'}</span>
                  <span className="text-xs text-muted-foreground">
                    {browser} · {os}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{timeAgo(log.createdAt)}</span>
                </li>
              );
            })}
            {(data?.items?.length ?? 0) === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">No login attempts recorded yet.</li>
            )}
          </ul>
        )}
      </section>

      {/* Danger zone */}
      <section className="rounded-lg border border-error bg-error-subtle p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <FaExclamationTriangle className="h-4 w-4 text-error" /> Danger zone
        </h2>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Deactivate my account</p>
            <p className="text-xs text-muted-foreground">
              Freezes your account for 30 days. Signing in again restores it; otherwise it is deleted after 30 days.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => deactivateMutation.mutate()} disabled={deactivateMutation.isPending}>
            {deactivateMutation.isPending ? <FaSpinner className="h-3.5 w-3.5 animate-spin" /> : <FaBan className="h-3.5 w-3.5" />}
            Deactivate
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-error/40 pt-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Permanently delete my account</p>
            <p className="text-xs text-muted-foreground">
              Removes your account, all repositories, files, comments and memberships. This cannot be undone.
            </p>
            <div className="mt-3 flex max-w-sm items-center gap-2">
              <FaLock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Confirm your password"
                className="bg-surface"
              />
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            disabled={!deletePassword}
            onClick={() => setDeleteOpen(true)}
          >
            <FaTrash className="h-3.5 w-3.5" /> Delete account
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => !v && setDeleteOpen(false)}
        title="Permanently delete your account?"
        description="All of your repositories, files, comments and memberships will be removed. This cannot be undone."
        confirmLabel="Delete my account"
        busy={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
