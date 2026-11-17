// npm run dev      → Vite + Electron window (the real desktop app)
// npm run dev:web  → Vite + standalone API server, open http://localhost:5173 in a browser
//                    (used with the Chrome DevTools MCP to check the UI)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { bundleOnce, bundleWatch } from './bundle.mjs';

const web = process.argv.includes('--web');
const children = [];
const stopAll = () => {
  for (const child of children) child.kill();
  process.exit(0);
};
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

if (web) {
  // Rebuild the server on change and restart it after each successful build
  // (the first watch build starts it).
  let api = null;
  let ready;
  const started = new Promise((resolve) => (ready = resolve));
  const restart = () => {
    if (api) {
      api.kill();
      children.splice(children.indexOf(api), 1);
    }
    api = spawn(process.execPath, ['--enable-source-maps', 'dist-electron/server.mjs'], { stdio: 'inherit' });
    children.push(api);
    ready();
  };
  const ctx = await bundleWatch(restart);
  await ctx.watch();
  await started;
} else {
  await bundleOnce();
}

const vite = await createServer({ configFile: 'vite.config.ts' });
await vite.listen();
const url = vite.resolvedUrls?.local[0] ?? 'http://localhost:5173/';
console.log(`[speakeasy] UI on ${url}`);

if (!web) {
  const require = createRequire(import.meta.url);
  const electron = require('electron'); // path to the Electron binary
  const app = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_URL: url },
  });
  children.push(app);
  app.on('exit', async () => {
    await vite.close();
    stopAll();
  });
}
