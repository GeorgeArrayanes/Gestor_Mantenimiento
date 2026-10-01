import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { incidentSelect, publicIncident } from '../services/incident-service.js';

const router = Router();
router.use(requireRole('ADMIN'));
router.get('/', asyncHandler(async (req, res) => {
  const [incidents, recent] = await Promise.all([
    req.app.locals.db.query('SELECT status,created_at,closed_at FROM maintenance_incidents'),
    req.app.locals.db.query(`${incidentSelect} ORDER BY i.created_at DESC,i.id DESC LIMIT 6`)
  ]);
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' });
  const currentMonth = month.format(new Date());
  const closed = incidents.rows.filter((i) => i.status === 'CLOSED' && i.closed_at);
  const durations = closed.map((i) => (new Date(i.closed_at) - new Date(i.created_at)) / 3600000)
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  res.json({ stats: {
    pending: incidents.rows.filter((i) => i.status === 'PENDING').length,
    assigned: incidents.rows.filter((i) => i.status === 'ASSIGNED').length,
    closedThisMonth: closed.filter((i) => month.format(new Date(i.closed_at)) === currentMonth).length,
    averageResolutionHours: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null
  }, recent: recent.rows.map(publicIncident) });
}));
export default router;
