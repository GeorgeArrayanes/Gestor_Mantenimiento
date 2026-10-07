import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, Building2, Droplets, Dumbbell, Edit3, FlaskConical, GraduationCap, Info, MapPin, Monitor, Plus, Trees, X } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import Toast from '../components/Toast.jsx';
import { FilterSelect, SearchInput, SectionPanel } from '../components/DesignSystem.jsx';
import { activeRecord } from '../utils/maintenance.js';
import usePageLifecycle from './usePageLifecycle.js';
import './maintenance-pages.css';
import './directory-pages.css';

const empty = { name: '', zone: '', active: true };
function spaceVisual(name) {
  const value = name.toLocaleLowerCase('es');
  if (/bañ|sanitari|lavaman|ducha/.test(value)) return { Icon: Droplets, tone: 'water', label: 'Servicios sanitarios' };
  if (/bibliotec|lectura/.test(value)) return { Icon: BookOpen, tone: 'library', label: 'Biblioteca y lectura' };
  if (/laborat/.test(value)) return { Icon: FlaskConical, tone: 'laboratory', label: 'Laboratorio' };
  if (/cancha|gimnasi|deport/.test(value)) return { Icon: Dumbbell, tone: 'sport', label: 'Espacio deportivo' };
  if (/exterior|jardín|jardin|parque|patio/.test(value)) return { Icon: Trees, tone: 'outdoor', label: 'Espacio exterior' };
  if (/informát|informat|oficina|equipo/.test(value)) return { Icon: Monitor, tone: 'office', label: 'Oficina y equipos' };
  if (/salón|salon|aula/.test(value)) return { Icon: GraduationCap, tone: 'classroom', label: 'Aula de clase' };
  return { Icon: Building2, tone: 'building', label: 'Espacio del colegio' };
}
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
  const [zone, setZone] = useState('');
  const load = useCallback(async () => { const signal = startRequest(); setLoading(true); setError(''); try { const data = await api('/spaces', { signal }); if (!signal.aborted) setItems(data.spaces); } catch (e) { if (!signal.aborted) setError(e.message); } finally { if (!signal.aborted) setLoading(false); } }, [startRequest]);
  useEffect(() => { load(); }, [load]);
  const zones = useMemo(() => [...new Set(items.map((space) => space.zone).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [items]);
  const visible = useMemo(() => items.filter((s) => (state === 'all' || activeRecord(s) === (state === 'active')) && (!zone || s.zone === zone) && [s.name, s.zone].join(' ').toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))), [items, search, state, zone]);
  function open(space) { setEditing(space?.id || 'new'); setForm(space ? { name: space.name, zone: space.zone || '', active: activeRecord(space) } : { ...empty }); setFormError(''); }
  function close() { if (!saving) { setEditing(null); setFormError(''); } }
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); setFormError(''); }
  async function save(event) {
    event.preventDefault(); if (saving) return; setSaving(true); setFormError('');
    try { await api(editing === 'new' ? '/spaces' : `/spaces/${editing}`, { method: editing === 'new' ? 'POST' : 'PATCH', body: JSON.stringify({ ...form, name: form.name.trim(), zone: form.zone.trim() }) }); if (!mounted.current) return; setEditing(null); setToast({ message: editing === 'new' ? 'Espacio registrado correctamente.' : 'Espacio actualizado correctamente.' }); await load(); } catch (e) { if (mounted.current) setFormError(e.message); } finally { if (mounted.current) setSaving(false); }
  }
  return <div className="maintenance-page directory-page spaces-directory">
    <div className="page-heading"><div><p className="eyebrow">Catálogo del campus</p><h1>Espacios</h1><p>Cada ubicación, lista para recibir atención.</p></div><button className="primary-button" type="button" onClick={() => open()}><Plus aria-hidden="true" />Registrar espacio</button></div>
    <SectionPanel className="directory-toolbar-panel"><div className="directory-controls spaces-controls"><SearchInput label="Buscar espacio" placeholder="Nombre, bloque o zona" value={search} onChange={(e) => setSearch(e.target.value)} /><FilterSelect label="Zona / bloque" value={zone} onChange={(e) => setZone(e.target.value)}><option value="">Todas las zonas</option>{zones.map((value) => <option key={value} value={value}>{value}</option>)}</FilterSelect><FilterSelect label="Estado" value={state} onChange={(e) => setState(e.target.value)}><option value="active">Espacios activos</option><option value="inactive">Espacios archivados</option><option value="all">Todos los espacios</option></FilterSelect><span className="directory-counter" aria-live="polite"><strong>{visible.length}</strong>{visible.length === 1 ? 'espacio' : 'espacios'}</span></div></SectionPanel>
    {error && <div className="page-error" role="alert">{error}<button className="text-button" type="button" onClick={load}>Reintentar</button></div>}
    {loading ? <div className="loading-page" role="status" aria-busy="true">Cargando espacios…</div> : !error && (visible.length ? <div className="directory-spaces-grid">{visible.map((space) => { const { Icon, tone, label } = spaceVisual(space.name); return <article className={`directory-space-card${!activeRecord(space) ? ' is-inactive' : ''}`} key={space.id}>
      <div className={`space-art space-art-${tone}`}><div className="space-art-grid" aria-hidden="true" /><div className="space-art-facade" aria-hidden="true"><span /><span /><span /></div><div className="space-art-emblem" aria-hidden="true"><Icon size={29} strokeWidth={1.5} /></div><span className="space-art-type">{label}</span></div>
      <div className="directory-space-body"><div className="directory-space-heading"><h2>{space.name}</h2><StatusBadge value={activeRecord(space)} /></div><p><MapPin size={15} aria-hidden="true" />{space.zone}</p><div className="directory-space-footer"><button className="directory-edit-button" type="button" onClick={() => open(space)} aria-label={`Editar espacio ${space.name}`}><Edit3 size={15} aria-hidden="true" />Editar espacio<ArrowUpRight size={15} aria-hidden="true" /></button></div></div>
    </article>; })}</div> : <SectionPanel><EmptyState icon={Building2} title={items.length ? 'No hay coincidencias' : 'Aún no hay espacios registrados'} text={items.length ? 'Prueba otra búsqueda, zona o estado.' : 'Registra salones, baños y otras ubicaciones para ubicar las incidencias del colegio.'} action={!items.length ? <button className="secondary-button" type="button" onClick={() => open()}>Registrar primer espacio</button> : null} /></SectionPanel>)}
    <div className="directory-footnote"><Info size={15} aria-hidden="true" /><p>Los espacios archivados conservan sus incidencias e historial.</p></div>
    {editing && <Modal as="form" className="modal catalog-form" labelledBy="spaces-dialog-title" onClose={close} onSubmit={save}><div className="modal-head"><div><p className="eyebrow">Ubicación del colegio</p><h2 id="spaces-dialog-title">{editing === 'new' ? 'Registrar espacio' : 'Editar espacio'}</h2></div><button className="icon-button" type="button" onClick={close} disabled={saving} aria-label="Cerrar formulario"><X size={20} /></button></div>{formError && <div className="page-error" role="alert">{formError}</div>}<div className="form-grid"><label className="full">Nombre del espacio<input data-autofocus value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Baño Bloque A" required minLength={2} maxLength={120} disabled={saving} /></label><label className="full">Zona / bloque<input value={form.zone} onChange={(e) => update('zone', e.target.value)} placeholder="Bloque A" required minLength={2} maxLength={120} disabled={saving} /></label><label className="checkbox-label full"><input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} disabled={saving} />Espacio activo</label><p className="helper full">Un espacio archivado no podrá seleccionarse para nuevas incidencias. Puedes activarlo nuevamente cuando lo necesites.</p></div><div className="form-actions"><button className="secondary-button" type="button" onClick={close} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar espacio'}</button></div></Modal>}
    <Toast toast={toast} onClose={() => setToast(null)} />
  </div>;
}

