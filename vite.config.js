import { defineConfig } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';

const BUILD_ID = new Date().toISOString();

// Menulis dist/version.json supaya app murid tahu ada versi baru.
const versionFile = () => ({
  name: 'version-file',
  apply: 'build',
  closeBundle() { mkdirSync('dist', { recursive: true }); writeFileSync('dist/version.json', JSON.stringify({ build: BUILD_ID })); },
});

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [versionFile()],
  build: { sourcemap: false, chunkSizeWarningLimit: 2000 },
});
