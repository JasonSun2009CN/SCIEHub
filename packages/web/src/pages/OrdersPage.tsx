import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaCartArrowDown,
  FaCartPlus,
  FaCircleNotch,
  FaFileInvoice,
  FaShoppingBag,
  FaSpinner,
  FaUndo,
} from 'react-icons/fa';
import { formatPrice, type Order, type OrderStatus, type Paged } from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';
import { formatNumber, timeAgo } from '@/lib/utils';

const STATUS_META: Record<OrderStatus, { label: string; variant: 'warning' | 'success' | 'secondary' | 'error' }> = {
  pending: { label: 'Pending payment', variant: 'warning' },
  paid: { label: 'Paid', variant: 'success' },
  refunded: { label: 'Refunded', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'error' },
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAGE_SIZE = 20;

export function OrdersPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = searchParams.get('role') === 'seller' ? 'seller' : 'buyer';
  const statusParam = searchParams.get('status') ?? '';
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['myOrders', role, statusParam, offset],
    queryFn: () =>
      api<Paged<Order>>(
        `/users/me/orders?role=${role}&status=${encodeURIComponent(statusParam)}&limit=${PAGE_SIZE}&offset=${offset}`,
      ),
    enabled: Boolean(user),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['myOrders'] });
    queryClient.invalidateQueries({ queryKey: ['wallet-overview'] });
    queryClient.invalidateQueries({ queryKey: ['repo'] });
    queryClient.invalidateQueries({ queryKey: ['repos'] });
    queryClient.invalidateQueries({ queryKey: ['home'] });
  };

  const payMutation = useMutation({
    mutationFn: (orderId: string) => api(`/users/me/orders/${orderId}/pay`, { method: 'POST' }),
    onSuccess: () => {
      toast('Order paid — resource unlocked', 'success');
      invalidate();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Payment failed', 'error'),
  });

  const refundMutation = useMutation({
    mutationFn: (orderId: string) =>
      api(`/users/me/orders/${orderId}/refund`, { method: 'POST', json: { reason: 'Seller-initiated refund' } }),
    onSuccess: () => {
      toast('Order refunded', 'success');
      invalidate();
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Refund failed', 'error'),
  });

  const setRole = (r: 'buyer' | 'seller') => {
    const next = new URLSearchParams(searchParams);
    next.set('role', r);
    setSearchParams(next, { replace: true });
    setOffset(0);
  };

  const setStatus = (s: string) => {
    const next = new URLSearchParams(searchParams);
    if (s) next.set('status', s);
    else next.delete('status');
    setSearchParams(next, { replace: true });
    setOffset(0);
  };

  if (loading) return null;
  if (!user) return <p className="py-24 text-center text-sm text-muted-foreground">Sign in to view your orders.</p>;

  const orders = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = orders.length < total;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMeta title="Orders" description="Your purchases and sales on SCIEHub." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FaFileInvoice className="h-6 w-6 text-accent" aria-hidden />
            Orders
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track purchases you've made and sales you've earned.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusParam} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={role} onValueChange={(v) => setRole(v as 'buyer' | 'seller')} className="mt-6">
        <TabsList>
          <TabsTrigger value="buyer" className="gap-1.5">
            <FaShoppingBag className="h-4 w-4" /> As buyer
          </TabsTrigger>
          <TabsTrigger value="seller" className="gap-1.5">
            <FaCartPlus className="h-4 w-4" /> As seller
          </TabsTrigger>
        </TabsList>

        <TabsContent value={role}>
          {role === 'seller' && (
            <p className="mb-4 flex items-start gap-2 rounded-md border border-accent/25 bg-accent-subtle px-3 py-2.5 text-xs text-muted-foreground">
              <FaCartArrowDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
              <span>
                Payouts go straight to your wallet when a buyer pays. You can refund a paid order from
                here; the buyer's money and your earning are reversed automatically.
              </span>
            </p>
          )}

          {isLoading && offset === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface py-16 text-center">
              <FaCircleNotch className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No {role === 'buyer' ? 'purchases' : 'sales'} yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {role === 'buyer' ? (
                  <>
                    Head to the{' '}
                    <Link to="/marketplace" className="text-accent hover:underline">marketplace</Link>{' '}
                    to find resources worth buying.
                  </>
                ) : (
                  <>
                    Publish a resource on the{' '}
                    <Link to="/upload" className="text-accent hover:underline">upload</Link> page to start
                    earning.
                  </>
                )}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {orders.map((order) => {
                const meta = STATUS_META[order.status];
                const counterpart = role === 'buyer' ? order.seller : order.buyer;
                return (
                  <li
                    key={order.id}
                    className="animate-fade-in-up flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4"
                  >
                    <UserAvatar
                      nickname={counterpart.nickname}
                      username={counterpart.username}
                      avatarUrl={counterpart.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/repos/${order.repoId}`}
                          className="truncate font-semibold hover:text-accent"
                        >
                          {order.repoName}
                        </Link>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Order <span className="font-mono">{order.orderNo}</span> · {timeAgo(order.createdAt)}{' '}
                        · {role === 'buyer' ? 'from' : 'to'} @{counterpart.username}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-bold tabular-nums">
                        {formatPrice(order.totalAmount, order.currency)}
                      </div>
                      {role === 'buyer' ? (
                        <div className="text-[11px] text-muted-foreground">
                          fee {formatPrice(order.platformFee, order.currency)}
                        </div>
                      ) : (
                        <div className="text-[11px] text-success">
                          earn {formatPrice(order.sellerEarning, order.currency)}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {role === 'buyer' && order.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => payMutation.mutate(order.id)}
                          disabled={payMutation.isPending}
                        >
                          {payMutation.isPending && <FaSpinner className="h-3.5 w-3.5 animate-spin" />}
                          Pay now
                        </Button>
                      )}
                      {role === 'seller' && order.status === 'paid' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Refund order ${order.orderNo}? The buyer's payment and your earning will both be reversed.`,
                              )
                            ) {
                              refundMutation.mutate(order.id);
                            }
                          }}
                          disabled={refundMutation.isPending}
                        >
                          <FaUndo className="h-3.5 w-3.5" /> Refund
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/repos/${order.repoId}`}>View</Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => setOffset((o) => o + PAGE_SIZE)} disabled={isLoading}>
                Load more
              </Button>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {formatNumber(total)} order{total === 1 ? '' : 's'} ·{' '}
            <button
              className="cursor-pointer text-accent hover:underline"
              onClick={() => navigate('/wallet')}
            >
              View wallet
            </button>
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
