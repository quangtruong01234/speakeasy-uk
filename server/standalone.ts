// Runs the local API without Electron: `npm run dev:web`, then open http://localhost:5173
// in any browser (this is how the Chrome DevTools MCP checks the UI).

import { startServer } from './index';

const port = Number(process.env.SPEAKEASY_PORT ?? 47821);
const staticDir = process.env.SPEAKEASY_STATIC || undefined;
startServer({ port, staticDir }).then(({ port: actual }) => {
  console.log(`[speakeasy] API listening on http://127.0.0.1:${actual}`);
});
