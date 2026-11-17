// Electron shell: starts the local API in-process, then opens a window on it.
// Dev: the window loads Vite (VITE_DEV_URL) which proxies /api to the server.

import path from 'node:path';
import { app, BrowserWindow, session, shell } from 'electron';

const DEV_URL = process.env.VITE_DEV_URL;
const PORT = Number(process.env.SPEAKEASY_PORT ?? 47821);

// Learner data: the project's data/ folder in dev, the per-user app folder when installed.
if (!process.env.SPEAKEASY_DATA_DIR) {
  process.env.SPEAKEASY_DATA_DIR = app.isPackaged
    ? path.join(app.getPath('userData'), 'data')
    : path.resolve(import.meta.dirname, '..', 'data');
}

async function boot(): Promise<void> {
  // Imported after SPEAKEASY_DATA_DIR is set.
  const { startServer } = await import('../server/index');
  const staticDir = path.resolve(import.meta.dirname, '..', 'dist');
  let port = PORT;
  try {
    ({ port } = await startServer({ port: PORT, staticDir: DEV_URL ? undefined : staticDir }));
  } catch {
    // Port taken (e.g. a dev:web server is running) → any free port.
    ({ port } = await startServer({ port: 0, staticDir: DEV_URL ? undefined : staticDir }));
  }

  // Microphone for speaking practice.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'speaker-selection');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 760,
    minHeight: 560,
    title: 'SpeakEasy UK',
    backgroundColor: '#f7f5f0',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  await win.loadURL(DEV_URL ?? `http://127.0.0.1:${port}/`);
}

app.whenReady().then(boot).catch((err) => {
  console.error(err);
  app.quit();
});
app.on('window-all-closed', () => app.quit());
