const damageLabels = {
  CARROCERIA: "Carrocería",
  LLANTAS: "Llantas",
  LUCES_ELECTRICO: "Luces / sistema eléctrico",
  MOTOR: "Motor",
  FRENOS: "Frenos",
  INTERIOR: "Interior",
  VIDRIOS: "Vidrios",
  PUERTAS: "Puertas",
};

export function formatDamageType(value, otherValue = "") {
  if (value === "OTRO") return otherValue?.trim() || "Otro";
  return damageLabels[value] || value?.replaceAll("_", " ") || "Sin tipo";
}

export function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00`)
    : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value, options = { dateStyle: "medium" }) {
  const date = parseDateValue(value);
  return date ? date.toLocaleString("es-CO", options) : "Fecha no disponible";
}

export function isPdfResource(itemOrUrl) {
  const fileType = typeof itemOrUrl === "object" ? itemOrUrl?.file_type : "";
  const rawUrl =
    typeof itemOrUrl === "object" ? itemOrUrl?.file_url : itemOrUrl;
  if (fileType === "application/pdf") return true;
  const cleanUrl = String(rawUrl || "").split(/[?#]/)[0].toLowerCase();
  return cleanUrl.endsWith(".pdf");
}
