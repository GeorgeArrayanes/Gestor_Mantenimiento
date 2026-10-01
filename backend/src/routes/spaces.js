import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { httpError, parseId } from '../utils/maintenance.js';
import { transaction } from '../services/incident-service.js';

const router = Router();
router.use(requireRole('ADMIN'));
const schema = z.object({ name: z.string().trim().min(2).max(120), zone: z.string().trim().min(2).max(120), active: z.boolean().optional() }).strict();
router.get('/', asyncHandler(async (req, res) => {
  if (req.query.active && !['true','false'].includes(req.query.active)) throw httpError(400, 'Filtro de espacios inválido.');
  const { rows } = await req.app.locals.db.query(`SELECT * FROM maintenance_spaces ${req.query.active ? 'WHERE active=$1' : ''} ORDER BY zone,name`, req.query.active ? [req.query.active === 'true'] : []);
  res.json({ spaces: rows });
}));
router.post('/', asyncHandler(async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw httpError(400, 'Completa el nombre y la zona del espacio.');
  const d = parsed.data;
  const { rows } = await req.app.locals.db.query('INSERT INTO maintenance_spaces(name,zone,active) VALUES($1,$2,$3) RETURNING *', [d.name,d.zone,d.active ?? true]);
  res.status(201).json({ space: rows[0] });
}));
router.patch('/:id', asyncHandler(async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) throw httpError(400, 'Datos de espacio inválidos.');
  const space = await transaction(req.app.locals.db, async (client) => {
    const current = (await client.query('SELECT * FROM maintenance_spaces WHERE id=$1 FOR UPDATE', [parseId(req.params.id)])).rows[0];
    if (!current) throw httpError(404, 'Espacio inexistente.');
    const d = { ...current, ...parsed.data };
    return (await client.query('UPDATE maintenance_spaces SET name=$1,zone=$2,active=$3,updated_at=NOW() WHERE id=$4 RETURNING *', [d.name,d.zone,d.active,current.id])).rows[0];
  });
  res.json({ space });
}));
export default router;
