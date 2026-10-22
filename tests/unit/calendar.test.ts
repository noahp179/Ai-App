import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { EventsService } from '../../src/core/calendar/events';
import { RemindersService } from '../../src/core/calendar/reminders';
import { describeRule, expandEvent } from '../../src/core/calendar/recurrence';
import { KvStore } from '../../src/core/kv';
import { NotificationCenter, inQuietHours } from '../../src/core/notifications';
import { SettingsService } from '../../src/core/settings';
import { TasksService } from '../../src/core/tasks';
import type { CalendarEvent, InboxNotification } from '../../src/shared/types';
import { FakeClock, memoryDb } from '../helpers/db';

function ev(p: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'e1',
    title: 'Standup',
    notes: '',
    location: '',
    meetingUrl: '',
    category: 'work',
    allDay: false,
    start: '2026-03-02T09:00',
    end: '2026-03-02T09:30',
    timeZone: 'America/New_York',
    recurrence: null,
    overrides: [],
    checklist: [],
    reminders: [],
    source: 'local',
    createdAt: '',
    updatedAt: '',
    ...p,
  };
}
const range = (a: string, b: string) => [new Date(a), new Date(b)] as const;
const opts = { displayZone: 'America/New_York' };

describe('recurrence', () => {
  it('keeps 09:00 local across the US spring-forward DST change', () => {
    const e = ev({ recurrence: { freq: 'daily', interval: 1 } });
    const occ = expandEvent(e, ...range('2026-03-06T00:00:00Z', '2026-03-11T00:00:00Z'), opts);
    // DST starts Sunday 2026-03-08 in New York: UTC offset -5 → -4.
    expect(occ.map((o) => o.startUtc)).toEqual([
      '2026-03-06T14:00:00.000Z',
      '2026-03-07T14:00:00.000Z',
      '2026-03-08T13:00:00.000Z',
      '2026-03-09T13:00:00.000Z',
      '2026-03-10T13:00:00.000Z',
    ]);
    expect(occ.every((o) => new Date(o.endUtc).getTime() - new Date(o.startUtc).getTime() === 30 * 60_000)).toBe(true);
  });

  it('handles the London autumn DST change and a nonexistent local time', () => {
    const e = ev({ timeZone: 'Europe/London', start: '2026-10-20T08:00', end: '2026-10-20T09:00', recurrence: { freq: 'weekly', interval: 1 } });
    const occ = expandEvent(e, ...range('2026-10-19T00:00:00Z', '2026-11-04T00:00:00Z'), { displayZone: 'Europe/London' });
    expect(occ.map((o) => o.startUtc)).toEqual(['2026-10-20T07:00:00.000Z', '2026-10-27T08:00:00.000Z', '2026-11-03T08:00:00.000Z']);
    // 02:30 does not exist on 2026-03-29 in London; it is moved forward rather than dropped.
    const gap = ev({ timeZone: 'Europe/London', start: '2026-03-29T01:30', end: '2026-03-29T02:00' });
    expect(expandEvent(gap, ...range('2026-03-28T00:00:00Z', '2026-03-30T00:00:00Z'), { displayZone: 'Europe/London' })).toHaveLength(1);
  });

  it('places events correctly when the display zone differs', () => {
    const e = ev({ start: '2026-06-01T09:00', end: '2026-06-01T10:00' });
    const [o] = expandEvent(e, ...range('2026-06-01T00:00:00Z', '2026-06-02T00:00:00Z'), { displayZone: 'Asia/Tokyo' });
    expect(o!.startUtc).toBe('2026-06-01T13:00:00.000Z');
    expect(DateTime.fromISO(o!.startUtc).setZone('Asia/Tokyo').toFormat('HH:mm')).toBe('22:00');
  });

  it('supports weekly on several days with an interval and a count', () => {
    const e = ev({ start: '2026-03-02T09:00', end: '2026-03-02T09:15', recurrence: { freq: 'weekly', interval: 2, byWeekday: [1, 3, 5], count: 5 } });
    const occ = expandEvent(e, ...range('2026-03-01T00:00:00Z', '2026-05-01T00:00:00Z'), opts);
    expect(occ.map((o) => o.occurrenceKey)).toEqual(['2026-03-02T09:00', '2026-03-04T09:00', '2026-03-06T09:00', '2026-03-16T09:00', '2026-03-18T09:00']);
  });

  it('skips months without the day and supports nth and last weekday', () => {
    const on31 = ev({ start: '2026-01-31T10:00', end: '2026-01-31T11:00', recurrence: { freq: 'monthly', interval: 1, count: 4 } });
    expect(expandEvent(on31, ...range('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'), opts).map((o) => o.occurrenceKey.slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
      '2026-07-31',
    ]);
    const secondTue = ev({ start: '2026-01-13T18:00', end: '2026-01-13T19:00', recurrence: { freq: 'monthly', interval: 1, byWeekday: [2], bySetPos: 2, count: 3 } });
    expect(expandEvent(secondTue, ...range('2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z'), opts).map((o) => o.occurrenceKey.slice(0, 10))).toEqual(['2026-01-13', '2026-02-10', '2026-03-10']);
    const lastFri = ev({ start: '2026-01-30T17:00', end: '2026-01-30T18:00', recurrence: { freq: 'monthly', interval: 1, byWeekday: [5], bySetPos: -1, count: 3 } });
    expect(expandEvent(lastFri, ...range('2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z'), opts).map((o) => o.occurrenceKey.slice(0, 10))).toEqual(['2026-01-30', '2026-02-27', '2026-03-27']);
  });

  it('only repeats Feb 29 in leap years and honours until', () => {
    const e = ev({ allDay: true, start: '2028-02-29', end: '2028-02-29', recurrence: { freq: 'yearly', interval: 1, until: '2036-12-31' } });
    const occ = expandEvent(e, ...range('2028-01-01T00:00:00Z', '2040-01-01T00:00:00Z'), opts);
    expect(occ.map((o) => o.startDate)).toEqual(['2028-02-29', '2032-02-29', '2036-02-29']);
  });

  it('applies cancelled and modified occurrences', () => {
    const e = ev({
      recurrence: { freq: 'daily', interval: 1, count: 4 },
      overrides: [
        { originalStart: '2026-03-03T09:00', cancelled: true },
        { originalStart: '2026-03-04T09:00', title: 'Moved standup', start: '2026-03-04T15:00', end: '2026-03-04T15:30' },
      ],
    });
    const occ = expandEvent(e, ...range('2026-03-01T00:00:00Z', '2026-03-10T00:00:00Z'), opts);
    expect(occ.map((o) => [o.occurrenceKey, o.title, o.modified])).toEqual([
      ['2026-03-02T09:00', 'Standup', false],
      ['2026-03-04T09:00', 'Moved standup', true],
      ['2026-03-05T09:00', 'Standup', false],
    ]);
    expect(occ[1]!.startUtc).toBe('2026-03-04T20:00:00.000Z');
  });

  it('expands multi-day all-day events in the display zone', () => {
    const e = ev({ allDay: true, start: '2026-07-01', end: '2026-07-03' });
    const [o] = expandEvent(e, ...range('2026-06-30T00:00:00Z', '2026-07-10T00:00:00Z'), { displayZone: 'Europe/Paris' });
    expect(o).toMatchObject({ startDate: '2026-07-01', endDate: '2026-07-03', startUtc: '2026-06-30T22:00:00.000Z', endUtc: '2026-07-03T22:00:00.000Z' });
  });

  it('stays fast for long-running series', () => {
    const e = ev({ start: '2000-01-01T09:00', end: '2000-01-01T10:00', recurrence: { freq: 'daily', interval: 1 } });
    const t = performance.now();
    const occ = expandEvent(e, ...range('2026-05-01T00:00:00Z', '2026-06-01T00:00:00Z'), opts);
    expect(occ).toHaveLength(31);
    expect(performance.now() - t).toBeLessThan(200);
  });

  it('describes rules in words', () => {
    const start = DateTime.fromISO('2026-01-13T18:00', { zone: 'UTC' });
    expect(describeRule({ freq: 'monthly', interval: 1, byWeekday: [2], bySetPos: 2 }, start)).toBe('Monthly on the second Tuesday');
    expect(describeRule({ freq: 'weekly', interval: 2, byWeekday: [1, 3], count: 6 }, start)).toBe('Every 2 weeks on Mon, Wed, 6 times');
  });
});

