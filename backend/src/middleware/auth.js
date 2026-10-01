import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { isAdminRole, roleCanAccess } from '../utils/roles.js';

export async function authenticate(req, res, next) {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  const token = bearer || req.cookies?.mantenimiento_token;
  if (!token) return res.status(401).json({ message: 'Debes iniciar sesión.' });
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: 'gestor-mantenimiento', audience: 'mantenimiento-admin' });
    const { rows } = await req.app.locals.db.query('SELECT id,name,role,status FROM users WHERE id=$1', [decoded.id]);
    if (!rows[0] || rows[0].status !== 'ACTIVO') return res.status(401).json({ message: 'Tu cuenta no está activa.' });
    if (!isAdminRole(rows[0].role)) return res.status(403).json({ message: 'Esta aplicación requiere una cuenta administrativa.' });
    if (!bearer && !['GET','HEAD','OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if ((origin && origin !== config.frontendUrl) || (!origin && config.nodeEnv === 'production')) return res.status(403).json({ message: 'Origen de solicitud no autorizado.' });
    }
    req.user = { id: rows[0].id, name: rows[0].name, role: rows[0].role };
    next();
  } catch {
    return res.status(401).json({ message: 'La sesión expiró. Inicia sesión nuevamente.' });
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!roleCanAccess(req.user.role, roles)) return res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
  next();
};
