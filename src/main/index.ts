import { Menu, app, dialog, globalShortcut, shell } from 'electron';
import { MigrationError } from '../core/db/migrations';
import { createApi } from './api';
import { AppContext } from './context';
import { registerIpc } from './ipc';
import { resolvePaths } from './paths';
import { handleAppProtocol, registerAppScheme } from './protocol';
import { hardenSessions } from './security';

registerAppScheme();
// Sandbox every renderer. Skipped only when --no-sandbox is passed explicitly
// (required by Chromium when running as root, e.g. in CI containers).
if (!app.commandLine.hasSwitch('no-sandbox')) app.enableSandbox();
app.setAppUserModelId('com.flowcompanion.app');

const isDev = !!process.env.FC_DEV_SERVER_URL;
let ctx: AppContext | null = null;

function buildMenu(): Menu {
  const isMac = process.platform === 'darwin';
  const nav = (route: string) => () => ctx?.windows.showMain(route);
  return Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Quick capture', accelerator: 'CmdOrCtrl+Shift+K', registerAccelerator: false, click: () => ctx?.openQuickCapture() },
        { label: 'New note', accelerator: 'CmdOrCtrl+N', registerAccelerator: false, click: nav('/notes/new') },
        { label: 'New AI chat', click: nav('/ai/new') },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: nav('/settings') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Show or hide companion', click: () => ctx?.windows.toggleCompanion(true) },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' as const }, { role: 'reload' as const }, { role: 'toggleDevTools' as const }] : []),
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Documentation', click: () => void shell.openExternal('https://github.com/noahp179/Ai-App#readme') },
        { label: 'Privacy and data', click: nav('/settings/privacy') },
      ],
    },
  ]);
}

function startupFailed(err: unknown): void {
  console.error('startup failed', err);
  const message =
    err instanceof MigrationError
      ? `${err.message}\n\nYour data was not changed by the failed step. A backup made before the update is in the "backups" folder of your FlowCompanion data directory.`
      : err instanceof Error
        ? err.message
        : String(err);
  dialog.showErrorBox('FlowCompanion could not start', message);
  app.exit(1);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => ctx?.windows.showMain());
  app.on('activate', () => ctx?.windows.showMain());
  app.on('before-quit', () => {
    if (ctx) ctx.quitting = true;
  });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    ctx?.shutdown();
    ctx = null;
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app
    .whenReady()
    .then(() => {
      const paths = resolvePaths();
      hardenSessions();
      handleAppProtocol(paths.rendererDir);
      Menu.setApplicationMenu(buildMenu());
      ctx = AppContext.start(paths);
      registerIpc(createApi(ctx));

      const s = ctx.settings.get();
      const hidden = (process.argv.includes('--hidden') || s.startup.startHidden) && ctx.tray.available;
      const route = s.layout.openTo === 'last' ? ctx.kv.get<string>('ui:lastRoute', '/home') : `/${s.layout.openTo}`;
      const main = ctx.windows.createMain({ show: !hidden, route });
      main.on('closed', () => {
        // Closing the main window quits, unless the user chose close-to-tray (or on macOS, where apps stay open).
        if (ctx && !ctx.quitting && process.platform !== 'darwin') app.quit();
      });
      if (s.companion.enabled && s.companion.showOnStartup) ctx.windows.toggleCompanion(false);
    })
    .catch(startupFailed);
}
