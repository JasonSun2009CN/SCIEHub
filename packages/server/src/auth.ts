import jwt from 'jsonwebtoken';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';

export interface AuthUser {
  id: string;
  username: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser | null;
  }
}

export function signToken(user: { id: string; username: string }): string {
  return jwt.sign({ username: user.username }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresIn,
  });
}

export function parseToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    if (!payload.sub) return null;
    return { id: payload.sub, username: typeof payload.username === 'string' ? payload.username : '' };
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

/** Returns the authenticated user or sends a 401 and returns null. */
export function requireAuth(req: FastifyRequest, reply: FastifyReply): AuthUser | null {
  if (!req.authUser) {
    reply.code(401).send({ error: 'Authentication required' });
    return null;
  }
  return req.authUser;
}
