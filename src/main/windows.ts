import { BrowserWindow, screen, type Rectangle } from 'electron';
import type { KvStore } from '../core/kv';
import type { CompanionState } from '../shared/ipc';
import type { Settings } from '../shared/settings';
import { APP_ORIGIN } from './protocol';

interface SavedBounds extends Rectangle {
  maximized?: boolean;
}
interface CompanionSaved {
  floating: Rectangle | null;
  collapsed: boolean;
}

const LAUNCHER = { width: 228, height: 60 };
const PANEL = { width: 380, height: 600 };
const DOCK_WIDTH = 380;

/** True when at least a usable part of the rectangle is on some display. */
export function isVisibleOnSomeDisplay(b: Rectangle, displays: Rectangle[]): boolean {
  return displays.some((d) => {
    const w = Math.min(b.x + b.width, d.x + d.width) - Math.max(b.x, d.x);
    const h = Math.min(b.y + b.height, d.y + d.height) - Math.max(b.y, d.y);
    return w >= 80 && h >= 40;
  });
}

function rendererUrl(hash: string): string {
  const base = process.env.FC_DEV_SERVER_URL ?? `${APP_ORIGIN}/index.html`;
  return `${base}#${hash}`;
}

export interface WindowDeps {
  kv: KvStore;
  preloadPath: string;
  iconPath: string;
  getSettings: () => Settings;
  onCompanionState: (s: CompanionState) => void;
  /** Return true to hide instead of close (close-to-tray). */
  shouldHideOnClose: () => boolean;
  isQuitting: () => boolean;
}

export class WindowManager {
  main: BrowserWindow | null = null;
  companion: BrowserWindow | null = null;
  private saveTimers = new Map<string, NodeJS.Timeout>();
  private contentProtection = false;

  constructor(private readonly deps: WindowDeps) {}

  private webPreferences(): Electron.WebPreferences {
    return {
      preload: this.deps.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: this.deps.getSettings().notes.spellcheck,
      backgroundThrottling: true,
    };
  }

  private displays(): Rectangle[] {
    return screen.getAllDisplays().map((d) => d.workArea);
  }

  private debounceSave(key: string, fn: () => void): void {
    const t = this.saveTimers.get(key);
    if (t) clearTimeout(t);
    this.saveTimers.set(key, setTimeout(fn, 400));
  }

  // ─────────── Main window ───────────

  createMain(opts: { show: boolean; route: string }): BrowserWindow {
    const saved = this.deps.kv.get<SavedBounds | null>('window:main', null);
    const bounds = saved && isVisibleOnSomeDisplay(saved, this.displays()) ? saved : null;
    const win = new BrowserWindow({
      width: bounds?.width ?? 1280,
      height: bounds?.height ?? 820,
      x: bounds?.x,
      y: bounds?.y,
      minWidth: 760,
      minHeight: 520,
      show: false,
      title: 'FlowCompanion',
      backgroundColor: '#0f1117',
      icon: this.deps.iconPath,
      autoHideMenuBar: true,
      webPreferences: this.webPreferences(),
    });
    this.main = win;
    if (saved?.maximized) win.maximize();
    win.setContentProtection(this.contentProtection);

    const persist = () =>
      this.debounceSave('main', () => {
        if (win.isDestroyed()) return;
        const b = win.isMaximized() || win.isMinimized() ? (this.deps.kv.get<SavedBounds | null>('window:main', null) ?? win.getBounds()) : win.getBounds();
        this.deps.kv.set('window:main', { ...b, maximized: win.isMaximized() });
      });
    win.on('resize', persist);
    win.on('move', persist);
    win.on('maximize', persist);
    win.on('unmaximize', persist);

    win.on('close', (e) => {
      if (!this.deps.isQuitting() && this.deps.shouldHideOnClose()) {
        e.preventDefault();
        win.hide();
      }
    });
    win.on('closed', () => {
      this.main = null;
    });
    win.once('ready-to-show', () => {
      if (opts.show) win.show();
    });
    void win.loadURL(rendererUrl(opts.route));
    return win;
  }

  showMain(route?: string): void {
    const win = this.main ?? this.createMain({ show: true, route: route ?? '/home' });
    if (route) win.webContents.send('fc:event', { type: 'navigate', payload: { route } });
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }

  // ─────────── Companion ───────────

  private companionSaved(): CompanionSaved {
    return this.deps.kv.get<CompanionSaved>('window:companion', { floating: null, collapsed: false });
  }

  private saveCompanion(patch: Partial<CompanionSaved>): void {
    this.deps.kv.set('window:companion', { ...this.companionSaved(), ...patch });
  }

  private companionBounds(collapsed: boolean): Rectangle {
    const s = this.deps.getSettings().companion;
    const display = this.companion
      ? screen.getDisplayMatching(this.companion.getBounds())
      : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const wa = display.workArea;
    if (s.dock !== 'floating' && !collapsed) {
      return { x: s.dock === 'left' ? wa.x : wa.x + wa.width - DOCK_WIDTH, y: wa.y, width: DOCK_WIDTH, height: wa.height };
    }
    const saved = this.companionSaved().floating;
    const size = collapsed ? LAUNCHER : { width: saved?.width ?? PANEL.width, height: saved?.height ?? PANEL.height };
    if (saved && isVisibleOnSomeDisplay({ ...saved, ...size }, this.displays())) {
      // Keep the top-right corner anchored when switching between launcher and panel.
      const right = saved.x + saved.width;
      return { x: right - size.width, y: saved.y, ...size };
    }
    return { x: wa.x + wa.width - size.width - 24, y: wa.y + 24, ...size };
  }

