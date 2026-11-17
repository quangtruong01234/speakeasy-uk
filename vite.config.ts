import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The UI is a plain web app that talks to the local API with fetch('/api/...'),
// so the same build runs inside Electron and in an ordinary browser (for Chrome DevTools MCP).
const API_PORT = Number(process.env.SPEAKEASY_PORT ?? 47821);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${API_PORT}` },
  },
  build: { outDir: 'dist', emptyOutDir: true },
  test: { include: ['tests/**/*.test.ts'] },
} as Parameters<typeof defineConfig>[0]);
