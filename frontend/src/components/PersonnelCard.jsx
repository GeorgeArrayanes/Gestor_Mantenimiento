import { Edit3, Phone } from 'lucide-react';
import { Avatar } from './DesignSystem.jsx';
import PrivateImage from './PrivateImage.jsx';
import StatusBadge from './StatusBadge.jsx';
import { activeRecord } from '../utils/maintenance.js';
import './personnel-cards.css';

export default function PersonnelCard({ person, onEdit }) {
  const active = activeRecord(person);
  const placeholder = <span className="personnel-card-placeholder"><Avatar name={person.name} size="lg" /><span>Sin fotografía</span></span>;
  return <article className={`personnel-card${active ? '' : ' is-inactive'}`} aria-label={`Perfil de ${person.name}`}>
    <div className="personnel-card-portrait">
      {person.image_url ? <PrivateImage src={person.image_url} alt={`Retrato de ${person.name}`} className="personnel-card-photo" imageClassName="personnel-card-photo-image" fallback={placeholder} /> : placeholder}
      <StatusBadge value={active} />
    </div>
    <div className="personnel-card-details">
      <h2>{person.name}</h2>
      <p className="personnel-card-role">{person.specialty || 'Personal de mantenimiento'}</p>
      <div className="personnel-card-contact"><span className="personnel-card-phone-icon"><Phone size={19} aria-hidden="true" /></span><div><span>Teléfono / WhatsApp</span><strong>{person.phone}</strong></div></div>
      <img className="personnel-card-crest" src="/school-crest.png" alt="" aria-hidden="true" />
    </div>
    <dl className="personnel-card-stats" aria-label="Incidencias de esta persona">
      <div title="Incidencias asignadas actualmente en curso"><dt>Asignados</dt><dd>{person.assigned_count ?? 0}</dd></div>
      <div title="Total de incidencias cerradas a su nombre"><dt>Resueltos</dt><dd>{person.resolved_count ?? 0}</dd></div>
    </dl>
    {person.notes && <p className="personnel-card-notes">{person.notes}</p>}
    <div className="personnel-card-footer"><button className="personnel-card-edit" type="button" onClick={() => onEdit(person)} aria-label={`Editar perfil de ${person.name}`}><span>Editar perfil</span><Edit3 size={19} aria-hidden="true" /></button></div>
  </article>;
}
