import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Edit3, Mail, Phone, Plus, ShieldCheck, X } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Toast from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import { Avatar, FilterSelect, SearchInput, SectionPanel } from '../components/DesignSystem.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import usePageLifecycle from './usePageLifecycle.js';
import './maintenance-pages.css';
import './directory-pages.css';

const empty = {
  name: '',
  identification: '',
  username: '',
  phone: '',
  password: '',
  status: 'ACTIVO',
};

export default function AdminsPage() {
  const { user } = useAuth();
  const { mounted, startRequest } = usePageLifecycle();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('all');
  const visible = useMemo(() => items.filter((admin) => (state === 'all' || admin.status === state) && [admin.name, admin.identification, admin.username, admin.phone].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))), [items, search, state]);

  const load = useCallback(() => {
    const signal = startRequest();
    setLoading(true);
    setError('');
    return api('/users?role=ADMIN', { signal })
      .then((data) => { if (!signal.aborted) setItems(data.users); })
      .catch((requestError) => {
        if (signal.aborted) return;
        setItems([]);
        setError(requestError.message);
      })
      .finally(() => { if (!signal.aborted) setLoading(false); });
  }, [startRequest]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') load();
    else setLoading(false);
  }, [user?.role, load]);

  function open(item = null) {
    setEditing(item?.id || 'new');
    setForm(item ? {
      name: item.name,
      identification: item.identification,
      username: item.username,
      phone: item.phone || '',
      password: '',
      status: item.status,
    } : empty);
    setError('');
  }

  function close() {
    if (saving) return;
    setEditing(null);
    setError('');
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError('');
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const body = {
        name: form.name,
        identification: form.identification,
        username: form.username,
        phone: form.phone,
        status: form.status,
      };
      if (editing === 'new') {
        body.password = form.password;
        body.role = 'ADMIN';
      } else if (form.password) {
        body.password = form.password;
      }
      await api(editing === 'new' ? '/users' : `/users/${editing}`, {
        method: editing === 'new' ? 'POST' : 'PATCH',
        body: JSON.stringify(body),
      });
      if (!mounted.current) return;
      setEditing(null);
      setToast({ message: editing === 'new' ? 'Administrador creado correctamente.' : 'Administrador actualizado correctamente.' });
      await load();
    } catch (requestError) {
      if (mounted.current) setError(requestError.message);
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  if (user?.role !== 'SUPER_ADMIN') return <div className="maintenance-page directory-page"><SectionPanel><EmptyState title="Acceso reservado" text="Solo el superadministrador puede gestionar las cuentas administrativas." /></SectionPanel></div>;

  return (
    <div className="maintenance-page directory-page admins-directory">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Control de acceso</p>
          <h1>Administradores</h1>
          <p>Las cuentas autorizadas para gestionar el mantenimiento.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => open()}>
          <Plus aria-hidden="true" />
          Crear administrador
        </button>
      </div>

      <section className="directory-access-note" aria-label="Protección del módulo">
        <span className="directory-access-icon"><ShieldCheck size={23} aria-hidden="true" /></span>
        <div>
          <strong>Acceso exclusivo del superadministrador</strong>
          <p>Solo tú puedes crear y administrar las cuentas autorizadas.</p>
        </div>
      </section>

      <SectionPanel className="directory-toolbar-panel"><div className="directory-controls"><SearchInput label="Buscar administradores" placeholder="Nombre, correo o identificación" value={search} onChange={(event) => setSearch(event.target.value)} /><FilterSelect label="Estado" value={state} onChange={(event) => setState(event.target.value)}><option value="all">Todos los estados</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option></FilterSelect><span className="directory-counter" aria-live="polite"><strong>{visible.length}</strong>{visible.length === 1 ? 'cuenta' : 'cuentas'}</span></div></SectionPanel>

      {error && !editing && <div className="page-error" role="alert">{error} <button type="button" className="text-button" onClick={load}>Reintentar</button></div>}
      {loading ? (
        <div className="loading-page" role="status" aria-live="polite" aria-busy="true">Cargando administradores…</div>
      ) : error ? null : visible.length ? (
        <SectionPanel className="directory-admin-panel" title="Cuentas administrativas" subtitle="Acceso a incidencias, personal y espacios.">
          <div className="directory-admin-table-wrap"><table className="directory-admin-table"><thead><tr><th scope="col">Administrador</th><th scope="col">Rol</th><th scope="col">Contacto</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>{visible.map((admin) => <tr key={admin.id}>
            <td><div className="directory-admin-identity"><Avatar name={admin.name} /><div><strong>{admin.name}</strong><small>ID {admin.identification}</small></div></div></td>
            <td><span className={`directory-role${admin.role === 'SUPER_ADMIN' ? ' is-superadmin' : ''}`}><ShieldCheck size={14} aria-hidden="true" />{admin.role === 'SUPER_ADMIN' ? 'Superadministrador' : 'Administrador'}</span></td>
            <td><div className="directory-admin-contact"><span><Mail size={14} aria-hidden="true" />{admin.username}</span><small><Phone size={12} aria-hidden="true" />{admin.phone || 'Sin teléfono'}</small></div></td>
            <td><StatusBadge value={admin.status} /></td><td><button className="directory-edit-button" type="button" onClick={() => open(admin)} aria-label={`Editar administrador ${admin.name}`}><Edit3 size={15} aria-hidden="true" />Editar cuenta</button></td>
          </tr>)}</tbody></table></div>
          <div className="directory-admin-mobile">{visible.map((admin) => <article className="directory-admin-card" key={admin.id}><div className="directory-admin-mobile-head"><div className="directory-admin-identity"><Avatar name={admin.name} /><div><h2>{admin.name}</h2><small>ID {admin.identification}</small></div></div><StatusBadge value={admin.status} /></div><span className="directory-role"><ShieldCheck size={13} aria-hidden="true" />{admin.role === 'SUPER_ADMIN' ? 'Superadministrador' : 'Administrador'}</span><div className="directory-admin-contact"><span><Mail size={14} aria-hidden="true" />{admin.username}</span><small><Phone size={12} aria-hidden="true" />{admin.phone || 'Sin teléfono'}</small></div><button className="directory-edit-button" type="button" onClick={() => open(admin)} aria-label={`Editar administrador ${admin.name}`}><Edit3 size={15} aria-hidden="true" />Editar cuenta<ArrowUpRight size={13} aria-hidden="true" /></button></article>)}</div>
        </SectionPanel>
      ) : (
        <SectionPanel>
          <EmptyState title={items.length ? 'No hay cuentas que coincidan' : 'Aún no hay administradores adicionales'} text={items.length ? 'Prueba otra búsqueda o cambia el estado seleccionado.' : 'Crea una cuenta cuando otra persona necesite gestionar la operación.'} />
        </SectionPanel>
      )}

      {editing && (
        <Modal
          as="form"
          className="modal catalog-form"
          onSubmit={save}
          onClose={close}
          labelledBy="admin-modal-title"
          describedBy={error ? 'admin-modal-error' : 'admin-password-help'}
        >
          <div className="modal-head">
            <div>
              <p className="eyebrow">Cuenta administrativa</p>
              <h2 id="admin-modal-title">{editing === 'new' ? 'Nuevo administrador' : form.name}</h2>
            </div>
            <button className="icon-button" type="button" onClick={close} aria-label="Cerrar formulario de administrador" disabled={saving}><X size={20} /></button>
          </div>
          {error && <div id="admin-modal-error" className="page-error" role="alert">{error}</div>}
          <div className="form-grid">
            <label className="full">
              Nombre completo
              <input data-autofocus value={form.name} onChange={(event) => update('name', event.target.value)} required minLength={3} maxLength={120} disabled={saving} />
            </label>
            <label>
              Identificación
              <input value={form.identification} onChange={(event) => update('identification', event.target.value)} required minLength={3} maxLength={30} disabled={saving} />
            </label>
            <label>
              Celular
              <input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} maxLength={30} disabled={saving} />
            </label>
            <label className="full">
              Correo o usuario
              <input type="text" autoComplete="username" value={form.username} onChange={(event) => update('username', event.target.value)} required minLength={3} maxLength={120} disabled={saving} />
            </label>
            <label>
              {editing === 'new' ? 'Contraseña temporal' : 'Nueva contraseña (opcional)'}
              <input type="password" autoComplete="new-password" value={form.password} onChange={(event) => update('password', event.target.value)} required={editing === 'new'} minLength="12" maxLength={128} disabled={saving} />
              <small id="admin-password-help" className="helper">Mínimo 12 caracteres.</small>
            </label>
            <label>
              Estado
              <select value={form.status} onChange={(event) => update('status', event.target.value)} disabled={saving}>
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={close} disabled={saving}>Cancelar</button>
            <button type="submit" className="primary-button" disabled={saving} aria-busy={saving}>{saving ? 'Guardando…' : 'Guardar administrador'}</button>
          </div>
        </Modal>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
