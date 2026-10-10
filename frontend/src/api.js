const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const SESSION_TOKEN_KEY = 'mantenimiento_session_token';

const unauthorizedListeners = new Set();

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getSessionToken() {
  return storage()?.getItem(SESSION_TOKEN_KEY) || '';
}

export function setSessionToken(token) {
  const sessionStorage = storage();
  if (!sessionStorage) return;
  if (token) sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  else sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

export function clearSessionToken() {
  storage()?.removeItem(SESSION_TOKEN_KEY);
}

export function onUnauthorized(listener) {
  if (typeof listener !== 'function') throw new TypeError('El listener de sesión debe ser una función.');
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized(error) {
  clearSessionToken();
  for (const listener of unauthorizedListeners) {
    try {
      listener(error);
    } catch {
      // Un listener de interfaz no debe ocultar el error original de la API.
    }
  }
}

export async function api(path, options = {}) {
  const { cookieOnly = false, ...requestOptions } = options;
  const isForm = requestOptions.body instanceof FormData;
  const token = cookieOnly ? '' : getSessionToken();
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...requestOptions,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...requestOptions.headers
    }
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión e intenta nuevamente.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'No fue posible completar la operación.');
    error.status = response.status;
    error.data = data;
    if (response.status === 401) notifyUnauthorized(error);
    throw error;
  }
  return data;
}

export async function createSession(credentials) {
  clearSessionToken();
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
    cookieOnly: true
  });
  try {
    await api('/auth/me', { cookieOnly: true });
  } catch (error) {
    if (error.status !== 401 || !data.token) throw error;
    setSessionToken(data.token);
    await api('/auth/me');
  }
  return data;
}

export function fileUrl(url) {
  if (!url) return '';
  if (url.startsWith('/api/')) return `${API_URL}${url.slice(4)}`;
  return url;
}

function evidenceEndpoint(url) {
  if (typeof url !== 'string') throw new Error('La evidencia no tiene un enlace válido.');
  const resolved = fileUrl(url);
  const prefix = `${API_URL}/evidences/`;
  if (!resolved.startsWith(prefix) || !/^[1-9]\d*\/download$/.test(resolved.slice(prefix.length))) throw new Error('La evidencia no tiene un enlace válido.');
  return resolved;
}

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const evidenceMimeTypes = new Set([...imageMimeTypes, 'application/pdf']);

function assertNotAborted(signal) {
  if (signal?.aborted) throw new DOMException('La solicitud fue cancelada.', 'AbortError');
}

export async function fetchEvidenceBlob(url, { signal, imageOnly = false } = {}) {
  const resolved = evidenceEndpoint(url);
  assertNotAborted(signal);
  const token = getSessionToken();
  let response;
  try {
    response = await fetch(resolved, { credentials: 'include', redirect: 'error', signal, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No se pudo conectar. Intenta descargar la evidencia nuevamente.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || 'No fue posible descargar la evidencia.');
    error.status = response.status;
    error.data = data;
    if (response.status === 401) notifyUnauthorized(error);
    throw error;
  }
  const blob = await response.blob();
  assertNotAborted(signal);
  const mime = String(blob.type || '').split(';')[0].trim().toLowerCase();
  const allowed = imageOnly ? imageMimeTypes : evidenceMimeTypes;
  if (!blob.size || !allowed.has(mime)) throw new Error(imageOnly ? 'Vista previa no disponible para este archivo.' : 'El archivo recibido no tiene un formato permitido.');
  return blob;
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  } finally { anchor.remove(); }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function downloadIncidentReport({ period, date, format }, { signal } = {}) {
  if (!['day', 'month', 'year'].includes(period) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['pdf', 'xlsx'].includes(format)) throw new Error('Selecciona un periodo y formato válidos.');
  const token = getSessionToken();
  const query = new URLSearchParams({ period, date, format });
  let response;
  try {
    response = await fetch(`${API_URL}/incidents/reports/export?${query}`, {
      credentials: 'include', signal, headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No se pudo generar el reporte. Revisa tu conexión e intenta nuevamente.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || 'No fue posible generar el reporte.');
    error.status = response.status;
    if (response.status === 401) notifyUnauthorized(error);
    throw error;
  }
  const blob = await response.blob();
  const expectedType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (!blob.size || String(blob.type).split(';')[0].toLowerCase() !== expectedType) throw new Error('El servidor no devolvió un reporte válido.');
  const suffix = period === 'day' ? date : period === 'month' ? date.slice(0, 7) : date.slice(0, 4);
  downloadBlob(blob, `reporte-incidencias-${suffix}.${format}`);
}

export async function downloadEvidence(url, filename = 'evidencia', options = {}) {
  downloadBlob(await fetchEvidenceBlob(url, options), filename);
}

export async function openEvidence(url, filename = 'evidencia', options = {}) {
  // Reserve the tab during the click, before the authenticated request finishes.
  evidenceEndpoint(url);
  assertNotAborted(options.signal);
  let target = null;
  try { target = window.open('', '_blank'); if (target) target.opener = null; }
  catch { target?.close(); target = null; }
  let objectUrl;
  try {
    const blob = await fetchEvidenceBlob(url, options);
    if (!target || target.closed) {
      downloadBlob(blob, filename);
      return 'downloaded';
    }
    objectUrl = URL.createObjectURL(blob);
    target.location.replace(objectUrl);
    // The document keeps its own loaded bytes after the temporary URL expires.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    return 'opened';
  } catch (error) {
    target?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw error;
  }
}
