import { Inbox } from 'lucide-react';
export default function EmptyState({ title = 'No hay información', text = 'Los registros aparecerán aquí.' }) {
  return <div className="empty-state"><Inbox size={34}/><strong>{title}</strong><span>{text}</span></div>;
}
