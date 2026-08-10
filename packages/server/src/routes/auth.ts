import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { AVATAR_COLORS, type AuthResponse } from '@sciehub/shared';
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  getUserPasswordHash,
  setUserPassword,
  updateUserProfile,
} from '../db.js';
import { requireAuth, signToken } from '../auth.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/register', async (req, reply) => {
    const body = (req.body ?? {}) as {
      username?: string;
      email?: string;
      nickname?: string;
      password?: string;
    };
    const username = body.username?.trim() ?? '';
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';

    if (!username || !email || !password) {
      return reply.code(400).send({ error: 'Username, email and password are required' });
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return reply.code(400).send({ error: 'Username must be 3–20 chars (letters, digits, underscore)' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return reply.code(400).send({ error: 'Please enter a valid email address' });
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: 'Password must be at least 6 characters' });
    }
    if (getUserByEmail(email)) {
      return reply.code(409).send({ error: 'An account with this email already exists' });
    }
    if (getUserByUsername(username)) {
      return reply.code(409).send({ error: 'This username is already taken' });
    }

    const user = createUser({
      username,
      email,
      nickname: body.nickname?.trim() || username,
      passwordHash: bcrypt.hashSync(password, 10),
      avatarUrl: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    });

    const response: AuthResponse = { token: signToken(user), user };
    return response;
  });

  app.post('/api/auth/login', async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }
    const user = getUserByEmail(email);
    const hash = user ? getUserPasswordHash(user.id) : null;
    if (!user || !hash || !bcrypt.compareSync(password, hash)) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }
    const response: AuthResponse = { token: signToken(user), user };
    return response;
  });

  app.get('/api/auth/me', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const user = getUserById(authUser.id);
    if (!user) return reply.code(401).send({ error: 'User no longer exists' });
    return { user };
  });

  app.put('/api/users/me', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const body = (req.body ?? {}) as { nickname?: string; bio?: string; avatarUrl?: string };
    const user = updateUserProfile(authUser.id, {
      nickname: typeof body.nickname === 'string' ? body.nickname : undefined,
      bio: typeof body.bio === 'string' ? body.bio : undefined,
      avatarUrl: typeof body.avatarUrl === 'string' ? body.avatarUrl : undefined,
    });
    return { user };
  });

  app.put('/api/users/me/password', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const body = (req.body ?? {}) as { oldPassword?: string; newPassword?: string };
    const hash = getUserPasswordHash(authUser.id)!;
    if (!bcrypt.compareSync(body.oldPassword ?? '', hash)) {
      return reply.code(400).send({ error: 'Current password is incorrect' });
    }
    if (!body.newPassword || body.newPassword.length < 6) {
      return reply.code(400).send({ error: 'New password must be at least 6 characters' });
    }
    setUserPassword(authUser.id, bcrypt.hashSync(body.newPassword, 10));
    return { ok: true };
  });
}
