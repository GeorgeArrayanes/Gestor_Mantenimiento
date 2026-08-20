import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { config } from '../config.js';
import { resolveFileUrl, saveFile } from '../services/storage.js';
import { assertTransition, eventNames } from '../services/incident-service.js';
import { externalNotifications } from '../services/external-notifications.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxFileSize, files: 5 } });
const incidentSchema = z.object({
  bus_id: z.coerce.number().int().positive(),
  damage_type: z.enum(['CARROCERIA','LLANTAS','LUCES_ELECTRICO','MOTOR','FRENOS','INTERIOR','VIDRIOS','PUERTAS','OTRO']),
  other_damage_type: z.string().trim().max(120).optional(),
  description: z.string().trim().min(10).max(4000),
  urgency: z.enum(['BAJA','MEDIA','ALTA'])
}).refine((data) => data.damage_type !== 'OTRO' || data.other_damage_type?.length, { message: 'Describe el otro tipo de daño.' });

async function getIncident(db, id) {
  const { rows } = await db.query(`SELECT i.*,b.reference,b.plate,b.brand,b.model,b.route,b.capacity,
    driver.name AS driver_name,driver.phone AS driver_phone,reporter.name AS reporter_name
    FROM incidents i JOIN buses b ON b.id=i.bus_id
    LEFT JOIN users driver ON driver.id=i.responsible_driver_id
    JOIN users reporter ON reporter.id=i.reported_by WHERE i.id=$1`, [id]);
  return rows[0];
}

function assertCanView(incident, user) {
  if (!incident) { const e = new Error('Novedad inexistente.'); e.status = 404; throw e; }
  if (user.role === 'CONDUCTOR' && incident.responsible_driver_id !== user.id) {
    const e = new Error('No tienes acceso a esta novedad.'); e.status = 403; throw e;
  }
}

router.get('/', asyncHandler(async (req, res) => {
  const conditions = [];
  const values = [];
  const add = (sql, value) => { values.push(value); conditions.push(sql.replace('?', `$${values.length}`)); };
  if (req.user.role === 'CONDUCTOR') add('i.responsible_driver_id=?', req.user.id);
  if (req.query.status) add('i.status=?', req.query.status);
  if (req.query.urgency) add('i.urgency=?', req.query.urgency);
  if (req.query.bus_id) add('i.bus_id=?', Number(req.query.bus_id));
  if (req.query.search) add(`(CAST(i.id AS TEXT) ILIKE ? OR b.reference ILIKE ? OR b.plate ILIKE ? OR i.description ILIKE ?)`, `%${req.query.search}%`);
  // The search condition has four placeholders and is handled separately.
  if (req.query.search) {
    conditions.pop(); values.pop();
    const q = `%${req.query.search}%`;
    const start = values.length + 1;
    values.push(q,q,q,q);
    conditions.push(`(CAST(i.id AS TEXT) ILIKE $${start} OR b.reference ILIKE $${start+1} OR b.plate ILIKE $${start+2} OR i.description ILIKE $${start+3})`);
  }
  const order = req.query.order === 'oldest' ? 'ASC' : 'DESC';
  const { rows } = await req.app.locals.db.query(`SELECT i.*,b.reference,b.plate,b.brand,b.model,u.name AS driver_name
    FROM incidents i JOIN buses b ON b.id=i.bus_id LEFT JOIN users u ON u.id=i.responsible_driver_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY i.reported_at ${order}`, values);
  res.json({ incidents: rows });
}));

