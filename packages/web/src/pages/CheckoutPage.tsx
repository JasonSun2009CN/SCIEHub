import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaCheckCircle,
  FaCoins,
  FaFolder,
  FaLock,
  FaShieldAlt,
  FaSpinner,
  FaWallet,
} from 'react-icons/fa';
import {
  PLATFORM_FEE_RATE,
  formatPrice,
  type Order,
  type Repository,
  type WalletOverview,
} from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';
import { formatNumber, timeAgo } from '@/lib/utils';

interface CheckoutResult {
  order: Order;
  formattedTotal: string;
  platformFeeRate: number;
}

export function CheckoutPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paidOrderNo, setPaidOrderNo] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const { data: repoData, isLoading: repoLoading } = useQuery({
    queryKey: ['repo', repoId],
    queryFn: () => api<{ repo: Repository }>(`/repos/${repoId}`),
    enabled: Boolean(repoId),
  });

  const { data: wallet } = useQuery<WalletOverview>({
    queryKey: ['wallet-overview'],
    queryFn: () => api('/users/me/wallet'),
    enabled: Boolean(user),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (): Promise<{ order: Order }> => {
      setErrorCode(null);
      // 1. Create the order
      const checkout = await api<CheckoutResult>(`/repos/${repoId}/checkout`, { method: 'POST' });
      // 2. Pay it from the wallet
      try {
        await api<{ ok: true }>(`/users/me/orders/${checkout.order.id}/pay`, { method: 'POST' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Payment failed';
        throw new Error(message);
      }
      return { order: checkout.order };
    },
    onSuccess: ({ order }) => {
      setPaidOrderNo(order.orderNo);
      queryClient.invalidateQueries({ queryKey: ['wallet-overview'] });
      queryClient.invalidateQueries({ queryKey: ['repo', repoId] });
      queryClient.invalidateQueries({ queryKey: ['repos'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['myOrders'] });
      queryClient.invalidateQueries({ queryKey: ['myPurchases'] });
      toast(`Payment successful — ${order.repoName} is now yours`, 'success');
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Payment failed';
      const insufficient = /insufficient|balance/i.test(message);
      setErrorCode(insufficient ? 'insufficient_balance' : 'generic');
      toast(message, 'error');
    },
  });

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace state={{ from: `/checkout/${repoId}` }} />;

  const repo = repoData?.repo;

  if (repoLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 space-y-3 rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <p className="text-lg font-semibold">Repository not found</p>
        <Button variant="link" asChild className="mt-2">
          <Link to="/marketplace">Back to marketplace</Link>
        </Button>
      </div>
    );
  }

  // Redirects for non-payable repositories
  if (repo.pricingType === 'free') {
    return <Navigate to={`/repos/${repo.id}`} replace />;
  }
  if (repo.isOwner) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <FaFolder className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-lg font-semibold">This is your own resource</p>
        <p className="mt-1 text-sm text-muted-foreground">You already own it — no purchase needed.</p>
        <Button asChild className="mt-6">
          <Link to={`/repos/${repo.id}`}>Back to resource</Link>
        </Button>
      </div>
    );
  }

  // Already paid — success screen
  if (paidOrderNo || repo.isPurchased) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-10">
          <FaCheckCircle className="mx-auto h-14 w-14 text-success" aria-hidden />
          <h1 className="mt-5 font-display text-3xl">Purchase complete</h1>
          <p className="mt-2 text-muted-foreground">
            {paidOrderNo ? (
              <>
                Order <span className="font-mono text-sm font-medium text-foreground">{paidOrderNo}</span> was
                paid successfully.
              </>
            ) : (
              'You already have access to this resource.'
            )}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The download links are now unlocked on the resource page.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to={`/repos/${repo.id}`}>View downloads</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/orders?role=buyer">My orders</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const platformFee = repo.price * PLATFORM_FEE_RATE;
  const sellerEarning = repo.price - platformFee;
  const balance = wallet?.balance ?? 0;
  const insufficient = balance < repo.price;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <PageMeta title={`Checkout — ${repo.name}`} description="Confirm your purchase on SCIEHub." />

      <div className="mb-6 flex items-center gap-2">
        <FaLock className="h-4 w-4 text-accent" aria-hidden />
        <h1 className="font-display text-3xl">Checkout</h1>
        <Badge variant="outline" className="ml-1">Secure</Badge>
      </div>

      <div className="space-y-6">
        {/* Item summary */}
        <div className="rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
              <FaFolder className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <Link to={`/repos/${repo.id}`} className="font-semibold hover:text-accent">
                {repo.name}
              </Link>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{repo.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge>{repo.levelName}</Badge>
                <Badge variant="secondary">{repo.categoryName}</Badge>
                <Badge variant="outline">{repo.resourceTypeName}</Badge>
                <span>{formatNumber(repo.fileCount)} files</span>
                <span>·</span>
                <span>Sold {formatNumber(repo.totalSales)}×</span>
                <span>·</span>
                <span>{timeAgo(repo.createdAt)}</span>
              </div>
            </div>
            <span className="shrink-0 text-lg font-bold text-accent tabular-nums">
              {formatPrice(repo.price, repo.currency)}
            </span>
          </div>
        </div>

        {/* Price breakdown */}
        <div className="rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6">
          <h2 className="text-sm font-semibold">Order summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Item price</dt>
              <dd className="font-medium tabular-nums">{formatPrice(repo.price, repo.currency)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                Platform fee ({Math.round(PLATFORM_FEE_RATE * 100)}%)
              </dt>
              <dd className="tabular-nums text-muted-foreground">−{formatPrice(platformFee, repo.currency)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <FaCoins className="h-3.5 w-3.5" aria-hidden />
                Seller earns
              </dt>
              <dd className="tabular-nums text-success">{formatPrice(sellerEarning, repo.currency)}</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-base font-bold">
              <dt>Total due</dt>
              <dd className="text-accent tabular-nums">{formatPrice(repo.price, repo.currency)}</dd>
            </div>
          </dl>
        </div>

        {/* Payment */}
        <div className="rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FaWallet className="h-4 w-4 text-accent" aria-hidden />
            Pay from wallet
          </h2>
          <div className="mt-3 flex items-center justify-between rounded-md bg-surface-2 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Wallet balance</span>
            <span className={`font-semibold tabular-nums ${insufficient ? 'text-error' : 'text-accent'}`}>
              {wallet ? formatPrice(balance, repo.currency) : '—'}
            </span>
          </div>

          {insufficient && (
            <p className="mt-3 flex items-start gap-2 rounded-md border border-error/30 bg-error-subtle px-3 py-2.5 text-xs text-error">
              <FaCoins className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Your balance is lower than the total due. Contact an administrator to top up your wallet,
                or adjust the price of your own listings to start earning.
              </span>
            </p>
          )}

          {errorCode === 'insufficient_balance' && (
            <p className="mt-3 rounded-md border border-error/30 bg-error-subtle px-3 py-2.5 text-xs text-error">
              The payment was rejected because the wallet balance is insufficient.
            </p>
          )}

          <Button
            className="mt-5 w-full"
            size="lg"
            disabled={checkoutMutation.isPending || insufficient}
            onClick={() => checkoutMutation.mutate()}
          >
            {checkoutMutation.isPending ? (
              <>
                <FaSpinner className="h-4 w-4 animate-spin" /> Processing…
              </>
            ) : (
              <>
                <FaLock className="h-4 w-4" /> Pay {formatPrice(repo.price, repo.currency)}
              </>
            )}
          </Button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <FaShieldAlt className="h-3 w-3 text-success" aria-hidden />
            Instant access after payment · seller-initiated refunds supported
          </p>
        </div>
      </div>
    </div>
  );
}
