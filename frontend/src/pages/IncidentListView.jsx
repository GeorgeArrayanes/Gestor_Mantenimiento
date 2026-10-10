import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, problemLabel } from '../utils/maintenance.js';

export default function IncidentListView({ incidents }) {
  return <div className="incident-list-layout">
    <div className="incident-table-wrap"><table className="incident-table"><colgroup><col className="incident-col-code" /><col className="incident-col-description" /><col className="incident-col-space" /><col className="incident-col-priority" /><col className="incident-col-person" /><col className="incident-col-status" /><col className="incident-col-date" /></colgroup><thead><tr><th scope="col">Código</th><th scope="col">Descripción</th><th scope="col">Espacio / ubicación</th><th scope="col">Prioridad</th><th scope="col">Responsable</th><th scope="col">Estado</th><th scope="col">Fecha</th></tr></thead><tbody>{incidents.map((incident) => <tr key={incident.id}>
      <td><Link className="incident-code" to={`/incidencias/${incident.id}`}>{incident.code}<ArrowUpRight size={12} aria-hidden="true" /></Link></td>
      <td className="description-cell"><Link to={`/incidencias/${incident.id}`} title={incident.description}>{incident.description}</Link><small>{problemLabel(incident.problem_type)}</small></td>
      <td>{incident.space_name}<small>{incident.space_zone || ''}</small></td>
      <td><StatusBadge value={incident.priority} urgency /></td>
      <td className="responsible-cell">{incident.assigned_person_name || <span className="muted">Sin asignar</span>}</td>
      <td><StatusBadge value={incident.status} /></td><td>{formatDate(incident.created_at)}</td>
    </tr>)}</tbody></table></div>
    <div className="incident-mobile-list">{incidents.map((incident) => <Link className="incident-mobile-card" to={`/incidencias/${incident.id}`} key={incident.id} aria-label={`Ver ${incident.code}: ${incident.description}`}>
      <div><span className="incident-code">{incident.code}<ArrowUpRight size={13} aria-hidden="true" /></span><StatusBadge value={incident.status} /></div>
      <h3>{incident.description}</h3><p>{incident.space_name}{incident.space_zone ? ` · ${incident.space_zone}` : ''}</p>
      <div><StatusBadge value={incident.priority} urgency /><small>{formatDate(incident.created_at)}</small></div>
      <p>{incident.assigned_person_name || 'Sin responsable'}</p>
    </Link>)}</div>
  </div>;
}