function setup(start = '2026-03-02T13:00:00.000Z') {
  const db = memoryDb();
  const clock = new FakeClock(start);
  const settings = new SettingsService(new KvStore(db, clock));
  settings.update({ calendar: { timeZone: 'America/New_York' } });
  const delivered: InboxNotification[] = [];
  const shown: string[] = [];
  const notifications = new NotificationCenter(
    db,
    new KvStore(db, clock),
    clock,
    () => settings.get(),
    { show: (n) => (shown.push(n.title), true) },
    (n) => delivered.push(n),
    () => {},
  );
  const events = new EventsService(db, clock, () => 'America/New_York');
  const tasks = new TasksService(db, clock, () => 'America/New_York');
  const reminders = new RemindersService(db, clock, events, tasks, notifications, () => settings.get().notifications.missedGraceMinutes);
  return { db, clock, settings, notifications, events, tasks, reminders, delivered, shown };
}

describe('events service', () => {
  it('validates input', () => {
    const { events } = setup();
    const base = { title: 'x', start: '2026-03-02T09:00', end: '2026-03-02T10:00', timeZone: 'America/New_York' };
    expect(() => events.create({ ...base, title: ' ' })).toThrow(/title/);
    expect(() => events.create({ ...base, end: '2026-03-02T08:00' })).toThrow(/ends before/);
    expect(() => events.create({ ...base, timeZone: 'Mars/Olympus' })).toThrow(/time zone/);
    expect(() => events.create({ ...base, meetingUrl: 'javascript:alert(1)' })).toThrow(/http/);
    expect(() => events.create({ ...base, recurrence: { freq: 'daily', interval: 1, count: 3, until: '2026-04-01' } })).toThrow(/either/);
    expect(() => events.create({ ...base, recurrence: { freq: 'monthly', interval: 1, bySetPos: 2 } })).toThrow(/one weekday/);
    expect(events.create(base).title).toBe('x');
  });

  it('edits and deletes single occurrences, following ones, or the series', () => {
    const { events } = setup();
    const e = events.create({ title: 'Gym', start: '2026-03-02T07:00', end: '2026-03-02T08:00', timeZone: 'America/New_York', recurrence: { freq: 'daily', interval: 1 } });
    const window = ['2026-03-01T00:00:00Z', '2026-03-09T00:00:00Z'] as const;
    events.updateOccurrence(e.id, '2026-03-03T07:00', { title: 'Gym (late)', start: '2026-03-03T18:00', end: '2026-03-03T19:00' }, 'this');
    events.deleteOccurrence(e.id, '2026-03-04T07:00', 'this');
    let occ = events.occurrences(...window);
    expect(occ.map((o) => o.title)).toEqual(['Gym', 'Gym (late)', 'Gym', 'Gym', 'Gym', 'Gym']); // the 4th is deleted
    expect(() => events.updateOccurrence(e.id, '2026-03-03T08:00', { title: 'nope' }, 'this')).toThrow(/not part/);

    const split = events.updateOccurrence(e.id, '2026-03-06T07:00', { start: '2026-03-06T06:00', end: '2026-03-06T07:00' }, 'following');
    expect(split.id).not.toBe(e.id);
    occ = events.occurrences(...window);
    expect(occ.map((o) => DateTime.fromISO(o.startUtc).setZone('America/New_York').toFormat('dd HH:mm'))).toEqual([
      '02 07:00',
      '03 18:00',
      '05 07:00',
      '06 06:00',
      '07 06:00',
      '08 06:00',
    ]);
    events.deleteOccurrence(split.id, '2026-03-07T06:00', 'following');
    expect(events.occurrences(...window)).toHaveLength(4);
    events.deleteOccurrence(e.id, '2026-03-02T07:00', 'all');
    expect(events.occurrences(...window).map((o) => o.eventId)).toEqual([split.id]);
  });

  it('moves a whole series when one occurrence is moved with scope "all"', () => {
    const { events } = setup();
    const e = events.create({ title: 'Class', start: '2026-03-02T10:00', end: '2026-03-02T11:00', timeZone: 'America/New_York', recurrence: { freq: 'weekly', interval: 1 } });
    events.updateOccurrence(e.id, '2026-03-09T10:00', { start: '2026-03-09T13:00', end: '2026-03-09T14:30' }, 'all');
    expect(events.get(e.id)).toMatchObject({ start: '2026-03-02T13:00', end: '2026-03-02T14:30' });
  });
});

