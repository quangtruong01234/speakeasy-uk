// Production build: UI → dist/, Electron main + API → dist-electron/.
import { build } from 'vite';
import { bundleOnce } from './bundle.mjs';

await build({ configFile: 'vite.config.ts', logLevel: 'warn' });
await bundleOnce();
console.log('[speakeasy] build done: dist/ and dist-electron/');
