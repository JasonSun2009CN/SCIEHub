import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaArrowLeft,
  FaBook,
  FaCheck,
  FaSignOutAlt,
  FaSpinner,
  FaTrash,
  FaUserClock,
  FaUserPlus,
  FaUsers,
} from 'react-icons/fa';
import { CATEGORIES, type Group, type GroupMember, type GroupRequest, type Repository } from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { RepositoryCard } from '@/components/generated/RepositoryCard';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';
import { formatDate, formatNumber, timeAgo } from '@/lib/utils';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['group', id],
    queryFn: () => api<{ group: Group }>(`/groups/${id}`),
    enabled: Boolean(id),
  });

  const { data: reposData } = useQuery({
    queryKey: ['groupRepos', id],
    queryFn: () => api<{ items: Repository[] }>(`/groups/${id}/repos`),
    enabled: Boolean(id),
  });

  const { data: membersData } = useQuery({
    queryKey: ['groupMembers', id],
    queryFn: () => api<{ items: GroupMember[] }>(`/groups/${id}/members`),
    enabled: Boolean(id),
  });

  const group = data?.group;
  const isAdmin = Boolean(group?.isAdmin);

  const { data: membersRequests } = useQuery({
    queryKey: ['groupRequests', id],
    queryFn: () => api<{ items: GroupRequest[] }>(`/groups/${id}/requests`),
    enabled: Boolean(id) && isAdmin,
  });

  const pendingCount = (membersRequests?.items ?? []).filter((r) => r.status === 'pending').length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['group', id] });
    queryClient.invalidateQueries({ queryKey: ['groupRepos', id] });
    queryClient.invalidateQueries({ queryKey: ['groupMembers', id] });
    queryClient.invalidateQueries({ queryKey: ['groupRequests', id] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    queryClient.invalidateQueries({ queryKey: ['myGroups'] });
  };

  const joinMutation = useMutation({
    mutationFn: () => api<{ group: Group }>(`/groups/${id}/join`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      toast('Request sent — the creator will review it', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not request to join', 'error'),
  });

  const leaveMutation = useMutation({
    mutationFn: () => api(`/groups/${id}/members`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      toast('Left the group', 'info');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not leave', 'error'),
  });

  const decideMutation = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      api(`/groups/${id}/requests/${requestId}/${approve ? 'approve' : 'reject'}`, { method: 'POST' }),
    onSuccess: (_data, vars) => {
      invalidate();
      toast(vars.approve ? 'Request approved' : 'Request rejected', vars.approve ? 'success' : 'info');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not update request', 'error'),
  });

  // Settings (admin only)
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDesc(group.description);
      setCategoryId(group.categoryId);
    }
  }, [group?.id, group?.name, group?.description, group?.categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMutation = useMutation({
    mutationFn: () =>
      api<{ group: Group }>(`/groups/${id}`, {
        method: 'PATCH',
        json: { name: name.trim(), description: desc.trim(), categoryId },
      }),
    onSuccess: () => {
      invalidate();
      toast('Group updated', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not update', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api(`/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Group deleted', 'info');
      navigate('/groups');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not delete', 'error'),
  });

  const onJoinToggle = () => {
    if (!user) {
      navigate('/auth', { state: { from: window.location.pathname } });
      return;
    }
    if (group?.isMember) leaveMutation.mutate();
    else joinMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="mt-6 h-10 w-64" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <p className="text-lg font-semibold">Group not found</p>
        <Button variant="link" asChild className="mt-2">
          <Link to="/groups">Back to groups</Link>
        </Button>
      </div>
    );
  }

  const joinButton = group.isMember ? (
    <Button variant="outline" onClick={onJoinToggle} disabled={leaveMutation.isPending}>
      {leaveMutation.isPending ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaSignOutAlt className="h-4 w-4" />}
      Leave
    </Button>
  ) : group.joinStatus === 'pending' ? (
    <Button variant="secondary" disabled>
      <FaUserClock className="h-4 w-4" /> Request pending
    </Button>
  ) : (
    <Button onClick={onJoinToggle} disabled={joinMutation.isPending}>
      {joinMutation.isPending ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaUserPlus className="h-4 w-4" />}
      Request to join
    </Button>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageMeta title={group.name} description={group.description} />
      <Link to="/groups" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <FaArrowLeft className="h-3.5 w-3.5" /> Back to groups
      </Link>

      {/* Header */}
      <div className="animate-fade-in-up rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-subtle text-accent">
              <FaUsers className="h-7 w-7" aria-hidden />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{group.name}</h1>
                <Badge>{group.categoryName}</Badge>
                {group.isAdmin && <Badge variant="warning">Admin</Badge>}
              </div>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{group.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <FaUsers className="h-4 w-4 text-accent" /> {formatNumber(group.memberCount)} members
                </span>
                <span className="flex items-center gap-1.5">
                  <FaBook className="h-4 w-4 text-accent" /> {formatNumber(group.repoCount)} repositories
                </span>
                <span>Created {timeAgo(group.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">{joinButton}</div>
        </div>

        <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
          <UserAvatar nickname={group.creator.nickname} username={group.creator.username} avatarUrl={group.creator.avatarUrl} size="sm" />
          <span className="text-sm text-muted-foreground">Created by</span>
          <Link to={`/users/${group.creator.username}`} className="text-sm font-medium hover:text-accent">
            {group.creator.nickname}
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="repos" className="mt-6">
        <TabsList>
          <TabsTrigger value="repos">Repositories</TabsTrigger>
          <TabsTrigger value="members">
            Members
            {isAdmin && pendingCount > 0 && (
              <Badge variant="warning" className="ml-1">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          {isAdmin && <TabsTrigger value="settings">Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="repos">
          {reposData?.items?.length ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {reposData.items.map((r, i) => (
                <RepositoryCard key={r.id} repo={r} index={i} showGroups={false} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface py-16 text-center text-sm text-muted-foreground">
              No repositories shared here yet.
              {group.isMember && (
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link to="/upload">Share a repository</Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members">
          {/* Pending requests (admin only) */}
          {isAdmin && pendingCount > 0 && (
            <div className="mb-6 rounded-lg border border-border bg-surface p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FaUserClock className="h-4 w-4 text-warning" /> Join requests ({pendingCount})
              </h3>
              <ul className="mt-3 space-y-3">
                {(membersRequests?.items ?? [])
                  .filter((r) => r.status === 'pending')
                  .map((r) => (
                    <li key={r.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                      <UserAvatar nickname={r.user.nickname} username={r.user.username} avatarUrl={r.user.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link to={`/users/${r.user.username}`} className="block truncate text-sm font-medium hover:text-accent">
                          {r.user.nickname}
                        </Link>
                        <span className="text-xs text-muted-foreground">@{r.user.username} · {timeAgo(r.createdAt)}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decideMutation.mutate({ requestId: r.id, approve: true })}
                        disabled={decideMutation.isPending}
                      >
                        <FaCheck className="h-3.5 w-3.5 text-success" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => decideMutation.mutate({ requestId: r.id, approve: false })}
                        disabled={decideMutation.isPending}
                      >
                        Reject
                      </Button>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {membersData?.items.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 p-4">
                <UserAvatar nickname={m.user.nickname} username={m.user.username} avatarUrl={m.user.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <Link to={`/users/${m.user.username}`} className="block truncate font-medium hover:text-accent">
                    {m.user.nickname}
                  </Link>
                  <span className="text-xs text-muted-foreground">@{m.user.username}</span>
                </div>
                {m.role === 'admin' && <Badge variant="warning">Admin</Badge>}
                <span className="text-xs text-muted-foreground">Joined {formatDate(m.joinedAt)}</span>
              </li>
            ))}
          </ul>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="settings">
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                updateMutation.mutate();
              }}
              className="max-w-xl space-y-5 rounded-lg border border-border bg-surface p-6"
            >
              <div className="space-y-2">
                <Label htmlFor="edit-name">Group name</Label>
                <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <FaSpinner className="h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-md border border-error bg-error-subtle p-4">
                <div>
                  <p className="text-sm font-semibold">Danger zone</p>
                  <p className="text-xs text-muted-foreground">
                    Deleting the group removes its shared repositories' links and all memberships.
                  </p>
                </div>
                <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                  <FaTrash className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </form>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this group?</DialogTitle>
            <DialogDescription>
              “{group.name}” and all of its memberships will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <FaSpinner className="h-4 w-4 animate-spin" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
