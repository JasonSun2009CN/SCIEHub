import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../auth.js';
import {
  bumpTokenVersion,
  countAdmins,
  deleteUserWithFiles,
  getUserById,
  getUserPasswordHash,
  listUserLogins,
  setDeactivated,
} from '../db.js';

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  // Login history — helps users spot a stolen/compromised account.
  app.get('/api/users/me/logins', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    return { items: listUserLogins(authUser.id, 30) };
  });

  // Sign out all devices: bumps the token version so every existing session dies.
  app.post('/api/users/me/logins/revoke', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    bumpTokenVersion(authUser.id);
    return { ok: true };
  });

  // Deactivate: account is frozen; logging in again within 30 days restores it.
  app.post('/api/users/me/deactivate', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const user = getUserById(authUser.id);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.isAdmin && countAdmins() <= 1) {
      return reply.code(400).send({ error: 'You are the only admin. Add or transfer to another admin first.' });
    }
    setDeactivated(authUser.id);
    return { ok: true };
  });

  // Permanently delete the account (requires the password).
  app.delete('/api/users/me', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const body = (req.body ?? {}) as { password?: string };
    const user = getUserById(authUser.id);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const hash = getUserPasswordHash(authUser.id)!;
    if (!bcrypt.compareSync(body.password ?? '', hash)) {
      return reply.code(400).send({ error: 'Password is incorrect' });
    }
    if (user.isAdmin && countAdmins() <= 1) {
      return reply.code(400).send({ error: 'You are the only admin. Add or transfer to another admin first.' });
    }
    deleteUserWithFiles(authUser.id);
    return { ok: true };
  });
}
