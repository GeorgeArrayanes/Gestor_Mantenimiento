import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { activePerson, activeSpace, addHistory, transaction } from './services/incident-service.js';

const DEMO_PASSWORD = 'Mantenimiento2026!';
function demoAllowed() { return config.nodeEnv !== 'production' && (config.nodeEnv === 'test' || config.memoryDb || config.demoSeed); }

export async function bootstrapSuperAdmin(pool) {
  const username = config.superAdminEmail || (demoAllowed() ? 'superadmin@mantenimiento.test' : '');
  if (!username || !/^\S+@\S+\.\S+$/.test(username)) throw new Error('Configura SUPER_ADMIN_EMAIL con el correo de la cuenta principal.');
  const existing = (await pool.query('SELECT id,role FROM users WHERE LOWER(username)=LOWER($1) LIMIT 1', [username])).rows[0];
  if (existing) {
    if (existing.role !== 'SUPER_ADMIN') throw new Error('La cuenta configurada ya existe con otro rol; no se promovió automáticamente.');
    return existing.id;
  }
  const password = config.superAdminPassword || (demoAllowed() ? DEMO_PASSWORD : '');
  if (password.length < 12) throw new Error('Configura SUPER_ADMIN_PASSWORD con al menos 12 caracteres.');
  const hash = await bcrypt.hash(password, 12);
  return (await pool.query(`INSERT INTO users(name,identification,username,phone,password_hash,role,status) VALUES('Administrador General','SA-MANT-001',$1,NULL,$2,'SUPER_ADMIN','ACTIVO') RETURNING id`, [username,hash])).rows[0].id;
}

export async function seedDatabase(pool, { incidents = true } = {}) {
  if (!demoAllowed()) throw new Error('La semilla de demostración requiere prueba, DEV_MEMORY_DB=true o ALLOW_DEMO_SEED=true; está prohibida en producción.');
  await bootstrapSuperAdmin(pool);
  if ((await pool.query("SELECT id FROM users WHERE username='admin@mantenimiento.test'")).rowCount) return;
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  await transaction(pool, async (client) => {
    const admin = (await client.query(`INSERT INTO users(name,identification,username,phone,password_hash,role) VALUES('Elena Ríos','ADM-MANT-001','admin@mantenimiento.test','3001112233',$1,'ADMIN') RETURNING id`, [hash])).rows[0];
    const people = await client.query(`INSERT INTO maintenance_personnel(name,phone,specialty) VALUES
      ('Carlos Rodríguez','+57 300 222 3344','Electricidad'),('Pedro Gómez','+57 300 333 4455','Mantenimiento general'),('Luis Martínez','+57 300 444 5566','Plomería') RETURNING *`);
    const spaces = await client.query(`INSERT INTO maintenance_spaces(name,zone) VALUES('Baño Bloque A','Bloque A'),('Salón 101','Bloque A'),('Biblioteca','Bloque B'),('Portería','Exteriores') RETURNING *`);
    if (!incidents) return;
    const fixtures = [
      { space: spaces.rows.find((s) => s.name === 'Baño Bloque A'), person: null, type: 'PLOMERIA', priority: 'ALTA', description: 'Fuga debajo del lavamanos. Revisar las conexiones y controlar la pérdida de agua.' },
      { space: spaces.rows.find((s) => s.name === 'Salón 101'), person: people.rows.find((p) => p.name === 'Carlos Rodríguez'), type: 'ILUMINACION', priority: 'MEDIA', description: 'La luminaria del área del tablero presenta fallas y necesita revisión eléctrica.' }
    ];
    for (const fixture of fixtures) {
      const s = await activeSpace(client, fixture.space.id);
      const p = fixture.person ? await activePerson(client, fixture.person.id) : null;
      const status = p ? 'ASSIGNED' : 'PENDING';
      const incident = (await client.query(`INSERT INTO maintenance_incidents(space_id,space_name_snapshot,space_zone_snapshot,problem_type,priority,description,assigned_person_id,assigned_person_name_snapshot,assigned_person_phone_snapshot,status,created_by,assigned_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [s.id,s.name,s.zone,fixture.type,fixture.priority,fixture.description,p?.id || null,p?.name || null,p?.phone || null,status,admin.id,p ? new Date() : null])).rows[0];
      const year = new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric' }).format(new Date(incident.created_at));
      await client.query('UPDATE maintenance_incidents SET code=$1 WHERE id=$2', [`MT-${year}-${String(incident.id).padStart(3, '0')}`,incident.id]);
      await addHistory(client, { id: incident.id, status: null }, admin.id, 'INCIDENCIA_CREADA', 'PENDING', 'Registro de demostración.');
      if (p) await addHistory(client, { id: incident.id, status: 'PENDING' }, admin.id, 'RESPONSABLE_ASIGNADO', 'ASSIGNED', `Asignada a ${p.name}.`);
    }
  });
}
