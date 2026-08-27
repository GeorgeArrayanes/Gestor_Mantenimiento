import { roleCanAccess } from '../utils/roles.js';

const transitions = {
  start: { roles: ['CONDUCTOR'], from: ['REPORTADO', 'REQUIERE_CORRECCION'], to: 'EN_PROCESO' },
  submit: { roles: ['CONDUCTOR'], from: ['EN_PROCESO'], to: 'PENDIENTE_VALIDACION' },
  approve: { roles: ['ADMIN'], from: ['PENDIENTE_VALIDACION'], to: 'RESUELTO' },
  reject: { roles: ['ADMIN'], from: ['PENDIENTE_VALIDACION'], to: 'REQUIERE_CORRECCION' }
};

export function assertTransition(action, incident, user) {
  const rule = transitions[action];
  if (!rule || !roleCanAccess(user.role, rule.roles) || !rule.from.includes(incident.status)) {
    const error = new Error('Transición de estado inválida para esta novedad.');
    error.status = 409;
    throw error;
  }
  if (user.role === 'CONDUCTOR' && incident.responsible_driver_id !== user.id) {
    const error = new Error('No tienes acceso a esta novedad.');
    error.status = 403;
    throw error;
  }
  return rule.to;
}

export const eventNames = {
  start: 'REPARACION_INICIADA', submit: 'SOLUCION_ENVIADA', approve: 'REPARACION_APROBADA', reject: 'REPARACION_RECHAZADA'
};
