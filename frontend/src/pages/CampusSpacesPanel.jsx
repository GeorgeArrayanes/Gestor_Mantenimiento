import { useEffect, useMemo, useState } from 'react';
import { Building2, Hand, Info, List, Map, MapPin, MousePointer2, Plus, RotateCcw, X } from 'lucide-react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { spacesInRegion } from './campus-spaces.js';
import './maintenance-pages.css';

export default function CampusSpacesPanel({ region, spaces, loading, error, onReload, onCreated, onClear }) {
  const [selectedId, setSelectedId] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', zone: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const items = useMemo(() => spacesInRegion(spaces, region?.id), [spaces, region?.id]);
  const selected = items.find(item => String(item.id) === selectedId);

  useEffect(() => { setSelectedId(''); setNotice(''); setCreating(false); }, [region?.id]);

  function openForm() {
    setForm({ name: '', zone: '' });
    setFormError('');
    setCreating(true);
  }
  async function save(event) {
    event.preventDefault();
    if (saving || !region) return;
    setSaving(true); setFormError('');
    try {
      const { space } = await api('/spaces', { method: 'POST', body: JSON.stringify({ name: form.name.trim(), zone: form.zone.trim(), campus_region_id: region.id, active: true }) });
      onCreated(space);
      setSelectedId(String(space.id)); setCreating(false);
      setNotice('Espacio añadido a este edificio. Ya puedes seleccionarlo en la lista.');
    } catch (cause) { setFormError(cause.message); }
    finally { setSaving(false); }
  }

  if (!region) return <aside className="campus-panel campus-panel-welcome" aria-label="Información de la zona">
    <div className="campus-panel-kicker"><span>Tu campus, a un clic</span><MousePointer2 size={16} aria-hidden="true" /></div>
    <div className="campus-welcome-art" aria-hidden="true"><Map size={39} strokeWidth={1.2} /><span /><span /></div>
    <h2 tabIndex={-1}>Explora el colegio</h2><p>Elige un edificio para consultar o añadir sus espacios internos.</p>
    <ol className="campus-explore-steps"><li><MousePointer2 size={17} aria-hidden="true" /><span><strong>Selecciona un edificio</strong>Desde el mapa o el directorio.</span></li><li><List size={17} aria-hidden="true" /><span><strong>Elige un espacio</strong>Salones, baños y oficinas en una lista.</span></li><li><Hand size={17} aria-hidden="true" /><span><strong>Explora con libertad</strong>Acerca la vista y arrastra el campus.</span></li></ol>
    <div className="campus-panel-note"><Info size={18} aria-hidden="true" /><p>Los espacios se organizan por edificio, sin cargar planos o modelos adicionales.</p></div>
  </aside>;

  return <aside className="campus-panel campus-live-panel" aria-labelledby="campus-zone-title">
    <div className="campus-panel-kicker"><span>Edificio o zona seleccionada</span><button type="button" className="campus-icon-button" aria-label="Quitar selección" onClick={onClear}><X size={17} /></button></div>
    <div className="campus-selected-symbol" aria-hidden="true"><Building2 size={25} strokeWidth={1.5} /></div>
    <p className="campus-zone-type">Gimnasio Los Arrayanes</p>
    <h2 id="campus-zone-title" tabIndex={-1}>{region.label}</h2>
    <p className="campus-zone-intro">{region.id === 'bloques-salones' ? 'Los cuatro bloques y el bloque atravesado comparten esta lista de espacios.' : 'Organiza y selecciona las ubicaciones de este edificio.'}</p>
    <div className="campus-internal-heading"><h3>Espacios internos <span>{items.length}</span></h3><button className="campus-add-space" type="button" disabled={loading || Boolean(error)} onClick={openForm}><Plus size={15} aria-hidden="true" />Añadir espacio</button></div>
    {loading ? <p className="campus-space-message" role="status">Cargando espacios…</p> : error ? <div className="campus-space-error" role="alert"><p>{error}</p><button type="button" onClick={onReload}><RotateCcw size={14} aria-hidden="true" />Reintentar</button></div> : items.length ? <>
      <label className="campus-space-select">Seleccionar espacio<select value={selectedId} onChange={event => { setSelectedId(event.target.value); setNotice(''); }}><option value="">Elige un espacio de la lista</option>{items.map(item => <option key={item.id} value={String(item.id)}>{item.name} · {item.zone}{item.active === false ? ' (archivado)' : ''}</option>)}</select></label>
      {selected ? <section className="campus-space-detail" aria-label="Espacio seleccionado"><div><MapPin size={18} aria-hidden="true" /><StatusBadge value={selected.active} /></div><h3>{selected.name}</h3><p>{selected.zone}</p><span>Dentro de {region.label}</span></section> : <p className="campus-space-message">Elige una ubicación para ver sus datos.</p>}
    </> : <div className="campus-empty"><List size={27} strokeWidth={1.4} aria-hidden="true" /><h3>Aún no hay espacios internos</h3><p>Añade el primer salón, baño u oficina de este edificio. Aparecerá en su lista.</p></div>}
    {notice && <p className="campus-space-success" role="status">{notice}</p>}
    <div className="campus-panel-note"><Info size={16} aria-hidden="true" /><p>Puedes añadir salones, baños, oficinas y otras ubicaciones dentro de este edificio.</p></div>
    {creating && <Modal as="form" className="modal catalog-form" labelledBy="campus-create-space-title" onClose={() => { if (!saving) setCreating(false); }} onSubmit={save}>
      <div className="modal-head"><div><p className="eyebrow">{region.label}</p><h2 id="campus-create-space-title">Añadir espacio interno</h2></div><button type="button" className="icon-button" aria-label="Cerrar formulario" disabled={saving} onClick={() => setCreating(false)}><X size={20} /></button></div>
      {formError && <p className="page-error" role="alert">{formError}</p>}
      <p className="helper">El espacio quedará dentro de <strong>{region.label}</strong>.</p>
      <div className="form-grid"><label className="full">Nombre del espacio<input data-autofocus required minLength={2} maxLength={120} placeholder="Salón 201" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} disabled={saving} /></label><label className="full">Ubicación interna<input required minLength={2} maxLength={120} placeholder="Segundo piso · Ala norte" value={form.zone} onChange={event => setForm(current => ({ ...current, zone: event.target.value }))} disabled={saving} /></label></div>
      <div className="form-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setCreating(false)}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Añadir espacio'}</button></div>
    </Modal>}
  </aside>;
}
