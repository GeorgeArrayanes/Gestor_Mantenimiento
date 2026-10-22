import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import { CAMPUS_REGIONS, CAMPUS_REGION_IDS } from '../../shared/campus-regions.mjs';
import { config } from '../src/config.js';
import { fixture } from './helpers.js';

let context;
const previousConfig = {
  nodeEnv: config.nodeEnv,
  supabaseUrl: config.supabaseUrl,
  supabaseKey: config.supabaseKey,
  superAdminEmail: config.superAdminEmail,
  superAdminPassword: config.superAdminPassword
};

beforeAll(async () => {
  // This suite always uses a disposable in-memory database and image store,
  // even when a developer has configured external services in their shell.
  vi.stubEnv('TEST_POSTGRES_URL', '');
  Object.assign(config, { supabaseUrl: '', supabaseKey: '', superAdminEmail: '', superAdminPassword: '' });
  context = await fixture();
});

afterAll(async () => {
  try { await context?.pool.end(); }
  finally {
    Object.assign(config, previousConfig);
    vi.unstubAllEnvs();
  }
});

async function storedSpace(id) {
  return (await context.pool.query('SELECT * FROM maintenance_spaces WHERE id=$1', [id])).rows[0];
}

async function listedSpace(id) {
  return (await context.admin.get('/api/spaces').expect(200)).body.spaces.find(space => space.id === id);
}

async function spaceCount() {
  return Number((await context.pool.query('SELECT COUNT(*) AS count FROM maintenance_spaces')).rows[0].count);
}

