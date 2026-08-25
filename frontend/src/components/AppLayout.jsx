import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BusFront, ClipboardList, LayoutDashboard, LogOut, Menu, Users, Bell, X, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import logo from '../img/b1df3d2e-30b9-49e5-b316-773184b30cb2.png';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { api('/notifications').then((d) => setUnread(d.unread)).catch(() => {}); }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [open]);
  const links = user.role === 'ADMIN' ? [
    ['/', 'Dashboard', LayoutDashboard], ['/reportar', 'Reportar daño', PlusCircle], ['/novedades', 'Novedades', ClipboardList], ['/conductores', 'Conductores', Users], ['/buses', 'Buses', BusFront]
  ] : [['/', 'Mi resumen', LayoutDashboard], ['/novedades', 'Mis novedades', ClipboardList], ['/buses', 'Mi bus', BusFront]];
  const section = location.pathname.startsWith('/novedades') ? 'Novedades' : location.pathname.startsWith('/buses') ? 'Flota' : location.pathname.startsWith('/conductores') ? 'Conductores' : location.pathname.startsWith('/reportar') ? 'Nuevo reporte' : location.pathname.startsWith('/notificaciones') ? 'Notificaciones' : 'Dashboard';
  async function signOut() { await logout(); navigate('/login'); }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    {open&&<button type="button" className="sidebar-backdrop" onClick={()=>setOpen(false)} aria-label="Cerrar menú"/>}
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X/></button>
      <div className="brand"><span><img src={logo} alt=""/></span><div><strong>Gestor Rutas</strong><small>Gimnasio Los Arrayanes</small></div></div>
      <nav aria-label="Navegación principal"><p className="nav-label">Operación</p>{links.map(([to,label,Icon]) => <NavLink key={to} to={to} end={to==='/'} onClick={()=>setOpen(false)}><Icon/><span>{label}</span></NavLink>)}</nav>
      <div className="system-status"><i/>Sistema operativo <span>2026</span></div>
      <div className="profile-card"><div className="avatar">{user.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</div><div><strong>{user.name}</strong><small>{user.role === 'ADMIN' ? 'Administrador de flota' : 'Conductor'}</small></div><button onClick={signOut} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={19}/></button></div>
    </aside>
    <div className="app-main">
      <header className="topbar"><button className="menu-button" onClick={()=>setOpen(true)} aria-label="Abrir menú"><Menu/></button><div className="topbar-context"><span>Espacio de trabajo</span><strong>{section}</strong></div><div className="topbar-spacer"/>{user.role==='ADMIN'&&<NavLink to="/reportar" className="topbar-action"><PlusCircle/><span>Crear reporte</span></NavLink>}<NavLink to="/notificaciones" className="notification-button" aria-label={`${unread} notificaciones sin leer`}><Bell/>{unread>0&&<b>{unread}</b>}</NavLink><span className="period"><i/>Año escolar 2026</span></header>
      <main id="main-content"><Outlet context={{ setUnread }}/></main>
    </div>
  </div>;
}
