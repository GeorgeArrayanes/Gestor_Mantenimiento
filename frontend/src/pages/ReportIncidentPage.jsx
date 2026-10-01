import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Clock3, Info, Minus, Send } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import EvidenceUpload from '../components/EvidenceUpload.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { activeRecord, evidenceError, PRIORITIES, PROBLEM_TYPES, spaceLabel } from '../utils/maintenance.js';
import usePageLifecycle from './usePageLifecycle.js';
import './maintenance-pages.css';

export default function ReportIncidentPage() {
  const navigate = useNavigate();
  const { mounted, startRequest } = usePageLifecycle();
  const [spaces, setSpaces] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [form, setForm] = useState({ space_id: '', problem_type: '', priority: 'MEDIA', description: '', assigned_person_id: '' });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    const signal = startRequest();
    setLoading(true); setLoadError('');
    try { const [s, p] = await Promise.all([api('/spaces', { signal }), api('/personnel', { signal })]); if (!signal.aborted) { setSpaces(s.spaces.filter(activeRecord)); setPersonnel(p.personnel.filter(activeRecord)); } } catch (e) { if (!signal.aborted) setLoadError(e.message); } finally { if (!signal.aborted) setLoading(false); }
  }, [startRequest]);
  useEffect(() => { load(); }, [load]);
  function change(field, value) { setForm((current) => ({ ...current, [field]: value })); setError(''); }
  async function save(event) {
    event.preventDefault(); if (saving) return;
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
  return <div className="maintenance-page">
    <div className="page-heading"><div><p className="eyebrow">Incidencias y mantenimiento</p><h1>Registrar nueva incidencia</h1><p>Completa los detalles para registrar una incidencia en las instalaciones.</p></div></div>
    {loadError && <div className="page-error" role="alert">{loadError}<button type="button" className="text-button" onClick={load}>Reintentar</button></div>}
    {loading ? <div className="loading-page" role="status" aria-busy="true">Cargando espacios y personal…</div> : !loadError && (spaces.length ? <form className="panel maintenance-form" onSubmit={save} aria-busy={saving}>
      {error && <div className="page-error" role="alert">{error}</div>}
      <div className="form-grid">
        <label>Espacio / ubicación<select value={form.space_id} onChange={(e) => change('space_id', e.target.value)} required disabled={saving}><option value="">Selecciona un espacio</option>{spaces.map((space) => <option key={space.id} value={space.id}>{spaceLabel(space)}</option>)}</select></label>
        <label>Tipo de problema<select value={form.problem_type} onChange={(e) => change('problem_type', e.target.value)} required disabled={saving}><option value="">Selecciona un tipo</option>{PROBLEM_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <fieldset><legend>Prioridad</legend><div className="priority-picker">{PRIORITIES.map(([value, label]) => { const Icon = value === 'ALTA' ? AlertTriangle : value === 'MEDIA' ? Clock3 : Minus; return <label className="priority-option" key={value}><input type="radio" name="priority" value={value} checked={form.priority === value} onChange={() => change('priority', value)} disabled={saving} /><Icon aria-hidden="true" />{label}</label>; })}</div></fieldset>
        <label>Asignar a (opcional)<select value={form.assigned_person_id} onChange={(e) => change('assigned_person_id', e.target.value)} disabled={saving}><option value="">Asignar más adelante</option>{personnel.map((person) => <option key={person.id} value={person.id}>{person.name}{person.specialty ? ` · ${person.specialty}` : ''}</option>)}</select>{!personnel.length && <small className="helper">Puedes <Link to="/personal">registrar personal</Link> y asignarlo después.</small>}</label>
        <label className="full">Descripción detallada<textarea value={form.description} onChange={(e) => change('description', e.target.value)} placeholder="Describe qué ocurrió, dónde y qué está afectando." required minLength={10} maxLength={4000} disabled={saving} /><small className="helper">Incluye el componente afectado y cualquier riesgo que deba conocer el equipo.</small></label>
        <div className="full"><EvidenceUpload files={files} onChange={setFiles} disabled={saving} /></div>
      </div>
      <div className="form-actions"><button className="secondary-button" type="button" onClick={() => navigate('/incidencias')} disabled={saving}><ArrowLeft aria-hidden="true" />Cancelar</button><button className="primary-button" type="submit" disabled={saving}><Send aria-hidden="true" />{saving ? 'Registrando…' : 'Registrar incidencia'}</button></div>
      <p className="whatsapp-help"><Info size={12} aria-hidden="true" /> La asignación queda registrada. Puedes abrir WhatsApp desde el detalle para avisarle al responsable.</p>
    </form> : <section className="panel"><EmptyState title="Registra el primer espacio" text="Necesitas una ubicación activa para crear una incidencia." action={<Link className="primary-button" to="/espacios">Ir a espacios</Link>} /></section>)}
  </div>;
}
