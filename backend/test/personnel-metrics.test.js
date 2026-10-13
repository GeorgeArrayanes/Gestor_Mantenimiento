import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeIncident, createIncident, fixture } from './helpers.js';

let context;
beforeEach(async () => { context = await fixture(); });
afterEach(async () => context?.pool.end());

async function metrics(id, query = '') {
  const { personnel } = (await context.admin.get(`/api/personnel${query}`).expect(200)).body;
  return personnel.find((person) => person.id === id);
}

describe('carga de trabajo y resoluciones del personal', () => {
  it('devuelve cero para personas sin incidencias, incluyendo las inactivas', async () => {
    for (const person of context.personnel) {
      expect(await metrics(person.id)).toMatchObject({ assigned_count: 0, resolved_count: 0 });
    }
    const id = context.personnel[0].id;
    await context.admin.patch(`/api/personnel/${id}`).send({ active: false }).expect(200);
    expect(await metrics(id, '?active=false')).toMatchObject({ active: false, assigned_count: 0, resolved_count: 0 });
    expect(await metrics(id, '?active=true')).toBeUndefined();
  });

  it('actualiza los contadores al asignar, reasignar, cerrar y eliminar, sin mezclar personas', async () => {
    const { admin, personnel, spaces } = context;
    const [first, second] = personnel;
    const pending = (await createIncident(admin, spaces[0].id).expect(201)).body.incident;
    const assigned = (await createIncident(admin, spaces[0].id, { assigned_person_id: first.id }).expect(201)).body.incident;
    await createIncident(admin, spaces[0].id, { assigned_person_id: second.id }).expect(201);
    expect(await metrics(first.id)).toMatchObject({ assigned_count: 1, resolved_count: 0 });
    expect(await metrics(second.id)).toMatchObject({ assigned_count: 1, resolved_count: 0 });

    await admin.post(`/api/incidents/${pending.id}/assign`).send({ assigned_person_id: first.id }).expect(200);
    expect(await metrics(first.id)).toMatchObject({ assigned_count: 2, resolved_count: 0 });
    await admin.post(`/api/incidents/${assigned.id}/assign`).send({ assigned_person_id: second.id }).expect(200);
    expect(await metrics(first.id)).toMatchObject({ assigned_count: 1, resolved_count: 0 });
    expect(await metrics(second.id)).toMatchObject({ assigned_count: 2, resolved_count: 0 });

    await closeIncident(admin, assigned.id).expect(200);
    expect(await metrics(second.id)).toMatchObject({ assigned_count: 1, resolved_count: 1 });
    await admin.patch(`/api/personnel/${second.id}`).send({ active: false }).expect(200);
    expect(await metrics(second.id, '?active=false')).toMatchObject({ assigned_count: 1, resolved_count: 1 });
    await admin.delete(`/api/incidents/${assigned.id}`).expect(200);
    expect(await metrics(second.id)).toMatchObject({ assigned_count: 1, resolved_count: 0 });
    expect(await metrics(first.id)).toMatchObject({ assigned_count: 1, resolved_count: 0 });
  });
});
