import fs from 'node:fs/promises';
import path from 'node:path';
import { getPool } from '../db.js';

const pool = await getPool();
const migrationsDirectory = path.resolve(process.cwd(), '..', 'database', 'migrations');
const migrations = (await fs.readdir(migrationsDirectory))
  .filter((file) => /^\d+.*\.sql$/i.test(file))
  .sort((left, right) => left.localeCompare(right));

await pool.query(`
  CREATE SCHEMA IF NOT EXISTS private;
  CREATE TABLE IF NOT EXISTS private.schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`);

for (const migration of migrations) {
  const alreadyApplied = await pool.query(
    'SELECT 1 FROM private.schema_migrations WHERE name=$1',
    [migration]
  );
  if (alreadyApplied.rowCount) {
    console.log(`Migración ${migration} ya aplicada.`);
    continue;
  }
  const sql = await fs.readFile(path.join(migrationsDirectory, migration), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO private.schema_migrations(name) VALUES($1)', [migration]);
    await client.query('COMMIT');
    console.log(`Migración ${migration} aplicada correctamente.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
await pool.end();
