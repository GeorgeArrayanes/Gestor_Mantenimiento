import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config, projectRoot } from './config.js';

let sharedPool;

export async function createMemoryPool() {
  const { newDb } = await import('pg-mem');
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  for (const file of ['001_init.sql', '002_super_admin.sql', '003_maintenance.sql', '004_directory_images.sql', '005_campus_regions.sql', '006_individual_campus_blocks.sql']) {
    let sql = await fs.readFile(path.join(projectRoot, 'database', 'migrations', file), 'utf8');
    // PostgreSQL gives this unnamed UNIQUE the name used by migration 006.
    // pg-mem generates a hash instead; use the real PostgreSQL name in memory.
    if (file === '003_maintenance.sql') sql = sql.replace('UNIQUE(name,zone)', 'CONSTRAINT maintenance_spaces_name_zone_key UNIQUE(name,zone)');
    await pool.query(sql);
  }
  // pg-mem ignores transactions: snapshots and serialization provide faithful
  // rollback and concurrent transition behavior for ephemeral development/tests.
  let tail = Promise.resolve();
  async function acquire() {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    return release;
  }
  const rawQuery = pool.query.bind(pool);
  pool.query = async (...args) => {
    const release = await acquire();
    try { return await rawQuery(...args); } finally { release(); }
  };
  pool.connect = async () => {
    const client = new adapter.Client();
    const query = client.query.bind(client);
    const releaseClient = client.release.bind(client);
    let unlock;
    let backup;
    client.query = async (sql, ...args) => {
      const command = typeof sql === 'string' ? sql.trim().toUpperCase() : '';
      if (command === 'BEGIN') {
        unlock = await acquire();
        backup = memory.backup();
        return query(sql, ...args);
      }
      if (command === 'COMMIT' || command === 'ROLLBACK') {
        try {
          if (command === 'ROLLBACK' && backup) backup.restore();
          return await query(sql, ...args);
        } finally { backup = undefined; unlock?.(); unlock = undefined; }
      }
      if (unlock) return query(sql, ...args);
      const release = await acquire();
      try { return await query(sql, ...args); } finally { release(); }
    };
    client.release = () => { if (backup) backup.restore(); backup = undefined; unlock?.(); unlock = undefined; releaseClient(); };
    return client;
  };
  return pool;
}

export async function getPool() {
  if (sharedPool) return sharedPool;
  if (config.memoryDb) {
    if (config.nodeEnv === 'production') throw new Error('El modo memoria no está permitido en producción.');
    sharedPool = await createMemoryPool();
  } else {
    if (!config.databaseUrl) throw new Error('DATABASE_URL no está configurada.');
    sharedPool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl
        ? {
            rejectUnauthorized: config.databaseSslRejectUnauthorized,
            ...(config.databaseSslCa ? { ca: config.databaseSslCa } : {})
          }
        : false
    });
    await sharedPool.query('SELECT 1');
  }
  return sharedPool;
}

export function setPool(pool) { sharedPool = pool; }
