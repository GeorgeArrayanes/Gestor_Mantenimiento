import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { config } from '../config.js';
import { deleteFile, validateUploads } from '../services/storage.js';
import { activePerson, activeSpace, addHistory, assertOpen, getIncident, incidentSelect, lockIncident, persistEvidence, publicIncident, transaction } from '../services/incident-service.js';
import { createExcelReport, createPdfReport, reportWindow } from '../services/incident-report.js';
import { buildWhatsApp, httpError, INCIDENT_STATUSES, parseId, PRIORITIES, PROBLEM_TYPES } from '../utils/maintenance.js';

const router = Router();
router.use(requireRole('ADMIN'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxFileSize, files: config.maxFiles, fields: 10, parts: 15 } });
const incidentSchema = z.object({
  space_id: z.coerce.number().int().positive(),
  problem_type: z.enum(PROBLEM_TYPES), priority: z.enum(PRIORITIES),
  description: z.string().trim().min(10).max(4000),
  assigned_person_id: z.preprocess((v) => v === '' || v === null ? undefined : v, z.coerce.number().int().positive().optional())
}).strict();
function parse(schema, body, message) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw httpError(400, message);
  return parsed.data;
}

router.get('/', asyncHandler(async (req, res) => {
  const conditions = [];
  const values = [];
  const add = (sql, value) => { values.push(value); conditions.push(sql.replace('?', `$${values.length}`)); };
  if (req.query.status) {
    if (!INCIDENT_STATUSES.includes(req.query.status)) throw httpError(400, 'Estado inválido.');
    add('i.status=?', req.query.status);
  }
  if (req.query.priority) {
    if (!PRIORITIES.includes(req.query.priority)) throw httpError(400, 'Prioridad inválida.');
    add('i.priority=?', req.query.priority);
  }
  if (req.query.assigned_person_id) add('i.assigned_person_id=?', parseId(req.query.assigned_person_id));
  if (req.query.space_id) add('i.space_id=?', parseId(req.query.space_id));
  for (const [key, comparison] of [['date_from','>='],['date_to','<']]) {
    if (!req.query[key]) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query[key]) || Number.isNaN(Date.parse(req.query[key]))) throw httpError(400, 'Fecha de filtro inválida.');
    const date = new Date(`${req.query[key]}T00:00:00-05:00`);
    if (key === 'date_to') date.setUTCDate(date.getUTCDate() + 1);
    add(`i.created_at${comparison}?`, date);
  }
  if (req.query.search) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 200) throw httpError(400, 'Búsqueda inválida.');
    const q = `%${req.query.search.trim()}%`;
    const start = values.length + 1;
    values.push(q,q,q,q,q);
    conditions.push(`(i.code ILIKE $${start} OR i.description ILIKE $${start+1} OR i.space_name_snapshot ILIKE $${start+2} OR i.space_zone_snapshot ILIKE $${start+3} OR i.assigned_person_name_snapshot ILIKE $${start+4})`);
  }
  const order = req.query.order === 'oldest' ? 'ASC' : 'DESC';
  const { rows } = await req.app.locals.db.query(`${incidentSelect} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY CASE WHEN i.status='CLOSED' THEN 1 ELSE 0 END, CASE i.priority WHEN 'ALTA' THEN 0 WHEN 'MEDIA' THEN 1 ELSE 2 END,i.created_at ${order},i.id ${order}`, values);
  const initialImages = new Map();
  if (rows.length) {
    // Select one image per returned incident in a single query. File bytes remain
    // behind the existing authorized endpoint; storage keys never enter this API.
    const ids = rows.map((incident) => incident.id);
    const { rows: images } = await req.app.locals.db.query(`SELECT DISTINCT ON (incident_id)
      id,incident_id,file_name,file_type,file_size,category
      FROM maintenance_evidences
      WHERE incident_id IN (${ids.map((_, index) => `$${index + 1}`).join(',')})
        AND category='INITIAL' AND file_type IN ('image/jpeg','image/png','image/webp')
      ORDER BY incident_id,created_at ASC,id ASC`, ids);
    for (const image of images) initialImages.set(image.incident_id, {
      id: image.id,
      file_name: image.file_name,
      file_type: image.file_type,
      file_size: image.file_size,
      category: image.category,
      file_url: `/api/evidences/${image.id}/download`,
    });
  }
  res.json({ incidents: rows.map((row) => ({ ...publicIncident(row), initial_evidence: initialImages.get(row.id) || null })) });
}));

