import { useCallback, useEffect, useState } from 'react';
import { Edit3, Mail, Phone, Plus, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Toast from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import usePageLifecycle from './usePageLifecycle.js';
import './maintenance-pages.css';

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

  if (user?.role !== 'SUPER_ADMIN') return <div className="maintenance-page"><div className="panel"><EmptyState title="Acceso reservado" text="Solo el superadministrador puede gestionar las cuentas administrativas." /></div></div>;

  return (
    <div className="maintenance-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Gobierno de acceso</p>
          <h1>Administradores</h1>
          <p>Gestiona las cuentas autorizadas para operar el mantenimiento del colegio.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => open()}>
          <Plus aria-hidden="true" />
          Crear administrador
        </button>
      </div>

      <section className="admin-access-note" aria-label="Protección del módulo">
        <span><ShieldCheck aria-hidden="true" /></span>
        <div>
          <strong>Acceso exclusivo del superadministrador</strong>
          <p>Estas cuentas gestionan incidencias, personal y espacios. La gestión de administradores queda reservada al superadministrador.</p>
        </div>
      </section>

      {error && !editing && <div className="page-error" role="alert">{error} <button type="button" className="text-button" onClick={load}>Reintentar</button></div>}
      {loading ? (
        <div className="loading-page" role="status" aria-live="polite" aria-busy="true">Cargando administradores…</div>
      ) : error ? null : items.length ? (
        <div className="people-grid admin-grid">
          {items.map((admin) => (
            <article className="person-card admin-card" key={admin.id}>
              <div className="person-head">
                <div className="person-avatar admin-avatar"><ShieldCheck aria-hidden="true" /></div>
                <div>
                  <h2>{admin.name}</h2>
                  <span className="person-identification">{admin.identification}</span>
                </div>
                <StatusBadge value={admin.status} />
              </div>
              <div className="person-info">
                <span><Mail aria-hidden="true" />{admin.username}</span>
                <span><Phone aria-hidden="true" />{admin.phone || 'Sin celular'}</span>
                <small>Administrador de mantenimiento</small>
              </div>
              <button type="button" onClick={() => open(admin)} aria-label={`Editar administrador ${admin.name}`}>
                <Edit3 aria-hidden="true" />
                Editar administrador
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState title="Aún no hay administradores adicionales" text="Crea una cuenta cuando otra persona necesite gestionar la operación." />
        </div>
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
            <button type="button" onClick={close} aria-label="Cerrar formulario de administrador" disabled={saving}>×</button>
          </div>
          {error && <div id="admin-modal-error" className="page-error" role="alert">{error}</div>}
          <div className="form-grid">
            <label className="full">
              Nombre completo
              <input data-autofocus value={form.name} onChange={(event) => update('name', event.target.value)} required minLength={3} maxLength={120} disabled={saving} />
            </label>
            <label>
              Identificación
              <input value={form.identification} onChange={(event) => update('identification', event.target.value)} required minLength={3} maxLength={40} disabled={saving} />
            </label>
            <label>
              Celular
              <input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} maxLength={40} disabled={saving} />
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
