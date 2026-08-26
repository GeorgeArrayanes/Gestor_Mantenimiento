export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return <div role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'} aria-atomic="true"><button type="button" className={`toast ${toast.type || 'success'}`} onClick={onClose} aria-label={`Cerrar mensaje: ${toast.message}`}>{toast.message}</button></div>;
}
