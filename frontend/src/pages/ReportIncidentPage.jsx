import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Info, MapPin, Minus, Send, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import EvidenceUpload from '../components/EvidenceUpload.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { FormSection } from '../components/DesignSystem.jsx';
import { activeRecord, evidenceError, PRIORITIES, PROBLEM_TYPES, spaceLabel } from '../utils/maintenance.js';
import usePageLifecycle from './usePageLifecycle.js';
import { CAMPUS_REGIONS } from '../../../shared/campus-regions.mjs';
import { reportLocationFromSearch, reportSpaces } from './campus-spaces.js';
import './maintenance-pages.css';
import './report-incident.css';

export default function ReportIncidentPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { mounted, startRequest } = usePageLifecycle();
  const [spaces, setSpaces] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [locationWarning, setLocationWarning] = useState('');
  const appliedSearch = useRef(null);
  const [form, setForm] = useState({ space_id: '', problem_type: '', priority: 'MEDIA', description: '', assigned_person_id: '' });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    const signal = startRequest();
    setLoading(true); setLoadError('');
    try {
      const [s, p] = await Promise.all([api('/spaces', { signal }), api('/personnel', { signal })]);
      if (!signal.aborted) {
        const activeSpaces = s.spaces.filter(activeRecord);
        setSpaces(activeSpaces); setPersonnel(p.personnel.filter(activeRecord));
        if (appliedSearch.current !== search) {
          const location = reportLocationFromSearch(search, activeSpaces);
          setRegionId(location.regionId); setLocationWarning(location.warning);
          setForm(current => ({ ...current, space_id: location.spaceId }));
          appliedSearch.current = search;
        }
      }
    } catch (e) { if (!signal.aborted) setLoadError(e.message); } finally { if (!signal.aborted) setLoading(false); }
  }, [startRequest, search]);
  useEffect(() => { load(); }, [load]);
  function change(field, value) { setForm((current) => ({ ...current, [field]: value })); setError(''); }
  function changeRegion(value) { setRegionId(value); change('space_id', ''); setLocationWarning(''); }
  const availableSpaces = reportSpaces(spaces, regionId);
  const selectedRegion = CAMPUS_REGIONS.find(region => region.id === regionId);
  const reportRegions = CAMPUS_REGIONS.filter(region => !region.legacy || region.id === regionId || spaces.some(space => space.campus_region_id === region.id));
  async function save(event) {
    event.preventDefault(); if (saving) return;
    if (!availableSpaces.some(space => String(space.id) === form.space_id)) { setError('Selecciona un espacio activo del edificio elegido.'); return; }
    const validation = evidenceError(files);
    if (validation) { setError(validation); return; }
    if (form.description.trim().length < 10) { setError('Describe el problema con al menos 10 caracteres.'); return; }
    setSaving(true); setError('');
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => { if (value) body.append(key, value.trim()); });
      files.forEach((file) => body.append('files', file));
      const result = await api('/incidents', { method: 'POST', body });
      if (!mounted.current) return;
      navigate(`/incidencias/${result.incident.id}`, { state: { success: 'Incidencia registrada correctamente.' } });
    } catch (e) { if (mounted.current) setError(e.message); } finally { if (mounted.current) setSaving(false); }
  }
  return <div className="maintenance-page report-page">
    <div className="page-heading"><div><p className="eyebrow">Incidencias y mantenimiento</p><h1>Nueva incidencia</h1><p>Describe el problema para que el equipo pueda atenderlo.</p></div></div>
    {loadError && <div className="page-error" role="alert">{loadError}<button type="button" className="text-button" onClick={load}>Reintentar</button></div>}
    {loading ? <div className="loading-page" role="status" aria-busy="true">Cargando espacios y personal…</div> : !loadError && (spaces.length ? <div className="report-layout"><form className="panel maintenance-form" onSubmit={save} aria-busy={saving}>
      {error && <div className="page-error" role="alert">{error}</div>}
      <FormSection number="01" title="Ubica el problema" description="Elige el edificio y después su espacio interno."><div className="form-grid">
        {locationWarning && <p className="report-location-notice full" role="status">{locationWarning}</p>}
        <label className="full">Edificio o zona<select value={regionId} onChange={event => changeRegion(event.target.value)} disabled={saving}><option value="">Todos los espacios · sin filtrar por edificio</option>{reportRegions.map(region => <option key={region.id} value={region.id}>{region.label}</option>)}</select><small className="helper">También puedes comenzar seleccionando un edificio en el <Link to="/mapa">mapa del colegio</Link>.</small></label>
        <label>Espacio / ubicación<select value={form.space_id} onChange={(e) => { change('space_id', e.target.value); setLocationWarning(''); }} required disabled={saving || !availableSpaces.length}><option value="">{availableSpaces.length ? 'Selecciona un espacio' : 'Sin espacios activos en este edificio'}</option>{availableSpaces.map((space) => <option key={space.id} value={space.id}>{spaceLabel(space)}</option>)}</select></label>
        <label>Tipo de problema<select value={form.problem_type} onChange={(e) => change('problem_type', e.target.value)} required disabled={saving}><option value="">Selecciona un tipo</option>{PROBLEM_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {selectedRegion && !availableSpaces.length && <p className="report-location-notice full" role="status">{selectedRegion.label} todavía no tiene espacios activos. <Link to="/mapa">Vuelve al mapa para añadir un espacio</Link> o elige otro edificio.</p>}
      </div></FormSection>
      <FormSection number="02" title="Define la atención" description="Indica la prioridad y quién puede resolverlo."><div className="form-grid">
        <fieldset><legend>Prioridad</legend><div className="priority-picker">{PRIORITIES.map(([value, label]) => { const Icon = value === 'ALTA' ? AlertTriangle : value === 'MEDIA' ? Clock3 : Minus; return <label className="priority-option" key={value}><input type="radio" name="priority" value={value} checked={form.priority === value} onChange={() => change('priority', value)} disabled={saving} /><Icon aria-hidden="true" />{label}</label>; })}</div></fieldset>
        <label>Asignar a (opcional)<select value={form.assigned_person_id} onChange={(e) => change('assigned_person_id', e.target.value)} disabled={saving}><option value="">Asignar más adelante</option>{personnel.map((person) => <option key={person.id} value={person.id}>{person.name}{person.specialty ? ` · ${person.specialty}` : ''}</option>)}</select>{!personnel.length && <small className="helper">Puedes <Link to="/personal">registrar personal</Link> y asignarlo después.</small>}</label>
        <label className="full">Descripción detallada<textarea value={form.description} onChange={(e) => change('description', e.target.value)} placeholder="Describe qué ocurrió, dónde y qué está afectando." required minLength={10} maxLength={4000} disabled={saving} /><small className="helper">Incluye el componente afectado y cualquier riesgo que deba conocer el equipo.</small></label>
      </div></FormSection>
      <FormSection number="03" title="Adjunta evidencia" description="Una imagen ayuda al equipo a entender el problema."><EvidenceUpload files={files} onChange={setFiles} disabled={saving} /></FormSection>
      <div className="form-actions"><button className="secondary-button" type="button" onClick={() => navigate('/incidencias')} disabled={saving}><ArrowLeft aria-hidden="true" />Cancelar</button><button className="primary-button" type="submit" disabled={saving || !availableSpaces.length}><Send aria-hidden="true" />{saving ? 'Registrando…' : 'Registrar incidencia'}</button></div>
      <p className="whatsapp-help"><Info size={15} aria-hidden="true" /> Puedes abrir WhatsApp desde el detalle para avisar al responsable asignado.</p>
    </form><aside className="report-guide" aria-label="Consejos para registrar una incidencia"><div className="report-guide-campus" aria-hidden="true" /><div className="report-guide-content"><p className="eyebrow">Cada detalle ayuda</p><h2>Una buena descripción.<br />Una mejor respuesta.</h2><p>Información clara para cuidar los espacios del colegio.</p><ol><li><MapPin size={18} aria-hidden="true" /><div><strong>Ubicación precisa</strong><span>Indica el espacio y el componente afectado.</span></div></li><li><UserRound size={18} aria-hidden="true" /><div><strong>Un responsable</strong><span>Asígnalo ahora o cuando el equipo esté definido.</span></div></li><li><CheckCircle2 size={18} aria-hidden="true" /><div><strong>Evidencia útil</strong><span>Una foto del problema facilita la atención.</span></div></li></ol><div className="report-priority-note"><AlertTriangle size={17} aria-hidden="true" /><p><strong>¿Hay un riesgo inmediato?</strong><span>Usa prioridad alta si afecta la seguridad o impide utilizar el espacio.</span></p></div></div></aside></div> : <section className="panel"><EmptyState title="Registra el primer espacio" text="Necesitas una ubicación activa para crear una incidencia." action={<Link className="primary-button" to="/espacios">Ir a espacios</Link>} /></section>)}
  </div>;
}
