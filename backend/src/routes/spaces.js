import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { requireRole } from '../middleware/auth.js';
import { deleteFile, prepareUpload, readFile, safeFileName, saveDirectoryImage, validateImageUpload } from '../services/storage.js';
import { CAMPUS_REGION_IDS } from '../../../shared/campus-regions.mjs';
import { asyncHandler } from '../utils/async-handler.js';
import { httpError, parseId } from '../utils/maintenance.js';
import { transaction } from '../services/incident-service.js';

const router = Router();
router.use(requireRole('ADMIN'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxFileSize, files: 1, fields: 6, parts: 7 } });
const formBoolean = z.preprocess((value) => value === 'true' ? true : value === 'false' ? false : value, z.boolean());
const schema = z.object({
  name: z.string().trim().min(2).max(120),
  zone: z.string().trim().min(2).max(120),
  campus_region_id: z.preprocess(value => value === '' ? null : value, z.enum(CAMPUS_REGION_IDS).nullable()).optional(),
  active: formBoolean.optional(),
  remove_image: formBoolean.optional(),
}).strict();

function publicSpace(row) {
  const { image_storage_key, ...space } = row;
  const version = new Date(row.updated_at).getTime();
  return { ...space, image_url: image_storage_key ? `/api/spaces/${row.id}/image?v=${Number.isFinite(version) ? version : 0}` : null };
}

async function removeReplacedImage(key) {
  if (!key) return;
  try { await deleteFile(key); }
  catch (error) { console.error('No fue posible retirar la imagen anterior del espacio.', error.message); }
}

router.get('/', asyncHandler(async (req, res) => {
  if (req.query.active && !['true','false'].includes(req.query.active)) throw httpError(400, 'Filtro de espacios inválido.');
  const { rows } = await req.app.locals.db.query(`SELECT * FROM maintenance_spaces ${req.query.active ? 'WHERE active=$1' : ''} ORDER BY zone,name`, req.query.active ? [req.query.active === 'true'] : []);
  res.json({ spaces: rows.map(publicSpace) });
}));

router.get('/:id/image', asyncHandler(async (req, res) => {
  const { rows } = await req.app.locals.db.query('SELECT image_storage_key,image_file_type,image_file_size FROM maintenance_spaces WHERE id=$1', [parseId(req.params.id)]);
  const image = rows[0];
  if (!image?.image_storage_key) throw httpError(404, 'Este espacio no tiene una imagen.');
  const file = await readFile(image.image_storage_key);
  res.set({ 'Content-Type': image.image_file_type, 'Content-Length': String(file.length), 'Cache-Control': 'private, max-age=300' });
  res.send(file);
}));

router.post('/', upload.single('image'), asyncHandler(async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw httpError(400, 'Completa el nombre y la zona del espacio.');
  if (req.file) validateImageUpload(req.file);
  if (req.file) req.file = await prepareUpload(req.file);
  const d = parsed.data;
  const space = await transaction(req.app.locals.db, async (client, savedKeys) => {
    let { rows } = await client.query('INSERT INTO maintenance_spaces(name,zone,active,campus_region_id) VALUES($1,$2,$3,$4) RETURNING *', [d.name,d.zone,d.active ?? true,d.campus_region_id ?? null]);
    if (!req.file) return rows[0];
    const key = await saveDirectoryImage(req.file, 'spaces', rows[0].id);
    savedKeys.push(key);
    ({ rows } = await client.query(`UPDATE maintenance_spaces SET image_storage_key=$1,image_file_name=$2,image_file_type=$3,image_file_size=$4 WHERE id=$5 RETURNING *`, [key,safeFileName(req.file.originalname),req.file.mimetype,req.file.buffer.length,rows[0].id]));
    return rows[0];
  });
  res.status(201).json({ space: publicSpace(space) });
}));

router.patch('/:id', upload.single('image'), asyncHandler(async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success || (!Object.keys(parsed.data).length && !req.file)) throw httpError(400, 'Datos de espacio inválidos.');
  if (req.file) validateImageUpload(req.file);
  if (req.file) req.file = await prepareUpload(req.file);
  const result = await transaction(req.app.locals.db, async (client, savedKeys) => {
    const current = (await client.query('SELECT * FROM maintenance_spaces WHERE id=$1 FOR UPDATE', [parseId(req.params.id)])).rows[0];
    if (!current) throw httpError(404, 'Espacio inexistente.');
    const d = { ...current, ...parsed.data };
    let key = current.image_storage_key;
    let fileName = current.image_file_name;
    let fileType = current.image_file_type;
    let fileSize = current.image_file_size;
    if (req.file) {
      key = await saveDirectoryImage(req.file, 'spaces', current.id);
      savedKeys.push(key);
      fileName = safeFileName(req.file.originalname);
      fileType = req.file.mimetype;
      fileSize = req.file.buffer.length;
    } else if (d.remove_image) {
      key = null; fileName = null; fileType = null; fileSize = null;
    }
    const { rows } = await client.query(`UPDATE maintenance_spaces SET name=$1,zone=$2,active=$3,image_storage_key=$4,image_file_name=$5,image_file_type=$6,image_file_size=$7,campus_region_id=$8,updated_at=NOW() WHERE id=$9 RETURNING *`, [d.name,d.zone,d.active,key,fileName,fileType,fileSize,d.campus_region_id ?? null,current.id]);
    return { space: rows[0], replacedKey: current.image_storage_key && current.image_storage_key !== key ? current.image_storage_key : null };
  });
  await removeReplacedImage(result.replacedKey);
  res.json({ space: publicSpace(result.space) });
}));

export default router;
