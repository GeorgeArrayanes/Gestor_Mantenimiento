import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { assertDriverCanBeInactivated } from '../services/driver-assignment.js';
import { isSuperAdminRole } from '../utils/roles.js';

const router = Router();
router.use(requireRole('ADMIN'));

const userSchema = z.object({
  name: z.string().trim().min(3).max(120),
  identification: z.string().trim().min(3).max(40),
  username: z.string().trim().min(3).max(120),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  password: z.string().min(8).optional(),
  status: z.enum(['ACTIVO', 'INACTIVO']).optional()
});

router.get('/', asyncHandler(async (req, res) => {
  const role = req.query.role === 'ADMIN' ? 'ADMIN' : 'CONDUCTOR';
  if (role === 'ADMIN' && !isSuperAdminRole(req.user.role)) {
    return res.status(403).json({ message: 'Sólo el superadministrador puede consultar administradores.' });
  }
  const { rows } = await req.app.locals.db.query(`
    SELECT u.id, u.name, u.identification, u.username, u.phone, u.role, u.status,
      b.id AS bus_id, b.reference AS bus_reference, b.plate AS bus_plate
    FROM users u LEFT JOIN buses b ON b.driver_id = u.id
    WHERE u.role = $1 ORDER BY u.name`, [role]);
  res.json({ users: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const parsed = userSchema.extend({ password: z.string().min(8), role: z.enum(['ADMIN', 'CONDUCTOR']).default('CONDUCTOR') }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Revisa los datos. La contraseña debe tener al menos 8 caracteres.' });
  const data = parsed.data;
  if (data.role === 'ADMIN' && !isSuperAdminRole(req.user.role)) {
    return res.status(403).json({ message: 'Sólo el superadministrador puede crear administradores.' });
  }
  if (data.role === 'ADMIN' && data.password.length < 12) {
    return res.status(400).json({ message: 'La contraseña de un administrador debe tener al menos 12 caracteres.' });
  }
  const passwordHash = await bcrypt.hash(data.password, 12);
  const { rows } = await req.app.locals.db.query(`
    INSERT INTO users (name, identification, username, phone, password_hash, role, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, identification, username, phone, role, status, created_at`,
    [data.name, data.identification, data.username, data.phone || null, passwordHash, data.role, data.status || 'ACTIVO']);
  res.status(201).json({ user: rows[0] });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const parsed = userSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Datos de usuario inválidos.' });
  const client = await req.app.locals.db.connect();
  try {
    await client.query('BEGIN');
    // Mantiene el mismo orden de bloqueo que la asignación de buses: bus y luego usuario.
    await client.query('SELECT id FROM buses WHERE driver_id=$1 FOR UPDATE', [req.params.id]);
    const current = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Usuario inexistente.' });
    }
    if (current.rows[0].role === 'SUPER_ADMIN') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'La cuenta del superadministrador no se modifica desde este módulo.' });
    }
    if (current.rows[0].role === 'ADMIN' && !isSuperAdminRole(req.user.role)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Sólo el superadministrador puede editar administradores.' });
    }
    if (current.rows[0].role === 'ADMIN' && parsed.data.password && parsed.data.password.length < 12) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'La contraseña de un administrador debe tener al menos 12 caracteres.' });
    }
    if (current.rows[0].role === 'CONDUCTOR' && current.rows[0].status === 'ACTIVO' && parsed.data.status === 'INACTIVO') {
      await assertDriverCanBeInactivated(client, current.rows[0].id);
    }
    const data = { ...current.rows[0], ...parsed.data };
    const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : current.rows[0].password_hash;
    const { rows } = await client.query(`UPDATE users SET name=$1, identification=$2, username=$3, phone=$4, status=$5, password_hash=$6, updated_at=NOW()
      WHERE id=$7 RETURNING id,name,identification,username,phone,role,status,created_at,updated_at`,
      [data.name, data.identification, data.username, data.phone || null, data.status, passwordHash, req.params.id]);
    await client.query('COMMIT');
    res.json({ user: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

export default router;
