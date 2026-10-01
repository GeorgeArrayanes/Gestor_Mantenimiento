import { Inbox } from 'lucide-react';
export default function EmptyState({ title = 'No hay información', text = 'Los registros aparecerán aquí.', icon: Icon = Inbox, action }) {
  return <div className="empty-state" role="status" aria-live="polite"><span className="empty-icon"><Icon size={28} aria-hidden="true" /></span><strong>{title}</strong><span>{text}</span>{action}</div>;
}
