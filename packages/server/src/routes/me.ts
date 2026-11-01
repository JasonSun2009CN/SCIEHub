import type { Hono } from 'hono';
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
  refundOrder,
  setDeactivated,
  topUpWallet,
} from '../db.js';
import { verifyPassword } from '../password.js';
import { readJson } from '../http.js';
import { getConfig } from '../runtime.js';
import type { AppEnv } from '../types.js';

export function registerMeRoutes(app: Hono<AppEnv>): void {
  // ---- Login history & account security ---------------------------------

  app.get('/api/users/me/logins', async (c) => {
    const authUser = await requireAuth(c);
    return c.json({ items: await listUserLogins(authUser.id, 30) });
  });

  app.post('/api/users/me/logins/revoke', async (c) => {
    const authUser = await requireAuth(c);
    await bumpTokenVersion(authUser.id);
    return c.json({ ok: true });
  });

  app.post('/api/users/me/deactivate', async (c) => {
    const authUser = await requireAuth(c);
    const user = await getUserById(authUser.id);
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (user.isAdmin && (await countAdmins()) <= 1) {
      return c.json(
        { error: 'You are the only admin. Add or transfer to another admin first.' },
        400,
      );
    }
    await setDeactivated(authUser.id);
    return c.json({ ok: true });
  });

  app.delete('/api/users/me', async (c) => {
    const authUser = await requireAuth(c);
    const body = await readJson<{ password?: string }>(c);
    const user = await getUserById(authUser.id);
    if (!user) return c.json({ error: 'User not found' }, 404);
    const hash = await getUserPasswordHash(authUser.id);
    if (!hash || !(await verifyPassword(body.password ?? '', hash))) {
      return c.json({ error: 'Password is incorrect' }, 400);
    }
    if (user.isAdmin && (await countAdmins()) <= 1) {
      return c.json(
        { error: 'You are the only admin. Add or transfer to another admin first.' },
        400,
      );
    }
    await deleteUserWithFiles(authUser.id);
    return c.json({ ok: true });
  });

  // ---- Wallet ------------------------------------------------------------

  app.get('/api/users/me/wallet', async (c) => {
    const authUser = await requireAuth(c);
    return c.json(await getWalletOverview(authUser.id));
  });

  app.get('/api/users/me/wallet/transactions', async (c) => {
    const authUser = await requireAuth(c);
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);
    const offset = Math.max(Number(c.req.query('offset')) || 0, 0);
    const rawType = c.req.query('type');
    const type =
      rawType === 'purchase' ||
      rawType === 'sale' ||
      rawType === 'refund' ||
      rawType === 'topup' ||
      rawType === 'withdraw'
        ? rawType
        : undefined;
    return c.json(await listWalletTransactions({ userId: authUser.id, type, limit, offset }));
  });

  // ---- Orders (both as buyer and seller) ---------------------------------

  app.get('/api/users/me/orders', async (c) => {
    const authUser = await requireAuth(c);
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);
    const offset = Math.max(Number(c.req.query('offset')) || 0, 0);
    const role = c.req.query('role') === 'seller' ? 'seller' : 'buyer';
    const rawStatus = c.req.query('status');
    const status =
      rawStatus === 'pending' ||
      rawStatus === 'paid' ||
      rawStatus === 'refunded' ||
      rawStatus === 'cancelled'
        ? rawStatus
        : undefined;
    return c.json(await listUserOrders({ userId: authUser.id, role, status, limit, offset }));
  });

  app.post('/api/users/me/orders/:orderId/pay', async (c) => {
    await requireAuth(c);
    return c.json({ error: 'Internal payments are disabled. Contact the seller directly.' }, 410);
  });

  app.post('/api/users/me/orders/:orderId/refund', async (c) => {
    const authUser = await requireAuth(c);
    const { orderId } = c.req.param();
    const order = await getOrderById(orderId);
    if (!order) return c.json({ error: 'Order not found' }, 404);
    if (order.sellerId !== authUser.id) {
      return c.json(
        { error: 'Only the seller can initiate a refund. Contact admin otherwise.' },
        403,
      );
    }
    if (order.status !== 'paid') {
      return c.json({ error: `Only paid orders can be refunded (current: ${order.status})` }, 400);
    }
    const body = await readJson<{ reason?: string }>(c);
    const result = await refundOrder(orderId, authUser.id, body.reason ?? 'Seller-initiated refund');
    if (!result.success) {
      return c.json({ error: result.error, code: result.code }, 400);
    }
    return c.json({ ok: true, order: result.order });
  });

  // ---- Purchases ---------------------------------------------------------

  app.get('/api/users/me/purchases', async (c) => {
    const authUser = await requireAuth(c);
    return c.json({ items: await listPurchases(authUser.id) });
  });

  // ---- Sandbox top-up (disabled unless SCIEHUB_ALLOW_SELF_TOPUP=1) --------

  app.post('/api/users/me/wallet/topup', async (c) => {
    const authUser = await requireAuth(c);
    if (!getConfig().allowSelfTopup) return c.json({ error: 'Not found' }, 404);
    const body = await readJson<{ amount?: number; currency?: Currency }>(c);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      return c.json({ error: 'amount must be > 0 and <= 10000' }, 400);
    }
    const currency = (body.currency ?? 'CNY') as Currency;
    if (!CURRENCIES.some((item) => item.code === currency)) {
      return c.json({ error: 'Unsupported currency' }, 400);
    }
    return c.json(await topUpWallet(authUser.id, amount, currency));
  });
}
