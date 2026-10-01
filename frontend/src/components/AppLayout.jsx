import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Building2, ClipboardList, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, ShieldCheck, UsersRound, Wrench, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { isSuperAdminRole } from '../utils/roles.js';

export function Brand({ inverse = false }) {
  return <div className={`brand ${inverse ? 'brand-inverse' : ''}`}><span className="brand-mark"><Wrench size={25} strokeWidth={2.2} aria-hidden="true" /><span className="brand-gear">✦</span></span><div className="brand-copy"><strong>Gestor<br />Mantenimiento</strong><small>Gimnasio Los Arrayanes</small></div></div>;
}
const operation = [['/', 'Dashboard', LayoutDashboard], ['/incidencias/nueva', 'Nueva incidencia', Plus], ['/incidencias', 'Incidencias', ClipboardList]];
export default function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return window.localStorage.getItem('mantenimiento-sidebar-collapsed') === 'true'; } catch { return false; } });
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 920px)').matches);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const drawerRef = useRef(null);
  const closeRef = useRef(null);
  const menuRef = useRef(null);
  const mainRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const year = new Date().toLocaleDateString('en', { timeZone: 'America/Bogota', year: 'numeric' });
  const management = [['/personal', 'Personal', UsersRound], ['/espacios', 'Espacios', Building2], ...(isSuperAdminRole(user.role) ? [['/administradores', 'Administradores', ShieldCheck]] : [])];
  const section = location.pathname === '/incidencias/nueva' ? 'Nueva incidencia' : location.pathname.startsWith('/incidencias/') ? 'Detalle de incidencia' : [...operation, ...management].find(([path]) => path === location.pathname)?.[1] || 'Dashboard';
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 920px)');
    const update = event => { setIsMobile(event.matches); if (!event.matches) setOpen(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { try { window.localStorage.setItem('mantenimiento-sidebar-collapsed', String(collapsed)); } catch { /* Storage is optional. */ } }, [collapsed]);
  useEffect(() => {
    if (!open || !isMobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function trap(event) {
      if (event.key === 'Escape') { setOpen(false); menuRef.current?.focus(); return; }
      if (event.key !== 'Tab') return;
      const elements = [...drawerRef.current.querySelectorAll('button:not([disabled]),a[href]')].filter(el => el.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', trap);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', trap); };
  }, [open, isMobile]);
  async function signOut() {
    setSigningOut(true); setLogoutError('');
    try { await logout(); navigate('/login'); }
    catch { setLogoutError('No se pudo cerrar la sesión. Intenta nuevamente.'); }
    finally { setSigningOut(false); }
  }
  const compact = collapsed && !isMobile;
  const navLink = ([path, label, Icon]) => <NavLink key={path} to={path} className={({ isActive }) => isActive || (path === '/incidencias' && /^\/incidencias\/\d+$/.test(location.pathname)) ? 'active' : ''} end={path === '/' || path === '/incidencias'} title={compact ? label : undefined} aria-label={compact ? label : undefined} onClick={() => { setOpen(false); mainRef.current?.focus(); }}><Icon size={19} aria-hidden="true" /><span>{label}</span>{path === '/incidencias/nueva' && !compact && <ArrowUpRight className="nav-trailing" size={15} aria-hidden="true" />}</NavLink>;
  return <div className={`app-shell ${compact ? 'sidebar-collapsed' : ''}`}>
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    {isMobile && open && <button className="sidebar-backdrop" onClick={() => { setOpen(false); menuRef.current?.focus(); }} aria-label="Cerrar menú" />}
    <aside id="navigation-drawer" ref={drawerRef} className={`sidebar ${open ? 'open' : ''} ${compact ? 'collapsed' : ''}`} aria-label="Navegación y cuenta" role={isMobile ? 'dialog' : undefined} aria-modal={isMobile && open ? true : undefined} aria-hidden={isMobile ? !open : undefined} inert={isMobile && !open}>
      <button ref={closeRef} className="mobile-close icon-button" onClick={() => { setOpen(false); menuRef.current?.focus(); }} aria-label="Cerrar menú"><X /></button>
      <div className="sidebar-head"><Brand /></div>
      <nav aria-label="Navegación principal"><div className="nav-heading"><p className="nav-label">Operación</p><button className="sidebar-collapse-button icon-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'} aria-pressed={collapsed}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button></div>{operation.map(navLink)}<div className="nav-heading management-heading"><p className="nav-label">Gestión</p></div>{management.map(navLink)}</nav>
      <div className="sidebar-bottom">{logoutError && <p className="logout-error" role="alert">{logoutError}</p>}<div className="system-status"><i /><span>Sistema operativo</span><small>{year}</small></div><div className="profile-card"><div className="avatar">{user.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div><div className="profile-copy"><strong>{user.name}</strong><small>{isSuperAdminRole(user.role) ? 'Superadministrador' : 'Administrador'}</small></div><button className="icon-button" onClick={signOut} disabled={signingOut} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={18} /></button></div></div>
    </aside>
    <div className="app-main" inert={isMobile && open}><header className="topbar"><button ref={menuRef} className="menu-button icon-button" onClick={() => setOpen(true)} aria-label="Abrir menú" aria-expanded={open} aria-controls="navigation-drawer"><Menu /></button><div className="topbar-context"><span>Centro de mantenimiento</span><strong>{section}</strong></div><div className="topbar-spacer" /><NavLink to="/incidencias/nueva" className="topbar-action"><Plus size={15} /><span>Nueva incidencia</span></NavLink><span className="period"><i />Año escolar {year}</span></header><main id="main-content" ref={mainRef} tabIndex={-1}><Outlet /></main><footer className="workspace-footer"><span>Gimnasio Los Arrayanes</span><span>Cuidamos los espacios donde crecen.</span></footer></div>
  </div>;
}


