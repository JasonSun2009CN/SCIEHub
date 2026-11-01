import type { Hono } from 'hono';
import type { HomeData } from '@sciehub/shared';
import {
  getLeaderboard,
  getStats,
  getTopSellers,
  listActiveGroups,
  listFreeRepos,
  listHotRepos,
  listRecentRepos,
  searchAll,
} from '../db.js';
import type { AppEnv } from '../types.js';

export function registerHomeRoutes(app: Hono<AppEnv>): void {
  app.get('/api/home', async (c) => {
    const currentUserId = c.get('authUser')?.id ?? null;
    const data: HomeData = {
      stats: await getStats(),
      hotRepos: await listHotRepos(6, currentUserId),
      activeGroups: await listActiveGroups(6, currentUserId),
      recentRepos: await listRecentRepos(6, currentUserId),
      topContributors: await getLeaderboard(5),
      topSellers: await getTopSellers(5),
      freeRepos: await listFreeRepos(6, currentUserId),
    };
    return c.json(data);
  });

  app.get('/api/leaderboard', async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 100);
    const type = c.req.query('type') === 'sales' ? 'sales' : 'contributors';
    const items = type === 'sales' ? await getTopSellers(limit) : await getLeaderboard(limit);
    return c.json({ items, type });
  });

  app.get('/api/search', async (c) => {
    const q = (c.req.query('q') ?? '').trim();
    if (!q) return c.json({ repos: [], groups: [] });
    return c.json(await searchAll(q, c.get('authUser')?.id ?? null));
  });
}
