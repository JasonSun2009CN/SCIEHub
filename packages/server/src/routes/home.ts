import type { FastifyInstance } from 'fastify';
import type { HomeData } from '@sciehub/shared';
import {
  getStats,
  listActiveGroups,
  listResources,
  listRecentResources,
  searchAll,
} from '../db.js';

export async function registerHomeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/home', async (req) => {
    const currentUserId = req.authUser?.id ?? null;
    const hotResources = listResources({ sort: 'popular', limit: 6, offset: 0 }, currentUserId).items;
    const data: HomeData = {
      stats: getStats(),
      hotResources,
      activeGroups: listActiveGroups(6, currentUserId),
      recentUploads: listRecentResources(8, currentUserId),
    };
    return data;
  });

  app.get('/api/search', async (req, reply) => {
    const q = ((req.query as Record<string, string | undefined>).q ?? '').trim();
    if (!q) return { resources: [], groups: [] };
    return searchAll(q, req.authUser?.id ?? null);
  });
}
