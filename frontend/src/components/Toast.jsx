import { useEffect, useRef } from 'react';

export default function Toast({ toast, onClose }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => closeRef.current?.(), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  if (!toast) return null;
  const isError = toast.type === 'error';
  return <div role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'} aria-atomic="true"><button type="button" className={`toast ${toast.type || 'success'}`} onClick={onClose} aria-label={`Cerrar mensaje: ${toast.message}`}>{toast.message}</button></div>;
}
