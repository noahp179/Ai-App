import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/** The browser build of the classroom, served by the classroom server (npm run build:classroom). */
export default defineConfig({
  root: resolve(__dirname, 'src/web'),
  base: '/',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist/classroom-web'),
    emptyOutDir: true,
    // Chromebooks and school computers update automatically, but not all at once.
    target: ['chrome110', 'edge110', 'firefox115', 'safari16'],
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
