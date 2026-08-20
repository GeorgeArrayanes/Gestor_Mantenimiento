import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const allowedExtensions = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['application/pdf', '.pdf']
]);

export function validateUpload(file) {
  if (!file) return;
  if (!allowedExtensions.has(file.mimetype)) {
    const error = new Error('Formato no permitido. Usa JPG, PNG, WEBP o PDF.');
    error.status = 400;
    throw error;
  }
}

export async function saveFile(file, incidentId) {
  validateUpload(file);
  const extension = allowedExtensions.get(file.mimetype);
  const safeName = `${incidentId}/${Date.now()}-${crypto.randomUUID()}${extension}`;

  if (config.supabaseUrl && config.supabaseKey) {
    const supabase = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false } });
    const { error } = await supabase.storage.from(config.supabaseBucket).upload(safeName, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw new Error(`No fue posible almacenar la evidencia: ${error.message}`);
    return `supabase:${safeName}`;
  }

  if (config.nodeEnv === 'test') return `/uploads/test/${safeName}`;

  const uploadRoot = path.resolve(process.cwd(), 'uploads');
  const target = path.join(uploadRoot, safeName);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, file.buffer);
  return `/uploads/${safeName.replaceAll('\\', '/')}`;
}

export async function resolveFileUrl(storedUrl) {
  if (!storedUrl?.startsWith('supabase:')) return storedUrl;
  if (!config.supabaseUrl || !config.supabaseKey) return null;
  const objectPath = storedUrl.slice('supabase:'.length);
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.storage.from(config.supabaseBucket).createSignedUrl(objectPath, 3600);
  if (error) return null;
  return data.signedUrl;
}
