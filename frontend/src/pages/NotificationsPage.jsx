import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { api } from "../api.js";
import EmptyState from "../components/EmptyState.jsx";
import { formatDate } from "../utils/formatters.js";

export default function NotificationsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const { setUnread } = useOutletContext();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await api("/notifications");
      setData(next);
      setUnread(next.unread);
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [setUnread]);

  useEffect(() => {
    load();
  }, [load]);

  async function openNotification(event, item) {
    event.preventDefault();
    if (busy) return;
    setBusy(`read-${item.id}`);
    setError("");
    try {
      if (!item.is_read) {
        await api(`/notifications/${item.id}/read`, { method: "PATCH" });
        setData((current) => ({
          ...current,
          unread: Math.max(0, current.unread - 1),
          notifications: current.notifications.map((notification) =>
            notification.id === item.id ? { ...notification, is_read: true } : notification,
          ),
        }));
        setUnread((current) => Math.max(0, current - 1));
      }
      if (item.reference_url) navigate(item.reference_url);
    } catch (readError) {
      setError(readError.message);
    } finally {
      setBusy("");
    }
  }

  async function markAllAsRead() {
    if (busy) return;
    setBusy("all");
    setError("");
    try {
      await api("/notifications/read-all", { method: "POST" });
      setData((current) => ({
        ...current,
        unread: 0,
        notifications: current.notifications.map((notification) => ({ ...notification, is_read: true })),
      }));
      setUnread(0);
    } catch (readError) {
      setError(readError.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Centro de avisos</p>
          <h1>Notificaciones</h1>
          <p>Cambios de estado y novedades que requieren tu atención.</p>
        </div>
        {data?.unread > 0 && (
          <button className="secondary-button" onClick={markAllAsRead} disabled={Boolean(busy)}>
            <CheckCheck />
            {busy === "all" ? "Marcando…" : "Marcar todas como leídas"}
          </button>
        )}
      </div>
      <section className="panel" aria-busy={!data && !error}>
        {error && (
          <div className="page-error" role="alert">
            {error}
            {!data && <button type="button" onClick={load}>Reintentar</button>}
          </div>
        )}
        {!data && !error ? (
          <div className="loading-page compact" role="status">Cargando notificaciones…</div>
        ) : data?.notifications.length ? (
          <div className="notification-list">
            {data.notifications.map((notification) => {
              const row = (
                <>
                  <span aria-hidden="true"><Bell /></span>
                  <div>
                    <strong>{notification.message}</strong>
                    <small>
                      <span className="sr-only">{notification.is_read ? "Leída. " : "Sin leer. "}</span>
                      <time dateTime={notification.created_at}>{formatDate(notification.created_at, { dateStyle: "medium", timeStyle: "short" })}</time>
                    </small>
                  </div>
                  {!notification.is_read && <i aria-hidden="true" />}
                </>
              );
              return notification.reference_url ? (
                <Link
                  to={notification.reference_url}
                  key={notification.id}
                  className={notification.is_read ? "read" : ""}
                  onClick={(event) => openNotification(event, notification)}
                  aria-busy={busy === `read-${notification.id}`}
                >
                  {row}
                </Link>
              ) : (
                <button
                  type="button"
                  key={notification.id}
                  className={`notification-row ${notification.is_read ? "read" : ""}`}
                  onClick={(event) => openNotification(event, notification)}
                  aria-busy={busy === `read-${notification.id}`}
                >
                  {row}
                </button>
              );
            })}
          </div>
        ) : data ? (
          <EmptyState title="Todo al día" text="No tienes notificaciones por ahora." />
        ) : null}
      </section>
    </>
  );
}
