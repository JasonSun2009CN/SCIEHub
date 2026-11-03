import type { Hono } from 'hono';
import { requireAuth, requirePermission } from '../auth.js';
import {
  createPlazaComment,
  createPlazaPost,
  deletePlazaComment,
  deletePlazaPost,
  getPlazaCommentById,
  getPlazaPostById,
  getUserById,
  listPlazaComments,
  listPlazaPosts,
  togglePlazaLike,
} from '../db.js';
import { deleteUpload, putUpload } from '../storage.js';
import { readJson } from '../http.js';
import type { AppEnv } from '../types.js';

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export function registerPlazaRoutes(app: Hono<AppEnv>): void {
  app.get('/api/plaza', async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 50);
    const offset = Math.max(Number(c.req.query('offset')) || 0, 0);
    return c.json({
      items: await listPlazaPosts(limit, offset, c.get('authUser')?.id ?? null),
    });
  });

  app.post('/api/plaza', async (c) => {
    const authUser = await requirePermission(c, 'canChat');
    const form = await c.req.formData();
    const content = String(form.get('content') ?? '').trim();
    const isAnonymous =
      String(form.get('isAnonymous') ?? '').toLowerCase() === 'true' ||
      String(form.get('isAnonymous') ?? '') === '1';
    const files: File[] = [];
    for (const value of form.values()) {
      if (value instanceof File) files.push(value);
    }

    if (!content && files.length === 0) {
      return c.json({ error: 'Write something or attach an image' }, 400);
    }
    if (content.length > 2000) {
      return c.json({ error: 'Post is too long (max 2000 characters)' }, 400);
    }
    if (files.length > MAX_IMAGES) {
      return c.json({ error: `Attach at most ${MAX_IMAGES} images` }, 400);
    }

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return c.json(
          { error: 'Only JPG, PNG, WebP, GIF or AVIF images are supported — no video or SVG yet' },
          400,
        );
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return c.json({ error: 'Each image must be 10MB or smaller' }, 413);
      }
    }

    const imageKeys: string[] = [];
    try {
      for (const file of files) {
        const ext = file.name.includes('.')
          ? `.${file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}`
          : '';
        const key = `plaza/${crypto.randomUUID()}${ext}`;
        await putUpload(key, await file.arrayBuffer(), file.type || 'image/jpeg');
        imageKeys.push(key);
      }
      const post = await createPlazaPost({
        userId: authUser.id,
        content,
        isAnonymous,
        imageKeys,
      });
      return c.json({ post }, 201);
    } catch (error) {
      for (const key of imageKeys) await deleteUpload(`/uploads/${key}`);
      throw error;
    }
  });

  app.post('/api/plaza/:id/like', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    if (!(await getPlazaPostById(id))) return c.json({ error: 'Post not found' }, 404);
    return c.json(await togglePlazaLike(id, authUser.id));
  });

  app.delete('/api/plaza/:id', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    const post = await getPlazaPostById(id);
    if (!post) return c.json({ error: 'Post not found' }, 404);
    const user = await getUserById(authUser.id);
    if (post.userId !== authUser.id && !user?.isAdmin) {
      return c.json({ error: 'You can only delete your own posts' }, 403);
    }
    await deletePlazaPost(id);
    return c.json({ ok: true });
  });

  app.get('/api/plaza/:id/comments', async (c) => {
    const { id } = c.req.param();
    if (!(await getPlazaPostById(id))) return c.json({ error: 'Post not found' }, 404);
    return c.json({ items: await listPlazaComments(id, c.get('authUser')?.id ?? null) });
  });

  app.post('/api/plaza/:id/comments', async (c) => {
    const authUser = await requirePermission(c, 'canChat');
    const { id } = c.req.param();
    if (!(await getPlazaPostById(id))) return c.json({ error: 'Post not found' }, 404);
    const body = await readJson<{ content?: string; isAnonymous?: boolean }>(c);
    const content = (body.content ?? '').trim();
    if (!content) return c.json({ error: 'Comment cannot be empty' }, 400);
    if (content.length > 1000) return c.json({ error: 'Comment is too long' }, 400);
    return c.json(
      {
        comment: await createPlazaComment({
          postId: id,
          userId: authUser.id,
          content,
          isAnonymous: Boolean(body.isAnonymous),
        }),
      },
      201,
    );
  });

  app.delete('/api/plaza/:id/comments/:commentId', async (c) => {
    const authUser = await requireAuth(c);
    const { commentId } = c.req.param();
    const comment = await getPlazaCommentById(commentId);
    if (!comment) return c.json({ error: 'Comment not found' }, 404);
    const user = await getUserById(authUser.id);
    if (comment.userId !== authUser.id && !user?.isAdmin) {
      return c.json({ error: 'You can only delete your own comments' }, 403);
    }
    await deletePlazaComment(commentId);
    return c.json({ ok: true });
  });
}
