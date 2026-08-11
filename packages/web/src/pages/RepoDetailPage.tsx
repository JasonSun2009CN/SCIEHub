import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaArrowLeft,
  FaCheck,
  FaCloudUploadAlt,
  FaComment,
  FaDownload,
  FaEye,
  FaFlag,
  FaFolder,
  FaHeart,
  FaLink,
  FaPaperclip,
  FaSpinner,
  FaTrash,
} from 'react-icons/fa';
import { formatBytes, type Comment, type Group, type RepoFile, type Repository } from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { FileTypeIcon } from '@/components/generated/FileTypeIcon';
import { ReportDialog } from '@/components/common/ReportDialog';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';
import { cn, formatDate, formatNumber, timeAgo } from '@/lib/utils';

export function RepoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [shareGroup, setShareGroup] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['repo', id],
    queryFn: () => api<{ repo: Repository; files: RepoFile[]; related: Repository[] }>(`/repos/${id}`),
    enabled: Boolean(id),
  });

  const { data: commentsData } = useQuery({
    queryKey: ['repoComments', id],
    queryFn: () => api<{ items: Comment[] }>(`/repos/${id}/comments`),
    enabled: Boolean(id),
  });

  const { data: myGroups } = useQuery({
    queryKey: ['myGroups', user?.username],
    queryFn: () => api<{ items: Group[] }>(`/users/${user!.username}/groups`),
    enabled: Boolean(user),
  });

  const invalidateRepo = () => {
    queryClient.invalidateQueries({ queryKey: ['repo', id] });
    queryClient.invalidateQueries({ queryKey: ['repos'] });
  };

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      const target = !data?.repo.isFavorite;
      return api<{ favorited: boolean; repo: Repository }>(`/repos/${id}/favorite`, {
        method: target ? 'POST' : 'DELETE',
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['repo', id], (old?: { repo: Repository; files: RepoFile[]; related: Repository[] }) =>
        old ? { ...old, repo: result.repo } : old,
      );
      toast(result.favorited ? 'Added to favorites' : 'Removed from favorites', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not update favorite', 'error'),
  });

  const commentMutation = useMutation({
    mutationFn: () => api(`/repos/${id}/comments`, { method: 'POST', json: { content: comment } }),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['repoComments', id] });
      invalidateRepo();
      toast('Comment posted', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not post comment', 'error'),
  });

  const shareMutation = useMutation({
    mutationFn: () => api(`/repos/${id}/groups`, { method: 'POST', json: { groupId: shareGroup } }),
    onSuccess: () => {
      setShareGroup('');
      invalidateRepo();
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast('Shared to group', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not share', 'error'),
  });

  const unshareMutation = useMutation({
    mutationFn: (groupId: string) => api(`/repos/${id}/groups/${groupId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateRepo();
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast('Removed from group', 'info');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api(`/repos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Repository deleted', 'info');
      navigate('/feed');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not delete', 'error'),
  });

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('Link copied to clipboard', 'success');
    } catch {
      toast('Copy this URL from the address bar', 'info');
    }
  };

  const onFavorite = () => {
    if (!user) {
      toast('Sign in to favorite repositories', 'info');
      navigate('/auth', { state: { from: window.location.pathname } });
      return;
    }
    favoriteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-4 lg:col-span-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <p className="text-lg font-semibold">Repository not found</p>
        <Button variant="link" asChild className="mt-2">
          <Link to="/feed">Back to feed</Link>
        </Button>
      </div>
    );
  }

  const { repo, files, related } = data;
  const isOwner = repo.isOwner;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageMeta title={repo.name} description={repo.description} />
      <Link to="/feed" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <FaArrowLeft className="h-3.5 w-3.5" /> Back to feed
      </Link>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Main */}
        <div className="lg:col-span-8">
          {/* Header */}
          <div className="animate-fade-in-up rounded-lg border border-border bg-surface p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                <FaFolder className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{repo.categoryName}</Badge>
                  {repo.tags.slice(0, 3).map((t) => (
                    <Badge key={t} variant="secondary">#{t}</Badge>
                  ))}
                  <span className="ml-auto text-xs text-muted-foreground">{formatBytes(repo.totalBytes)} total</span>
                </div>
                <h1 className="mt-2 text-2xl font-bold leading-tight">{repo.name}</h1>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <UserAvatar nickname={repo.owner.nickname} username={repo.owner.username} avatarUrl={repo.owner.avatarUrl} size="md" />
              <div className="text-sm">
                <Link to={`/users/${repo.owner.username}`} className="font-medium hover:text-accent">
                  {repo.owner.nickname}
                </Link>
                <div className="text-xs text-muted-foreground">@{repo.owner.username}</div>
              </div>
              <span className="ml-auto text-xs text-muted-foreground">Created {timeAgo(repo.createdAt)}</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" onClick={onFavorite} disabled={favoriteMutation.isPending}>
                {favoriteMutation.isPending ? (
                  <FaSpinner className="h-4 w-4 animate-spin" />
                ) : repo.isFavorite ? (
                  <FaHeart className="h-4 w-4 text-error" />
                ) : (
                  <FaHeart className="h-4 w-4" />
                )}
                {repo.isFavorite ? 'Favorited' : 'Favorite'}
              </Button>
              <Button variant="ghost" onClick={onShare}>
                <FaLink className="h-4 w-4" /> Share
              </Button>
              {isOwner && (
                <Button asChild>
                  <Link to={`/upload?repo=${repo.id}`}>
                    <FaCloudUploadAlt className="h-4 w-4" /> Upload files
                  </Link>
                </Button>
              )}
              {isOwner && (
                <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
                  <FaTrash className="h-4 w-4 text-error" /> Delete
                </Button>
              )}
              <span className="ml-auto">
                <ReportDialog
                  targetType="repo"
                  targetId={repo.id}
                  trigger={
                    <Button variant="ghost" size="sm">
                      <FaFlag className="h-3.5 w-3.5" /> Report
                    </Button>
                  }
                />
              </span>
            </div>

            <div className="mt-5 flex items-center gap-5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><FaFolder className="h-4 w-4" /> {repo.fileCount} files</span>
              <span className="flex items-center gap-1.5"><FaEye className="h-4 w-4" /> {formatNumber(repo.viewCount)} views</span>
              <span className="flex items-center gap-1.5"><FaDownload className="h-4 w-4" /> {formatNumber(repo.downloadCount)} downloads</span>
              <span className="flex items-center gap-1.5"><FaComment className="h-4 w-4" /> {formatNumber(repo.commentCount)} comments</span>
              <span className="flex items-center gap-1.5"><FaHeart className="h-4 w-4" /> {formatNumber(repo.favoriteCount)} favorites</span>
            </div>
          </div>

          {/* Description + shared groups */}
          <div className="animate-fade-in-up mt-6 rounded-lg border border-border bg-surface p-6" style={{ animationDelay: '60ms' }}>
            <h2 className="font-semibold">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {repo.description || 'No description provided.'}
            </p>

            {repo.groupIds.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold">Shared to</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {repo.groupIds.map((groupId, i) => (
                    <span key={groupId} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 py-0.5 pl-3 pr-1 text-xs">
                      <Link to={`/groups/${groupId}`} className="hover:text-accent">{repo.groupNames[i]}</Link>
                      {isOwner && (
                        <button
                          onClick={() => unshareMutation.mutate(groupId)}
                          aria-label={`Remove from ${repo.groupNames[i]}`}
                          className="cursor-pointer rounded-full p-0.5 text-muted-foreground hover:text-error"
                        >
                          <FaTrash className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isOwner && (myGroups?.items?.length ?? 0) > 0 && (
              <div className="mt-4 flex max-w-sm items-center gap-2">
                <Select value={shareGroup} onValueChange={setShareGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="Share to a group…" />
                  </SelectTrigger>
                  <SelectContent>
                    {myGroups!.items
                      .filter((g) => !repo.groupIds.includes(g.id))
                      .map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="secondary" onClick={() => shareMutation.mutate()} disabled={!shareGroup}>
                  Share
                </Button>
              </div>
            )}
          </div>

          {/* Files */}
          <div className="animate-fade-in-up mt-6 rounded-lg border border-border bg-surface p-6" style={{ animationDelay: '120ms' }}>
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <FaPaperclip className="h-4 w-4 text-accent" /> Files ({files.length})
            </h2>
            {files.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-surface-2 py-12 text-center text-sm text-muted-foreground">
                No files yet.
                {isOwner && (
                  <div className="mt-3">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/upload?repo=${repo.id}`}>Upload the first file</Link>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {files.map((file) => (
                  <li key={file.id} className="flex items-center gap-3 py-3">
                    <FileTypeIcon type={file.fileType} className="h-6 w-6 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.fileSize} · {formatNumber(file.downloadCount)} downloads
                      </p>
                    </div>
                    {file.fileType === 'image' && (
                      <img src={file.filePath} alt={file.title} className="h-10 w-14 shrink-0 rounded border border-border object-cover" loading="lazy" />
                    )}
                    <a
                      href={`/api/files/${file.id}/download`}
                      className="shrink-0 rounded-md border border-border p-2 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                      aria-label={`Download ${file.title}`}
                    >
                      <FaDownload className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Comments */}
          <div className="animate-fade-in-up mt-6 rounded-lg border border-border bg-surface p-6" style={{ animationDelay: '180ms' }}>
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <FaComment className="h-4 w-4 text-accent" /> Comments ({commentsData?.items.length ?? 0})
            </h2>

            {user ? (
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (comment.trim()) commentMutation.mutate();
                }}
                className="mb-6 space-y-3"
              >
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ask a question or leave feedback…"
                  rows={3}
                  className="bg-surface"
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={!comment.trim() || commentMutation.isPending}>
                    {commentMutation.isPending && <FaSpinner className="h-3.5 w-3.5 animate-spin" />}
                    Post comment
                  </Button>
                </div>
              </form>
            ) : (
              <p className="mb-6 rounded-md bg-surface-2 p-3 text-sm text-muted-foreground">
                <Link to="/auth" state={{ from: window.location.pathname }} className="text-accent hover:underline">
                  Sign in
                </Link>{' '}
                to join the discussion.
              </p>
            )}

            <ul className="space-y-5">
              {commentsData?.items.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <UserAvatar nickname={c.user.nickname} username={c.user.username} avatarUrl={c.user.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Link to={`/users/${c.user.username}`} className="font-medium hover:text-accent">
                        {c.user.nickname}
                      </Link>
                      <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                      <span className="ml-auto">
                        <ReportDialog
                          targetType="comment"
                          targetId={c.id}
                          trigger={
                            <button className="cursor-pointer text-xs text-muted-foreground hover:text-error" aria-label="Report comment">
                              <FaFlag className="h-3 w-3" />
                            </button>
                          }
                        />
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.content}</p>
                  </div>
                </li>
              ))}
              {(commentsData?.items?.length ?? 0) === 0 && (
                <li className="py-4 text-center text-sm text-muted-foreground">No comments yet — be the first!</li>
              )}
            </ul>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:col-span-4">
          <div className="animate-fade-in-up rounded-lg border border-border bg-surface p-5" style={{ animationDelay: '240ms' }}>
            <h3 className="text-sm font-semibold">Owner</h3>
            <div className="mt-3 flex items-center gap-3">
              <UserAvatar nickname={repo.owner.nickname} username={repo.owner.username} avatarUrl={repo.owner.avatarUrl} size="lg" />
              <div className="min-w-0">
                <Link to={`/users/${repo.owner.username}`} className="block truncate font-semibold hover:text-accent">
                  {repo.owner.nickname}
                </Link>
                <span className="text-xs text-muted-foreground">@{repo.owner.username}</span>
              </div>
            </div>
            {repo.owner.bio && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{repo.owner.bio}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
              <div>
                <div className="font-semibold">{repo.owner.repoCount}</div>
                <div className="text-xs text-muted-foreground">Repos</div>
              </div>
              <div>
                <div className="font-semibold">{repo.owner.fileCount}</div>
                <div className="text-xs text-muted-foreground">Files</div>
              </div>
              <div>
                <div className="font-semibold">{formatBytes(repo.owner.totalBytes)}</div>
                <div className="text-xs text-muted-foreground">Shared</div>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild className="mt-4 w-full">
              <Link to={`/users/${repo.owner.username}`}>View profile</Link>
            </Button>
          </div>

          {related.length > 0 && (
            <div className="animate-fade-in-up rounded-lg border border-border bg-surface p-5" style={{ animationDelay: '300ms' }}>
              <h3 className="mb-3 text-sm font-semibold">Related repositories</h3>
              <ul className="space-y-3">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/repos/${r.id}`} className="group flex items-start gap-2.5">
                      <FaFolder className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span className="min-w-0">
                        <span className={cn('line-clamp-1 block text-sm group-hover:text-accent')}>{r.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.fileCount} files · {formatNumber(r.downloadCount)} downloads
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="animate-fade-in-up rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground" style={{ animationDelay: '360ms' }}>
            <div className="flex items-center gap-1.5 text-success">
              <FaCheck className="h-3.5 w-3.5" /> Last updated {formatDate(repo.createdAt)}
            </div>
            <p className="mt-2 text-xs">
              Respect the owner's work — read the <Link to="/conduct" className="text-accent hover:underline">community guidelines</Link> before downloading.
            </p>
          </div>
        </aside>
      </div>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this repository?</DialogTitle>
            <DialogDescription>
              “{repo.name}” and all {repo.fileCount} of its file{repo.fileCount === 1 ? '' : 's'} will be permanently removed.
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
