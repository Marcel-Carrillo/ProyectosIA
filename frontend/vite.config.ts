/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    // Bind 0.0.0.0 so the dev server is reachable through Docker's 3001:3001
    // port mapping (CRA's dev server did this by default).
    host: true,
    proxy: {
      '/api': {
        // Node-context read at dev-server start; BACKEND_URL is set by
        // docker-compose (http://ecommerce-backend:3000) and defaults to
        // localhost for host-machine runs. Replaces src/setupProxy.js.
        target: process.env.BACKEND_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Keep CRA's output directory so deploy.yml's S3 sync path stays valid.
    outDir: 'build',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
  },
});
