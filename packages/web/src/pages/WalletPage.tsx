import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FaArrowDown,
  FaArrowUp,
  FaCoins,
  FaPiggyBank,
  FaReceipt,
  FaSpinner,
  FaWallet,
} from 'react-icons/fa';
import {
  formatPrice,
  type TransactionType,
  type WalletOverview,
  type WalletTransaction,
} from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { cn, formatNumber, timeAgo } from '@/lib/utils';

const TYPE_META: Record<TransactionType, { label: string; variant: 'success' | 'error' | 'warning' | 'default' | 'secondary' }> = {
  purchase: { label: 'Purchase', variant: 'error' },
  sale: { label: 'Sale', variant: 'success' },
  refund: { label: 'Refund', variant: 'warning' },
  topup: { label: 'Top-up', variant: 'default' },
  withdraw: { label: 'Withdrawal', variant: 'secondary' },
};

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All transactions' },
  { value: 'purchase', label: 'Purchases' },
  { value: 'sale', label: 'Sales' },
  { value: 'refund', label: 'Refunds' },
  { value: 'topup', label: 'Top-ups' },
  { value: 'withdraw', label: 'Withdrawals' },
];

const PAGE_SIZE = 20;

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'success' | 'error' | 'muted';
}) {
  return (
    <div className="rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <div
        className={cn(
          'mt-1.5 text-xl font-bold tabular-nums sm:text-2xl',
          tone === 'success' ? 'text-success' : tone === 'error' ? 'text-error' : 'text-foreground',
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function WalletPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const [offset, setOffset] = useState(0);

  const { data: overview, isLoading: overviewLoading } = useQuery<WalletOverview>({
    queryKey: ['wallet-overview'],
    queryFn: () => api('/users/me/wallet'),
    enabled: Boolean(user),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['wallet-transactions', type, offset],
    queryFn: () =>
      api<{ items: WalletTransaction[]; total: number }>(
        `/users/me/wallet/transactions?type=${encodeURIComponent(type)}&limit=${PAGE_SIZE}&offset=${offset}`,
      ),
    enabled: Boolean(user),
  });

  if (loading) return null;
  if (!user) return <p className="py-24 text-center text-sm text-muted-foreground">Sign in to view your wallet.</p>;

  const transactions = txData?.items ?? [];
  const total = txData?.total ?? 0;
  const hasMore = transactions.length < total;

  const balance = overview?.balance ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMeta title="Wallet" description="Your balance, earnings and spending on SCIEHub." />
      <h1 className="flex items-center gap-2 font-display text-3xl">
        <FaWallet className="h-6 w-6 text-accent" aria-hidden />
        Wallet
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your SCIEHub balance, earnings and spending at a glance.
      </p>

      {/* Balance hero */}
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface to-accent-subtle p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <FaCoins className="h-4 w-4 text-accent" aria-hidden />
              Available balance
            </p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-accent">
              {overviewLoading ? '—' : formatPrice(balance, overview?.currency ?? 'CNY')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/orders?role=seller')}>
              <FaPiggyBank className="h-4 w-4" /> My sales
            </Button>
            <Button variant="outline" onClick={() => navigate('/orders?role=buyer')}>
              <FaReceipt className="h-4 w-4" /> My orders
            </Button>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Top-ups and withdrawals are handled by the platform administrators. Sellers receive payouts to
          this wallet automatically after each sale.
        </p>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total income"
          value={overviewLoading ? '—' : formatPrice(overview?.totalIncome ?? 0, overview?.currency ?? 'CNY')}
          icon={<FaArrowDown className="h-3.5 w-3.5" />}
          tone="success"
        />
        <StatTile
          label="Total spending"
          value={overviewLoading ? '—' : formatPrice(overview?.totalExpense ?? 0, overview?.currency ?? 'CNY')}
          icon={<FaArrowUp className="h-3.5 w-3.5" />}
          tone="error"
        />
        <StatTile
          label="Pending earnings"
          value={overviewLoading ? '—' : formatPrice(overview?.pendingEarnings ?? 0, overview?.currency ?? 'CNY')}
          icon={<FaCoins className="h-3.5 w-3.5" />}
        />
        <StatTile
          label="Transactions"
          value={overviewLoading ? '—' : formatNumber(total)}
          icon={<FaReceipt className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Transaction history */}
      <div className="mt-8 rounded-2xl border border-border/75 bg-surface/75 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-semibold">Transaction history</h2>
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All transactions" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {txLoading && offset === 0 ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center">
            <FaReceipt className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No transactions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {type ? 'Try a different filter.' : 'Your purchases and sales will appear here.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((tx) => {
              const meta = TYPE_META[tx.type];
              const isInflow = tx.amount >= 0;
              return (
                <li key={tx.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                      isInflow ? 'bg-success-subtle text-success' : 'bg-error-subtle text-error',
                    )}
                  >
                    {isInflow ? <FaArrowDown className="h-4 w-4" /> : <FaArrowUp className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(tx.createdAt)} · {tx.type}
                    </p>
                  </div>
                  <Badge variant={meta.variant} className="hidden sm:inline-flex">
                    {meta.label}
                  </Badge>
                  <div className="shrink-0 text-right">
                    <div
                      className={cn(
                        'text-sm font-bold tabular-nums',
                        isInflow ? 'text-success' : 'text-error',
                      )}
                    >
                      {isInflow ? '+' : '−'}
                      {formatPrice(Math.abs(tx.amount), tx.currency)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      bal {formatPrice(tx.balanceAfter, tx.currency)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && (
          <div className="flex justify-center border-t border-border py-4">
            <Button variant="outline" onClick={() => setOffset((o) => o + PAGE_SIZE)} disabled={txLoading}>
              {txLoading && <FaSpinner className="h-4 w-4 animate-spin" />}
              Load more
            </Button>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Have an issue with an order?{' '}
        <Link to="/orders?role=buyer" className="text-accent hover:underline">Review your orders</Link>{' '}
        or read the{' '}
        <Link to="/conduct" className="text-accent hover:underline">community guidelines</Link>.
      </p>
    </div>
  );
}
