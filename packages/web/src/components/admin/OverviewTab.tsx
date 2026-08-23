import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FaBook, FaCoins, FaComment, FaDownload, FaFlag, FaFolder, FaShoppingBag, FaUsers } from 'react-icons/fa';
import { formatPrice, type AdminReportItem, type HomeStats, type Order } from '@sciehub/shared';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils';

interface OverviewData {
  stats: HomeStats;
  comments: number;
  openReports: number;
  recentReports: AdminReportItem[];
  recentOrders: Order[];
}

export function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['adminOverview'],
    queryFn: () => api<OverviewData>('/admin/overview'),
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const tiles = [
    { Icon: FaUsers, label: 'Users', value: data.stats.users },
    { Icon: FaFolder, label: 'Repositories', value: data.stats.repos },
    { Icon: FaBook, label: 'Files', value: data.stats.files },
    { Icon: FaUsers, label: 'Groups', value: data.stats.groups },
    { Icon: FaDownload, label: 'Downloads', value: data.stats.downloads },
    { Icon: FaShoppingBag, label: 'Sales', value: data.stats.totalSales, accent: true },
    { Icon: FaCoins, label: 'Revenue', value: formatPrice(data.stats.totalRevenue, 'CNY'), money: true },
    { Icon: FaComment, label: 'Comments', value: data.comments },
    { Icon: FaFlag, label: 'Open reports', value: data.openReports, warn: data.openReports > 0 },
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ Icon, label, value, warn, accent, money }) => (
          <div key={label} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className={warn ? 'h-4 w-4 text-error' : 'h-4 w-4 text-accent'} />
            </div>
            <div
              className={`mt-2 text-2xl font-bold tabular-nums ${
                warn ? 'text-error' : money ? 'text-success' : accent ? 'text-accent' : ''
              }`}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Recent reports</h2>
        {data.recentReports.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No reports yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.recentReports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <Badge variant={r.status === 'open' ? 'warning' : 'secondary'}>
                  {r.status === 'open' ? 'Open' : 'Resolved'}
                </Badge>
                <span className="text-muted-foreground">{r.reason}</span>
                <Link
                  to={`/repos/${r.targetRepoId ?? r.targetId}`}
                  className="min-w-0 flex-1 truncate text-accent hover:underline"
                >
                  {r.targetName || '(deleted)'}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {r.reporter.nickname} · {timeAgo(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Recent orders</h2>
        {data.recentOrders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.recentOrders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <Badge
                  variant={order.status === 'paid' ? 'success' : order.status === 'pending' ? 'warning' : 'secondary'}
                >
                  {order.status}
                </Badge>
                <span className="min-w-0 flex-1 truncate">
                  {order.repoName}{' '}
                  <span className="text-xs text-muted-foreground">
                    · @{order.buyer.username} → @{order.seller.username}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatPrice(order.totalAmount, order.currency)}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(order.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
