// Isolated fixtures for Stage A. These IDs never refer to production records.
export const DEMO_STATUS = Object.freeze({
  PENDING: { label: 'Pendiente', className: 'pending' },
  ASSIGNED: { label: 'Asignada', className: 'assigned' },
  CLOSED: { label: 'Cerrada', className: 'closed' },
});

const fixtures = {
  administrativo: {
    spaces: [{ id: 'demo-admin-office', name: 'Oficina de coordinación' }, { id: 'demo-admin-entry', name: 'Acceso administrativo' }],
    incidents: [
      { id: 'DEMO-001', title: 'Ajustar la cerradura del acceso', spaceId: 'demo-admin-entry', status: 'PENDING', description: 'Ejemplo de una solicitud que aún no tiene un responsable asignado.' },
      { id: 'DEMO-002', title: 'Revisar una luminaria', spaceId: 'demo-admin-office', status: 'ASSIGNED', description: 'Ejemplo de una incidencia asignada al equipo de mantenimiento.' },
      { id: 'DEMO-003', title: 'Ajuste de la puerta de oficina', spaceId: 'demo-admin-office', status: 'CLOSED', description: 'Ejemplo de un trabajo terminado que permanece en el historial.' },
    ],
  },
  'bloques-salones': {
    spaces: [{ id: 'demo-classroom', name: 'Salón de ejemplo · Cuatro bloques' }, { id: 'demo-gallery', name: 'Circulación de los bloques' }],
    incidents: [
      { id: 'DEMO-004', title: 'Revisar una ventana del salón', spaceId: 'demo-classroom', status: 'ASSIGNED', description: 'Caso ficticio para probar el panel del conjunto de salones y su agrupación.' },
      { id: 'DEMO-005', title: 'Ajustar una baranda', spaceId: 'demo-gallery', status: 'PENDING', description: 'Solicitud simulada de mantenimiento en una circulación compartida.' },
    ],
  },
  preescolar: {
    spaces: [{ id: 'demo-preschool', name: 'Aula de ejemplo · Preescolar' }],
    incidents: [{ id: 'DEMO-006', title: 'Revisión de un mueble del aula', spaceId: 'demo-preschool', status: 'CLOSED', description: 'Ejemplo de una zona sin incidencias abiertas y con un caso en su historial.' }],
  },
  bachillerato: { spaces: [{ id: 'demo-high-school', name: 'Aula de ejemplo · Bachillerato' }], incidents: [] },
};

const EMPTY_DEMO = Object.freeze({ spaces: [], incidents: [] });

export function getRegionDemo(regionId) {
  return fixtures[regionId] || EMPTY_DEMO;
}

export function summarizeDemo(incidents = []) {
  return incidents.reduce((counts, incident) => {
    if (Object.hasOwn(counts, incident.status)) counts[incident.status] += 1;
    return counts;
  }, { PENDING: 0, ASSIGNED: 0, CLOSED: 0 });
}

// A pointer must remain a click throughout its gesture, including after leaving
// and returning to its origin. Touch pinches are suppressed by the caller.
export function moveMapGesture(gesture, x, y, threshold = 7) {
  if (!gesture) return null;
  return { ...gesture, moved: gesture.moved || Math.hypot(x - gesture.x, y - gesture.y) >= threshold };
}

export function canSelectMapRegion(gesture, now = Date.now()) {
  return !gesture?.moved && (!gesture?.suppressUntil || now > gesture.suppressUntil);
}

export function validateMapRegions(payload) {
  if (payload?.width !== 3200 || payload?.height !== 2200 || !Array.isArray(payload.regions) || !payload.regions.length) throw new Error('El mapa de zonas no tiene el formato esperado.');
  const ids = new Set();
  for (const region of payload.regions) {
    if (!region || typeof region.id !== 'string' || !region.id || ids.has(region.id) || typeof region.label !== 'string' || !region.label || typeof region.path !== 'string' || !region.path.trim()) throw new Error('No se pudieron leer todas las zonas del campus.');
    ids.add(region.id);
  }
  return payload;
}
