import fs from 'node:fs/promises';
import path from 'node:path';
import { getPool } from '../db.js';
import { config, projectRoot } from '../config.js';

if (config.memoryDb) throw new Error('El modo memoria ya aplica el esquema al crearse. Ejecuta migraciones sólo en una base independiente de Mantenimiento.');
const pool = await getPool();
const migrationsDirectory = path.join(projectRoot, 'database', 'migrations');
const migrations = (await fs.readdir(migrationsDirectory))
  .filter((file) => /^\d+.*\.sql$/i.test(file))
  .sort((left, right) => left.localeCompare(right));

const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(74639102)');
  await client.query(`
  CREATE SCHEMA IF NOT EXISTS private;
  CREATE TABLE IF NOT EXISTS private.schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`);

  for (const migration of migrations) {
    const alreadyApplied = await client.query('SELECT 1 FROM private.schema_migrations WHERE name=$1', [migration]);
    if (alreadyApplied.rowCount) {
      console.log(`Migración ${migration} ya aplicada.`);
      continue;
    }
    const sql = await fs.readFile(path.join(migrationsDirectory, migration), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO private.schema_migrations(name) VALUES($1)', [migration]);
      await client.query('COMMIT');
      console.log(`Migración ${migration} aplicada correctamente.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  try { await client.query('SELECT pg_advisory_unlock(74639102)'); }
  finally { client.release(); await pool.end(); }
}
