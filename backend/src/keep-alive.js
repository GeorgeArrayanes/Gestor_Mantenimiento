export function startKeepAlive({ url, intervalMs, timeoutMs = 10_000, fetchImpl = fetch, logger = console }) {
  if (!url) return () => {};

  let requestInFlight = false;
  const ping = async () => {
    if (requestInFlight) return;
    requestInFlight = true;
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { 'user-agent': 'gestor-mantenimiento-keep-alive/1.0' },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) logger.warn(`Keep-alive respondió con estado ${response.status}.`);
    } catch (error) {
      logger.warn(`Keep-alive no pudo contactar el servicio: ${error.message}`);
    } finally {
      requestInFlight = false;
    }
  };

  const timer = setInterval(ping, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