router.post('/', requireRole('ADMIN'), upload.array('files', 5), asyncHandler(async (req, res) => {
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Revisa los datos obligatorios.' });
  const client = await req.app.locals.db.connect();
  try {
    await client.query('BEGIN');
    const busResult = await client.query('SELECT * FROM buses WHERE id=$1', [parsed.data.bus_id]);
    const bus = busResult.rows[0];
    if (!bus) { const e = new Error('Bus inexistente.'); e.status = 404; throw e; }
    if (!bus.driver_id) { const e = new Error('Asigna un conductor al bus antes de crear la novedad.'); e.status = 409; throw e; }
    const d = parsed.data;
    const created = await client.query(`INSERT INTO incidents(bus_id,reported_by,responsible_driver_id,damage_type,other_damage_type,description,urgency)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [d.bus_id,req.user.id,bus.driver_id,d.damage_type,d.damage_type==='OTRO'?d.other_damage_type:null,d.description,d.urgency]);
    const incident = created.rows[0];
    for (const file of req.files || []) {
      const url = await saveFile(file, incident.id);
      await client.query(`INSERT INTO evidences(incident_id,file_url,file_name,file_type,category,uploaded_by) VALUES($1,$2,$3,$4,'REPORTE',$5)`, [incident.id,url,file.originalname,file.mimetype,req.user.id]);
    }
    await client.query(`INSERT INTO incident_history(incident_id,user_id,event_type,new_status,comment) VALUES($1,$2,'NOVEDAD_CREADA','REPORTADO',$3)`, [incident.id,req.user.id,d.description]);
    await client.query(`INSERT INTO notifications(user_id,message,type,reference_url) VALUES($1,$2,'NUEVA_NOVEDAD',$3)`, [bus.driver_id,`Nueva novedad asignada a ${bus.reference}.`,`/novedades/${incident.id}`]);
    await client.query(`UPDATE buses SET current_status='CON_NOVEDADES',updated_at=NOW() WHERE id=$1`, [bus.id]);
    await client.query('COMMIT');
    await externalNotifications.sendIncidentAssigned({ incident, bus });
    res.status(201).json({ incident: await getIncident(req.app.locals.db, incident.id) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const incident = await getIncident(req.app.locals.db, req.params.id);
  assertCanView(incident, req.user);
  const [evidences, history] = await Promise.all([
    req.app.locals.db.query(`SELECT e.*,u.name AS uploaded_by_name FROM evidences e JOIN users u ON u.id=e.uploaded_by WHERE incident_id=$1 ORDER BY e.created_at`, [incident.id]),
    req.app.locals.db.query(`SELECT h.*,u.name AS user_name,u.role AS user_role FROM incident_history h JOIN users u ON u.id=h.user_id WHERE incident_id=$1 ORDER BY h.created_at`, [incident.id])
  ]);
  const resolvedEvidences = await Promise.all(evidences.rows.map(async (item) => ({ ...item, file_url: await resolveFileUrl(item.file_url) })));
  res.json({ incident, evidences: resolvedEvidences, history: history.rows });
}));

router.post('/:id/evidences', upload.array('files', 5), asyncHandler(async (req, res) => {
  const incident = await getIncident(req.app.locals.db, req.params.id);
  assertCanView(incident, req.user);
  if (req.user.role !== 'CONDUCTOR' || incident.status !== 'EN_PROCESO') return res.status(409).json({ message: 'Sólo puedes agregar evidencia durante una reparación activa.' });
  if (!req.files?.length) return res.status(400).json({ message: 'Selecciona al menos un archivo.' });
  const rejection = await req.app.locals.db.query(`SELECT 1 FROM incident_history WHERE incident_id=$1 AND event_type='REPARACION_RECHAZADA' LIMIT 1`, [incident.id]);
  const category = rejection.rowCount ? 'CORRECCION' : 'SOLUCION';
  const saved = [];
  for (const file of req.files) {
    const url = await saveFile(file, incident.id);
    const { rows } = await req.app.locals.db.query(`INSERT INTO evidences(incident_id,file_url,file_name,file_type,category,uploaded_by,comment) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [incident.id,url,file.originalname,file.mimetype,category,req.user.id,req.body.comment?.trim()||null]);
    saved.push(rows[0]);
  }
  await req.app.locals.db.query(`INSERT INTO incident_history(incident_id,user_id,event_type,new_status,comment) VALUES($1,$2,'EVIDENCIA_AGREGADA',$3,$4)`, [incident.id,req.user.id,incident.status,req.body.comment?.trim()||`${saved.length} archivo(s)`]);
  res.status(201).json({ evidences: saved });
}));

