import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, BusFront, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "admin@rutasegura.test",
    password: "RutaSegura2026!",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
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
          <span>
            <ShieldCheck />
          </span>
          <strong>RutaSegura</strong>
        </div>
        <div className="login-message">
          <span className="login-icon">
            <BusFront />
          </span>
          <h1>Cada ruta comienza con un bus seguro.</h1>
          <p>
            Gestiona novedades, reparaciones y evidencias de tu flota escolar en
            un solo lugar.
          </p>
        </div>
        <small>Colegio San Martín · Operaciones 2026</small>
      </section>
      <section className="login-panel">
        <form onSubmit={submit} className="login-form">
          <div>
            <p className="eyebrow">Bienvenido</p>
            <h2>Inicia sesión</h2>
            <p>Ingresa con tu cuenta administrativa o de conductor.</p>
          </div>
          {error && <div className="form-error">{error}</div>}
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
                aria-label="Mostrar contraseña"
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
                Entrar a RutaSegura <ArrowRight />
              </>
            )}
          </button>
          <div className="demo-accounts">
            <strong>Cuentas de demostración</strong>
            <button
              type="button"
              onClick={() =>
                setForm({
                  username: "admin@rutasegura.test",
                  password: "RutaSegura2026!",
                })
              }
            >
              Administrador
            </button>
            <button
              type="button"
              onClick={() =>
                setForm({
                  username: "carlos@rutasegura.test",
                  password: "RutaSegura2026!",
                })
              }
            >
              Conductor
            </button>
          </div>
        </form>
      </section>
      </div>
    </div>
  );
}
