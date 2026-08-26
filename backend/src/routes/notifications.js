import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    req.app.locals.db.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id]),
    req.app.locals.db.query('SELECT COUNT(*)::int AS total FROM notifications WHERE user_id=$1 AND is_read=FALSE', [req.user.id]),
  ]);
  res.json({ notifications: items.rows, unread: unread.rows[0]?.total || 0 });
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const { rows } = await req.app.locals.db.query('UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2 RETURNING *', [req.params.id,req.user.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Notificación inexistente.' });
  res.json({ notification: rows[0] });
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  await req.app.locals.db.query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1', [req.user.id]);
  res.json({ message: 'Notificaciones marcadas como leídas.' });
}));

export default router;
