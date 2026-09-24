/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/pathfinding-visualizer/',
  build: {
    // The lazily loaded 3D view (three.js) is one ~575 kB chunk (~145 kB
    // gzipped) that only downloads when someone opens the 3D view. The
    // limit sits just above it, so the warning still catches the main
    // bundle (~415 kB) growing past that.
    chunkSizeWarningLimit: 600,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
});
