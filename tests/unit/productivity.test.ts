import { describe, expect, it } from 'vitest';
import { BookmarksService } from '../../src/core/bookmarks';
import { CaptureService, classifyCapture } from '../../src/core/capture';
import { FocusService } from '../../src/core/focus';
import { KvStore } from '../../src/core/kv';
import { NotesService } from '../../src/core/notes';
import { SearchService } from '../../src/core/search';
import { SettingsService } from '../../src/core/settings';
import { TasksService } from '../../src/core/tasks';
import { TimeTrackingService } from '../../src/core/timetracking';
import { FakeClock, memoryDb } from '../helpers/db';

function setup() {
  const db = memoryDb();
  const clock = new FakeClock('2026-03-10T15:00:00.000Z');
  const settings = new SettingsService(new KvStore(db, clock));
  const zone = () => 'America/New_York';
  const notes = new NotesService(db, clock);
  const tasks = new TasksService(db, clock, zone);
  const bookmarks = new BookmarksService(db, clock);
  return {
    db,
    clock,
    settings,
    notes,
    tasks,
    bookmarks,
    time: new TimeTrackingService(db, clock, zone),
    focus: new FocusService(db, clock, () => settings.get(), zone),
    search: new SearchService(db),
    capture: new CaptureService(notes, tasks, bookmarks),
  };
}

describe('tasks', () => {
  it('creates lists, tasks and checklist items and completes them', () => {
    const { tasks } = setup();
    const l = tasks.createList('Home');
    const t = tasks.create({ title: 'Clean garage', listId: l.id, priority: 2 });
    const sub = tasks.create({ title: 'Sort boxes', parentId: t.id });
    expect(sub.listId).toBe(l.id);
    expect(() => tasks.create({ title: 'too deep', parentId: sub.id })).toThrow(/Checklist items/);
    expect(tasks.list({ listId: l.id })[0]!.subtasks).toHaveLength(1);
    expect(tasks.lists()[0]!.openCount).toBe(1);
    const done = tasks.toggle(t.id, true);
    expect(done.completedAt).not.toBeNull();
    expect(tasks.list({ listId: l.id })).toHaveLength(0);
    expect(tasks.list({ listId: l.id, includeDone: true })).toHaveLength(1);
    expect(tasks.toggle(t.id, false).completedAt).toBeNull();
    expect(() => tasks.create({ title: '   ' })).toThrow(/empty/);
  });

  it('computes today and upcoming in the user time zone', () => {
    const { tasks } = setup();
    // 15:00Z is 11:00 in New York. 23:30 local today = 03:30Z tomorrow.
    tasks.create({ title: 'late tonight', dueAt: '2026-03-11T03:30:00.000Z' });
    tasks.create({ title: 'tomorrow', dueAt: '2026-03-11T15:00:00.000Z' });
    tasks.create({ title: 'overdue', dueAt: '2026-03-09T15:00:00.000Z' });
    expect(tasks.list({ listId: 'today' }).map((t) => t.title)).toEqual(['overdue', 'late tonight']);
    expect(tasks.list({ listId: 'upcoming' }).map((t) => t.title)).toEqual(['tomorrow']);
    expect(tasks.counts()).toMatchObject({ open: 3, overdue: 1, dueToday: 1 });
  });

  it('reorders tasks between neighbours', () => {
    const { tasks } = setup();
    const a = tasks.create({ title: 'a' });
    const b = tasks.create({ title: 'b' });
    const c = tasks.create({ title: 'c' });
    tasks.move(c.id, b.id, a.id);
    expect(tasks.list().map((t) => t.title)).toEqual(['a', 'c', 'b']);
  });
});

describe('bookmarks and reading queue', () => {
  it('stores only http(s) links and manages the queue', () => {
    const { bookmarks } = setup();
    expect(() => bookmarks.create({ url: 'javascript:alert(1)' })).toThrow(/http/);
    expect(() => bookmarks.create({ url: 'file:///etc/passwd' })).toThrow(/http/);
    const b = bookmarks.create({ url: 'https://www.example.com/article', queue: 'unread', tags: ['Read'] });
    expect(b.title).toBe('example.com');
    expect(bookmarks.list({ queue: 'reading' })).toHaveLength(1);
    expect(bookmarks.setRead(b.id, true).readAt).not.toBeNull();
    expect(bookmarks.list({ queue: 'unread' })).toHaveLength(0);
    expect(bookmarks.list({ tag: 'read' })).toHaveLength(1);
    expect(bookmarks.tags()).toEqual(['read']);
  });
});

