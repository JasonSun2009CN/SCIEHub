import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaComment,
  FaHeart,
  FaImage,
  FaPaperPlane,
  FaSpinner,
  FaTimes,
  FaTrash,
  FaUserSecret,
} from 'react-icons/fa';
import type { PlazaComment, PlazaPost } from '@sciehub/shared';
import { api, uploadFiles } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';
import { cn, formatNumber, timeAgo } from '@/lib/utils';

const PAGE_SIZE = 20;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

function ImageGrid({ images }: { images: PlazaPost['images'] }) {
  if (images.length === 0) return null;
  if (images.length === 1) {
    return (
      <a href={images[0].url} target="_blank" rel="noreferrer" className="mt-3 block">
        <img
          src={images[0].url}
          alt="Plaza post"
          loading="lazy"
          className="max-h-[520px] w-full rounded-2xl border border-border/70 object-cover"
        />
      </a>
    );
  }
  return (
    <div className={cn('mt-3 grid gap-1.5 overflow-hidden rounded-2xl', images.length === 2 ? 'grid-cols-2' : 'grid-cols-2')}>
      {images.map((image) => (
        <a key={image.id} href={image.url} target="_blank" rel="noreferrer" className="block">
          <img
            src={image.url}
            alt="Plaza post"
            loading="lazy"
            className="aspect-square w-full border border-border/70 object-cover"
          />
        </a>
      ))}
    </div>
  );
}

