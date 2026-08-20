import { useCallback, useEffect, useState } from 'react';
import { Calendar, Camera, Route, ShieldCheck, UserRound, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api, fileUrl } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Toast from '../components/Toast.jsx';

export default function BusDetailPage(){
  const {id}=useParams();const {user}=useAuth();const [data,setData]=useState(null);const [error,setError]=useState('');const [toast,setToast]=useState(null);const [busy,setBusy]=useState(false);
  const [form,setForm]=useState({description:'',damage_date:new Date().toISOString().slice(0,10),file:null});
  const load=useCallback(()=>api(`/buses/${id}`).then(setData).catch(e=>setError(e.message)),[id]);useEffect(()=>{load()},[load]);
  async function submit(e){e.preventDefault();setBusy(true);try{const body=new FormData();body.append('description',form.description);body.append('damage_date',form.damage_date);if(form.file)body.append('file',form.file);await api(`/buses/${id}/preexisting-damages`,{method:'POST',body});setForm({description:'',damage_date:new Date().toISOString().slice(0,10),file:null});setToast({message:'Daño preexistente añadido al historial.'});load()}catch(err){setError(err.message)}finally{setBusy(false)}}
  if(!data)return <div className={error?'page-error':'loading-page'}>{error||'Cargando ficha…'}</div>;
  const {bus,preexistingDamages}=data;
  return <><div className="page-heading"><div><Link to="/buses" className="back-link">← Volver a buses</Link><p className="eyebrow">Ficha del vehículo</p><h1>{bus.reference} · {bus.plate}</h1><p>{bus.brand} {bus.model}</p></div><StatusBadge value={bus.current_status}/></div>
    <section className="vehicle-facts panel"><Fact icon={Route} label="Ruta asignada" value={bus.route||'Sin ruta'}/><Fact icon={Users} label="Capacidad" value={`${bus.capacity} estudiantes`}/><Fact icon={UserRound} label="Conductor principal" value={bus.driver_name||'Sin asignar'}/><Fact icon={ShieldCheck} label="Estado" value={bus.current_status.replaceAll('_',' ')}/></section>
    <div className="detail-grid bus-history-grid"><section className="panel"><div className="section-heading"><div><h2>Daños preexistentes</h2><p>Registro separado de las novedades operativas.</p></div></div>{preexistingDamages.length?<div className="damage-history">{preexistingDamages.map(d=><article key={d.id}>{d.file_url?<img src={fileUrl(d.file_url)} alt={d.description}/>:<span><Camera/></span>}<div><strong>{d.description}</strong><small><Calendar/> {new Date(`${d.damage_date}T12:00:00`).toLocaleDateString('es-CO')} · {d.registered_by_name}</small></div></article>)}</div>:<EmptyState title="Sin daños anteriores" text="No se han registrado daños preexistentes para esta unidad."/>}</section>
    {user.role==='ADMIN'&&<form className="panel" onSubmit={submit}><div className="section-heading"><div><h2>Registrar daño anterior</h2><p>No crea una novedad operativa.</p></div></div>{error&&<div className="page-error">{error}</div>}<div className="form-grid single"><label className="full">Descripción<textarea rows="4" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required/></label><label>Fecha<input type="date" value={form.damage_date} onChange={e=>setForm({...form,damage_date:e.target.value})} required/></label><label>Fotografía opcional<input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={e=>setForm({...form,file:e.target.files[0]||null})}/></label></div><div className="form-actions"><button className="primary-button" disabled={busy}>{busy?'Guardando…':'Agregar al historial'}</button></div></form>}</div><Toast toast={toast} onClose={()=>setToast(null)}/></>;
}

function Fact({icon:Icon,label,value}){return <div><Icon/><span><small>{label}</small><b>{value}</b></span></div>}
