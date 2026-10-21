import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPrivateMediaCache } from './private-media-cache.js';

const picture = (bytes = 'image') => new Blob([bytes], { type: 'image/png' });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
};

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('caché temporal de medios privados', () => {
  it('reutiliza el Blob durante 60 segundos sin renovar el vencimiento al leerlo', async () => {
    vi.useFakeTimers();
    const cache = createPrivateMediaCache(), blob = picture(), load = vi.fn(() => blob);
    await expect(cache.get('image', load)).resolves.toBe(blob);
    vi.advanceTimersByTime(59_999);
    await expect(cache.get('image', load)).resolves.toBe(blob);
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    await cache.get('image', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('mantiene como máximo 32 entradas y conserva las que se usaron recientemente', async () => {
    const cache = createPrivateMediaCache(), load = vi.fn(() => picture());
    for (let index = 0; index < 32; index += 1) await cache.get(String(index), load);
    await cache.get('0', load);
    await cache.get('32', load);
    expect(load).toHaveBeenCalledTimes(33);
    await cache.get('0', load);
    expect(load).toHaveBeenCalledTimes(33);
    await cache.get('1', load);
    expect(load).toHaveBeenCalledTimes(34);
  });

  it('limita a 12 MiB los bytes almacenados y expulsa la imagen menos reciente', async () => {
    const cache = createPrivateMediaCache();
    const large = picture(new Uint8Array(7 * 1024 * 1024)), medium = picture(new Uint8Array(6 * 1024 * 1024));
    const loadLarge = vi.fn(() => large), loadMedium = vi.fn(() => medium);
    await cache.get('large', loadLarge);
    await cache.get('medium', loadMedium);
    await cache.get('medium', loadMedium);
    expect(loadMedium).toHaveBeenCalledTimes(1);
    await cache.get('large', loadLarge);
    expect(loadLarge).toHaveBeenCalledTimes(2);
  });

  it('devuelve archivos grandes sin conservarlos ni expulsar imágenes pequeñas válidas', async () => {
    const cache = createPrivateMediaCache({ maxBytes: 5 });
    const small = vi.fn(() => picture('123')), large = vi.fn(() => picture('123456'));
    await cache.get('small', small);
    await cache.get('large', large);
    await cache.get('large', large);
    await cache.get('small', small);
    expect(large).toHaveBeenCalledTimes(2);
    expect(small).toHaveBeenCalledTimes(1);
  });

  it('no conserva blobs vacíos ni formatos rechazados por la política del llamador', async () => {
    const cache = createPrivateMediaCache({ canCache: blob => blob.type === 'image/png' });
    const empty = vi.fn(() => picture('')), pdf = vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' }));
    await cache.get('empty', empty); await cache.get('empty', empty);
    await cache.get('pdf', pdf); await cache.get('pdf', pdf);
    expect(empty).toHaveBeenCalledTimes(2);
    expect(pdf).toHaveBeenCalledTimes(2);
  });

  it('permite desactivar el almacenamiento con un límite de cero entradas', async () => {
    const cache = createPrivateMediaCache({ maxEntries: 0 }), load = vi.fn(() => picture());
    await cache.get('image', load); await cache.get('image', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('comparte una solicitud en curso entre consumidores independientes', async () => {
    const cache = createPrivateMediaCache(), request = deferred(), blob = picture();
    const load = vi.fn(() => request.promise);
    const first = cache.get('image', load), second = cache.get('image', load);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    request.resolve(blob);
    await expect(first).resolves.toBe(blob); await expect(second).resolves.toBe(blob);
    await cache.get('image', load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('cancelar un consumidor no cancela la descarga compartida ni otro consumidor', async () => {
    const cache = createPrivateMediaCache(), request = deferred(), controller = new AbortController(), blob = picture();
    const load = vi.fn(() => request.promise);
    const first = cache.get('image', load, { signal: controller.signal }), second = cache.get('image', load);
    const canceled = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    controller.abort();
    await canceled;
    expect(load.mock.calls[0][0].aborted).toBe(false);
    request.resolve(blob);
    await expect(second).resolves.toBe(blob);
    await cache.get('image', load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('cancela la red cuando todos se retiran y permite iniciar una nueva descarga', async () => {
    const cache = createPrivateMediaCache(), request = deferred();
    const firstController = new AbortController(), secondController = new AbortController();
    const load = vi.fn(() => request.promise);
    const first = cache.get('image', load, { signal: firstController.signal });
    const second = cache.get('image', load, { signal: secondController.signal });
    const canceled = Promise.all([expect(first).rejects.toMatchObject({ name: 'AbortError' }), expect(second).rejects.toMatchObject({ name: 'AbortError' })]);
    await Promise.resolve();
    firstController.abort(); secondController.abort();
    await canceled;
    expect(load.mock.calls[0][0].aborted).toBe(true);
    const freshBlob = picture('fresh'), fresh = vi.fn(() => freshBlob);
    await expect(cache.get('image', fresh)).resolves.toBe(freshBlob);
    request.resolve(picture('stale'));
    await Promise.resolve();
    await expect(cache.get('image', fresh)).resolves.toBe(freshBlob);
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('rechaza una señal ya cancelada sin iniciar ninguna lectura, incluso en un acierto', async () => {
    const cache = createPrivateMediaCache(), load = vi.fn(() => picture()), controller = new AbortController();
    controller.abort();
    await expect(cache.get('image', load, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(load).not.toHaveBeenCalled();
    await cache.get('image', load);
    await expect(cache.get('image', load, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('no almacena fallos y deja que el siguiente intento vuelva a descargar', async () => {
    const cache = createPrivateMediaCache(), error = new Error('network'), blob = picture();
    const load = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(blob);
    await expect(cache.get('image', load)).rejects.toBe(error);
    await expect(cache.get('image', load)).resolves.toBe(blob);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('limpiar borra imágenes y cancela descargas pendientes aunque la red termine después', async () => {
    const cache = createPrivateMediaCache(), request = deferred(), load = vi.fn(() => picture('old'));
    await cache.get('cached', load);
    const pendingLoad = vi.fn(() => request.promise), pending = cache.get('pending', pendingLoad);
    const canceled = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    cache.clear();
    await canceled;
    expect(pendingLoad.mock.calls[0][0].aborted).toBe(true);
    request.resolve(picture('old pending'));
    await Promise.resolve();
    await cache.get('cached', load); await cache.get('pending', load);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('descarta un acierto que todavía no se entregó si la sesión se limpia o el consumidor cancela', async () => {
    const cache = createPrivateMediaCache(), load = vi.fn(() => picture());
    await cache.get('image', load);
    const hit = cache.get('image', load);
    const invalidated = expect(hit).rejects.toMatchObject({ name: 'AbortError' });
    cache.clear();
    await invalidated;
    await cache.get('image', load);
    const controller = new AbortController();
    const canceledHit = cache.get('image', load, { signal: controller.signal });
    const canceled = expect(canceledHit).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await canceled;
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('conserva el error de sesión que provocó la invalidación para todos los consumidores', async () => {
    const cache = createPrivateMediaCache(), request = deferred(), error = Object.assign(new Error('Sesión expirada'), { status: 401 });
    const first = cache.get('first', () => request.promise), second = cache.get('second', () => request.promise);
    const failed = Promise.all([expect(first).rejects.toBe(error), expect(second).rejects.toBe(error)]);
    cache.clear(error);
    await failed;
  });

  it('sólo mantiene bytes y deja la creación y liberación de URLs al consumidor', async () => {
    const createObjectURL = vi.fn(), revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const cache = createPrivateMediaCache(), blob = picture();
    await expect(cache.get('image', () => blob)).resolves.toBe(blob);
    cache.clear();
    expect(createObjectURL).not.toHaveBeenCalled(); expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