describe('asociación explícita de espacios con el campus', () => {
  it.each(CAMPUS_REGION_IDS)('crea y devuelve la asociación %s sin perder nombre, zona o estado', async (regionId) => {
    const data = {
      name: `Espacio de prueba ${regionId}`,
      zone: 'Zona de integración',
      active: regionId !== 'preescolar',
      campus_region_id: regionId
    };
    const created = (await context.admin.post('/api/spaces').send(data).expect(201)).body.space;

    expect(created).toMatchObject(data);
    expect(created.image_storage_key).toBeUndefined();
    expect(await storedSpace(created.id)).toMatchObject(data);
    expect(await listedSpace(created.id)).toMatchObject(data);
    const activeListing = (await context.admin.get(`/api/spaces?active=${data.active}`).expect(200)).body.spaces;
    expect(activeListing.some(space => space.id === created.id)).toBe(true);
  });

  it('permite varios espacios en un edificio y mantiene independientes dos edificios y uno sin vínculo', async () => {
    expect(CAMPUS_REGION_IDS).toHaveLength(21);
    const first = CAMPUS_REGIONS.find(region => region.id === 'administrativo');
    const second = CAMPUS_REGIONS.find(region => region.id === 'comedor');
    const data = [
      { name: 'Oficina del edificio', zone: 'Prueba de agrupación', campus_region_id: first.id },
      { name: 'Archivo del edificio', zone: 'Prueba de agrupación', campus_region_id: first.id },
      { name: 'Cocina del edificio', zone: 'Prueba de agrupación', campus_region_id: second.id },
      // An exact catalog label in both fields must never assign a region.
      { name: first.label, zone: first.label }
    ];
    const created = [];
    for (const entry of data) created.push((await context.admin.post('/api/spaces').send(entry).expect(201)).body.space);
    const spaces = (await context.admin.get('/api/spaces').expect(200)).body.spaces;
    const selected = created.map(space => spaces.find(entry => entry.id === space.id));

    expect(selected.map(space => space.campus_region_id)).toEqual([first.id, first.id, second.id, null]);
    for (const space of selected) {
      expect((await storedSpace(space.id)).campus_region_id).toBe(space.campus_region_id);
    }
    expect(context.spaces.every(space => space.campus_region_id === null)).toBe(true);
  });

  it('conserva el vínculo al editar otros campos y permite cambiarlo explícitamente', async () => {
    const created = (await context.admin.post('/api/spaces').send({
      name: 'Sala con vínculo persistente', zone: 'Zona original', campus_region_id: 'bachillerato'
    }).expect(201)).body.space;
    const updated = (await context.admin.patch(`/api/spaces/${created.id}`).send({
      name: 'Sala renombrada', zone: 'Zona nueva', active: false
    }).expect(200)).body.space;

    expect(updated).toMatchObject({ name: 'Sala renombrada', zone: 'Zona nueva', active: false, campus_region_id: 'bachillerato' });
    expect(await storedSpace(created.id)).toMatchObject({ campus_region_id: 'bachillerato', active: false });
    expect(await listedSpace(created.id)).toMatchObject({ campus_region_id: 'bachillerato' });

    await context.admin.patch(`/api/spaces/${created.id}`).send({ campus_region_id: 'grado-11' }).expect(200);
    expect(await listedSpace(created.id)).toMatchObject({ campus_region_id: 'grado-11' });
    expect((await storedSpace(created.id)).campus_region_id).toBe('grado-11');
  });

  it('mantiene cinco listas independientes con nombres y ubicaciones internos idénticos', async () => {
    const ids = ['bloque-1', 'bloque-2', 'bloque-3', 'bloque-4', 'bloque-atravesado'];
    const created = [];
    for (const regionId of ids) {
      created.push((await context.admin.post('/api/spaces').send({
        name: 'Salón 101 de separación', zone: 'Primer piso', campus_region_id: regionId
      }).expect(201)).body.space);
    }
    const listed = (await context.admin.get('/api/spaces').expect(200)).body.spaces;
    for (const [index, regionId] of ids.entries()) {
      expect(listed.filter(space => space.campus_region_id === regionId && space.name === 'Salón 101 de separación'))
        .toEqual([expect.objectContaining({ id: created[index].id, campus_region_id: regionId })]);
    }
    const before = await storedSpace(created[0].id);
    await context.admin.post('/api/spaces').send({
      name: before.name, zone: before.zone, campus_region_id: before.campus_region_id
    }).expect(409);
    // Moving an existing classroom must not overwrite its peer in another block.
    await context.admin.patch(`/api/spaces/${created[0].id}`).send({ campus_region_id: 'bloque-2' }).expect(409);
    expect(await storedSpace(created[0].id)).toEqual(before);
  });

  it('conserva los espacios compartidos heredados sin repartirlos entre los nuevos bloques', async () => {
    const created = (await context.admin.post('/api/spaces').send({
      name: 'Sala común anterior', zone: 'Circulación compartida', campus_region_id: 'bloques-salones'
    }).expect(201)).body.space;
    await context.admin.patch(`/api/spaces/${created.id}`).send({ name: 'Sala común renombrada' }).expect(200);
    expect(await listedSpace(created.id)).toMatchObject({ campus_region_id: 'bloques-salones' });
    expect(CAMPUS_REGIONS.find(region => region.id === 'bloques-salones')).toMatchObject({ legacy: true });
    await context.admin.patch(`/api/spaces/${created.id}`).send({ campus_region_id: 'bloque-4' }).expect(200);
    expect(await listedSpace(created.id)).toMatchObject({ campus_region_id: 'bloque-4' });
  });

  it.each([null, 'bloques-salones'])('conserva la unicidad dentro del ámbito %j', async regionId => {
    const data = { name: `Espacio único ${regionId || 'sin edificio'}`, zone: 'Planta baja', campus_region_id: regionId };
    await context.admin.post('/api/spaces').send(data).expect(201);
    await context.admin.post('/api/spaces').send(data).expect(409);
    await context.admin.post('/api/spaces').send({ ...data, campus_region_id: 'bloque-1' }).expect(201);
  });

  it.each([null, ''])('desvincula un espacio con campus_region_id=%j', async (emptyRegion) => {
    const created = (await context.admin.post('/api/spaces').send({
      name: `Espacio para desvincular ${emptyRegion === null ? 'nulo' : 'vacío'}`, zone: 'Zona de integración', campus_region_id: 'danzas-1'
    }).expect(201)).body.space;
    const updated = (await context.admin.patch(`/api/spaces/${created.id}`).send({ campus_region_id: emptyRegion }).expect(200)).body.space;

    expect(updated.campus_region_id).toBeNull();
    expect((await storedSpace(created.id)).campus_region_id).toBeNull();
    expect((await listedSpace(created.id)).campus_region_id).toBeNull();
    expect(updated).toMatchObject({ name: created.name, zone: created.zone, active: created.active });
  });

  it.each(['edificio-inexistente', 'Edificio Administrativo', 'ADMINISTRATIVO', 16, ['administrativo']].map(regionId => [regionId]))('rechaza la región inválida %j sin insertar ni modificar espacios', async (regionId) => {
    const created = (await context.admin.post('/api/spaces').send({
      name: `Espacio válido antes del rechazo ${JSON.stringify(regionId)}`, zone: 'Zona segura', campus_region_id: 'tienda-1'
    }).expect(201)).body.space;
    const beforeCount = await spaceCount();
    const before = await storedSpace(created.id);

    await context.admin.post('/api/spaces').send({
      name: 'Espacio que no debe guardarse', zone: 'Zona rechazada', campus_region_id: regionId
    }).expect(400);
    await context.admin.patch(`/api/spaces/${created.id}`).send({
      name: 'Cambio que no debe guardarse', campus_region_id: regionId
    }).expect(400);

    expect(await spaceCount()).toBe(beforeCount);
    expect(await storedSpace(created.id)).toEqual(before);
    expect(await listedSpace(created.id)).toMatchObject({ name: created.name, campus_region_id: 'tienda-1' });
  });
});

