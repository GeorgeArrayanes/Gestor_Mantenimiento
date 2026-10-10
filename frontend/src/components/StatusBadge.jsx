import { AlertTriangle, CheckCircle2, Clock3, Minus, UserRound } from 'lucide-react';

const labels = { PENDING: 'Sin asignar', ASSIGNED: 'Asignada', CLOSED: 'Cerrada', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja', ACTIVO: 'Activo', INACTIVO: 'Inactivo', true: 'Activo', false: 'Inactivo' };
const icons = { PENDING: Clock3, ASSIGNED: UserRound, CLOSED: CheckCircle2, ALTA: AlertTriangle, MEDIA: Clock3, BAJA: Minus };

export default function StatusBadge({ value, urgency = false }) {
  const Icon = icons[value];
  return <span className={`badge ${urgency ? 'priority' : 'status'}-${value}`}>{Icon && <Icon size={12} aria-hidden="true" />}{labels[value] || String(value || 'Sin estado').replaceAll('_', ' ')}</span>;
}
