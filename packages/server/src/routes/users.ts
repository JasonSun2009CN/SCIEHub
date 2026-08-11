import type { FastifyInstance } from 'fastify';
import {
  getUserByUsername,
  listFavorites,
  listGroupsByMember,
  listReposByOwner,
} from '../db.js';

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/users/:username', async (req, reply) => {
    const { username } = req.params as { username: string };
    const user = getUserByUsername(username);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return { user };
  });

  app.get('/api/users/:username/repos', async (req, reply) => {
    const { username } = req.params as { username: string };
    const user = getUserByUsername(username);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return { items: listReposByOwner(user.id) };
  });

  app.get('/api/users/:username/favorites', async (req, reply) => {
    const { username } = req.params as { username: string };
    const user = getUserByUsername(username);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return { items: listFavorites(user.id) };
  });

  app.get('/api/users/:username/groups', async (req, reply) => {
    const { username } = req.params as { username: string };
    const user = getUserByUsername(username);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return { items: listGroupsByMember(user.id) };
  });
}
