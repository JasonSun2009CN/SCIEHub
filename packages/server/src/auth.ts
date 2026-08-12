import jwt from 'jsonwebtoken';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';
import { getDeactivatedAt, getTokenVersion, getUserById } from './db.js';

export interface AuthUser {
  id: string;
  username: string;
  /** token_version embedded at sign time, used to invalidate all sessions. */
  v?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser | null;
  }
}

export function signToken(user: { id: string; username: string }, tokenVersion?: number): string {
  return jwt.sign({ username: user.username, v: tokenVersion ?? 0 }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresIn,
  });
}

export function parseToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      username: typeof payload.username === 'string' ? payload.username : '',
      v: typeof payload.v === 'number' ? payload.v : 0,
    };
  } catch {
    return null;
  }
}

/** Populates req.authUser for every request when a valid Bearer token is sent. */
export async function authOnRequest(req: FastifyRequest): Promise<void> {
  req.authUser = null;
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return;
  const user = parseToken(header.slice(7));
  if (user) req.authUser = user;
}

/** Returns the authenticated user or sends a 401/403 and returns null. */
export function requireAuth(req: FastifyRequest, reply: FastifyReply): AuthUser | null {
  if (!req.authUser) {
    reply.code(401).send({ error: 'Authentication required' });
    return null;
  }
  const user = getUserById(req.authUser.id);
  if (!user) {
    reply.code(401).send({ error: 'User no longer exists' });
    return null;
  }
  if (user.isSuspended) {
    reply.code(403).send({ error: 'This account has been suspended. Contact the admin at jasonsun2009@yeah.net.' });
    return null;
  }
  if (getDeactivatedAt(user.id)) {
    reply.code(403).send({ error: 'This account is deactivated. Sign in again to restore it.' });
    return null;
  }
  // Token version mismatch means the user signed out all devices (or was forced out).
  if (getTokenVersion(user.id) !== req.authUser.v) {
    reply.code(401).send({ error: 'Session has ended — please sign in again' });
    return null;
  }
  return req.authUser;
}

/** Like requireAuth, but also requires the account to be an admin. */
export function requireAdmin(req: FastifyRequest, reply: FastifyReply): AuthUser | null {
  const auth = requireAuth(req, reply);
  if (!auth) return null;
  const user = getUserById(auth.id);
  if (!user?.isAdmin) {
    reply.code(403).send({ error: 'Admin access required' });
    return null;
  }
  return auth;
}
