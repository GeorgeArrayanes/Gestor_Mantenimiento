import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createMemoryPool } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedDatabase } from '../src/seed.js';
import { config } from '../src/config.js';

let pool;
let app;
let admin;

beforeAll(async () => {
  config.nodeEnv = 'test';
  pool = await createMemoryPool();
  await seedDatabase(pool);
  app = createApp(pool);
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({
    username: 'admin@rutasegura.test',
    password: 'RutaSegura2026!'
  }).expect(200);
});

afterAll(async () => pool.end());

async function createDriver(suffix, status = 'ACTIVO') {
  const response = await admin.post('/api/users').send({
    name: `Conductor ${suffix}`,
    identification: `CC-${suffix}`,
    username: `conductor.${suffix.toLowerCase()}@rutasegura.test`,
    phone: '3000000000',
    password: 'RutaSegura2026!',
    role: 'CONDUCTOR',
    status
  }).expect(201);
  return response.body.user;
}

async function createBus(suffix, driverId, currentStatus = 'OPERATIVO') {
  const response = await admin.post('/api/buses').send({
    reference: `Bus ${suffix}`,
    plate: `QA${suffix}99`,
    brand: 'Mercedes-Benz',
    model: 'Sprinter',
    route: `Ruta QA ${suffix}`,
    capacity: 20,
    current_status: currentStatus,
    driver_id: driverId
  });
  return response;
}

describe('integridad de asignaciones de conductores', () => {
  it('sólo permite asignar usuarios CONDUCTOR activos', async () => {
    const inactiveDriver = await createDriver('INACTIVO', 'INACTIVO');
    const adminUser = (await pool.query("SELECT id FROM users WHERE role='ADMIN' LIMIT 1")).rows[0];
    const freeBus = (await pool.query("SELECT id FROM buses WHERE reference='Bus 09'")).rows[0];

    const inactiveAssignment = await admin.patch(`/api/buses/${freeBus.id}`).send({ driver_id: inactiveDriver.id });
    expect(inactiveAssignment.status).toBe(409);
    expect(inactiveAssignment.body.message).toContain('CONDUCTOR');

    const wrongRoleAssignment = await admin.patch(`/api/buses/${freeBus.id}`).send({ driver_id: adminUser.id });
    expect(wrongRoleAssignment.status).toBe(409);
    expect(wrongRoleAssignment.body.message).toContain('activo');

    const invalidCreation = await createBus('81', inactiveDriver.id);
    expect(invalidCreation.status).toBe(409);
  });

  it('bloquea reasignar o inactivar responsables con novedades abiertas', async () => {
    const carlos = (await pool.query("SELECT id FROM users WHERE username='carlos@rutasegura.test'")).rows[0];
    const bus = (await pool.query("SELECT id FROM buses WHERE reference='Bus 04'")).rows[0];

    const unassign = await admin.patch(`/api/buses/${bus.id}`).send({ driver_id: null });
    expect(unassign.status).toBe(409);
    expect(unassign.body.message).toContain('novedades abiertas');

    const inactivate = await admin.patch(`/api/users/${carlos.id}`).send({ status: 'INACTIVO' });
    expect(inactivate.status).toBe(409);
    expect(inactivate.body.message).toContain('novedades abiertas');
  });

  it('exige retirar un bus sin novedades antes de inactivar a su conductor', async () => {
    const driver = await createDriver('LIBRE');
    const createdBus = await createBus('82', driver.id);
    expect(createdBus.status).toBe(201);

    const assignedInactivation = await admin.patch(`/api/users/${driver.id}`).send({ status: 'INACTIVO' });
    expect(assignedInactivation.status).toBe(409);
    expect(assignedInactivation.body.message).toContain('Retira o reasigna');

    await admin.patch(`/api/buses/${createdBus.body.bus.id}`).send({ driver_id: null }).expect(200);
    await admin.patch(`/api/users/${driver.id}`).send({ status: 'INACTIVO' }).expect(200);

    const reassignment = await admin.patch(`/api/buses/${createdBus.body.bus.id}`).send({ driver_id: driver.id });
    expect(reassignment.status).toBe(409);
  });
});

describe('integridad entre novedades y estado operativo del bus', () => {
  it('mantiene el comportamiento derivado para buses operativos', async () => {
    const driver = await createDriver('DERIVADO');
    const createdBus = await createBus('84', driver.id, 'OPERATIVO');
    expect(createdBus.status).toBe(201);

    const incident = await admin.post('/api/incidents')
      .field('bus_id', String(createdBus.body.bus.id))
      .field('damage_type', 'LUCES_ELECTRICO')
      .field('description', 'Prueba de regresión del estado automático asociado a novedades abiertas.')
      .field('urgency', 'BAJA');
    expect(incident.status).toBe(201);

    let storedBus = (await pool.query('SELECT current_status FROM buses WHERE id=$1', [createdBus.body.bus.id])).rows[0];
    expect(storedBus.current_status).toBe('CON_NOVEDADES');

    await pool.query("UPDATE incidents SET status='PENDIENTE_VALIDACION' WHERE id=$1", [incident.body.incident.id]);
    await admin.post(`/api/incidents/${incident.body.incident.id}/approve`).send({ comment: 'Cierre automático.' }).expect(200);

    storedBus = (await pool.query('SELECT current_status FROM buses WHERE id=$1', [createdBus.body.bus.id])).rows[0];
    expect(storedBus.current_status).toBe('OPERATIVO');
  });

  it('conserva estados manuales al crear y cerrar la última novedad', async () => {
    const driver = await createDriver('MANUAL');
    const createdBus = await createBus('83', driver.id, 'EN_MANTENIMIENTO');
    expect(createdBus.status).toBe(201);

    const incident = await admin.post('/api/incidents')
      .field('bus_id', String(createdBus.body.bus.id))
      .field('damage_type', 'MOTOR')
      .field('description', 'Prueba de regresión para conservar el estado manual del vehículo.')
      .field('urgency', 'MEDIA');
    expect(incident.status).toBe(201);

    let storedBus = (await pool.query('SELECT current_status FROM buses WHERE id=$1', [createdBus.body.bus.id])).rows[0];
    expect(storedBus.current_status).toBe('EN_MANTENIMIENTO');

    await admin.patch(`/api/buses/${createdBus.body.bus.id}`).send({ current_status: 'FUERA_DE_SERVICIO' }).expect(200);
    await pool.query("UPDATE incidents SET status='PENDIENTE_VALIDACION' WHERE id=$1", [incident.body.incident.id]);
    await admin.post(`/api/incidents/${incident.body.incident.id}/approve`).send({ comment: 'Cierre de prueba.' }).expect(200);

    storedBus = (await pool.query('SELECT current_status FROM buses WHERE id=$1', [createdBus.body.bus.id])).rows[0];
    expect(storedBus.current_status).toBe('FUERA_DE_SERVICIO');
  });

  it('rechaza crear novedades si una asignación heredada apunta a un conductor inactivo', async () => {
    const inactiveDriver = await createDriver('HEREDADO', 'INACTIVO');
    const freeBus = (await pool.query("SELECT id FROM buses WHERE reference='Bus 09'")).rows[0];
    await pool.query('UPDATE buses SET driver_id=$1 WHERE id=$2', [inactiveDriver.id, freeBus.id]);

    const response = await admin.post('/api/incidents')
      .field('bus_id', String(freeBus.id))
      .field('damage_type', 'FRENOS')
      .field('description', 'Esta novedad no debe asignarse a una cuenta que no puede iniciar sesión.')
      .field('urgency', 'ALTA');

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('activo');
  });
});
