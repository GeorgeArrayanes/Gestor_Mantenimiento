import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, Info, Phone, Plus, UserRound, Users, Wrench, X } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import Toast from '../components/Toast.jsx';
import { activeRecord, normalizePhone } from '../utils/maintenance.js';
import usePageLifecycle from './usePageLifecycle.js';
import './maintenance-pages.css';

const empty = { name: '', phone: '', specialty: '', notes: '', active: true };
export default function PersonnelPage() {
  const { mounted, startRequest } = usePageLifecycle();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('active');
  const load = useCallback(async () => { const signal = startRequest(); setLoading(true); setError(''); try { const data = await api('/personnel', { signal }); if (!signal.aborted) setItems(data.personnel); } catch (e) { if (!signal.aborted) setError(e.message); } finally { if (!signal.aborted) setLoading(false); } }, [startRequest]);
  useEffect(() => { load(); }, [load]);
  const visible = useMemo(() => items.filter((p) => (state === 'all' || activeRecord(p) === (state === 'active')) && [p.name, p.phone, p.specialty].join(' ').toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))), [items, search, state]);
  function open(person) { setEditing(person?.id || 'new'); setForm(person ? { name: person.name, phone: person.phone || '', specialty: person.specialty || '', notes: person.notes || '', active: activeRecord(person) } : { ...empty }); setFormError(''); }
  function close() { if (!saving) { setEditing(null); setFormError(''); } }
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); setFormError(''); }
  async function save(event) {
    event.preventDefault(); if (saving) return;
    if (!normalizePhone(form.phone)) { setFormError('Ingresa un teléfono válido. Para números internacionales, incluye el indicativo (por ejemplo, +57 300 123 4567).'); return; }
    setSaving(true); setFormError('');
    try { await api(editing === 'new' ? '/personnel' : `/personnel/${editing}`, { method: editing === 'new' ? 'POST' : 'PATCH', body: JSON.stringify({ ...form, name: form.name.trim(), phone: form.phone.trim(), specialty: form.specialty.trim(), notes: form.notes.trim() }) }); if (!mounted.current) return; setEditing(null); setToast({ message: editing === 'new' ? 'Persona registrada correctamente.' : 'Datos del personal actualizados.' }); await load(); } catch (e) { if (mounted.current) setFormError(e.message); } finally { if (mounted.current) setSaving(false); }
  }
  return <div className="maintenance-page">
    <div className="page-heading"><div><p className="eyebrow">Equipo de mantenimiento</p><h1>Personal</h1><p>Las personas que cuidan las instalaciones del colegio.</p></div><button className="primary-button" type="button" onClick={() => open()}><Plus aria-hidden="true" />Registrar persona</button></div>
    <div className="catalog-hint"><Info aria-hidden="true" /><div><strong>Un equipo conectado por WhatsApp</strong><p>Estos datos permiten asignar incidencias. El personal no necesita una cuenta ni una contraseña para trabajar.</p></div></div>
    <section className="panel"><div className="catalog-toolbar"><label className="catalog-search">Buscar personal<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, teléfono o especialidad" /></label><label className="catalog-search" style={{ maxWidth: '200px' }}>Mostrar<select value={state} onChange={(e) => setState(e.target.value)}><option value="active">Personal activo</option><option value="inactive">Personal inactivo</option><option value="all">Todo el personal</option></select></label><span className="catalog-count" aria-live="polite">{visible.length} {visible.length === 1 ? 'persona' : 'personas'}</span></div></section>
    {error && <div className="page-error" role="alert">{error}<button className="text-button" type="button" onClick={load}>Reintentar</button></div>}
    {loading ? <div className="loading-page" role="status" aria-busy="true">Cargando personal…</div> : !error && (visible.length ? <div className="people-grid">{visible.map((person) => <article className="person-card" key={person.id}><div className="person-head"><div className="person-avatar"><UserRound aria-hidden="true" /></div><div><h2>{person.name}</h2><span className="person-identification">{person.specialty}</span></div><StatusBadge value={activeRecord(person)} /></div><div className="person-info"><span><Phone aria-hidden="true" />{person.phone}</span><span><Wrench aria-hidden="true" />{person.specialty}</span>{person.notes && <p>{person.notes}</p>}</div><button type="button" onClick={() => open(person)} aria-label={`Editar ${person.name}`}><Edit3 aria-hidden="true" />Editar persona</button></article>)}</div> : <section className="panel"><EmptyState icon={Users} title={items.length ? 'No hay coincidencias' : 'Aún no hay personal registrado'} text={items.length ? 'Prueba otra búsqueda o cambia el estado seleccionado.' : 'Registra al equipo de mantenimiento para comenzar a asignar incidencias.'} action={!items.length ? <button className="secondary-button" type="button" onClick={() => open()}>Registrar primera persona</button> : null} /></section>)}
    {editing && <Modal as="form" className="modal catalog-form" labelledBy="personnel-dialog-title" onClose={close} onSubmit={save}><div className="modal-head"><div><p className="eyebrow">Personal de mantenimiento</p><h2 id="personnel-dialog-title">{editing === 'new' ? 'Registrar persona' : 'Editar persona'}</h2></div><button className="icon-button" type="button" onClick={close} disabled={saving} aria-label="Cerrar formulario"><X size={20} /></button></div>{formError && <div className="page-error" role="alert">{formError}</div>}<div className="form-grid"><label className="full">Nombre completo<input data-autofocus value={form.name} onChange={(e) => update('name', e.target.value)} required minLength={3} maxLength={120} disabled={saving} /></label><label>Teléfono de WhatsApp<input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+57 300 123 4567" required minLength={7} maxLength={40} disabled={saving} /><small className="helper">Incluye el indicativo para números fuera de Colombia.</small></label><label>Especialidad / función<input value={form.specialty} onChange={(e) => update('specialty', e.target.value)} placeholder="Mantenimiento general" required minLength={2} maxLength={120} disabled={saving} /></label><label className="full">Notas (opcional)<textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} maxLength={2000} disabled={saving} /></label><label className="checkbox-label full"><input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} disabled={saving} />Persona activa</label><p className="helper full">Al desactivar una persona, deja de aparecer en nuevas asignaciones. Sus incidencias e historial se conservan.</p></div><div className="form-actions"><button className="secondary-button" type="button" onClick={close} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar persona'}</button></div></Modal>}
    <Toast toast={toast} onClose={() => setToast(null)} />
  </div>;
}


