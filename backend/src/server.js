import { getPool } from './db.js';
import { createApp } from './app.js';
import { config, validateRuntimeConfig } from './config.js';
import { seedDatabase } from './seed.js';

try {
  validateRuntimeConfig();
  const pool = await getPool();
  if (config.memoryDb) await seedDatabase(pool);
  const app = createApp(pool);
  const server = app.listen(config.port, () => console.log(`Gestor Mantenimiento API disponible en http://localhost:${config.port}`));
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => server.close(async () => { await pool.end(); process.exit(0); }));
} catch (error) {
  console.error('No fue posible iniciar Gestor Mantenimiento:', error.message);
  process.exit(1);
}
