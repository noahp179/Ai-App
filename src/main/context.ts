import { Notification, app, clipboard, dialog, nativeTheme, powerMonitor, screen } from 'electron';
import { listBackups, openDatabase, pruneBackups } from '../core/db/open';
import type { Db } from '../core/db/database';
import { KvStore } from '../core/kv';
import { NotificationCenter } from '../core/notifications';
import { SecretStore } from '../core/secrets';
import { SettingsService } from '../core/settings';
import { type Clock, systemClock } from '../core/util';
import type { CopyContext, ShortcutStatus } from '../shared/api';
import type { AppEventName, AppEvents } from '../shared/ipc';
import type { Settings } from '../shared/settings';
import type { Capabilities, StartupReport } from '../shared/types';
import { applyLaunchAtLogin } from './autostart';
import { detectCapabilities, safeStorageCipher } from './capabilities';
import type { AppPaths } from './paths';
import { applyShortcuts } from './shortcuts';
import { AppTray } from './tray';
import { WindowManager } from './windows';

/**
 * Owns every long-lived object in the main process. Services are created here
 * and handed to the IPC layer through src/main/api.ts.
 */
export class AppContext {
  readonly clock: Clock = systemClock;
  readonly db: Db;
  readonly kv: KvStore;
  readonly settings: SettingsService;
  readonly secrets: SecretStore;
  readonly windows: WindowManager;
  readonly notifications: NotificationCenter;
  readonly tray: AppTray;
  readonly startup: StartupReport;
  capabilities!: Capabilities;
  shortcutStatus: ShortcutStatus[] = [];
  quitting = false;
  launchAtLoginError: string | null = null;
  /** Set by parental controls; returns why a copy is blocked in a context, or null. */
  copyBlockedReason: ((context: CopyContext) => string | null) | null = null;

  private constructor(
    readonly paths: AppPaths,
    db: Db,
    startup: StartupReport,
  ) {
    this.db = db;
    this.startup = startup;
    this.kv = new KvStore(db, this.clock);
    this.settings = new SettingsService(this.kv);
    this.secrets = new SecretStore(db, safeStorageCipher, this.clock);
    this.windows = new WindowManager({
      kv: this.kv,
      preloadPath: paths.preloadPath,
      iconPath: paths.iconPath,
      getSettings: () => this.settings.get(),
      onCompanionState: (s) => this.emit('companion.state', s),
      shouldHideOnClose: () => this.settings.get().startup.closeToTray && this.tray.available,
      isQuitting: () => this.quitting,
    });
    this.notifications = new NotificationCenter(
      db,
      this.kv,
      this.clock,
      () => this.settings.get(),
      {
        show: ({ title, body, silent }, onClick) => {
          if (!Notification.isSupported()) return false;
          const n = new Notification({ title, body, silent });
          n.on('click', onClick);
          n.show();
          return true;
        },
      },
      (n) => this.emit('notification', n),
      (n) => this.windows.showMain(n.action?.route ?? '/inbox'),
    );
    this.tray = new AppTray(paths.trayIconPath, {
      openMain: () => this.windows.showMain(),
      toggleCompanion: () => this.windows.toggleCompanion(true),
      quickCapture: () => this.openQuickCapture(),
      newChat: () => this.windows.showMain('/ai/new'),
      startFocus: () => this.windows.showMain('/productivity/focus?start=1'),
      togglePauseNotifications: () => (this.notifications.pausedUntil() ? this.notifications.resume() : this.notifications.pause(60)),
      notificationsPaused: () => this.notifications.pausedUntil() !== null,
      quit: () => app.quit(),
    });
  }

  static start(paths: AppPaths): AppContext {
    const opened = openDatabase({ dbPath: paths.dbPath, backupDir: paths.backupDir, keepBackups: 5 });
    const draftCount = opened.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM note_drafts')?.n ?? 0;
    const ctx = new AppContext(paths, opened.db, {
      migratedFrom: opened.migratedFrom,
      migratedTo: opened.migratedTo,
      backupPath: opened.backupPath,
      recoveredFromCorruption: opened.recoveredFromCorruption,
      recoveryDetail: opened.recoveryDetail,
      draftsToRecover: draftCount,
    });
    ctx.init();
    return ctx;
  }

  private init(): void {
    pruneBackups(this.paths.backupDir, this.settings.get().data.backupsToKeep);
    const traySupported = this.tray.create();
    this.capabilities = detectCapabilities(traySupported);
    this.applySettings(this.settings.get(), null);
    this.settings.events.on('changed', ({ settings, previous }) => {
      this.applySettings(settings, previous);
      this.emit('settings.changed', settings);
    });
    screen.on('display-removed', () => this.windows.rehomeWindows());
    screen.on('display-metrics-changed', () => this.windows.rehomeWindows());
    powerMonitor.on('resume', () => this.onResume());
  }

  /** Applies settings that live outside the UI: theme, shortcuts, login item, windows. */
  private applySettings(s: Settings, prev: Settings | null): void {
    nativeTheme.themeSource = s.appearance.theme;
    if (!prev || JSON.stringify(prev.shortcuts) !== JSON.stringify(s.shortcuts)) {
      this.shortcutStatus = applyShortcuts(s, {
        toggleCompanion: () => this.windows.toggleCompanion(true),
        quickCapture: () => this.openQuickCapture(),
        showMainWindow: () => this.windows.showMain(),
      });
    }
    if (prev && prev.startup.launchAtLogin !== s.startup.launchAtLogin) {
      this.launchAtLoginError = applyLaunchAtLogin(s.startup.launchAtLogin);
    }
    if (prev) this.windows.applySettings(s);
  }

  openQuickCapture(): void {
    this.windows.showMain('/capture');
    this.emit('quickCapture.open', {});
  }

  protected onResume(): void {
    // Timers may have been suspended; schedulers re-arm here.
    this.resumeHandlers.forEach((fn) => fn());
  }

  readonly resumeHandlers: (() => void)[] = [];

  emit<K extends AppEventName>(type: K, payload: AppEvents[K]): void {
    this.windows.broadcast(type, payload);
  }

  copyText(text: string): void {
    clipboard.writeText(text);
  }

  backups() {
    return listBackups(this.paths.backupDir);
  }

  showError(title: string, message: string): void {
    dialog.showErrorBox(title, message);
  }

  shutdown(): void {
    this.tray.destroy();
    this.db.close();
  }
}
