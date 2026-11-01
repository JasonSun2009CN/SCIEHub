import { SignJWT, jwtVerify } from 'jose';
import type { Context } from 'hono';
import { getConfig } from './runtime.js';
import { getDeactivatedAt, getTokenVersion, getUserById } from './db.js';
import { HttpError } from './http.js';
import type { AppEnv, AuthUser } from './types.js';

const encoder = new TextEncoder();

function secretKey(): Uint8Array {
  return encoder.encode(getConfig().jwtSecret);
}

export async function signToken(
  user: { id: string; username: string },
  tokenVersion?: number,
): Promise<string> {
  return await new SignJWT({ username: user.username, v: tokenVersion ?? 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey());
}

export async function parseToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
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

/** Returns the authenticated user or throws a JSON-friendly HTTP error. */
export async function requireAuth(c: Context<AppEnv>): Promise<AuthUser> {
  const authUser = c.get('authUser');
  if (!authUser) throw new HttpError(401, 'Authentication required');

  const user = await getUserById(authUser.id);
  if (!user) throw new HttpError(401, 'User no longer exists');
  if (user.isSuspended) {
    throw new HttpError(
      403,
      'This account has been suspended. Contact the admin at jasonsun2009@yeah.net.',
    );
  }
  if (await getDeactivatedAt(user.id)) {
    throw new HttpError(403, 'This account is deactivated. Sign in again to restore it.');
  }
  // Token version mismatch means the user signed out all devices (or was forced out).
  if ((await getTokenVersion(user.id)) !== authUser.v) {
    throw new HttpError(401, 'Session has ended — please sign in again');
  }
  return authUser;
}

/** Like requireAuth, but also requires the account to be an admin. */
export async function requireAdmin(c: Context<AppEnv>): Promise<AuthUser> {
  const auth = await requireAuth(c);
  const user = await getUserById(auth.id);
  if (!user?.isAdmin) throw new HttpError(403, 'Admin access required');
  return auth;
}
