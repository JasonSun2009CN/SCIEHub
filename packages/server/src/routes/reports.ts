import type { Hono } from 'hono';
import { REPORT_REASONS, type ReportTarget } from '@sciehub/shared';
import { requireAuth } from '../auth.js';
import { commentExists, createReport, getRepoById } from '../db.js';
import { readJson } from '../http.js';
import type { AppEnv } from '../types.js';

const VALID_REASONS = new Set<string>(REPORT_REASONS.map((reason) => reason.id));

export function registerReportRoutes(app: Hono<AppEnv>): void {
  app.post('/api/reports', async (c) => {
    const authUser = await requireAuth(c);
    const body = await readJson<{ targetType?: ReportTarget; targetId?: string; reason?: string }>(c);

    const targetType = body.targetType;
    const targetId = body.targetId?.trim() ?? '';
    const reason = body.reason?.trim() ?? '';

    if (targetType !== 'repo' && targetType !== 'comment') {
      return c.json({ error: 'Invalid target type' }, 400);
    }
    if (!targetId) return c.json({ error: 'targetId is required' }, 400);
    if (!reason || !VALID_REASONS.has(reason)) {
      return c.json({ error: 'Please choose a valid reason' }, 400);
    }
    // The reported object must exist.
    const exists =
      targetType === 'repo'
        ? Boolean(await getRepoById(targetId, null, false))
        : await commentExists(targetId);
    if (!exists) return c.json({ error: 'The reported item no longer exists' }, 404);

    const report = await createReport({
      reporterId: authUser.id,
      targetType,
      targetId,
      reason,
    });
    return c.json({ report }, 201);
  });
}
