import type { FastifyInstance } from 'fastify';
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

export async function registerGroupRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/groups', async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    const offset = Math.max(Number(q.offset) || 0, 0);
    const items = listGroups(
      {
        search: q.search,
        category: q.category,
        sort: (q.sort as 'members' | 'repos' | 'recent') ?? 'recent',
        limit,
        offset,
      },
      req.authUser?.id ?? null,
    );
    return { items, total: items.length };
  });

  app.get('/api/groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const group = getGroupById(id, req.authUser?.id ?? null);
    if (!group) return reply.code(404).send({ error: 'Group not found' });
    return { group };
  });

  app.get('/api/groups/:id/members', async (req, reply) => {
    const { id } = req.params as { id: string };
    const group = getGroupById(id, null);
    if (!group) return reply.code(404).send({ error: 'Group not found' });
    return { items: listGroupMembers(id) };
  });

  app.get('/api/groups/:id/repos', async (req, reply) => {
    const { id } = req.params as { id: string };
    const group = getGroupById(id, null);
    if (!group) return reply.code(404).send({ error: 'Group not found' });
    return { items: listReposInGroup(id, req.authUser?.id ?? null) };
  });

  app.get('/api/groups/:id/requests', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    if (groupRole(id, authUser.id) !== 'admin') {
      return reply.code(403).send({ error: 'Only the group creator can review requests' });
    }
    return { items: listGroupRequests(id) };
  });

  app.post('/api/groups/:id/join', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const group = getGroupById(id, null);
    if (!group) return reply.code(404).send({ error: 'Group not found' });
    const outcome = requestToJoin(id, authUser.id);
    if (outcome === 'already-member') {
      return { group: getGroupById(id, authUser.id), requestStatus: 'member' };
    }
    return { group: getGroupById(id, authUser.id), requestStatus: 'pending' };
  });

  app.post('/api/groups/:id/requests/:requestId/approve', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id, requestId } = req.params as { id: string; requestId: string };
    if (groupRole(id, authUser.id) !== 'admin') {
      return reply.code(403).send({ error: 'Only the group creator can approve requests' });
    }
    const request = getGroupRequestById(requestId);
    if (!request || request.groupId !== id) return reply.code(404).send({ error: 'Request not found' });
    if (request.status !== 'pending') return reply.code(400).send({ error: 'Request is no longer pending' });
    approveRequest(requestId);
    return { ok: true, request: getGroupRequestById(requestId) };
  });

  app.post('/api/groups/:id/requests/:requestId/reject', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id, requestId } = req.params as { id: string; requestId: string };
    if (groupRole(id, authUser.id) !== 'admin') {
      return reply.code(403).send({ error: 'Only the group creator can reject requests' });
    }
    const request = getGroupRequestById(requestId);
    if (!request || request.groupId !== id) return reply.code(404).send({ error: 'Request not found' });
    if (request.status !== 'pending') return reply.code(400).send({ error: 'Request is no longer pending' });
    rejectRequest(requestId);
    return { ok: true, request: getGroupRequestById(requestId) };
  });

  app.delete('/api/groups/:id/members', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const group = getGroupById(id, null);
    if (!group) return reply.code(404).send({ error: 'Group not found' });
    if (groupRole(id, authUser.id) === 'admin') {
      return reply.code(400).send({ error: 'Admins cannot leave a group; delete it instead' });
    }
    leaveGroup(id, authUser.id);
    return { group: getGroupById(id, authUser.id) };
  });

  app.post('/api/groups', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const body = (req.body ?? {}) as { name?: string; description?: string; categoryId?: string };
    const name = body.name?.trim() ?? '';
    if (name.length < 2 || name.length > 60) {
      return reply.code(400).send({ error: 'Group name must be 2–60 characters' });
    }
    if (!body.categoryId || !CATEGORIES.some((c) => c.id === body.categoryId)) {
      return reply.code(400).send({ error: 'Please choose a valid category' });
    }
    const group = createGroup({
      name,
      description: body.description?.trim() ?? '',
      categoryId: body.categoryId,
      creatorId: authUser.id,
    });
    return reply.code(201).send({ group });
  });

  app.patch('/api/groups/:id', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    if (groupRole(id, authUser.id) !== 'admin') {
      return reply.code(403).send({ error: 'Only the group creator can edit this group' });
    }
    const body = (req.body ?? {}) as { name?: string; description?: string; categoryId?: string };
    const group = updateGroup(id, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      description: typeof body.description === 'string' ? body.description.trim() : undefined,
      categoryId: body.categoryId,
    });
    return { group };
  });

  app.delete('/api/groups/:id', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    if (groupRole(id, authUser.id) !== 'admin') {
      return reply.code(403).send({ error: 'Only the group creator can delete this group' });
    }
    deleteGroup(id);
    return { ok: true };
  });
}
