import { useEffect, useState } from 'react';
import { BusFront, Edit3, Plus, Route, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Toast from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import { isAdminRole } from '../utils/roles.js';

const empty={reference:'',plate:'',brand:'',model:'',route:'',capacity:18,current_status:'OPERATIVO',driver_id:null};

export default function BusesPage(){
  const {user}=useAuth();
  const [buses,setBuses]=useState([]);const [drivers,setDrivers]=useState([]);const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(empty);const [error,setError]=useState('');const [driversError,setDriversError]=useState('');const [toast,setToast]=useState(null);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
  const load=()=>{setLoading(true);setError('');return api('/buses').then(d=>setBuses(d.buses)).catch(e=>{setBuses([]);setError(e.message)}).finally(()=>setLoading(false))};
  const loadDrivers=()=>{setDriversError('');return api('/users?role=CONDUCTOR').then(d=>setDrivers(d.users)).catch(()=>{setDrivers([]);setDriversError('No pudimos cargar los conductores disponibles.')})};
  useEffect(()=>{load();if(isAdminRole(user.role))loadDrivers()},[user.role]);
  function open(bus=null){setEditing(bus?.id||'new');setForm(bus?{...bus,driver_id:bus.driver_id||null}:empty);setError('')}
  function close(){if(saving)return;setEditing(null);setError('')}
  function update(field,value){setForm(current=>({...current,[field]:value}));if(error)setError('')}
  async function save(e){e.preventDefault();if(saving)return;setSaving(true);setError('');try{const path=editing==='new'?'/buses':`/buses/${editing}`;await api(path,{method:editing==='new'?'POST':'PATCH',body:JSON.stringify({...form,driver_id:form.driver_id?Number(form.driver_id):null,capacity:Number(form.capacity)})});setEditing(null);setToast({message:'Bus guardado correctamente.'});await load()}catch(err){setError(err.message)}finally{setSaving(false)}}

  if(user.role==='CONDUCTOR') return <>
    <div className="page-heading"><div><p className="eyebrow">Unidad asignada</p><h1>Mi bus</h1><p>Información operativa del vehículo bajo tu responsabilidad.</p></div></div>
    {error&&<div className="page-error" role="alert">{error} <button type="button" className="text-button" onClick={load}>Reintentar</button></div>}
    {loading?<div className="loading-page" role="status" aria-live="polite" aria-busy="true">Preparando la ficha de tu unidad…</div>:!error&&<div className="bus-grid">{buses.map(b=><article className="bus-card featured" key={b.id}>
      <div className="bus-card-icon"><BusFront/></div><div className="bus-card-head"><div><small>{b.brand} {b.model}</small><h2>{b.reference}</h2><strong>{b.plate}</strong></div><StatusBadge value={b.current_status}/></div>
      <dl><div><dt><Route/>Ruta asignada</dt><dd>{b.route||'Sin ruta'}</dd></div><div><dt><Users/>Capacidad</dt><dd>{b.capacity} estudiantes</dd></div></dl>
      <div className="active-count"><b>{b.active_incidents}</b> novedades activas</div><footer><Link to={`/buses/${b.id}`}>Ver ficha e historial →</Link></footer>
    </article>)}{!buses.length&&<EmptyState title="Sin bus asignado" text="Contacta al administrador de flota."/>}</div>}
  </>;

  return <>
    <div className="page-heading"><div><p className="eyebrow">Flota escolar</p><h1>Gestión de buses</h1><p>Registra unidades, asigna conductores y controla su estado operativo.</p></div><button type="button" className="primary-button" onClick={()=>open()}><Plus aria-hidden="true"/>Registrar bus</button></div>
    {error&&!editing&&<div className="page-error" role="alert">{error} <button type="button" className="text-button" onClick={load}>Reintentar</button></div>}
    {driversError&&!editing&&<div className="page-notice" role="status">{driversError} <button type="button" className="text-button" onClick={loadDrivers}>Reintentar</button></div>}
    {loading?<div className="loading-page" role="status" aria-live="polite" aria-busy="true">Organizando la flota…</div>:error?null:buses.length?<div className="bus-grid">{buses.map(b=><article className="bus-card" key={b.id}>
      <div className="bus-card-head"><div><small>{b.brand} {b.model}</small><h2>{b.reference}</h2><strong>{b.plate}</strong></div><StatusBadge value={b.current_status}/></div>
      <dl><div><dt><Route/>Ruta</dt><dd>{b.route||'Sin asignar'}</dd></div><div><dt><Users/>Conductor</dt><dd>{b.driver_name||'Sin asignar'}</dd></div></dl>
      <footer><Link to={`/buses/${b.id}`}><b>{b.active_incidents}</b> novedades · ficha</Link><button type="button" onClick={()=>open(b)} aria-label={`Editar ${b.reference}, placa ${b.plate}`}><Edit3 aria-hidden="true"/>Editar</button></footer>
    </article>)}</div>:<div className="panel"><EmptyState title="Aún no hay buses registrados" text="Registra la primera unidad para comenzar a organizar la flota."/></div>}
    {editing&&<Modal as="form" onSubmit={save} onClose={close} labelledBy="bus-modal-title" describedBy={error?'bus-modal-error':undefined}>
      <div className="modal-head"><div><p className="eyebrow">{editing==='new'?'Nueva unidad':'Actualizar unidad'}</p><h2 id="bus-modal-title">{editing==='new'?'Registrar bus':form.reference}</h2></div><button type="button" onClick={close} aria-label="Cerrar formulario de bus" disabled={saving}>×</button></div>{error&&<div id="bus-modal-error" className="page-error" role="alert">{error}</div>}{driversError&&<div className="page-notice" role="status">{driversError} <button type="button" className="text-button" onClick={loadDrivers}>Reintentar</button></div>}
      <div className="form-grid"><label>Referencia<input data-autofocus value={form.reference} onChange={e=>update('reference',e.target.value)} placeholder="Bus 15" required/></label><label>Placa<input value={form.plate} onChange={e=>update('plate',e.target.value.toUpperCase())} placeholder="ABC-123" required/></label><label>Marca<input value={form.brand} onChange={e=>update('brand',e.target.value)} required/></label><label>Modelo<input value={form.model} onChange={e=>update('model',e.target.value)} required/></label><label className="full">Ruta<input value={form.route||''} onChange={e=>update('route',e.target.value)}/></label><label>Capacidad<input type="number" min="1" max="100" value={form.capacity} onChange={e=>update('capacity',e.target.value)} required/></label><label>Estado<select value={form.current_status} onChange={e=>update('current_status',e.target.value)}><option value="OPERATIVO">Operativo</option><option value="CON_NOVEDADES">Con novedades</option><option value="EN_MANTENIMIENTO">En mantenimiento</option><option value="FUERA_DE_SERVICIO">Fuera de servicio</option></select></label><label className="full">Conductor asignado<select value={form.driver_id||''} onChange={e=>update('driver_id',e.target.value||null)}><option value="">Sin conductor</option>{drivers.filter(d=>(d.status==='ACTIVO'||Number(d.id)===Number(form.driver_id))&&(!d.bus_id||Number(d.id)===Number(form.driver_id))).map(d=><option key={d.id} value={d.id}>{d.name} · {d.identification}{d.status!=='ACTIVO'?' · Inactivo':''}</option>)}</select></label></div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={close} disabled={saving}>Cancelar</button><button type="submit" className="primary-button" disabled={saving} aria-busy={saving}>{saving?'Guardando…':'Guardar bus'}</button></div>
    </Modal>}
    <Toast toast={toast} onClose={()=>setToast(null)}/>
  </>;
}
