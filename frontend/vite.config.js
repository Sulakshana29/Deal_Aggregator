import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config
 *
 * The `server.proxy` block is the key setting for local dev:
 * any request from the React app to /api/* gets forwarded to the
 * Express backend. This means the frontend never hard-codes the
 * backend URL — in Docker/K8s we just swap the proxy target via env.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy /api → http://localhost:5000
      // e.g. fetch('/api/deals') → http://localhost:5000/deals
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  }
});
