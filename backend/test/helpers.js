import request from 'supertest';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { createMemoryPool } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedDatabase } from '../src/seed.js';
import { config, projectRoot } from '../src/config.js';

export const DEMO_PASSWORD = 'Mantenimiento2026!';
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC', 'base64');
export const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');

// TEST_POSTGRES_URL must point to a disposable test database. Each integration
// suite gets its own schema; the normal fast suite retains its in-memory pool.
export async function createTestPool() {
  if (!process.env.TEST_POSTGRES_URL) return createMemoryPool();
  const schema = `maintenance_test_${crypto.randomBytes(12).toString('hex')}`;
  const control = new pg.Pool({ connectionString: process.env.TEST_POSTGRES_URL, max: 1 });
  const pool = new pg.Pool({ connectionString: process.env.TEST_POSTGRES_URL, options: `-c search_path=${schema}`, max: 8 });
  const rawEnd = pool.end.bind(pool);
  let ended = false;
  pool.end = async () => {
    if (ended) return;
    ended = true;
    try { await rawEnd(); }
    finally {
      try { await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
      finally { await control.end(); }
    }
  };
  try {
    await control.query(`CREATE SCHEMA "${schema}"`);
    for (const file of ['001_init.sql', '002_super_admin.sql', '003_maintenance.sql', '004_directory_images.sql', '005_campus_regions.sql', '006_individual_campus_blocks.sql']) {
      await pool.query(await fs.readFile(path.join(projectRoot, 'database', 'migrations', file), 'utf8'));
    }
    return pool;
  } catch (error) { await pool.end(); throw error; }
}

export async function fixture() {
  config.nodeEnv = 'test';
  const pool = await createTestPool();
  try {
    await seedDatabase(pool, { incidents: false });
    const app = createApp(pool);
    const admin = request.agent(app);
    const superAdmin = request.agent(app);
    await login(admin, 'admin@mantenimiento.test');
    await login(superAdmin, config.superAdminEmail || 'superadmin@mantenimiento.test');
    const spaces = (await admin.get('/api/spaces').expect(200)).body.spaces;
    const personnel = (await admin.get('/api/personnel').expect(200)).body.personnel;
    return { pool, app, admin, superAdmin, spaces, personnel };
  } catch (error) { await pool.end(); throw error; }
}

export function login(agent, username, password = DEMO_PASSWORD) {
  return agent.post('/api/auth/login').send({ username, password }).expect(200);
}

export function createIncident(admin, spaceId, overrides = {}) {
  let call = admin.post('/api/incidents')
    .field('space_id', String(spaceId))
    .field('problem_type', overrides.problem_type || 'PLOMERIA')
    .field('priority', overrides.priority || 'ALTA')
    .field('description', overrides.description || 'Fuga debajo del lavamanos');
  if (overrides.assigned_person_id) call = call.field('assigned_person_id', String(overrides.assigned_person_id));
  return call;
}

export function closeIncident(admin, incidentId, overrides = {}) {
  let call = admin.post(`/api/incidents/${incidentId}/close`)
    .field('resolution_notes', overrides.resolution_notes || 'Se reemplazó la llave y se ajustó la tubería.')
    .field('confirmed', overrides.confirmed ?? 'true');
  if (overrides.evidence !== false) {
    call = call.attach('files', PNG, { filename: 'solucion.png', contentType: 'image/png' });
  }
  return call;
}
