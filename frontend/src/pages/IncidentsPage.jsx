import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileDown, FileSpreadsheet, FileText, SlidersHorizontal, UserRound, Wrench, X } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api, downloadIncidentReport } from '../api.js';
import EmptyState from '../components/EmptyState.jsx';
import { FilterSelect, KpiCard, SearchInput, SectionPanel } from '../components/DesignSystem.jsx';
import IncidentCard from '../components/IncidentCard.jsx';
import Modal from '../components/Modal.jsx';
import Toast from '../components/Toast.jsx';
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

function bogotaToday() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export default function IncidentsPage() {
  const { startRequest } = usePageLifecycle();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [incidents, setIncidents] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = useMemo(bogotaToday, []);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState('month');
  const [reportValue, setReportValue] = useState(() => bogotaToday().slice(0, 7));
  const [reportBusy, setReportBusy] = useState('');
  const [reportError, setReportError] = useState('');
  const [toast, setToast] = useState(location.state?.success ? { message: location.state.success } : null);
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
  function openReport() { setReportError(''); setReportOpen(true); }
  function closeReport() { if (!reportBusy) { setReportOpen(false); setReportError(''); } }
  function changeReportPeriod(value) {
    setReportPeriod(value);
    setReportValue(value === 'day' ? today : value === 'month' ? today.slice(0, 7) : today.slice(0, 4));
    setReportError('');
  }
  async function exportReport(format) {
    if (reportBusy) return;
    const date = reportPeriod === 'day' ? reportValue : reportPeriod === 'month' ? `${reportValue}-01` : `${reportValue}-01-01`;
    setReportBusy(format); setReportError('');
    try {
      await downloadIncidentReport({ period: reportPeriod, date, format });
      setReportOpen(false);
      setToast({ message: `Reporte ${format === 'pdf' ? 'PDF' : 'Excel'} descargado correctamente.` });
    } catch (e) { setReportError(e.message); } finally { setReportBusy(''); }
  }
  const reportYears = Array.from({ length: Number(today.slice(0, 4)) - 1999 }, (_, index) => String(Number(today.slice(0, 4)) - index));
  return <div className="maintenance-page incidents-card-page">
    <div className="page-heading"><div><p className="eyebrow">Operación diaria</p><h1>Incidencias</h1><p>Gestiona y da seguimiento a las incidencias del colegio.</p></div><button className="secondary-button" type="button" onClick={openReport}><FileDown aria-hidden="true" />Exportar reporte</button></div>
    <section className="incident-state-summary" aria-label="Resumen de incidencias por estado">
      <KpiCard label="Sin asignar" value={loading || error ? '—' : counts.PENDING} detail="Esperan un responsable" icon={Clock3} tone="rose" />
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
    <div className="incident-results-heading"><div><h2>{filtered ? 'Resultados de tu búsqueda' : 'Registro de incidencias'}</h2><p>Primero las que no tienen responsable y las de mayor prioridad.</p></div>{!loading && !error && <span className="incident-results-count">{visible.length} {visible.length === 1 ? 'incidencia' : 'incidencias'}</span>}</div>
    <section aria-label="Listado de incidencias">{loading ? <div className="loading-page" role="status" aria-busy="true">Cargando incidencias…</div> : !error && (visible.length ? <div className="incident-card-grid">{visible.map((incident) => <IncidentCard key={incident.id} incident={incident} />)}</div> : <SectionPanel><EmptyState icon={Wrench} title={filtered ? 'No encontramos coincidencias' : 'Todo al día'} text={filtered ? 'Prueba otra búsqueda o ajusta los filtros.' : 'No hay incidencias registradas. Usa “Nueva incidencia” para comenzar.'} action={filtered ? <button className="secondary-button" type="button" onClick={clear}>Limpiar filtros</button> : undefined} /></SectionPanel>)}</section>
    {reportOpen && <Modal className="modal catalog-form report-export-modal" labelledBy="report-export-title" onClose={closeReport}>
      <div className="modal-head"><div><p className="eyebrow">Informes de gestión</p><h2 id="report-export-title">Exportar incidencias</h2><p>Genera un documento con todas las incidencias registradas en el periodo.</p></div><button className="icon-button" type="button" onClick={closeReport} disabled={Boolean(reportBusy)} aria-label="Cerrar reporte"><X size={20} /></button></div>
      {reportError && <div className="page-error" role="alert">{reportError}</div>}
      <div className="report-export-fields">
        <label>Periodo<select data-autofocus value={reportPeriod} onChange={(event) => changeReportPeriod(event.target.value)} disabled={Boolean(reportBusy)}><option value="day">Día</option><option value="month">Mes</option><option value="year">Año</option></select></label>
        {reportPeriod === 'day' && <label>Día del reporte<input type="date" value={reportValue} max={today} onChange={(event) => setReportValue(event.target.value)} required disabled={Boolean(reportBusy)} /></label>}
        {reportPeriod === 'month' && <label>Mes del reporte<input type="month" value={reportValue} max={today.slice(0, 7)} onChange={(event) => setReportValue(event.target.value)} required disabled={Boolean(reportBusy)} /></label>}
        {reportPeriod === 'year' && <label>Año del reporte<select value={reportValue} onChange={(event) => setReportValue(event.target.value)} disabled={Boolean(reportBusy)}>{reportYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>}
      </div>
      <div className="report-export-note"><FileDown aria-hidden="true" /><p><strong>Archivo listo para compartir</strong><span>El PDF conserva un diseño de lectura; Excel permite ordenar y filtrar los registros.</span></p></div>
      <div className="form-actions report-export-actions"><button type="button" className="secondary-button" onClick={() => exportReport('xlsx')} disabled={Boolean(reportBusy) || !reportValue}><FileSpreadsheet aria-hidden="true" />{reportBusy === 'xlsx' ? 'Generando…' : 'Descargar Excel'}</button><button type="button" className="primary-button" onClick={() => exportReport('pdf')} disabled={Boolean(reportBusy) || !reportValue}><FileText aria-hidden="true" />{reportBusy === 'pdf' ? 'Generando…' : 'Descargar PDF'}</button></div>
    </Modal>}
    <Toast toast={toast} onClose={() => setToast(null)} />
  </div>;
}


