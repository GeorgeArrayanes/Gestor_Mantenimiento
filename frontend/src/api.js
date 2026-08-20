const API_URL = import.meta.env.VITE_API_URL || '/api';

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
    throw error;
  }
  return data;
}

export function fileUrl(url) {
  if (!url || url.startsWith('http')) return url;
  return url;
}
