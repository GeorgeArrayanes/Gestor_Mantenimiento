import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';
import { readFile } from '../src/services/storage.js';
import { createIncident, fixture, PDF, PNG } from './helpers.js';

let context;
beforeAll(async () => { context = await fixture(); });
afterAll(async () => context?.pool.end());

async function counts() {
  const { pool } = context;
  return {
    incidents: Number((await pool.query('SELECT COUNT(*) AS count FROM maintenance_incidents')).rows[0].count),
    evidence: Number((await pool.query('SELECT COUNT(*) AS count FROM maintenance_evidences')).rows[0].count),
    history: Number((await pool.query('SELECT COUNT(*) AS count FROM maintenance_history')).rows[0].count)
  };
}

describe('evidencia validada y privada', () => {
  it('admite imágenes y PDF iniciales y entrega archivos sólo al administrador autenticado', async () => {
    const { admin, app, spaces } = context;
    const created = await createIncident(admin, spaces[0].id)
      .attach('files', PNG, { filename: 'inicial.png', contentType: 'image/png' })
      .attach('files', PDF, { filename: 'reporte.pdf', contentType: 'application/pdf' }).expect(201);
    const detail = (await admin.get(`/api/incidents/${created.body.incident.id}`).expect(200)).body;
    expect(detail.evidences).toHaveLength(2);
    for (const evidence of detail.evidences) {
      expect(evidence.storage_key).toBeUndefined();
      expect(evidence.file_url).toBe(`/api/evidences/${evidence.id}/download`);
      await request(app).get(evidence.file_url).expect(401);
      const download = await admin.get(evidence.file_url).expect(200);
      expect(download.headers['content-type']).toContain(evidence.file_type);
      expect(download.headers['content-disposition']).toContain('attachment');
      expect(download.headers['cache-control']).toMatch(/private|no-store/);
    }
    await request(app).get('/uploads/maintenance/1/inicial.png').expect(404);
    await admin.get('/api/evidences/999999/download').expect(404);
  });

  it('rechaza MIME falsificado, formatos no permitidos y archivos vacíos sin crear registros', async () => {
    const before = await counts();
    for (const file of [
      { data: Buffer.from('<script>alert(1)</script>'), name: 'fake.png', type: 'image/png' },
      { data: PNG, name: 'foto.svg', type: 'image/svg+xml' },
      { data: Buffer.alloc(0), name: 'vacia.jpg', type: 'image/jpeg' },
      { data: Buffer.from('%PDF-1.4\nmissing end marker'), name: 'broken.pdf', type: 'application/pdf' }
    ]) {
      const rejected = await createIncident(context.admin, context.spaces[0].id)
        .attach('files', file.data, { filename: file.name, contentType: file.type }).expect(400);
      expect(rejected.body.message).toEqual(expect.any(String));
      expect(rejected.body.stack).toBeUndefined();
    }
    expect(await counts()).toEqual(before);
  });

  it('rechaza más de cinco archivos y tamaño excesivo sin dejar registros parciales', async () => {
    const before = await counts();
    let excess = createIncident(context.admin, context.spaces[0].id);
    for (let index = 0; index < 6; index += 1) excess = excess.attach('files', PNG, { filename: `${index}.png`, contentType: 'image/png' });
    await excess.expect(400);
    const oversized = Buffer.alloc(config.maxFileSize + 1);
    PNG.copy(oversized);
    const rejected = await createIncident(context.admin, context.spaces[0].id)
      .attach('files', oversized, { filename: 'grande.png', contentType: 'image/png' }).expect(400);
    expect(rejected.body.message).toMatch(/tamaño|máximo/i);
    expect(await counts()).toEqual(before);
  });

  it('rechaza un cierre con PDF sin foto y conserva la incidencia asignada', async () => {
    const { admin, spaces, personnel } = context;
    const incident = (await createIncident(admin, spaces[0].id, { assigned_person_id: personnel[0].id }).expect(201)).body.incident;
    const before = await counts();
    await admin.post(`/api/incidents/${incident.id}/close`)
      .field('resolution_notes', 'Se ajustó la tubería del lavamanos.')
      .field('confirmed', 'true')
      .attach('files', PDF, { filename: 'acta.pdf', contentType: 'application/pdf' }).expect(400);
    expect(await counts()).toEqual(before);
    expect((await admin.get(`/api/incidents/${incident.id}`).expect(200)).body.incident.status).toBe('ASSIGNED');
  });

  it('revierte la incidencia y limpia archivos si falla persistir una evidencia', async () => {
    const { admin, spaces, pool } = context;
    const before = await counts();
    const rawConnect = pool.connect.bind(pool);
    const storedKeys = [];
    pool.connect = (callback) => {
      // pg.Pool.query uses connect(callback), while transaction() awaits the
      // promise form. Inject only into the latter and preserve both contracts.
      if (typeof callback === 'function') return rawConnect(callback);
      return rawConnect().then((client) => {
        const originalQuery = client.query;
        const originalRelease = client.release;
        client.query = (...args) => {
          const [sql, values] = args;
          if (String(sql).startsWith('INSERT INTO maintenance_evidences')) {
            storedKeys.push(values[1]);
            if (storedKeys.length === 2) throw new Error('Storage metadata failure simulated by test');
          }
          return originalQuery.apply(client, args);
        };
        client.release = (...args) => {
          client.query = originalQuery;
          client.release = originalRelease;
          return originalRelease.apply(client, args);
        };
        return client;
      });
    };
    try {
      await createIncident(admin, spaces[0].id)
        .attach('files', PNG, { filename: 'primera.png', contentType: 'image/png' })
        .attach('files', PNG, { filename: 'segunda.png', contentType: 'image/png' }).expect(500);
    } finally { pool.connect = rawConnect; }
    expect(await counts()).toEqual(before);
    expect(storedKeys).toHaveLength(2);
    for (const key of storedKeys) await expect(readFile(key)).rejects.toMatchObject({ status: 404 });
  });
});

