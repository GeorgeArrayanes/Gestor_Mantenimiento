import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeIncident, createIncident, fixture } from './helpers.js';

let context;
beforeAll(async () => { context = await fixture(); });
afterAll(async () => context?.pool.end());

describe('integridad de asignación y catálogos', () => {
  it('rechaza responsables y espacios inexistentes o inactivos y conserva los registros históricos', async () => {
    const { admin, spaces } = context;
    const worker = (await admin.post('/api/personnel').send({ name: 'Técnico histórico', phone: '+57 300 500 1234', specialty: 'Plomería', active: true }).expect(201)).body.person;
    const space = (await admin.post('/api/spaces').send({ name: 'Baño archivo', zone: 'Bloque C', active: true }).expect(201)).body.space;
    const incident = (await createIncident(admin, space.id, { assigned_person_id: worker.id }).expect(201)).body.incident;
    await closeIncident(admin, incident.id).expect(200);
    await admin.patch(`/api/personnel/${worker.id}`).send({ active: false }).expect(200);
    await admin.patch(`/api/spaces/${space.id}`).send({ active: false }).expect(200);

    await createIncident(admin, space.id).expect(409);
    await createIncident(admin, spaces[0].id, { assigned_person_id: worker.id }).expect(409);
    const pending = (await createIncident(admin, spaces[0].id).expect(201)).body.incident;
    await admin.post(`/api/incidents/${pending.id}/assign`).send({ assigned_person_id: worker.id }).expect(409);
    await admin.post(`/api/incidents/${pending.id}/assign`).send({ assigned_person_id: 999999 }).expect(404);
    await createIncident(admin, 999999).expect(404);

    const retained = (await admin.get(`/api/incidents/${incident.id}`).expect(200)).body;
    expect(retained.incident.assigned_person_name).toBe('Técnico histórico');
    expect(retained.incident.space_name).toBe('Baño archivo');
    expect(retained.incident.status).toBe('CLOSED');
    expect(retained.evidences).toHaveLength(1);
    expect(retained.history.some((event) => event.new_status === 'CLOSED')).toBe(true);
    expect((await admin.get(`/api/incidents/${pending.id}`).expect(200)).body.incident.status).toBe('PENDING');
  });

  it('no genera cuentas de autenticación para el personal', async () => {
    const { admin, pool } = context;
    const before = (await pool.query('SELECT COUNT(*) AS count FROM users')).rows[0].count;
    await admin.post('/api/personnel').send({ name: 'Sin credenciales', phone: '3005558899', specialty: 'General', active: true }).expect(201);
    const after = (await pool.query('SELECT COUNT(*) AS count FROM users')).rows[0].count;
    expect(Number(after)).toBe(Number(before));
  });

  it('permite editar incidencias activas y rechaza datos fuera de los catálogos', async () => {
    const { admin, spaces } = context;
    const created = (await createIncident(admin, spaces[0].id).expect(201)).body.incident;
    const edited = await admin.patch(`/api/incidents/${created.id}`).send({ description: 'Fuga en tubería bajo el lavamanos principal', priority: 'MEDIA' }).expect(200);
    expect(edited.body.incident).toMatchObject({ description: 'Fuga en tubería bajo el lavamanos principal', priority: 'MEDIA', status: 'PENDING' });
    await admin.patch(`/api/incidents/${created.id}`).send({ priority: 'URGENTE' }).expect(400);
    await createIncident(admin, spaces[0].id, { problem_type: 'MOTOR' }).expect(400);
    await createIncident(admin, spaces[0].id, { description: 'corto' }).expect(400);
  });
});

