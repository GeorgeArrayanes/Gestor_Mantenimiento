import React from 'react';

const labels = {
  REPORTADO: 'Reportado', EN_PROCESO: 'En proceso', PENDIENTE_VALIDACION: 'Por validar',
  REQUIERE_CORRECCION: 'Requiere corrección', RESUELTO: 'Resuelto',
  OPERATIVO: 'Operativo', CON_NOVEDADES: 'Con novedades', EN_MANTENIMIENTO: 'En mantenimiento', FUERA_DE_SERVICIO: 'Fuera de servicio'
};

export default function StatusBadge({ value, urgency = false }) {
  return <span className={`badge ${urgency ? `urgency-${value}` : `status-${value}`}`}>{labels[value] || value?.replaceAll('_', ' ')}</span>;
}
