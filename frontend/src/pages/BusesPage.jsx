import { useEffect, useState } from 'react';
import { BusFront, Edit3, Plus, Route, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Toast from '../components/Toast.jsx';

const empty={reference:'',plate:'',brand:'',model:'',route:'',capacity:18,current_status:'OPERATIVO',driver_id:null};

export default function BusesPage(){
  const {user}=useAuth();
  const [buses,setBuses]=useState([]);const [drivers,setDrivers]=useState([]);const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(empty);const [error,setError]=useState('');const [toast,setToast]=useState(null);
  const load=()=>api('/buses').then(d=>setBuses(d.buses)).catch(e=>setError(e.message));
  useEffect(()=>{load();if(user.role==='ADMIN')api('/users?role=CONDUCTOR').then(d=>setDrivers(d.users)).catch(()=>{})},[user.role]);
  function open(bus=null){setEditing(bus?.id||'new');setForm(bus?{...bus,driver_id:bus.driver_id||null}:empty);setError('')}
  async function save(e){e.preventDefault();try{const path=editing==='new'?'/buses':`/buses/${editing}`;await api(path,{method:editing==='new'?'POST':'PATCH',body:JSON.stringify({...form,driver_id:form.driver_id?Number(form.driver_id):null,capacity:Number(form.capacity)})});setEditing(null);setToast({message:'Bus guardado correctamente.'});load()}catch(err){setError(err.message)}}

  if(user.role==='CONDUCTOR') return <>
    <div className="page-heading"><div><p className="eyebrow">Unidad asignada</p><h1>Mi bus</h1><p>Información operativa del vehículo bajo tu responsabilidad.</p></div></div>
    <div className="bus-grid">{buses.map(b=><article className="bus-card featured" key={b.id}>
      <div className="bus-card-icon"><BusFront/></div><div className="bus-card-head"><div><small>{b.brand} {b.model}</small><h2>{b.reference}</h2><strong>{b.plate}</strong></div><StatusBadge value={b.current_status}/></div>
      <dl><div><dt><Route/>Ruta asignada</dt><dd>{b.route||'Sin ruta'}</dd></div><div><dt><Users/>Capacidad</dt><dd>{b.capacity} estudiantes</dd></div></dl>
      <div className="active-count"><b>{b.active_incidents}</b> novedades activas</div><footer><Link to={`/buses/${b.id}`}>Ver ficha e historial →</Link></footer>
    </article>)}{!buses.length&&<EmptyState title="Sin bus asignado" text="Contacta al administrador de flota."/>}</div>
  </>;

  return <>
    <div className="page-heading"><div><p className="eyebrow">Flota escolar</p><h1>Gestión de buses</h1><p>Registra unidades, asigna conductores y controla su estado operativo.</p></div><button className="primary-button" onClick={()=>open()}><Plus/>Registrar bus</button></div>
    {error&&!editing&&<div className="page-error">{error}</div>}
    <div className="bus-grid">{buses.map(b=><article className="bus-card" key={b.id}>
      <div className="bus-card-head"><div><small>{b.brand} {b.model}</small><h2>{b.reference}</h2><strong>{b.plate}</strong></div><StatusBadge value={b.current_status}/></div>
      <dl><div><dt><Route/>Ruta</dt><dd>{b.route||'Sin asignar'}</dd></div><div><dt><Users/>Conductor</dt><dd>{b.driver_name||'Sin asignar'}</dd></div></dl>
      <footer><Link to={`/buses/${b.id}`}><b>{b.active_incidents}</b> novedades · ficha</Link><button onClick={()=>open(b)}><Edit3/>Editar</button></footer>
    </article>)}</div>
    {editing&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null)}}><form className="modal" onSubmit={save}>
      <div className="modal-head"><div><p className="eyebrow">{editing==='new'?'Nueva unidad':'Actualizar unidad'}</p><h2>{editing==='new'?'Registrar bus':form.reference}</h2></div><button type="button" onClick={()=>setEditing(null)}>×</button></div>{error&&<div className="page-error">{error}</div>}
      <div className="form-grid"><label>Referencia<input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} placeholder="Bus 15" required/></label><label>Placa<input value={form.plate} onChange={e=>setForm({...form,plate:e.target.value.toUpperCase()})} placeholder="ABC-123" required/></label><label>Marca<input value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})} required/></label><label>Modelo<input value={form.model} onChange={e=>setForm({...form,model:e.target.value})} required/></label><label className="full">Ruta<input value={form.route||''} onChange={e=>setForm({...form,route:e.target.value})}/></label><label>Capacidad<input type="number" min="1" max="100" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})} required/></label><label>Estado<select value={form.current_status} onChange={e=>setForm({...form,current_status:e.target.value})}><option value="OPERATIVO">Operativo</option><option value="CON_NOVEDADES">Con novedades</option><option value="EN_MANTENIMIENTO">En mantenimiento</option><option value="FUERA_DE_SERVICIO">Fuera de servicio</option></select></label><label className="full">Conductor asignado<select value={form.driver_id||''} onChange={e=>setForm({...form,driver_id:e.target.value||null})}><option value="">Sin conductor</option>{drivers.filter(d=>!d.bus_id||d.id===form.driver_id).map(d=><option key={d.id} value={d.id}>{d.name} · {d.identification}</option>)}</select></label></div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setEditing(null)}>Cancelar</button><button className="primary-button">Guardar bus</button></div>
    </form></div>}
    <Toast toast={toast} onClose={()=>setToast(null)}/>
  </>;
}
