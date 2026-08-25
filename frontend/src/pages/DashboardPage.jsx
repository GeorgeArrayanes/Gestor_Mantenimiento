import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpRight, BusFront, CheckCircle2, Clock3, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function DashboardPage(){
  const { user } = useAuth(); const [data,setData]=useState(null); const [error,setError]=useState('');
  useEffect(()=>{const path=user.role==='ADMIN'?'/dashboard':'/incidents';api(path).then(setData).catch(e=>setError(e.message));},[user.role]);
  if(error)return <div className="page-error">{error}</div>; if(!data)return <div className="loading-page">Cargando resumen…</div>;
  if(user.role==='CONDUCTOR'){const items=data.incidents;const groups=[['Pendientes',items.filter(i=>i.status==='REPORTADO'),AlertTriangle],['En reparación',items.filter(i=>i.status==='EN_PROCESO'),Wrench],['Correcciones',items.filter(i=>i.status==='REQUIERE_CORRECCION'),Clock3],['Solucionadas',items.filter(i=>i.status==='RESUELTO'),CheckCircle2]];return <><div className="page-heading"><div><p className="eyebrow">Portal del conductor</p><h1>Hola, {user.name.split(' ')[0]}</h1><p>Estas son las novedades de tu unidad asignada.</p></div></div><div className="driver-summary">{groups.map(([label,arr,Icon])=><div className="metric-card" key={label}><span className="metric-icon blue"><Icon/></span><div><small>{label}</small><strong>{arr.length}</strong></div></div>)}</div><section className="panel"><div className="section-heading"><div><h2>Novedades que requieren tu atención</h2><p>Abre una novedad para actualizar la reparación.</p></div></div><div className="card-list">{items.filter(i=>i.status!=='RESUELTO').map(i=><Link to={`/novedades/${i.id}`} className="incident-card" key={i.id}><div className="bus-symbol"><BusFront/></div><div><strong>#{i.id} · {i.reference}</strong><span>{i.damage_type.replaceAll('_',' ')}</span><small>{new Date(i.reported_at).toLocaleDateString('es-CO')}</small></div><StatusBadge value={i.status}/></Link>)}{!items.length&&<EmptyState/>}</div></section></>}
  const s=data.stats;
  const availability=s.total?Math.round((s.operational/s.total)*100):0;
  const cards=[['Novedades abiertas',s.open,`${s.pending_validation} por validar`,AlertTriangle,'red'],['Casos resueltos',s.resolved,'Histórico total',CheckCircle2,'green'],['Tiempo de respuesta',`${s.avg_resolution_hours} h`,'Promedio de resolución',Clock3,'amber']];
  return <>
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">Centro de operaciones</p><h1>Hola, {user.name.split(' ')[0]}.</h1><p>Así se mueve la operación del colegio hoy.</p></div><Link to="/reportar" className="primary-button">Nuevo reporte <ArrowUpRight/></Link></div>
    <div className="dashboard-overview">
      <article className="fleet-pulse">
        <div className="fleet-pulse-head"><span>Disponibilidad de flota</span><BusFront/></div>
        <div className="fleet-pulse-value"><strong>{availability}<sup>%</sup></strong><span>de unidades<br/>listas para ruta</span></div>
        <div className="fleet-pulse-track" aria-label={`${availability}% de disponibilidad`}><i style={{width:`${availability}%`}}/></div>
        <div className="fleet-pulse-meta"><span><b>{s.operational}</b> operativos</span><span><b>{s.total}</b> registrados</span></div>
      </article>
      <div className="metrics-grid">{cards.map(([label,value,caption,Icon,color],index)=><article className={`metric-card metric-${color}`} key={label}><div><small>0{index+1} · {label}</small><strong>{value}</strong><span>{caption}</span></div><span className={`metric-icon ${color}`}><Icon/></span></article>)}</div>
    </div>
    <section className="recent-section"><div className="section-heading"><div><p className="eyebrow">Bitácora activa</p><h2>Novedades recientes</h2><p>Los últimos movimientos reportados por la flota.</p></div><Link to="/novedades" className="text-link">Abrir archivo <ArrowUpRight/></Link></div>
      {data.recent.length?<div className="recent-grid">{data.recent.slice(0,4).map((i,index)=><Link to={`/novedades/${i.id}`} className={`recent-card ${index===0?'featured':''}`} key={i.id}>
        <div className="recent-card-head"><span>NR-{String(i.id).padStart(3,'0')}</span><StatusBadge value={i.status}/></div>
        <div><small>{i.reference} · {i.plate}</small><h3>{i.damage_type.replaceAll('_',' ')}</h3></div>
        <footer><span>{i.driver_name||'Sin conductor'} · {new Date(i.reported_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</span><ArrowUpRight/></footer>
      </Link>)}</div>:<div className="panel"><EmptyState title="Sin movimientos recientes" text="Los nuevos reportes aparecerán aquí."/></div>}
    </section>
  </>;
}