describe('reminders', () => {
  it('fires custom reminders once, survives restarts and supports snooze', () => {
    const s = setup();
    const r = s.reminders.create({ title: 'Call the bank', fireAt: '2026-03-02T13:30:00.000Z' });
    expect(s.reminders.nextAt()?.toISOString()).toBe('2026-03-02T13:30:00.000Z');
    s.clock.set('2026-03-02T13:30:00.000Z');
    expect(s.reminders.deliverDue()).toBe(1);
    expect(s.reminders.deliverDue()).toBe(0);
    // A "restart": new service instances over the same database.
    const again = new RemindersService(s.db, s.clock, s.events, s.tasks, s.notifications, () => 720);
    expect(again.deliverDue()).toBe(0);
    expect(s.delivered).toHaveLength(1);
    s.reminders.snooze(r.id, 10);
    s.clock.advanceMinutes(10);
    expect(s.reminders.deliverDue()).toBe(1);
    expect(s.delivered.map((d) => d.title)).toEqual(['Call the bank', 'Call the bank']);
    s.reminders.complete(r.id);
    expect(s.reminders.list()).toHaveLength(0);
  });

  it('fires each event reminder offset for each occurrence', () => {
    const s = setup('2026-03-02T13:00:00.000Z');
    s.events.create({ title: 'Standup', start: '2026-03-02T09:00', end: '2026-03-02T09:15', timeZone: 'America/New_York', reminders: [10, 0], recurrence: { freq: 'daily', interval: 1, count: 2 } });
    expect(s.reminders.nextAt()?.toISOString()).toBe('2026-03-02T13:50:00.000Z');
    s.clock.set('2026-03-02T13:50:00.000Z');
    s.reminders.deliverDue();
    s.clock.set('2026-03-02T14:00:00.000Z');
    s.reminders.deliverDue();
    s.clock.set('2026-03-03T13:50:00.000Z');
    s.reminders.deliverDue();
    s.clock.set('2026-03-03T14:00:00.000Z');
    s.reminders.deliverDue();
    expect(s.delivered.map((d) => [d.title, d.body])).toEqual([
      ['Standup', 'In 10 minutes'],
      ['Standup', 'Starting now'],
      ['Standup', 'In 10 minutes'],
      ['Standup', 'Starting now'],
    ]);
    expect(s.delivered[2]!.delivery).toBe('os');
  });

  it('announces reminders missed while closed, within the grace period only', () => {
    const s = setup('2026-03-02T08:00:00.000Z');
    s.reminders.create({ title: 'Old', fireAt: '2026-03-01T08:00:00.000Z' });
    s.reminders.create({ title: 'Recent', fireAt: '2026-03-02T07:00:00.000Z' });
    s.reminders.deliverDue();
    expect(s.delivered.map((d) => [d.title, d.delivery])).toEqual([['Missed: Recent', 'missed']]);
    // Both are still open until completed; only the recent one was announced.
    expect(s.reminders.overdue().map((r) => r.title)).toEqual(['Old', 'Recent']);
  });

  it('holds banners during quiet hours but keeps them in the inbox', () => {
    const s = setup('2026-03-03T04:00:00.000Z'); // 23:00 in New York
    s.settings.update({ notifications: { quietHours: { enabled: true, start: '22:00', end: '07:00' } } });
    s.reminders.create({ title: 'Late', fireAt: '2026-03-03T04:00:00.000Z' });
    s.reminders.deliverDue();
    expect(s.shown).toEqual([]);
    expect(s.notifications.list()[0]).toMatchObject({ title: 'Late', delivery: 'quiet_hours' });
  });

  it('alerts when a task comes due', () => {
    const s = setup();
    s.tasks.create({ title: 'File taxes', dueAt: '2026-03-02T15:00:00.000Z' });
    expect(s.reminders.nextAt()?.toISOString()).toBe('2026-03-02T15:00:00.000Z');
    s.clock.set('2026-03-02T15:00:30.000Z');
    s.reminders.deliverDue();
    expect(s.delivered[0]!.title).toBe('Task due: File taxes');
  });

  it('turns a snoozed event alert into a one-off reminder', () => {
    const s = setup();
    const r = s.reminders.snoozeNotification('event:abc', 'Dentist', 'In 10 minutes', 5);
    expect(r).toMatchObject({ title: 'Dentist', refType: 'event', refId: 'abc', fireAt: '2026-03-02T13:05:00.000Z' });
  });
});

