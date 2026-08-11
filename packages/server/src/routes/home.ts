import type { FastifyInstance } from 'fastify';
import type { HomeData } from '@sciehub/shared';
import {
  getLeaderboard,
  getStats,
  listActiveGroups,
  listHotRepos,
  listRecentRepos,
  searchAll,
} from '../db.js';

export async function registerHomeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/home', async (req) => {
    const currentUserId = req.authUser?.id ?? null;
    const data: HomeData = {
      stats: getStats(),
      hotRepos: listHotRepos(6, currentUserId),
      activeGroups: listActiveGroups(6, currentUserId),
      recentRepos: listRecentRepos(6, currentUserId),
      topContributors: getLeaderboard(5),
    };
    return data;
  });

  app.get('/api/leaderboard', async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 100);
    return { items: getLeaderboard(limit) };
  });

  app.get('/api/search', async (req, reply) => {
    const q = ((req.query as Record<string, string | undefined>).q ?? '').trim();
    if (!q) return { repos: [], groups: [] };
    return searchAll(q, req.authUser?.id ?? null);
  });
}
