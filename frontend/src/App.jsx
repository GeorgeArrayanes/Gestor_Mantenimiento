import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { isAdminRole, isSuperAdminRole } from './utils/roles.js';

const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const IncidentsPage = lazy(() => import('./pages/IncidentsPage.jsx'));
const ReportIncidentPage = lazy(() => import('./pages/ReportIncidentPage.jsx'));
const IncidentDetailPage = lazy(() => import('./pages/IncidentDetailPage.jsx'));
const PersonnelPage = lazy(() => import('./pages/PersonnelPage.jsx'));
const SpacesPage = lazy(() => import('./pages/SpacesPage.jsx'));
const AdminsPage = lazy(() => import('./pages/AdminsPage.jsx'));
const CampusMapPage = lazy(() => import('./pages/CampusMapPage.jsx'));

function focusPageHeading() {
  const frame = window.requestAnimationFrame(() => {
    const target = document.querySelector('main h1, .login-form h1') || document.querySelector('main');
    target?.setAttribute('tabindex', '-1');
    target?.focus({ preventScroll: true });
  });
  return () => window.cancelAnimationFrame(frame);
}

function LoadedPage({ component: Page }) {
  // This effect commits after the lazy module resolves, when its heading exists.
  useEffect(focusPageHeading, [Page]);
  return <Page />;
}

function pageElement(component, label) {
  return <Suspense fallback={<div className="boot-screen" role="status">Preparando {label}…</div>}><LoadedPage component={component} /></Suspense>;
}

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
  [/^\/mapa$/, 'Mapa del colegio'],
];
function RouteAccessibility() {
  const { pathname } = useLocation();
  useEffect(() => {
    const pageName = pageNames.find(([pattern]) => pattern.test(pathname))?.[1];
    document.title = pageName ? `${pageName} | Gestor Mantenimiento` : 'Gestor Mantenimiento';
    return focusPageHeading();
  }, [pathname]);
  return null;
}
export default function App() {
  return <><RouteAccessibility /><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<Protected />}>
      <Route index element={pageElement(DashboardPage, 'el resumen')} />
      <Route path="mapa" element={pageElement(CampusMapPage, 'el mapa del colegio')} />
      <Route path="incidencias/nueva" element={pageElement(ReportIncidentPage, 'el formulario')} />
      <Route path="incidencias" element={pageElement(IncidentsPage, 'las incidencias')} />
      <Route path="incidencias/:id" element={pageElement(IncidentDetailPage, 'la incidencia')} />
      <Route path="personal" element={pageElement(PersonnelPage, 'el personal')} />
      <Route path="espacios" element={pageElement(SpacesPage, 'los espacios')} />
      <Route path="administradores" element={<SuperAdminOnly>{pageElement(AdminsPage, 'los administradores')}</SuperAdminOnly>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes></>;
}
