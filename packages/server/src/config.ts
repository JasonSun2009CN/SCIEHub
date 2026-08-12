import path from 'node:path';
import { fileURLToPath } from 'node:url';

// packages/server/ — works from both src/ (tsx) and dist/ (compiled).
const serverRoot = fileURLToPath(new URL('..', import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET ?? 'sciehub-dev-secret-change-me',
  jwtExpiresIn: '30d',
  /** Emails (comma-separated) that are promoted to admin on register/login. Empty by default. */
  adminEmails: (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  dbPath: process.env.DB_PATH ?? path.join(serverRoot, 'data', 'sciehub.db'),
  uploadDir: process.env.UPLOAD_DIR ?? path.join(serverRoot, 'data', 'uploads'),
  // Where the built frontend lives; served statically in production.
  webDist: process.env.WEB_DIST ?? path.join(serverRoot, '..', 'web', 'dist'),
} as const;
