import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BusFront,
  Check,
  Clock3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  UploadCloud,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, fileUrl } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Toast from "../components/Toast.jsx";
import { formatDamageType, formatDate, isPdfResource } from "../utils/formatters.js";
import { isAdminRole } from "../utils/roles.js";

const allowedEvidenceTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const maxEvidenceSize = 5 * 1024 * 1024;

const eventLabels = {
  NOVEDAD_CREADA: "Novedad creada",
  EVIDENCIA_AGREGADA: "Evidencia agregada",
  REPARACION_INICIADA: "Reparación iniciada",
  SOLUCION_ENVIADA: "Solución enviada",
  REPARACION_RECHAZADA: "Reparación rechazada",
  REPARACION_APROBADA: "Reparación aprobada",
};
export default function IncidentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const rejectButtonRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState([]);
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [toast, setToast] = useState(null);
  const load = useCallback(
    () => {
      setError("");
      return (
      api(`/incidents/${id}`)
        .then(setData)
        .catch((e) => setError(e.message))
      );
    },
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);
  async function transition(action, body = {}) {
    if (
      action === "approve" &&
      !window.confirm(
        action === "approve"
          ? "¿Aprobar esta reparación y marcar la novedad como resuelta?"
          : "",
      )
    )
      return;
    setBusy(action);
    setError("");
    try {
      await api(`/incidents/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setToast({
        message:
          action === "approve"
            ? "Reparación aprobada."
            : action === "reject"
              ? "Corrección solicitada."
              : "Estado actualizado.",
      });
      setRejecting(false);
      setReason("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function upload(e) {
    e.preventDefault();
    if (!files.length) return setError("Selecciona al menos un archivo.");
    setBusy("upload");
    setError("");
    try {
      const body = new FormData();
      files.forEach((f) => body.append("files", f));
      body.append("comment", comment);
      await api(`/incidents/${id}/evidences`, { method: "POST", body });
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setToast({ message: "Evidencia agregada sin eliminar las anteriores." });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  function selectFiles(event) {
    const selected = [...event.target.files];
    const invalid = selected.filter((file) => !allowedEvidenceTypes.includes(file.type) || file.size > maxEvidenceSize);
    const valid = selected.filter((file) => allowedEvidenceTypes.includes(file.type) && file.size <= maxEvidenceSize);
    const accepted = valid.slice(0, 5);
    const messages = [];
    if (invalid.length) messages.push(`${invalid.length} archivo(s) no cumplen el formato o el máximo de 5 MB.`);
    if (valid.length > 5) messages.push(`Solo se seleccionaron los primeros 5 archivos.`);
    setError(messages.join(" "));
    setFiles(accepted);
    event.target.value = "";
  }
  if (error && !data)
    return (
      <div className="page-error state-card" role="alert">
        <p>{error}</p>
        <button className="secondary-button" onClick={load}>Reintentar</button>
        <button className="text-button" onClick={() => navigate("/novedades")}>Volver a novedades</button>
      </div>
    );
  if (!data) return <div className="loading-page" role="status">Cargando detalle…</div>;
  const { incident: i, evidences, history } = data;
  const driver = user.role === "CONDUCTOR";
  const canWork = driver && i.status === "EN_PROCESO";
  const latestStart = history.filter((item) => item.event_type === "REPARACION_INICIADA").at(-1);
  const hasCurrentEvidence = Boolean(latestStart && evidences.some((item) => item.category !== "REPORTE" && new Date(item.created_at) >= new Date(latestStart.created_at)));
  return (
    <>
      <div className="page-heading detail-title">
        <div>
          <Link to="/novedades" className="back-link">
            ← Volver a novedades
          </Link>
          <p className="eyebrow">Novedad #{i.id}</p>
          <h1>{formatDamageType(i.damage_type, i.other_damage_type)}</h1>
          <p>
            Reportada el{" "}
            <time dateTime={i.reported_at}>{formatDate(i.reported_at, {
              dateStyle: "long",
              timeStyle: "short",
            })}</time>
          </p>
        </div>
        <div className="title-badges">
          <StatusBadge value={i.urgency} urgency />
          <StatusBadge value={i.status} />
        </div>
      </div>
      {error && <div className="page-error detail-error" role="alert">{error}</div>}
      <section className="vehicle-strip">
        <div className="bus-card-icon">
          <BusFront />
        </div>
        <div>
          <strong>
            {i.reference} <span>· {i.plate}</span>
          </strong>
          <p>
            {i.brand} {i.model} · {i.route || "Sin ruta asignada"}
          </p>
        </div>
        <div className="strip-driver">
          <UserRound />
          <span>
            <small>Conductor responsable</small>
            <b>{i.driver_name || "Sin asignar"}</b>
          </span>
        </div>
      </section>
      <section className="progress-track" role="list" aria-label="Progreso de la novedad">
        <Step done active={i.status === "REPORTADO"} icon={Check} label="Reportado" />
        <div className="progress-line done" aria-hidden="true" />
        <Step
          done={[
            "EN_PROCESO",
            "PENDIENTE_VALIDACION",
            "REQUIERE_CORRECCION",
            "RESUELTO",
          ].includes(i.status)}
          active={["EN_PROCESO", "REQUIERE_CORRECCION"].includes(i.status)}
          icon={Wrench}
          label="En reparación"
        />
        <div
          className={`progress-line ${["PENDIENTE_VALIDACION", "REQUIERE_CORRECCION", "RESUELTO"].includes(i.status) ? "done" : ""}`}
          aria-hidden="true"
        />
        <Step
          done={[
            "PENDIENTE_VALIDACION",
            "REQUIERE_CORRECCION",
            "RESUELTO",
          ].includes(i.status)}
          active={i.status === "PENDIENTE_VALIDACION"}
          icon={ShieldCheck}
          label="Validación"
        />
        <div
          className={`progress-line ${i.status === "RESUELTO" ? "done" : ""}`}
          aria-hidden="true"
        />
        <Step done={i.status === "RESUELTO"} active={i.status === "RESUELTO"} icon={Check} label="Resuelto" />
      </section>
      <div className="detail-grid">
        <div className="detail-column">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Detalle del daño reportado</h2>
                <p>Información original de la novedad.</p>
              </div>
            </div>
            <div className="report-meta">
              <span>
                <AlertTriangle />
                Urgencia <b>{i.urgency}</b>
              </span>
              <span>
                <UserRound />
                Reportado por <b>{i.reporter_name}</b>
              </span>
            </div>
            <h3>Descripción del reporte</h3>
            <p className="report-description">{i.description}</p>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Evidencias</h2>
                <p>
                  {evidences.length} archivo(s) conservados en el historial.
                </p>
              </div>
            </div>
            {evidences.length ? (
              <div className="evidence-groups">
                {["REPORTE", "SOLUCION", "CORRECCION"].map((category) => {
                  const group = evidences.filter(
                    (e) => e.category === category,
                  );
                  return group.length ? (
                    <div key={category}>
                      <h3>
                        {category === "REPORTE"
                          ? "Daño original"
                          : category === "SOLUCION"
                            ? "Primera solución"
                            : "Correcciones posteriores"}
                      </h3>
                      <div className="evidence-grid">
                        {group.map((e) => (
                          <Evidence key={e.id} item={e} />
                        ))}
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              <div className="evidence-empty">
                <ImageIcon />
                Aún no hay archivos adjuntos.
              </div>
            )}
          </section>
        </div>
        <div className="detail-column">
          <section className="panel action-panel">
            <h2>Acciones disponibles</h2>
            {i.status === "RESUELTO" && (
              <div className="resolved-box">
                <Check />
                <div>
                  <strong>Novedad resuelta</strong>
                  <span>
                    La reparación fue aprobada y ya no admite cambios normales.
                  </span>
                </div>
              </div>
            )}
            {driver && i.status === "REPORTADO" && (
              <ActionIntro
                icon={Play}
                title="¿Listo para atenderla?"
                text="Al iniciar, la novedad pasará a reparación y se registrará en el historial."
                button="Iniciar reparación"
                onClick={() => transition("start")}
                busy={busy}
              />
            )}{" "}
            {driver && i.status === "REQUIERE_CORRECCION" && (
              <ActionIntro
                icon={RotateCcw}
                title="Se requiere una corrección"
                text={
                  history
                    .filter((h) => h.event_type === "REPARACION_RECHAZADA")
                    .at(-1)?.comment ||
                  "Revisa la observación del administrador y vuelve a intentarlo."
                }
                button="Iniciar corrección"
                onClick={() => transition("start")}
                busy={busy}
              />
            )}{" "}
            {canWork && (
              <form className="repair-form" onSubmit={upload}>
                <p>
                  Adjunta fotografías o un PDF que demuestre el trabajo
                  realizado. Los archivos anteriores no se reemplazan.
                </p>
                <label className="upload-zone compact">
                  <UploadCloud />
                  <strong>Seleccionar evidencia</strong>
                  <span>JPG, PNG, WEBP o PDF · máx. 5 MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={selectFiles}
                  />
                </label>
                {files.length > 0 && (
                  <div className="selected-files">
                    {files.map((f, index) => (
                      <span key={`${f.name}-${f.lastModified}`}>
                        {f.name}
                        <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X /></button>
                      </span>
                    ))}
                  </div>
                )}
                <label>
                  Comentario de la reparación
                  <textarea
                    rows="3"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Explica qué se reparó o cambió…"
                  />
                </label>
                <button
                  className="secondary-button wide"
                  disabled={busy === "upload" || !files.length}
                >
                  {busy === "upload" ? "Subiendo…" : "Guardar evidencia"}
                </button>
                <div className={`repair-check ${hasCurrentEvidence ? "complete" : "pending"}`} role="status">
                  {hasCurrentEvidence ? <Check /> : <Clock3 />}
                  <span>{hasCurrentEvidence ? "Evidencia de esta reparación guardada." : "Guarda al menos una evidencia antes de enviarla a validación."}</span>
                </div>
                <button
                  type="button"
                  className="primary-button wide"
                  disabled={Boolean(busy) || !hasCurrentEvidence}
                  onClick={() => transition("submit", { comment })}
                >
                  <Send />
                  Enviar para validación
                </button>
              </form>
            )}
            {driver && i.status === "PENDIENTE_VALIDACION" && (
              <div className="waiting-box">
                <Clock3 />
                <strong>Esperando revisión del administrador</strong>
                <span>
                  La solución fue enviada y no puede modificarse mientras está
                  en validación.
                </span>
              </div>
            )}
            {isAdminRole(user.role) && i.status === "PENDIENTE_VALIDACION" && (
              <div className="validation-actions">
                <p>
                  Revisa todas las evidencias antes de aprobar o pedir una
                  corrección.
                </p>
                <button
                  className="success-button wide"
                  onClick={() =>
                    transition("approve", {
                      comment: "Solución aprobada por administración.",
                    })
                  }
                  disabled={Boolean(busy)}
                >
                  <Check />
                  Aprobar solución
                </button>
                <button
                  ref={rejectButtonRef}
                  className="danger-button wide"
                  onClick={() => setRejecting(true)}
                  disabled={Boolean(busy)}
                >
                  <X />
                  Solicitar corrección
                </button>
                {rejecting && (
                  <div className="reject-box">
                    <label>
                      Motivo obligatorio
                      <textarea
                        rows="3"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Indica claramente qué debe corregirse…"
                        autoFocus
                      />
                    </label>
                    <div>
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setRejecting(false);
                          window.requestAnimationFrame(() => rejectButtonRef.current?.focus());
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        className="danger-button"
                        disabled={!reason.trim()}
                        onClick={() => transition("reject", { reason })}
                      >
                        Confirmar rechazo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {isAdminRole(user.role) &&
              !["PENDIENTE_VALIDACION", "RESUELTO"].includes(i.status) && (
                <div className="waiting-box neutral">
                  <Clock3 />
                  <strong>Seguimiento en curso</strong>
                  <span>
                    Las próximas acciones corresponden al conductor responsable.
                  </span>
                </div>
              )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Historial</h2>
                <p>Registro inmutable de actividad.</p>
              </div>
            </div>
            <div className="timeline">
              {history.map((h, index) => (
                <article key={h.id}>
                  <span
                    className={`timeline-dot ${h.event_type.includes("RECHAZADA") ? "red" : h.event_type.includes("APROBADA") ? "green" : ""}`}
                  >
                    {h.event_type.includes("RECHAZADA") ? <X /> : <Check />}
                  </span>
                  <div>
                    <strong>
                      {eventLabels[h.event_type] ||
                        h.event_type.replaceAll("_", " ")}
                    </strong>
                    <small>
                      {h.user_name} ·{" "}
                      <time dateTime={h.created_at}>{formatDate(h.created_at, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}</time>
                    </small>
                    {h.comment && <p>{h.comment}</p>}
                    {h.previous_status && (
                      <span className="state-change">
                        {h.previous_status.replaceAll("_", " ")} →{" "}
                        {h.new_status.replaceAll("_", " ")}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
function Step({ done, active, icon: Icon, label }) {
  return (
    <div
      className={`progress-step ${done ? "done" : ""} ${active ? "active" : ""}`}
      role="listitem"
      aria-current={active ? "step" : undefined}
      aria-label={`${label}: ${active ? "paso actual" : done ? "completado" : "pendiente"}`}
    >
      <span>
        <Icon />
      </span>
      <b>{label}</b>
    </div>
  );
}
function Evidence({ item }) {
  const isPdf = isPdfResource(item);
  return (
    <a
      className="evidence-card"
      href={fileUrl(item.file_url)}
      target="_blank"
      rel="noreferrer"
    >
      {isPdf ? (
        <div className="pdf-preview">
          <FileText />
        </div>
      ) : (
        <img
          src={fileUrl(item.file_url)}
          alt={item.comment || item.file_name}
        />
      )}
      <div>
        <b>{item.file_name}</b>
        <small>
          {item.uploaded_by_name} ·{" "}
          <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
        </small>
        {item.comment && <span>{item.comment}</span>}
      </div>
      <ExternalLink />
    </a>
  );
}
function ActionIntro({ icon: Icon, title, text, button, onClick, busy }) {
  return (
    <div className="action-intro">
      <span>
        <Icon />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <button
        className="primary-button wide"
        onClick={onClick}
        disabled={Boolean(busy)}
      >
        {button}
      </button>
    </div>
  );
}
