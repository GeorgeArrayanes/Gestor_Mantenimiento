// Isolated frontend for Stage A review; no repository .env and no remote API.
// From the repository: node node_modules/vite/bin/vite.js --config prototypes/campus-map/interactive/vite.qa.config.mjs
// Stop with Ctrl+C; this dev server does not build or deploy anything.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '../../../frontend');
const localApi = 'http://127.0.0.1:4011';

export default defineConfig({
  root: frontendRoot,
  envDir: false,
  plugins: [react()],
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') },
  server: {
    host: '127.0.0.1', port: 5175, strictPort: true, open: false,
    proxy: { '/api': localApi, '/uploads': localApi },
  },
});
