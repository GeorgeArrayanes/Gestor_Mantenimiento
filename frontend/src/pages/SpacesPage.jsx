import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Edit3, Info, MapPin, Plus, X } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import Toast from '../components/Toast.jsx';
import { activeRecord } from '../utils/maintenance.js';
import usePageLifecycle from './usePageLifecycle.js';
import './maintenance-pages.css';

const empty = { name: '', zone: '', active: true };
export default function SpacesPage() {
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
  const load = useCallback(async () => { const signal = startRequest(); setLoading(true); setError(''); try { const data = await api('/spaces', { signal }); if (!signal.aborted) setItems(data.spaces); } catch (e) { if (!signal.aborted) setError(e.message); } finally { if (!signal.aborted) setLoading(false); } }, [startRequest]);
  useEffect(() => { load(); }, [load]);
  const visible = useMemo(() => items.filter((s) => (state === 'all' || activeRecord(s) === (state === 'active')) && [s.name, s.zone].join(' ').toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))), [items, search, state]);
  function open(space) { setEditing(space?.id || 'new'); setForm(space ? { name: space.name, zone: space.zone || '', active: activeRecord(space) } : { ...empty }); setFormError(''); }
  function close() { if (!saving) { setEditing(null); setFormError(''); } }
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); setFormError(''); }
  async function save(event) {
    event.preventDefault(); if (saving) return; setSaving(true); setFormError('');
    try { await api(editing === 'new' ? '/spaces' : `/spaces/${editing}`, { method: editing === 'new' ? 'POST' : 'PATCH', body: JSON.stringify({ ...form, name: form.name.trim(), zone: form.zone.trim() }) }); if (!mounted.current) return; setEditing(null); setToast({ message: editing === 'new' ? 'Espacio registrado correctamente.' : 'Espacio actualizado correctamente.' }); await load(); } catch (e) { if (mounted.current) setFormError(e.message); } finally { if (mounted.current) setSaving(false); }
  }
  return <div className="maintenance-page">
    <div className="page-heading"><div><p className="eyebrow">Instalaciones del colegio</p><h1>Espacios</h1><p>Un catálogo claro para ubicar cada incidencia.</p></div><button className="primary-button" type="button" onClick={() => open()}><Plus aria-hidden="true" />Registrar espacio</button></div>
    <section className="panel"><div className="catalog-toolbar"><label className="catalog-search">Buscar espacio<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, bloque o zona" /></label><label className="catalog-search" style={{ maxWidth: '200px' }}>Mostrar<select value={state} onChange={(e) => setState(e.target.value)}><option value="active">Espacios activos</option><option value="inactive">Espacios archivados</option><option value="all">Todos los espacios</option></select></label><span className="catalog-count" aria-live="polite">{visible.length} {visible.length === 1 ? 'espacio' : 'espacios'}</span></div></section>
    {error && <div className="page-error" role="alert">{error}<button className="text-button" type="button" onClick={load}>Reintentar</button></div>}
    {loading ? <div className="loading-page" role="status" aria-busy="true">Cargando espacios…</div> : !error && (visible.length ? <div className="spaces-grid">{visible.map((space) => <article className="space-card" key={space.id}><div className="space-card-head"><span className="person-avatar"><Building2 aria-hidden="true" /></span><StatusBadge value={activeRecord(space)} /></div><div><h2>{space.name}</h2><p><MapPin size={12} aria-hidden="true" /> {space.zone}</p></div><button type="button" onClick={() => open(space)} aria-label={`Editar espacio ${space.name}`}><Edit3 aria-hidden="true" />Editar espacio</button></article>)}</div> : <section className="panel"><EmptyState icon={Building2} title={items.length ? 'No hay coincidencias' : 'Aún no hay espacios registrados'} text={items.length ? 'Prueba otra búsqueda o incluye los espacios archivados.' : 'Registra salones, baños y otras ubicaciones para ubicar las incidencias del colegio.'} action={!items.length ? <button className="secondary-button" type="button" onClick={() => open()}>Registrar primer espacio</button> : null} /></section>)}
    <div className="catalog-hint"><Info aria-hidden="true" /><div><strong>El historial siempre se conserva</strong><p>Archiva los espacios que dejen de usarse. Sus incidencias anteriores seguirán mostrando la ubicación registrada.</p></div></div>
    {editing && <Modal as="form" className="modal catalog-form" labelledBy="spaces-dialog-title" onClose={close} onSubmit={save}><div className="modal-head"><div><p className="eyebrow">Ubicación del colegio</p><h2 id="spaces-dialog-title">{editing === 'new' ? 'Registrar espacio' : 'Editar espacio'}</h2></div><button className="icon-button" type="button" onClick={close} disabled={saving} aria-label="Cerrar formulario"><X size={20} /></button></div>{formError && <div className="page-error" role="alert">{formError}</div>}<div className="form-grid"><label className="full">Nombre del espacio<input data-autofocus value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Baño Bloque A" required minLength={2} maxLength={120} disabled={saving} /></label><label className="full">Zona / bloque<input value={form.zone} onChange={(e) => update('zone', e.target.value)} placeholder="Bloque A" required minLength={2} maxLength={120} disabled={saving} /></label><label className="checkbox-label full"><input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} disabled={saving} />Espacio activo</label><p className="helper full">Un espacio archivado no podrá seleccionarse para nuevas incidencias. Puedes activarlo nuevamente cuando lo necesites.</p></div><div className="form-actions"><button className="secondary-button" type="button" onClick={close} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar espacio'}</button></div></Modal>}
    <Toast toast={toast} onClose={() => setToast(null)} />
  </div>;
}

