import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, onUnauthorized } from './api.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cliente de API y expiración de sesión', () => {
  it('notifica el 401 y conserva el error para que la llamada también pueda manejarlo', async () => {
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
