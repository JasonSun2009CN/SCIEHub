import type { Hono } from 'hono';
import { CURRENCIES, type Currency } from '@sciehub/shared';
import { requireAdmin } from '../auth.js';
import {
  countAdmins,
  deleteComment,
  deleteFileById,
  deleteRepo,
  deleteUserWithFiles,
  getAdminOverview,
  getOrderById,
  getRepoById,
  getUserById,
  listAdminUsers,
  listAllOrders,
  listRepos,
  listReports,
  refundOrder,
  setReportStatus,
  setUserAdmin,
  setUserSuspended,
  topUpWallet,
} from '../db.js';
import { readJson } from '../http.js';
import type { AppEnv } from '../types.js';

export function registerAdminRoutes(app: Hono<AppEnv>): void {
  // ---- Overview ----------------------------------------------------------

  app.get('/api/admin/overview', async (c) => {
    await requireAdmin(c);
    const overview = await getAdminOverview();
    const recent = await listReports({ offset: 0, limit: 8 });
    const orders = await listAllOrders({ offset: 0, limit: 5 });
    return c.json({
      ...overview,
      recentReports: recent.items,
      recentOrders: orders.items,
    });
  });

  // ---- Orders ------------------------------------------------------------

  app.get('/api/admin/orders', async (c) => {
    await requireAdmin(c);
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);
    const offset = Math.max(Number(c.req.query('offset')) || 0, 0);
    const rawStatus = c.req.query('status');
    const status =
      rawStatus === 'pending' ||
      rawStatus === 'paid' ||
      rawStatus === 'refunded' ||
      rawStatus === 'cancelled'
        ? rawStatus
        : undefined;
    return c.json(await listAllOrders({ status, offset, limit, search: c.req.query('search') }));
  });

  app.post('/api/admin/orders/:id/refund', async (c) => {
    const admin = await requireAdmin(c);
    const { id } = c.req.param();
    const order = await getOrderById(id);
    if (!order) return c.json({ error: 'Order not found' }, 404);
    if (order.status !== 'paid') {
      return c.json({ error: `Only paid orders can be refunded (current: ${order.status})` }, 400);
    }
    const body = await readJson<{ reason?: string }>(c);
    const result = await refundOrder(id, admin.id, body.reason ?? 'Admin-initiated refund');
    if (!result.success) {
      return c.json({ error: result.error, code: result.code }, 400);
    }
    return c.json({ ok: true, order: result.order });
  });

  // ---- Reports -----------------------------------------------------------

  app.get('/api/admin/reports', async (c) => {
    await requireAdmin(c);
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);
    const offset = Math.max(Number(c.req.query('offset')) || 0, 0);
    const rawStatus = c.req.query('status');
    const status = rawStatus === 'open' || rawStatus === 'resolved' ? rawStatus : undefined;
    return c.json(await listReports({ status, offset, limit }));
  });

  app.patch('/api/admin/reports/:id', async (c) => {
    await requireAdmin(c);
    const { id } = c.req.param();
    const body = await readJson<{ status?: string }>(c);
    if (body.status !== 'open' && body.status !== 'resolved') {
      return c.json({ error: 'status must be "open" or "resolved"' }, 400);
    }
    await setReportStatus(id, body.status);
    return c.json({ ok: true });
  });

  // ---- Users -------------------------------------------------------------

  app.get('/api/admin/users', async (c) => {
    await requireAdmin(c);
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);
    const offset = Math.max(Number(c.req.query('offset')) || 0, 0);
    return c.json(await listAdminUsers({ search: c.req.query('search'), offset, limit }));
  });

  app.patch('/api/admin/users/:id', async (c) => {
    await requireAdmin(c);
    const { id } = c.req.param();
    const body = await readJson<{ isAdmin?: boolean; isSuspended?: boolean }>(c);
    if (typeof body.isAdmin === 'boolean' && !body.isAdmin) {
      const target = await getUserById(id);
      if (target?.isAdmin && (await countAdmins()) <= 1) {
        return c.json({ error: 'Cannot remove the last admin' }, 400);
      }
    }
    if (typeof body.isAdmin === 'boolean') await setUserAdmin(id, body.isAdmin);
    if (typeof body.isSuspended === 'boolean') await setUserSuspended(id, body.isSuspended);
    return c.json({ ok: true });
  });

  app.post('/api/admin/users/:id/topup', async (c) => {
    await requireAdmin(c);
    const { id } = c.req.param();
    if (!(await getUserById(id))) return c.json({ error: 'User not found' }, 404);
    const body = await readJson<{ amount?: number; currency?: Currency }>(c);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return c.json({ error: 'amount must be > 0 and <= 1,000,000' }, 400);
    }
    const currency = (body.currency ?? 'CNY') as Currency;
    if (!CURRENCIES.some((item) => item.code === currency)) {
      return c.json({ error: 'Unsupported currency' }, 400);
    }
    return c.json(await topUpWallet(id, amount, currency));
  });

  app.delete('/api/admin/users/:id', async (c) => {
    await requireAdmin(c);
    const { id } = c.req.param();
    const target = await getUserById(id);
    if (target?.isAdmin && (await countAdmins()) <= 1) {
      return c.json({ error: 'Cannot delete the last admin' }, 400);
    }
    await deleteUserWithFiles(id);
    return c.json({ ok: true });
  });

  // ---- Repositories / files / comments -----------------------------------

  app.get('/api/admin/repos', async (c) => {
    await requireAdmin(c);
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);
    const offset = Math.max(Number(c.req.query('offset')) || 0, 0);
    return c.json(await listReposRaw({ search: c.req.query('search'), limit, offset }));
  });

  app.delete('/api/admin/repos/:id', async (c) => {
    await requireAdmin(c);
    const { id } = c.req.param();
    if (!(await getRepoById(id, null, false))) {
      return c.json({ error: 'Repository not found' }, 404);
    }
    await deleteRepo(id);
    return c.json({ ok: true });
  });

  app.delete('/api/admin/files/:id', async (c) => {
    await requireAdmin(c);
    const { id } = c.req.param();
    const file = await deleteFileById(id);
    if (!file) return c.json({ error: 'File not found' }, 404);
    return c.json({ ok: true });
  });

  app.delete('/api/admin/comments/:id', async (c) => {
    await requireAdmin(c);
    const { id } = c.req.param();
    await deleteComment(id);
    return c.json({ ok: true });
  });
}

// Kept as a tiny wrapper so the admin list shape matches listRepos without
// importing the whole repository list type into this file.
async function listReposRaw(args: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<{ items: Awaited<ReturnType<typeof listRepos>>['items']; total: number }> {
  return await listRepos(args, null);
}
