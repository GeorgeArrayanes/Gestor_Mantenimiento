// Stage A review only. This launcher never calls getPool() or production startup.
// Ephemeral demo accounts (not production credentials):
// admin@mantenimiento.test / Mantenimiento2026!
// superadmin@mantenimiento.test / Mantenimiento2026!
// Start from the repository: node prototypes/campus-map/interactive/qa-server.mjs
// Stop with Ctrl+C. The memory database and process JWT disappear; the temporary
// QA storage directory is removed on normal shutdown.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, '../../..');
const qaRoot = path.join(here, 'output', 'qa');
const frontendOrigin = 'http://127.0.0.1:5175';
const port = 4011;
let pool;
let server;
let runRoot;
let closing = false;

async function removeTemporaryStorage() {
  if (!runRoot) return;
  // Verify the resolved absolute removal target before any recursive operation.
  const [actualRoot, actualTarget] = await Promise.all([fs.realpath(qaRoot), fs.realpath(runRoot)]);
  if (actualTarget === actualRoot || !actualTarget.startsWith(actualRoot + path.sep)) throw new Error('El almacenamiento QA quedó fuera de su carpeta temporal.');
  await fs.rm(actualTarget, { recursive: true, force: true });
  runRoot = undefined;
}

async function shutdown(exitCode = 0) {
  if (closing) return;
  closing = true;
  try {
    if (server?.listening) {
      const closed = new Promise(resolve => server.close(resolve));
      server.closeIdleConnections?.();
      const timer = setTimeout(() => server.closeAllConnections?.(), 2000);
      timer.unref();
      await closed;
      clearTimeout(timer);
    }
    await pool?.end();
    await removeTemporaryStorage();
  } catch {
    console.error('No se pudo completar la limpieza del entorno QA local.');
    exitCode = 1;
  }
  process.exitCode = exitCode;
}

try {
  await fs.mkdir(qaRoot, { recursive: true });
  const [realRepository, realQaRoot] = await Promise.all([fs.realpath(repository), fs.realpath(qaRoot)]);
  if (!realQaRoot.startsWith(realRepository + path.sep)) throw new Error('La carpeta QA debe permanecer dentro del proyecto.');
  runRoot = await fs.mkdtemp(path.join(realQaRoot, 'session-'));

  // Set every relevant key before importing config.js. dotenv's default does
  // not override existing variables, so the repository .env cannot supply a
  // database, storage service, production account, or keep-alive destination.
  Object.assign(process.env, {
    NODE_ENV: 'test', PORT: String(port), FRONTEND_URL: frontendOrigin,
    DATABASE_URL: '', DATABASE_SSL: 'false', DATABASE_SSL_REJECT_UNAUTHORIZED: 'true', DATABASE_SSL_CA: '',
    TEST_POSTGRES_URL: '', DEV_MEMORY_DB: 'true', ALLOW_DEMO_SEED: 'true',
    JWT_SECRET: crypto.randomBytes(48).toString('hex'), JWT_EXPIRES_IN: '2h',
    SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_STORAGE_BUCKET: 'qa-memory-only',
    SUPER_ADMIN_EMAIL: '', SUPER_ADMIN_PASSWORD: '', KEEP_ALIVE_URL: '', KEEP_ALIVE_INTERVAL_MS: '420000',
    UPLOAD_DIRECTORY: runRoot, MAX_FILE_SIZE_MB: '5',
  });

  const backendModule = name => pathToFileURL(path.join(repository, 'backend', 'src', name)).href;
  const { config } = await import(backendModule('config.js'));
  // Defense in depth if this file is ever imported after another local module.
  Object.assign(config, {
    nodeEnv: 'test', port, frontendUrl: frontendOrigin, memoryDb: true, demoSeed: true,
    databaseUrl: '', supabaseUrl: '', supabaseKey: '', keepAliveUrl: '',
    superAdminEmail: '', superAdminPassword: '', uploadRoot: runRoot,
    jwtSecret: process.env.JWT_SECRET, jwtExpiresIn: '2h',
  });

  // storage.js creates its Supabase client only inside storage operations, not
  // on import. test + empty Supabase config uses its in-process memory store.
  const { createMemoryPool } = await import(backendModule('db.js'));
  const { seedDatabase } = await import(backendModule('seed.js'));
  const { createApp } = await import(backendModule('app.js'));
  pool = await createMemoryPool();
  await seedDatabase(pool);
  const app = createApp(pool);
  await new Promise((resolve, reject) => {
    server = app.listen(port, '127.0.0.1', resolve);
    server.once('error', reject);
  });

  console.log(`QA local en http://127.0.0.1:${port} · memoria efímera, sin servicios externos.`);
  console.log(`Abrir ${frontendOrigin}/login. Cuentas demo documentadas en este launcher.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void shutdown(); });
} catch (error) {
  console.error(`No se pudo iniciar QA local: ${error.code === 'EADDRINUSE' ? 'el puerto 4011 ya está ocupado.' : 'revisa el launcher y las dependencias locales.'}`);
  await shutdown(1);
}
