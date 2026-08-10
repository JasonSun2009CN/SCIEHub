import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaArrowLeft,
  FaCheck,
  FaComment,
  FaDownload,
  FaEye,
  FaHeart,
  FaPaperclip,
  FaShareAlt,
  FaSpinner,
} from 'react-icons/fa';
import type { Comment, Resource } from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { FileTypeIcon } from '@/components/generated/FileTypeIcon';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';
import { cn, formatDate, formatNumber, timeAgo } from '@/lib/utils';

export function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['resource', id],
    queryFn: () => api<{ resource: Resource; related: Resource[] }>(`/resources/${id}`),
    enabled: Boolean(id),
  });

  const { data: commentsData } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => api<{ items: Comment[] }>(`/resources/${id}/comments`),
    enabled: Boolean(id),
  });

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      const target = !data?.resource.isFavorite;
      return api<{ favorited: boolean; resource: Resource }>(`/resources/${id}/favorite`, {
        method: target ? 'POST' : 'DELETE',
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['resource', id], (old?: { resource: Resource; related: Resource[] }) =>
        old ? { ...old, resource: result.resource } : old,
      );
      toast(result.favorited ? 'Added to favorites' : 'Removed from favorites', 'success');
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Could not update favorite', 'error');
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => api(`/resources/${id}/comments`, { method: 'POST', json: { content: comment } }),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['resource', id] });
      toast('Comment posted', 'success');
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Could not post comment', 'error');
    },
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
      toast('Sign in to favorite resources', 'info');
      navigate('/auth', { state: { from: window.location.pathname } });
      return;
    }
    favoriteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="lg:col-span-4 space-y-4">
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
        <p className="text-lg font-semibold">Resource not found</p>
        <Button variant="link" asChild className="mt-2">
          <Link to="/feed">Back to feed</Link>
        </Button>
      </div>
    );
  }

  const { resource, related } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageMeta title={resource.title} description={resource.description} />
      <Link to="/feed" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <FaArrowLeft className="h-3.5 w-3.5" /> Back to feed
      </Link>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Main */}
        <div className="lg:col-span-8">
          <div className="animate-fade-in-up rounded-lg border border-border bg-surface p-6">
            <div className="flex items-start gap-4">
              <FileTypeIcon type={resource.fileType} className="mt-1 h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{resource.categoryName}</Badge>
                  {resource.groupId && (
                    <Link to={`/groups/${resource.groupId}`}>
                      <Badge variant="secondary" className="cursor-pointer hover:text-accent">{resource.groupName}</Badge>
                    </Link>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{resource.fileSize}</span>
                </div>
                <h1 className="mt-2 text-2xl font-bold leading-tight">{resource.title}</h1>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <UserAvatar
                nickname={resource.uploader.nickname}
                username={resource.uploader.username}
                avatarUrl={resource.uploader.avatarUrl}
                size="md"
              />
              <div className="text-sm">
                <Link to={`/users/${resource.uploader.username}`} className="font-medium hover:text-accent">
                  {resource.uploader.nickname}
                </Link>
                <div className="text-xs text-muted-foreground">@{resource.uploader.username}</div>
              </div>
              <span className="ml-auto text-xs text-muted-foreground">Uploaded {timeAgo(resource.createdAt)}</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <a href={`/api/resources/${resource.id}/download`}>
                  <FaDownload className="h-4 w-4" /> Download
                </a>
              </Button>
              <Button variant="outline" onClick={onFavorite} disabled={favoriteMutation.isPending}>
                {favoriteMutation.isPending ? (
                  <FaSpinner className="h-4 w-4 animate-spin" />
                ) : resource.isFavorite ? (
                  <FaHeart className="h-4 w-4 text-error" />
                ) : (
                  <FaHeart className="h-4 w-4" />
                )}
                {resource.isFavorite ? 'Favorited' : 'Favorite'}
              </Button>
              <Button variant="ghost" onClick={onShare}>
                <FaShareAlt className="h-4 w-4" /> Share
              </Button>
            </div>

            <div className="mt-5 flex items-center gap-5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><FaEye className="h-4 w-4" /> {formatNumber(resource.viewCount)} views</span>
              <span className="flex items-center gap-1.5"><FaDownload className="h-4 w-4" /> {formatNumber(resource.downloadCount)} downloads</span>
              <span className="flex items-center gap-1.5"><FaComment className="h-4 w-4" /> {formatNumber(resource.commentCount)} comments</span>
            </div>
          </div>

          {/* Description + preview */}
          <div className="animate-fade-in-up mt-6 rounded-lg border border-border bg-surface p-6" style={{ animationDelay: '60ms' }}>
            <h2 className="font-semibold">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {resource.description || 'No description provided.'}
            </p>

            {resource.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {resource.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">#{tag}</Badge>
                ))}
              </div>
            )}

            <Separator className="my-6" />

            <h2 className="mb-3 font-semibold">Preview</h2>
            {resource.fileType === 'image' ? (
              <div className="overflow-hidden rounded-md border border-border bg-surface-2">
                <img
                  src={resource.filePath}
                  alt={`Preview of ${resource.title}`}
                  className="mx-auto max-h-[480px] w-auto object-contain"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-surface-2 py-14 text-center">
                <FileTypeIcon type={resource.fileType} className="h-12 w-12" />
                <p className="text-sm text-muted-foreground">
                  Preview isn't available for this file type.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/resources/${resource.id}/download`}>
                    <FaDownload className="h-3.5 w-3.5" /> Download to view
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="animate-fade-in-up mt-6 rounded-lg border border-border bg-surface p-6" style={{ animationDelay: '120ms' }}>
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
                  placeholder="Share your thoughts or ask a question…"
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
          <div className="animate-fade-in-up rounded-lg border border-border bg-surface p-5" style={{ animationDelay: '180ms' }}>
            <h3 className="text-sm font-semibold">Uploader</h3>
            <div className="mt-3 flex items-center gap-3">
              <UserAvatar
                nickname={resource.uploader.nickname}
                username={resource.uploader.username}
                avatarUrl={resource.uploader.avatarUrl}
                size="lg"
              />
              <div className="min-w-0">
                <Link to={`/users/${resource.uploader.username}`} className="block truncate font-semibold hover:text-accent">
                  {resource.uploader.nickname}
                </Link>
                <span className="text-xs text-muted-foreground">@{resource.uploader.username}</span>
              </div>
            </div>
            {resource.uploader.bio && (
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{resource.uploader.bio}</p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
              <div>
                <div className="font-semibold">{resource.uploader.uploadCount}</div>
                <div className="text-xs text-muted-foreground">Uploads</div>
              </div>
              <div>
                <div className="font-semibold">{resource.uploader.groupCount}</div>
                <div className="text-xs text-muted-foreground">Groups</div>
              </div>
              <div>
                <div className="font-semibold">{formatNumber(resource.uploader.totalDownloads)}</div>
                <div className="text-xs text-muted-foreground">Downloads</div>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild className="mt-4 w-full">
              <Link to={`/users/${resource.uploader.username}`}>View profile</Link>
            </Button>
          </div>

          {related.length > 0 && (
            <div className="animate-fade-in-up rounded-lg border border-border bg-surface p-5" style={{ animationDelay: '240ms' }}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <FaPaperclip className="h-3.5 w-3.5 text-accent" /> Related resources
              </h3>
              <ul className="space-y-3">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/resources/${r.id}`} className="group flex items-start gap-2.5">
                      <FileTypeIcon type={r.fileType} className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className={cn('line-clamp-1 block text-sm group-hover:text-accent')}>{r.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatNumber(r.downloadCount)} downloads
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="animate-fade-in-up rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center gap-1.5 text-success">
              <FaCheck className="h-3.5 w-3.5" /> Last verified {formatDate(resource.createdAt)}
            </div>
            <p className="mt-2 text-xs">Respect the uploader's work — share it responsibly.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
