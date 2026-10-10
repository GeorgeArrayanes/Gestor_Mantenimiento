import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, ArrowUpRight, Building2, CalendarDays, CheckCircle2, Clock3, MapPin, UserRound, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, KpiCard, SectionPanel } from '../components/DesignSystem.jsx';
import IncidentCard from '../components/IncidentCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { activeRecord, formatAverageResolutionHours, sortIncidents } from '../utils/maintenance.js';
import IncidentListView from './IncidentListView.jsx';
import usePageLifecycle from './usePageLifecycle.js';
import './maintenance-pages.css';
import './dashboard.css';

export default function DashboardPage() {
  const { user } = useAuth();
  const { startRequest } = usePageLifecycle();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const signal = startRequest();
    setLoading(true); setError('');
    try {
      const [dashboard, all, spaces, personnel] = await Promise.all([
        api('/dashboard', { signal }), api('/incidents', { signal }), api('/spaces', { signal }), api('/personnel', { signal }),
      ]);
      if (!signal.aborted) setData({ ...dashboard, incidents: all.incidents, spaces: spaces.spaces, personnel: personnel.personnel });
    } catch (e) { if (!signal.aborted) setError(e.message); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [startRequest]);
  useEffect(() => { load(); }, [load]);
  const stats = data?.stats;
  const average = stats?.averageResolutionHours;
  const spaces = data?.spaces?.filter(activeRecord) || [];
  const personnel = data?.personnel?.filter(activeRecord) || [];
  const incidents = data?.incidents || [];
  const current = sortIncidents(incidents.filter(item => item.status === 'ASSIGNED'))[0];
  const counts = ['PENDING', 'ASSIGNED', 'CLOSED'].map(status => incidents.filter(item => item.status === status).length);
  const highPriority = incidents.filter(item => item.priority === 'ALTA' && item.status !== 'CLOSED').length;
  const total = incidents.length;
  const pendingAngle = total ? counts[0] / total * 360 : 0;
  const assignedAngle = total ? (counts[0] + counts[1]) / total * 360 : 0;
  const year = new Date().toLocaleDateString('en', { timeZone: 'America/Bogota', year: 'numeric' });
  const ready = !loading && !error && stats;
  return <div className="maintenance-page dashboard-page">
    {error && <div className="page-error" role="alert">{error}<button type="button" className="text-button" onClick={load}>Reintentar</button></div>}
    <div className="dashboard-workspace">
      <section className="campus-hero" aria-label="Panorama del mantenimiento del colegio">
        <div className="campus-hero-content"><p className="eyebrow">Centro de mantenimiento</p><h1>Estado general del colegio</h1><p>Cada espacio cuenta. Organiza, asigna y resuelve.</p><Link className="primary-button" to="/incidencias">Ver incidencias <ArrowRight size={18} aria-hidden="true" /></Link></div>
        <span className="campus-hero-caption">Hola, {user?.name?.split(' ')[0] || 'Administrador'}.</span>
        <section className="dashboard-kpis" aria-label="Estado del mantenimiento" aria-busy={loading}>
          <KpiCard label="Sin asignar" value={ready ? stats.pending : '—'} icon={Clock3} tone="amber" to="/incidencias?estado=PENDING" />
          <KpiCard label="Asignadas" value={ready ? stats.assigned : '—'} icon={UserRound} tone="blue" to="/incidencias?estado=ASSIGNED" />
          <KpiCard label="Alta sin cerrar" value={ready ? highPriority : '—'} icon={AlertTriangle} tone="rose" />
          <KpiCard label="Año escolar" value={year} icon={CalendarDays} tone="teal" />
        </section>
      </section>
      <aside className="dashboard-rail" aria-label="Espacios y equipo del colegio">
        <SectionPanel className="dashboard-spaces" title="Espacios" action={<Link className="text-button" to="/espacios">Ver todos <ArrowRight size={15} aria-hidden="true" /></Link>}>
          {loading ? <p className="muted">Cargando catálogo…</p> : error ? <p className="muted">Catálogo no disponible.</p> : <>
            <p className="dashboard-catalog-count"><Building2 size={15} aria-hidden="true" /><strong>{spaces.length}</strong> espacios activos</p>
            <div className="dashboard-space-list">{spaces.slice(0, 4).map(space => {
              const activeIncidents = incidents.filter(item => item.status !== 'CLOSED' && String(item.space_id) === String(space.id)).length;
              return <Link key={space.id} to={`/incidencias?espacio=${space.id}`}><span className="dashboard-space-icon"><MapPin size={19} aria-hidden="true" /></span><div><strong>{space.name}</strong><small>{space.zone || 'Sin zona registrada'}</small></div><span className={`space-workload ${activeIncidents ? 'has-incidents' : ''}`} aria-label={`${activeIncidents} incidencias activas`} title={`${activeIncidents} incidencias activas`}>{activeIncidents}</span><ArrowUpRight size={14} aria-hidden="true" /></Link>;
            })}</div>
            {!spaces.length && <p className="muted">Registra las ubicaciones del colegio.</p>}
          </>}
        </SectionPanel>
        <SectionPanel className="dashboard-team" title="Nuestro equipo" subtitle={ready ? `${personnel.length} ${personnel.length === 1 ? 'persona activa' : 'personas activas'}` : undefined} action={<Link className="icon-button" to="/personal" aria-label="Ver personal"><ArrowUpRight size={19} /></Link>}>
          {loading ? <p className="muted">Cargando equipo…</p> : error ? <p className="muted">Equipo no disponible.</p> : <>
            <div className="dashboard-person-list">{personnel.slice(0, 3).map(person => {
              const assigned = incidents.filter(incident => incident.status === 'ASSIGNED' && String(incident.assigned_person_id) === String(person.id)).length;
              return <Link key={person.id} to={`/incidencias?responsable=${person.id}`}><Avatar name={person.name} /><div><strong>{person.name}</strong><small>{person.specialty || 'Mantenimiento'}</small></div><span className="team-workload" title={`${assigned} incidencias asignadas`} aria-label={`${assigned} incidencias asignadas`}>{assigned}</span></Link>;
            })}</div>
            {!personnel.length && <p className="muted">Añade al equipo para asignar incidencias.</p>}
            <p className="dashboard-team-note"><Wrench size={15} aria-hidden="true" />No requieren cuentas de acceso.</p>
          </>}
        </SectionPanel>
      </aside>
      {loading ? <div className="loading-page dashboard-loading" role="status">Cargando el estado del mantenimiento…</div> : ready && <>
        <div className="dashboard-modules">
          <SectionPanel className="dashboard-distribution" title="Resumen de mantenimiento" subtitle="Todas las incidencias registradas">
            <div className="dashboard-balance"><div className="incident-donut" style={{ background: total ? `conic-gradient(#d4a14a 0deg ${pendingAngle}deg, #6092af ${pendingAngle}deg ${assignedAngle}deg, #087a70 ${assignedAngle}deg 360deg)` : '#e4eae7' }} role="img" aria-label={`${counts[0]} sin asignar, ${counts[1]} asignadas y ${counts[2]} cerradas`}><span><strong>{total}</strong><small>registradas</small></span></div><ul className="donut-legend">{['Sin asignar', 'Asignadas', 'Cerradas'].map((label, index) => <li key={label}><i className={`legend-dot legend-${index}`} /><strong>{counts[index]}</strong><span>{label}</span></li>)}</ul></div>
            <div className="dashboard-insights"><div><Clock3 size={19} aria-hidden="true" /><span><strong>{formatAverageResolutionHours(average)}</strong><small>{average == null ? 'Aún sin cierres' : 'Tiempo medio de solución'}</small></span></div><div><CheckCircle2 size={19} aria-hidden="true" /><span><strong>{stats.closedThisMonth}</strong><small>Cerradas este mes</small></span></div></div>
          </SectionPanel>
          <SectionPanel className="dashboard-current" title="Incidencia destacada" subtitle="La asignada de mayor prioridad" action={<Link className="icon-button" to="/incidencias?estado=ASSIGNED" aria-label="Ver incidencias asignadas"><ArrowUpRight size={18} /></Link>}>
            {current ? <IncidentCard incident={current} compact showContact={false} /> : <EmptyState icon={Wrench} title="Sin incidencias asignadas" text="Asigna un responsable para dar seguimiento al trabajo." action={stats.pending ? <Link className="text-button" to="/incidencias?estado=PENDING">Ver sin asignar <ArrowRight size={15} /></Link> : null} />}
          </SectionPanel>
        </div>
        <SectionPanel className="dashboard-recent" title="Incidencias recientes" action={<Link className="text-button" to="/incidencias">Ver todas <ArrowRight size={15} aria-hidden="true" /></Link>}>
          {data.recent?.length ? <IncidentListView incidents={data.recent} /> : <EmptyState icon={Wrench} title="Todo al día" text="Las incidencias aparecerán aquí cuando registres la primera." />}
        </SectionPanel>
      </>}
    </div>
  </div>;
}
