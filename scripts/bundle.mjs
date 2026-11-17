// Shared esbuild settings for the Electron main process and the standalone API server.
import * as esbuild from 'esbuild';

export const serverOptions = {
  entryPoints: {
    main: 'electron/main.ts',
    server: 'server/standalone.ts',
  },
  outdir: 'dist-electron',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  logLevel: 'warning',
};

export function bundleOnce() {
  return esbuild.build(serverOptions);
}

export function bundleWatch(onRebuild) {
  return esbuild.context({
    ...serverOptions,
    plugins: [{ name: 'notify', setup: (b) => b.onEnd((r) => r.errors.length || onRebuild?.()) }],
  });
}
