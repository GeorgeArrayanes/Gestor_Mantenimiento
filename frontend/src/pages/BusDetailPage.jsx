import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BusFront,
  Calendar,
  Camera,
  CircleAlert,
  FileText,
  History,
  Phone,
  Plus,
  Route,
  ShieldCheck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api, fileUrl } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Toast from "../components/Toast.jsx";
import { formatDamageType, formatDate, isPdfResource } from "../utils/formatters.js";
import busImage from "../img/bus-arrayanes.png";

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

  const {
    bus,
    preexistingDamages,
    incidentSummary = { total: 0, active: 0, resolved: 0, last_reported_at: null },
    recentIncidents = [],
  } = data;
  const totalIncidents = Number(incidentSummary.total || 0);
  const activeIncidents = Number(incidentSummary.active || 0);
  const resolvedIncidents = Number(incidentSummary.resolved || 0);
  const resolutionRate = totalIncidents ? Math.round((resolvedIncidents / totalIncidents) * 100) : 100;
  return (
    <>
      <div className="page-heading vehicle-page-heading">
        <div>
          <Link to="/buses" className="back-link">← Volver a buses</Link>
          <p className="eyebrow">Expediente de flota</p>
          <h1>{bus.reference} · {bus.plate}</h1>
          <p>Información operativa, historial y novedades de esta unidad.</p>
        </div>
        <div className="vehicle-heading-actions">
          <StatusBadge value={bus.current_status} />
          {user.role === "ADMIN" && <Link className="primary-button" to={`/reportar?bus_id=${bus.id}`}><Plus />Reportar novedad</Link>}
        </div>
      </div>

      <section className="vehicle-profile panel">
        <div className="vehicle-profile-copy">
          <span className="vehicle-reference"><BusFront /> Unidad escolar · {bus.reference}</span>
          <h2>{bus.brand} <span>{bus.model}</span></h2>
          <p>Vista central de la unidad asignada a la operación escolar de Los Arrayanes.</p>
          <div className="vehicle-identity">
            <div className="vehicle-plate"><small>Placa</small><strong>{bus.plate}</strong></div>
            <div className="vehicle-route"><Route /><span><small>Ruta asignada</small><strong>{bus.route || "Sin ruta asignada"}</strong></span></div>
          </div>
          <div className="vehicle-contact-actions">
            <Link className="secondary-button" to={`/novedades?bus_id=${bus.id}`}><History />Ver historial operativo</Link>
            {user.role === "ADMIN" && bus.driver_phone && <a className="vehicle-phone-link" href={`tel:${bus.driver_phone}`}><Phone />Llamar al conductor</a>}
          </div>
        </div>
        <div className="vehicle-visual">
          <span className="vehicle-orbit vehicle-orbit-one" aria-hidden="true" />
          <span className="vehicle-orbit vehicle-orbit-two" aria-hidden="true" />
          <img src={busImage} alt={`Bus escolar de referencia para ${bus.reference}`} />
          <div className="vehicle-visual-caption"><i />Modelo visual de la flota</div>
        </div>
      </section>

      <section className="vehicle-facts vehicle-stat-grid" aria-label="Resumen del vehículo">
        <Fact icon={Users} label="Capacidad" value={`${bus.capacity} estudiantes`} />
        <Fact icon={UserRound} label="Conductor principal" value={bus.driver_name || "Sin asignar"} />
        <Fact icon={CircleAlert} label="Novedades activas" value={String(activeIncidents)} tone={activeIncidents ? "alert" : "ok"} />
        <Fact icon={ShieldCheck} label="Casos resueltos" value={String(resolvedIncidents)} tone="ok" />
      </section>

      <div className="vehicle-dashboard-grid">
        <section className="panel vehicle-activity-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Bitácora de la unidad</p>
              <h2>Actividad reciente</h2>
              <p>Últimos reportes asociados a {bus.reference}.</p>
            </div>
            <Link className="text-link" to={`/novedades?bus_id=${bus.id}`}>Abrir archivo <ArrowRight /></Link>
          </div>
          {recentIncidents.length ? (
            <div className="vehicle-activity-list">
              {recentIncidents.map((incident) => (
                <Link className="vehicle-activity-card" to={`/novedades/${incident.id}`} key={incident.id}>
                  <span className={`activity-icon urgency-${incident.urgency}`}><Wrench /></span>
                  <span className="activity-copy">
                    <small>NR-{String(incident.id).padStart(3, "0")} · {formatDate(incident.reported_at)}</small>
                    <strong>{formatDamageType(incident.damage_type, incident.other_damage_type)}</strong>
                    <span>Prioridad {incident.urgency.toLowerCase()}</span>
                  </span>
                  <StatusBadge value={incident.status} />
                  <ArrowRight className="activity-arrow" aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : <EmptyState title="Sin actividad registrada" text="Esta unidad todavía no tiene novedades operativas." />}
        </section>

        <aside className="panel vehicle-health-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Estado operativo</p>
              <h2>Resolución de novedades</h2>
              <p>Calculado con el historial real de la unidad.</p>
            </div>
          </div>
          <div className="resolution-score">
            <div><strong>{resolutionRate}%</strong><span>resuelto</span></div>
            <div className="resolution-track" role="img" aria-label={`${resolutionRate}% de las novedades históricas están resueltas`}><i style={{ width: `${resolutionRate}%` }} /></div>
          </div>
          <dl className="vehicle-health-list">
            <div><dt><i className="health-dot active" />Activas</dt><dd>{activeIncidents}</dd></div>
            <div><dt><i className="health-dot resolved" />Resueltas</dt><dd>{resolvedIncidents}</dd></div>
            <div><dt><i className="health-dot total" />Histórico total</dt><dd>{totalIncidents}</dd></div>
          </dl>
          <div className="vehicle-last-activity">
            <Calendar />
            <span><small>Último reporte</small><strong>{incidentSummary.last_reported_at ? formatDate(incidentSummary.last_reported_at) : "Sin reportes"}</strong></span>
          </div>
        </aside>
      </div>

      <div className="detail-grid bus-history-grid vehicle-records-grid">
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

function Fact({ icon: Icon, label, value, tone = "" }) {
  return <div className={`vehicle-stat-card ${tone ? `is-${tone}` : ""}`}><Icon /><span><small>{label}</small><b>{value}</b></span></div>;
}