describe('fotografía de un espacio vinculado', () => {
  it('guarda y sirve los bytes optimizados con el nombre, MIME, tamaño y dimensiones correspondientes', async () => {
    const png = await sharp({ create: { width: 512, height: 384, channels: 3, background: '#4b81b4' } })
      .png({ compressionLevel: 0 }).toBuffer();
    expect(png.length).toBeGreaterThan(1024);
    const created = (await context.admin.post('/api/spaces')
      .field('name', 'Sala con foto del campus')
      .field('zone', 'Zona de fotografías')
      .field('active', 'true')
      .field('campus_region_id', 'primeros-auxilios')
      .attach('image', png, { filename: 'foto.espacio.png', contentType: 'image/png' })
      .expect(201)).body.space;
    const stored = await storedSpace(created.id);
    const listed = await listedSpace(created.id);
    const image = await context.admin.get(listed.image_url).buffer(true).expect(200);
    const metadata = await sharp(image.body).metadata();
    const decoded = await sharp(image.body).raw().toBuffer({ resolveWithObject: true });

    expect(created.campus_region_id).toBe('primeros-auxilios');
    expect(stored.campus_region_id).toBe('primeros-auxilios');
    expect(stored.image_storage_key).toMatch(/^memory:directory\/spaces\//);
    expect(created.image_storage_key).toBeUndefined();
    expect(listed.image_storage_key).toBeUndefined();
    expect(listed.image_url).toBe(created.image_url);
    expect(stored.image_file_type).toBe('image/webp');
    expect(stored.image_file_name).toBe('foto.espacio.webp');
    expect(stored.image_file_size).toBeLessThan(png.length);
    expect(image.body).toBeInstanceOf(Buffer);
    expect(image.body.length).toBe(stored.image_file_size);
    expect(image.headers['content-length']).toBe(String(stored.image_file_size));
    expect(image.headers['content-type']).toContain(stored.image_file_type);
    expect(image.headers['cache-control']).toContain('private');
    expect(metadata).toMatchObject({ format: 'webp', width: 512, height: 384 });
    expect(decoded.info).toMatchObject({ width: 512, height: 384, channels: 3 });
    expect(listed).toMatchObject({
      image_file_type: stored.image_file_type,
      image_file_name: stored.image_file_name,
      image_file_size: stored.image_file_size
    });
    await request(context.app).get(listed.image_url).expect(401);
  });
});

describe('autorización de la asociación del campus', () => {
  it('exige sesión para consultar, crear y editar sin modificar datos', async () => {
    const beforeCount = await spaceCount();
    const space = context.spaces[0];
    const before = await storedSpace(space.id);
    await request(context.app).get('/api/spaces').expect(401);
    await request(context.app).post('/api/spaces').send({
      name: 'Espacio sin autorización', zone: 'Zona de integración', campus_region_id: 'economato'
    }).expect(401);
    await request(context.app).patch(`/api/spaces/${space.id}`).send({ campus_region_id: 'economato' }).expect(401);
    expect(await spaceCount()).toBe(beforeCount);
    expect(await storedSpace(space.id)).toEqual(before);
  });

  it('rechaza el rol heredado de trabajador en lectura y escritura', async () => {
    const { pool, app, spaces } = context;
    const passwordHash = (await pool.query("SELECT password_hash FROM users WHERE role='ADMIN' LIMIT 1")).rows[0].password_hash;
    const legacyUser = (await pool.query(`INSERT INTO users(name,identification,username,password_hash,role,status)
      VALUES('Trabajador del campus','CAMPUS-LEGACY','campus-legacy@mantenimiento.test',$1,'CONDUCTOR','ACTIVO') RETURNING id`, [passwordHash])).rows[0];
    const token = jwt.sign({ id: legacyUser.id }, config.jwtSecret, {
      algorithm: 'HS256', issuer: 'gestor-mantenimiento', audience: 'mantenimiento-admin'
    });
    const beforeCount = await spaceCount();
    const before = await storedSpace(spaces[0].id);
    await request(app).get('/api/spaces').set('Authorization', `Bearer ${token}`).expect(403);
    await request(app).post('/api/spaces').set('Authorization', `Bearer ${token}`).send({
      name: 'Espacio de trabajador', zone: 'Zona de integración', campus_region_id: 'economato'
    }).expect(403);
    await request(app).patch(`/api/spaces/${spaces[0].id}`).set('Authorization', `Bearer ${token}`)
      .send({ campus_region_id: 'economato' }).expect(403);
    expect(await spaceCount()).toBe(beforeCount);
    expect(await storedSpace(spaces[0].id)).toEqual(before);
  });
});
