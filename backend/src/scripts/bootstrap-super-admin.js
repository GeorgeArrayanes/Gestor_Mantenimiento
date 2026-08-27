import { getPool } from '../db.js';
import { bootstrapSuperAdmin } from '../seed.js';

const pool = await getPool();
await bootstrapSuperAdmin(pool);
console.log('Cuenta de superadministrador verificada correctamente.');
await pool.end();
