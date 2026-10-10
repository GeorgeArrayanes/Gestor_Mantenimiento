import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { config } from '../src/config.js';
import { closeIncident, createIncident, DEMO_PASSWORD, fixture, login, PNG } from './helpers.js';

let context;
beforeAll(async () => { context = await fixture(); });
afterAll(async () => context?.pool.end());

describe('autenticación administrativa', () => {
  it('rechaza credenciales incorrectas y no expone contraseñas', async () => {
    await request(context.app).post('/api/auth/login').send({ username: 'admin@mantenimiento.test', password: 'incorrecta' }).expect(401);
    const response = await login(request.agent(context.app), 'admin@mantenimiento.test');
    expect(response.body.user.role).toBe('ADMIN');
    expect(response.body.user.password_hash).toBeUndefined();
    expect(response.headers['set-cookie'][0]).toContain('mantenimiento_token=');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  });

  it('permite cookie segura y respaldo bearer con la misma autorización', async () => {
    let response;
    config.nodeEnv = 'production';
    try {
      response = await request(context.app).post('/api/auth/login')
        .send({ username: 'admin@mantenimiento.test', password: DEMO_PASSWORD }).expect(200);
    } finally { config.nodeEnv = 'test'; }
    const cookie = response.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api');
    const session = await request(context.app).get('/api/auth/me')
      .set('Authorization', `Bearer ${response.body.token}`).expect(200);
    expect(session.body.user.role).toBe('ADMIN');
    expect(session.body.user.password_hash).toBeUndefined();
  });
});

describe('flujo de mantenimiento aceptado', () => {
  it('registra MT, conserva evidencia, asigna a Carlos, prepara WhatsApp y cierra con historial y métricas reales', async () => {
    const { admin, spaces, personnel } = context;
    const space = spaces.find((item) => item.name === 'Baño Bloque A');
    const carlos = personnel.find((item) => item.name === 'Carlos Rodríguez');
    const initialDashboard = await admin.get('/api/dashboard').expect(200);
    expect(initialDashboard.body.stats).toMatchObject({ pending: 0, assigned: 0, closedThisMonth: 0 });

    const created = await createIncident(admin, space.id)
      .attach('files', PNG, { filename: 'fuga.png', contentType: 'image/png' }).expect(201);
    const incident = created.body.incident;
    expect(incident.code).toBe(`MT-${new Date().getFullYear()}-001`);
    expect(incident).toMatchObject({ space_id: space.id, status: 'PENDING', priority: 'ALTA', problem_type: 'PLOMERIA' });
    expect(incident.assigned_person_id).toBeNull();

    const pendingDashboard = await admin.get('/api/dashboard').expect(200);
    expect(pendingDashboard.body.stats).toMatchObject({ pending: 1, assigned: 0, closedThisMonth: 0 });
    const assigned = await admin.post(`/api/incidents/${incident.id}/assign`)
      .send({ assigned_person_id: carlos.id }).expect(200);
    expect(assigned.body.incident).toMatchObject({ status: 'ASSIGNED', assigned_person_id: carlos.id });
    expect(assigned.body.incident.assigned_at).toBeTruthy();

    const whatsapp = await admin.get(`/api/incidents/${incident.id}/whatsapp`).expect(200);
    const destination = new URL(whatsapp.body.url);
    expect(destination.origin).toBe('https://wa.me');
    expect(destination.pathname).toBe('/573002223344');
    const message = destination.searchParams.get('text');
    expect(message).toBe(whatsapp.body.message);
    expect(message.startsWith('*Nueva incidencia de mantenimiento*\n\n')).toBe(true);
    for (const text of ['Carlos', 'Baño Bloque A', 'Fuga debajo del lavamanos', 'Alta', 'Gimnasio Los Arrayanes']) expect(message).toContain(text);
    expect(message).not.toMatch(/password|token|supabase|http:\/\/localhost/i);

    const assignedDashboard = await admin.get('/api/dashboard').expect(200);
    expect(assignedDashboard.body.stats).toMatchObject({ pending: 0, assigned: 1, closedThisMonth: 0 });
    const closed = await closeIncident(admin, incident.id).expect(200);
    expect(closed.body.incident).toMatchObject({ status: 'CLOSED', resolution_notes: 'Se reemplazó la llave y se ajustó la tubería.' });
    expect(closed.body.incident.closed_at).toBeTruthy();

    const detail = (await admin.get(`/api/incidents/${incident.id}`).expect(200)).body;
    expect(detail.evidences).toHaveLength(2);
    expect(detail.evidences.map((item) => item.category)).toEqual(expect.arrayContaining(['INITIAL', 'FINAL']));
    expect(detail.history.length).toBeGreaterThanOrEqual(3);
    expect(detail.history.some((event) => event.new_status === 'PENDING')).toBe(true);
    expect(detail.history.some((event) => event.new_status === 'ASSIGNED')).toBe(true);
    expect(detail.history.some((event) => event.new_status === 'CLOSED')).toBe(true);
    expect(detail.history.some((event) => String(event.comment || '').includes('Carlos'))).toBe(true);

    const closedDashboard = await admin.get('/api/dashboard').expect(200);
    expect(closedDashboard.body.stats).toMatchObject({ pending: 0, assigned: 0, closedThisMonth: 1 });
    expect(Number(closedDashboard.body.stats.averageResolutionHours)).toBeGreaterThanOrEqual(0);
    const closedList = await admin.get('/api/incidents?status=CLOSED').expect(200);
    expect(closedList.body.incidents.some((item) => item.id === incident.id)).toBe(true);
    const search = await admin.get('/api/incidents').query({ search: incident.code }).expect(200);
    expect(search.body.incidents.map((item) => item.id)).toEqual([incident.id]);
  });

  it('crea directamente ASSIGNED cuando se selecciona responsable y admite reasignación', async () => {
    const { admin, spaces, personnel } = context;
    const created = await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id }).expect(201);
    expect(created.body.incident.status).toBe('ASSIGNED');
    const response = await admin.post(`/api/incidents/${created.body.incident.id}/assign`)
      .send({ assigned_person_id: personnel[1].id }).expect(200);
    expect(response.body.incident).toMatchObject({ status: 'ASSIGNED', assigned_person_id: personnel[1].id });
    const detail = await admin.get(`/api/incidents/${created.body.incident.id}`).expect(200);
    expect(detail.body.history.filter((event) => event.new_status === 'ASSIGNED').length).toBeGreaterThanOrEqual(2);
  });
});
