import { useEffect, useRef, useState } from 'react';
import { Armchair, ArrowUpRight, Building2, Droplets, Hammer, Lightbulb, LockKeyhole, MapPin, MessageCircle, Monitor, Paintbrush, Phone, Wrench, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate, normalizePhone, problemLabel } from '../utils/maintenance.js';
import { Avatar } from './DesignSystem.jsx';
import EvidenceImage from './EvidenceImage.jsx';
import StatusBadge from './StatusBadge.jsx';
import useIncidentThumbnail from './useIncidentThumbnail.js';
import './incident-cards.css';

export { incidentThumbnail } from './useIncidentThumbnail.js';

const problemIcons = {
  ELECTRICIDAD: Zap, PLOMERIA: Droplets, CARPINTERIA: Hammer, PINTURA: Paintbrush,
  INFRAESTRUCTURA: Building2, ILUMINACION: Lightbulb, MOBILIARIO: Armchair,
  EQUIPOS: Monitor, CERRAJERIA: LockKeyhole, OTRO: Wrench,
};

export function incidentContact(incident) {
  if (incident.status !== 'ASSIGNED' || !incident.assigned_person_id || !incident.assigned_person_name) return null;
  const phone = normalizePhone(incident.assigned_person_current_phone ?? incident.assigned_person_phone);
  return phone ? { phone, name: incident.assigned_person_name } : null;
}

export function whatsappDestination(value) {
  let destination;
  try { destination = new URL(value); } catch { throw new Error('El enlace de WhatsApp no es válido.'); }
  if (destination.protocol !== 'https:' || destination.hostname !== 'wa.me' || destination.port || destination.username || destination.password || !/^\/[1-9]\d{7,14}$/.test(destination.pathname) || !destination.searchParams.get('text')) throw new Error('El enlace de WhatsApp no es válido.');
  return destination.href;
}

export default function IncidentCard({ incident, compact = false, showContact = !compact }) {
  const Icon = problemIcons[incident.problem_type] || Wrench;
  const { thumbnail, container } = useIncidentThumbnail(incident, compact);
  const contact = showContact ? incidentContact(incident) : null;
  const [busy, setBusy] = useState(false);
  const [contactError, setContactError] = useState('');
  const [preparedUrl, setPreparedUrl] = useState('');
  const mounted = useRef(false);
  const pending = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pending.current?.controller.abort(); pending.current?.target?.close(); };
  }, []);
  useEffect(() => { setPreparedUrl(''); setContactError(''); }, [incident.id, incident.updated_at, incident.assigned_person_current_phone, incident.assigned_person_phone]);

  async function prepareContact() {
    if (busy || !contact) return;
    setBusy(true); setContactError(''); setPreparedUrl('');
    const controller = new AbortController();
    let target = null;
    try { target = window.open('', '_blank'); if (target) target.opener = null; } catch { target?.close(); target = null; }
    pending.current = { controller, target };
    try {
      const result = await api(`/incidents/${incident.id}/whatsapp`, { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) { target?.close(); return; }
      const destination = whatsappDestination(result.url);
      if (target) target.location.replace(destination);
      else setPreparedUrl(destination);
    } catch (error) {
      target?.close();
      if (mounted.current && !controller.signal.aborted) setContactError(error.message);
    } finally {
      pending.current = null;
      if (mounted.current) setBusy(false);
    }
  }

  return <article ref={container} className={`incident-card${compact ? ' incident-card--compact' : ''}`} aria-label={`${incident.code}: ${problemLabel(incident.problem_type)}`}>
    <header className="incident-card-topline">
      <Link className="incident-card-code" to={`/incidencias/${incident.id}`}>{incident.code}</Link>
      <time dateTime={incident.created_at}>{formatDate(incident.created_at)}</time>
    </header>
    {!compact && <div className="incident-card-media">
      <Link className="incident-card-preview" to={`/incidencias/${incident.id}`} aria-label={`Ver incidencia ${incident.code}`}>
        {thumbnail ? <EvidenceImage evidence={thumbnail} alt={`Evidencia inicial de ${incident.code} en ${incident.space_name}`} className="incident-card-evidence" imageClassName="incident-card-evidence-image" lazy fallback={<span className={`incident-card-placeholder incident-card-placeholder--${incident.problem_type?.toLowerCase() || 'otro'}`} aria-hidden="true"><Icon size={32} strokeWidth={1.55} /></span>} /> : <span className={`incident-card-placeholder incident-card-placeholder--${incident.problem_type?.toLowerCase() || 'otro'}`} aria-hidden="true"><Icon size={32} strokeWidth={1.55} /></span>}
      </Link>
      <div className="incident-card-badges"><StatusBadge value={incident.status} /><StatusBadge value={incident.priority} urgency /></div>
    </div>}
    <div className="incident-card-content">
      {compact ? <>
        <div className="incident-card-heading"><span className={`incident-card-visual incident-card-visual--${incident.problem_type?.toLowerCase() || 'otro'}`} aria-hidden="true"><Icon size={23} strokeWidth={1.65} /></span><h3><Link to={`/incidencias/${incident.id}`}>{problemLabel(incident.problem_type)}</Link></h3></div>
        <p className="incident-card-description" title={incident.description}>{incident.description}</p>
        <div className="incident-card-badges"><StatusBadge value={incident.status} /><StatusBadge value={incident.priority} urgency /></div>
      </> : <>
        <h3 className="incident-card-case-title"><Link to={`/incidencias/${incident.id}`} title={incident.description}>{incident.description || problemLabel(incident.problem_type)}</Link></h3>
        <div className="incident-card-category"><Icon size={14} aria-hidden="true" /><span>{problemLabel(incident.problem_type)}</span></div>
      </>}
      <div className="incident-card-location"><MapPin size={16} aria-hidden="true" /><span><strong>{incident.space_name}</strong>{incident.space_zone && <small>{incident.space_zone}</small>}</span></div>
    </div>
    <div className="incident-card-person"><Avatar name={incident.assigned_person_name || ''} size="sm" /><div><span>Responsable</span><strong>{incident.assigned_person_name || 'Pendiente de asignación'}</strong></div></div>
    <footer className="incident-card-actions">
      <Link className="incident-card-detail" to={`/incidencias/${incident.id}`}>Ver incidencia<ArrowUpRight size={16} aria-hidden="true" /></Link>
      {contact && <><a className="incident-card-contact" href={`tel:+${contact.phone}`} aria-label={`Llamar a ${contact.name}`} title={`Llamar a ${contact.name}`}><Phone size={16} aria-hidden="true" /></a><button className="incident-card-contact incident-card-contact--whatsapp" type="button" disabled={busy} onClick={prepareContact} aria-label={`Preparar WhatsApp para ${contact.name}`} title="Preparar mensaje de WhatsApp; el envío es manual"><MessageCircle size={17} aria-hidden="true" />{busy && <span className="sr-only">Preparando mensaje…</span>}</button></>}
    </footer>
    {contactError && <p className="incident-card-feedback incident-card-feedback--error" role="alert">{contactError}</p>}
    {preparedUrl && <p className="incident-card-feedback" role="status">El navegador bloqueó la ventana. <a href={preparedUrl} target="_blank" rel="noopener noreferrer">Abrir mensaje de WhatsApp</a>. Tú decides cuándo enviarlo.</p>}
  </article>;
}
