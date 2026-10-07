import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { closeIncident, createIncident, fixture, PDF, PNG } from './helpers.js';

let context;
let imageIncident;
let noImageIncident;
let pdfIncident;
let closedIncident;
let initialImages;
let closedInitial;
let closedFinal;

beforeAll(async () => {
  context = await fixture();
  const { admin, spaces, personnel } = context;
  imageIncident = (await createIncident(admin, spaces[0].id)
    .attach('files', PDF, { filename: 'informe.pdf', contentType: 'application/pdf' })
    .attach('files', PNG, { filename: 'primera.png', contentType: 'image/png' })
    .attach('files', PNG, { filename: 'segunda.png', contentType: 'image/png' }).expect(201)).body.incident;
  noImageIncident = (await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id }).expect(201)).body.incident;
  pdfIncident = (await createIncident(admin, spaces[0].id)
    .attach('files', PDF, { filename: 'solo-informe.pdf', contentType: 'application/pdf' }).expect(201)).body.incident;
  closedIncident = (await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id })
    .attach('files', PNG, { filename: 'antes.png', contentType: 'image/png' }).expect(201)).body.incident;
  await closeIncident(admin, closedIncident.id).expect(200);
  initialImages = (await admin.get(`/api/incidents/${imageIncident.id}`).expect(200)).body.evidences.filter((file) => file.file_type === 'image/png');
  const closedFiles = (await admin.get(`/api/incidents/${closedIncident.id}`).expect(200)).body.evidences;
  closedInitial = closedFiles.find((file) => file.category === 'INITIAL');
  closedFinal = closedFiles.find((file) => file.category === 'FINAL');
});
afterAll(async () => context?.pool.end());

async function listed(id) {
  const code = [imageIncident, noImageIncident, pdfIncident, closedIncident].find((incident) => incident.id === id).code;
  const response = await context.admin.get('/api/incidents').query({ search: code }).expect(200);
  return response.body.incidents.find((incident) => incident.id === id);
}

describe('miniatura privada en el listado de incidencias', () => {
  it('elige la primera imagen INITIAL por fecha, omite el PDF y resuelve empates por id', async () => {
    const [first, second] = initialImages;
    await context.pool.query('UPDATE maintenance_evidences SET created_at=$1 WHERE id=$2', [new Date('2026-01-02T00:00:00Z'), first.id]);
    await context.pool.query('UPDATE maintenance_evidences SET created_at=$1 WHERE id=$2', [new Date('2026-01-01T00:00:00Z'), second.id]);
    expect((await listed(imageIncident.id)).initial_evidence.id).toBe(second.id);

    await context.pool.query('UPDATE maintenance_evidences SET created_at=$1 WHERE incident_id=$2', [new Date('2026-01-01T00:00:00Z'), imageIncident.id]);
    expect((await listed(imageIncident.id)).initial_evidence.id).toBe(first.id);
  });

  it('expone solamente metadata segura y mantiene los bytes protegidos por sesión', async () => {
    const response = await context.admin.get('/api/incidents').expect(200);
    const incident = response.body.incidents.find((item) => item.id === imageIncident.id);
    const evidence = incident.initial_evidence;
    expect(Object.keys(evidence).sort()).toEqual(['category', 'file_name', 'file_size', 'file_type', 'file_url', 'id']);
    expect(evidence).toMatchObject({ category: 'INITIAL', file_type: 'image/png', file_size: PNG.length });
    expect(evidence.file_url).toBe(`/api/evidences/${evidence.id}/download`);
    expect(incident.evidences).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/storage_key|supabase:|memory:|local:|password_hash/);
    await request(context.app).get('/api/incidents').expect(401);
    await request(context.app).get(evidence.file_url).expect(401);
    const download = await context.admin.get(evidence.file_url).expect(200);
    expect(download.headers['content-type']).toContain('image/png');
    expect(download.headers['cache-control']).toBe('private, no-store');
    expect(download.body).toEqual(PNG);
  });

  it('devuelve null sin imagen inicial o con solo PDF y nunca usa una imagen FINAL', async () => {
    expect((await listed(noImageIncident.id)).initial_evidence).toBeNull();
    expect((await listed(pdfIncident.id)).initial_evidence).toBeNull();
    await context.pool.query('UPDATE maintenance_evidences SET created_at=$1 WHERE id=$2', [new Date('2020-01-01T00:00:00Z'), closedFinal.id]);
    expect((await listed(closedIncident.id)).initial_evidence.id).toBe(closedInitial.id);
    await closeIncident(context.admin, noImageIncident.id).expect(200);
    expect((await listed(noImageIncident.id)).initial_evidence).toBeNull();
  });

  it('obtiene una sola miniatura por incidencia con una consulta bulk y conserva los filtros', async () => {
    const queries = vi.spyOn(context.pool, 'query');
    try {
      const response = await context.admin.get('/api/incidents').expect(200);
      expect(response.body.incidents).toHaveLength(4);
      expect(queries.mock.calls.filter(([sql]) => String(sql).includes('FROM maintenance_evidences'))).toHaveLength(1);
    } finally { queries.mockRestore(); }
    const filtered = await context.admin.get('/api/incidents').query({ status: 'CLOSED', search: closedIncident.code }).expect(200);
    expect(filtered.body.incidents.map((item) => item.id)).toEqual([closedIncident.id]);
    expect(filtered.body.incidents[0].initial_evidence.id).toBe(closedInitial.id);
  });
});
