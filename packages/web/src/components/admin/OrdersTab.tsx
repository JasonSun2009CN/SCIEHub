import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FaSearch, FaSpinner, FaUndo } from 'react-icons/fa';
import { formatPrice, type Order, type OrderStatus } from '@sciehub/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { timeAgo } from '@/lib/utils';

const PAGE = 20;

const STATUS_META: Record<OrderStatus, { label: string; variant: 'warning' | 'success' | 'secondary' | 'error' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  paid: { label: 'Paid', variant: 'success' },
  refunded: { label: 'Refunded', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'error' },
};

export function OrdersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<Order[]>([]);
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminOrders', status, search, offset],
    queryFn: () =>
      api<{ items: Order[]; total: number }>(
        `/admin/orders?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&limit=${PAGE}&offset=${offset}`,
      ),
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

  const refundMutation = useMutation({
    mutationFn: (orderId: string) =>
      api(`/admin/orders/${orderId}/refund`, { method: 'POST', json: { reason: 'Admin-initiated refund' } }),
    onSuccess: () => {
      setRefundTarget(null);
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
      toast('Order refunded', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Refund failed', 'error'),
  });

  const orders = items;
  const total = data?.total ?? 0;
  const hasMore = orders.length < total;

  return (
    <div>
      <form onSubmit={onSearch} className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 max-w-xs">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order no, repo or user…"
            className="pl-9"
            aria-label="Search orders"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setOffset(0); setItems([]); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{total} orders</span>
      </form>

      {isLoading && offset === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface py-16 text-center text-sm text-muted-foreground">
          No orders match these filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="hidden px-4 py-3 md:table-cell">Seller</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">Seller earns</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => {
                const meta = STATUS_META[order.status];
                return (
                  <tr key={order.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs">{order.orderNo}</div>
                      <Link to={`/repos/${order.repoId}`} className="text-xs font-medium text-accent hover:underline">
                        {order.repoName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{timeAgo(order.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/users/${order.buyer.username}`} className="text-sm hover:text-accent">
                        @{order.buyer.username}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <Link to={`/users/${order.seller.username}`} className="text-sm hover:text-accent">
                        @{order.seller.username}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatPrice(order.totalAmount, order.currency)}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-success sm:table-cell">
                      {formatPrice(order.sellerEarning, order.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {order.status === 'paid' ? (
                        <Button size="sm" variant="outline" onClick={() => setRefundTarget(order)}>
                          <FaUndo className="h-3 w-3" /> Refund
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/repos/${order.repoId}`}>View</Link>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => setOffset((o) => o + PAGE)} disabled={isLoading}>
            Load more
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(refundTarget)}
        onOpenChange={(open) => !open && setRefundTarget(null)}
        title="Refund this order?"
        description={
          refundTarget
            ? `Refund ${refundTarget.orderNo} (${formatPrice(refundTarget.totalAmount, refundTarget.currency)})? The buyer's wallet is credited and the seller's earning is reversed.`
            : ''
        }
        confirmLabel="Refund order"
        busy={refundMutation.isPending}
        onConfirm={() => refundTarget && refundMutation.mutate(refundTarget.id)}
      />
    </div>
  );
}
