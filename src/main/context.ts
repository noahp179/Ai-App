import { Notification, app, clipboard, dialog, nativeTheme, net, powerMonitor, screen } from 'electron';
import { AiTasksService } from '../core/aitasks';
import { AiService } from '../core/ai/service';
import { BookmarksService } from '../core/bookmarks';
import { EventsService } from '../core/calendar/events';
import { RemindersService } from '../core/calendar/reminders';
import { CaptureService } from '../core/capture';
import type { Db } from '../core/db/database';
import { createBackup, listBackups, openDatabase, pruneBackups } from '../core/db/open';
import { DataService } from '../core/data';
import fs from 'node:fs';
import path from 'node:path';
import { FeedService } from '../core/feed/service';
import { FocusService } from '../core/focus';
import { GamesService } from '../core/games';
import { KvStore } from '../core/kv';
import { LinksService } from '../core/links';
import { NotesService } from '../core/notes';
import { NotificationCenter, resolveZone } from '../core/notifications';
import { Scheduler } from '../core/scheduler';
import { SearchService } from '../core/search';
import { SecretStore } from '../core/secrets';
import { SettingsService } from '../core/settings';
import { TasksService } from '../core/tasks';
import { TimeTrackingService } from '../core/timetracking';
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

const FOCUS_LABEL: Record<string, string> = { focus: 'Focus session', short_break: 'Short break', long_break: 'Long break' };