describe('time tracking', () => {
  it('runs one timer at a time and summarizes by label and day', () => {
    const { time, clock } = setup();
    time.start('Writing');
    clock.advanceMinutes(30);
    time.start('Email');
    clock.advanceMinutes(15);
    time.stop();
    expect(time.running()).toBeNull();
    const s = time.summary(7);
    expect(s.totalMinutes).toBe(45);
    expect(s.byLabel).toEqual([
      { label: 'Writing', minutes: 30 },
      { label: 'Email', minutes: 15 },
    ]);
    const e = time.list()[0]!;
    expect(() => time.update(e.id, { endedAt: '2000-01-01T00:00:00Z' })).toThrow(/after the start/);
  });
});

describe('focus timer', () => {
  it('runs, pauses, resumes and completes sessions, persisting state', () => {
    const { focus, clock } = setup();
    const s = focus.start('focus');
    expect(s.plannedMinutes).toBe(25);
    clock.advanceMinutes(10);
    focus.pause();
    clock.advanceMinutes(60); // paused time does not count
    expect(focus.completeIfDue()).toBeNull();
    focus.resume();
    clock.advanceMinutes(14);
    expect(focus.completeIfDue()).toBeNull();
    clock.advanceMinutes(1);
    expect(focus.completeIfDue()?.completed).toBe(true);
    expect(focus.current()).toBeNull();
    expect(focus.nextKind()).toBe('short_break');
    expect(focus.stats()).toMatchObject({ todaySessions: 1, todayFocusMinutes: 25, streakDays: 1 });
  });

  it('suggests a long break after the configured number of sessions', () => {
    const { focus, clock, settings } = setup();
    settings.update({ productivity: { longBreakEvery: 2 } });
    for (let i = 0; i < 2; i++) {
      focus.start('focus', 1);
      clock.advanceMinutes(1);
      focus.completeIfDue();
    }
    expect(focus.nextKind()).toBe('long_break');
  });
});

describe('global search', () => {
  it('finds notes, tasks and bookmarks with highlighted snippets', () => {
    const { notes, tasks, bookmarks, search } = setup();
    notes.create({ title: 'Kubernetes notes', body: 'pods and services' });
    tasks.create({ title: 'Upgrade kubernetes cluster' });
    bookmarks.create({ url: 'https://kubernetes.io/docs', title: 'K8s docs' });
    const hits = search.search('kubern');
    expect(hits.map((h) => h.type).sort()).toEqual(['bookmark', 'note', 'task']);
    expect(search.search('pods')[0]!.snippet).toContain('\u0002pods\u0003');
    expect(search.search('kubern', { types: ['task'] })).toHaveLength(1);
    expect(search.search('')).toEqual([]);
  });
});

describe('quick capture', () => {
  it('classifies by prefix or content', () => {
    expect(classifyCapture('t: buy milk')).toEqual({ kind: 'task', text: 'buy milk' });
    expect(classifyCapture('https://example.com')).toEqual({ kind: 'bookmark', text: 'https://example.com' });
    expect(classifyCapture('r https://x.dev/post Great read').kind).toBe('reading');
    expect(classifyCapture('An idea')).toEqual({ kind: 'note', text: 'An idea' });
    expect(classifyCapture('t: x', 'note').kind).toBe('note');
  });

  it('creates the right kind of item', () => {
    const { capture, tasks, bookmarks, notes } = setup();
    expect(capture.capture({ text: 'task call mom' })).toMatchObject({ kind: 'task', title: 'call mom' });
    expect(capture.capture({ text: 'read: https://example.org/a A good one' })).toMatchObject({ kind: 'reading', title: 'A good one' });
    expect(capture.capture({ text: 'Remember the\nmultiline idea' })).toMatchObject({ kind: 'note', title: 'Remember the' });
    expect(tasks.list()).toHaveLength(1);
    expect(bookmarks.list({ queue: 'unread' })).toHaveLength(1);
    expect(notes.list()).toHaveLength(1);
    expect(() => capture.capture({ text: '   ' })).toThrow(/Nothing/);
    expect(() => capture.capture({ text: 'b: no link here' })).toThrow(/web address/);
  });
});
