import type { Hono } from 'hono';
import {
  getUserByUsername,
  listFavorites,
  listGroupsByMember,
  listReposByOwner,
} from '../db.js';
import type { AppEnv } from '../types.js';

export function registerUserRoutes(app: Hono<AppEnv>): void {
  app.get('/api/users/:username', async (c) => {
    const { username } = c.req.param();
    const user = await getUserByUsername(username);
    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json({ user });
  });

  app.get('/api/users/:username/repos', async (c) => {
    const { username } = c.req.param();
    const user = await getUserByUsername(username);
    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json({ items: await listReposByOwner(user.id) });
  });

  app.get('/api/users/:username/favorites', async (c) => {
    const { username } = c.req.param();
    const user = await getUserByUsername(username);
    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json({ items: await listFavorites(user.id) });
  });

  app.get('/api/users/:username/groups', async (c) => {
    const { username } = c.req.param();
    const user = await getUserByUsername(username);
    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json({ items: await listGroupsByMember(user.id) });
  });
}