  companionState(): CompanionState {
    const s = this.deps.getSettings().companion;
    return {
      visible: !!this.companion && !this.companion.isDestroyed() && this.companion.isVisible(),
      collapsed: this.companionSaved().collapsed,
      dock: s.dock,
      alwaysOnTop: s.alwaysOnTop,
    };
  }

  private emitCompanion(): CompanionState {
    const state = this.companionState();
    this.deps.onCompanionState(state);
    return state;
  }

  createCompanion(): BrowserWindow {
    const s = this.deps.getSettings().companion;
    const collapsed = this.companionSaved().collapsed;
    const win = new BrowserWindow({
      ...this.companionBounds(collapsed),
      minWidth: collapsed ? LAUNCHER.width : 300,
      minHeight: collapsed ? LAUNCHER.height : 360,
      frame: false,
      resizable: !collapsed,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      alwaysOnTop: s.alwaysOnTop,
      title: 'FlowCompanion',
      backgroundColor: '#14161f',
      icon: this.deps.iconPath,
      webPreferences: this.webPreferences(),
    });
    this.companion = win;
    win.setContentProtection(this.contentProtection);
    if (s.alwaysOnTop) win.setAlwaysOnTop(true, 'floating');
    this.applyOpacity();

    const persist = () =>
      this.debounceSave('companion', () => {
        if (win.isDestroyed()) return;
        if (this.deps.getSettings().companion.dock !== 'floating') return;
        const b = win.getBounds();
        if (this.companionSaved().collapsed) {
          const prev = this.companionSaved().floating;
          const w = prev?.width ?? PANEL.width;
          this.saveCompanion({ floating: { x: b.x + b.width - w, y: b.y, width: w, height: prev?.height ?? PANEL.height } });
        } else {
          this.saveCompanion({ floating: b });
        }
      });
    win.on('move', persist);
    win.on('resize', persist);
    win.on('show', () => this.emitCompanion());
    win.on('hide', () => this.emitCompanion());
    win.on('close', (e) => {
      if (!this.deps.isQuitting()) {
        e.preventDefault();
        win.hide();
      }
    });
    win.on('closed', () => {
      this.companion = null;
    });
    // Never steal focus when the companion appears on its own.
    win.once('ready-to-show', () => win.showInactive());
    void win.loadURL(rendererUrl('/companion'));
    return win;
  }

  /** Shows or hides the companion. Focus moves only when the user asked (focus = true). */
  toggleCompanion(focus: boolean): CompanionState {
    if (!this.deps.getSettings().companion.enabled) return this.companionState();
    const win = this.companion ?? this.createCompanion();
    if (win.isVisible()) {
      win.hide();
    } else if (focus) {
      win.show();
      win.focus();
    } else {
      win.showInactive();
    }
    return this.emitCompanion();
  }

  hideCompanion(): CompanionState {
    this.companion?.hide();
    return this.emitCompanion();
  }

  minimizeCompanion(): void {
    this.companion?.minimize();
  }

  setCompanionCollapsed(collapsed: boolean): CompanionState {
    this.saveCompanion({ collapsed });
    const win = this.companion;
    if (win && !win.isDestroyed()) {
      win.setResizable(!collapsed);
      win.setMinimumSize(collapsed ? LAUNCHER.width : 300, collapsed ? LAUNCHER.height : 360);
      win.setBounds(this.companionBounds(collapsed));
    }
    return this.emitCompanion();
  }

  /** Applies settings that affect live windows. */
  applySettings(settings: Settings): void {
    const c = this.companion;
    if (c && !c.isDestroyed()) {
      if (!settings.companion.enabled) {
        c.hide();
      }
      c.setAlwaysOnTop(settings.companion.alwaysOnTop, 'floating');
      c.setBounds(this.companionBounds(this.companionSaved().collapsed));
    }
    this.applyOpacity();
    for (const w of [this.main, this.companion]) {
      if (w && !w.isDestroyed()) w.webContents.session.setSpellCheckerEnabled(settings.notes.spellcheck);
    }
    this.emitCompanion();
  }

  private applyOpacity(): void {
    if (process.platform === 'linux') return; // not supported; reported in capabilities
    const c = this.companion;
    if (c && !c.isDestroyed()) c.setOpacity(this.deps.getSettings().companion.opacity);
  }

  /** Re-homes windows that ended up off-screen after a monitor was removed. */
  rehomeWindows(): void {
    const displays = this.displays();
    if (this.main && !this.main.isDestroyed() && !isVisibleOnSomeDisplay(this.main.getBounds(), displays)) {
      this.main.center();
    }
    if (this.companion && !this.companion.isDestroyed()) {
      this.companion.setBounds(this.companionBounds(this.companionSaved().collapsed));
    }
  }

  setContentProtection(on: boolean): void {
    this.contentProtection = on;
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.setContentProtection(on);
    }
  }

  broadcast(type: string, payload: unknown): void {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send('fc:event', { type, payload });
    }
  }

  anyFocused(): boolean {
    return BrowserWindow.getAllWindows().some((w) => !w.isDestroyed() && w.isFocused());
  }
}
