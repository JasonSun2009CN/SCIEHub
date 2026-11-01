import type { Hono } from 'hono';
import type { PurchaseRequestStatus } from '@sciehub/shared';
import { requireAuth, requirePermission } from '../auth.js';
import {
  createPurchaseRequest,
  getPurchaseRequestById,
  getPurchaseRequestForBuyer,
  getRepoById,
  getUserEmail,
  hasPendingPurchaseRequest,
  listPurchaseRequests,
  updatePurchaseRequestStatus,
} from '../db.js';
import { readJson } from '../http.js';
import type { AppEnv } from '../types.js';

const SELLER_STATUSES: PurchaseRequestStatus[] = ['contacted', 'completed', 'declined'];

export function registerRequestRoutes(app: Hono<AppEnv>): void {
  app.get('/api/requests', async (c) => {
    const authUser = await requireAuth(c);
    return c.json(await listPurchaseRequests(authUser.id));
  });

  app.get('/api/repos/:id/purchase-request', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    return c.json({ request: await getPurchaseRequestForBuyer(id, authUser.id) });
  });

  app.post('/api/repos/:id/purchase-request', async (c) => {
    const authUser = await requirePermission(c, 'canBuy');
    const { id } = c.req.param();
    const repo = await getRepoById(id, null, false);
    if (!repo) return c.json({ error: 'Repository not found' }, 404);
    if (repo.pricingType !== 'paid') {
      return c.json({ error: 'This resource is free — no purchase request is needed' }, 400);
    }
    if (repo.ownerId === authUser.id) {
      return c.json({ error: 'You cannot request your own resource' }, 400);
    }
    if (await hasPendingPurchaseRequest(id, authUser.id)) {
      return c.json({ error: 'You already have an open request for this resource' }, 409);
    }
    const email = await getUserEmail(authUser.id);
    if (!email) return c.json({ error: 'Add an email to your account first' }, 400);
    const body = await readJson<{ message?: string }>(c);
    const message = (body.message ?? '').trim().slice(0, 1000);
    const request = await createPurchaseRequest({
      repoId: id,
      buyerId: authUser.id,
      sellerId: repo.ownerId,
      buyerEmail: email,
      message,
    });
    return c.json({ request }, 201);
  });

  app.patch('/api/requests/:id', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    const request = await getPurchaseRequestById(id, false);
    if (!request) return c.json({ error: 'Request not found' }, 404);

    const body = await readJson<{ status?: PurchaseRequestStatus }>(c);
    const status = body.status;
    if (!status) return c.json({ error: 'status is required' }, 400);

    if (request.sellerId === authUser.id && SELLER_STATUSES.includes(status)) {
      await updatePurchaseRequestStatus(id, status);
      return c.json({ ok: true, request: await getPurchaseRequestById(id, true) });
    }

    if (request.buyerId === authUser.id && status === 'cancelled') {
      await updatePurchaseRequestStatus(id, status);
      return c.json({ ok: true, request: await getPurchaseRequestById(id, false) });
    }

    return c.json({ error: 'You cannot set that status for this request' }, 403);
  });
}
