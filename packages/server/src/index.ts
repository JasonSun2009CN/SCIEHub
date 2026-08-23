import fs from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { config } from './config.js';
import { authOnRequest } from './auth.js';
import { closeDb, deleteUsersDeactivatedBefore } from './db.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMeRoutes } from './routes/me.js';
import { registerRepoRoutes } from './routes/repos.js';
import { registerGroupRoutes } from './routes/groups.js';
import { registerUserRoutes } from './routes/users.js';
import { registerHomeRoutes } from './routes/home.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerAdminRoutes } from './routes/admin.js';

const app = Fastify({ logger: true, trustProxy: true });

await app.register(cors, { origin: true });
const maxFileBytes = Number(process.env.SCIEHUB_MAX_FILE_MB ?? 200) * 1024 * 1024;
const maxFilesPerRequest = Number(process.env.SCIEHUB_MAX_FILES ?? 8);
await app.register(multipart, {
  limits: { fileSize: maxFileBytes, files: maxFilesPerRequest },
});

app.addHook('onRequest', authOnRequest);

await registerAuthRoutes(app);
await registerMeRoutes(app);
await registerRepoRoutes(app);
await registerGroupRoutes(app);
await registerUserRoutes(app);
await registerHomeRoutes(app);
await registerReportRoutes(app);
await registerAdminRoutes(app);

// Uploaded files are served from /uploads/*. decorateReply is off because the
// SPA static registration below owns the reply.sendFile decorator.
await app.register(staticPlugin, { root: config.uploadDir, prefix: '/uploads/', decorateReply: false });

// In production, serve the built frontend and fall back to index.html so the
// React Router history-mode routes stay reachable on refresh / deep links.
const hasWebBuild = fs.existsSync(config.webDist);
if (hasWebBuild) {
  await app.register(staticPlugin, { root: config.webDist });
}

app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
    return reply.code(404).send({ error: 'Not found' });
  }
  if (hasWebBuild) {
    return reply.sendFile('index.html');
  }
  return reply.code(404).send({ error: `Not found (build the frontend with npm run build to serve it here)` });
});

// Start the 30-day cleanup for deactivated accounts (deleted if never signed
// into again). The first registered user becomes the site admin automatically.
const cleanupJob = setInterval(() => {
  const deleted = deleteUsersDeactivatedBefore(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  if (deleted > 0) app.log.info(`Cleaned up ${deleted} deactivated account(s)`);
}, 60 * 60 * 1000);
cleanupJob.unref();

const handleShutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down`);
  await app.close();
  closeDb();
  process.exit(0);
};
process.on('SIGINT', () => void handleShutdown('SIGINT'));
process.on('SIGTERM', () => void handleShutdown('SIGTERM'));

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    `SCIEHub Marketplace ready — API on http://localhost:${config.port} (max ${Math.round(
      maxFileBytes / 1024 / 1024,
    )}MB/file, up to ${maxFilesPerRequest} files per upload)`,
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
