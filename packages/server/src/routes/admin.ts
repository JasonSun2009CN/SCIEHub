import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { requireAdmin } from '../auth.js';
import {
  countAdmins,
  deleteComment,
  deleteFileById,
  deleteRepo,
  deleteUserWithFiles,
  getAdminOverview,
  getRepoById,
  getUserById,
  listAdminUsers,
  listRepoFiles,
  listRepos,
  listReports,
  setReportStatus,
  setUserAdmin,
  setUserSuspended,
} from '../db.js';

function removeDiskFile(filePath: string): void {
  try {
    fs.unlinkSync(path.join(config.uploadDir, path.basename(filePath)));
  } catch {
    // file already missing — fine
  }
}

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  // ---- Overview ----------------------------------------------------------

  app.get('/api/admin/overview', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const overview = getAdminOverview();
    const recent = listReports({ offset: 0, limit: 8 });
    return { ...overview, recentReports: recent.items };
  });

  // ---- Reports -----------------------------------------------------------

  app.get('/api/admin/reports', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    const offset = Math.max(Number(q.offset) || 0, 0);
    const status = q.status === 'open' || q.status === 'resolved' ? q.status : undefined;
    return listReports({ status, offset, limit });
  });

  app.patch('/api/admin/reports/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { status?: string };
    if (body.status !== 'open' && body.status !== 'resolved') {
      return reply.code(400).send({ error: 'status must be "open" or "resolved"' });
    }
    setReportStatus(id, body.status);
    return { ok: true };
  });

  // ---- Users -------------------------------------------------------------

  app.get('/api/admin/users', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    const offset = Math.max(Number(q.offset) || 0, 0);
    return listAdminUsers({ search: q.search, offset, limit });
  });

  app.patch('/api/admin/users/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { isAdmin?: boolean; isSuspended?: boolean };
    if (typeof body.isAdmin === 'boolean' && !body.isAdmin) {
      const target = getUserById(id);
      if (target?.isAdmin && countAdmins() <= 1) {
        return reply.code(400).send({ error: 'Cannot remove the last admin' });
      }
    }
    if (typeof body.isAdmin === 'boolean') setUserAdmin(id, body.isAdmin);
    if (typeof body.isSuspended === 'boolean') setUserSuspended(id, body.isSuspended);
    return { ok: true };
  });

  app.delete('/api/admin/users/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const target = getUserById(id);
    if (target?.isAdmin && countAdmins() <= 1) {
      return reply.code(400).send({ error: 'Cannot delete the last admin' });
    }
    deleteUserWithFiles(id);
    return { ok: true };
  });

  // ---- Repositories / files / comments -----------------------------------

  app.get('/api/admin/repos', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    const offset = Math.max(Number(q.offset) || 0, 0);
    return listRepos({ search: q.search, limit, offset }, null);
  });

  app.delete('/api/admin/repos/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    for (const file of listRepoFiles(id)) removeDiskFile(file.filePath);
    deleteRepo(id);
    return { ok: true };
  });

  app.delete('/api/admin/files/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const file = deleteFileById(id);
    if (!file) return reply.code(404).send({ error: 'File not found' });
    removeDiskFile(file.filePath);
    return { ok: true };
  });

  app.delete('/api/admin/comments/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    deleteComment(id);
    return { ok: true };
  });
}
