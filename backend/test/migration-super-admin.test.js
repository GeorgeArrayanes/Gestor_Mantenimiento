import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newDb } from 'pg-mem';

let pool;

beforeAll(async () => {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  pool = new adapter.Pool();
  await pool.query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      identification VARCHAR(40) UNIQUE,
      username VARCHAR(120) NOT NULL UNIQUE,
      phone VARCHAR(30),
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'CONDUCTOR')),
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO users(name, identification, username, password_hash, role)
    VALUES('Admin existente', 'ADM-OLD', 'admin@gla.edu.co', 'hash', 'ADMIN');
  `);
  const sql = await fs.readFile(path.resolve(process.cwd(), '..', 'database', 'migrations', '002_super_admin.sql'), 'utf8');
  await pool.query(sql);
});

afterAll(async () => pool.end());

describe('migración 002_super_admin', () => {
  it('actualiza una base anterior para aceptar SUPER_ADMIN', async () => {
    const inserted = await pool.query(`
      INSERT INTO users(name, identification, username, password_hash, role)
      VALUES('Super Admin', 'SA-001', 'superadmin@gla.edu.co', 'hash', 'SUPER_ADMIN')
      RETURNING role
    `);
    expect(inserted.rows[0].role).toBe('SUPER_ADMIN');
  });

  it('mantiene la unicidad de correo sin distinguir mayúsculas', async () => {
    await expect(pool.query(`
      INSERT INTO users(name, identification, username, password_hash, role)
      VALUES('Duplicado', 'ADM-DUP', 'ADMIN@GLA.EDU.CO', 'hash', 'ADMIN')
    `)).rejects.toMatchObject({ code: '23505' });
  });
});
