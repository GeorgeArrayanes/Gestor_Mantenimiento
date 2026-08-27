import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv,
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret-change-me-32chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  maxFileSize: Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || 'rutasegura-evidencias',
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || 'Admin@gla.edu.co',
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || '',
  memoryDb: process.env.DEV_MEMORY_DB === 'true'
};
