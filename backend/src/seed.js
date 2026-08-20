import bcrypt from 'bcryptjs';

export async function seedDatabase(pool) {
  const existing = await pool.query("SELECT 1 FROM users WHERE username='admin@rutasegura.test'");
  if (existing.rowCount) return;
  const passwordHash = await bcrypt.hash('RutaSegura2026!', 12);
  const admin = (await pool.query(`INSERT INTO users(name,identification,username,phone,password_hash,role) VALUES
    ('Elena Ríos','ADM-001','admin@rutasegura.test','3001112233',$1,'ADMIN') RETURNING id`, [passwordHash])).rows[0];
  const drivers = await pool.query(`INSERT INTO users(name,identification,username,phone,password_hash,role) VALUES
    ('Carlos Mendoza','CC-1001','carlos@rutasegura.test','3002223344',$1,'CONDUCTOR'),
    ('Roberto Juárez','CC-1002','roberto@rutasegura.test','3003334455',$1,'CONDUCTOR') RETURNING id,name`, [passwordHash]);
  const carlos = drivers.rows.find((u) => u.name.startsWith('Carlos'));
  const roberto = drivers.rows.find((u) => u.name.startsWith('Roberto'));
  const buses = await pool.query(`INSERT INTO buses(reference,plate,brand,model,route,capacity,current_status,driver_id) VALUES
    ('Bus 04','HJT-452','Volkswagen','Transporter T6','Ruta A - Norte Chicó',18,'CON_NOVEDADES',$1),
    ('Bus 12','MRX-890','Mercedes-Benz','Sprinter 415','Ruta B - Suba',22,'CON_NOVEDADES',$2),
    ('Bus 09','NKL-312','Chevrolet','NKR Escolar','Ruta C - Cedritos',20,'OPERATIVO',NULL) RETURNING id,reference`, [carlos.id,roberto.id]);
  const bus04 = buses.rows.find((b) => b.reference === 'Bus 04');
  const bus12 = buses.rows.find((b) => b.reference === 'Bus 12');
  const incidents = await pool.query(`INSERT INTO incidents(bus_id,reported_by,responsible_driver_id,damage_type,description,urgency,status,attention_started_at) VALUES
    ($1,$3,$4,'LUCES_ELECTRICO','La mica del faro trasero izquierdo está rota y permite el ingreso de agua. Requiere reemplazo antes de la ruta de la tarde.','ALTA','REPORTADO',NULL),
    ($2,$3,$5,'MOTOR','El alternador presenta variaciones de voltaje y el testigo de batería permanece encendido.','MEDIA','EN_PROCESO',NOW()) RETURNING id,status,responsible_driver_id`, [bus04.id,bus12.id,admin.id,carlos.id,roberto.id]);
  for (const incident of incidents.rows) {
    await pool.query(`INSERT INTO incident_history(incident_id,user_id,event_type,new_status,comment) VALUES($1,$2,'NOVEDAD_CREADA','REPORTADO','Registro de desarrollo')`, [incident.id,admin.id]);
    if (incident.status === 'EN_PROCESO') await pool.query(`INSERT INTO incident_history(incident_id,user_id,event_type,previous_status,new_status) VALUES($1,$2,'REPARACION_INICIADA','REPORTADO','EN_PROCESO')`, [incident.id,incident.responsible_driver_id]);
    await pool.query(`INSERT INTO notifications(user_id,message,type,reference_url) VALUES($1,$2,'NUEVA_NOVEDAD',$3)`, [incident.responsible_driver_id,`Nueva novedad asignada: #${incident.id}.`,`/novedades/${incident.id}`]);
  }
  await pool.query(`INSERT INTO preexisting_damages(bus_id,description,damage_date,registered_by) VALUES($1,'Rayadura superficial en puerta lateral derecha.','2026-01-18',$2)`, [bus04.id,admin.id]);
}