function CommentThread({ post }: { post: PlazaPost }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['plaza-comments', post.id],
    queryFn: () => api<{ items: PlazaComment[] }>(`/plaza/${post.id}/comments`),
  });

  const commentMutation = useMutation({
    mutationFn: () =>
      api<{ comment: PlazaComment }>(`/plaza/${post.id}/comments`, {
        method: 'POST',
        json: { content: text.trim(), isAnonymous },
      }),
    onSuccess: () => {
      setText('');
      setIsAnonymous(false);
      queryClient.invalidateQueries({ queryKey: ['plaza-comments', post.id] });
      queryClient.invalidateQueries({ queryKey: ['plaza'] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : 'Could not comment', 'error'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api(`/plaza/${post.id}/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaza-comments', post.id] });
      queryClient.invalidateQueries({ queryKey: ['plaza'] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : 'Could not delete comment', 'error'),
  });

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      {isLoading ? (
        <p className="py-3 text-xs text-muted-foreground">Loading comments…</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {data!.items.map((comment) => (
            <li key={comment.id} className="flex gap-2.5">
              <UserAvatar
                nickname={comment.author.nickname}
                username={comment.author.username}
                avatarUrl={comment.author.avatarUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {comment.isAnonymous ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold">
                      <FaUserSecret className="h-2.5 w-2.5 text-accent" /> Anonymous
                    </span>
                  ) : (
                    <Link to={`/users/${comment.author.username}`} className="text-xs font-semibold hover:text-accent">
                      {comment.author.nickname}
                    </Link>
                  )}
                  <span className="text-[10px] text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                  {(comment.isOwn || user?.isAdmin) && (
                    <button
                      type="button"
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                      className="ml-auto cursor-pointer text-[10px] text-muted-foreground hover:text-error"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{comment.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {user ? (
        <form
          className="mt-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (text.trim()) commentMutation.mutate();
          }}
        >
          <div className="flex items-start gap-2">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write a comment…"
              rows={2}
              maxLength={1000}
              className="min-h-[62px] resize-none"
            />
            <Button type="submit" size="sm" disabled={!text.trim() || commentMutation.isPending}>
              {commentMutation.isPending ? <FaSpinner className="h-3.5 w-3.5 animate-spin" /> : <FaPaperPlane className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setIsAnonymous((value) => !value)}
            className={cn(
              'mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition-colors',
              isAnonymous ? 'bg-accent-subtle text-accent' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FaUserSecret className="h-2.5 w-2.5" />
            {isAnonymous ? 'Anonymous comment' : 'Comment as @' + user.username}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          <Link to="/auth" state={{ from: '/plaza' }} className="text-accent hover:underline">
            Sign in
          </Link>{' '}
          to comment.
        </p>
      )}
    </div>
  );
}

function PostCard({ post }: { post: PlazaPost }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);

  const likeMutation = useMutation({
    mutationFn: () => api(`/plaza/${post.id}/like`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plaza'] }),
    onError: (error) => toast(error instanceof Error ? error.message : 'Could not like post', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api(`/plaza/${post.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaza'] });
      toast('Post deleted', 'info');
    },
    onError: (error) => toast(error instanceof Error ? error.message : 'Could not delete post', 'error'),
  });

  return (
    <article className="panel p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <UserAvatar
          nickname={post.author.nickname}
          username={post.author.username}
          avatarUrl={post.author.avatarUrl}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {post.isAnonymous ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold">
                <FaUserSecret className="h-3 w-3 text-accent" /> Anonymous
              </span>
            ) : (
              <Link to={`/users/${post.author.username}`} className="text-sm font-semibold hover:text-accent">
                {post.author.nickname}
              </Link>
            )}
            {!post.isAnonymous && (
              <span className="text-xs text-muted-foreground">@{post.author.username}</span>
            )}
            <span className="text-xs text-muted-foreground">· {timeAgo(post.createdAt)}</span>
            {(post.isOwn || user?.isAdmin) && (
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="ml-auto cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error-subtle hover:text-error disabled:opacity-40"
                aria-label="Delete post"
              >
                <FaTrash className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {post.content && (
            <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-6 text-foreground/90">{post.content}</p>
          )}
          <ImageGrid images={post.images} />

          <div className="mt-3 flex items-center gap-5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => (user ? setShowComments((value) => !value) : navigate('/auth', { state: { from: '/plaza' } }))}
              className="inline-flex cursor-pointer items-center gap-1.5 transition-colors hover:text-accent"
            >
              <FaComment className="h-3.5 w-3.5" /> {formatNumber(post.commentCount)}
            </button>
            <button
              type="button"
              onClick={() => (user ? likeMutation.mutate() : navigate('/auth', { state: { from: '/plaza' } }))}
              disabled={likeMutation.isPending}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 transition-colors hover:text-error disabled:opacity-50',
                post.likedByMe && 'text-error',
              )}
            >
              <FaHeart className={cn('h-3.5 w-3.5', post.likedByMe && 'fill-current')} />
              {formatNumber(post.likeCount)}
            </button>
          </div>
          {showComments && <CommentThread post={post} />}
        </div>
      </div>
    </article>
  );
}

export function PlazaPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['plaza'],
    queryFn: () => api<{ items: PlazaPost[] }>(`/plaza?limit=50&offset=0`),
    refetchInterval: 20_000,
  });

  const items = data?.items ?? [];

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const postMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('content', content.trim());
      form.append('isAnonymous', String(isAnonymous));
      files.forEach((file) => form.append('images', file, file.name));
      return uploadFiles('/api/plaza', form, () => undefined);
    },
    onSuccess: () => {
      setContent('');
      setIsAnonymous(false);
      setFiles([]);
      queryClient.invalidateQueries({ queryKey: ['plaza'] });
      toast('Posted to the Plaza', 'success');
    },
    onError: (error) => toast(error instanceof Error ? error.message : 'Could not post', 'error'),
  });

  const addImages = (incoming: File[]) => {
    const images = incoming.filter((file) => ALLOWED_IMAGE_TYPES.has(file.type));
    if (images.length !== incoming.length) {
      toast('Only JPG, PNG, WebP, GIF or AVIF images are supported — no video yet', 'error');
    }
    const next = [...files, ...images].slice(0, MAX_IMAGES);
    if (files.length + images.length > MAX_IMAGES) {
      toast(`Attach at most ${MAX_IMAGES} images`, 'error');
    }
    for (const image of images) {
      if (image.size > MAX_IMAGE_BYTES) {
        toast('Each image must be 10MB or smaller', 'error');
        return;
      }
    }
    setFiles(next);
  };

  const disabled = !user || postMutation.isPending || (!content.trim() && files.length === 0);

  return (
    <div className="section-shell max-w-5xl py-10 sm:py-14">
      <PageMeta
        title="Plaza — campus wall"
        description="Post campus updates, study wins, questions and photos on the SCIEHub Plaza."
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Campus wall</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl">Plaza</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            What&apos;s happening around SCIE. Share a thought, a photo, or a question — text and
            images only for now.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface/70 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live wall
        </span>
      </div>

      <div className="panel mt-8 p-5 sm:p-6">
        {user ? (
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (!disabled) postMutation.mutate();
            }}
          >
            <div className="flex items-start gap-3">
              <UserAvatar nickname={user.nickname} username={user.username} avatarUrl={user.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <Textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="What's happening on campus?"
                  rows={3}
                  maxLength={2000}
                  className="resize-none"
                />
                {previews.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {previews.map((preview, index) => (
                      <div key={preview} className="relative overflow-hidden rounded-xl border border-border/70">
                        <img src={preview} alt="" className="aspect-square w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                          className="absolute right-1 top-1 cursor-pointer rounded-full bg-background/80 p-1 text-foreground shadow-sm"
                          aria-label="Remove image"
                        >
                          <FaTimes className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        addImages(Array.from(event.target.files ?? []));
                        event.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
                    >
                      <FaImage className="h-3.5 w-3.5" /> Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAnonymous((value) => !value)}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                        isAnonymous
                          ? 'border-accent/40 bg-accent-subtle text-accent'
                          : 'border-border/70 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <FaUserSecret className="h-3 w-3" />
                      {isAnonymous ? 'Posting anonymously' : 'Post as @' + user.username}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground">{content.length}/2000</span>
                    <Button type="submit" size="sm" disabled={disabled}>
                      {postMutation.isPending ? <FaSpinner className="h-3.5 w-3.5 animate-spin" /> : <FaPaperPlane className="h-3.5 w-3.5" />}
                      Post
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                <FaImage className="h-4 w-4" />
              </span>
              <div>
                <p className="font-semibold">Join the campus wall</p>
                <p className="text-sm text-muted-foreground">Sign in to post text and images.</p>
              </div>
            </div>
            <Button asChild>
              <Link to="/auth" state={{ from: '/plaza' }}>
                Sign in to post
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="panel p-10 text-center text-sm text-muted-foreground">Loading the Plaza…</div>
        ) : items.length === 0 ? (
          <div className="panel px-6 py-16 text-center">
            <FaImage className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-display text-2xl">The wall is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">Post the first photo or update.</p>
          </div>
        ) : (
          items.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>

    </div>
  );
}
