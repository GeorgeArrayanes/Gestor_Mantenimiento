import { getPool } from '../db.js';
import { seedDatabase } from '../seed.js';

const pool = await getPool();
await seedDatabase(pool);
console.log('Datos de desarrollo creados.');
await pool.end();
