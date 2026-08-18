/**
 * Electron main process for Synapse on macOS.
 *
 * The app is the Expo web export loaded into a hardened BrowserWindow. That
 * keeps one codebase across phone and desktop while still giving macOS what it
 * expects: a real menu bar, keyboard shortcuts, window state that persists, and
 * a native title bar treatment.
 *
 * Security posture: context isolation on, node integration off, sandbox on, and
 * an explicit allowlist for navigation. The renderer runs our own static bundle
 * and talks to exactly one API host — anything else opens in the user's browser
 * rather than inside the app.
 */

import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const isDev = process.argv.includes('--dev');

/** The only host the renderer may talk to. Everything else is external. */
const API_ORIGIN = 'https://api.synapse.app';

let mainWindow: BrowserWindow | null = null;

// ---------------------------------------------------------------------------
// Window state persistence
// ---------------------------------------------------------------------------

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

const DEFAULT_STATE: WindowState = { width: 1120, height: 820 };

function stateFile(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowState {
  try {
    const raw = fs.readFileSync(stateFile(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    if (typeof parsed.width !== 'number' || typeof parsed.height !== 'number') {
      return DEFAULT_STATE;
    }
    // Clamp: a state file from a disconnected external display can otherwise
    // restore the window entirely off-screen.
    return {
      width: Math.max(720, Math.min(4000, parsed.width)),
      height: Math.max(560, Math.min(3000, parsed.height)),
      ...(typeof parsed.x === 'number' ? { x: parsed.x } : {}),
      ...(typeof parsed.y === 'number' ? { y: parsed.y } : {}),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveWindowState(window: BrowserWindow): void {
  if (window.isMinimized() || window.isFullScreen()) return;
  const bounds = window.getBounds();
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(bounds));
  } catch {
    // Losing window position is a cosmetic failure; never surface it.
  }
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow(): void {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    ...state,
    minWidth: 720,
    minHeight: 560,
    show: false,
    // Traffic lights float over the content, which suits the app's dark
    // full-bleed layout better than a separate chrome strip.
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      // Devtools only in a dev run; never in a shipped build.
      devTools: isDev,
    },
  });

  // Show only once painted, to avoid a white flash before the dark UI loads.
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', () => {
    if (mainWindow) saveWindowState(mainWindow);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  loadApp(mainWindow);
  applyNavigationPolicy(mainWindow);
}

function loadApp(window: BrowserWindow): void {
  if (isDev) {
    // Expo's dev server, so hot reload works while iterating on the shell.
    void window.loadURL('http://localhost:8081');
    window.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  // Packaged: the Expo static export copied in as an extra resource.
  const indexPath = app.isPackaged
    ? path.join(process.resourcesPath, 'web', 'index.html')
    : path.join(__dirname, '..', '..', 'mobile', 'dist', 'index.html');

  void window.loadFile(indexPath);
}

/**
 * Keeps the renderer pinned to our own content.
 *
 * Any attempt to navigate elsewhere is cancelled and handed to the system
 * browser instead. Without this, a single unexpected link turns the app window
 * into an unbranded browser with no address bar — which is both a bad experience
 * and a phishing surface.
 */
function applyNavigationPolicy(window: BrowserWindow): void {
  const allowedOrigins = new Set([API_ORIGIN, 'http://localhost:8081']);

  window.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url);
    if (target.protocol === 'file:') return;
    if (allowedOrigins.has(target.origin)) return;

    event.preventDefault();
    void shell.openExternal(url);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Refuse permission requests outright — the app needs none of them.
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

function buildMenu(): void {
  const send = (channel: string): void => {
    mainWindow?.webContents.send(channel);
  };

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Synapse',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'Cmd+,',
          click: () => send('synapse:navigate-settings'),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Learn',
      submenu: [
        {
          label: 'Continue Learning',
          accelerator: 'Cmd+Return',
          click: () => send('synapse:continue-lesson'),
        },
        {
          label: 'Start Review Session',
          accelerator: 'Cmd+R',
          click: () => send('synapse:start-review'),
        },
        { type: 'separator' },
        {
          label: 'Browse Catalog',
          accelerator: 'Cmd+L',
          click: () => send('synapse:navigate-catalog'),
        },
        {
          label: 'Open Lab',
          accelerator: 'Cmd+K',
          click: () => send('synapse:navigate-lab'),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ role: 'toggleDevTools' } as MenuItemConstructorOptions] : []),
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Synapse Support',
          click: () => void shell.openExternal('https://synapse.app/support'),
        },
        {
          label: 'Privacy Policy',
          click: () => void shell.openExternal('https://synapse.app/privacy'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

// One instance only — a second launch focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  void app.whenReady().then(() => {
    buildMenu();
    createWindow();

    app.on('activate', () => {
      // macOS convention: clicking the dock icon with no windows reopens one.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  // macOS apps stay resident until explicitly quit.
  if (process.platform !== 'darwin') app.quit();
});
