import type { Hono } from 'hono';
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
import { verifyPassword } from '../password.js';
import { readJson } from '../http.js';
import type { AppEnv } from '../types.js';

export function registerMeRoutes(app: Hono<AppEnv>): void {
  // ---- Login history & account security ---------------------------------

  app.get('/api/users/me/logins', async (c) => {
    const authUser = await requireAuth(c);
    return c.json({ items: await listUserLogins(authUser.id, 30) });
  });

  app.post('/api/users/me/logins/revoke', async (c) => {
    const authUser = await requireAuth(c);
    await bumpTokenVersion(authUser.id);
    return c.json({ ok: true });
  });

  app.post('/api/users/me/deactivate', async (c) => {
    const authUser = await requireAuth(c);
    const user = await getUserById(authUser.id);
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (user.isAdmin && (await countAdmins()) <= 1) {
      return c.json(
        { error: 'You are the only admin. Add or transfer to another admin first.' },
        400,
      );
    }
    await setDeactivated(authUser.id);
    return c.json({ ok: true });
  });

  app.delete('/api/users/me', async (c) => {
    const authUser = await requireAuth(c);
    const body = await readJson<{ password?: string }>(c);
    const user = await getUserById(authUser.id);
    if (!user) return c.json({ error: 'User not found' }, 404);
    const hash = await getUserPasswordHash(authUser.id);
    if (!hash || !(await verifyPassword(body.password ?? '', hash))) {
      return c.json({ error: 'Password is incorrect' }, 400);
    }
    if (user.isAdmin && (await countAdmins()) <= 1) {
      return c.json(
        { error: 'You are the only admin. Add or transfer to another admin first.' },
        400,
      );
    }
    await deleteUserWithFiles(authUser.id);
    return c.json({ ok: true });
  });
}
