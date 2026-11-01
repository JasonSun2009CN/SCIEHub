import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initRuntime, type Env } from './runtime.js';
import { parseToken } from './auth.js';
import { HttpError } from './http.js';
import { deleteUsersDeactivatedBefore } from './db.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMeRoutes } from './routes/me.js';
import { registerRepoRoutes } from './routes/repos.js';
import { registerGroupRoutes } from './routes/groups.js';
import { registerUserRoutes } from './routes/users.js';
import { registerHomeRoutes } from './routes/home.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerCommunityRoutes } from './routes/community.js';
import { registerRequestRoutes } from './routes/requests.js';
import { registerAdminRoutes } from './routes/admin.js';
import type { AppEnv } from './types.js';

const app = new Hono<AppEnv>();

app.use('/api/*', cors({ origin: '*' }));

app.use('*', async (c, next) => {
  initRuntime(c.env);
  const header = c.req.header('Authorization');
  const authUser =
    header && header.startsWith('Bearer ') ? await parseToken(header.slice(7)) : null;
  c.set('authUser', authUser);
  await next();
});

registerAuthRoutes(app);
registerMeRoutes(app);
registerRepoRoutes(app);
registerGroupRoutes(app);
registerUserRoutes(app);
registerHomeRoutes(app);
registerReportRoutes(app);
registerCommunityRoutes(app);
registerRequestRoutes(app);
registerAdminRoutes(app);

// Uploaded files are stored in R2 and served from /uploads/<key>.
app.get('/uploads/*', async (c) => {
  const key = c.req.path.slice('/uploads/'.length);
  if (!key) return c.json({ error: 'Not found' }, 404);
  const object = await c.env.UPLOADS.get(key);
  if (!object) return c.json({ error: 'Not found' }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
});

app.notFound((c) => {
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/uploads/')) {
    return c.json({ error: 'Not found' }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json(
      { error: err.message, ...(err.code ? { code: err.code } : {}) },
      err.status as 400,
    );
  }
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(_event, env, ctx) {
    initRuntime(env);
    ctx.waitUntil(
      (async () => {
        const deleted = await deleteUsersDeactivatedBefore(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        );
        if (deleted > 0) console.log(`Cleaned up ${deleted} deactivated account(s)`);
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
