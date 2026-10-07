import { createClient } from '@supabase/supabase-js';
import { config, validateRuntimeConfig } from '../config.js';

validateRuntimeConfig();
if (!config.supabaseUrl || !config.supabaseKey) {
  throw new Error('Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para preparar el almacenamiento.');
}

const client = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const { data: bucket, error: readError } = await client.storage.getBucket(config.supabaseBucket);

if (bucket) {
  if (bucket.public) throw new Error(`El bucket ${config.supabaseBucket} debe ser privado.`);
  console.log(`Bucket privado ${config.supabaseBucket} verificado correctamente.`);
} else {
  const missing = readError && /not found|does not exist/i.test(readError.message || '');
  if (readError && !missing) throw new Error(`No fue posible consultar el bucket: ${readError.message}`);
  const { error: createError } = await client.storage.createBucket(config.supabaseBucket, {
    public: false,
    fileSizeLimit: config.maxFileSize,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  });
  if (createError) throw new Error(`No fue posible crear el bucket privado: ${createError.message}`);
  console.log(`Bucket privado ${config.supabaseBucket} creado correctamente.`);
}
