import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, UserRound, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatAverageResolutionHours } from '../utils/maintenance.js';
import IncidentListView from './IncidentListView.jsx';
import usePageLifecycle from './usePageLifecycle.js';
import './maintenance-pages.css';

export default function DashboardPage() {
  const { user } = useAuth();
  const { startRequest } = usePageLifecycle();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const signal = startRequest();
    setLoading(true); setError('');
    try { const result = await api('/dashboard', { signal }); if (!signal.aborted) setData(result); } catch (e) { if (!signal.aborted) setError(e.message); } finally { if (!signal.aborted) setLoading(false); }
  }, [startRequest]);
  useEffect(() => { load(); }, [load]);
  const stats = data?.stats;
  const average = stats?.averageResolutionHours;
  return <div className="maintenance-page">
    <div className="page-heading"><div><p className="eyebrow">Centro de mantenimiento</p><h1>Hola, {user?.name?.split(' ')[0] || 'Administrador'}.</h1><p>Así se encuentra el mantenimiento del colegio hoy.</p></div></div>
    {error && <div className="page-error" role="alert">{error}<button type="button" className="text-button" onClick={load}>Reintentar</button></div>}
    {loading ? <div className="loading-page" role="status" aria-busy="true">Cargando el estado del mantenimiento…</div> : !error && stats && <>
      <section className="metrics-grid" aria-label="Estado del mantenimiento">
        <Link className="metric-card featured" to="/incidencias?estado=PENDING"><div className="metric-top"><span>Pendientes</span><span className="metric-icon"><AlertTriangle size={19} aria-hidden="true" /></span></div><strong>{stats.pending}</strong><small>Requieren un responsable</small></Link>
        <Link className="metric-card" to="/incidencias?estado=ASSIGNED"><div className="metric-top"><span>Asignadas</span><span className="metric-icon"><UserRound size={18} aria-hidden="true" /></span></div><strong>{stats.assigned}</strong><small>En manos del equipo</small></Link>
        <Link className="metric-card" to="/incidencias?estado=CLOSED"><div className="metric-top"><span>Cerradas este mes</span><span className="metric-icon"><CheckCircle2 size={19} aria-hidden="true" /></span></div><strong>{stats.closedThisMonth}</strong><small>Soluciones verificadas</small></Link>
        <div className="metric-card"><div className="metric-top"><span>Tiempo de solución</span><span className="metric-icon"><Clock3 size={19} aria-hidden="true" /></span></div><strong>{formatAverageResolutionHours(average)}</strong><small>{average === null || average === undefined ? 'Disponible al cerrar la primera incidencia' : 'Promedio de creación a cierre'}</small></div>
      </section>
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">Actividad del colegio</p><h2>Incidencias recientes</h2><p>Consulta las incidencias registradas y su estado actual.</p></div><Link className="text-button" to="/incidencias">Ver todas<ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        {data.recent?.length ? <IncidentListView incidents={data.recent} /> : <EmptyState icon={Wrench} title="Todo al día" text="No hay incidencias registradas. Cuando detectes un problema, puedes registrar una incidencia aquí." action={<Link className="secondary-button" to="/incidencias/nueva">Registrar primera incidencia</Link>} />}
      </section>
    </>}
  </div>;
}
