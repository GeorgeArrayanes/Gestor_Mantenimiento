import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeIncident, createIncident, fixture } from './helpers.js';

let context;
beforeEach(async () => { context = await fixture(); });
afterEach(async () => context?.pool.end());

describe('indicadores calculados desde registros reales', () => {
  it('devuelve null cuando todavía no hay incidencias cerradas', async () => {
    const { admin, spaces, personnel } = context;
    const empty = (await admin.get('/api/dashboard').expect(200)).body;
    expect(empty.stats).toEqual({ pending: 0, assigned: 0, closedThisMonth: 0, averageResolutionHours: null });
    await createIncident(admin, spaces[0].id).expect(201);
    await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id }).expect(201);
    const active = (await admin.get('/api/dashboard').expect(200)).body;
    expect(active.stats).toEqual({ pending: 1, assigned: 1, closedThisMonth: 0, averageResolutionHours: null });
  });

  it('cuenta estados, distingue el mes de cierre y promedia horas transcurridas', async () => {
    const { admin, spaces, personnel, pool } = context;
    await createIncident(admin, spaces[0].id).expect(201);
    await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id }).expect(201);
    const current = (await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id }).expect(201)).body.incident;
    const previous = (await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id }).expect(201)).body.incident;
    await closeIncident(admin, current.id).expect(200);
    await closeIncident(admin, previous.id).expect(200);
    const now = new Date();
    const priorMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 17));
    await pool.query('UPDATE maintenance_incidents SET created_at=$1,closed_at=$2 WHERE id=$3', [new Date(now - 2 * 3600000), now, current.id]);
    await pool.query('UPDATE maintenance_incidents SET created_at=$1,closed_at=$2 WHERE id=$3', [new Date(priorMonth - 4 * 3600000), priorMonth, previous.id]);
    const dashboard = (await admin.get('/api/dashboard').expect(200)).body;
    expect(dashboard.stats).toMatchObject({ pending: 1, assigned: 1, closedThisMonth: 1, averageResolutionHours: 3 });
    expect(dashboard.recent).toHaveLength(4);
  });

  it('conserva un promedio real de 0.96 horas sin redondearlo a una hora', async () => {
    const { admin, spaces, personnel, pool } = context;
    const now = new Date();
    for (const hours of [0.92, 1]) {
      const incident = (await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id }).expect(201)).body.incident;
      await closeIncident(admin, incident.id).expect(200);
      await pool.query('UPDATE maintenance_incidents SET created_at=$1,closed_at=$2 WHERE id=$3', [new Date(now - hours * 3600000), now, incident.id]);
    }
    const { stats } = (await admin.get('/api/dashboard').expect(200)).body;
    expect(stats.closedThisMonth).toBe(2);
    expect(stats.averageResolutionHours).toBeCloseTo(0.96, 12);
    expect(stats.averageResolutionHours).toBeLessThan(1);
  });

  it('devuelve exactamente una hora cuando esa es la duración del cierre', async () => {
    const { admin, spaces, personnel, pool } = context;
    const incident = (await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id }).expect(201)).body.incident;
    await closeIncident(admin, incident.id).expect(200);
    const now = new Date();
    await pool.query('UPDATE maintenance_incidents SET created_at=$1,closed_at=$2 WHERE id=$3', [new Date(now - 3600000), now, incident.id]);
    const { stats } = (await admin.get('/api/dashboard').expect(200)).body;
    expect(stats.closedThisMonth).toBe(1);
    expect(stats.averageResolutionHours).toBe(1);
  });

  it('excluye duraciones inválidas del promedio y conserva el conteo de cierres', async () => {
    const { admin, spaces, personnel, pool } = context;
    const incident = (await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id }).expect(201)).body.incident;
    await closeIncident(admin, incident.id).expect(200);
    const now = new Date();
    await pool.query('UPDATE maintenance_incidents SET created_at=$1,closed_at=$2 WHERE id=$3', [new Date(Number(now) + 3600000), now, incident.id]);
    const { stats } = (await admin.get('/api/dashboard').expect(200)).body;
    expect(stats.closedThisMonth).toBe(1);
    expect(stats.averageResolutionHours).toBeNull();
  });
});
