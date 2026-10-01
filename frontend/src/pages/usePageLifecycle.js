import { useCallback, useEffect, useRef } from 'react';

// Cancel stale reads and avoid navigation or feedback from a page already left.
export default function usePageLifecycle() {
  const mounted = useRef(false);
  const request = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.abort(); };
  }, []);
  const startRequest = useCallback(() => {
    request.current?.abort();
    request.current = new AbortController();
    return request.current.signal;
  }, []);
  return { mounted, startRequest };
}
