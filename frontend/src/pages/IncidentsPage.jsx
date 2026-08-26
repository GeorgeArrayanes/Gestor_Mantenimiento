import { useEffect, useState } from "react";
import { Filter, Plus, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { formatDamageType, formatDate } from "../utils/formatters.js";

export default function IncidentsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [buses, setBuses] = useState([]);
  const [busError, setBusError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "",
    urgency: searchParams.get("urgency") || "",
    bus_id: searchParams.get("bus_id") || "",
    order: searchParams.get("order") || "newest",
  });
  useEffect(() => {
    setBusError("");
    api("/buses")
      .then((d) => setBuses(d.buses))
      .catch(() => setBusError("No pudimos cargar la lista de buses. El resto de filtros sigue disponible."));
  }, [reloadKey]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const q = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v),
      );
      api(`/incidents?${q}`, { signal: controller.signal })
        .then((d) => {
          if (active) setItems(d.incidents);
        })
        .catch((e) => {
          if (active && e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      active = false;
      controller.abort();
    };
  }, [filters, reloadKey]);
  const hasFilters = Boolean(
    filters.search || filters.status || filters.urgency || filters.bus_id || filters.order !== "newest",
  );
  function clearFilters() {
    setFilters({ search: "", status: "", urgency: "", bus_id: "", order: "newest" });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Seguimiento</p>
          <h1>
            {user.role === "ADMIN" ? "Novedades de la flota" : "Mis novedades"}
          </h1>
          <p>Consulta el estado, la urgencia y el historial de cada reporte.</p>
        </div>
        {user.role === "ADMIN" && (
          <Link to="/reportar" className="primary-button">
            <Plus />
            Nuevo reporte
          </Link>
        )}
      </div>
      <section className="panel" aria-busy={loading}>
        <div className="filter-bar">
          <label className="search-box">
            <Search />
            <input
              aria-label="Buscar novedades"
              placeholder="Buscar por ID, bus, placa o descripción"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </label>
          <div className="filter-select">
            <Filter />
            <select
              aria-label="Filtrar por estado"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">Todos los estados</option>
              <option value="REPORTADO">Reportado</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="PENDIENTE_VALIDACION">Por validar</option>
              <option value="REQUIERE_CORRECCION">Requiere corrección</option>
              <option value="RESUELTO">Resuelto</option>
            </select>
          </div>
          <select
            aria-label="Filtrar por urgencia"
            value={filters.urgency}
            onChange={(e) =>
              setFilters({ ...filters, urgency: e.target.value })
            }
          >
            <option value="">Toda urgencia</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </select>
          <select
            aria-label="Filtrar por bus"
            value={filters.bus_id}
            onChange={(e) => setFilters({ ...filters, bus_id: e.target.value })}
          >
            <option value="">Todos los buses</option>
            {buses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.reference} · {b.plate}
              </option>
            ))}
          </select>
          <select
            aria-label="Ordenar novedades"
            value={filters.order}
            onChange={(e) => setFilters({ ...filters, order: e.target.value })}
          >
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguas</option>
          </select>
        </div>
        <div className="filter-summary" aria-live="polite">
          <span>{loading ? "Actualizando resultados…" : `${items.length} ${items.length === 1 ? "resultado" : "resultados"}`}</span>
          {hasFilters && <button type="button" className="text-button" onClick={clearFilters}>Limpiar filtros</button>}
        </div>
        {busError && <div className="page-notice" role="status">{busError}</div>}
        {error && <div className="page-error" role="alert">{error} <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Reintentar</button></div>}
        {loading ? (
          <div className="loading-page compact" role="status">Cargando novedades…</div>
        ) : items.length ? (
          <div className="table-wrap" role="region" aria-label="Listado de novedades" tabIndex="0">
            <table>
              <caption className="sr-only">Novedades filtradas de la flota</caption>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Bus / placa</th>
                  <th scope="col">Tipo de daño</th>
                  <th scope="col">Urgencia</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Conductor</th>
                  <th scope="col">Fecha</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td data-label="ID">
                      <b>#{i.id}</b>
                    </td>
                    <td data-label="Bus / placa">
                      <b>{i.reference}</b>
                      <small>{i.plate}</small>
                    </td>
                    <td data-label="Tipo de daño">{formatDamageType(i.damage_type, i.other_damage_type)}</td>
                    <td data-label="Urgencia">
                      <StatusBadge value={i.urgency} urgency />
                    </td>
                    <td data-label="Estado">
                      <StatusBadge value={i.status} />
                    </td>
                    <td data-label="Conductor">{i.driver_name || "Sin asignar"}</td>
                    <td data-label="Fecha">
                      <time dateTime={i.reported_at}>{formatDate(i.reported_at, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}</time>
                    </td>
                    <td data-label="Acciones">
                      <Link to={`/novedades/${i.id}`}>Ver detalle</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No encontramos novedades"
            text="Prueba cambiando los filtros de búsqueda."
          />
        )}
      </section>
    </>
  );
}
