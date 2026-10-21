const aborted = () => new DOMException('La solicitud fue cancelada.', 'AbortError');

// Blobs only: no persisted data or object URLs. The caller owns its preview URL.
export function createPrivateMediaCache({ maxBytes = 12 * 1024 * 1024, maxEntries = 32, ttl = 60_000, canCache = () => true } = {}) {
  const entries = new Map();
  const pending = new Map();
  let bytes = 0;
  let generation = 0;

  function remove(key) {
    const entry = entries.get(key);
    if (entry) bytes -= entry.blob.size;
    entries.delete(key);
  }

  function clear(reason) {
    generation += 1;
    entries.clear();
    bytes = 0;
    for (const entry of pending.values()) entry.controller.abort(reason);
    pending.clear();
  }

  function subscribe(entry, signal) {
    entry.consumers += 1;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', cancel);
        entry.controller.signal.removeEventListener('abort', cancelEntry);
        entry.consumers -= 1;
        if (!entry.consumers && !entry.completed) entry.controller.abort();
        callback(value);
      };
      const cancel = () => finish(reject, aborted());
      const cancelEntry = () => finish(reject, entry.controller.signal.reason || aborted());
      signal?.addEventListener('abort', cancel, { once: true });
      entry.controller.signal.addEventListener('abort', cancelEntry, { once: true });
      if (signal?.aborted) cancel();
      else if (entry.controller.signal.aborted) cancelEntry();
      entry.promise.then((blob) => {
        if (generation !== entry.version) finish(reject, aborted());
        else finish(resolve, blob);
      }, (error) => finish(reject, error));
    });
  }

  function get(key, load, { signal } = {}) {
    if (signal?.aborted) return Promise.reject(aborted());
    const now = Date.now();
    for (const [name, entry] of entries) if (entry.expiresAt <= now) remove(name);
    const cached = entries.get(key);
    if (cached) {
      const version = generation;
      entries.delete(key);
      entries.set(key, cached);
      return Promise.resolve(cached.blob).then((blob) => {
        if (signal?.aborted || generation !== version) throw aborted();
        return blob;
      });
    }
    let entry = pending.get(key);
    if (entry?.controller.signal.aborted) { pending.delete(key); entry = null; }
    if (!entry) {
      const version = generation;
      entry = { controller: new AbortController(), consumers: 0, completed: false, version, promise: null };
      const current = entry;
      entry.promise = Promise.resolve().then(() => {
        if (current.controller.signal.aborted) throw aborted();
        return load(current.controller.signal);
      }).then((blob) => {
        if (generation !== version || current.controller.signal.aborted) throw aborted();
        if (maxEntries > 0 && blob.size > 0 && blob.size <= maxBytes && canCache(blob)) {
          while (entries.size >= maxEntries || bytes + blob.size > maxBytes) remove(entries.keys().next().value);
          entries.set(key, { blob, expiresAt: Date.now() + ttl });
          bytes += blob.size;
        }
        return blob;
      }).finally(() => {
        current.completed = true;
        if (pending.get(key) === current) pending.delete(key);
      });
      pending.set(key, entry);
    }
    return subscribe(entry, signal);
  }

  return { get, clear };
}
