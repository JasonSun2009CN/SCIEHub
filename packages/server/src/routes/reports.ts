import type { FastifyInstance } from 'fastify';
import { REPORT_REASONS, type ReportTarget } from '@sciehub/shared';
import { requireAuth } from '../auth.js';
import { commentExists, createReport, getRepoById } from '../db.js';

const VALID_REASONS = new Set<string>(REPORT_REASONS.map((r) => r.id));

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/reports', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const body = (req.body ?? {}) as { targetType?: ReportTarget; targetId?: string; reason?: string };

    const targetType = body.targetType;
    const targetId = body.targetId?.trim() ?? '';
    const reason = body.reason?.trim() ?? '';

    if (targetType !== 'repo' && targetType !== 'comment') {
      return reply.code(400).send({ error: 'Invalid target type' });
    }
    if (!targetId) return reply.code(400).send({ error: 'targetId is required' });
    if (!reason || !VALID_REASONS.has(reason)) {
      return reply.code(400).send({ error: 'Please choose a valid reason' });
    }
    // The reported object must exist.
    const exists = targetType === 'repo' ? Boolean(getRepoById(targetId, null, false)) : commentExists(targetId);
    if (!exists) return reply.code(404).send({ error: 'The reported item no longer exists' });

    const report = createReport({ reporterId: authUser.id, targetType, targetId, reason });
    return reply.code(201).send({ report });
  });
}
