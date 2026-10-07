import { ArrowUpRight, ChevronDown, Search, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Avatar({ name, size = 'md', className = '' }) {
  const initials = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return <span className={`ds-avatar ds-avatar-${size} ${className}`} aria-hidden="true">{initials || <UserRound size={18} />}</span>;
}

export function SearchInput({ label, className = '', ...props }) {
  return <label className={`ds-search ${className}`}><span className="visually-hidden">{label}</span><Search size={19} aria-hidden="true" /><input type="search" {...props} /></label>;
}

export function FilterSelect({ label, children, className = '', ...props }) {
  return <label className={`ds-filter ${className}`}><span>{label}</span><select {...props}>{children}</select><ChevronDown size={16} aria-hidden="true" /></label>;
}

export function KpiCard({ label, value, detail, icon: Icon, tone = 'teal', to }) {
  const content = <><span className={`ds-kpi-symbol tone-${tone}`}>{Icon && <Icon size={23} aria-hidden="true" />}</span><span className="ds-kpi-copy"><strong>{value}</strong><span>{label}</span>{detail && <small>{detail}</small>}</span>{to && <ArrowUpRight className="ds-kpi-arrow" size={17} aria-hidden="true" />}</>;
  return to ? <Link className="ds-kpi" to={to}>{content}</Link> : <div className="ds-kpi">{content}</div>;
}

export function SectionPanel({ title, subtitle, action, children, className = '', ...props }) {
  return <section className={`panel ds-panel ${className}`} {...props}>{(title || action) && <div className="ds-panel-heading"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>{action}</div>}{children}</section>;
}

export function FormSection({ number, title, description, children }) {
  return <section className="ds-form-section"><div className="ds-form-heading"><span>{number}</span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>{children}</section>;
}
