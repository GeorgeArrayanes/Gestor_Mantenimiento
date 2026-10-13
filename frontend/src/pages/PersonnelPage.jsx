import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Plus, Users, X } from 'lucide-react';
import { api } from '../api.js';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import Toast from '../components/Toast.jsx';
import ImageUploadField, { imageFileError } from '../components/ImageUploadField.jsx';
import PersonnelCard from '../components/PersonnelCard.jsx';
import { FilterSelect, SearchInput, SectionPanel } from '../components/DesignSystem.jsx';
import { activeRecord, normalizePhone } from '../utils/maintenance.js';
import usePageLifecycle from './usePageLifecycle.js';
import './maintenance-pages.css';
import './directory-pages.css';

const empty = { name: '', phone: '', specialty: '', notes: '', active: true, image: null, imageUrl: '', removeImage: false };
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
  function open(person) { setEditing(person?.id || 'new'); setForm(person ? { name: person.name, phone: person.phone || '', specialty: person.specialty || '', notes: person.notes || '', active: activeRecord(person), image: null, imageUrl: person.image_url || '', removeImage: false } : { ...empty }); setFormError(''); }
  function close() { if (!saving) { setEditing(null); setFormError(''); } }
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); setFormError(''); }
  async function save(event) {
    event.preventDefault(); if (saving) return;
    if (!normalizePhone(form.phone)) { setFormError('Ingresa un teléfono válido. Para números internacionales, incluye el indicativo (por ejemplo, +57 300 123 4567).'); return; }
    const imageError = imageFileError(form.image); if (imageError) { setFormError(imageError); return; }
    setSaving(true); setFormError('');
    const body = new FormData(); body.append('name', form.name.trim()); body.append('phone', form.phone.trim()); body.append('specialty', form.specialty.trim()); body.append('notes', form.notes.trim()); body.append('active', String(form.active)); body.append('remove_image', String(form.removeImage)); if (form.image) body.append('image', form.image);
    try { await api(editing === 'new' ? '/personnel' : `/personnel/${editing}`, { method: editing === 'new' ? 'POST' : 'PATCH', body }); if (!mounted.current) return; setEditing(null); setToast({ message: editing === 'new' ? 'Persona registrada correctamente.' : 'Datos del personal actualizados.' }); await load(); } catch (e) { if (mounted.current) setFormError(e.message); } finally { if (mounted.current) setSaving(false); }
  }
  return <div className="maintenance-page directory-page personnel-directory">
    <div className="page-heading directory-team-heading"><div><p className="eyebrow">Equipo de mantenimiento</p><h1>Personal</h1><p>Las personas que cuidan cada espacio del colegio.</p></div><button className="primary-button" type="button" onClick={() => open()}><Plus aria-hidden="true" />Añadir persona</button></div>
    <div className="directory-note"><span className="directory-note-icon"><Info size={19} aria-hidden="true" /></span><p><strong>Un equipo conectado, sin cuentas de acceso.</strong> Puedes avisarle al equipo por teléfono o preparar un mensaje de WhatsApp.</p></div>
    <SectionPanel className="directory-toolbar-panel"><div className="directory-controls"><SearchInput label="Buscar personal" placeholder="Nombre, teléfono o especialidad" value={search} onChange={(e) => setSearch(e.target.value)} /><FilterSelect label="Estado" value={state} onChange={(e) => setState(e.target.value)}><option value="active">Personal activo</option><option value="inactive">Personal inactivo</option><option value="all">Todo el personal</option></FilterSelect><span className="directory-counter" aria-live="polite"><strong>{visible.length}</strong>{visible.length === 1 ? 'persona' : 'personas'}</span></div></SectionPanel>
    {error && <div className="page-error" role="alert">{error}<button className="text-button" type="button" onClick={load}>Reintentar</button></div>}
    {loading ? <div className="loading-page" role="status" aria-busy="true">Cargando personal…</div> : !error && (visible.length ? <div className="directory-people-grid">{visible.map((person) => <PersonnelCard key={person.id} person={person} onEdit={open} />)}</div> : <SectionPanel><EmptyState icon={Users} title={items.length ? 'No hay coincidencias' : 'Aún no hay personal registrado'} text={items.length ? 'Prueba otra búsqueda o cambia el estado seleccionado.' : 'Registra al equipo de mantenimiento para comenzar a asignar incidencias.'} action={!items.length ? <button className="secondary-button" type="button" onClick={() => open()}>Añadir primera persona</button> : null} /></SectionPanel>)}
    {!loading && !error && visible.length > 0 && <p className="personnel-metrics-note"><Info size={15} aria-hidden="true" />Asignados: trabajo en curso. Resueltos: incidencias cerradas de todo el historial.</p>}
    {editing && <Modal as="form" className="modal catalog-form" labelledBy="personnel-dialog-title" onClose={close} onSubmit={save}><div className="modal-head"><div><p className="eyebrow">Personal de mantenimiento</p><h2 id="personnel-dialog-title">{editing === 'new' ? 'Registrar persona' : 'Editar perfil'}</h2></div><button className="icon-button" type="button" onClick={close} disabled={saving} aria-label="Cerrar formulario"><X size={20} /></button></div>{formError && <div className="page-error" role="alert">{formError}</div>}<div className="form-grid"><ImageUploadField file={form.image} existingUrl={form.imageUrl} removed={form.removeImage} alt={`Retrato de ${form.name || 'esta persona'}`} disabled={saving} onChange={(image) => setForm((current) => ({ ...current, image, removeImage: false }))} onRemove={() => setForm((current) => ({ ...current, image: null, removeImage: Boolean(current.imageUrl) }))} onError={setFormError} /><label className="full">Nombre completo<input data-autofocus value={form.name} onChange={(e) => update('name', e.target.value)} required minLength={3} maxLength={120} disabled={saving} /></label><label>Teléfono de WhatsApp<input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+57 300 123 4567" required minLength={7} maxLength={40} disabled={saving} /><small className="helper">Incluye el indicativo para números fuera de Colombia.</small></label><label>Especialidad / función<input value={form.specialty} onChange={(e) => update('specialty', e.target.value)} placeholder="Mantenimiento general" required minLength={2} maxLength={120} disabled={saving} /></label><label className="full">Notas (opcional)<textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} maxLength={2000} disabled={saving} /></label><label className="checkbox-label full"><input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} disabled={saving} />Persona activa</label><p className="helper full">Al desactivar una persona, deja de aparecer en nuevas asignaciones. Sus incidencias e historial se conservan.</p></div><div className="form-actions"><button className="secondary-button" type="button" onClick={close} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar persona'}</button></div></Modal>}
    <Toast toast={toast} onClose={() => setToast(null)} />
  </div>;
}


