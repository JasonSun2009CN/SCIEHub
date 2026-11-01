import type { Hono } from 'hono';
import { requireAuth, requirePermission } from '../auth.js';
import {
  createCommunityPost,
  deleteCommunityPost,
  getCommunityPostById,
  getUserById,
  listCommunityPosts,
} from '../db.js';
import { readJson } from '../http.js';
import type { AppEnv } from '../types.js';

export function registerCommunityRoutes(app: Hono<AppEnv>): void {
  app.get('/api/community', async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 80, 1), 200);
    return c.json({ items: await listCommunityPosts(limit, c.get('authUser')?.id ?? null) });
  });

  app.post('/api/community', async (c) => {
    const authUser = await requirePermission(c, 'canChat');
    const body = await readJson<{ content?: string; isAnonymous?: boolean }>(c);
    const content = (body.content ?? '').trim();
    if (!content) return c.json({ error: 'Write something before posting' }, 400);
    if (content.length > 2000) return c.json({ error: 'Post is too long (max 2000 characters)' }, 400);
    const post = await createCommunityPost({
      userId: authUser.id,
      content,
      isAnonymous: Boolean(body.isAnonymous),
    });
    return c.json({ post }, 201);
  });

  app.delete('/api/community/:id', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    const post = await getCommunityPostById(id);
    if (!post) return c.json({ error: 'Post not found' }, 404);
    const user = await getUserById(authUser.id);
    if (post.userId !== authUser.id && !user?.isAdmin) {
      return c.json({ error: 'You can only delete your own posts' }, 403);
    }
    await deleteCommunityPost(id);
    return c.json({ ok: true });
  });
}
