import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createMemoryPool } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedDatabase } from '../src/seed.js';
import { config } from '../src/config.js';

let pool;
let app;
let admin;
let driver;
let foreignDriver;

beforeAll(async () => {
  config.nodeEnv = 'test';
  pool = await createMemoryPool();
  await seedDatabase(pool);
  app = createApp(pool);
  admin = request.agent(app);
  driver = request.agent(app);
  foreignDriver = request.agent(app);
});

afterAll(async () => pool.end());

async function login(agent, username, password = 'RutaSegura2026!') {
  return agent.post('/api/auth/login').send({ username, password });
}

describe('autenticación y autorización', () => {
  it('rechaza credenciales incorrectas y autentica una contraseña hasheada', async () => {
    await request(app).post('/api/auth/login').send({ username: 'admin@rutasegura.test', password: 'incorrecta' }).expect(401);
    const response = await login(admin, 'admin@rutasegura.test');
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('ADMIN');
    expect(response.body.user.password_hash).toBeUndefined();
  });

  it('impide que un conductor use recursos administrativos', async () => {
    await login(driver, 'carlos@rutasegura.test');
    await driver.get('/api/users?role=CONDUCTOR').expect(403);
    await login(foreignDriver, 'roberto@rutasegura.test');
  });
});

describe('flujo completo e historial inmutable', () => {
  let incidentId;

  it('crea la novedad, asigna el conductor y actualiza el dashboard', async () => {
    const buses = await admin.get('/api/buses').expect(200);
    const bus = buses.body.buses.find((item) => item.reference === 'Bus 04');
    const created = await admin.post('/api/incidents')
      .field('bus_id', String(bus.id))
      .field('damage_type', 'FRENOS')
      .field('description', 'El pedal de freno tiene un recorrido excesivo y requiere revisión inmediata.')
      .field('urgency', 'ALTA')
      .attach('files', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { filename: 'freno.jpg', contentType: 'image/jpeg' });
    expect(created.status).toBe(201);
    incidentId = created.body.incident.id;
    expect(created.body.incident.status).toBe('REPORTADO');
    expect(created.body.incident.driver_name).toBe('Carlos Mendoza');
    const dashboard = await admin.get('/api/dashboard').expect(200);
    expect(dashboard.body.stats.open).toBeGreaterThanOrEqual(1);
  });

  it('evita que otro conductor consulte o modifique la novedad', async () => {
    await foreignDriver.get(`/api/incidents/${incidentId}`).expect(403);
    await foreignDriver.post(`/api/incidents/${incidentId}/start`).send({}).expect(403);
  });

  it('permite iniciar, adjuntar y enviar la reparación', async () => {
    const started = await driver.post(`/api/incidents/${incidentId}/start`).send({ comment: 'Inicio revisión de frenos.' }).expect(200);
    expect(started.body.incident.status).toBe('EN_PROCESO');
    const evidence = await driver.post(`/api/incidents/${incidentId}/evidences`)
      .field('comment', 'Se purgó el sistema y se cambiaron las pastillas delanteras.')
      .attach('files', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { filename: 'solucion.jpg', contentType: 'image/jpeg' });
    expect(evidence.status).toBe(201);
    expect(evidence.body.evidences[0].category).toBe('SOLUCION');
    const submitted = await driver.post(`/api/incidents/${incidentId}/submit`).send({ comment: 'Trabajo finalizado.' }).expect(200);
    expect(submitted.body.incident.status).toBe('PENDIENTE_VALIDACION');
  });

  it('exige un motivo al rechazar y conserva la primera solución', async () => {
    await admin.post(`/api/incidents/${incidentId}/reject`).send({}).expect(400);
    const rejected = await admin.post(`/api/incidents/${incidentId}/reject`).send({ reason: 'Falta evidencia del nivel final del líquido de frenos.' }).expect(200);
    expect(rejected.body.incident.status).toBe('REQUIERE_CORRECCION');
    const detail = await admin.get(`/api/incidents/${incidentId}`).expect(200);
    expect(detail.body.evidences.some((evidence) => evidence.category === 'SOLUCION')).toBe(true);
  });

  it('permite corregir, reenviar, aprobar y preserva todas las evidencias', async () => {
    await driver.post(`/api/incidents/${incidentId}/start`).send({}).expect(200);
    await driver.post(`/api/incidents/${incidentId}/submit`).send({ comment: 'Intento sin evidencia nueva.' }).expect(400);
    const correction = await driver.post(`/api/incidents/${incidentId}/evidences`)
      .field('comment', 'Se adjunta nivel final y prueba de frenado.')
      .attach('files', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'correccion.png', contentType: 'image/png' })
      .expect(201);
    expect(correction.body.evidences[0].category).toBe('CORRECCION');
    await driver.post(`/api/incidents/${incidentId}/submit`).send({ comment: 'Corrección completada.' }).expect(200);
    const approved = await admin.post(`/api/incidents/${incidentId}/approve`).send({ comment: 'Reparación verificada.' }).expect(200);
    expect(approved.body.incident.status).toBe('RESUELTO');
    await driver.post(`/api/incidents/${incidentId}/start`).send({}).expect(409);
    const detail = await admin.get(`/api/incidents/${incidentId}`).expect(200);
    expect(detail.body.evidences).toHaveLength(3);
    expect(detail.body.history.map((event) => event.event_type)).toEqual(expect.arrayContaining([
      'NOVEDAD_CREADA','REPARACION_INICIADA','EVIDENCIA_AGREGADA','SOLUCION_ENVIADA','REPARACION_RECHAZADA','REPARACION_APROBADA'
    ]));
    expect(detail.body.history.find((event) => event.event_type === 'REPARACION_RECHAZADA').comment).toContain('Falta evidencia');
  });
});
