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

export async function downloadEvidence(url, filename = 'evidencia') {
  const resolved = fileUrl(url);
  const prefix = `${API_URL}/evidences/`;
  if (!resolved.startsWith(prefix) || !/^[1-9]\d*\/download$/.test(resolved.slice(prefix.length))) throw new Error('La evidencia no tiene un enlace válido.');
  const token = getSessionToken();
  let response;
  try {
    response = await fetch(resolved, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new Error('No se pudo conectar. Intenta descargar la evidencia nuevamente.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || 'No fue posible descargar la evidencia.');
    error.status = response.status;
    if (response.status === 401) notifyUnauthorized(error);
    throw error;
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
