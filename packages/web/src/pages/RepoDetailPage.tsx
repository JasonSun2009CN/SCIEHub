import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaArrowLeft,
  FaCheck,
  FaCloudUploadAlt,
  FaComment,
  FaDownload,
  FaEdit,
  FaEye,
  FaFlag,
  FaFolder,
  FaHeart,
  FaLink,
  FaPaperclip,
  FaSpinner,
  FaUserSecret,
  FaStar,
  FaTrash,
} from 'react-icons/fa';
import {
  CATEGORIES,
  LEVELS,
  RESOURCE_TYPES,
  formatBytes,
  type Comment,
  type EducationLevel,
  type Group,
  type ResourceType,
  type RepoFile,
  type Repository,
  type Review,
} from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { TagInput } from '@/components/common/TagInput';
import { ReportDialog } from '@/components/common/ReportDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';
import { cn, formatDate, formatNumber, timeAgo } from '@/lib/utils';

interface RepoDetailData {
  repo: Repository;
  files: RepoFile[];
  related: Repository[];
  reviews: Review[];
  purchaseState: { isOwner: boolean; isPurchased: boolean; canReview: boolean };
}

export function RepoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [shareGroup, setShareGroup] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLevel, setEditLevel] = useState<EducationLevel>('other');
  const [editCategory, setEditCategory] = useState('');
  const [editResourceType, setEditResourceType] = useState<ResourceType>('notes');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editIsAnonymous, setEditIsAnonymous] = useState(false);
  const [editPreviewImageUrl, setEditPreviewImageUrl] = useState('');
  const [fileToDelete, setFileToDelete] = useState<RepoFile | null>(null);
  const [previewFile, setPreviewFile] = useState<RepoFile | null>(null);
  // Review form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['repo', id],
    queryFn: () => api<RepoDetailData>(`/repos/${id}`),
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

  const updateMutation = useMutation({
    mutationFn: () =>
      api(`/repos/${id}`, {
        method: 'PATCH',
        json: {
          name: editName.trim(),
          description: editDesc.trim(),
          levelId: editLevel,
          categoryId: editCategory,
          resourceType: editResourceType,
          tags: editTags.join(','),
          isAnonymous: editIsAnonymous,
          previewImageUrl: editPreviewImageUrl.trim() || null,
        },
      }),
    onSuccess: () => {
      setEditOpen(false);
      invalidateRepo();
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['repos'] });
      toast('Repository updated', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not update repository', 'error'),
  });

  const fileDeleteMutation = useMutation({
    mutationFn: (fileId: string) => api(`/files/${fileId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setFileToDelete(null);
      invalidateRepo();
      queryClient.invalidateQueries({ queryKey: ['home'] });
      toast('File deleted', 'info');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not delete file', 'error'),
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: { rating: number; title: string; content: string }) => {
      const body = { rating: payload.rating, title: payload.title, content: payload.content };
      return editingReview
        ? api<{ review: Review }>(`/repos/${id}/reviews/${editingReview.id}`, { method: 'PATCH', json: body })
        : api<{ review: Review }>(`/repos/${id}/reviews`, { method: 'POST', json: body });
    },
    onSuccess: () => {
      setEditingReview(null);
      setReviewRating(5);
      setReviewTitle('');
      setReviewContent('');
      invalidateRepo();
      queryClient.invalidateQueries({ queryKey: ['reviews', id] });
      toast(editingReview ? 'Review updated' : 'Review submitted', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not submit review', 'error'),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId: string) => api(`/repos/${id}/reviews/${reviewId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateRepo();
      queryClient.invalidateQueries({ queryKey: ['reviews', id] });
      toast('Review deleted', 'info');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not delete review', 'error'),
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

  const { repo, files, related, reviews = [], purchaseState } = data;
  const isOwner = repo.isOwner ?? purchaseState?.isOwner ?? false;
  const canReview = purchaseState?.canReview ?? false;

  const openEdit = () => {
    setEditName(repo.name);
    setEditDesc(repo.description);
    setEditLevel(repo.levelId);
    setEditCategory(repo.categoryId);
    setEditResourceType(repo.resourceType);
    setEditTags(repo.tags);
    setEditIsAnonymous(repo.isAnonymous);
    setEditPreviewImageUrl(repo.previewImageUrl ?? '');
    setEditOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageMeta title={repo.name} description={repo.description} />
      <Link to="/library" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <FaArrowLeft className="h-3.5 w-3.5" /> Back to library
      </Link>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Main */}
        <div className="lg:col-span-8">
          {/* Header */}
          <div className="animate-fade-in-up rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                <FaFolder className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{repo.levelName}</Badge>
                  <Badge variant="secondary">{repo.categoryName}</Badge>
                  <Badge variant="outline">{repo.resourceTypeName}</Badge>
                  <Badge variant="success">Free download</Badge>
                  {repo.tags.slice(0, 3).map((t) => (
                    <Badge key={t} variant="secondary">#{t}</Badge>
                  ))}
                  <span className="ml-auto text-xs text-muted-foreground">{formatBytes(repo.totalBytes)} total</span>
                </div>
                <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{repo.name}</h1>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <UserAvatar nickname={repo.owner.nickname} username={repo.owner.username} avatarUrl={repo.owner.avatarUrl} size="md" />
              <div className="text-sm">
                {repo.isAnonymous ? (
                  <>
                    <span className="flex items-center gap-1.5 font-medium">
                      <FaUserSecret className="h-3.5 w-3.5 text-accent" /> Anonymous
                    </span>
                    <div className="text-xs text-muted-foreground">Publisher identity hidden</div>
                  </>
                ) : (
                  <>
                    <Link to={`/users/${repo.owner.username}`} className="font-medium hover:text-accent">
                      {repo.owner.nickname}
                    </Link>
                    <div className="text-xs text-muted-foreground">@{repo.owner.username}</div>
                  </>
                )}
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
                <Button variant="outline" onClick={openEdit}>
                  <FaEdit className="h-4 w-4" /> Edit
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
          <div className="animate-fade-in-up mt-6 rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6" style={{ animationDelay: '60ms' }}>
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
          <div className="animate-fade-in-up mt-6 rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6" style={{ animationDelay: '120ms' }}>
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <FaPaperclip className="h-4 w-4 text-accent" /> Files ({formatNumber(repo.fileCount)})
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
                    {(file.fileType === 'pdf' || file.fileType === 'image') && (
                      <button
                        type="button"
                        onClick={() => setPreviewFile(file)}
                        className="shrink-0 cursor-pointer rounded-md border border-border p-2 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                        aria-label={`Preview ${file.title}`}
                        title="Preview in browser"
                      >
                        <FaEye className="h-4 w-4" />
                      </button>
                    )}
                    <a
                      href={`/api/files/${file.id}/download`}
                      className="shrink-0 rounded-md border border-border p-2 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                      aria-label={`Download ${file.title}`}
                    >
                      <FaDownload className="h-4 w-4" />
                    </a>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setFileToDelete(file)}
                        className="shrink-0 cursor-pointer rounded-md border border-border p-2 text-muted-foreground transition-colors hover:border-error/50 hover:text-error"
                        aria-label={`Delete ${file.title}`}
                        title="Delete this file"
                      >
                        <FaTrash className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 rounded-xl border border-warning/25 bg-warning-subtle px-3.5 py-2.5 text-xs leading-5 text-muted-foreground">
              <span className="font-semibold text-foreground">Original work only.</span> If your own
              notes were uploaded here without your permission, contact the administrator to have
              them removed.
            </p>
          </div>

          {/* Comments */}
          <div className="animate-fade-in-up mt-6 rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6" style={{ animationDelay: '180ms' }}>
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

          {/* Reviews */}
          <div className="animate-fade-in-up mt-6 rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6" style={{ animationDelay: '200ms' }}>
            <h2 className="mb-4 flex flex-wrap items-center gap-2 font-semibold">
              <FaStar className="h-4 w-4 text-warning" aria-hidden /> Reviews ({reviews.length})
              {repo.averageRating > 0 && (
                <span className="flex items-center gap-1 text-sm font-semibold text-warning">
                  <FaStar className="h-3.5 w-3.5 fill-warning/80" aria-hidden />
                  {repo.averageRating.toFixed(1)}
                </span>
              )}
            </h2>

            {canReview ? (
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (reviewContent.trim()) {
                    reviewMutation.mutate({
                      rating: reviewRating,
                      title: reviewTitle.trim(),
                      content: reviewContent.trim(),
                    });
                  }
                }}
                className="mb-6 rounded-md bg-surface-2 p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium">
                    {editingReview ? 'Edit your review' : 'Rate this resource'}
                  </span>
                  <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setReviewRating(n)}
                        aria-label={`${n} star${n === 1 ? '' : 's'}`}
                        className={cn(
                          'cursor-pointer text-xl transition-colors',
                          n <= reviewRating ? 'text-warning' : 'text-muted-foreground/40 hover:text-warning/60',
                        )}
                      >
                        <FaStar className="h-5 w-5" />
                      </button>
                    ))}
                  </div>
                  {editingReview && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingReview(null);
                        setReviewRating(5);
                        setReviewTitle('');
                        setReviewContent('');
                      }}
                      className="ml-auto cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
                <Input
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="Short headline (optional)"
                  className="mt-3 bg-surface"
                />
                <Textarea
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  placeholder="What did you think? Was it accurate, clear and useful?"
                  rows={3}
                  className="mt-2 bg-surface"
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!reviewContent.trim() || reviewMutation.isPending}
                  >
                    {reviewMutation.isPending && <FaSpinner className="h-3.5 w-3.5 animate-spin" />}
                    {editingReview ? 'Save review' : 'Submit review'}
                  </Button>
                </div>
              </form>
            ) : !user ? (
              <p className="mb-6 rounded-md bg-surface-2 p-3 text-sm text-muted-foreground">
                <Link to="/auth" state={{ from: window.location.pathname }} className="text-accent hover:underline">
                  Sign in
                </Link>{' '}
                to rate this resource.
              </p>
            ) : null}

            {reviews.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No reviews yet — share your experience!
              </p>
            ) : (
              <ul className="space-y-4">
                {reviews.map((review) => {
                  const isMine = user?.id === review.userId;
                  return (
                    <li key={review.id} className="flex gap-3">
                      <UserAvatar
                        nickname={review.user.nickname}
                        username={review.user.username}
                        avatarUrl={review.user.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/users/${review.user.username}`} className="text-sm font-medium hover:text-accent">
                            {review.user.nickname}
                          </Link>
                          <span className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <FaStar
                                key={n}
                                className={cn(
                                  'h-3 w-3',
                                  n <= review.rating ? 'text-warning' : 'text-muted-foreground/30',
                                )}
                                aria-hidden
                              />
                            ))}
                          </span>
                          <span className="text-xs text-muted-foreground">{timeAgo(review.createdAt)}</span>
                          {isMine && (
                            <span className="ml-auto flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingReview(review);
                                  setReviewRating(review.rating);
                                  setReviewTitle(review.title);
                                  setReviewContent(review.content);
                                }}
                                className="cursor-pointer text-xs text-muted-foreground hover:text-accent"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteReviewMutation.mutate(review.id)}
                                className="cursor-pointer text-xs text-muted-foreground hover:text-error"
                              >
                                Delete
                              </button>
                            </span>
                          )}
                        </div>
                        {review.title && <p className="mt-1 text-sm font-semibold">{review.title}</p>}
                        {review.content && (
                          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{review.content}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:col-span-4">
          {/* Free download */}
          <div
            className="animate-fade-in-up rounded-2xl border border-success/25 bg-success-subtle p-5"
            style={{ animationDelay: '200ms' }}
          >
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <FaDownload className="h-4 w-4 text-success" aria-hidden /> Free download
            </h3>
            <p className="mt-2 text-3xl font-extrabold text-success tabular-nums">Free</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              No payment, no account required — download any of the {formatNumber(repo.fileCount)}{' '}
              files directly.
            </p>
          </div>

          <div className="animate-fade-in-up rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-5" style={{ animationDelay: '240ms' }}>
            <h3 className="text-sm font-semibold">Publisher</h3>
            <div className="mt-3 flex items-center gap-3">
              <UserAvatar nickname={repo.owner.nickname} username={repo.owner.username} avatarUrl={repo.owner.avatarUrl} size="lg" />
              <div className="min-w-0">
                {repo.isAnonymous ? (
                  <>
                    <span className="flex items-center gap-1.5 font-semibold">
                      <FaUserSecret className="h-3.5 w-3.5 text-accent" /> Anonymous
                    </span>
                    <span className="text-xs text-muted-foreground">Identity hidden by publisher</span>
                  </>
                ) : (
                  <>
                    <Link to={`/users/${repo.owner.username}`} className="block truncate font-semibold hover:text-accent">
                      {repo.owner.nickname}
                    </Link>
                    <span className="text-xs text-muted-foreground">@{repo.owner.username}</span>
                  </>
                )}
              </div>
            </div>
            {repo.isAnonymous ? (
              <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs leading-5 text-muted-foreground">
                This resource was published anonymously. Free downloads are still available, and paid
                requests are forwarded to the verified account owner.
              </p>
            ) : (
              <>
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
              </>
            )}
          </div>

          {related.length > 0 && (
            <div className="animate-fade-in-up rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-5" style={{ animationDelay: '300ms' }}>
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

          <div className="animate-fade-in-up rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-5 text-sm text-muted-foreground" style={{ animationDelay: '360ms' }}>
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

      {/* Edit repository */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit repository</DialogTitle>
            <DialogDescription>Update the name, level, subject, resource type, visibility or tags.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-repo-name">Name *</Label>
              <Input
                id="edit-repo-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Repository name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-repo-desc">Description</Label>
              <Textarea
                id="edit-repo-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                placeholder="What does this repository cover?"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={editLevel} onValueChange={(v) => setEditLevel(v as EducationLevel)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a level" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((level) => (
                      <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Resource type</Label>
                <Select value={editResourceType} onValueChange={(v) => setEditResourceType(v as ResourceType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a resource type" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-repo-tags">Tags</Label>
                <TagInput
                  id="edit-repo-tags"
                  value={editTags}
                  onChange={setEditTags}
                  placeholder="Type a tag and press Enter"
                />
              </div>
            </div>

            <Separator />
            <button
              type="button"
              onClick={() => setEditIsAnonymous((value) => !value)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors',
                editIsAnonymous
                  ? 'border-accent/45 bg-accent-subtle text-foreground'
                  : 'border-border/70 bg-surface text-muted-foreground hover:text-foreground',
              )}
            >
              <FaUserSecret className="h-4 w-4 shrink-0 text-accent" />
              <span className="flex-1">
                <span className="font-semibold">Publish anonymously</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Hide your username on this listing.
                </span>
              </span>
              <span
                className={cn(
                  'flex h-5 w-9 items-center rounded-full p-0.5 transition-colors',
                  editIsAnonymous ? 'bg-accent' : 'bg-border',
                )}
              >
                <span
                  className={cn(
                    'h-4 w-4 rounded-full bg-background transition-transform',
                    editIsAnonymous && 'translate-x-4',
                  )}
                />
              </span>
            </button>
            <div className="space-y-2">
              <Label htmlFor="edit-repo-preview">Preview image URL</Label>
              <Input
                id="edit-repo-preview"
                value={editPreviewImageUrl}
                onChange={(e) => setEditPreviewImageUrl(e.target.value)}
                placeholder="https://… or /uploads/….png (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!editName.trim() || !editCategory || updateMutation.isPending}
            >
              {updateMutation.isPending && <FaSpinner className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewFile)} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="flex h-[88vh] max-h-[88vh] max-w-5xl flex-col gap-3 p-0">
          <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4 pr-12">
            <DialogTitle className="truncate text-base">{previewFile?.title}</DialogTitle>
            <DialogDescription>
              Previewed directly from SCIEHub. Use the download button for the original file.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden bg-surface-2">
            {previewFile?.fileType === 'pdf' ? (
              <iframe
                key={previewFile.id}
                src={`/api/files/${previewFile.id}/preview#toolbar=1&navpanes=0`}
                title={previewFile.title}
                className="h-full w-full border-0"
              />
            ) : previewFile?.fileType === 'image' ? (
              <div className="flex h-full items-center justify-center overflow-auto p-4">
                <img
                  src={`/api/files/${previewFile.id}/preview`}
                  alt={previewFile.title}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : null}
          </div>
          {previewFile && (
            <DialogFooter className="shrink-0 border-t border-border/70 px-5 py-3">
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/files/${previewFile.id}/download`}>
                  <FaDownload className="h-3.5 w-3.5" /> Download
                </a>
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(fileToDelete)}
        onOpenChange={(open) => !open && setFileToDelete(null)}
        title={`Delete “${fileToDelete?.title ?? 'file'}”?`}
        description="This removes the file from the repository and deletes it from storage. This cannot be undone."
        confirmLabel="Delete file"
        busy={fileDeleteMutation.isPending}
        onConfirm={() => fileToDelete && fileDeleteMutation.mutate(fileToDelete.id)}
      />
    </div>
  );
}
