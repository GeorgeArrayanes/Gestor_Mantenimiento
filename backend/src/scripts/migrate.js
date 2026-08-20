import fs from 'node:fs/promises';
import path from 'node:path';
import { getPool } from '../db.js';

const pool = await getPool();
const sql = await fs.readFile(path.resolve(process.cwd(), '..', 'database', 'migrations', '001_init.sql'), 'utf8');
await pool.query(sql);
console.log('Migración 001_init aplicada correctamente.');
await pool.end();
