import { useEffect, useState } from "react";
import { Edit3, Phone, Plus, UserRound, Waypoints } from "lucide-react";
import { api } from "../api.js";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Toast from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";

const empty = {
  name: "",
  identification: "",
  username: "",
  phone: "",
  password: "",
  status: "ACTIVO",
  role: "CONDUCTOR",
};
export default function DriversPage() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = () => {
    setLoading(true);
    setError("");
    return api("/users?role=CONDUCTOR")
      .then((d) => setItems(d.users))
      .catch((e) => {
        setItems([]);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  function open(item = null) {
    setEditing(item?.id || "new");
    setForm(item ? { ...item, password: "" } : empty);
    setError("");
  }
  function close() {
    if (saving) return;
    setEditing(null);
    setError("");
  }
  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  }
  async function save(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const body = { ...form };
      if (editing !== "new" && !body.password) delete body.password;
      await api(editing === "new" ? "/users" : `/users/${editing}`, {
        method: editing === "new" ? "POST" : "PATCH",
        body: JSON.stringify(body),
      });
      setEditing(null);
      setToast({ message: "Conductor guardado correctamente." });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Equipo de ruta</p>
          <h1>Conductores</h1>
          <p>Administra sus cuentas y revisa la unidad asignada.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => open()}>
          <Plus aria-hidden="true" />
          Registrar conductor
        </button>
      </div>
      {error && !editing && <div className="page-error" role="alert">{error} <button type="button" className="text-button" onClick={load}>Reintentar</button></div>}
      {loading ? (
        <div className="loading-page" role="status" aria-live="polite" aria-busy="true">Organizando el equipo de ruta…</div>
      ) : error ? null : items.length ? (
        <div className="people-grid">
          {items.map((d) => (
            <article className="person-card" key={d.id}>
              <div className="person-head">
                <div className="person-avatar">
                  <UserRound />
                </div>
                <div>
                  <h2>{d.name}</h2>
                  <span>{d.identification}</span>
                </div>
                <StatusBadge value={d.status} />
              </div>
              <div className="person-info">
                <span>
                  <Phone />
                  {d.phone || "Sin celular"}
                </span>
                <span>
                  <Waypoints />
                  {d.bus_reference
                    ? `${d.bus_reference} · ${d.bus_plate}`
                    : "Sin bus asignado"}
                </span>
                <small>{d.username}</small>
              </div>
              <button type="button" onClick={() => open(d)} aria-label={`Editar conductor ${d.name}`}>
                <Edit3 aria-hidden="true" />
                Editar conductor
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            title="Aún no hay conductores"
            text="Registra el primer integrante del equipo de ruta."
          />
        </div>
      )}
      {editing && (
        <Modal
          as="form"
          onSubmit={save}
          onClose={close}
          labelledBy="driver-modal-title"
          describedBy={error ? "driver-modal-error" : undefined}
        >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Cuenta de conductor</p>
                <h2 id="driver-modal-title">{editing === "new" ? "Nuevo conductor" : form.name}</h2>
              </div>
              <button type="button" onClick={close} aria-label="Cerrar formulario de conductor" disabled={saving}>
                ×
              </button>
            </div>
            {error && <div id="driver-modal-error" className="page-error" role="alert">{error}</div>}
            <div className="form-grid">
              <label className="full">
                Nombre completo
                <input
                  data-autofocus
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </label>
              <label>
                Identificación
                <input
                  value={form.identification}
                  onChange={(e) => update("identification", e.target.value)}
                  required
                />
              </label>
              <label>
                Celular
                <input
                  value={form.phone || ""}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </label>
              <label className="full">
                Correo o usuario
                <input
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  required
                />
              </label>
              <label>
                {editing === "new"
                  ? "Contraseña"
                  : "Nueva contraseña (opcional)"}
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  required={editing === "new"}
                  minLength="8"
                />
              </label>
              <label>
                Estado
                <select
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={close}
                disabled={saving}
              >
                Cancelar
              </button>
              <button type="submit" className="primary-button" disabled={saving} aria-busy={saving}>
                {saving ? "Guardando…" : "Guardar conductor"}
              </button>
            </div>
        </Modal>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
