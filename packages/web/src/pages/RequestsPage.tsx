import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaCheck,
  FaEnvelope,
  FaInbox,
  FaPaperPlane,
  FaSpinner,
  FaTimes,
} from 'react-icons/fa';
import {
  formatPrice,
  type PurchaseRequest,
  type PurchaseRequestStatus,
} from '@sciehub/shared';
import { api } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAvatar } from '@/components/generated/UserAvatar';
import { useToast } from '@/components/common/Toast';
import { timeAgo } from '@/lib/utils';

const STATUS_STYLES: Record<PurchaseRequestStatus, string> = {
  pending: 'warning',
  contacted: 'default',
  completed: 'success',
  declined: 'error',
  cancelled: 'secondary',
};

function statusBadge(status: PurchaseRequestStatus) {
  return <Badge variant={STATUS_STYLES[status] as 'warning'}>{status}</Badge>;
}

export function RequestsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['requests'],
    queryFn: () => api<{ incoming: PurchaseRequest[]; outgoing: PurchaseRequest[] }>('/requests'),
    refetchInterval: 15_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PurchaseRequestStatus }) =>
      api(`/requests/${id}`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast('Request updated', 'success');
    },
    onError: (error) => toast(error instanceof Error ? error.message : 'Could not update request', 'error'),
  });

  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];

  return (
    <div className="section-shell py-10 sm:py-14">
      <PageMeta
        title="Purchase requests"
        description="Contact-based purchase requests for paid SCIEHub resources."
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Off-platform exchange</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl">Purchase requests</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            SCIEHub introduces buyers and sellers but does not process payments. Sellers see the
            buyer&apos;s email and arrange the exchange directly.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/paid">Browse paid resources</Link>
        </Button>
      </div>

      <Tabs defaultValue="incoming" className="mt-8">
        <TabsList>
          <TabsTrigger value="incoming">
            Incoming {incoming.length > 0 && <span className="text-accent">({incoming.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="outgoing">
            Sent {outgoing.length > 0 && <span className="text-accent">({outgoing.length})</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming">
          {isLoading ? (
            <Loading />
          ) : incoming.length === 0 ? (
            <Empty
              icon={<FaInbox className="h-8 w-8" />}
              title="No incoming requests"
              text="When someone requests one of your paid resources, their email will appear here."
            />
          ) : (
            <div className="space-y-3">
              {incoming.map((request) => (
                <article key={request.id} className="panel p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <UserAvatar
                      nickname={request.buyer.nickname}
                      username={request.buyer.username}
                      avatarUrl={request.buyer.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/users/${request.buyer.username}`}
                          className="font-semibold hover:text-accent"
                        >
                          {request.buyer.nickname}
                        </Link>
                        <span className="text-xs text-muted-foreground">@{request.buyer.username}</span>
                        {statusBadge(request.status)}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {timeAgo(request.createdAt)}
                        </span>
                      </div>
                      <Link
                        to={`/repos/${request.repoId}`}
                        className="mt-1 block text-sm font-medium text-accent hover:underline"
                      >
                        {request.repo.name}
                      </Link>
                      {request.buyerEmail && (
                        <a
                          href={`mailto:${request.buyerEmail}`}
                          className="mt-2 inline-flex items-center gap-2 rounded-xl border border-accent/25 bg-accent-subtle px-3 py-2 text-sm font-medium text-accent transition-colors hover:border-accent/50"
                        >
                          <FaEnvelope className="h-3.5 w-3.5" />
                          {request.buyerEmail}
                        </a>
                      )}
                      {request.message && (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {request.message}
                        </p>
                      )}
                    </div>
                    <span className="ml-auto font-display text-lg tabular-nums text-warning">
                      {formatPrice(request.repo.price, request.repo.currency)}
                    </span>
                  </div>

                  {(request.status === 'pending' || request.status === 'contacted') && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => updateMutation.mutate({ id: request.id, status: 'contacted' })}
                        disabled={updateMutation.isPending}
                      >
                        <FaPaperPlane className="h-3.5 w-3.5" /> Mark contacted
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: request.id, status: 'completed' })}
                        disabled={updateMutation.isPending}
                      >
                        <FaCheck className="h-3.5 w-3.5" /> Completed
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateMutation.mutate({ id: request.id, status: 'declined' })}
                        disabled={updateMutation.isPending}
                      >
                        <FaTimes className="h-3.5 w-3.5" /> Decline
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="outgoing">
          {isLoading ? (
            <Loading />
          ) : outgoing.length === 0 ? (
            <Empty
              icon={<FaPaperPlane className="h-8 w-8" />}
              title="No sent requests"
              text="Open a paid resource and request contact with the seller. You'll see the status here."
            />
          ) : (
            <div className="space-y-3">
              {outgoing.map((request) => (
                <article key={request.id} className="panel p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <UserAvatar
                      nickname={request.seller.nickname}
                      username={request.seller.username}
                      avatarUrl={request.seller.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{request.seller.nickname}</span>
                        {statusBadge(request.status)}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {timeAgo(request.createdAt)}
                        </span>
                      </div>
                      <Link
                        to={`/repos/${request.repoId}`}
                        className="mt-1 block text-sm font-medium text-accent hover:underline"
                      >
                        {request.repo.name}
                      </Link>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {request.status === 'pending' &&
                          'Waiting for the seller to see your email and respond.'}
                        {request.status === 'contacted' &&
                          'The seller has seen your request and should contact you by email.'}
                        {request.status === 'completed' && 'The seller marked this exchange completed.'}
                        {request.status === 'declined' && 'The seller declined this request.'}
                        {request.status === 'cancelled' && 'You cancelled this request.'}
                      </p>
                      {request.message && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                          {request.message}
                        </p>
                      )}
                    </div>
                    <span className="ml-auto font-display text-lg tabular-nums text-warning">
                      {formatPrice(request.repo.price, request.repo.currency)}
                    </span>
                  </div>
                  {(request.status === 'pending' || request.status === 'contacted') && (
                    <div className="mt-4 border-t border-border/60 pt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateMutation.mutate({ id: request.id, status: 'cancelled' })}
                        disabled={updateMutation.isPending}
                      >
                        <FaTimes className="h-3.5 w-3.5" /> Cancel request
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Loading() {
  return (
    <div className="panel mt-4 flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
      <FaSpinner className="h-4 w-4 animate-spin" /> Loading requests…
    </div>
  );
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="panel mt-4 px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground">
        {icon}
      </div>
      <p className="mt-4 font-display text-2xl">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
