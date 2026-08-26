import { Inbox } from 'lucide-react';
export default function EmptyState({ title = 'No hay información', text = 'Los registros aparecerán aquí.' }) {
  return <div className="empty-state" role="status" aria-live="polite"><Inbox size={34} aria-hidden="true"/><strong>{title}</strong><span>{text}</span></div>;
}
