import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BusFront, ClipboardList, LayoutDashboard, LogOut, Menu, Users, Bell, X, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import logo from '../img/b1df3d2e-30b9-49e5-b316-773184b30cb2.png';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 920px)').matches);
  const [unread, setUnread] = useState(0);
  const drawerRef = useRef(null);
  const drawerCloseRef = useRef(null);
  const menuButtonRef = useRef(null);
  const mainRef = useRef(null);
  const openRef = useRef(false);
  const returnFocusRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { api('/notifications').then((d) => setUnread(d.unread)).catch(() => {}); }, [location.pathname]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 920px)');
    const handleChange = (event) => {
      setIsMobile(event.matches);
      if (!event.matches && openRef.current) {
        openRef.current = false;
        mainRef.current?.focus({ preventScroll: true });
        setOpen(false);
      }
    };
    setIsMobile(media.matches);
    if (media.addEventListener) media.addEventListener('change', handleChange);
    else media.addListener(handleChange);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', handleChange);
      else media.removeListener(handleChange);
    };
  }, []);
  useEffect(() => { openRef.current = false; setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open || !isMobile) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusDrawer = window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
    const handleKeyDown = (event) => {
      const drawer = drawerRef.current;
      if (!drawer) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(drawer.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusDrawer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, isMobile]);
  function openDrawer() {
    if (!isMobile) return;
    returnFocusRef.current = document.activeElement;
    openRef.current = true;
    setOpen(true);
  }
  function closeDrawer({ restoreFocus = true, focusMain = false } = {}) {
    const returnTarget = focusMain ? mainRef.current : (returnFocusRef.current || menuButtonRef.current);
    if ((restoreFocus || focusMain) && returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
    openRef.current = false;
    setOpen(false);
  }
  const links = user.role === 'ADMIN' ? [
    ['/', 'Dashboard', LayoutDashboard], ['/reportar', 'Reportar daño', PlusCircle], ['/novedades', 'Novedades', ClipboardList], ['/conductores', 'Conductores', Users], ['/buses', 'Buses', BusFront]
  ] : [['/', 'Mi resumen', LayoutDashboard], ['/novedades', 'Mis novedades', ClipboardList], ['/buses', 'Mi bus', BusFront]];
  const section = location.pathname.startsWith('/novedades') ? 'Novedades' : location.pathname.startsWith('/buses') ? 'Flota' : location.pathname.startsWith('/conductores') ? 'Conductores' : location.pathname.startsWith('/reportar') ? 'Nuevo reporte' : location.pathname.startsWith('/notificaciones') ? 'Notificaciones' : 'Dashboard';
  async function signOut() { await logout(); navigate('/login'); }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    {isMobile&&open&&<button type="button" className="sidebar-backdrop" onClick={()=>closeDrawer()} aria-label="Cerrar menú"/>}
    <aside id="primary-navigation-drawer" ref={drawerRef} className={`sidebar ${open ? 'open' : ''}`} aria-label="Navegación y cuenta" aria-hidden={isMobile ? !open : undefined} inert={isMobile && !open}>
      <button ref={drawerCloseRef} type="button" className="mobile-close" onClick={() => closeDrawer()} aria-label="Cerrar menú"><X aria-hidden="true"/></button>
      <div className="brand"><span><img src={logo} alt=""/></span><div><strong>Gestor Rutas</strong><small>Gimnasio Los Arrayanes</small></div></div>
      <nav aria-label="Navegación principal"><p className="nav-label">Operación</p>{links.map(([to,label,Icon]) => <NavLink key={to} to={to} end={to==='/'} onClick={()=>closeDrawer({restoreFocus:false,focusMain:true})}><Icon aria-hidden="true"/><span>{label}</span></NavLink>)}</nav>
      <div className="system-status"><i/>Sistema operativo <span>2026</span></div>
      <div className="profile-card"><div className="avatar">{user.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</div><div><strong>{user.name}</strong><small>{user.role === 'ADMIN' ? 'Administrador de flota' : 'Conductor'}</small></div><button onClick={signOut} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={19}/></button></div>
    </aside>
    <div className="app-main">
      <header className="topbar"><button ref={menuButtonRef} type="button" className="menu-button" onClick={openDrawer} aria-label="Abrir menú" aria-expanded={open} aria-controls="primary-navigation-drawer"><Menu aria-hidden="true"/></button><div className="topbar-context"><span>Espacio de trabajo</span><strong>{section}</strong></div><div className="topbar-spacer"/>{user.role==='ADMIN'&&<NavLink to="/reportar" className="topbar-action"><PlusCircle aria-hidden="true"/><span>Crear reporte</span></NavLink>}<NavLink to="/notificaciones" className="notification-button" aria-label={`${unread} notificaciones sin leer`}><Bell aria-hidden="true"/>{unread>0&&<b aria-hidden="true">{unread}</b>}</NavLink><span className="period"><i/>Año escolar 2026</span></header>
      <main id="main-content" ref={mainRef} tabIndex={-1}><Outlet context={{ setUnread }}/></main>
    </div>
  </div>;
}
