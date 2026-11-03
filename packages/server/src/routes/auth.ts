import type { Hono } from 'hono';
import { AVATAR_COLORS, isValidSchoolEmail, type AuthResponse } from '@sciehub/shared';
import {
  clearDeactivated,
  createUser,
  deleteUserWithFiles,
  getDeactivatedAt,
  getTokenVersion,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  getUserCount,
  getUserPasswordHash,
  logLogin,
  setUserAdmin,
  setUserPassword,
  updateUserProfile,
} from '../db.js';
import { requireAuth, signToken } from '../auth.js';
import { getConfig } from '../runtime.js';
import { hashPassword, verifyPassword } from '../password.js';
import { clientIp, readJson, userAgent } from '../http.js';
import type { AppEnv } from '../types.js';

const GRACE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Emails listed in ADMIN_EMAILS are granted admin on their first sign-in. */
async function promoteIfAdmin(userId: string, email: string): Promise<void> {
  if (getConfig().adminEmails.includes(email.trim().toLowerCase())) {
    await setUserAdmin(userId, true);
  }
}

export function registerAuthRoutes(app: Hono<AppEnv>): void {
  app.post('/api/auth/register', async (c) => {
    const body = await readJson<{
      username?: string;
      email?: string;
      nickname?: string;
      password?: string;
    }>(c);
    const username = body.username?.trim() ?? '';
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';
    const ip = clientIp(c) || null;
    const agent = userAgent(c) || null;

    if (!username || !email || !password) {
      return c.json({ error: 'Username, email and password are required' }, 400);
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return c.json({ error: 'Username must be 3–20 chars (letters, digits, underscore)' }, 400);
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return c.json({ error: 'Please enter a valid email address' }, 400);
    }
    if (!isValidSchoolEmail(email)) {
      return c.json(
        {
          error:
            'Use your school email in the format s12345.chen@stu.scie.com.cn. External emails cannot register.',
        },
        400,
      );
    }
    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }
    if (await getUserByEmail(email)) {
      return c.json({ error: 'An account with this email already exists' }, 409);
    }
    if (await getUserByUsername(username)) {
      return c.json({ error: 'This username is already taken' }, 409);
    }

    // The very first registered user becomes the site admin (no password ever
    // lives in the codebase). ADMIN_EMAILS remains as a backup.
    const isFirstUser = (await getUserCount()) === 0;
    const user = await createUser({
      username,
      email,
      nickname: body.nickname?.trim() || username,
      passwordHash: await hashPassword(password),
      avatarUrl: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    });
    if (isFirstUser) await setUserAdmin(user.id, true);
    await promoteIfAdmin(user.id, email);
    await logLogin({ userId: user.id, email, success: true, ip, userAgent: agent });

    const response: AuthResponse = {
      token: await signToken(user, await getTokenVersion(user.id)),
      user: (await getUserById(user.id))!,
    };
    return c.json(response);
  });

  app.post('/api/auth/login', async (c) => {
    const body = await readJson<{ email?: string; password?: string }>(c);
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';
    const ip = clientIp(c) || null;
    const agent = userAgent(c) || null;
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const user = await getUserByEmail(email);
    const hash = user ? await getUserPasswordHash(user.id) : null;
    if (!user || !hash || !(await verifyPassword(password, hash))) {
      await logLogin({ userId: user?.id ?? null, email, success: false, ip, userAgent: agent });
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    if (user.isSuspended) {
      await logLogin({ userId: user.id, email, success: false, ip, userAgent: agent });
      return c.json(
        { error: 'This account has been suspended. Contact the admin at jasonsun2009@yeah.net.' },
        403,
      );
    }

    // Deactivated account: logging back in restores it (unless the 30-day grace expired).
    const deactivatedAt = await getDeactivatedAt(user.id);
    if (deactivatedAt) {
      if (Date.now() - new Date(deactivatedAt).getTime() > GRACE_MS) {
        await deleteUserWithFiles(user.id);
        return c.json(
          { error: 'This account was deactivated over 30 days ago and has been deleted.' },
          401,
        );
      }
      await clearDeactivated(user.id);
    }

    await promoteIfAdmin(user.id, email);
    await logLogin({ userId: user.id, email, success: true, ip, userAgent: agent });
    const response: AuthResponse = {
      token: await signToken(user, await getTokenVersion(user.id)),
      user: (await getUserById(user.id))!,
    };
    return c.json(response);
  });

  app.get('/api/auth/me', async (c) => {
    const authUser = await requireAuth(c);
    const user = await getUserById(authUser.id);
    if (!user) return c.json({ error: 'User no longer exists' }, 401);
    return c.json({ user });
  });

  app.put('/api/users/me', async (c) => {
    const authUser = await requireAuth(c);
    const body = await readJson<{ nickname?: string; bio?: string; avatarUrl?: string }>(c);
    const user = await updateUserProfile(authUser.id, {
      nickname: typeof body.nickname === 'string' ? body.nickname : undefined,
      bio: typeof body.bio === 'string' ? body.bio : undefined,
      avatarUrl: typeof body.avatarUrl === 'string' ? body.avatarUrl : undefined,
    });
    return c.json({ user });
  });

  app.put('/api/users/me/password', async (c) => {
    const authUser = await requireAuth(c);
    const body = await readJson<{ oldPassword?: string; newPassword?: string }>(c);
    const hash = await getUserPasswordHash(authUser.id);
    if (!hash || !(await verifyPassword(body.oldPassword ?? '', hash))) {
      return c.json({ error: 'Current password is incorrect' }, 400);
    }
    if (!body.newPassword || body.newPassword.length < 6) {
      return c.json({ error: 'New password must be at least 6 characters' }, 400);
    }
    await setUserPassword(authUser.id, await hashPassword(body.newPassword));
    return c.json({ ok: true });
  });
}
