import { Navigate, Route, Routes } from 'react-router-dom';
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

function Protected(){const {user,loading}=useAuth();if(loading)return <div className="boot-screen">Preparando RutaSegura…</div>;return user?<AppLayout/>:<Navigate to="/login" replace/>}
function AdminOnly({children}){const {user}=useAuth();return user?.role==='ADMIN'?children:<Navigate to="/" replace/>}
export default function App(){return <Routes><Route path="/login" element={<LoginPage/>}/><Route element={<Protected/>}><Route index element={<DashboardPage/>}/><Route path="reportar" element={<AdminOnly><ReportIncidentPage/></AdminOnly>}/><Route path="novedades" element={<IncidentsPage/>}/><Route path="novedades/:id" element={<IncidentDetailPage/>}/><Route path="buses" element={<BusesPage/>}/><Route path="buses/:id" element={<BusDetailPage/>}/><Route path="conductores" element={<AdminOnly><DriversPage/></AdminOnly>}/><Route path="notificaciones" element={<NotificationsPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes>}
