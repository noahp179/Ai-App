import { app, shell } from 'electron';
import { titleFromBody } from '../core/notes';
import { UserError, cleanLine } from '../core/util';
import type { FlowApi, ImportReport, OccurrenceScope } from '../shared/api';
import { CATEGORIES } from '../core/calendar/events';
import { toIcs } from '../core/calendar/ics';
import { APP_MODES, type AppMode } from '../shared/settings';
import type { AppInfo } from '../shared/types';
import type { AppContext } from './context';
import { openExternalSafe } from './security';
import { openTextFiles, parseJsonFile, saveFile } from './files';

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}

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

  const changed = <T>(entity: string, value: T): T => {
    ctx.changed(entity);
    return value;
  };
  const tasksChanged = <T>(v: T): T => {
    ctx.changed('tasks');
    ctx.scheduler.wake();
    return v;
  };
  const changedNote = <T extends { id: string }>(n: T): T => {
    ctx.changed('notes', n.id);
    return n;
  };
  const calendarChanged = <T>(v?: T): T => {
    ctx.changed('calendar');
    ctx.changed('reminders');
    ctx.scheduler.wake();
    return v as T;
  };
  const scopeOf = (s: unknown): OccurrenceScope => {
    if (s !== 'this' && s !== 'following' && s !== 'all') throw new UserError('Unknown scope.');
    return s;
  };
  const focusChanged = <T>(v: T): T => {
    ctx.emit('focus.tick', ctx.focus.current());
    ctx.scheduler.wake();
    return v;
  };

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
      snooze: (notificationId, minutes) => {
        const n = ctx.notifications.get(str(notificationId, 'id', 100));
        if (!n || !n.snoozable || !n.sourceRef) throw new UserError('This notification cannot be snoozed.');
        const r = ctx.reminders.snoozeNotification(n.sourceRef, n.title.replace(/^Missed: /, ''), n.body, minutes ?? ctx.settings.get().notifications.snoozeMinutes);
        ctx.notifications.markRead(n.id);
        calendarChanged();
        return r;
      },
    },
    data: {
      inventory: () => ctx.data.inventory(),
      exportAll: async () =>
        saveFile(`flowcompanion-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(ctx.data.exportAll(new Date(), app.getVersion()), null, 2), [{ name: 'JSON', extensions: ['json'] }]),
      backups: () => ctx.backups(),
      createBackup: () => ({ file: ctx.createBackup() }),
      restoreBackup: (file) => ctx.restoreBackup(str(file, 'Backup', 300)),
      deleteAll: (confirmation) => {
        if (confirmation !== 'DELETE') throw new UserError('Type DELETE to confirm.');
        ctx.deleteAllData();
      },
      openFolder: () => void shell.openPath(ctx.paths.dataDir),
    },
    calendar: {
      occurrences: (from, to) => ctx.events.occurrences(str(from, 'from', 40), str(to, 'to', 40)),
      get: (id) => ctx.events.get(id),
      create: (input) => calendarChanged(ctx.events.create(input)),
      update: (id, patch) => calendarChanged(ctx.events.update(id, patch)),
      delete: (id) => calendarChanged(ctx.events.delete(id)),
      updateOccurrence: (id, key, patch, scope) => calendarChanged(ctx.events.updateOccurrence(id, key, patch, scopeOf(scope))),
      deleteOccurrence: (id, key, scope) => calendarChanged(ctx.events.deleteOccurrence(id, key, scopeOf(scope))),
      restoreOccurrence: (id, key) => calendarChanged(ctx.events.restoreOccurrence(id, key)),
      categories: () => [...CATEGORIES],
      exportIcs: async () =>
        saveFile(`flowcompanion-calendar-${new Date().toISOString().slice(0, 10)}.ics`, toIcs(ctx.events.all(), new Date()), [{ name: 'iCalendar', extensions: ['ics'] }]),
    },
    reminders: {
      list: (includeDone) => ctx.reminders.list({ includeDone: includeDone === true }),
      overdue: () => ctx.reminders.overdue(),
      create: (input) => calendarChanged(ctx.reminders.create(input)),
      update: (id, patch) => calendarChanged(ctx.reminders.update(id, patch)),
      complete: (id) => calendarChanged(ctx.reminders.complete(id)),
      dismiss: (id) => calendarChanged(ctx.reminders.dismiss(id)),
      delete: (id) => calendarChanged(ctx.reminders.delete(id)),
      snooze: (id, minutes) => calendarChanged(ctx.reminders.snooze(id, minutes)),
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
    notes: {
      list: (q) => ctx.notes.list(q ?? {}),
      get: (id) => ctx.notes.get(str(id, 'id', 100)),
      create: (input) => {
        const n = ctx.notes.create(input ?? {}, { defaultFormat: ctx.settings.get().notes.defaultFormat });
        ctx.changed('notes', n.id);
        return n;
      },
      update: (id, patch) => {
        const n = ctx.notes.update(str(id, 'id', 100), patch);
        ctx.changed('notes', n.id);
        return n;
      },
      duplicate: (id) => changedNote(ctx.notes.duplicate(id)),
      archive: (id) => changedNote(ctx.notes.archive(id)),
      unarchive: (id) => changedNote(ctx.notes.unarchive(id)),
      trash: (id) => {
        ctx.notes.trash(id);
        ctx.changed('notes', id);
      },
      restore: (id) => changedNote(ctx.notes.restore(id)),
      deletePermanently: (id) => {
        ctx.notes.deletePermanently(id);
        ctx.changed('notes', id);
      },
      emptyTrash: () => {
        const n = ctx.notes.emptyTrash();
        ctx.changed('notes');
        return n;
      },
      tags: () => ctx.notes.tags(),
      folders: () => ctx.notes.folders(),
      createFolder: (name, parentId) => {
        const f = ctx.notes.createFolder(name, parentId ?? null);
        ctx.changed('notes');
        return f;
      },
      renameFolder: (id, name) => {
        ctx.notes.renameFolder(id, name);
        ctx.changed('notes');
      },
      deleteFolder: (id) => {
        ctx.notes.deleteFolder(id);
        ctx.changed('notes');
      },
      saveDraft: (noteId, title, body, baseRevision) => ctx.notes.saveDraft(noteId, title, body, baseRevision),
      drafts: () => ctx.notes.drafts(),
      draftFor: (noteId) => ctx.notes.draftFor(noteId),
      discardDraft: (noteId) => ctx.notes.discardDraft(noteId),
      recoverDraft: (noteId) => changedNote(ctx.notes.recoverDraft(noteId)),
      exportNote: async (id, format) => {
        if (!['markdown', 'text', 'json'].includes(format)) throw new UserError('Unknown export format.');
        const f = ctx.notes.exportNote(id, format);
        const ext = format === 'json' ? 'json' : format === 'text' ? 'txt' : 'md';
        return saveFile(f.filename, f.content, [{ name: format === 'json' ? 'JSON' : format === 'text' ? 'Text' : 'Markdown', extensions: [ext] }]);
      },
      exportAll: async () => {
        const doc = ctx.notes.exportAll();
        return saveFile(`flowcompanion-notes-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(doc, null, 2), [{ name: 'JSON', extensions: ['json'] }]);
      },
      importFiles: async () => {
        const files = await openTextFiles([{ name: 'Notes', extensions: ['json', 'md', 'markdown', 'txt'] }]);
        if (!files) return null;
        const total: ImportReport = { imported: 0, skipped: 0, errors: [] };
        const json = files.filter((f) => f.name.toLowerCase().endsWith('.json'));
        const text = files.filter((f) => !f.name.toLowerCase().endsWith('.json'));
        for (const f of json) {
          const r = ctx.notes.importJson(parseJsonFile(f.name, f.content));
          total.imported += r.imported;
          total.skipped += r.skipped;
          total.errors.push(...r.errors);
        }
        if (text.length) {
          const r = ctx.notes.importFiles(text);
          total.imported += r.imported;
          total.skipped += r.skipped;
          total.errors.push(...r.errors);
        }
        ctx.changed('notes');
        return total;
      },
    },
    links: {
      link: (fromType, fromId, toType, toId) => {
        const l = ctx.links.link(fromType, fromId, toType, toId);
        ctx.changed('links');
        return l;
      },
      unlink: (id) => {
        ctx.links.unlink(id);
        ctx.changed('links');
      },
      for: (type, id) => ctx.links.linksFor(type, id),
    },
    tasks: {
      lists: () => ctx.tasks.lists(),
      createList: (name) => changed('tasks', ctx.tasks.createList(name)),
      renameList: (id, name) => changed('tasks', ctx.tasks.renameList(id, name)),
      deleteList: (id) => changed('tasks', ctx.tasks.deleteList(id)),
      list: (q) => ctx.tasks.list(q ?? {}),
      get: (id) => ctx.tasks.get(id),
      create: (input) => tasksChanged(ctx.tasks.create(input)),
      update: (id, patch) => tasksChanged(ctx.tasks.update(id, patch)),
      toggle: (id, done) => changed('tasks', ctx.tasks.toggle(id, done === true)),
      delete: (id) => changed('tasks', ctx.tasks.delete(id)),
      move: (id, beforeId, afterId) => changed('tasks', ctx.tasks.move(id, beforeId, afterId)),
      clearCompleted: (listId) => changed('tasks', ctx.tasks.clearCompleted(listId)),
      counts: () => ctx.tasks.counts(),
    },
    bookmarks: {
      list: (q) => ctx.bookmarks.list(q ?? {}),
      create: (input) => changed('bookmarks', ctx.bookmarks.create(input)),
      update: (id, patch) => changed('bookmarks', ctx.bookmarks.update(id, patch)),
      setRead: (id, read) => changed('bookmarks', ctx.bookmarks.setRead(id, read === true)),
      delete: (id) => changed('bookmarks', ctx.bookmarks.delete(id)),
      tags: () => ctx.bookmarks.tags(),
    },
    time: {
      running: () => ctx.time.running(),
      start: (label, taskId) => changed('time', ctx.time.start(label, taskId ?? null)),
      stop: () => changed('time', ctx.time.stop()),
      list: (days) => ctx.time.list(clampInt(days, 1, 366, 7)),
      update: (id, patch) => changed('time', ctx.time.update(id, patch)),
      delete: (id) => changed('time', ctx.time.delete(id)),
      summary: (days) => ctx.time.summary(clampInt(days, 1, 366, 7)),
    },
    focus: {
      current: () => ctx.focus.current(),
      start: (kind, minutes, label) => focusChanged(ctx.focus.start(kind ?? 'focus', minutes, label ?? '')),
      pause: () => focusChanged(ctx.focus.pause()),
      resume: () => focusChanged(ctx.focus.resume()),
      stop: () => focusChanged(ctx.focus.stop(false)),
      stats: () => ctx.focus.stats(),
      history: (limit) => ctx.focus.history(clampInt(limit, 1, 200, 20)),
      nextKind: () => ctx.focus.nextKind(),
    },
    search: {
      query: (q, types) => ctx.search.search(str(q, 'Search', 500), { types, limit: 40 }),
    },
    capture: {
      capture: (input) => {
        const r = ctx.capture.capture(input);
        ctx.changed(r.kind === 'note' ? 'notes' : r.kind === 'task' ? 'tasks' : 'bookmarks', r.id);
        return r;
      },
    },
    ai: {
      status: () => ({ ...ctx.ai.status(), secureStorage: ctx.secrets.secureAvailable }),
      catalog: () => ctx.ai.catalog(),
      providers: () => ctx.ai.providers(),
      createProvider: (input) => {
        const p = ctx.ai.createProvider(input);
        if (ctx.ai.firstProviderCreated) {
          ctx.settings.update({ ai: { defaultProviderId: ctx.ai.firstProviderCreated } });
          ctx.ai.firstProviderCreated = null;
        }
        return p;
      },
      updateProvider: (id, patch) => ctx.ai.updateProvider(id, patch),
      deleteProvider: (id) => {
        ctx.ai.deleteProvider(id);
        if (ctx.settings.get().ai.defaultProviderId === id) ctx.settings.update({ ai: { defaultProviderId: ctx.ai.providers()[0]?.id ?? null } });
      },
      setApiKey: (id, key) => ctx.ai.setApiKey(id, key),
      testProvider: (id) => ctx.ai.testProvider(id),
      models: (id) => ctx.ai.models(id),
      conversations: (q) => ctx.ai.listConversations(q ?? {}),
      conversation: (id) => ctx.ai.conversation(id),
      messages: (id) => ctx.ai.messages(id),
      createConversation: (input) => ctx.ai.createConversation(input ?? {}),
      updateConversation: (id, patch) => ctx.ai.updateConversation(id, patch),
      archiveConversation: (id, archived) => ctx.ai.archiveConversation(id, archived === true),
      deleteConversation: (id) => ctx.ai.deleteConversation(id),
      deleteAllConversations: () => ctx.ai.deleteAllConversations(),
      send: (input) => ctx.ai.send(input),
      retry: (id, opts) => ctx.ai.retry(id, opts ?? {}),
      cancel: (id) => ctx.ai.cancel(id),
      exportConversation: async (id, format) => {
        if (format !== 'markdown' && format !== 'json') throw new UserError('Unknown export format.');
        const f = ctx.ai.exportConversation(id, format);
        return saveFile(f.filename, f.content, [{ name: format === 'json' ? 'JSON' : 'Markdown', extensions: [format === 'json' ? 'json' : 'md'] }]);
      },
      toNote: (conversationId, messageId) => {
        const conv = ctx.ai.conversation(conversationId);
        let note;
        if (messageId) {
          const m = ctx.ai.messages(conversationId).find((x) => x.id === messageId);
          if (!m) throw new UserError('That message no longer exists.');
          note = ctx.notes.create({ title: `${conv.title} — ${titleFromBody(m.content, 'AI answer').slice(0, 60)}`, body: m.content, tags: ['ai'] });
        } else {
          note = ctx.notes.create({ title: conv.title, body: ctx.ai.exportConversation(conversationId, 'markdown').content, tags: ['ai'] });
        }
        ctx.links.link('note', note.id, 'conversation', conversationId);
        ctx.changed('notes', note.id);
        return note;
      },
      toTask: (messageId) => {
        const row = ctx.db.get<{ conversation_id: string; content: string }>('SELECT conversation_id, content FROM messages WHERE id = ?', [str(messageId, 'id', 100)]);
        if (!row) throw new UserError('That message no longer exists.');
        const title = cleanLine(titleFromBody(row.content, 'Follow up on AI answer').replace(/^[-*\d.)\s]+/, ''), 200);
        const task = ctx.tasks.create({ title, notes: row.content.slice(0, 20_000) });
        ctx.links.link('task', task.id, 'conversation', row.conversation_id);
        ctx.changed('tasks', task.id);
        return task;
      },
      tasks: (active) => ctx.aiTasks.list({ active: active === true, limit: 100 }),
      startTimer: (title, minutes, url) => ctx.aiTasks.startTimer(str(title, 'Title', 200), Number(minutes), url ?? null),
      setTaskState: (id, state) => ctx.aiTasks.setManual(id, state),
      deleteTask: (id) => {
        ctx.aiTasks.delete(id);
        ctx.changed('aiTasks');
      },
      clearFinishedTasks: () => {
        const n = ctx.aiTasks.clearFinished();
        ctx.changed('aiTasks');
        return n;
      },
    },
  };
}
