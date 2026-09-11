import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { createToken, requireAuth } from '../auth.js';
import { pool, query } from '../db.js';
import type { AuthRequest, AuthUser } from '../types.js';

const router = Router();

const loginSchema = z.object({
  tenant: z.string().trim().min(2),
  email: z.email(),
  password: z.string().min(8),
});

router.post('/login', async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Bitte Anmeldedaten prüfen.' });
    return;
  }

  const [user] = await query<
    AuthUser & { password_hash: string; active: boolean }
  >(
    `SELECT u.id, u.name, u.email, u.role,
            u.tenant_id AS "tenantId", u.password_hash, u.active
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE t.slug = $1 AND lower(u.email) = lower($2)`,
    [parsed.data.tenant, parsed.data.email],
  );

  if (!user?.active || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    response.status(401).json({ message: 'Mandant, E-Mail oder Passwort ist falsch.' });
    return;
  }

  const { password_hash: _, active: __, ...safeUser } = user;
  response.json({ token: createToken(safeUser), user: safeUser });
});

const registerSchema = z.object({
  company: z.string().trim().min(2).max(120),
  tenant: z.string().trim().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  password: z.string().min(8).max(100),
});

router.post('/register', async (request, response) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      message: 'Bitte alle Felder ausfüllen. Der Mandant darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.',
    });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tenantResult = await client.query<{ id: string }>(
      'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
      [parsed.data.company, parsed.data.tenant],
    );
    const tenantId = tenantResult.rows[0]!.id;
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const userResult = await client.query<AuthUser>(
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, lower($3), $4, 'OWNER')
       RETURNING id, name, email, role, tenant_id AS "tenantId"`,
      [tenantId, parsed.data.name, parsed.data.email, passwordHash],
    );
    await client.query('COMMIT');
    const user = userResult.rows[0]!;
    response.status(201).json({ token: createToken(user), user });
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') {
      response.status(409).json({ message: 'Dieser Mandantenname ist bereits vergeben.' });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
});

router.get('/me', requireAuth, async (request: AuthRequest, response) => {
  const [tenant] = await query<{ name: string; slug: string }>(
    'SELECT name, slug FROM tenants WHERE id = $1',
    [request.user!.tenantId],
  );
  response.json({ user: request.user, tenant });
});

export default router;