router.post('/', upload.array('files', config.maxFiles), asyncHandler(async (req, res) => {
  const d = parse(incidentSchema, req.body, 'Selecciona espacio, tipo y prioridad e ingresa una descripción de al menos 10 caracteres.');
  validateUploads(req.files);
  const id = await transaction(req.app.locals.db, async (client, savedKeys) => {
    const space = await activeSpace(client, d.space_id);
    const person = d.assigned_person_id ? await activePerson(client, d.assigned_person_id) : null;
    const status = person ? 'ASSIGNED' : 'PENDING';
    const now = new Date();
    const { rows } = await client.query(`INSERT INTO maintenance_incidents(space_id,space_name_snapshot,space_zone_snapshot,problem_type,priority,description,assigned_person_id,assigned_person_name_snapshot,assigned_person_phone_snapshot,status,created_by,assigned_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [space.id,space.name,space.zone,d.problem_type,d.priority,d.description,person?.id || null,person?.name || null,person?.phone || null,status,req.user.id,person ? now : null]);
    const incident = rows[0];
    const year = new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric' }).format(new Date(incident.created_at));
    const code = `MT-${year}-${String(incident.id).padStart(3, '0')}`;
    await client.query('UPDATE maintenance_incidents SET code=$1 WHERE id=$2', [code,incident.id]);
    await persistEvidence(client, req.files, incident.id, req.user.id, 'INITIAL', savedKeys);
    await addHistory(client, { id: incident.id, status: null }, req.user.id, 'INCIDENCIA_CREADA', 'PENDING', d.description);
    if (person) await addHistory(client, { id: incident.id, status: 'PENDING' }, req.user.id, 'RESPONSABLE_ASIGNADO', 'ASSIGNED', `Asignada a ${person.name}.`);
    return incident.id;
  });
  res.status(201).json({ incident: await getIncident(req.app.locals.db, id) });
}));

router.get('/reports/export', asyncHandler(async (req, res) => {
  const d = parse(z.object({ period: z.enum(['day', 'month', 'year']), date: z.string(), format: z.enum(['pdf', 'xlsx']) }).strict(), req.query, 'Selecciona el periodo y formato del reporte.');
  const window = reportWindow(d.period, d.date);
  const { rows } = await req.app.locals.db.query(`${incidentSelect}
    WHERE i.created_at >= $1 AND i.created_at < $2
    ORDER BY i.created_at ASC,i.id ASC LIMIT 10001`, [window.start, window.end]);
  if (rows.length > 10000) throw httpError(413, 'El reporte supera 10.000 incidencias. Selecciona un periodo más corto.');
  const incidents = rows.map(publicIncident);
  const file = d.format === 'pdf' ? await createPdfReport(incidents, window.label) : await createExcelReport(incidents, window.label);
  const contentType = d.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  res.set({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="reporte-incidencias-${window.suffix}.${d.format}"`,
    'Content-Length': String(file.length),
    'Cache-Control': 'no-store',
  });
  res.send(file);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const incident = await getIncident(req.app.locals.db, req.params.id);
  const [evidences, history] = await Promise.all([
    req.app.locals.db.query(`SELECT e.id,e.incident_id,e.file_name,e.file_type,e.file_size,e.category,e.uploaded_by,e.created_at,u.name AS uploaded_by_name FROM maintenance_evidences e JOIN users u ON u.id=e.uploaded_by WHERE e.incident_id=$1 ORDER BY e.created_at,e.id`, [incident.id]),
    req.app.locals.db.query(`SELECT h.*,u.name AS user_name,u.role AS user_role FROM maintenance_history h JOIN users u ON u.id=h.user_id WHERE h.incident_id=$1 ORDER BY h.created_at,h.id`, [incident.id])
  ]);
  res.json({ incident, evidences: evidences.rows.map((e) => ({ ...e, file_url: `/api/evidences/${e.id}/download` })), history: history.rows });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await transaction(req.app.locals.db, async (client) => {
    const incident = await lockIncident(client, req.params.id);
    const { rows: evidence } = await client.query('SELECT storage_key FROM maintenance_evidences WHERE incident_id=$1', [incident.id]);
    await client.query('DELETE FROM maintenance_history WHERE incident_id=$1', [incident.id]);
    await client.query('DELETE FROM maintenance_evidences WHERE incident_id=$1', [incident.id]);
    await client.query('DELETE FROM maintenance_incidents WHERE id=$1', [incident.id]);
    return { id: incident.id, code: incident.code, storageKeys: evidence.map((item) => item.storage_key) };
  });
  const cleanup = await Promise.allSettled(deleted.storageKeys.map((key) => deleteFile(key)));
  for (const result of cleanup) if (result.status === 'rejected') console.error('No fue posible retirar una evidencia de la incidencia eliminada.', result.reason.message);
  res.json({ deleted: true, incident: { id: deleted.id, code: deleted.code } });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const d = parse(incidentSchema.omit({ assigned_person_id: true }).partial(), req.body, 'Datos de incidencia inválidos.');
  if (!Object.keys(d).length) throw httpError(400, 'Indica los datos que deseas actualizar.');
  const id = await transaction(req.app.locals.db, async (client) => {
    const current = await lockIncident(client, req.params.id);
    assertOpen(current);
    const space = d.space_id && d.space_id !== current.space_id ? await activeSpace(client, d.space_id) : null;
    const changed = { ...current, ...d };
    await client.query(`UPDATE maintenance_incidents SET space_id=$1,space_name_snapshot=$2,space_zone_snapshot=$3,problem_type=$4,priority=$5,description=$6,updated_at=NOW() WHERE id=$7`, [changed.space_id,space?.name || current.space_name_snapshot,space?.zone || current.space_zone_snapshot,changed.problem_type,changed.priority,changed.description,current.id]);
    await addHistory(client, current, req.user.id, 'INCIDENCIA_EDITADA', current.status, 'Datos de la incidencia actualizados.');
    return current.id;
  });
  res.json({ incident: await getIncident(req.app.locals.db, id) });
}));

router.post('/:id/assign', asyncHandler(async (req, res) => {
  const d = parse(z.object({ assigned_person_id: z.coerce.number().int().positive() }).strict(), req.body, 'Selecciona un responsable válido.');
  const id = await transaction(req.app.locals.db, async (client) => {
    const current = await lockIncident(client, req.params.id);
    assertOpen(current);
    const person = await activePerson(client, d.assigned_person_id);
    if (current.assigned_person_id === person.id) throw httpError(409, 'Esta persona ya es responsable de la incidencia.');
    await client.query(`UPDATE maintenance_incidents SET assigned_person_id=$1,assigned_person_name_snapshot=$2,assigned_person_phone_snapshot=$3,status='ASSIGNED',assigned_at=NOW(),updated_at=NOW() WHERE id=$4`, [person.id,person.name,person.phone,current.id]);
    await addHistory(client, current, req.user.id, current.assigned_person_id ? 'RESPONSABLE_CAMBIADO' : 'RESPONSABLE_ASIGNADO', 'ASSIGNED', current.assigned_person_id ? `Responsable cambiado de ${current.assigned_person_name_snapshot} a ${person.name}.` : `Asignada a ${person.name}.`);
    return current.id;
  });
  res.json({ incident: await getIncident(req.app.locals.db, id) });
}));

router.post('/:id/close', upload.array('files', config.maxFiles), asyncHandler(async (req, res) => {
  const d = parse(z.object({ resolution_notes: z.string().trim().min(10).max(4000), confirmed: z.literal('true') }).strict(), req.body, 'Describe la solución (mínimo 10 caracteres) y confirma el cierre de la incidencia.');
  validateUploads(req.files, { required: true });
  const id = await transaction(req.app.locals.db, async (client, savedKeys) => {
    const current = await lockIncident(client, req.params.id);
    assertOpen(current);
    if (current.status !== 'ASSIGNED') throw httpError(409, 'Asigna un responsable antes de registrar la solución.');
    await persistEvidence(client, req.files, current.id, req.user.id, 'FINAL', savedKeys);
    await addHistory(client, current, req.user.id, 'SOLUCION_REGISTRADA', current.status, d.resolution_notes);
    await client.query(`UPDATE maintenance_incidents SET status='CLOSED',resolution_notes=$1,closed_at=NOW(),updated_at=NOW() WHERE id=$2`, [d.resolution_notes,current.id]);
    await addHistory(client, current, req.user.id, 'INCIDENCIA_CERRADA', 'CLOSED', 'Solución verificada y cierre confirmado por el administrador.');
    return current.id;
  });
  res.json({ incident: await getIncident(req.app.locals.db, id) });
}));

router.get('/:id/whatsapp', asyncHandler(async (req, res) => {
  res.json(buildWhatsApp(await getIncident(req.app.locals.db, req.params.id)));
}));
export default router;
