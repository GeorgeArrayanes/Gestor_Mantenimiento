import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';
import { createIncident, fixture, DEMO_PASSWORD } from './helpers.js';

let context;
beforeAll(async () => { context = await fixture(); });
afterAll(async () => context?.pool.end());

const adminData = {
  name: 'Coordinación de Mantenimiento', identification: 'ADM-GLA-002',
  username: 'coordinacion@gla.edu.co', phone: '3005550101',
  password: 'ClaveSegura2026!', role: 'ADMIN', status: 'ACTIVO'
};

describe('gobierno de administradores', () => {
  it('entrega a SUPER_ADMIN los permisos operativos de ADMIN', async () => {
    const session = await context.superAdmin.get('/api/auth/me').expect(200);
    expect(session.body.user.role).toBe('SUPER_ADMIN');
    await context.superAdmin.get('/api/dashboard').expect(200);
    await context.superAdmin.get('/api/personnel').expect(200);
    await context.superAdmin.get('/api/spaces').expect(200);
    const created = await createIncident(context.superAdmin, context.spaces[0].id).expect(201);
    expect(created.body.incident.status).toBe('PENDING');
  });

  it('reserva el listado y la creación de administradores a SUPER_ADMIN', async () => {
    const { admin, superAdmin, app } = context;
    await admin.get('/api/users?role=ADMIN').expect(403);
    await admin.get('/api/users').expect(403);
    await admin.post('/api/users').send(adminData).expect(403);
    await request(app).get('/api/users?role=ADMIN').expect(401);
    const created = await superAdmin.post('/api/users').send(adminData).expect(201);
    expect(created.body.user).toMatchObject({ role: 'ADMIN', name: adminData.name });
    expect(created.body.user.password_hash).toBeUndefined();
    const listing = await superAdmin.get('/api/users?role=ADMIN').expect(200);
    expect(listing.body.users.some((user) => user.id === created.body.user.id)).toBe(true);
    expect(listing.body.users.every((user) => !('password_hash' in user))).toBe(true);
  });

  it('impide crear SUPER_ADMIN o cuentas de trabajadores y exige contraseñas robustas', async () => {
    for (const role of ['SUPER_ADMIN', 'CONDUCTOR']) {
      await context.superAdmin.post('/api/users').send({ ...adminData, username: `${role.toLowerCase()}@gla.edu.co`, role }).expect(400);
    }
    await context.superAdmin.post('/api/users').send({ ...adminData, username: 'weak@gla.edu.co', password: '12345678' }).expect(400);
  });

  it('protege cuentas administrativas, correo único e invalida sesiones de administradores inactivos', async () => {
    const { admin, superAdmin, pool, app } = context;
    const created = await superAdmin.post('/api/users').send({ ...adminData, identification: 'ADM-EDIT', username: 'editable@gla.edu.co', password: DEMO_PASSWORD }).expect(201);
    const newSession = request.agent(app);
    await newSession.post('/api/auth/login').send({ username: 'editable@gla.edu.co', password: DEMO_PASSWORD }).expect(200);
    await admin.patch(`/api/users/${created.body.user.id}`).send({ status: 'INACTIVO' }).expect(403);
    const master = (await pool.query("SELECT id FROM users WHERE role='SUPER_ADMIN'")).rows[0];
    await admin.patch(`/api/users/${master.id}`).send({ status: 'INACTIVO' }).expect(403);
    await superAdmin.patch(`/api/users/${master.id}`).send({ status: 'INACTIVO' }).expect(403);
    await superAdmin.patch(`/api/users/${created.body.user.id}`).send({ status: 'INACTIVO' }).expect(200);
    await newSession.get('/api/dashboard').expect(401);
    await newSession.post('/api/auth/login').send({ username: 'editable@gla.edu.co', password: DEMO_PASSWORD }).expect(401);
    await superAdmin.post('/api/users').send({ ...adminData, identification: 'ADM-DUP', username: 'COORDINACION@GLA.EDU.CO' }).expect(409);
  });

  it('consulta el rol actual en base de datos aunque el JWT declare SUPER_ADMIN', async () => {
    const user = (await context.pool.query("SELECT id FROM users WHERE role='ADMIN' LIMIT 1")).rows[0];
    const forgedRoleToken = jwt.sign({ id: user.id, role: 'SUPER_ADMIN' }, config.jwtSecret, { algorithm: 'HS256', issuer: 'gestor-mantenimiento', audience: 'mantenimiento-admin' });
    await request(context.app).get('/api/users').set('Authorization', `Bearer ${forgedRoleToken}`).expect(403);
  });

  it('rechaza IDs inválidos y no admite el antiguo ajuste de estado fuera del flujo', async () => {
    const incident = (await createIncident(context.admin, context.spaces[0].id)).body.incident;
    await context.superAdmin.patch(`/api/incidents/${incident.id}/status`).send({ status: 'CLOSED', reason: 'No debe omitir la evidencia final.' }).expect(404);
    await context.superAdmin.patch('/api/users/not-an-id').send({ status: 'INACTIVO' }).expect(400);
    await context.admin.get('/api/incidents/not-an-id').expect(400);
  });
});
