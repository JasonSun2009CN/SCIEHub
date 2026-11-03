export interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET?: string;
  ADMIN_EMAILS?: string;
  SCIEHUB_MAX_FILE_MB?: string;
  SCIEHUB_MAX_FILES?: string;
}

export interface RuntimeConfig {
  jwtSecret: string;
  adminEmails: string[];
  maxFileBytes: number;
  maxFilesPerRequest: number;
}

const DEFAULT_JWT_SECRET = 'sciehub-dev-secret-change-me';

let database: D1Database | null = null;
let uploads: R2Bucket | null = null;
let config: RuntimeConfig = {
  jwtSecret: DEFAULT_JWT_SECRET,
  adminEmails: [],
  maxFileBytes: 50 * 1024 * 1024,
  maxFilesPerRequest: 8,
};

/**
 * Workers give each request the same bindings for a deployment, but keep the
 * runtime values in module scope so the existing data layer can stay terse.
 */
export function initRuntime(env: Env): void {
  database = env.DB;
  uploads = env.UPLOADS;
  const maxMb = Number(env.SCIEHUB_MAX_FILE_MB ?? 50);
  const maxFiles = Number(env.SCIEHUB_MAX_FILES ?? 8);
  config = {
    jwtSecret: env.JWT_SECRET || DEFAULT_JWT_SECRET,
    adminEmails: (env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    maxFileBytes: (Number.isFinite(maxMb) && maxMb > 0 ? maxMb : 50) * 1024 * 1024,
    maxFilesPerRequest: Number.isFinite(maxFiles) && maxFiles > 0 ? Math.floor(maxFiles) : 8,
  };
}

export function getDb(): D1Database {
  if (!database) throw new Error('D1 binding is not initialized');
  return database;
}

export function getUploads(): R2Bucket {
  if (!uploads) throw new Error('R2 binding is not initialized');
  return uploads;
}

export function getConfig(): RuntimeConfig {
  return config;
}
