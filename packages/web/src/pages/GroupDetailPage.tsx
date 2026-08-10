import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaArrowLeft,
  FaFolder,
  FaSignOutAlt,
  FaSpinner,
  FaTrash,
  FaUserPlus,
  FaUsers,
} from 'react-icons/fa';
import { CATEGORIES, type Group, type GroupMember, type Resource } from '@sciehub/shared';
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
import { ResourceCard } from '@/components/generated/ResourceCard';
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

  const { data: membersData } = useQuery({
    queryKey: ['groupMembers', id],
    queryFn: () => api<{ items: GroupMember[] }>(`/groups/${id}/members`),
    enabled: Boolean(id),
  });

  const { data: resourcesData } = useQuery({
    queryKey: ['groupResources', id],
    queryFn: () => api<{ items: Resource[] }>(`/groups/${id}/resources`),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['group', id] });
    queryClient.invalidateQueries({ queryKey: ['groupMembers', id] });
    queryClient.invalidateQueries({ queryKey: ['groupResources', id] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    queryClient.invalidateQueries({ queryKey: ['myGroups'] });
  };

  const joinMutation = useMutation({
    mutationFn: () => api<{ group: Group }>(`/groups/${id}/join`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      toast('Joined the group', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not join', 'error'),
  });

  const leaveMutation = useMutation({
    mutationFn: () => api(`/groups/${id}/members`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      toast('Left the group', 'info');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not leave', 'error'),
  });

  // Settings (admin only)
  const group = data?.group;
  const isAdmin = Boolean(group?.isAdmin);
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
                  <FaFolder className="h-4 w-4 text-accent" /> {formatNumber(group.resourceCount)} resources
                </span>
                <span>Created {timeAgo(group.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {group.isMember ? (
              <Button variant="outline" onClick={onJoinToggle} disabled={leaveMutation.isPending}>
                {leaveMutation.isPending ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaSignOutAlt className="h-4 w-4" />}
                Leave
              </Button>
            ) : (
              <Button onClick={onJoinToggle} disabled={joinMutation.isPending}>
                {joinMutation.isPending ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaUserPlus className="h-4 w-4" />}
                Join group
              </Button>
            )}
          </div>
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
      <Tabs defaultValue="resources" className="mt-6">
        <TabsList>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          {isAdmin && <TabsTrigger value="settings">Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="resources">
          {resourcesData?.items?.length ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {resourcesData.items.map((r, i) => (
                <ResourceCard key={r.id} resource={r} index={i} showGroup={false} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface py-16 text-center text-sm text-muted-foreground">
              No resources shared here yet.
              {group.isMember && (
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link to="/upload">Upload one</Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members">
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
                    Deleting the group removes all its resources and memberships. This cannot be undone.
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
              “{group.name}” and all of its {group.resourceCount} resource{group.resourceCount === 1 ? '' : 's'} will be permanently removed.
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
