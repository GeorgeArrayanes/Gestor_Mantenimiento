const API_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? 'https://gestor-danos-rutas.onrender.com/api' : '/api');

const unauthorizedListeners = new Set();

export function onUnauthorized(listener) {
  if (typeof listener !== 'function') throw new TypeError('El listener de sesión debe ser una función.');
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized(error) {
  for (const listener of unauthorizedListeners) {
    try {
      listener(error);
    } catch {
      // Un listener de interfaz no debe ocultar el error original de la API.
    }
  }
}

export async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...options.headers }
  });
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

export function fileUrl(url) {
  if (!url || url.startsWith('http')) return url;
  return url;
}
