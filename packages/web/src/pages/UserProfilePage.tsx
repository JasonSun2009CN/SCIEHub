import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FaBook, FaCalendarAlt, FaCoins, FaDownload, FaShoppingBag, FaUsers } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { formatBytes, formatPrice, type Group, type PurchaseRecord, type Repository, type User } from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { RepositoryCard } from '@/components/generated/RepositoryCard';
import { GroupCard } from '@/components/generated/GroupCard';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatNumber } from '@/lib/utils';

export function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const isMe = Boolean(currentUser && currentUser.username === username);

  const { data, isLoading, error } = useQuery({
    queryKey: ['user', username],
    queryFn: () => api<{ user: User }>(`/users/${username}`),
    enabled: Boolean(username),
  });

  const { data: repos } = useQuery({
    queryKey: ['userRepos', username],
    queryFn: () => api<{ items: Repository[] }>(`/users/${username}/repos`),
    enabled: Boolean(username),
  });

  const { data: favorites } = useQuery({
    queryKey: ['userFavorites', username],
    queryFn: () => api<{ items: Repository[] }>(`/users/${username}/favorites`),
    enabled: Boolean(username),
  });

  const { data: groups } = useQuery({
    queryKey: ['userGroups', username],
    queryFn: () => api<{ items: Group[] }>(`/users/${username}/groups`),
    enabled: Boolean(username),
  });

  const { data: purchases } = useQuery({
    queryKey: ['myPurchases'],
    queryFn: () => api<{ items: PurchaseRecord[] }>(`/users/me/purchases`),
    enabled: isMe,
  });

  const user = data?.user;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <Skeleton className="mt-8 h-10 w-64" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <p className="text-lg font-semibold">User not found</p>
      </div>
    );
  }

  const stats = [
    { Icon: FaBook, label: 'Repositories', value: user.repoCount },
    { Icon: FaBook, label: 'Files shared', value: user.fileCount },
    { Icon: FaUsers, label: 'Groups', value: user.groupCount },
    { Icon: FaDownload, label: 'Total downloads', value: formatNumber(user.totalDownloads) },
    { Icon: FaCoins, label: 'Sales', value: formatNumber(user.totalSales) },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageMeta title={`${user.nickname} (@${user.username})`} description={user.bio} />

      <div className="animate-fade-in-up rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6">
        <div className="flex flex-wrap items-center gap-5">
          <UserAvatar nickname={user.nickname} username={user.username} avatarUrl={user.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 font-display text-3xl">
              {user.nickname}
              {user.nickname === user.username ? null : (
                <span className="text-base font-normal text-muted-foreground">@{user.username}</span>
              )}
            </h1>
            {user.bio && <p className="mt-1 max-w-xl text-sm text-muted-foreground">{user.bio}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FaCalendarAlt className="h-3.5 w-3.5" /> Joined {formatDate(user.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <FaBook className="h-3.5 w-3.5" /> {formatBytes(user.totalBytes)} shared
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-center">
            {stats.map(({ label, value }) => (
              <div key={label}>
                <div className="text-xl font-bold text-accent">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="repos" className="mt-6">
        <TabsList>
          <TabsTrigger value="repos">
            <FaBook className="h-3.5 w-3.5" /> Repositories
          </TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          {isMe && (
            <TabsTrigger value="purchases">
              <FaShoppingBag className="h-3.5 w-3.5" /> Purchases
            </TabsTrigger>
          )}
          <TabsTrigger value="groups">
            <FaUsers className="h-3.5 w-3.5" /> Groups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="repos">
          {repos?.items?.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {repos.items.map((r, i) => (
                <RepositoryCard key={r.id} repo={r} index={i} />
              ))}
            </div>
          ) : (
            <Empty text="No repositories yet." />
          )}
        </TabsContent>

        <TabsContent value="favorites">
          {favorites?.items?.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.items.map((r, i) => (
                <RepositoryCard key={r.id} repo={r} index={i} />
              ))}
            </div>
          ) : (
            <Empty text="Nothing favorited yet." />
          )}
        </TabsContent>

        <TabsContent value="groups">
          {groups?.items?.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {groups.items.map((g, i) => (
                <GroupCard key={g.id} group={g} index={i} />
              ))}
            </div>
          ) : (
            <Empty text="Not a member of any groups yet." />
          )}
        </TabsContent>

        {isMe && (
          <TabsContent value="purchases">
            {purchases?.items?.length ? (
              <ul className="space-y-3">
                {purchases.items.map((p) => (
                  <li
                    key={p.id}
                    className="animate-fade-in-up flex flex-wrap items-center gap-4 rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <Link to={`/repos/${p.repo.id}`} className="truncate font-semibold hover:text-accent">
                        {p.repo.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Purchased {formatDate(p.purchasedAt)}
                      </p>
                    </div>
                    <Badge variant="success">Owned</Badge>
                    <div className="shrink-0 font-semibold tabular-nums text-accent">
                      {formatPrice(p.price, p.currency)}
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/repos/${p.repo.id}`}>Download</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="You haven't purchased any resources yet." />
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border/75 bg-surface/75 shadow-soft py-16 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
