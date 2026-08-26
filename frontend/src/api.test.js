import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, createSession, getSessionToken, onUnauthorized, setSessionToken } from './api.js';

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
});
