import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(requireRole('ADMIN'));

router.get('/', asyncHandler(async (req, res) => {
  const [buses, incidents, resolvedDurations, recent] = await Promise.all([
    req.app.locals.db.query(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER(WHERE current_status='OPERATIVO')::int AS operational,
      COUNT(*) FILTER(WHERE current_status IN ('CON_NOVEDADES','EN_MANTENIMIENTO'))::int AS with_issues FROM buses`),
    req.app.locals.db.query(`SELECT COUNT(*) FILTER(WHERE status<>'RESUELTO')::int AS open,
      COUNT(*) FILTER(WHERE status='PENDIENTE_VALIDACION')::int AS pending_validation,
      COUNT(*) FILTER(WHERE status='RESUELTO')::int AS resolved FROM incidents`),
    req.app.locals.db.query(`SELECT reported_at,resolved_at FROM incidents WHERE resolved_at IS NOT NULL`),
    req.app.locals.db.query(`SELECT i.id,i.damage_type,i.urgency,i.status,i.reported_at,b.reference,b.plate,u.name AS driver_name
      FROM incidents i JOIN buses b ON b.id=i.bus_id LEFT JOIN users u ON u.id=i.responsible_driver_id ORDER BY i.reported_at DESC LIMIT 6`)
  ]);
  const durationHours = resolvedDurations.rows.map((item) => (new Date(item.resolved_at) - new Date(item.reported_at)) / 3600000);
  const average = durationHours.length ? Math.round((durationHours.reduce((sum, value) => sum + value, 0) / durationHours.length) * 10) / 10 : 0;
  res.json({ stats: { ...buses.rows[0], ...incidents.rows[0], avg_resolution_hours: average }, recent: recent.rows });
}));

export default router;
