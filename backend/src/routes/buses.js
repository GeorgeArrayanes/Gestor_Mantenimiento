import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { config } from '../config.js';
import { resolveFileUrl, saveFile } from '../services/storage.js';
import { assertActiveDriver, assertBusDriverCanChange } from '../services/driver-assignment.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxFileSize, files: 1 } });
const busSchema = z.object({
  reference: z.string().trim().min(2).max(40), plate: z.string().trim().min(5).max(20),
  brand: z.string().trim().min(2).max(80), model: z.string().trim().min(1).max(80),
  route: z.string().trim().max(160).optional().or(z.literal('')),
  capacity: z.coerce.number().int().positive().max(100),
  current_status: z.enum(['OPERATIVO','CON_NOVEDADES','EN_MANTENIMIENTO','FUERA_DE_SERVICIO']),
  driver_id: z.union([z.coerce.number().int().positive(), z.null()]).optional()
});

router.get('/', asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.role === 'CONDUCTOR') { params.push(req.user.id); where = 'WHERE b.driver_id = $1'; }
  const { rows } = await req.app.locals.db.query(`
    SELECT b.*, u.name AS driver_name
    FROM buses b LEFT JOIN users u ON u.id=b.driver_id
    ${where} ORDER BY b.reference`, params);
  const counts = await req.app.locals.db.query(`SELECT bus_id, COUNT(*)::int AS total FROM incidents WHERE status <> 'RESUELTO' GROUP BY bus_id`);
  const countByBus = new Map(counts.rows.map((item) => [item.bus_id, item.total]));
  res.json({ buses: rows.map((bus) => ({ ...bus, active_incidents: countByBus.get(bus.id) || 0 })) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await req.app.locals.db.query(`SELECT b.*,u.name AS driver_name,u.phone AS driver_phone FROM buses b LEFT JOIN users u ON u.id=b.driver_id WHERE b.id=$1`, [req.params.id]);
  const bus = rows[0];
  if (!bus) return res.status(404).json({ message: 'Bus inexistente.' });
  if (req.user.role === 'CONDUCTOR' && bus.driver_id !== req.user.id) return res.status(403).json({ message: 'No tienes acceso a este bus.' });
  const [damages, summary, recent] = await Promise.all([
    req.app.locals.db.query(`SELECT p.*,u.name AS registered_by_name FROM preexisting_damages p JOIN users u ON u.id=p.registered_by WHERE p.bus_id=$1 ORDER BY p.damage_date DESC`, [bus.id]),
    req.app.locals.db.query(`SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status <> 'RESUELTO')::int AS active,
      COUNT(*) FILTER (WHERE status = 'RESUELTO')::int AS resolved,
      MAX(reported_at) AS last_reported_at
      FROM incidents WHERE bus_id=$1`, [bus.id]),
    req.app.locals.db.query(`SELECT id,damage_type,other_damage_type,status,urgency,reported_at
      FROM incidents WHERE bus_id=$1 ORDER BY reported_at DESC LIMIT 4`, [bus.id])
  ]);
  const preexistingDamages = await Promise.all(damages.rows.map(async (item) => ({ ...item, file_url: await resolveFileUrl(item.file_url) })));
  res.json({ bus, preexistingDamages, incidentSummary: summary.rows[0], recentIncidents: recent.rows });
}));

router.post('/', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const parsed = busSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Revisa los datos obligatorios del bus.' });
  const d = parsed.data;
  const client = await req.app.locals.db.connect();
  try {
    await client.query('BEGIN');
    await assertActiveDriver(client, d.driver_id, { lock: true });
    const { rows } = await client.query(`INSERT INTO buses(reference,plate,brand,model,route,capacity,current_status,driver_id)
      VALUES($1,UPPER($2),$3,$4,$5,$6,$7,$8) RETURNING *`, [d.reference,d.plate,d.brand,d.model,d.route||null,d.capacity,d.current_status,d.driver_id||null]);
    await client.query('COMMIT');
    res.status(201).json({ bus: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.patch('/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const parsed = busSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Datos del bus inválidos.' });
  const client = await req.app.locals.db.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT * FROM buses WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Bus inexistente.' });
    }
    const d = { ...current.rows[0], ...parsed.data };
    await assertActiveDriver(client, d.driver_id, { lock: true });
    await assertBusDriverCanChange(client, current.rows[0].id, current.rows[0].driver_id, d.driver_id);
    const { rows } = await client.query(`UPDATE buses SET reference=$1,plate=UPPER($2),brand=$3,model=$4,route=$5,capacity=$6,current_status=$7,driver_id=$8,updated_at=NOW() WHERE id=$9 RETURNING *`,
      [d.reference,d.plate,d.brand,d.model,d.route||null,d.capacity,d.current_status,d.driver_id||null,req.params.id]);
    await client.query('COMMIT');
    res.json({ bus: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.post('/:id/preexisting-damages', requireRole('ADMIN'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.body.description?.trim() || !req.body.damage_date) return res.status(400).json({ message: 'Descripción y fecha son obligatorias.' });
  const bus = await req.app.locals.db.query('SELECT id FROM buses WHERE id=$1', [req.params.id]);
  if (!bus.rows[0]) return res.status(404).json({ message: 'Bus inexistente.' });
  const fileUrl = req.file ? await saveFile(req.file, `preexistente-${req.params.id}`) : null;
  const { rows } = await req.app.locals.db.query(`INSERT INTO preexisting_damages(bus_id,description,file_url,damage_date,registered_by) VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.id,req.body.description.trim(),fileUrl,req.body.damage_date,req.user.id]);
  res.status(201).json({ damage: rows[0] });
}));

export default router;
