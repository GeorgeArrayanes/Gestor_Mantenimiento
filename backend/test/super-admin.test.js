import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createMemoryPool } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedDatabase } from '../src/seed.js';
import { config } from '../src/config.js';

let pool;
let app;
let superAdmin;
let admin;
let driver;
let createdAdminId;

beforeAll(async () => {
  config.nodeEnv = 'test';
  pool = await createMemoryPool();
  await seedDatabase(pool);
  app = createApp(pool);
  superAdmin = request.agent(app);
  admin = request.agent(app);
  driver = request.agent(app);
  await superAdmin.post('/api/auth/login').send({ username: 'Admin@gla.edu.co', password: 'RutaSegura2026!' }).expect(200);
  await admin.post('/api/auth/login').send({ username: 'admin@rutasegura.test', password: 'RutaSegura2026!' }).expect(200);
  await driver.post('/api/auth/login').send({ username: 'carlos@rutasegura.test', password: 'RutaSegura2026!' }).expect(200);
});

afterAll(async () => pool.end());

describe('gobierno de administradores', () => {
  it('entrega al superadministrador todos los permisos operativos de ADMIN', async () => {
    const session = await superAdmin.get('/api/auth/me').expect(200);
    expect(session.body.user.role).toBe('SUPER_ADMIN');
    await superAdmin.get('/api/dashboard').expect(200);
    await superAdmin.get('/api/users?role=CONDUCTOR').expect(200);
  });

  it('reserva el listado y la creación de administradores al SUPER_ADMIN', async () => {
    await admin.get('/api/users?role=ADMIN').expect(403);
    await driver.get('/api/users?role=ADMIN').expect(403);
    await admin.post('/api/users').send({
      name: 'Admin sin permiso',
      identification: 'ADM-DENIED',
      username: 'denied@gla.edu.co',
      password: 'ClaveSegura2026!',
      role: 'ADMIN',
      status: 'ACTIVO',
    }).expect(403);

    const created = await superAdmin.post('/api/users').send({
      name: 'Coordinación de Flota',
      identification: 'ADM-GLA-002',
      username: 'coordinacion@gla.edu.co',
      phone: '3005550101',
      password: 'ClaveSegura2026!',
      role: 'ADMIN',
      status: 'ACTIVO',
    }).expect(201);
    createdAdminId = created.body.user.id;
    expect(created.body.user.role).toBe('ADMIN');

    const listing = await superAdmin.get('/api/users?role=ADMIN').expect(200);
    expect(listing.body.users.some((user) => user.id === createdAdminId)).toBe(true);
  });

  it('impide crear otro SUPER_ADMIN y exige contraseñas administrativas robustas', async () => {
    await superAdmin.post('/api/users').send({
      name: 'Segundo Super Admin',
      identification: 'SA-002',
      username: 'super2@gla.edu.co',
      password: 'ClaveSegura2026!',
      role: 'SUPER_ADMIN',
      status: 'ACTIVO',
    }).expect(400);

    await superAdmin.post('/api/users').send({
      name: 'Admin Débil',
      identification: 'ADM-WEAK',
      username: 'weak@gla.edu.co',
      password: '12345678',
      role: 'ADMIN',
      status: 'ACTIVO',
    }).expect(400);
  });

  it('evita que un ADMIN edite administradores o la cuenta maestra', async () => {
    await admin.patch(`/api/users/${createdAdminId}`).send({ status: 'INACTIVO' }).expect(403);
    const superAdminUser = (await pool.query("SELECT id FROM users WHERE role='SUPER_ADMIN'")).rows[0];
    await admin.patch(`/api/users/${superAdminUser.id}`).send({ status: 'INACTIVO' }).expect(403);
    await superAdmin.patch(`/api/users/${superAdminUser.id}`).send({ status: 'INACTIVO' }).expect(403);

    const updated = await superAdmin.patch(`/api/users/${createdAdminId}`).send({ status: 'INACTIVO' }).expect(200);
    expect(updated.body.user.status).toBe('INACTIVO');
  });

  it('rechaza correos duplicados aunque cambie la capitalización', async () => {
    await superAdmin.post('/api/users').send({
      name: 'Correo Duplicado',
      identification: 'ADM-DUP',
      username: 'COORDINACION@GLA.EDU.CO',
      password: 'OtraClaveSegura2026!',
      role: 'ADMIN',
      status: 'ACTIVO',
    }).expect(409);
  });
});
