import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { requireRole } from '../middleware/auth.js';
import { deleteFile, readFile, safeFileName, saveDirectoryImage, validateImageUpload } from '../services/storage.js';
import { asyncHandler } from '../utils/async-handler.js';
import { httpError, normalizePhone, parseId } from '../utils/maintenance.js';
import { transaction } from '../services/incident-service.js';

const router = Router();
router.use(requireRole('ADMIN'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxFileSize, files: 1, fields: 8, parts: 9 } });
const formBoolean = z.preprocess((value) => value === 'true' ? true : value === 'false' ? false : value, z.boolean());
const phoneSchema = z.string().trim().min(7).max(40).refine((phone) => { try { normalizePhone(phone); return true; } catch { return false; } });
const schema = z.object({
  name: z.string().trim().min(3).max(120),
  phone: phoneSchema,
  specialty: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(2000).nullable().optional(),
  active: formBoolean.optional(),
  remove_image: formBoolean.optional(),
}).strict();

function publicPerson(row) {
  const { image_storage_key, ...person } = row;
  const version = new Date(row.updated_at).getTime();
  return { ...person, image_url: image_storage_key ? `/api/personnel/${row.id}/image?v=${Number.isFinite(version) ? version : 0}` : null };
}

async function removeReplacedImage(key) {
  if (!key) return;
  try { await deleteFile(key); }
  catch (error) { console.error('No fue posible retirar la imagen anterior del personal.', error.message); }
}

router.get('/', asyncHandler(async (req, res) => {
  if (req.query.active && !['true','false'].includes(req.query.active)) throw httpError(400, 'Filtro de personal inválido.');
  const { rows } = await req.app.locals.db.query(`SELECT * FROM maintenance_personnel ${req.query.active ? 'WHERE active=$1' : ''} ORDER BY name`, req.query.active ? [req.query.active === 'true'] : []);
  res.json({ personnel: rows.map(publicPerson) });
}));

router.get('/:id/image', asyncHandler(async (req, res) => {
  const { rows } = await req.app.locals.db.query('SELECT image_storage_key,image_file_type,image_file_size FROM maintenance_personnel WHERE id=$1', [parseId(req.params.id)]);
  const image = rows[0];
  if (!image?.image_storage_key) throw httpError(404, 'Esta persona no tiene una imagen.');
  const file = await readFile(image.image_storage_key);
  res.set({ 'Content-Type': image.image_file_type, 'Content-Length': String(file.length), 'Cache-Control': 'private, max-age=300' });
  res.send(file);
}));

router.post('/', upload.single('image'), asyncHandler(async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw httpError(400, 'Completa nombre y especialidad e ingresa un teléfono válido con código de país.');
  if (req.file) validateImageUpload(req.file);
  const d = parsed.data;
  const person = await transaction(req.app.locals.db, async (client, savedKeys) => {
    let { rows } = await client.query(`INSERT INTO maintenance_personnel(name,phone,specialty,notes,active) VALUES($1,$2,$3,$4,$5) RETURNING *`, [d.name,d.phone,d.specialty,d.notes || null,d.active ?? true]);
    if (!req.file) return rows[0];
    const key = await saveDirectoryImage(req.file, 'personnel', rows[0].id);
    savedKeys.push(key);
    ({ rows } = await client.query(`UPDATE maintenance_personnel SET image_storage_key=$1,image_file_name=$2,image_file_type=$3,image_file_size=$4 WHERE id=$5 RETURNING *`, [key,safeFileName(req.file.originalname),req.file.mimetype,req.file.buffer.length,rows[0].id]));
    return rows[0];
  });
  res.status(201).json({ person: publicPerson(person) });
}));

router.patch('/:id', upload.single('image'), asyncHandler(async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success || (!Object.keys(parsed.data).length && !req.file)) throw httpError(400, 'Datos de personal inválidos. Verifica el teléfono y su código de país.');
  if (req.file) validateImageUpload(req.file);
  const result = await transaction(req.app.locals.db, async (client, savedKeys) => {
    const current = (await client.query('SELECT * FROM maintenance_personnel WHERE id=$1 FOR UPDATE', [parseId(req.params.id)])).rows[0];
    if (!current) throw httpError(404, 'Persona inexistente.');
    const d = { ...current, ...parsed.data };
    let key = current.image_storage_key;
    let fileName = current.image_file_name;
    let fileType = current.image_file_type;
    let fileSize = current.image_file_size;
    if (req.file) {
      key = await saveDirectoryImage(req.file, 'personnel', current.id);
      savedKeys.push(key);
      fileName = safeFileName(req.file.originalname);
      fileType = req.file.mimetype;
      fileSize = req.file.buffer.length;
    } else if (d.remove_image) {
      key = null; fileName = null; fileType = null; fileSize = null;
    }
    const { rows } = await client.query(`UPDATE maintenance_personnel SET name=$1,phone=$2,specialty=$3,notes=$4,active=$5,image_storage_key=$6,image_file_name=$7,image_file_type=$8,image_file_size=$9,updated_at=NOW() WHERE id=$10 RETURNING *`, [d.name,d.phone,d.specialty,d.notes || null,d.active,key,fileName,fileType,fileSize,current.id]);
    return { person: rows[0], replacedKey: current.image_storage_key && current.image_storage_key !== key ? current.image_storage_key : null };
  });
  await removeReplacedImage(result.replacedKey);
  res.json({ person: publicPerson(result.person) });
}));

export default router;
