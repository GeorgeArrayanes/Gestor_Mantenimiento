import { useEffect, useMemo, useState } from "react";
import { FileImage, Send, UploadCloud, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

const damageTypes = [
  ["CARROCERIA", "Carrocería"],
  ["LLANTAS", "Llantas"],
  ["LUCES_ELECTRICO", "Luces / sistema eléctrico"],
  ["MOTOR", "Motor"],
  ["FRENOS", "Frenos"],
  ["INTERIOR", "Interior"],
  ["VIDRIOS", "Vidrios"],
  ["PUERTAS", "Puertas"],
  ["OTRO", "Otro"],
];
const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export default function ReportIncidentPage() {
  const navigate = useNavigate();
  const [buses, setBuses] = useState([]);
  const [form, setForm] = useState({
    bus_id: "",
    damage_type: "",
    other_damage_type: "",
    urgency: "",
    description: "",
  });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [fileError, setFileError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loadingBuses, setLoadingBuses] = useState(true);
  const [loadKey, setLoadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setLoadingBuses(true);
    setLoadError("");
    api("/buses")
      .then((d) => setBuses(d.buses))
      .catch((e) => { setBuses([]); setLoadError(e.message); })
      .finally(() => setLoadingBuses(false));
  }, [loadKey]);
  const bus = useMemo(
    () => buses.find((b) => String(b.id) === String(form.bus_id)),
    [buses, form.bus_id],
  );
  function addFiles(event) {
    const selected = [...event.target.files];
    const invalid = selected.filter((file) => !ALLOWED_FILE_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE);
    const valid = selected.filter((file) => ALLOWED_FILE_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE);
    const unique = valid.filter((file) => !files.some((current) => current.name === file.name && current.size === file.size && current.lastModified === file.lastModified));
    const available = Math.max(0, MAX_FILES - files.length);
    const accepted = unique.slice(0, available);
    const messages = [];
    if (invalid.length) messages.push(`${invalid.length} archivo(s) no cumplen el formato o el máximo de 5 MB.`);
    if (unique.length > available) messages.push(`Solo puedes adjuntar ${MAX_FILES} archivos; no se añadieron ${unique.length - available}.`);
    setFileError(messages.join(" "));
    setFiles((prev) => [...prev, ...accepted]);
    event.target.value = "";
  }
  function validate() {
    const next = {};
    if (!form.bus_id) next.bus_id = "Selecciona un bus.";
    if (!form.damage_type) next.damage_type = "Selecciona el tipo de daño.";
    if (form.damage_type === "OTRO" && !form.other_damage_type.trim()) next.other_damage_type = "Describe el tipo de daño.";
    if (!form.urgency) next.urgency = "Selecciona un nivel de urgencia.";
    if (form.description.trim().length < 10) next.description = "La descripción debe tener al menos 10 caracteres útiles.";
    setFieldErrors(next);
    const first = Object.keys(next)[0];
    if (first) window.requestAnimationFrame(() => document.getElementById(first === "urgency" ? "report-urgency-ALTA" : `report-${first}`)?.focus());
    return !first;
  }
  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, typeof v === "string" ? v.trim() : v));
      files.forEach((f) => body.append("files", f));
      const d = await api("/incidents", { method: "POST", body });
      navigate(`/novedades/${d.incident.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const dirty = Boolean(form.bus_id || form.damage_type || form.urgency || form.description || form.other_damage_type || files.length);
  function cancel() {
    if (dirty && !window.confirm("Hay información sin guardar. ¿Quieres salir del reporte?")) return;
    navigate("/");
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Registro administrativo</p>
          <h1>Generar nuevo reporte de daño</h1>
          <p>Completa los detalles técnicos y adjunta la evidencia inicial.</p>
        </div>
      </div>
      <form className="panel form-card" onSubmit={submit} noValidate>
        {loadError && <div className="page-error" role="alert">{loadError} <button type="button" onClick={() => setLoadKey((value) => value + 1)}>Reintentar carga</button></div>}
        {error && <div className="page-error" role="alert">{error}</div>}
        {loadingBuses && <div className="loading-page compact" role="status">Cargando buses disponibles…</div>}
        {!loadingBuses && !loadError && !buses.length && <div className="page-notice" role="status">No hay buses registrados. Registra una unidad antes de crear una novedad.</div>}
        <div className="form-grid">
          <label className="full">
            Seleccionar vehículo / bus
            <select
              id="report-bus_id"
              value={form.bus_id}
              onChange={(e) => { setForm({ ...form, bus_id: e.target.value }); setFieldErrors((current) => ({ ...current, bus_id: "" })); }}
              aria-invalid={Boolean(fieldErrors.bus_id)}
              aria-describedby={fieldErrors.bus_id ? "report-bus_id-error" : undefined}
              disabled={loadingBuses}
              required
            >
              <option value="">Selecciona un bus</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.reference} ({b.plate}) — {b.driver_name || "Sin conductor"}
                </option>
              ))}
            </select>
            {fieldErrors.bus_id && <small className="field-error" id="report-bus_id-error">{fieldErrors.bus_id}</small>}
            {bus && (
              <small className={bus.driver_id ? "helper" : "helper danger"}>
                {bus.driver_id
                  ? `Conductor asociado: ${bus.driver_name}`
                  : "Este bus no tiene conductor asignado."}
              </small>
            )}
          </label>
          <label>
            Tipo de daño
            <select
              id="report-damage_type"
              value={form.damage_type}
              onChange={(e) =>
                { setForm({ ...form, damage_type: e.target.value }); setFieldErrors((current) => ({ ...current, damage_type: "" })); }
              }
              aria-invalid={Boolean(fieldErrors.damage_type)}
              aria-describedby={fieldErrors.damage_type ? "report-damage_type-error" : undefined}
              required
            >
              <option value="">Selecciona un tipo</option>
              {damageTypes.map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
            {fieldErrors.damage_type && <small className="field-error" id="report-damage_type-error">{fieldErrors.damage_type}</small>}
          </label>
          <fieldset aria-invalid={Boolean(fieldErrors.urgency)} aria-describedby={fieldErrors.urgency ? "report-urgency-error" : undefined}>
            <legend>Nivel de urgencia</legend>
            <div className="urgency-options">
              {["ALTA", "MEDIA", "BAJA"].map((u) => (
                <label key={u} className={form.urgency === u ? "selected" : ""}>
                  <input
                    id={`report-urgency-${u}`}
                    type="radio"
                    name="urgency"
                    value={u}
                    checked={form.urgency === u}
                    onChange={(e) =>
                      { setForm({ ...form, urgency: e.target.value }); setFieldErrors((current) => ({ ...current, urgency: "" })); }
                    }
                    required
                  />
                  <i /> {u[0] + u.slice(1).toLowerCase()}
                </label>
              ))}
            </div>
            {fieldErrors.urgency && <small className="field-error" id="report-urgency-error">{fieldErrors.urgency}</small>}
          </fieldset>
          {form.damage_type === "OTRO" && (
            <label className="full">
              Otro tipo de daño
              <input
                id="report-other_damage_type"
                value={form.other_damage_type}
                onChange={(e) =>
                  { setForm({ ...form, other_damage_type: e.target.value }); setFieldErrors((current) => ({ ...current, other_damage_type: "" })); }
                }
                aria-invalid={Boolean(fieldErrors.other_damage_type)}
                aria-describedby={fieldErrors.other_damage_type ? "report-other_damage_type-error" : undefined}
                required
                maxLength={120}
              />
              {fieldErrors.other_damage_type && <small className="field-error" id="report-other_damage_type-error">{fieldErrors.other_damage_type}</small>}
            </label>
          )}
          <label className="full">
            Descripción detallada del daño
            <textarea
              id="report-description"
              rows="5"
              minLength="10"
              value={form.description}
              onChange={(e) =>
                { setForm({ ...form, description: e.target.value }); setFieldErrors((current) => ({ ...current, description: "" })); }
              }
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? "report-description-help report-description-error" : "report-description-help"}
              placeholder="Describe qué ocurrió, qué parte está afectada y cualquier riesgo operativo…"
              required
            />
            <small className="helper" id="report-description-help">Incluye ubicación, síntoma y riesgo operativo.</small>
            {fieldErrors.description && <small className="field-error" id="report-description-error">{fieldErrors.description}</small>}
          </label>
          <div className="full">
            <span className="field-label">
              Evidencia fotográfica o documental
            </span>
            <label className="upload-zone">
              <UploadCloud />
              <strong>Seleccionar archivos</strong>
              <span>JPG, PNG, WEBP o PDF · máximo 5 MB por archivo</span>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={addFiles}
              />
            </label>
            {fileError && <p className="field-error" role="alert">{fileError}</p>}
            <p className="helper" aria-live="polite">{files.length} de {MAX_FILES} archivos seleccionados.</p>
            <div className="file-chips">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`}>
                  <FileImage />
                  {f.name}
                  <button
                    type="button"
                    onClick={() => { setFiles(files.filter((_, n) => n !== i)); setFileError(""); }}
                    aria-label={`Quitar ${f.name}`}
                  >
                    <X />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={cancel}
          >
            Cancelar
          </button>
          <button className="primary-button" disabled={busy || loadingBuses || Boolean(loadError) || !buses.length || Boolean(form.bus_id && !bus?.driver_id)}>
            {busy ? (
              "Enviando…"
            ) : (
              <>
                <Send />
                Enviar reporte
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
