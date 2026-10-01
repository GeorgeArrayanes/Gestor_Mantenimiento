import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { httpError, parseId } from '../utils/maintenance.js';
import { readFile } from '../services/storage.js';

const router = Router();
router.use(requireRole('ADMIN'));
router.get('/:id/download', asyncHandler(async (req, res) => {
  const { rows } = await req.app.locals.db.query(`SELECT e.storage_key,e.file_name,e.file_type FROM maintenance_evidences e JOIN maintenance_incidents i ON i.id=e.incident_id WHERE e.id=$1`, [parseId(req.params.id)]);
  const evidence = rows[0];
  if (!evidence) throw httpError(404, 'Evidencia inexistente.');
  const bytes = await readFile(evidence.storage_key);
  res.set({ 'Content-Type': evidence.file_type, 'Content-Disposition': `attachment; filename="evidencia"; filename*=UTF-8''${encodeURIComponent(evidence.file_name).replaceAll("'", '%27')}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.send(bytes);
}));
export default router;
