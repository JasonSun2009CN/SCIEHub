import path from 'node:path';
import { fileURLToPath } from 'node:url';

// packages/server/ — works from both src/ (tsx) and dist/ (compiled).
const serverRoot = fileURLToPath(new URL('..', import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET ?? 'sciehub-dev-secret-change-me',
  jwtExpiresIn: '30d',
  /** Emails (comma-separated) that are promoted to admin on register/login. */
  adminEmails: (process.env.ADMIN_EMAILS ?? '2022531780@qq.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  dbPath: process.env.DB_PATH ?? path.join(serverRoot, 'data', 'sciehub.db'),
  uploadDir: process.env.UPLOAD_DIR ?? path.join(serverRoot, 'data', 'uploads'),
  // Where the built frontend lives; served statically in production.
  webDist: process.env.WEB_DIST ?? path.join(serverRoot, '..', 'web', 'dist'),
} as const;

/**
 * The owner's admin account, created automatically on first boot.
 * Only the bcrypt hash is stored here — the plaintext password never appears in code.
 */
export const SEED_ADMIN = {
  email: '2022531780@qq.com',
  passwordHash: '$2a$10$6JMfM7YklK0Zo6ez8OJaEe1WZ7ENhjnroD8Ak4VwUo3KTKujIESLa',
  username: 'admin',
  nickname: 'SCIEHub Admin',
} as const;
