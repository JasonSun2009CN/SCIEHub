import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { CURRENCIES, type Currency } from '@sciehub/shared';
import { requireAuth } from '../auth.js';
import {
  bumpTokenVersion,
  countAdmins,
  deleteUserWithFiles,
  getOrderById,
  getUserById,
  getUserPasswordHash,
  getWalletOverview,
  listPurchases,
  listUserLogins,
  listUserOrders,
  listWalletTransactions,
  payOrderWithWallet,
  refundOrder,
  setDeactivated,
} from '../db.js';

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  // ---- Login history & account security ---------------------------------

  app.get('/api/users/me/logins', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    return { items: listUserLogins(authUser.id, 30) };
  });

  app.post('/api/users/me/logins/revoke', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    bumpTokenVersion(authUser.id);
    return { ok: true };
  });

  app.post('/api/users/me/deactivate', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const user = getUserById(authUser.id);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.isAdmin && countAdmins() <= 1) {
      return reply
        .code(400)
        .send({ error: 'You are the only admin. Add or transfer to another admin first.' });
    }
    setDeactivated(authUser.id);
    return { ok: true };
  });

  app.delete('/api/users/me', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const body = (req.body ?? {}) as { password?: string };
    const user = getUserById(authUser.id);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const hash = getUserPasswordHash(authUser.id)!;
    if (!bcrypt.compareSync(body.password ?? '', hash)) {
      return reply.code(400).send({ error: 'Password is incorrect' });
    }
    if (user.isAdmin && countAdmins() <= 1) {
      return reply
        .code(400)
        .send({ error: 'You are the only admin. Add or transfer to another admin first.' });
    }
    deleteUserWithFiles(authUser.id);
    return { ok: true };
  });

  // ---- Wallet ------------------------------------------------------------

  app.get('/api/users/me/wallet', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    return getWalletOverview(authUser.id);
  });

  app.get('/api/users/me/wallet/transactions', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    const offset = Math.max(Number(q.offset) || 0, 0);
    const type =
      q.type === 'purchase' ||
      q.type === 'sale' ||
      q.type === 'refund' ||
      q.type === 'topup' ||
      q.type === 'withdraw'
        ? q.type
        : undefined;
    return listWalletTransactions({ userId: authUser.id, type, limit, offset });
  });

  // ---- Orders (both as buyer and seller) ---------------------------------

  app.get('/api/users/me/orders', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    const offset = Math.max(Number(q.offset) || 0, 0);
    const role = q.role === 'seller' ? 'seller' : 'buyer';
    const status =
      q.status === 'pending' ||
      q.status === 'paid' ||
      q.status === 'refunded' ||
      q.status === 'cancelled'
        ? q.status
        : undefined;
    return listUserOrders({
      userId: authUser.id,
      role,
      status,
      limit,
      offset,
    });
  });

  app.post('/api/users/me/orders/:orderId/pay', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { orderId } = req.params as { orderId: string };
    const order = getOrderById(orderId);
    if (!order) return reply.code(404).send({ error: 'Order not found' });
    if (order.buyerId !== authUser.id) {
      return reply.code(403).send({ error: 'Only the buyer can pay this order' });
    }
    if (order.status !== 'pending') {
      return reply.code(400).send({ error: `Order is already ${order.status}` });
    }
    const result = payOrderWithWallet(orderId, authUser.id);
    if (!result.success) {
      return reply.code(400).send({ error: result.error, code: result.code });
    }
    return { ok: true, order: result.order, purchase: result.purchase };
  });

  app.post('/api/users/me/orders/:orderId/refund', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { orderId } = req.params as { orderId: string };
    const order = getOrderById(orderId);
    if (!order) return reply.code(404).send({ error: 'Order not found' });
    if (order.sellerId !== authUser.id) {
      return reply.code(403).send({ error: 'Only the seller can initiate a refund. Contact admin otherwise.' });
    }
    if (order.status !== 'paid') {
      return reply.code(400).send({ error: `Only paid orders can be refunded (current: ${order.status})` });
    }
    const body = (req.body ?? {}) as { reason?: string };
    const result = refundOrder(orderId, authUser.id, body.reason ?? 'Seller-initiated refund');
    if (!result.success) {
      return reply.code(400).send({ error: result.error, code: result.code });
    }
    return { ok: true, order: result.order };
  });

  // ---- Purchases ---------------------------------------------------------

  app.get('/api/users/me/purchases', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    return { items: listPurchases(authUser.id) };
  });

  // ---- Top-up (simulated admin-gated from UI, endpoint kept for flow) ----
  // Note: the real admin endpoint is /api/admin/users/:id/topup. This is a
  // self-serve sandbox endpoint only enabled if the environment turns it on.
  if (process.env.SCIEHUB_ALLOW_SELF_TOPUP === '1') {
    app.post('/api/users/me/wallet/topup', async (req, reply) => {
      const authUser = requireAuth(req, reply);
      if (!authUser) return;
      const body = (req.body ?? {}) as { amount?: number; currency?: Currency };
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
        return reply.code(400).send({ error: 'amount must be > 0 and <= 10000' });
      }
      const currency = (body.currency ?? 'CNY') as Currency;
      if (!CURRENCIES.some((c) => c.code === currency)) {
        return reply.code(400).send({ error: 'Unsupported currency' });
      }
      // Re-use admin top-up helper (adminId = self is fine for sandbox)
      const { topUpWallet } = await import('../db.js');
      return topUpWallet(authUser.id, amount, currency);
    });
  }
}
