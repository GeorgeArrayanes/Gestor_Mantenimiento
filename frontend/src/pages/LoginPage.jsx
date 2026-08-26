import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import logo from "../img/b1df3d2e-30b9-49e5-b316-773184b30cb2.png";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  if (loading) return <div className="boot-screen" role="status">Comprobando sesión…</div>;
  if (user) return <Navigate to="/" replace />;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-card">
      <section className="login-visual">
        <div className="login-brand">
          <img src={logo} alt="" className="login-logo" />
        </div>
        <div className="login-message">
          <p className="login-product"><strong>Gestor Rutas</strong></p>
          <p className="login-hero-title">
            Gestiona novedades, reparaciones y evidencias de tu flota escolar en
            un solo lugar.
          </p>
        </div>
        <small>Gimnasio Los Arrayanes Bilingüe · 2026</small>
      </section>
      <section className="login-panel">
        <form onSubmit={submit} className="login-form">
          <div>
            <p className="eyebrow">Bienvenido</p>
            <h1>Inicia sesión</h1>
            <p>Ingresa con tu cuenta administrativa o de conductor.</p>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <label>
            Correo o usuario
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Contraseña
            <div className="password-field">
              <input
                type={show ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={show}
              >
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          <button className="primary-button wide" disabled={busy}>
            {busy ? (
              "Ingresando…"
            ) : (
              <>
                Entrar a Gestor Rutas <ArrowRight />
              </>
            )}
          </button>
        </form>
      </section>
      </div>
    </div>
  );
}
