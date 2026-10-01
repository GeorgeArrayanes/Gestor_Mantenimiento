import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { httpError, parseId } from '../utils/maintenance.js';
import { transaction } from '../services/incident-service.js';

const router = Router();
router.use(requireRole('SUPER_ADMIN'));
const schema = z.object({ name: z.string().trim().min(3).max(120), identification: z.string().trim().min(3).max(40), username: z.string().trim().min(3).max(120), phone: z.string().trim().max(30).optional().or(z.literal('')), password: z.string().min(12).max(128).optional(), status: z.enum(['ACTIVO','INACTIVO']).optional() }).strict();
const fields = 'id,name,identification,username,phone,role,status,created_at,updated_at';

router.get('/', asyncHandler(async (req, res) => {
  if (req.query.role && !['ADMIN','SUPER_ADMIN'].includes(req.query.role)) throw httpError(400, 'Rol administrativo inválido.');
  const { rows } = await req.app.locals.db.query(`SELECT ${fields} FROM users WHERE ${req.query.role ? 'role=$1' : "role IN ('ADMIN','SUPER_ADMIN')"} ORDER BY name`, req.query.role ? [req.query.role] : []);
  res.json({ users: rows });
}));
router.post('/', asyncHandler(async (req, res) => {
  const parsed = schema.extend({ password: z.string().min(12).max(128), role: z.literal('ADMIN').default('ADMIN') }).safeParse(req.body);
  if (!parsed.success) throw httpError(400, 'Completa los datos del administrador y una contraseña de al menos 12 caracteres.');
  const d = parsed.data;
  const password = await bcrypt.hash(d.password, 12);
  const { rows } = await req.app.locals.db.query(`INSERT INTO users(name,identification,username,phone,password_hash,role,status) VALUES($1,$2,$3,$4,$5,'ADMIN',$6) RETURNING ${fields}`, [d.name,d.identification,d.username,d.phone || null,password,d.status || 'ACTIVO']);
  res.status(201).json({ user: rows[0] });
}));
router.patch('/:id', asyncHandler(async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) throw httpError(400, 'Datos de administrador inválidos. La contraseña debe tener al menos 12 caracteres.');
  const user = await transaction(req.app.locals.db, async (client) => {
    const current = (await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [parseId(req.params.id)])).rows[0];
    if (!current) throw httpError(404, 'Administrador inexistente.');
    if (current.role !== 'ADMIN') throw httpError(403, 'Sólo se pueden editar administradores desde este módulo. La cuenta principal se administra mediante el proceso seguro de configuración.');
    const d = { ...current, ...parsed.data };
    const hash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : current.password_hash;
    return (await client.query(`UPDATE users SET name=$1,identification=$2,username=$3,phone=$4,status=$5,password_hash=$6,updated_at=NOW() WHERE id=$7 RETURNING ${fields}`, [d.name,d.identification,d.username,d.phone || null,d.status,hash,current.id])).rows[0];
  });
  res.json({ user });
}));
export default router;
