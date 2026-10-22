import { app } from 'electron';
import { UserError } from '../core/util';
import type { FlowApi } from '../shared/api';
import { APP_MODES, type AppMode } from '../shared/settings';
import type { AppInfo } from '../shared/types';
import type { AppContext } from './context';
import { openExternalSafe } from './security';

function str(v: unknown, name: string, max = 10_000): string {
  if (typeof v !== 'string') throw new UserError(`${name} must be text.`);
  if (v.length > max) throw new UserError(`${name} is too long.`);
  return v;
}

/** Builds the IPC-facing API from the app context. Arguments from the UI are validated here or in services. */
export function createApi(ctx: AppContext): FlowApi {
  const info = (): AppInfo => ({
    name: 'FlowCompanion',
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron ?? '',
    chrome: process.versions.chrome ?? '',
    node: process.versions.node,
    sqlite: ctx.db.get<{ v: string }>('SELECT sqlite_version() AS v')?.v ?? '',
    dataDir: ctx.paths.dataDir,
    dbPath: ctx.paths.dbPath,
    isPackaged: app.isPackaged,
    systemTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return {
    app: {
      info,
      capabilities: () => ctx.capabilities,
      startupReport: () => ctx.startup,
      openExternal: (url) => openExternalSafe(str(url, 'URL', 4000)),
      copyText: (text, context) => {
        str(text, 'Text', 2_000_000);
        const blocked = ctx.copyBlockedReason?.(context) ?? null;
        if (blocked) return { copied: false, reason: blocked };
        ctx.copyText(text);
        return { copied: true, reason: null };
      },
      relaunch: () => {
        app.relaunch();
        app.quit();
      },
      quit: () => app.quit(),
      setLastRoute: (route) => {
        const r = str(route, 'Route', 500);
        if (r.startsWith('/') && !r.startsWith('/companion')) ctx.kv.set('ui:lastRoute', r);
      },
    },
    inbox: {
      list: (limit) => ctx.notifications.list(typeof limit === 'number' ? limit : 100),
      unreadCount: () => ctx.notifications.unreadCount(),
      markRead: (id) => ctx.notifications.markRead(str(id, 'id', 100)),
      markAllRead: () => ctx.notifications.markAllRead(),
      clear: () => ctx.notifications.clear(),
      pause: (minutes) => {
        if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0 || minutes > 7 * 24 * 60) throw new UserError('Pause must be between 1 minute and 7 days.');
        const until = ctx.notifications.pause(minutes);
        ctx.tray.refresh();
        return until;
      },
      resume: () => {
        ctx.notifications.resume();
        ctx.tray.refresh();
      },
      pausedUntil: () => ctx.notifications.pausedUntil(),
    },
    settings: {
      get: () => ctx.settings.get(),
      update: (patch) => ctx.settings.update(patch),
      applyMode: (mode) => {
        if (!APP_MODES.includes(mode as AppMode)) throw new UserError('Unknown mode.');
        return ctx.settings.applyMode(mode);
      },
      reset: (section) => ctx.settings.reset(section),
      timeZones: () => Intl.supportedValuesOf('timeZone'),
      shortcutStatus: () => ctx.shortcutStatus,
    },
    window: {
      showMain: (route) => ctx.windows.showMain(route === undefined ? undefined : str(route, 'Route', 500)),
      toggleCompanion: () => ctx.windows.toggleCompanion(true),
      companionState: () => ctx.windows.companionState(),
      setCompanionCollapsed: (collapsed) => ctx.windows.setCompanionCollapsed(collapsed === true),
      setCompanionDock: (dock) => {
        if (!['floating', 'left', 'right'].includes(dock)) throw new UserError('Unknown dock position.');
        ctx.settings.update({ companion: { dock } });
        return ctx.windows.companionState();
      },
      hideCompanion: () => ctx.windows.hideCompanion(),
      minimizeCompanion: () => ctx.windows.minimizeCompanion(),
      expandToMain: (route) => {
        ctx.windows.hideCompanion();
        ctx.windows.showMain(route === undefined ? undefined : str(route, 'Route', 500));
      },
    },
  };
}
