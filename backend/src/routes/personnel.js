import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { httpError, normalizePhone, parseId } from '../utils/maintenance.js';
import { transaction } from '../services/incident-service.js';

const router = Router();
router.use(requireRole('ADMIN'));
const phoneSchema = z.string().trim().min(7).max(40).refine((phone) => { try { normalizePhone(phone); return true; } catch { return false; } });
const schema = z.object({ name: z.string().trim().min(3).max(120), phone: phoneSchema, specialty: z.string().trim().min(2).max(120), notes: z.string().trim().max(2000).nullable().optional(), active: z.boolean().optional() }).strict();

router.get('/', asyncHandler(async (req, res) => {
  if (req.query.active && !['true','false'].includes(req.query.active)) throw httpError(400, 'Filtro de personal inválido.');
  const { rows } = await req.app.locals.db.query(`SELECT * FROM maintenance_personnel ${req.query.active ? 'WHERE active=$1' : ''} ORDER BY name`, req.query.active ? [req.query.active === 'true'] : []);
  res.json({ personnel: rows });
}));
router.post('/', asyncHandler(async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw httpError(400, 'Completa nombre y especialidad e ingresa un teléfono válido con código de país.');
  const d = parsed.data;
  const { rows } = await req.app.locals.db.query(`INSERT INTO maintenance_personnel(name,phone,specialty,notes,active) VALUES($1,$2,$3,$4,$5) RETURNING *`, [d.name,d.phone,d.specialty,d.notes || null,d.active ?? true]);
  res.status(201).json({ person: rows[0] });
}));
router.patch('/:id', asyncHandler(async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) throw httpError(400, 'Datos de personal inválidos. Verifica el teléfono y su código de país.');
  const person = await transaction(req.app.locals.db, async (client) => {
    const current = (await client.query('SELECT * FROM maintenance_personnel WHERE id=$1 FOR UPDATE', [parseId(req.params.id)])).rows[0];
    if (!current) throw httpError(404, 'Persona inexistente.');
    const d = { ...current, ...parsed.data };
    return (await client.query(`UPDATE maintenance_personnel SET name=$1,phone=$2,specialty=$3,notes=$4,active=$5,updated_at=NOW() WHERE id=$6 RETURNING *`, [d.name,d.phone,d.specialty,d.notes || null,d.active,current.id])).rows[0];
  });
  res.json({ person });
}));
export default router;
