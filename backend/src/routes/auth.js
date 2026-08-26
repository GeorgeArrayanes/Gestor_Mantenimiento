import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const loginSchema = z.object({ username: z.string().trim().min(3), password: z.string().min(6) });

function sessionCookieOptions() {
  const production = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    partitioned: production
  };
}

function publicUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

router.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Ingresa usuario y contraseña.' });
  const { rows } = await req.app.locals.db.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [parsed.data.username]);
  const user = rows[0];
  if (!user || user.status !== 'ACTIVO' || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    return res.status(401).json({ message: 'Credenciales incorrectas.' });
  }
  const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.cookie('rutasegura_token', token, {
    ...sessionCookieOptions(),
    maxAge: 8 * 60 * 60 * 1000
  });
  res.json({ user: publicUser(user), token });
}));

router.post('/logout', (req, res) => {
  res.clearCookie('rutasegura_token', sessionCookieOptions());
  res.json({ message: 'Sesión cerrada.' });
});

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await req.app.locals.db.query('SELECT id, name, identification, username, phone, role, status, created_at, updated_at FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0] || rows[0].status !== 'ACTIVO') return res.status(401).json({ message: 'Usuario inactivo o inexistente.' });
  res.json({ user: rows[0] });
}));

export default router;