/**
 * Owns every long-lived object in the main process. Services are created here
 * and exposed to the UI through src/main/api.ts.
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
  readonly scheduler: Scheduler;
  readonly notes: NotesService;
  readonly links: LinksService;
  readonly tasks: TasksService;
  readonly bookmarks: BookmarksService;
  readonly time: TimeTrackingService;
  readonly focus: FocusService;
  readonly search: SearchService;
  readonly capture: CaptureService;
  readonly aiTasks: AiTasksService;
  readonly ai: AiService;
  readonly events: EventsService;
  readonly data: DataService;
  readonly feed: FeedService;
  readonly games: GamesService;
  readonly reminders: RemindersService;
  readonly startup: StartupReport;
  capabilities!: Capabilities;
  shortcutStatus: ShortcutStatus[] = [];
  quitting = false;
  launchAtLoginError: string | null = null;
  /** Set by parental controls; returns why a copy is blocked in a context, or null. */
  copyBlockedReason: ((context: CopyContext) => string | null) | null = null;
  /** Set by parental controls when tutor mode is on. */
  tutorPrompt: (() => string | null) | null = null;
  /** Extra search sources (learning catalogue, etc.), registered by later modules. */
  readonly resumeHandlers: (() => void)[] = [];

  private constructor(
    readonly paths: AppPaths,
    db: Db,
    startup: StartupReport,
  ) {
    this.db = db;
    this.startup = startup;
    const zone = () => resolveZone(this.settings.get().calendar.timeZone);
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
    this.scheduler = new Scheduler(this.clock);
    this.notes = new NotesService(db, this.clock);
    this.links = new LinksService(db, this.clock, (id) => this.resourceTitle(id));
    this.tasks = new TasksService(db, this.clock, zone);
    this.bookmarks = new BookmarksService(db, this.clock);
    this.time = new TimeTrackingService(db, this.clock, zone);
    this.focus = new FocusService(db, this.clock, () => this.settings.get(), zone);
    this.search = new SearchService(db, [{ search: (q, limit) => this.extraSearch(q, limit) }]);
    this.capture = new CaptureService(this.notes, this.tasks, this.bookmarks);
    this.events = new EventsService(db, this.clock, zone);
    this.data = new DataService(db);
    this.games = new GamesService(db, this.clock);
    this.feed = new FeedService({
      db,
      clock: this.clock,
      kv: this.kv,
      settings: () => this.settings.get(),
      fetch: ((input: Parameters<typeof fetch>[0], init?: RequestInit) => net.fetch(input instanceof URL ? input.toString() : (input as string), init)) as typeof fetch,
      userAgent: `FlowCompanion/${app.getVersion()} (+https://github.com/noahp179/Ai-App)`,
      onAlert: (item, keyword) =>
        this.notifications.notify({
          dedupeKey: `feed-alert:${item.id}`,
          kind: 'feed_alert',
          title: `News alert: ${keyword}`,
          body: `${item.title} — ${item.sourceName}`,
          action: { route: `/news?item=${item.id}` },
        }),
    });
    this.reminders = new RemindersService(db, this.clock, this.events, this.tasks, this.notifications, () => this.settings.get().notifications.missedGraceMinutes);
    this.aiTasks = new AiTasksService(db, this.clock, (t) => {
      this.emit('ai.task', t);
      this.scheduler.wake();
    });
    this.ai = new AiService({
      db,
      clock: this.clock,
      secrets: this.secrets,
      settings: () => this.settings.get(),
      tasks: this.aiTasks,
      fetch: ((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
        net.fetch(input instanceof URL ? input.toString() : (input as string), init as RequestInit)) as typeof fetch,
      emitStream: (e) => this.emit('ai.stream', e),
      emitChanged: (entity, id) => this.emit('data.changed', { entity, id }),
      notifyDone: (c, m) =>
        this.notifications.notify({
          dedupeKey: `ai-done:${m.id}`,
          kind: 'ai_task',
          title: 'AI response ready',
          body: c.title,
          action: { route: `/ai/${c.id}` },
        }),
      isFocused: () => this.windows.anyFocused(),
      resolveAttachment: (a) => this.resolveAttachment(a),
      extraSystemPrompt: () => this.tutorPrompt?.() ?? null,
    });
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

  /** Extension points filled in by later modules. */
  resourceTitle: (id: string) => string | null = () => null;
  extraSearch: (q: string, limit: number) => ReturnType<SearchService['search']> = () => [];

  private resolveAttachment(a: { type: 'note' | 'event' | 'task'; id: string }): { label: string; text: string } | null {
    try {
      if (a.type === 'note') {
        const n = this.notes.get(a.id);
        return { label: `note: ${n.title || 'Untitled'}`, text: n.body };
      }
      if (a.type === 'task') {
        const t = this.tasks.get(a.id);
        const due = t.dueAt ? `\nDue: ${t.dueAt}` : '';
        const subs = t.subtasks?.length ? `\nChecklist:\n${t.subtasks.map((s) => `- [${s.done ? 'x' : ' '}] ${s.title}`).join('\n')}` : '';
        return { label: `task: ${t.title}`, text: `${t.title}${due}${t.notes ? `\n\n${t.notes}` : ''}${subs}` };
      }
      return this.resolveEventAttachment(a.id);
    } catch {
      return null;
    }
  }

  private resolveEventAttachment(id: string): { label: string; text: string } | null {
    const ev = this.events.get(id);
    const when = ev.allDay ? `${ev.start} to ${ev.end} (all day)` : `${ev.start} to ${ev.end} (${ev.timeZone})`;
    const parts = [`${ev.title}`, `When: ${when}`];
    if (ev.location) parts.push(`Where: ${ev.location}`);
    if (ev.notes) parts.push('', ev.notes);
    if (ev.checklist.length) parts.push('', 'Checklist:', ...ev.checklist.map((c) => `- [${c.done ? 'x' : ' '}] ${c.text}`));
    return { label: `event: ${ev.title}`, text: parts.join('\n') };
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
    this.housekeeping();
    this.registerSchedules();
    this.scheduler.wake();
  }

  private housekeeping(): void {
    try {
      this.feed.seedDefaults();
      this.ai.housekeeping();
      this.notes.purgeTrash(this.settings.get().notes.trashRetentionDays);
      this.notifications.pruneLog(30);
    } catch (err) {
      console.error('housekeeping failed', err);
    }
  }

  private registerSchedules(): void {
    this.scheduler.add({
      name: 'feed',
      nextAt: () => this.feed.nextRefreshAt(),
      run: () => {
        // Mark the attempt first so an offline machine does not retry in a tight loop.
        this.kv.set('feed:lastRefresh', this.clock.now().toISOString());
        void this.feed.refresh().then((results) => {
          this.emit('feed.refreshed', results);
          this.changed('news');
        });
      },
    });
    this.scheduler.add({
      name: 'reminders',
      nextAt: () => this.reminders.nextAt(),
      run: () => {
        if (this.reminders.deliverDue() > 0) this.changed('inbox');
      },
    });
    this.scheduler.add({
      name: 'focus',
      nextAt: () => {
        const s = this.focus.current();
        return s && !s.pausedAt ? new Date(s.endsAt) : null;
      },
      run: () => {
        const done = this.focus.completeIfDue();
        if (!done) return;
        this.notifications.notify({
          dedupeKey: `focus:${done.id}`,
          kind: 'focus',
          title: `${FOCUS_LABEL[done.kind]} complete`,
          body: done.kind === 'focus' ? 'Time for a break.' : 'Ready for the next focus session?',
          action: { route: '/productivity/focus' },
        });
        if (done.kind === 'focus' && this.settings.get().productivity.autoStartBreaks) this.focus.start(this.focus.nextKind());
        this.emit('focus.tick', this.focus.current());
      },
    });
    this.scheduler.add({
      name: 'ai-timers',
      nextAt: () => {
        const t = this.aiTasks.nextTimerAt();
        return t ? new Date(t) : null;
      },
      run: () => {
        for (const t of this.aiTasks.expireTimers()) {
          this.notifications.notify({
            dedupeKey: `ai-timer:${t.id}`,
            kind: 'ai_task',
            title: `Timer ended: ${t.title}`,
            body: 'FlowCompanion cannot see whether it finished. Check it, then mark it done.',
            action: { route: '/ai/tasks' },
          });
          this.aiTasks.markNotified(t.id);
          this.emit('ai.task', this.aiTasks.get(t.id));
        }
      },
    });
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
    if (prev && prev.data.backupsToKeep !== s.data.backupsToKeep) pruneBackups(this.paths.backupDir, s.data.backupsToKeep);
    if (prev) this.windows.applySettings(s);
    if (prev) this.scheduler.wake();
  }

  openQuickCapture(): void {
    this.windows.showMain();
    this.emit('quickCapture.open', {});
  }

  private onResume(): void {
    this.scheduler.wake();
    this.resumeHandlers.forEach((fn) => fn());
  }

  emit<K extends AppEventName>(type: K, payload: AppEvents[K]): void {
    this.windows.broadcast(type, payload);
  }

  changed(entity: string, id?: string): void {
    this.emit('data.changed', { entity, id });
  }

  copyText(text: string): void {
    clipboard.writeText(text);
  }

  backups() {
    return listBackups(this.paths.backupDir).map(({ file, size, createdAt }) => ({ file, size, createdAt }));
  }

  createBackup(label = 'manual'): string {
    return path.basename(createBackup(this.db, this.paths.backupDir, label, this.clock.now(), this.settings.get().data.backupsToKeep));
  }

  /** Replaces the database with a backup and restarts. The current data is backed up first. */
  restoreBackup(file: string): void {
    const backup = listBackups(this.paths.backupDir).find((b) => b.file === file);
    if (!backup) throw new Error('That backup does not exist.');
    createBackup(this.db, this.paths.backupDir, 'before-restore', this.clock.now(), this.settings.get().data.backupsToKeep + 1);
    this.quitting = true;
    this.scheduler.stop();
    this.db.close();
    for (const ext of ['-wal', '-shm']) fs.rmSync(this.paths.dbPath + ext, { force: true });
    fs.copyFileSync(backup.path, this.paths.dbPath);
    app.relaunch();
    app.exit(0);
  }

  /** Deletes the database, its backups and all secrets, then restarts empty. */
  deleteAllData(): void {
    this.quitting = true;
    this.scheduler.stop();
    this.db.close();
    for (const ext of ['', '-wal', '-shm']) fs.rmSync(this.paths.dbPath + ext, { force: true });
    fs.rmSync(this.paths.backupDir, { recursive: true, force: true });
    app.relaunch();
    app.exit(0);
  }

  showError(title: string, message: string): void {
    dialog.showErrorBox(title, message);
  }

  shutdown(): void {
    this.scheduler.stop();
    this.tray.destroy();
    this.db.close();
  }
}