describe('quiet hours', () => {
  it('handles windows that cross midnight and same-day windows', () => {
    const q = { enabled: true, start: '22:00', end: '07:00' };
    expect(inQuietHours(new Date('2026-03-03T04:00:00Z'), q, 'America/New_York')).toBe(true); // 23:00
    expect(inQuietHours(new Date('2026-03-03T11:30:00Z'), q, 'America/New_York')).toBe(true); // 06:30
    expect(inQuietHours(new Date('2026-03-03T11:59:00Z'), q, 'America/New_York')).toBe(true); // 06:59
    expect(inQuietHours(new Date('2026-03-03T12:00:00Z'), q, 'America/New_York')).toBe(false); // 07:00
    expect(inQuietHours(new Date('2026-03-03T18:00:00Z'), { enabled: true, start: '12:00', end: '14:00' }, 'America/New_York')).toBe(true);
    expect(inQuietHours(new Date('2026-03-03T18:00:00Z'), { enabled: false, start: '12:00', end: '14:00' }, 'America/New_York')).toBe(false);
  });
});

describe('iCalendar export', () => {
  it('writes events, rules, exceptions and alarms', async () => {
    const { toIcs } = await import('../../src/core/calendar/ics');
    const ics = toIcs(
      [
        ev({
          title: 'Team, sync; weekly',
          recurrence: { freq: 'monthly', interval: 1, byWeekday: [2], bySetPos: 2, count: 5 },
          overrides: [{ originalStart: '2026-04-14T09:00', cancelled: true }, { originalStart: '2026-05-12T09:00', start: '2026-05-12T11:00', title: 'Moved' }],
          reminders: [15],
        }),
      ],
      new Date('2026-03-01T00:00:00Z'),
    );
    expect(ics).toContain('SUMMARY:Team\\, sync\\; weekly');
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260302T090000');
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYDAY=2TU;COUNT=5');
    expect(ics).toContain('EXDATE;TZID=America/New_York:20260414T090000');
    expect(ics).toContain('RECURRENCE-ID;TZID=America/New_York:20260512T090000');
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260512T110000');
    expect(ics).toContain('TRIGGER:-PT15M');
    expect(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
});
