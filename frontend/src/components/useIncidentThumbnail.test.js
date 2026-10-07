import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api.js';
import { needsThumbnailMetadata, watchLegacyIncidentThumbnail } from './useIncidentThumbnail.js';

vi.mock('../api.js', () => ({ api: vi.fn() }));

describe('compatibilidad de miniaturas con un listado anterior', () => {
  let intersection;
  let observe;
  let disconnect;
  const initial = { id: 7, category: 'INITIAL', file_type: 'image/png', file_name: 'fuga.png', file_url: '/api/evidences/7/download' };

  beforeEach(() => {
    vi.clearAllMocks();
    observe = vi.fn();
    disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', vi.fn(function (callback) {
      intersection = callback;
      this.observe = observe;
      this.disconnect = disconnect;
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sólo consulta metadata para tarjetas completas de un listado sin el campo nuevo', () => {
    expect(needsThumbnailMetadata({ id: 3 })).toBe(true);
    expect(needsThumbnailMetadata({ id: 3 }, true)).toBe(false);
    expect(needsThumbnailMetadata({ id: 3, initial_evidence: null })).toBe(false);
    expect(needsThumbnailMetadata({ id: 3, initial_evidence: initial })).toBe(false);
    expect(needsThumbnailMetadata({ id: '../otro' })).toBe(false);
  });

  it('espera visibilidad, consulta una vez y elige la primera imagen INITIAL en el orden del detalle', async () => {
    const node = {};
    const receive = vi.fn();
    api.mockResolvedValue({ incident: { id: 3 }, evidences: [{ ...initial, category: 'FINAL' }, { ...initial, file_type: 'application/pdf' }, initial, { ...initial, id: 8 }] });
    const stop = watchLegacyIncidentThumbnail('3', node, receive);
    expect(IntersectionObserver).toHaveBeenCalledWith(expect.any(Function), { rootMargin: '160px' });
    expect(observe).toHaveBeenCalledWith(node);
    intersection([{ target: node, isIntersecting: false }]);
    expect(api).not.toHaveBeenCalled();
    intersection([{ target: node, isIntersecting: true }]);
    intersection([{ target: node, isIntersecting: true }]);
    await vi.waitFor(() => expect(receive).toHaveBeenCalledWith(initial));
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('/incidents/3', { signal: expect.any(AbortSignal) });
    stop();
  });

  it('aborta al retirar la tarjeta y descarta una respuesta tardía', async () => {
    const node = {};
    const receive = vi.fn();
    let finish;
    api.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const stop = watchLegacyIncidentThumbnail('3', node, receive);
    intersection([{ target: node, isIntersecting: true }]);
    const signal = api.mock.calls[0][1].signal;
    stop();
    expect(signal.aborted).toBe(true);
    expect(disconnect).toHaveBeenCalled();
    finish({ incident: { id: 3 }, evidences: [initial] });
    await Promise.resolve();
    expect(receive).not.toHaveBeenCalled();
  });

  it('conserva el fallback cuando no hay foto, el detalle no corresponde o falla la lectura', async () => {
    for (const result of [{ incident: { id: 3 }, evidences: [{ ...initial, file_type: 'application/pdf' }] }, { incident: { id: 99 }, evidences: [initial] }]) {
      const node = {};
      const receive = vi.fn();
      api.mockResolvedValue(result);
      const stop = watchLegacyIncidentThumbnail('3', node, receive);
      intersection([{ target: node, isIntersecting: true }]);
      await Promise.resolve();
      if (result.incident.id === 3) expect(receive).toHaveBeenCalledWith(null);
      else expect(receive).not.toHaveBeenCalled();
      stop();
    }
    const node = {};
    const receive = vi.fn();
    api.mockRejectedValue(new Error('Sin conexión'));
    const stop = watchLegacyIncidentThumbnail('3', node, receive);
    intersection([{ target: node, isIntersecting: true }]);
    await Promise.resolve();
    expect(receive).not.toHaveBeenCalled();
    stop();
  });

  it('mantiene la miniatura si el navegador no dispone de IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const receive = vi.fn();
    api.mockResolvedValue({ incident: { id: 3 }, evidences: [initial] });
    const stop = watchLegacyIncidentThumbnail('3', {}, receive);
    await vi.waitFor(() => expect(receive).toHaveBeenCalledWith(initial));
    expect(api).toHaveBeenCalledTimes(1);
    stop();
  });
});