describe('autorización obligatoria del servidor', () => {
  it('protege todos los módulos y las operaciones de incidencia sin sesión', async () => {
    const { app } = context;
    for (const path of ['/api/dashboard', '/api/incidents', '/api/incidents/1', '/api/personnel', '/api/spaces', '/api/users', '/api/evidences/1/download', '/api/incidents/1/whatsapp']) {
      await request(app).get(path).expect(401);
    }
    for (const path of ['/api/incidents', '/api/incidents/1/assign', '/api/incidents/1/close', '/api/personnel', '/api/spaces', '/api/users']) {
      await request(app).post(path).send({}).expect(401);
    }
    for (const path of ['/api/incidents/1', '/api/personnel/1', '/api/spaces/1', '/api/users/1']) {
      await request(app).patch(path).send({}).expect(401);
    }
  });

  it('rechaza tokens inválidos y elimina las rutas del antiguo dominio', async () => {
    await request(context.app).get('/api/dashboard').set('Authorization', 'Bearer invalid').expect(401);
    const user = (await context.pool.query("SELECT id FROM users WHERE role='ADMIN' LIMIT 1")).rows[0];
    const tokenFromAnotherApp = jwt.sign({ id: user.id }, config.jwtSecret);
    await request(context.app).get('/api/dashboard').set('Authorization', `Bearer ${tokenFromAnotherApp}`).expect(401);
    await context.admin.get('/api/buses').expect(404);
    await context.admin.get('/api/notifications').expect(404);
    const created = (await createIncident(context.admin, context.spaces[0].id).expect(201)).body.incident;
    for (const suffix of ['start', 'submit', 'approve', 'reject', 'evidences']) {
      await context.admin.post(`/api/incidents/${created.id}/${suffix}`).send({}).expect(404);
    }
  });

  it('rechaza escrituras con cookie desde un origen externo y permite el origen configurado', async () => {
    const data = { name: 'Espacio autorizado', zone: 'Prueba de origen', active: true };
    await context.admin.post('/api/spaces').set('Origin', 'https://untrusted.test').send(data).expect(403);
    await context.admin.post('/api/spaces').set('Origin', config.frontendUrl).send(data).expect(201);
    await request(context.app).post('/api/auth/login').set('Origin', 'https://untrusted.test')
      .send({ username: 'admin@mantenimiento.test', password: 'Mantenimiento2026!' }).expect(403);
  });

  it('impide autenticar y autorizar una cuenta heredada de trabajador', async () => {
    const { pool, app } = context;
    const password = (await pool.query("SELECT password_hash FROM users WHERE role='ADMIN' LIMIT 1")).rows[0].password_hash;
    const legacy = (await pool.query(`INSERT INTO users(name,identification,username,password_hash,role,status)
      VALUES('Trabajador heredado','LEGACY-001','legacy@mantenimiento.test',$1,'CONDUCTOR','ACTIVO') RETURNING id`, [password])).rows[0];
    await request(app).post('/api/auth/login').send({ username: 'legacy@mantenimiento.test', password: 'Mantenimiento2026!' }).expect(401);
    const token = jwt.sign({ id: legacy.id }, config.jwtSecret, { algorithm: 'HS256', issuer: 'gestor-mantenimiento', audience: 'mantenimiento-admin' });
    for (const path of ['/api/dashboard', '/api/personnel', '/api/spaces', '/api/incidents', '/api/users', '/api/evidences/1/download']) {
      await request(app).get(path).set('Authorization', `Bearer ${token}`).expect(403);
    }
    await request(app).post('/api/incidents').set('Authorization', `Bearer ${token}`).send({}).expect(403);
  });

  it('limita intentos de acceso incluso cuando llegan simultáneamente', async () => {
    await context.admin.post('/api/auth/login').send({ username: 'admin@mantenimiento.test', password: 'Mantenimiento2026!' }).expect(200);
    const attempts = await Promise.all(Array.from({ length: 25 }, () => request(context.app)
      .post('/api/auth/login').send({ username: 'missing@mantenimiento.test', password: 'incorrecta' })));
    expect(attempts.filter((response) => response.status === 401)).toHaveLength(20);
    expect(attempts.filter((response) => response.status === 429)).toHaveLength(5);
    expect(attempts.every((response) => !response.body.stack)).toBe(true);
  });
});
