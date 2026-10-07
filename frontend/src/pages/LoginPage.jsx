import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Brand } from '../components/AppLayout.jsx';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  if (loading) return <div className="boot-screen" role="status">Comprobando sesión…</div>;
  if (user) return <Navigate to="/" replace />;
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try { await login(form); navigate('/'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="login-page"><Wrench className="login-background-icon" aria-hidden="true" /><div className="login-card"><section className="login-visual" aria-label="Gestor Mantenimiento"><Brand inverse /><div className="login-visual-rule" /><div className="login-message"><span className="login-kicker">Cada espacio cuenta</span><h2>Infraestructura<br />que impulsa{' '}<br /><em>el aprendizaje.</em></h2><p>Gestiona incidencias y mantenimiento de las instalaciones escolares en un solo lugar.</p></div><small>Gimnasio Los Arrayanes · {new Date().getFullYear()}</small></section><section className="login-panel"><form onSubmit={submit} className="login-form"><div className="login-heading"><p className="eyebrow">Bienvenido</p><h1>Inicia sesión</h1><p>Ingresa con tu cuenta administrativa.</p></div>{error && <div className="form-error" role="alert">{error}</div>}<label htmlFor="username">Correo o usuario</label><div className="login-input"><Mail size={18} aria-hidden="true" /><input id="username" name="username" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} autoComplete="username" placeholder="Tu correo institucional" required disabled={busy} /></div><label htmlFor="password">Contraseña</label><div className="login-input password-field"><LockKeyhole size={18} aria-hidden="true" /><input id="password" name="password" type={show ? 'text' : 'password'} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} autoComplete="current-password" placeholder="Ingresa tu contraseña" required disabled={busy} /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={show}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p className="login-help">¿Necesitas acceso? Contacta al administrador del sistema.</p><button className="primary-button wide login-submit" disabled={busy}>{busy ? 'Ingresando…' : <>Entrar a Gestor Mantenimiento <ArrowRight size={18} /></>}</button><div className="login-security"><ShieldCheck size={16} aria-hidden="true" /><span>Acceso exclusivo para el equipo administrativo</span></div></form><div className="login-panel-footer">Centro de Mantenimiento <span>GLA</span></div></section></div><p className="login-page-footer">Gestor Mantenimiento · Gimnasio Los Arrayanes</p></main>;
}