router.post('/:id/:action', asyncHandler(async (req, res) => {
  const { action } = req.params;
  if (!['start', 'submit', 'approve', 'reject'].includes(action)) return res.status(404).json({ message: 'Acción inexistente.' });
  const client = await req.app.locals.db.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query('SELECT * FROM incidents WHERE id=$1 FOR UPDATE', [req.params.id]);
    const incident = locked.rows[0];
    assertCanView(incident, req.user);
    const nextStatus = assertTransition(action, incident, req.user);
    if (action === 'reject' && !req.body.reason?.trim()) { const e = new Error('El motivo del rechazo es obligatorio.'); e.status = 400; throw e; }
    if (action === 'submit') {
      const lastStart = await client.query(`SELECT created_at FROM incident_history WHERE incident_id=$1 AND event_type='REPARACION_INICIADA' ORDER BY created_at DESC LIMIT 1`, [incident.id]);
      const evidence = lastStart.rows[0]
        ? await client.query(`SELECT 1 FROM evidences WHERE incident_id=$1 AND category IN ('SOLUCION','CORRECCION') AND created_at >= $2 LIMIT 1`, [incident.id,lastStart.rows[0].created_at])
        : { rowCount: 0 };
      if (!evidence.rowCount) { const e = new Error('Adjunta evidencia de la reparación antes de enviarla.'); e.status = 400; throw e; }
    }
    const comment = req.body.comment?.trim() || req.body.reason?.trim() || null;
    await client.query(`UPDATE incidents SET status=$1,
      attention_started_at=CASE WHEN $2='start' THEN COALESCE(attention_started_at,NOW()) ELSE attention_started_at END,
      last_solution_at=CASE WHEN $2='submit' THEN NOW() ELSE last_solution_at END,
      resolved_at=CASE WHEN $2='approve' THEN NOW() ELSE resolved_at END, updated_at=NOW() WHERE id=$3`, [nextStatus,action,incident.id]);
    await client.query(`INSERT INTO incident_history(incident_id,user_id,event_type,previous_status,new_status,comment) VALUES($1,$2,$3,$4,$5,$6)`, [incident.id,req.user.id,eventNames[action],incident.status,nextStatus,comment]);
    if (action === 'submit') {
      await client.query(`INSERT INTO notifications(user_id,message,type,reference_url)
        SELECT id,$1,'REVISION_PENDIENTE',$2 FROM users WHERE role='ADMIN' AND status='ACTIVO'`, [`La novedad #${incident.id} espera validación.`,`/novedades/${incident.id}`]);
    }
    if (action === 'reject' || action === 'approve') {
      const message = action === 'reject' ? `Tu reparación #${incident.id} fue rechazada: ${comment}` : `Tu reparación #${incident.id} fue aprobada.`;
      await client.query(`INSERT INTO notifications(user_id,message,type,reference_url) VALUES($1,$2,$3,$4)`, [incident.responsible_driver_id,message,action==='reject'?'CORRECCION_REQUERIDA':'REPARACION_APROBADA',`/novedades/${incident.id}`]);
    }
    if (action === 'approve') {
      const open = await client.query(`SELECT 1 FROM incidents WHERE bus_id=$1 AND id<>$2 AND status<>'RESUELTO' LIMIT 1`, [incident.bus_id,incident.id]);
      if (!open.rowCount) await client.query(`UPDATE buses SET current_status='OPERATIVO',updated_at=NOW() WHERE id=$1`, [incident.bus_id]);
    }
    await client.query('COMMIT');
    res.json({ incident: await getIncident(req.app.locals.db, incident.id) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}));

export default router;
