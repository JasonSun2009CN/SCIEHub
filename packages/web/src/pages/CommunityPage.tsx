import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaComments,
  FaPaperPlane,
  FaSignInAlt,
  FaSpinner,
  FaTrash,
  FaUserSecret,
} from 'react-icons/fa';
import type { CommunityPost } from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';
import { cn, timeAgo } from '@/lib/utils';

export function CommunityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['community'],
    queryFn: () => api<{ items: CommunityPost[] }>('/community?limit=100'),
    refetchInterval: 10_000,
  });

  const postMutation = useMutation({
    mutationFn: () =>
      api<{ post: CommunityPost }>('/community', {
        method: 'POST',
        json: { content: content.trim(), isAnonymous },
      }),
    onSuccess: () => {
      setContent('');
      setIsAnonymous(false);
      queryClient.invalidateQueries({ queryKey: ['community'] });
      toast('Posted to the community', 'success');
    },
    onError: (error) => toast(error instanceof Error ? error.message : 'Could not post', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/community/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community'] });
      toast('Post removed', 'info');
    },
    onError: (error) => toast(error instanceof Error ? error.message : 'Could not delete post', 'error'),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    postMutation.mutate();
  };

  return (
    <div className="section-shell max-w-5xl py-10 sm:py-14">
      <PageMeta
        title="The Commons"
        description="Ask questions, share wins and talk study with the SCIEHub community."
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Community</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl">The Commons</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            A shared noticeboard for questions, study tips, resource requests and small wins. Everyone
            can post — public and anonymous.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface/70 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Live board
        </span>
      </div>

      <div className="panel mt-8 p-5 sm:p-6">
        {user ? (
          <form onSubmit={onSubmit}>
            <div className="flex items-start gap-3">
              <UserAvatar
                nickname={user.nickname}
                username={user.username}
                avatarUrl={user.avatarUrl}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <Textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Ask a question, share a tip, or tell the community what you're working on…"
                  rows={3}
                  maxLength={2000}
                  className="resize-none"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
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
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground">{content.length}/2000</span>
                    <Button type="submit" size="sm" disabled={!content.trim() || postMutation.isPending}>
                      {postMutation.isPending ? (
                        <FaSpinner className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FaPaperPlane className="h-3.5 w-3.5" />
                      )}
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
                <FaComments className="h-4 w-4" />
              </span>
              <div>
                <p className="font-semibold">Join the conversation</p>
                <p className="text-sm text-muted-foreground">Sign in to post publicly or anonymously.</p>
              </div>
            </div>
            <Button asChild>
              <Link to="/auth" state={{ from: '/community' }}>
                <FaSignInAlt className="h-3.5 w-3.5" /> Sign in to post
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="panel p-8 text-center text-sm text-muted-foreground">Loading the board…</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="panel px-6 py-16 text-center">
            <FaComments className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-display text-2xl">The board is quiet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to say hello.</p>
          </div>
        ) : (
          data!.items.map((post) => {
            const canDelete = post.isOwn || user?.isAdmin;
            return (
              <article key={post.id} className="panel p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <UserAvatar
                    nickname={post.author.nickname}
                    username={post.author.username}
                    avatarUrl={post.author.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      {post.isAnonymous ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold">
                          <FaUserSecret className="h-3 w-3 text-accent" /> Anonymous
                        </span>
                      ) : (
                        <Link
                          to={`/users/${post.author.username}`}
                          className="text-sm font-semibold hover:text-accent"
                        >
                          {post.author.nickname}
                        </Link>
                      )}
                      <span className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                      {post.content}
                    </p>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(post.id)}
                      disabled={deleteMutation.isPending}
                      className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-error-subtle hover:text-error disabled:opacity-40"
                      aria-label="Delete post"
                    >
                      <FaTrash className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
