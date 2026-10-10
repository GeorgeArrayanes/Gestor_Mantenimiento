export const PROBLEM_TYPES = Object.freeze(['ELECTRICIDAD','PLOMERIA','CARPINTERIA','PINTURA','INFRAESTRUCTURA','ILUMINACION','MOBILIARIO','EQUIPOS','CERRAJERIA','OTRO']);
export const PRIORITIES = Object.freeze(['BAJA','MEDIA','ALTA']);
export const INCIDENT_STATUSES = Object.freeze(['PENDING','ASSIGNED','CLOSED']);
export const httpError = (status, message) => Object.assign(new Error(message), { status });

export function parseId(value, label = 'Identificador') {
  if (!/^[1-9]\d*$/.test(String(value || '')) || !Number.isSafeInteger(Number(value))) throw httpError(400, `${label} inválido.`);
  return Number(value);
}

export function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) throw httpError(400, 'El teléfono del responsable no es válido para WhatsApp. Incluye el código de país.');
  let digits = raw.replace(/\D/g, '');
  const international = raw.startsWith('+') || digits.startsWith('00');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!international && digits.length === 10 && /^(3\d{9}|60\d{8})$/.test(digits)) digits = `57${digits}`;
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw httpError(400, 'El teléfono del responsable no es válido para WhatsApp. Incluye el código de país.');
  return digits;
}

export function buildWhatsApp(incident) {
  if (!incident.assigned_person_id || !incident.assigned_person_name) throw httpError(409, 'Asigna un responsable antes de preparar el mensaje.');
  if (incident.status !== 'ASSIGNED') throw httpError(409, 'La incidencia debe estar asignada y abierta para notificarla.');
  const phone = normalizePhone(incident.assigned_person_current_phone ?? incident.assigned_person_phone);
  const priority = { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' }[incident.priority];
  const message = [
  '🧰🔧*Nueva incidencia de mantenimiento*🧰🔧',
  '',
  `Hola, ${incident.assigned_person_name}.`,
  '',
  `Se te ha asignado la incidencia ${incident.code}:`,
  '',
  `•📍*Ubicación:* ${incident.space_name}${incident.space_zone ? ` · ${incident.space_zone}` : ''}`,
  `•🛠️*Problema:* ${incident.description}`,
  `•🚨*Prioridad:* ${priority}`,
  '',
  'Por favor informa al Jefe de Mantenimiento cuando la reparación esté terminada.',
  '',
  'Gimnasio Los Arrayanes'
].join('\n');
  return { url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`, message, phone };
}
