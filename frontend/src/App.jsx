import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import IncidentsPage from './pages/IncidentsPage.jsx';
import ReportIncidentPage from './pages/ReportIncidentPage.jsx';
import IncidentDetailPage from './pages/IncidentDetailPage.jsx';
import PersonnelPage from './pages/PersonnelPage.jsx';
import SpacesPage from './pages/SpacesPage.jsx';
import AdminsPage from './pages/AdminsPage.jsx';
import { isAdminRole, isSuperAdminRole } from './utils/roles.js';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot-screen" role="status">Preparando Gestor Mantenimiento…</div>;
  return isAdminRole(user?.role) ? <AppLayout /> : <Navigate to="/login" replace />;
}
function SuperAdminOnly({ children }) {
  const { user } = useAuth();
  return isSuperAdminRole(user?.role) ? children : <Navigate to="/" replace />;
}
const pageNames = [
  [/^\/login$/, 'Iniciar sesión'], [/^\/$/, 'Dashboard'],
  [/^\/incidencias\/nueva$/, 'Nueva incidencia'], [/^\/incidencias\/\d+$/, 'Detalle de incidencia'],
  [/^\/incidencias$/, 'Incidencias'], [/^\/personal$/, 'Personal'],
  [/^\/espacios$/, 'Espacios'], [/^\/administradores$/, 'Administradores'],
];
function RouteAccessibility() {
  const { pathname } = useLocation();
  useEffect(() => {
    const pageName = pageNames.find(([pattern]) => pattern.test(pathname))?.[1];
    document.title = pageName ? `${pageName} | Gestor Mantenimiento` : 'Gestor Mantenimiento';
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector('main h1, .login-form h1') || document.querySelector('main');
      target?.setAttribute('tabindex', '-1');
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);
  return null;
}
export default function App() {
  return <><RouteAccessibility /><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<Protected />}>
      <Route index element={<DashboardPage />} />
      <Route path="incidencias/nueva" element={<ReportIncidentPage />} />
      <Route path="incidencias" element={<IncidentsPage />} />
      <Route path="incidencias/:id" element={<IncidentDetailPage />} />
      <Route path="personal" element={<PersonnelPage />} />
      <Route path="espacios" element={<SpacesPage />} />
      <Route path="administradores" element={<SuperAdminOnly><AdminsPage /></SuperAdminOnly>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes></>;
}
