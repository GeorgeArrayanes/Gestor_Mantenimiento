import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, Download, Edit3, Image, MessageCircle, ShieldCheck, Trash2, UserRound, Wrench, X } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import EvidenceUpload from '../components/EvidenceUpload.jsx';
import EvidenceGallery from '../components/EvidenceGallery.jsx';
import { isImageEvidence } from '../components/EvidenceImage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import Toast from '../components/Toast.jsx';
import { activeRecord, evidenceError, formatDate, HISTORY_LABELS, PRIORITIES, problemLabel, PROBLEM_TYPES, spaceLabel } from '../utils/maintenance.js';
import usePageLifecycle from './usePageLifecycle.js';
import './maintenance-pages.css';
import './detail-evidence.css';

export default function IncidentDetailPage() {
  const { id } = useParams();
  const activeRoute = useRef(id);
  activeRoute.current = id;
  const { mounted, startRequest } = usePageLifecycle();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState(location.state?.success ? { message: location.state.success } : null);
  const [dialog, setDialog] = useState('');
  const [assignedId, setAssignedId] = useState('');
  const [editForm, setEditForm] = useState({});
  const [resolution, setResolution] = useState('');
  const [files, setFiles] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [whatsapp, setWhatsapp] = useState(null);
  const load = useCallback(async () => {
    const signal = startRequest();
    setError('');
    try { const result = await api(`/incidents/${id}`, { signal }); if (!signal.aborted) setData(result); } catch (e) { if (!signal.aborted) setError(e.message); } finally { if (!signal.aborted) setLoading(false); }
  }, [id, startRequest]);
  useEffect(() => { setLoading(true); setData(null); setWhatsapp(null); setDialog(''); setActionError(''); setBusy(''); load(); }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoading(true); setCatalogError('');
    Promise.all([api('/spaces', { signal: controller.signal }), api('/personnel', { signal: controller.signal })]).then(([s, p]) => { if (!controller.signal.aborted) { setSpaces(s.spaces); setPersonnel(p.personnel); } }).catch((e) => { if (!controller.signal.aborted) setCatalogError(`No fue posible cargar los espacios y el personal: ${e.message}`); }).finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, [id, catalogRetry]);
  const incident = data?.incident;
  const closed = incident?.status === 'CLOSED';
  const availablePersonnel = personnel.filter(activeRecord);
  const initialEvidence = (data?.evidences || []).filter((item) => item.category === 'INITIAL');
  const finalEvidence = (data?.evidences || []).filter((item) => item.category === 'FINAL');
  const compareEvidence = closed && initialEvidence.some(isImageEvidence) && finalEvidence.some(isImageEvidence);
  function openDialog(type) {
    setActionError(''); setConfirmed(false);
    if (type === 'assign') setAssignedId(String(incident.assigned_person_id || ''));
    if (type === 'edit') setEditForm({ space_id: String(incident.space_id), problem_type: incident.problem_type, priority: incident.priority, description: incident.description });
    if (type === 'close') { setResolution(''); setFiles([]); }
    setDialog(type);
  }
  function dismiss() { if (!busy) { setDialog(''); setActionError(''); } }
  async function mutate(path, body, success, method = 'POST') {
    setBusy(dialog); setActionError('');
    try { await api(`/incidents/${id}${path}`, { method, body }); if (!mounted.current || activeRoute.current !== id) return; setDialog(''); setWhatsapp(null); setToast({ message: success }); await load(); } catch (e) { if (mounted.current && activeRoute.current === id) setActionError(e.message); } finally { if (mounted.current && activeRoute.current === id) setBusy(''); }
  }
  function assign(event) { event.preventDefault(); if (busy || !assignedId) return; return mutate('/assign', JSON.stringify({ assigned_person_id: assignedId }), 'Responsable asignado correctamente.'); }
  function edit(event) { event.preventDefault(); if (busy) return; if (editForm.description.trim().length < 10) { setActionError('Describe el problema con al menos 10 caracteres.'); return; } return mutate('', JSON.stringify(editForm), 'Incidencia actualizada correctamente.', 'PATCH'); }
  function submitResolution(event) {
    event.preventDefault(); if (busy) return;
    const validation = evidenceError(files, true);
    if (validation) { setActionError(validation); return; }
    if (resolution.trim().length < 10) { setActionError('Describe la reparación realizada con al menos 10 caracteres.'); return; }
    setActionError(''); setConfirmed(false); setDialog('confirm-close');
  }
  function closeIncident(event) {
    event.preventDefault(); if (busy || !confirmed) return;
    const body = new FormData(); body.append('resolution_notes', resolution.trim()); body.append('confirmed', 'true'); files.forEach((file) => body.append('files', file));
    return mutate('/close', body, 'Solución registrada. La incidencia está cerrada.');
  }
  async function deleteIncident(event) {
    event.preventDefault(); if (busy || !confirmed) return;
    setBusy('delete'); setActionError('');
    try {
      await api(`/incidents/${id}`, { method: 'DELETE' });
      if (!mounted.current || activeRoute.current !== id) return;
      navigate('/incidencias', { replace: true, state: { success: `${incident.code} fue eliminada correctamente.` } });
    } catch (e) { if (mounted.current && activeRoute.current === id) setActionError(e.message); } finally { if (mounted.current && activeRoute.current === id) setBusy(''); }
  }
  async function notify() {
    if (busy) return; setBusy('whatsapp'); setActionError('');
    const target = window.open('', '_blank');
    if (target) target.opener = null;
    try {
      const prepared = await api(`/incidents/${id}/whatsapp`);
      if (!mounted.current || activeRoute.current !== id) { target?.close(); return; }
      const destination = new URL(prepared.url);
      if (destination.protocol !== 'https:' || destination.hostname !== 'wa.me') throw new Error('El enlace de WhatsApp no es válido.');
      setWhatsapp(prepared);
      if (target) target.location.replace(destination.href);
      else setToast({ message: 'El navegador bloqueó la nueva ventana. Usa “Abrir mensaje” debajo del botón.' });
    } catch (e) { target?.close(); if (mounted.current && activeRoute.current === id) setActionError(e.message); } finally { if (mounted.current && activeRoute.current === id) setBusy(''); }
  }
  return <div className="maintenance-page">
    <Link className="back-link" to="/incidencias"><ArrowLeft aria-hidden="true" />Volver a incidencias</Link>
    {error && <div className="page-error" role="alert">{error}<button type="button" className="text-button" onClick={() => { setLoading(true); load(); }}>Reintentar</button></div>}
    {loading ? <div className="loading-page" role="status" aria-busy="true">Cargando incidencia…</div> : !error && incident && <>
      <div className="detail-heading"><div><p className="eyebrow">Detalle de incidencia</p><h1>{incident.code}</h1><div className="detail-badges"><StatusBadge value={incident.status} /><StatusBadge value={incident.priority} urgency /><span className="helper">Registrada el {formatDate(incident.created_at)}</span></div></div><div className="detail-actions">{!closed && <><button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => openDialog('edit')}><Edit3 aria-hidden="true" />Editar</button>{incident.status === 'ASSIGNED' && <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={() => openDialog('close')}><CheckCircle2 aria-hidden="true" />Registrar solución</button>}</>}<button type="button" className="danger-button" disabled={Boolean(busy)} onClick={() => openDialog('delete')}><Trash2 aria-hidden="true" />Eliminar</button></div></div>
      {closed && <div className="detail-closed-note"><ShieldCheck aria-hidden="true" />Solución verificada y registrada. Esta incidencia conserva su historial completo.</div>}
      {actionError && !dialog && <div className="page-error" role="alert">{actionError}</div>}
      <div className="detail-grid"><div className="detail-main">
        <section className="panel"><h2 className="detail-section-title"><Wrench aria-hidden="true" />Información de la incidencia</h2><dl className="detail-facts"><div><dt>Espacio / ubicación</dt><dd>{incident.space_name}{incident.space_zone && <><br /><span className="helper">{incident.space_zone}</span></>}</dd></div><div><dt>Tipo de problema</dt><dd>{problemLabel(incident.problem_type)}</dd></div><div><dt>Registrada por</dt><dd>{incident.created_by_name}</dd></div><div><dt>Fecha de registro</dt><dd>{formatDate(incident.created_at, true)}</dd></div></dl><span className="detail-label">Descripción</span><p className="detail-description">{incident.description}</p></section>
        {compareEvidence ? <section className="panel evidence-comparison" aria-labelledby="comparison-heading">
          <h2 className="detail-section-title" id="comparison-heading"><Image aria-hidden="true" />Evidencia de la reparación</h2>
          <p className="evidence-comparison-intro">El problema registrado y la solución verificada.</p>
          <div className="evidence-comparison-columns">
            <section aria-labelledby="initial-evidence-heading"><div className="evidence-stage-heading"><span>Antes</span><h3 id="initial-evidence-heading">Evidencia inicial</h3></div><EvidenceGallery key={`${id}-initial`} items={initialEvidence} label="Evidencia inicial" emptyMessage="No se adjuntó evidencia inicial." /></section>
            <section aria-labelledby="final-evidence-heading"><div className="evidence-stage-heading evidence-stage-heading--final"><span>Después</span><h3 id="final-evidence-heading">Evidencia de solución</h3></div><EvidenceGallery key={`${id}-final`} items={finalEvidence} label="Evidencia de solución" emptyMessage="No hay evidencia de solución." /></section>
          </div>
        </section> : <section className="panel"><h2 className="detail-section-title"><Image aria-hidden="true" />Evidencia inicial</h2><EvidenceGallery key={`${id}-initial`} items={initialEvidence} label="Evidencia inicial" emptyMessage="No se adjuntó evidencia inicial." /></section>}
        {closed && <section className="panel resolution-panel"><h2 className="detail-section-title"><CheckCircle2 aria-hidden="true" />Solución registrada</h2><p className="detail-description">{incident.resolution_notes}</p><span className="resolution-date">Cerrada el {formatDate(incident.closed_at, true)}</span>{!compareEvidence && <><hr className="form-divider" /><h3 className="detail-section-title"><Image aria-hidden="true" />Evidencia de solución</h3><EvidenceGallery key={`${id}-final`} items={finalEvidence} label="Evidencia de solución" emptyMessage="No hay evidencia de solución." /></>}</section>}
      </div><aside className="detail-side">
        <section className="panel"><h2 className="detail-section-title"><UserRound aria-hidden="true" />Responsable</h2>{incident.assigned_person_name ? <div className="assignee-box"><span className="person-avatar"><UserRound aria-hidden="true" /></span><div><strong>{incident.assigned_person_name}</strong><p>{(closed ? incident.assigned_person_phone : incident.assigned_person_current_phone || incident.assigned_person_phone) || 'Sin teléfono registrado'}</p></div></div> : <p className="assignee-empty">Esta incidencia aún no tiene responsable. Selecciona a una persona del equipo para comenzar.</p>}
          {!closed && <>{incident.assigned_person_id && <><button className="primary-button" type="button" onClick={notify} disabled={Boolean(busy)}><MessageCircle aria-hidden="true" />{busy === 'whatsapp' ? 'Preparando mensaje…' : 'Notificar por WhatsApp'}</button><p className="whatsapp-help">Se abre un mensaje preparado. Tú decides cuándo enviarlo en WhatsApp.</p>{whatsapp && <a className="text-button" href={whatsapp.url} target="_blank" rel="noopener noreferrer">Abrir mensaje<Download size={13} aria-hidden="true" /></a>}</>}<button className={incident.assigned_person_id ? 'secondary-button' : 'primary-button'} type="button" onClick={() => openDialog('assign')} disabled={Boolean(busy)}><UserRound aria-hidden="true" />{incident.assigned_person_id ? 'Cambiar responsable' : 'Asignar responsable'}</button></>}
          {incident.assigned_at && <p className="whatsapp-help">Asignada el {formatDate(incident.assigned_at, true)}</p>}
        </section>
        <section className="panel"><h2 className="detail-section-title"><Clock3 aria-hidden="true" />Historial</h2>{data.history?.length ? <ol className="timeline">{data.history.map((event) => <li key={event.id}><strong>{HISTORY_LABELS[event.event_type] || 'Actualización de incidencia'}</strong>{event.comment && <p>{event.comment}</p>}<p>{event.user_name || 'Administrador'}</p><time dateTime={event.created_at}>{formatDate(event.created_at, true)}</time></li>)}</ol> : <p className="no-evidence">Aún no hay eventos registrados.</p>}</section>
      </aside></div>
    </>}
    {dialog && <Modal key={dialog} as="form" className="modal catalog-form maintenance-form" labelledBy="incident-dialog-title" onClose={dismiss} onSubmit={dialog === 'assign' ? assign : dialog === 'edit' ? edit : dialog === 'confirm-close' ? closeIncident : dialog === 'delete' ? deleteIncident : submitResolution}>
      <div className="modal-head"><div><p className="eyebrow">{incident?.code}</p><h2 id="incident-dialog-title">{dialog === 'assign' ? 'Asignar responsable' : dialog === 'edit' ? 'Editar incidencia' : dialog === 'confirm-close' ? 'Confirmar cierre' : dialog === 'delete' ? 'Eliminar incidencia' : 'Registrar solución'}</h2></div><button className="icon-button" type="button" onClick={dismiss} disabled={Boolean(busy)} aria-label="Cerrar diálogo"><X size={20} /></button></div>
      {actionError && <div className="page-error" role="alert">{actionError}</div>}
      {(dialog === 'assign' || dialog === 'edit') && catalogLoading && <p className="helper" role="status">Cargando espacios y personal…</p>}
      {(dialog === 'assign' || dialog === 'edit') && catalogError && <div className="page-error" role="alert">{catalogError}<button type="button" className="secondary-button" onClick={() => setCatalogRetry((value) => value + 1)}>Reintentar</button></div>}
      {dialog === 'assign' && !catalogLoading && !catalogError && (availablePersonnel.length ? <label>Persona del equipo<select data-autofocus value={assignedId} onChange={(e) => setAssignedId(e.target.value)} required disabled={Boolean(busy)}><option value="">Selecciona un responsable</option>{availablePersonnel.map((p) => <option key={p.id} value={p.id}>{p.name}{p.specialty ? ` · ${p.specialty}` : ''}</option>)}</select><small className="helper">El personal recibe la asignación por WhatsApp y no necesita una cuenta de acceso.</small></label> : <EmptyState title="No hay personal activo" text="Registra o activa a una persona del equipo antes de asignar esta incidencia." action={<Link className="secondary-button" to="/personal" onClick={dismiss}>Ir a personal</Link>} />)}
      {dialog === 'edit' && !catalogLoading && !catalogError && <div className="form-grid"><label>Espacio / ubicación<select data-autofocus value={editForm.space_id} onChange={(e) => setEditForm((f) => ({ ...f, space_id: e.target.value }))} required disabled={Boolean(busy)}>{spaces.filter((s) => activeRecord(s) || String(s.id) === String(incident.space_id)).map((s) => <option key={s.id} value={s.id}>{spaceLabel(s)}{!activeRecord(s) ? ' (archivado)' : ''}</option>)}</select></label><label>Tipo de problema<select value={editForm.problem_type} onChange={(e) => setEditForm((f) => ({ ...f, problem_type: e.target.value }))} required disabled={Boolean(busy)}>{PROBLEM_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Prioridad<select value={editForm.priority} onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))} disabled={Boolean(busy)}>{PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="full">Descripción<textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} required minLength={10} maxLength={4000} disabled={Boolean(busy)} /></label></div>}
      {dialog === 'close' && <div className="form-grid"><div className="form-intro full"><ShieldCheck aria-hidden="true" /><p>Verifica la reparación y registra la evidencia antes de cerrar la incidencia.</p></div><label className="full">¿Cómo se solucionó?<textarea data-autofocus value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Describe el trabajo realizado y la solución verificada." required minLength={10} maxLength={4000} disabled={Boolean(busy)} /></label><div className="full"><EvidenceUpload files={files} onChange={setFiles} requiredPhoto label="Evidencia final" disabled={Boolean(busy)} /></div></div>}
      {dialog === 'confirm-close' && <><p className="close-note">Vas a cerrar <strong>{incident?.code}</strong>. La solución y {files.length} {files.length === 1 ? 'archivo' : 'archivos'} de evidencia quedarán en su historial. La incidencia cerrada no podrá editarse.</p><p className="detail-description">{resolution}</p><label className="confirm-checkbox"><input data-autofocus type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} required disabled={Boolean(busy)} />Confirmo que revisé la reparación y que el problema está solucionado.</label></>}
      {dialog === 'delete' && <><p className="delete-note">Esta acción eliminará <strong>{incident?.code}</strong>, su historial y todas sus evidencias. No se puede deshacer.</p><label className="confirm-checkbox"><input data-autofocus type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} required disabled={Boolean(busy)} />Confirmo que deseo eliminar esta incidencia definitivamente.</label></>}
      <div className="form-actions"><button type="button" className="secondary-button" onClick={dialog === 'confirm-close' ? () => { setDialog('close'); setActionError(''); } : dismiss} disabled={Boolean(busy)}>{dialog === 'confirm-close' ? 'Volver' : 'Cancelar'}</button>{(dialog !== 'assign' || availablePersonnel.length > 0) && <button type="submit" className={dialog === 'delete' ? 'danger-button' : 'primary-button'} disabled={Boolean(busy) || ((dialog === 'assign' || dialog === 'edit') && (catalogLoading || Boolean(catalogError))) || ((dialog === 'confirm-close' || dialog === 'delete') && !confirmed)}>{busy ? (dialog === 'delete' ? 'Eliminando…' : 'Guardando…') : dialog === 'assign' ? 'Guardar asignación' : dialog === 'edit' ? 'Guardar cambios' : dialog === 'confirm-close' ? 'Cerrar incidencia' : dialog === 'delete' ? 'Eliminar definitivamente' : 'Revisar y cerrar'}</button>}</div>
    </Modal>}
    <Toast toast={toast} onClose={() => setToast(null)} />
  </div>;
}





