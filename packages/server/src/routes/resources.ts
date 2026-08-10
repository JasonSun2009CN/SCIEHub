import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { CATEGORIES } from '@sciehub/shared';
import { config } from '../config.js';
import { requireAuth } from '../auth.js';
import {
  createComment,
  createResource,
  getRelatedResources,
  getResourceById,
  groupRole,
  incrementDownload,
  listComments,
  listResources,
  toggleFavorite,
  inferFileType,
  formatBytes,
} from '../db.js';

export async function registerResourceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/resources', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    const offset = Math.max(Number(q.offset) || 0, 0);
    return listResources(
      {
        search: q.search,
        category: q.category,
        sort: (q.sort as 'recent' | 'popular' | 'views') ?? 'recent',
        groupId: q.groupId,
        uploaderId: q.uploaderId,
        limit,
        offset,
      },
      req.authUser?.id ?? null,
    );
  });

  app.get('/api/resources/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const resource = getResourceById(id, req.authUser?.id ?? null);
    if (!resource) return reply.code(404).send({ error: 'Resource not found' });
    const related = getRelatedResources(resource);
    return { resource, related };
  });

  app.get('/api/resources/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const resource = getResourceById(id, null, false);
    if (!resource) return reply.code(404).send({ error: 'Resource not found' });
    return { items: listComments(id) };
  });

  app.post('/api/resources/:id/comments', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const resource = getResourceById(id, null, false);
    if (!resource) return reply.code(404).send({ error: 'Resource not found' });
    const content = ((req.body as { content?: string } | undefined)?.content ?? '').trim();
    if (!content) return reply.code(400).send({ error: 'Comment cannot be empty' });
    if (content.length > 2000) return reply.code(400).send({ error: 'Comment is too long' });
    const comment = createComment(id, authUser.id, content);
    return reply.code(201).send({ comment });
  });

  app.post('/api/resources/:id/favorite', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const resource = getResourceById(id, null, false);
    if (!resource) return reply.code(404).send({ error: 'Resource not found' });
    const favorited = toggleFavorite(id, authUser.id);
    return { favorited, resource: getResourceById(id, authUser.id, false) };
  });

  app.delete('/api/resources/:id/favorite', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    toggleFavorite(id, authUser.id);
    return { favorited: false, resource: getResourceById(id, authUser.id, false) };
  });

  app.get('/api/resources/:id/download', async (req, reply) => {
    const { id } = req.params as { id: string };
    const resource = getResourceById(id, req.authUser?.id ?? null, false);
    if (!resource) return reply.code(404).send({ error: 'Resource not found' });
    const filePath = path.join(config.uploadDir, path.basename(resource.filePath));
    if (!fs.existsSync(filePath)) return reply.code(404).send({ error: 'File is missing on the server' });
    incrementDownload(id);
    const safeTitle = resource.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${safeTitle}${path.extname(resource.filePath)}"`)
      .send(fs.createReadStream(filePath));
  });

  app.post('/api/resources', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;

    // Multipart form: fields first, then exactly one file part.
    const fields: Record<string, string> = {};
    let uploaded: { buffer: Buffer; filename: string } | null = null;

    for await (const part of req.parts()) {
      if (part.type === 'file') {
        if (!uploaded) {
          uploaded = { buffer: await part.toBuffer(), filename: part.filename ?? 'file' };
        } else {
          await part.toBuffer(); // discard extra files; one resource per request
        }
      } else {
        fields[part.fieldname] = String(part.value ?? '');
      }
    }

    const title = (fields.title ?? '').trim();
    const categoryId = (fields.categoryId ?? '').trim();
    const groupId = (fields.groupId ?? '').trim() || null;
    const description = (fields.description ?? '').trim();
    const tags = (fields.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);

    if (!uploaded) return reply.code(400).send({ error: 'Please attach a file' });
    if (!title) return reply.code(400).send({ error: 'Title is required' });
    if (!CATEGORIES.some((c) => c.id === categoryId)) {
      return reply.code(400).send({ error: 'Please choose a valid category' });
    }
    if (groupId) {
      const role = groupRole(groupId, authUser.id);
      if (!role) return reply.code(400).send({ error: 'Join the group before sharing resources to it' });
    }

    const ext = path.extname(uploaded.filename);
    const storedName = `${randomUUID()}${ext}`;
    await fs.promises.writeFile(path.join(config.uploadDir, storedName), uploaded.buffer);

    const resource = createResource({
      title,
      description,
      fileType: inferFileType(uploaded.filename),
      fileSize: formatBytes(uploaded.buffer.length),
      filePath: `/uploads/${storedName}`,
      uploaderId: authUser.id,
      groupId,
      categoryId,
      tags,
    });
    return reply.code(201).send({ resource });
  });
}
