import pg from 'pg';
import { newDb } from 'pg-mem';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

let sharedPool;

export async function createMemoryPool() {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  const schema = await fs.readFile(path.resolve(process.cwd(), '..', 'database', 'migrations', '001_init.sql'), 'utf8');
  await pool.query(schema);
  return pool;
}

export async function getPool() {
  if (sharedPool) return sharedPool;
  if (config.memoryDb) {
    sharedPool = await createMemoryPool();
    return sharedPool;
  }
  if (!config.databaseUrl) throw new Error('DATABASE_URL no está configurada.');
  sharedPool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : false
  });
  await sharedPool.query('SELECT 1');
  return sharedPool;
}

export function setPool(pool) {
  sharedPool = pool;
}
