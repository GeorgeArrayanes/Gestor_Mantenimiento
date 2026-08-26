import { useCallback, useEffect, useRef, useState } from "react";
import {
  Calendar,
  Camera,
  FileText,
  Route,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api, fileUrl } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Toast from "../components/Toast.jsx";
import { formatDate, isPdfResource } from "../utils/formatters.js";

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const maxSize = 5 * 1024 * 1024;
const today = (() => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
})();
const emptyForm = () => ({ description: "", damage_date: today, file: null });

export default function BusDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api(`/buses/${id}`));
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function selectFile(event) {
    const file = event.target.files[0] || null;
    if (file && (!allowedTypes.includes(file.type) || file.size > maxSize)) {
      setError("El archivo debe ser JPG, PNG, WEBP o PDF y pesar máximo 5 MB.");
      event.target.value = "";
      setForm((current) => ({ ...current, file: null }));
      return;
    }
    setError("");
    setForm((current) => ({ ...current, file }));
  }

  async function submit(event) {
    event.preventDefault();
    const description = form.description.trim();
    if (!description) {
      setError("Describe el daño anterior antes de guardarlo.");
      document.getElementById("damage-description")?.focus();
      return;
    }
    if (!form.damage_date || form.damage_date > today) {
      setError("Selecciona una fecha válida que no sea futura.");
      document.getElementById("damage-date")?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("description", description);
      body.append("damage_date", form.damage_date);
      if (form.file) body.append("file", form.file);
      await api(`/buses/${id}/preexisting-damages`, { method: "POST", body });
      setForm(emptyForm());
      if (fileInputRef.current) fileInputRef.current.value = "";
      setToast({ message: "Daño preexistente añadido al historial." });
      await load();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    if (error) {
      return (
        <div className="page-error state-card" role="alert">
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={load}>Reintentar</button>
        </div>
      );
    }
    return <div className="loading-page" role="status">Cargando ficha…</div>;
  }

  const { bus, preexistingDamages } = data;
  return (
    <>
      <div className="page-heading">
        <div>
          <Link to="/buses" className="back-link">← Volver a buses</Link>
          <p className="eyebrow">Ficha del vehículo</p>
          <h1>{bus.reference} · {bus.plate}</h1>
          <p>{bus.brand} {bus.model}</p>
        </div>
        <StatusBadge value={bus.current_status} />
      </div>

      <section className="vehicle-facts panel">
        <Fact icon={Route} label="Ruta asignada" value={bus.route || "Sin ruta"} />
        <Fact icon={Users} label="Capacidad" value={`${bus.capacity} estudiantes`} />
        <Fact icon={UserRound} label="Conductor principal" value={bus.driver_name || "Sin asignar"} />
        <Fact icon={ShieldCheck} label="Estado" value={bus.current_status.replaceAll("_", " ")} />
      </section>

      <div className="detail-grid bus-history-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Daños preexistentes</h2>
              <p>Registro separado de las novedades operativas.</p>
            </div>
            <Link className="text-link" to={`/novedades?bus_id=${bus.id}`}>Ver novedades del bus</Link>
          </div>
          {preexistingDamages.length ? (
            <div className="damage-history">
              {preexistingDamages.map((damage) => (
                <article key={damage.id}>
                  {damage.file_url ? (
                    <a href={fileUrl(damage.file_url)} target="_blank" rel="noreferrer" aria-label={`Abrir archivo de ${damage.description}`}>
                      {isPdfResource(damage) ? <span className="damage-pdf"><FileText /></span> : <img src={fileUrl(damage.file_url)} alt={damage.description} />}
                    </a>
                  ) : <span><Camera /></span>}
                  <div>
                    <strong>{damage.description}</strong>
                    <small>
                      <Calendar />
                      <time dateTime={String(damage.damage_date || "").slice(0, 10)}>{formatDate(damage.damage_date)}</time>
                      {" · "}{damage.registered_by_name}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin daños anteriores" text="No se han registrado daños preexistentes para esta unidad." />
          )}
        </section>

        {user.role === "ADMIN" && (
          <form className="panel" onSubmit={submit} noValidate>
            <div className="section-heading">
              <div>
                <h2>Registrar daño anterior</h2>
                <p>No crea una novedad operativa.</p>
              </div>
            </div>
            {error && <div className="page-error" role="alert">{error}</div>}
            <div className="form-grid single">
              <label className="full">
                Descripción
                <textarea id="damage-description" rows="4" value={form.description} onChange={(event) => { setError(""); setForm({ ...form, description: event.target.value }); }} required />
              </label>
              <label>
                Fecha
                <input id="damage-date" type="date" max={today} value={form.damage_date} onChange={(event) => { setError(""); setForm({ ...form, damage_date: event.target.value }); }} required />
              </label>
              <label>
                Archivo opcional
                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={selectFile} />
                <small className="helper">JPG, PNG, WEBP o PDF · máximo 5 MB.</small>
              </label>
            </div>
            <div className="form-actions">
              <button className="primary-button" disabled={busy}>{busy ? "Guardando…" : "Agregar al historial"}</button>
            </div>
          </form>
        )}
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

function Fact({ icon: Icon, label, value }) {
  return <div><Icon /><span><small>{label}</small><b>{value}</b></span></div>;
}
