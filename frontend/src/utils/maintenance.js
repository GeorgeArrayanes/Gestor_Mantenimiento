export const PROBLEM_TYPES = [
  ['ELECTRICIDAD', 'Electricidad'], ['PLOMERIA', 'Plomería'], ['CARPINTERIA', 'Carpintería'],
  ['PINTURA', 'Pintura'], ['INFRAESTRUCTURA', 'Infraestructura'], ['ILUMINACION', 'Iluminación'],
  ['MOBILIARIO', 'Mobiliario'], ['EQUIPOS', 'Equipos'], ['CERRAJERIA', 'Cerrajería'], ['OTRO', 'Otro'],
];
export const PRIORITIES = [['ALTA', 'Alta'], ['MEDIA', 'Media'], ['BAJA', 'Baja']];
export const STATUSES = [['PENDING', 'Sin asignar'], ['ASSIGNED', 'Asignada'], ['CLOSED', 'Cerrada']];
export const EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024;
export const MAX_EVIDENCE_FILES = 5;

export function problemLabel(value) { return PROBLEM_TYPES.find(([key]) => key === value)?.[1] || value || 'Sin tipo'; }
export function formatDate(value, includeTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', ...(includeTime ? { timeStyle: 'short' } : {}) }).format(date);
}
export function formatAverageResolutionHours(value) {
  if (value === null || value === undefined || (typeof value !== 'number' && typeof value !== 'string') || value === '') return '—';
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) return '—';
  if (hours < 1) return '< 1 h';
  return `${hours.toLocaleString('es-CO', { maximumFractionDigits: 1 })} h`;
}
export function activeRecord(record) { return record.active === true || record.active === 'true'; }
export function spaceLabel(space) { return [space.name, space.zone].filter(Boolean).join(' · '); }
export function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return '';
  let digits = raw.replace(/\D/g, '');
  const international = raw.startsWith('+') || digits.startsWith('00');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!international && digits.length === 10 && /^(3\d{9}|60\d{8})$/.test(digits)) digits = `57${digits}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : '';
}
export function evidenceError(files, requirePhoto = false) {
  if (files.length > MAX_EVIDENCE_FILES) return 'Puedes adjuntar hasta 5 archivos.';
  for (const file of files) {
    if (!EVIDENCE_TYPES.includes(file.type)) return `“${file.name}” debe ser una imagen JPG, PNG, WEBP o un PDF.`;
    if (!file.size || file.size > MAX_EVIDENCE_SIZE) return `“${file.name}” debe pesar entre 1 byte y 5 MB.`;
  }
  if (requirePhoto && !files.some((file) => file.type.startsWith('image/'))) return 'Adjunta al menos una foto de la reparación para cerrar la incidencia.';
  return '';
}
export function sortIncidents(items) {
  const order = { PENDING: 0, ASSIGNED: 1, CLOSED: 2 };
  const priority = { ALTA: 0, MEDIA: 1, BAJA: 2 };
  return [...items].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || (priority[a.priority] ?? 3) - (priority[b.priority] ?? 3) || new Date(b.created_at) - new Date(a.created_at));
}
export const HISTORY_LABELS = {
  INCIDENCIA_CREADA: 'Incidencia registrada', RESPONSABLE_ASIGNADO: 'Responsable asignado',
  RESPONSABLE_CAMBIADO: 'Responsable cambiado', SOLUCION_REGISTRADA: 'Solución registrada',
  INCIDENCIA_CERRADA: 'Incidencia cerrada', INCIDENCIA_EDITADA: 'Datos de la incidencia actualizados',
  INCIDENT_CREATED: 'Incidencia registrada', CREATED: 'Incidencia registrada',
  INCIDENT_UPDATED: 'Datos de la incidencia actualizados', UPDATED: 'Datos de la incidencia actualizados',
  ASSIGNED: 'Responsable asignado', REASSIGNED: 'Responsable cambiado',
  PERSON_ASSIGNED: 'Responsable asignado', INCIDENT_ASSIGNED: 'Responsable asignado',
  CLOSED: 'Incidencia cerrada', INCIDENT_CLOSED: 'Incidencia cerrada',
  RESOLUTION_REGISTERED: 'Solución registrada', EVIDENCE_ADDED: 'Evidencia agregada',
  WHATSAPP_OPENED: 'Acción de WhatsApp preparada', WHATSAPP_LAUNCHED: 'Acción de WhatsApp preparada',
};
