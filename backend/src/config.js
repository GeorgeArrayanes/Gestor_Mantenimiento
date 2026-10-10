import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const projectRoot = path.resolve(backendRoot, '..');
dotenv.config({ path: path.join(projectRoot, '.env'), quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';
export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv,
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === 'true',
  databaseSslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
  databaseSslCa: process.env.DATABASE_SSL_CA?.replaceAll('\\n', '\n'),
  jwtSecret: process.env.JWT_SECRET || (nodeEnv !== 'production' ? 'development-only-secret-change-me-32chars' : ''),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  maxFileSize: Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024,
  maxFiles: 5,
  uploadRoot: path.resolve(process.env.UPLOAD_DIRECTORY || path.join(backendRoot, 'uploads')),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || 'mantenimiento-evidencias',
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || '',
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || '',
  keepAliveUrl: process.env.KEEP_ALIVE_URL || '',
  keepAliveIntervalMs: Number(process.env.KEEP_ALIVE_INTERVAL_MS || 7 * 60 * 1000),
  memoryDb: process.env.DEV_MEMORY_DB === 'true',
  demoSeed: process.env.ALLOW_DEMO_SEED === 'true'
};

export function validateRuntimeConfig() {
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('PORT debe ser un puerto válido.');
  if (!Number.isFinite(config.maxFileSize) || config.maxFileSize <= 0 || config.maxFileSize > 20 * 1024 * 1024) throw new Error('MAX_FILE_SIZE_MB debe estar entre 0 y 20.');
  if (!Number.isInteger(config.keepAliveIntervalMs) || config.keepAliveIntervalMs < 60_000) throw new Error('KEEP_ALIVE_INTERVAL_MS debe ser de al menos 60000 ms.');
  if (config.keepAliveUrl && !config.keepAliveUrl.startsWith('https://')) throw new Error('KEEP_ALIVE_URL debe usar HTTPS.');
  if (!!config.supabaseUrl !== !!config.supabaseKey) throw new Error('Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY juntos.');
  if (config.nodeEnv === 'production') {
    if (config.memoryDb || config.demoSeed) throw new Error('Producción no permite memoria ni semillas de demostración.');
    if (config.jwtSecret.length < 32 || /development-only|replace|change[-_ ]?me|placeholder|example/i.test(config.jwtSecret)) throw new Error('Producción requiere JWT_SECRET aleatorio de al menos 32 caracteres, sin valores de ejemplo.');
    if (!config.databaseUrl) throw new Error('Producción requiere DATABASE_URL.');
    if (!config.frontendUrl.startsWith('https://')) throw new Error('Producción requiere FRONTEND_URL HTTPS.');
    if (config.supabaseUrl && !config.supabaseUrl.startsWith('https://')) throw new Error('SUPABASE_URL requiere HTTPS en producción.');
  }
}
