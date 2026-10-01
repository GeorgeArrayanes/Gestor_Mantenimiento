import { httpError, parseId } from '../utils/maintenance.js';
import { deleteFile, saveFile, safeFileName } from './storage.js';

export const incidentSelect = `SELECT i.*, i.space_name_snapshot AS space_name,i.space_zone_snapshot AS space_zone,
  i.assigned_person_name_snapshot AS assigned_person_name,i.assigned_person_phone_snapshot AS assigned_person_phone,
  p.phone AS assigned_person_current_phone,
  u.name AS created_by_name FROM maintenance_incidents i JOIN users u ON u.id=i.created_by LEFT JOIN maintenance_personnel p ON p.id=i.assigned_person_id`;

export function publicIncident(row) {
  if (!row) return row;
  const { space_name_snapshot, space_zone_snapshot, assigned_person_name_snapshot, assigned_person_phone_snapshot, ...incident } = row;
  return incident;
}
export async function getIncident(db, id) {
  const { rows } = await db.query(`${incidentSelect} WHERE i.id=$1`, [parseId(id)]);
  if (!rows[0]) throw httpError(404, 'Incidencia inexistente.');
  return publicIncident(rows[0]);
}
export async function lockIncident(client, id) {
  const { rows } = await client.query('SELECT * FROM maintenance_incidents WHERE id=$1 FOR UPDATE', [parseId(id)]);
  if (!rows[0]) throw httpError(404, 'Incidencia inexistente.');
  return rows[0];
}
export function assertOpen(incident) {
  if (incident.status === 'CLOSED') throw httpError(409, 'La incidencia está cerrada y su registro es inmutable.');
}
export async function activeSpace(client, id) {
  const { rows } = await client.query('SELECT * FROM maintenance_spaces WHERE id=$1 FOR UPDATE', [id]);
  if (!rows[0]) throw httpError(404, 'Espacio inexistente.');
  if (!rows[0].active) throw httpError(409, 'Selecciona un espacio activo.');
  return rows[0];
}
export async function activePerson(client, id) {
  const { rows } = await client.query('SELECT * FROM maintenance_personnel WHERE id=$1 FOR UPDATE', [id]);
  if (!rows[0]) throw httpError(404, 'Persona inexistente.');
  if (!rows[0].active) throw httpError(409, 'Selecciona una persona activa.');
  return rows[0];
}
export async function addHistory(client, incident, userId, eventType, newStatus, comment) {
  await client.query(`INSERT INTO maintenance_history(incident_id,user_id,event_type,previous_status,new_status,comment) VALUES($1,$2,$3,$4,$5,$6)`, [incident.id,userId,eventType,incident.status || null,newStatus,comment || null]);
}
export async function persistEvidence(client, files, incidentId, userId, category, savedKeys) {
  for (const file of files || []) {
    const key = await saveFile(file, incidentId);
    savedKeys.push(key);
    await client.query(`INSERT INTO maintenance_evidences(incident_id,storage_key,file_name,file_type,file_size,category,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7)`, [incidentId,key,safeFileName(file.originalname),file.mimetype,file.buffer.length,category,userId]);
  }
}
export async function transaction(pool, operation) {
  const client = await pool.connect();
  const savedKeys = [];
  try {
    await client.query('BEGIN');
    const result = await operation(client, savedKeys);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('No fue posible revertir la transacción.', rollbackError.message); }
    const cleanup = await Promise.allSettled(savedKeys.map((key) => deleteFile(key)));
    for (const result of cleanup) if (result.status === 'rejected') console.error('Falló la compensación de almacenamiento.', result.reason.message);
    throw error;
  } finally { client.release(); }
}
