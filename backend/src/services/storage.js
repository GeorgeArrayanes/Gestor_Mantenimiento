import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const extensions = new Map([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['application/pdf', '.pdf']]);
const ephemeral = new Map();
const invalid = (message) => Object.assign(new Error(message), { status: 400 });

export function validateUpload(file) {
  const buffer = file?.buffer;
  if (!file || !Buffer.isBuffer(buffer) || !buffer.length || buffer.length > config.maxFileSize) throw invalid('El archivo está vacío o supera el tamaño máximo permitido.');
  const mime = file.mimetype;
  if (!extensions.has(mime)) throw invalid('Formato no permitido. Usa JPG, PNG, WEBP o PDF.');
  const valid = mime === 'image/jpeg' ? buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9
    : mime === 'image/png' ? buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && buffer.toString('ascii',12,16) === 'IHDR'
      : mime === 'image/webp' ? buffer.length >= 16 && buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP' && buffer.readUInt32LE(4) + 8 === buffer.length
        : buffer.length >= 10 && buffer.toString('ascii',0,5) === '%PDF-' && buffer.subarray(-1024).includes(Buffer.from('%%EOF'));
  if (!valid) throw invalid('El contenido del archivo no coincide con su formato. Selecciona una imagen o PDF válido.');
}

export function validateImageUpload(file) {
  validateUpload(file);
  if (!file.mimetype.startsWith('image/')) throw invalid('Selecciona una imagen JPG, PNG o WEBP.');
}

export function validateUploads(files, { required = false } = {}) {
  if (required && !files?.length) throw invalid('Adjunta al menos una evidencia final para cerrar la incidencia.');
  if ((files?.length || 0) > config.maxFiles) throw invalid(`Selecciona máximo ${config.maxFiles} archivos.`);
  for (const file of files || []) validateUpload(file);
  if (required && !files.some((file) => file.mimetype.startsWith('image/'))) throw invalid('Adjunta al menos una fotografía de la solución. Puedes acompañarla con documentos PDF.');
}

function supabase() { return createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false } }); }
function localPath(key) {
  const relative = key.slice('local:'.length);
  const target = path.resolve(config.uploadRoot, relative);
  if (!target.startsWith(config.uploadRoot + path.sep)) throw new Error('Clave de almacenamiento inválida.');
  return target;
}

async function saveObject(file, objectName) {
  validateUpload(file);
  if (config.supabaseUrl && config.supabaseKey) {
    const { error } = await supabase().storage.from(config.supabaseBucket).upload(objectName, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw new Error('No fue posible almacenar la evidencia.');
    return `supabase:${objectName}`;
  }
  if (config.nodeEnv === 'test' || config.memoryDb) {
    const key = `memory:${objectName}`;
    ephemeral.set(key, Buffer.from(file.buffer));
    return key;
  }
  const key = `local:${objectName}`;
  const target = localPath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  try { await fs.writeFile(target, file.buffer, { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') await fs.rm(target, { force: true }); throw error; }
  return key;
}

export async function saveFile(file, incidentId) {
  return saveObject(file, `maintenance/${incidentId}/${crypto.randomUUID()}${extensions.get(file.mimetype)}`);
}

export async function saveDirectoryImage(file, kind, id) {
  validateImageUpload(file);
  if (!['spaces', 'personnel'].includes(kind) || !Number.isInteger(id) || id < 1) throw invalid('Destino de imagen inválido.');
  return saveObject(file, `directory/${kind}/${id}/${crypto.randomUUID()}${extensions.get(file.mimetype)}`);
}

export async function deleteFile(key) {
  if (key.startsWith('memory:')) { ephemeral.delete(key); return; }
  if (key.startsWith('supabase:')) {
    const { error } = await supabase().storage.from(config.supabaseBucket).remove([key.slice(9)]);
    if (error) throw new Error('No fue posible retirar la evidencia incompleta.');
    return;
  }
  if (key.startsWith('local:')) await fs.rm(localPath(key), { force: true });
}

export async function readFile(key) {
  if (key.startsWith('memory:')) {
    if (!ephemeral.has(key)) throw Object.assign(new Error('Evidencia no disponible.'), { status: 404 });
    return ephemeral.get(key);
  }
  if (key.startsWith('supabase:')) {
    const { data, error } = await supabase().storage.from(config.supabaseBucket).download(key.slice(9));
    if (error) throw Object.assign(new Error('Evidencia no disponible.'), { status: 404 });
    return Buffer.from(await data.arrayBuffer());
  }
  if (key.startsWith('local:')) {
    try { return await fs.readFile(localPath(key)); } catch (error) { if (error.code === 'ENOENT') throw Object.assign(new Error('Evidencia no disponible.'), { status: 404 }); throw error; }
  }
  throw Object.assign(new Error('Evidencia no disponible.'), { status: 404 });
}

export function safeFileName(name) { return path.basename(name || 'evidencia').replace(/[\x00-\x1f\x7f]/g, '').slice(0, 255) || 'evidencia'; }
