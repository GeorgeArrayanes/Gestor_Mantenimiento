import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, SlidersHorizontal, Wrench } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import EmptyState from '../components/EmptyState.jsx';
import { PRIORITIES, STATUSES, sortIncidents, spaceLabel } from '../utils/maintenance.js';
import IncidentListView from './IncidentListView.jsx';
import usePageLifecycle from './usePageLifecycle.js';
import './maintenance-pages.css';

export default function IncidentsPage() {
  const { startRequest } = usePageLifecycle();
  const [params, setParams] = useSearchParams();
  const [incidents, setIncidents] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [person, setPerson] = useState('');
  const [space, setSpace] = useState('');
  const status = STATUSES.some(([key]) => key === params.get('estado')) ? params.get('estado') : '';
  const load = useCallback(async () => {
    const signal = startRequest();
    setLoading(true); setError('');
    try { const [i, s, p] = await Promise.all([api('/incidents', { signal }), api('/spaces', { signal }), api('/personnel', { signal })]); if (!signal.aborted) { setIncidents(sortIncidents(i.incidents)); setSpaces(s.spaces); setPersonnel(p.personnel); } } catch (e) { if (!signal.aborted) setError(e.message); } finally { if (!signal.aborted) setLoading(false); }
  }, [startRequest]);
  useEffect(() => { load(); }, [load]);
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return incidents.filter((i) => (!status || i.status === status) && (!priority || i.priority === priority) && (!person || String(i.assigned_person_id || '') === person) && (!space || String(i.space_id) === space) && (!query || [i.code, i.description, i.space_name, i.space_zone, i.assigned_person_name].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(query)));
  }, [incidents, search, status, priority, person, space]);
  const filtered = Boolean(search || status || priority || person || space);
  function clear() { setSearch(''); setParams({}, { replace: true }); setPriority(''); setPerson(''); setSpace(''); }
  return <div className="maintenance-page">
    <div className="page-heading"><div><p className="eyebrow">Operación diaria</p><h1>Incidencias</h1><p>Cada incidencia, su responsable y el avance de su solución.</p></div><Link className="primary-button" to="/incidencias/nueva"><Plus aria-hidden="true" />Nueva incidencia</Link></div>
    <section className="panel" aria-label="Buscar y filtrar incidencias"><div className="filter-bar">
      <label>Buscar incidencia<span className="search-field"><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código, descripción, ubicación…" /></span></label>
      <label>Estado<select value={status} onChange={(e) => setParams(e.target.value ? { estado: e.target.value } : {}, { replace: true })}><option value="">Todos</option>{STATUSES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Prioridad<select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">Todas</option>{PRIORITIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Responsable<select value={person} onChange={(e) => setPerson(e.target.value)}><option value="">Todos</option>{personnel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Espacio<select value={space} onChange={(e) => setSpace(e.target.value)}><option value="">Todos</option>{spaces.map((s) => <option key={s.id} value={s.id}>{spaceLabel(s)}</option>)}</select></label>
    </div><div className="filter-summary"><span aria-live="polite">{loading ? 'Cargando incidencias…' : `${visible.length} ${visible.length === 1 ? 'incidencia' : 'incidencias'}`}</span>{filtered && <button className="text-button" type="button" onClick={clear}><SlidersHorizontal size={13} aria-hidden="true" />Limpiar filtros</button>}</div></section>
    {error && <div className="page-error" role="alert">{error}<button className="text-button" type="button" onClick={load}>Reintentar</button></div>}
    <section className="panel" aria-label="Listado de incidencias">{loading ? <div className="loading-page" role="status" aria-busy="true">Cargando incidencias…</div> : !error && (visible.length ? <IncidentListView incidents={visible} /> : <EmptyState icon={Wrench} title={filtered ? 'No encontramos coincidencias' : 'Todo al día'} text={filtered ? 'Prueba otra búsqueda o ajusta los filtros.' : 'No hay incidencias registradas. Registra una incidencia para comenzar.'} action={filtered ? <button className="secondary-button" type="button" onClick={clear}>Limpiar filtros</button> : <Link className="secondary-button" to="/incidencias/nueva">Registrar incidencia</Link>} />)}</section>
  </div>;
}