describe('cierre irreversible ordinario', () => {
  it('requiere asignación, notas, evidencia y confirmación explícita', async () => {
    const { admin, spaces, personnel } = context;
    const incident = (await createIncident(admin, spaces[0].id).expect(201)).body.incident;
    await closeIncident(admin, incident.id).expect(409);
    await admin.post(`/api/incidents/${incident.id}/assign`).send({ assigned_person_id: personnel[0].id }).expect(200);
    const missingEvidence = await closeIncident(admin, incident.id, { evidence: false }).expect(400);
    expect(missingEvidence.body.message).toMatch(/evidencia|archivo|imagen/i);
    await closeIncident(admin, incident.id, { confirmed: 'false' }).expect(400);
    await closeIncident(admin, incident.id, { resolution_notes: 'Listo' }).expect(400);
    const untouched = (await admin.get(`/api/incidents/${incident.id}`).expect(200)).body;
    expect(untouched.incident.status).toBe('ASSIGNED');
    expect(untouched.incident.closed_at).toBeNull();
    expect(untouched.evidences).toHaveLength(0);
  });

  it('bloquea segundo cierre, edición y reasignación también para SUPER_ADMIN', async () => {
    const { admin, superAdmin, spaces, personnel } = context;
    const incident = (await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id }).expect(201)).body.incident;
    await closeIncident(admin, incident.id).expect(200);
    const before = (await admin.get(`/api/incidents/${incident.id}`).expect(200)).body;
    for (const actor of [admin, superAdmin]) {
      await closeIncident(actor, incident.id).expect(409);
      await actor.patch(`/api/incidents/${incident.id}`).send({ description: 'Edición posterior al cierre.' }).expect(409);
      await actor.post(`/api/incidents/${incident.id}/assign`).send({ assigned_person_id: personnel[1].id }).expect(409);
    }
    const after = (await admin.get(`/api/incidents/${incident.id}`).expect(200)).body;
    expect(after.incident.closed_at).toBe(before.incident.closed_at);
    expect(after.incident.resolution_notes).toBe(before.incident.resolution_notes);
    expect(after.evidences).toEqual(before.evidences);
    expect(after.history).toEqual(before.history);
  });

  it('rechaza el lanzamiento de WhatsApp sin asignación o con teléfono inválido', async () => {
    const { admin, spaces, personnel, pool } = context;
    const incident = (await createIncident(admin, spaces[0].id).expect(201)).body.incident;
    await admin.get(`/api/incidents/${incident.id}/whatsapp`).expect(409);
    await admin.post(`/api/incidents/${incident.id}/assign`).send({ assigned_person_id: personnel[0].id }).expect(200);
    // Simula un dato mal formado heredado, aunque las escrituras actuales lo validen.
    await pool.query('UPDATE maintenance_personnel SET phone=$1 WHERE id=$2', ['sin teléfono', personnel[0].id]);
    const invalid = await admin.get(`/api/incidents/${incident.id}/whatsapp`).expect(400);
    expect(invalid.body.message).toMatch(/teléfono|número/i);
    expect(invalid.body.url).toBeUndefined();
  });

  it('usa el teléfono corregido para WhatsApp y conserva el teléfono histórico de asignación', async () => {
    const { admin, spaces } = context;
    const person = (await admin.post('/api/personnel').send({ name: 'Responsable con cambio', phone: '+57 300 555 1122', specialty: 'General', active: true }).expect(201)).body.person;
    const incident = (await createIncident(admin, spaces[0].id, { assigned_person_id: person.id }).expect(201)).body.incident;
    await admin.patch(`/api/personnel/${person.id}`).send({ phone: '+57 300 555 6677' }).expect(200);
    const whatsapp = (await admin.get(`/api/incidents/${incident.id}/whatsapp`).expect(200)).body;
    expect(new URL(whatsapp.url).pathname).toBe('/573005556677');
    const detail = (await admin.get(`/api/incidents/${incident.id}`).expect(200)).body;
    expect(detail.incident.assigned_person_phone).toBe('+57 300 555 1122');
  });

  it('serializa dos cierres simultáneos para conservar una sola solución', async () => {
    const { admin, spaces, personnel } = context;
    const incident = (await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id }).expect(201)).body.incident;
    const outcomes = await Promise.all([closeIncident(admin, incident.id), closeIncident(admin, incident.id)]);
    expect(outcomes.map((result) => result.status).sort()).toEqual([200, 409]);
    const detail = (await admin.get(`/api/incidents/${incident.id}`).expect(200)).body;
    expect(detail.evidences.filter((item) => item.category === 'FINAL')).toHaveLength(1);
    expect(detail.history.filter((event) => event.new_status === 'CLOSED')).toHaveLength(1);
  });
});
