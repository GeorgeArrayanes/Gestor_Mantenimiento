import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, createSession, downloadEvidence, fetchEvidenceBlob, fileUrl, getSessionToken, onUnauthorized, openEvidence, setSessionToken } from './api.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cliente de API y expiración de sesión', () => {
  it('activa el respaldo bearer cuando el navegador móvil rechaza la cookie', async () => {
    const values = new Map();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key) => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key)
      }
    });
    const user = { id: 1, role: 'ADMIN', name: 'Elena Ríos' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user, token: 'token-respaldo' }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: 'Cookie bloqueada.' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createSession({ username: 'admin', password: 'secreto' })).resolves.toMatchObject({ user });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('Authorization');
    expect(fetchMock.mock.calls[2][1].headers).toMatchObject({ Authorization: 'Bearer token-respaldo' });
    expect(getSessionToken()).toBe('token-respaldo');
  });

  it('envía el token de respaldo desde sessionStorage y puede omitirlo al comprobar la cookie', async () => {
    const values = new Map();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key) => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key)
      }
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    setSessionToken('token-movil');

    await api('/auth/me');
    expect(fetchMock).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer token-movil' })
    }));

    await api('/auth/me', { cookieOnly: true });
    expect(fetchMock).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.not.objectContaining({ Authorization: expect.anything() })
    }));
  });

  it('notifica el 401 y conserva el error para que la llamada también pueda manejarlo', async () => {
    const values = new Map();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key) => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key)
      }
    });
    setSessionToken('token-expirado');
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'La sesión expiró.' })
    }));

    await expect(api('/recurso-protegido')).rejects.toMatchObject({
      message: 'La sesión expiró.',
      status: 401
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getSessionToken()).toBe('');

    unsubscribe();
    await expect(api('/otro-recurso')).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('no invalida la sesión frente a errores que no sean 401', async () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Sin permiso.' })
    }));

    await expect(api('/solo-admin')).rejects.toMatchObject({ status: 403 });
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('envía evidencia multipart sin imponer Content-Type que rompa el límite del formulario', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ incident: { status: 'PENDING' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.set('description', 'Fuga debajo del lavamanos');
    await api('/incidents', { method: 'POST', body: form });
    expect(fetchMock).toHaveBeenCalledWith('/api/incidents', expect.objectContaining({
      credentials: 'include', body: form, headers: expect.not.objectContaining({ 'Content-Type': expect.anything() })
    }));
  });

  it('descarga evidencias privadas con bearer y conserva el nombre del archivo', async () => {
    const values = new Map();
    const anchor = { click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('window', {
      sessionStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) },
      setTimeout: vi.fn((callback) => callback())
    });
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor), body: { appendChild: vi.fn() } });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:private-evidence'), revokeObjectURL: vi.fn() });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(['evidence'], { type: 'image/png' }) });
    vi.stubGlobal('fetch', fetchMock);
    setSessionToken('token-mantenimiento');
    await downloadEvidence('/api/evidences/12/download', 'solucion.png');
    expect(fetchMock).toHaveBeenCalledWith('/api/evidences/12/download', expect.objectContaining({
      credentials: 'include', headers: { Authorization: 'Bearer token-mantenimiento' }
    }));
    expect(anchor.download).toBe('solucion.png');
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-evidence');
  });

  it('rechaza URLs de evidencia externas antes de adjuntar credenciales', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(downloadEvidence('https://untrusted.test/evidences/12/download')).rejects.toThrow('enlace válido');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fileUrl('/api/evidences/1/download')).toBe('/api/evidences/1/download');
  });

  it('presenta un error útil si el servidor devuelve contenido ilegible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('Unexpected token'); } }));
    await expect(api('/incidents')).rejects.toMatchObject({ status: 502, message: 'No fue posible completar la operación.' });
  });
});

