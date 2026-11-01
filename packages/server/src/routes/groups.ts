import type { Hono } from 'hono';
import { CATEGORIES } from '@sciehub/shared';
import { requireAuth } from '../auth.js';
import {
  approveRequest,
  createGroup,
  deleteGroup,
  getGroupById,
  getGroupRequestById,
  groupRole,
  leaveGroup,
  listGroupMembers,
  listGroupRequests,
  listGroups,
  listReposInGroup,
  rejectRequest,
  requestToJoin,
  updateGroup,
} from '../db.js';
import { readJson } from '../http.js';
import type { AppEnv } from '../types.js';

export function registerGroupRoutes(app: Hono<AppEnv>): void {
  app.get('/api/groups', async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);
    const offset = Math.max(Number(c.req.query('offset')) || 0, 0);
    const items = await listGroups(
      {
        search: c.req.query('search'),
        category: c.req.query('category'),
        sort: (c.req.query('sort') as 'members' | 'repos' | 'recent') ?? 'recent',
        limit,
        offset,
      },
      c.get('authUser')?.id ?? null,
    );
    return c.json({ items, total: items.length });
  });

  app.get('/api/groups/:id', async (c) => {
    const { id } = c.req.param();
    const group = await getGroupById(id, c.get('authUser')?.id ?? null);
    if (!group) return c.json({ error: 'Group not found' }, 404);
    return c.json({ group });
  });

  app.get('/api/groups/:id/members', async (c) => {
    const { id } = c.req.param();
    if (!(await getGroupById(id, null))) return c.json({ error: 'Group not found' }, 404);
    return c.json({ items: await listGroupMembers(id) });
  });

  app.get('/api/groups/:id/repos', async (c) => {
    const { id } = c.req.param();
    if (!(await getGroupById(id, null))) return c.json({ error: 'Group not found' }, 404);
    return c.json({ items: await listReposInGroup(id, c.get('authUser')?.id ?? null) });
  });

  app.get('/api/groups/:id/requests', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    if ((await groupRole(id, authUser.id)) !== 'admin') {
      return c.json({ error: 'Only the group creator can review requests' }, 403);
    }
    return c.json({ items: await listGroupRequests(id) });
  });

  app.post('/api/groups/:id/join', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    if (!(await getGroupById(id, null))) return c.json({ error: 'Group not found' }, 404);
    const outcome = await requestToJoin(id, authUser.id);
    return c.json({
      group: await getGroupById(id, authUser.id),
      requestStatus: outcome === 'already-member' ? 'member' : 'pending',
    });
  });

  app.post('/api/groups/:id/requests/:requestId/approve', async (c) => {
    const authUser = await requireAuth(c);
    const { id, requestId } = c.req.param();
    if ((await groupRole(id, authUser.id)) !== 'admin') {
      return c.json({ error: 'Only the group creator can approve requests' }, 403);
    }
    const request = await getGroupRequestById(requestId);
    if (!request || request.groupId !== id) return c.json({ error: 'Request not found' }, 404);
    if (request.status !== 'pending') return c.json({ error: 'Request is no longer pending' }, 400);
    await approveRequest(requestId);
    return c.json({ ok: true, request: await getGroupRequestById(requestId) });
  });

  app.post('/api/groups/:id/requests/:requestId/reject', async (c) => {
    const authUser = await requireAuth(c);
    const { id, requestId } = c.req.param();
    if ((await groupRole(id, authUser.id)) !== 'admin') {
      return c.json({ error: 'Only the group creator can reject requests' }, 403);
    }
    const request = await getGroupRequestById(requestId);
    if (!request || request.groupId !== id) return c.json({ error: 'Request not found' }, 404);
    if (request.status !== 'pending') return c.json({ error: 'Request is no longer pending' }, 400);
    await rejectRequest(requestId);
    return c.json({ ok: true, request: await getGroupRequestById(requestId) });
  });

  app.delete('/api/groups/:id/members', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    if (!(await getGroupById(id, null))) return c.json({ error: 'Group not found' }, 404);
    if ((await groupRole(id, authUser.id)) === 'admin') {
      return c.json({ error: 'Admins cannot leave a group; delete it instead' }, 400);
    }
    await leaveGroup(id, authUser.id);
    return c.json({ group: await getGroupById(id, authUser.id) });
  });

  app.post('/api/groups', async (c) => {
    const authUser = await requireAuth(c);
    const body = await readJson<{ name?: string; description?: string; categoryId?: string }>(c);
    const name = body.name?.trim() ?? '';
    if (name.length < 2 || name.length > 60) {
      return c.json({ error: 'Group name must be 2–60 characters' }, 400);
    }
    if (!body.categoryId || !CATEGORIES.some((category) => category.id === body.categoryId)) {
      return c.json({ error: 'Please choose a valid category' }, 400);
    }
    const group = await createGroup({
      name,
      description: body.description?.trim() ?? '',
      categoryId: body.categoryId,
      creatorId: authUser.id,
    });
    return c.json({ group }, 201);
  });

  app.patch('/api/groups/:id', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    if ((await groupRole(id, authUser.id)) !== 'admin') {
      return c.json({ error: 'Only the group creator can edit this group' }, 403);
    }
    const body = await readJson<{ name?: string; description?: string; categoryId?: string }>(c);
    const group = await updateGroup(id, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      description: typeof body.description === 'string' ? body.description.trim() : undefined,
      categoryId: body.categoryId,
    });
    return c.json({ group });
  });

  app.delete('/api/groups/:id', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    if ((await groupRole(id, authUser.id)) !== 'admin') {
      return c.json({ error: 'Only the group creator can delete this group' }, 403);
    }
    await deleteGroup(id);
    return c.json({ ok: true });
  });
}
