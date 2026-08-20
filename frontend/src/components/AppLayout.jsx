import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BusFront, ClipboardList, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, Bell, X, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { api('/notifications').then((d) => setUnread(d.unread)).catch(() => {}); }, [location.pathname]);
  const links = user.role === 'ADMIN' ? [
    ['/', 'Dashboard', LayoutDashboard], ['/reportar', 'Reportar daño', PlusCircle], ['/novedades', 'Novedades', ClipboardList], ['/conductores', 'Conductores', Users], ['/buses', 'Buses', BusFront]
  ] : [['/', 'Mi resumen', LayoutDashboard], ['/novedades', 'Mis novedades', ClipboardList], ['/buses', 'Mi bus', BusFront]];
  async function signOut() { await logout(); navigate('/login'); }
  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X/></button>
      <div className="brand"><span><ShieldCheck/></span><div><strong>RutaSegura</strong><small>Colegio San Martín</small></div></div>
      <nav>{links.map(([to,label,Icon]) => <NavLink key={to} to={to} end={to==='/'} onClick={()=>setOpen(false)}><Icon/>{label}</NavLink>)}</nav>
      <div className="profile-card"><div className="avatar">{user.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</div><div><strong>{user.name}</strong><small>{user.role === 'ADMIN' ? 'Administrador de flota' : 'Conductor'}</small></div><button onClick={signOut} title="Cerrar sesión"><LogOut size={19}/></button></div>
    </aside>
    <div className="app-main">
      <header className="topbar"><button className="menu-button" onClick={()=>setOpen(true)} aria-label="Abrir menú"><Menu/></button><div className="topbar-spacer"/><NavLink to="/notificaciones" className="notification-button" aria-label={`${unread} notificaciones sin leer`}><Bell/>{unread>0&&<b>{unread}</b>}</NavLink><span className="period">Año escolar 2026</span></header>
      <main><Outlet context={{ setUnread }}/></main>
    </div>
  </div>;
}
