import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, SlidersHorizontal, UserRound, Wrench } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import EmptyState from '../components/EmptyState.jsx';
import { FilterSelect, KpiCard, SearchInput, SectionPanel } from '../components/DesignSystem.jsx';
import IncidentCard from '../components/IncidentCard.jsx';
import { PRIORITIES, STATUSES, problemLabel, sortIncidents, spaceLabel } from '../utils/maintenance.js';
import usePageLifecycle from './usePageLifecycle.js';
import './maintenance-pages.css';

export function filterIncidents(incidents, { search = '', status = '', priority = '', person = '', space = '' } = {}) {
  const query = search.trim().toLocaleLowerCase('es');
  return incidents.filter((incident) => (!status || incident.status === status)
    && (!priority || incident.priority === priority)
    && (!person || String(incident.assigned_person_id || '') === String(person))
    && (!space || String(incident.space_id) === String(space))
    && (!query || [incident.code, problemLabel(incident.problem_type), incident.description, incident.space_name, incident.space_zone, incident.assigned_person_name].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(query)));
}

export default function IncidentsPage() {
  const { startRequest } = usePageLifecycle();
  const [params, setParams] = useSearchParams();
  const [incidents, setIncidents] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const search = params.get('buscar') || '';
  const priority = PRIORITIES.some(([key]) => key === params.get('prioridad')) ? params.get('prioridad') : '';
  const person = personnel.some((item) => String(item.id) === params.get('responsable')) ? params.get('responsable') : '';
  const space = spaces.some((item) => String(item.id) === params.get('espacio')) ? params.get('espacio') : '';
  const status = STATUSES.some(([key]) => key === params.get('estado')) ? params.get('estado') : '';
  const load = useCallback(async () => {
    const signal = startRequest();
    setLoading(true); setError('');
    try { const [i, s, p] = await Promise.all([api('/incidents', { signal }), api('/spaces', { signal }), api('/personnel', { signal })]); if (!signal.aborted) { setIncidents(sortIncidents(i.incidents)); setSpaces(s.spaces); setPersonnel(p.personnel); } } catch (e) { if (!signal.aborted) setError(e.message); } finally { if (!signal.aborted) setLoading(false); }
  }, [startRequest]);
  useEffect(() => { load(); }, [load]);
  const visible = useMemo(() => filterIncidents(incidents, { search, status, priority, person, space }), [incidents, search, status, priority, person, space]);
  const counts = useMemo(() => incidents.reduce((summary, incident) => { if (Object.hasOwn(summary, incident.status)) summary[incident.status] += 1; return summary; }, { PENDING: 0, ASSIGNED: 0, CLOSED: 0 }), [incidents]);
  const filtered = Boolean(search || status || priority || person || space);
  function setFilter(name, value) { const next = new URLSearchParams(params); if (value) next.set(name, value); else next.delete(name); setParams(next, { replace: true }); }
  function clear() { setParams({}, { replace: true }); }
  return <div className="maintenance-page incidents-card-page">
    <div className="page-heading"><div><p className="eyebrow">Operación diaria</p><h1>Incidencias</h1><p>Gestiona y da seguimiento a las incidencias del colegio.</p></div></div>
    <section className="incident-state-summary" aria-label="Resumen de incidencias por estado">
      <KpiCard label="Pendientes" value={loading || error ? '—' : counts.PENDING} detail="Por asignar a una persona" icon={Clock3} tone="rose" />
      <KpiCard label="Asignadas" value={loading || error ? '—' : counts.ASSIGNED} detail="Con responsable del equipo" icon={UserRound} tone="blue" />
      <KpiCard label="Cerradas" value={loading || error ? '—' : counts.CLOSED} detail="Soluciones registradas" icon={CheckCircle2} tone="mint" />
    </section>
    <SectionPanel className="incident-filter-panel" aria-label="Buscar y filtrar incidencias"><div className="incident-filter-grid">
      <SearchInput label="Buscar incidencia" value={search} onChange={(e) => setFilter('buscar', e.target.value)} placeholder="Código, descripción, ubicación…" />
      <FilterSelect label="Estado" value={status} onChange={(e) => setFilter('estado', e.target.value)}><option value="">Todos los estados</option>{STATUSES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</FilterSelect>
      <FilterSelect label="Prioridad" value={priority} onChange={(e) => setFilter('prioridad', e.target.value)}><option value="">Todas</option>{PRIORITIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</FilterSelect>
      <FilterSelect label="Responsable" value={person} onChange={(e) => setFilter('responsable', e.target.value)}><option value="">Todo el equipo</option>{personnel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</FilterSelect>
      <FilterSelect label="Espacio" value={space} onChange={(e) => setFilter('espacio', e.target.value)}><option value="">Todos los espacios</option>{spaces.map((s) => <option key={s.id} value={s.id}>{spaceLabel(s)}</option>)}</FilterSelect>
    </div><div className="incident-filter-summary"><span aria-live="polite">{loading ? 'Cargando incidencias…' : error ? 'Registro no disponible' : `${visible.length} de ${incidents.length} ${incidents.length === 1 ? 'incidencia' : 'incidencias'}`}</span>{filtered && <button className="text-button" type="button" onClick={clear}><SlidersHorizontal size={13} aria-hidden="true" />Limpiar filtros</button>}</div></SectionPanel>
    {error && <div className="page-error" role="alert">{error}<button className="text-button" type="button" onClick={load}>Reintentar</button></div>}
    <div className="incident-results-heading"><div><h2>{filtered ? 'Resultados de tu búsqueda' : 'Registro de incidencias'}</h2><p>Primero las pendientes y de mayor prioridad.</p></div>{!loading && !error && <span className="incident-results-count">{visible.length} {visible.length === 1 ? 'incidencia' : 'incidencias'}</span>}</div>
    <section aria-label="Listado de incidencias">{loading ? <div className="loading-page" role="status" aria-busy="true">Cargando incidencias…</div> : !error && (visible.length ? <div className="incident-card-grid">{visible.map((incident) => <IncidentCard key={incident.id} incident={incident} />)}</div> : <SectionPanel><EmptyState icon={Wrench} title={filtered ? 'No encontramos coincidencias' : 'Todo al día'} text={filtered ? 'Prueba otra búsqueda o ajusta los filtros.' : 'No hay incidencias registradas. Usa “Nueva incidencia” para comenzar.'} action={filtered ? <button className="secondary-button" type="button" onClick={clear}>Limpiar filtros</button> : undefined} /></SectionPanel>)}</section>
  </div>;
}