describe('lectura y apertura de evidencias privadas', () => {
  function authenticatedWindow(extra = {}) {
    const values = new Map();
    vi.stubGlobal('window', {
      sessionStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
      ...extra,
    });
    setSessionToken('token-privado');
  }

  it('obtiene imágenes por el endpoint autorizado con cookie, Bearer, aborto y sin redirecciones', async () => {
    authenticatedWindow();
    const blob = new Blob(['png bytes'], { type: 'image/png' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    await expect(fetchEvidenceBlob('/api/evidences/8/download', { signal: controller.signal, imageOnly: true })).resolves.toBe(blob);
    expect(fetchMock).toHaveBeenCalledWith('/api/evidences/8/download', {
      credentials: 'include', redirect: 'error', signal: controller.signal, headers: { Authorization: 'Bearer token-privado' },
    });
  });

  it.each([
    'https://untrusted.test/api/evidences/1/download', '/api/evidences/1/download?token=secret',
    '/api/evidences/../auth/me/download', '/api/evidences/1/download/extra',
    '/api/evidences/0/download', '/api/evidences/1/download#image', 'data:image/png;base64,abc',
  ])('rechaza %s antes de enviar credenciales', async (url) => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(fetchEvidenceBlob(url)).rejects.toThrow('enlace válido');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['image/svg+xml', 'text/html', 'application/octet-stream', ''])('no presenta como imagen contenido %s', async (type) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['content'], { type }) }));
    await expect(fetchEvidenceBlob('/api/evidences/1/download', { imageOnly: true })).rejects.toThrow('Vista previa no disponible');
  });

  it('acepta PDF para abrir o descargar y lo rechaza como fotografía', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
    await expect(fetchEvidenceBlob('/api/evidences/1/download')).resolves.toBe(blob);
    await expect(fetchEvidenceBlob('/api/evidences/1/download', { imageOnly: true })).rejects.toThrow('Vista previa no disponible');
  });

  it('rechaza archivos vacíos incluso si el MIME declara una imagen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob([], { type: 'image/jpeg' }) }));
    await expect(fetchEvidenceBlob('/api/evidences/1/download', { imageOnly: true })).rejects.toThrow();
  });

  it('respeta aborto anterior y durante la solicitud sin convertirlo en un error de conexión', async () => {
    const controller = new AbortController(); controller.abort();
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(fetchEvidenceBlob('/api/evidences/1/download', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRejectedValueOnce(new DOMException('Canceled', 'AbortError'));
    await expect(fetchEvidenceBlob('/api/evidences/1/download')).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('descarta una lectura completada después de cancelar su consumidor', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => { controller.abort(); return new Blob(['png'], { type: 'image/png' }); } }));
    await expect(fetchEvidenceBlob('/api/evidences/1/download', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('revoca el respaldo de sesión cuando la evidencia devuelve 401', async () => {
    authenticatedWindow();
    const listener = vi.fn(), unsubscribe = onUnauthorized(listener);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'La sesión expiró.' }) }));
    try {
      await expect(fetchEvidenceBlob('/api/evidences/1/download')).rejects.toMatchObject({ status: 401 });
      expect(getSessionToken()).toBe(''); expect(listener).toHaveBeenCalledTimes(1);
    } finally { unsubscribe(); }
  });

  it('abre un PDF sólo como Blob temporal y libera su URL después de cargar', async () => {
    const callbacks = [];
    const target = { opener: {}, closed: false, location: { replace: vi.fn() }, close: vi.fn() };
    authenticatedWindow({ open: vi.fn(() => target), setTimeout: vi.fn(callback => callbacks.push(callback)) });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:private-pdf'), revokeObjectURL: vi.fn() });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }) }));
    await expect(openEvidence('/api/evidences/2/download', 'informe.pdf')).resolves.toBe('opened');
    expect(target.opener).toBeNull();
    expect(target.location.replace).toHaveBeenCalledWith('blob:private-pdf');
    expect(target.close).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    callbacks.forEach(callback => callback());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-pdf');
  });

  it('descarga el Blob con su nombre cuando el navegador bloquea la pestaña', async () => {
    const anchor = { click: vi.fn(), remove: vi.fn() };
    authenticatedWindow({ open: vi.fn(() => null), setTimeout: vi.fn(callback => callback()) });
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor), body: { appendChild: vi.fn() } });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:download-fallback'), revokeObjectURL: vi.fn() });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }) }));
    await expect(openEvidence('/api/evidences/2/download', 'informe.pdf')).resolves.toBe('downloaded');
    expect(anchor.href).toBe('blob:download-fallback'); expect(anchor.download).toBe('informe.pdf');
    expect(anchor.click).toHaveBeenCalledOnce(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:download-fallback');
  });

  it('cierra la pestaña reservada y no crea URLs para respuestas inseguras', async () => {
    const target = { opener: {}, closed: false, location: { replace: vi.fn() }, close: vi.fn() };
    authenticatedWindow({ open: vi.fn(() => target) });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['<html>'], { type: 'text/html' }) }));
    await expect(openEvidence('/api/evidences/2/download', 'informe.pdf')).rejects.toThrow('formato permitido');
    expect(target.close).toHaveBeenCalledOnce(); expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
