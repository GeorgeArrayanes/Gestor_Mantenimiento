export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  return <button className={`toast ${toast.type || 'success'}`} onClick={onClose} aria-label="Cerrar mensaje">{toast.message}</button>;
}
