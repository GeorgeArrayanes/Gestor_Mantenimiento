import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import IncidentsPage from './pages/IncidentsPage.jsx';
import ReportIncidentPage from './pages/ReportIncidentPage.jsx';
import IncidentDetailPage from './pages/IncidentDetailPage.jsx';
import BusesPage from './pages/BusesPage.jsx';
import BusDetailPage from './pages/BusDetailPage.jsx';
import DriversPage from './pages/DriversPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import AdminsPage from './pages/AdminsPage.jsx';
import { isAdminRole, isSuperAdminRole } from './utils/roles.js';

function Protected(){const {user,loading}=useAuth();if(loading)return <div className="boot-screen">Preparando Gestor Rutas…</div>;return user?<AppLayout/>:<Navigate to="/login" replace/>}
function AdminOnly({children}){const {user}=useAuth();return isAdminRole(user?.role)?children:<Navigate to="/" replace/>}
function SuperAdminOnly({children}){const {user}=useAuth();return isSuperAdminRole(user?.role)?children:<Navigate to="/" replace/>}

const pageNames = [
  [/^\/login$/, 'Iniciar sesión'],
  [/^\/$/, 'Dashboard'],
  [/^\/reportar$/, 'Nuevo reporte'],
  [/^\/novedades\/\d+$/, 'Detalle de novedad'],
  [/^\/novedades$/, 'Novedades'],
  [/^\/buses\/\d+$/, 'Ficha del bus'],
  [/^\/buses$/, 'Buses'],
  [/^\/conductores$/, 'Conductores'],
  [/^\/administradores$/, 'Administradores'],
  [/^\/notificaciones$/, 'Notificaciones'],
];

function RouteAccessibility() {
  const { pathname } = useLocation();
  useEffect(() => {
    const pageName = pageNames.find(([pattern]) => pattern.test(pathname))?.[1] || 'Gestor Rutas';
    document.title = pageName === 'Gestor Rutas' ? pageName : `${pageName} | Gestor Rutas`;
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector('main h1, .login-form h1') || document.querySelector('main');
      if (!target) return;
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);
  return null;
}

export default function App(){return <><RouteAccessibility/><Routes><Route path="/login" element={<LoginPage/>}/><Route element={<Protected/>}><Route index element={<DashboardPage/>}/><Route path="reportar" element={<AdminOnly><ReportIncidentPage/></AdminOnly>}/><Route path="novedades" element={<IncidentsPage/>}/><Route path="novedades/:id" element={<IncidentDetailPage/>}/><Route path="buses" element={<BusesPage/>}/><Route path="buses/:id" element={<BusDetailPage/>}/><Route path="conductores" element={<AdminOnly><DriversPage/></AdminOnly>}/><Route path="administradores" element={<SuperAdminOnly><AdminsPage/></SuperAdminOnly>}/><Route path="notificaciones" element={<NotificationsPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes></>}
