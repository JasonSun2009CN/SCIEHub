import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { CATEGORIES, formatBytes, type RepoFile } from '@sciehub/shared';
import { config } from '../config.js';
import { requireAuth } from '../auth.js';
import {
  addFileToRepo,
  createRepo,
  createRepoComment,
  deleteRepo,
  getRepoById,
  getRepoFileById,
  groupRole,
  incrementFileDownload,
  listRepoComments,
  listRepoFiles,
  listRepos,
  shareRepoToGroup,
  toggleFavoriteRepo,
  unshareRepoFromGroup,
  updateRepo,
  inferFileType,
} from '../db.js';

export async function registerRepoRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/repos', async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    const offset = Math.max(Number(q.offset) || 0, 0);
    return listRepos(
      {
        search: q.search,
        category: q.category,
        sort: (q.sort as 'recent' | 'popular' | 'views') ?? 'recent',
        ownerId: q.ownerId,
        groupId: q.groupId,
        limit,
        offset,
      },
      req.authUser?.id ?? null,
    );
  });

  app.get('/api/repos/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, req.authUser?.id ?? null, true);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    const files = listRepoFiles(id);
    const related = listRepos({ category: repo.categoryId, limit: 5, offset: 0 }, req.authUser?.id ?? null).items.filter(
      (r) => r.id !== id,
    );
    return { repo, files, related };
  });

  app.post('/api/repos', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const body = (req.body ?? {}) as { name?: string; description?: string; categoryId?: string; tags?: string };
    const name = body.name?.trim() ?? '';
    if (name.length < 2 || name.length > 80) {
      return reply.code(400).send({ error: 'Repository name must be 2–80 characters' });
    }
    if (!body.categoryId || !CATEGORIES.some((c) => c.id === body.categoryId)) {
      return reply.code(400).send({ error: 'Please choose a valid category' });
    }
    const tags = (body.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);
    const repo = createRepo({
      name,
      description: body.description?.trim() ?? '',
      categoryId: body.categoryId,
      tags,
      ownerId: authUser.id,
    });
    return reply.code(201).send({ repo });
  });

  app.patch('/api/repos/:id', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    if (repo.ownerId !== authUser.id) return reply.code(403).send({ error: 'Only the owner can edit this repository' });
    const body = (req.body ?? {}) as { name?: string; description?: string; categoryId?: string; tags?: string };
    if (typeof body.name === 'string' && (body.name.trim().length < 2 || body.name.trim().length > 80)) {
      return reply.code(400).send({ error: 'Repository name must be 2–80 characters' });
    }
    if (body.categoryId && !CATEGORIES.some((c) => c.id === body.categoryId)) {
      return reply.code(400).send({ error: 'Please choose a valid category' });
    }
    const tags = typeof body.tags === 'string' ? body.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8) : undefined;
    const updated = updateRepo(id, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      description: typeof body.description === 'string' ? body.description.trim() : undefined,
      categoryId: body.categoryId,
      tags,
    });
    return { repo: updated };
  });

  app.delete('/api/repos/:id', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    if (repo.ownerId !== authUser.id) return reply.code(403).send({ error: 'Only the owner can delete this repository' });
    deleteRepo(id);
    return { ok: true };
  });

  // ---- Files -------------------------------------------------------------

  app.post('/api/repos/:id/files', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    if (repo.ownerId !== authUser.id) return reply.code(403).send({ error: 'Only the owner can add files' });

    const files: Array<{ buffer: Buffer; filename: string }> = [];
    const fields: Record<string, string> = {};
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        files.push({ buffer: await part.toBuffer(), filename: part.filename ?? 'file' });
      } else {
        fields[part.fieldname] = String(part.value ?? '');
      }
    }
    const description = (fields.description ?? '').trim();
    if (files.length === 0) return reply.code(400).send({ error: 'Attach at least one file' });

    const created: RepoFile[] = [];
    for (const file of files) {
      const storedName = `${randomUUID()}${path.extname(file.filename)}`;
      await fs.promises.writeFile(path.join(config.uploadDir, storedName), file.buffer);
      created.push(
        addFileToRepo({
          repoId: id,
          title: file.filename,
          description,
          fileType: inferFileType(file.filename),
          fileSize: formatBytes(file.buffer.length),
          fileBytes: file.buffer.length,
          filePath: `/uploads/${storedName}`,
        }),
      );
    }
    return reply.code(201).send({ files: created, repo: getRepoById(id, authUser.id, false) });
  });

  app.get('/api/files/:id/download', async (req, reply) => {
    const { id } = req.params as { id: string };
    const file = getRepoFileById(id);
    if (!file) return reply.code(404).send({ error: 'File not found' });
    const filePath = path.join(config.uploadDir, path.basename(file.filePath));
    if (!fs.existsSync(filePath)) return reply.code(404).send({ error: 'File is missing on the server' });
    incrementFileDownload(id);
    const safeTitle = file.title.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_');
    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${safeTitle}"`)
      .send(fs.createReadStream(filePath));
  });

  // ---- Comments ----------------------------------------------------------

  app.get('/api/repos/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    return { items: listRepoComments(id) };
  });

  app.post('/api/repos/:id/comments', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    const content = ((req.body as { content?: string } | undefined)?.content ?? '').trim();
    if (!content) return reply.code(400).send({ error: 'Comment cannot be empty' });
    if (content.length > 2000) return reply.code(400).send({ error: 'Comment is too long' });
    const comment = createRepoComment(id, authUser.id, content);
    return reply.code(201).send({ comment });
  });

  // ---- Favorites ---------------------------------------------------------

  app.post('/api/repos/:id/favorite', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    const favorited = toggleFavoriteRepo(id, authUser.id);
    return { favorited, repo: getRepoById(id, authUser.id, false) };
  });

  app.delete('/api/repos/:id/favorite', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    toggleFavoriteRepo(id, authUser.id);
    return { favorited: false, repo: getRepoById(id, authUser.id, false) };
  });

  // ---- Sharing into groups ----------------------------------------------

  app.post('/api/repos/:id/groups', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { groupId?: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    if (repo.ownerId !== authUser.id) return reply.code(403).send({ error: 'Only the owner can share this repository' });
    if (!body.groupId) return reply.code(400).send({ error: 'groupId is required' });
    if (!groupRole(body.groupId, authUser.id)) {
      return reply.code(400).send({ error: 'Join the group before sharing a repository to it' });
    }
    shareRepoToGroup(id, body.groupId);
    return { repo: getRepoById(id, authUser.id, false) };
  });

  app.delete('/api/repos/:id/groups/:groupId', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id, groupId } = req.params as { id: string; groupId: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    if (repo.ownerId !== authUser.id) return reply.code(403).send({ error: 'Only the owner can unshare this repository' });
    unshareRepoFromGroup(id, groupId);
    return { repo: getRepoById(id, authUser.id, false) };
  });
}
