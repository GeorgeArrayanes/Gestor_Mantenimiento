import { getPool } from './db.js';
import { createApp } from './app.js';
import { config } from './config.js';
import { seedDatabase } from './seed.js';

try {
  const pool = await getPool();
  if (config.memoryDb) await seedDatabase(pool);
  const app = createApp(pool);
  app.listen(config.port, () => console.log(`RutaSegura API disponible en http://localhost:${config.port}`));
} catch (error) {
  console.error('No fue posible iniciar RutaSegura:', error.message);
  process.exit(1);
}
