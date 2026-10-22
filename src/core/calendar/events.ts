import { DateTime } from 'luxon';
import { z } from 'zod';
import type { CalendarEvent, ChecklistItem, EventOccurrence, EventOverride, RecurrenceRule } from '../../shared/types';
import type { Db } from '../db/database';
import { bool, json } from '../db/database';
import { type Clock, NotFoundError, UserError, cleanLine, newId, safeHttpUrl } from '../util';
import { DATE, WALL, expandEvent, isOccurrence, parseDate, parseWall } from './recurrence';

interface Row {
  id: string;
  title: string;
  notes: string;
  location: string;
  meeting_url: string;
  category: string;
  all_day: number;
  start: string;
  end: string;
  time_zone: string;
  recurrence: string | null;
  overrides: string;
  checklist: string;
  reminders: string;
  source: 'local';
  created_at: string;
  updated_at: string;
}

const toEvent = (r: Row): CalendarEvent => ({
  id: r.id,
  title: r.title,
  notes: r.notes,
  location: r.location,
  meetingUrl: r.meeting_url,
  category: r.category,
  allDay: bool(r.all_day),
  start: r.start,
  end: r.end,
  timeZone: r.time_zone,
  recurrence: json<RecurrenceRule | null>(r.recurrence, null),
  overrides: json<EventOverride[]>(r.overrides, []),
  checklist: json<ChecklistItem[]>(r.checklist, []),
  reminders: json<number[]>(r.reminders, []),
  source: r.source,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const wall = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use YYYY-MM-DDTHH:mm');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const RecurrenceSchema = z
  .object({
    freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z.number().int().min(1).max(365).default(1),
    byWeekday: z.array(z.number().int().min(1).max(7)).max(7).optional(),
    bySetPos: z.union([z.literal(-1), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    count: z.number().int().min(1).max(1000).optional(),
    until: date.optional(),
  })
  .refine((r) => !(r.count && r.until), 'Choose either a number of times or an end date, not both');

export const EventInput = z.object({
  title: z.string().max(300),
  notes: z.string().max(20_000).default(''),
  location: z.string().max(300).default(''),
  meetingUrl: z.string().max(2000).default(''),
  category: z.string().max(40).default('general'),
  allDay: z.boolean().default(false),
  start: z.string(),
  end: z.string(),
  timeZone: z.string().max(64),
  recurrence: RecurrenceSchema.nullable().default(null),
  checklist: z.array(z.object({ id: z.string().max(64), text: z.string().max(300), done: z.boolean() })).max(100).default([]),
  reminders: z.array(z.number().int().min(0).max(40_320)).max(10).default([]),
});
export type EventInputData = z.input<typeof EventInput>;

export const CATEGORIES = ['general', 'work', 'personal', 'study', 'health', 'social', 'travel'] as const;

function validZone(zone: string): boolean {
  return DateTime.local().setZone(zone).isValid;
}

/** Local calendar. Events live only in this database; nothing is synchronized. */
export class EventsService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly displayZone: () => string,
  ) {}

  private row(id: string): Row {
    const r = this.db.get<Row>('SELECT * FROM events WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That event');
    return r;
  }

  get(id: string): CalendarEvent {
    return toEvent(this.row(id));
  }

  all(): CalendarEvent[] {
    return this.db.all<Row>('SELECT * FROM events').map(toEvent);
  }

  private validate(input: unknown): z.output<typeof EventInput> {
    const parsed = EventInput.safeParse(input);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new UserError(`Invalid event: ${i?.path.join('.') || 'event'} — ${i?.message}`);
    }
    const d = parsed.data;
    const title = cleanLine(d.title, 300);
    if (!title) throw new UserError('Give the event a title.');
    if (!d.allDay && !validZone(d.timeZone)) throw new UserError(`Unknown time zone: ${d.timeZone}`);
    if (d.meetingUrl && !safeHttpUrl(d.meetingUrl)) throw new UserError('Meeting links must start with http:// or https://');
    if (d.allDay) {
      if (!date.safeParse(d.start).success || !date.safeParse(d.end).success) throw new UserError('All-day events need dates (YYYY-MM-DD).');
      if (parseDate(d.end) < parseDate(d.start)) throw new UserError('The end date is before the start date.');
    } else {
      if (!wall.safeParse(d.start).success || !wall.safeParse(d.end).success) throw new UserError('Events need a start and end time.');
      const s = parseWall(d.start, d.timeZone);
      const e = parseWall(d.end, d.timeZone);
      if (e < s) throw new UserError('The event ends before it starts.');
      if (e.diff(s, 'days').days > 31) throw new UserError('Timed events can last at most 31 days. Use an all-day event for longer spans.');
    }
    if (d.recurrence?.until) {
      const startDate = d.allDay ? d.start : d.start.slice(0, 10);
      if (d.recurrence.until < startDate) throw new UserError('The repeat end date is before the first occurrence.');
    }
    if (d.recurrence?.bySetPos && d.recurrence.byWeekday?.length !== 1) {
      throw new UserError('“Nth weekday of the month” needs exactly one weekday.');
    }
    return { ...d, title, reminders: [...new Set(d.reminders)].sort((a, b) => a - b) };
  }

  create(input: unknown): CalendarEvent {
    const d = this.validate(input);
    const id = newId();
    const now = this.clock.now().toISOString();
    this.db.run(
      `INSERT INTO events (id, title, notes, location, meeting_url, category, all_day, start, end, time_zone, recurrence, overrides, checklist, reminders, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, 'local', ?, ?)`,
      [
        id,
        d.title,
        d.notes,
        d.location,
        d.meetingUrl,
        d.category,
        d.allDay,
        d.start,
        d.end,
        d.timeZone,
        d.recurrence ? JSON.stringify(d.recurrence) : null,
        JSON.stringify(d.checklist),
        JSON.stringify(d.reminders),
        now,
        now,
      ],
    );
    return this.get(id);
  }

  /** Updates the whole series (or the single event). Overrides are kept when the timing is unchanged. */
  update(id: string, patch: unknown): CalendarEvent {
    const cur = this.get(id);
    const merged = { ...cur, ...(patch as object) };
    const d = this.validate(merged);
    // Callers that restructure a series (splits) pass the exceptions to keep explicitly.
    const keptOverrides = (patch as { overrides?: EventOverride[] } | null)?.overrides;
    const timingChanged = d.start !== cur.start || d.timeZone !== cur.timeZone || JSON.stringify(d.recurrence) !== JSON.stringify(cur.recurrence) || d.allDay !== cur.allDay;
    this.db.run(
      `UPDATE events SET title = ?, notes = ?, location = ?, meeting_url = ?, category = ?, all_day = ?, start = ?, end = ?, time_zone = ?,
       recurrence = ?, overrides = ?, checklist = ?, reminders = ?, updated_at = ? WHERE id = ?`,
      [
        d.title,
        d.notes,
        d.location,
        d.meetingUrl,
        d.category,
        d.allDay,
        d.start,
        d.end,
        d.timeZone,
        d.recurrence ? JSON.stringify(d.recurrence) : null,
        JSON.stringify(keptOverrides ?? (timingChanged ? [] : cur.overrides)),
        JSON.stringify(d.checklist),
        JSON.stringify(d.reminders),
        this.clock.now().toISOString(),
        id,
      ],
    );
    return this.get(id);
  }

  delete(id: string): void {
    this.row(id);
    this.db.tx(() => {
      this.db.run("DELETE FROM links WHERE (from_type = 'event' AND from_id = ?) OR (to_type = 'event' AND to_id = ?)", [id, id]);
      this.db.run('DELETE FROM events WHERE id = ?', [id]);
    });
  }

  private saveOverrides(id: string, overrides: EventOverride[]): void {
    this.db.run('UPDATE events SET overrides = ?, updated_at = ? WHERE id = ?', [JSON.stringify(overrides), this.clock.now().toISOString(), id]);
  }

  /**
   * Edits one occurrence of a recurring event.
   * - this: only this occurrence (stored as an exception)
   * - following: this and later occurrences (the series is split)
   * - all: the whole series
   */
  updateOccurrence(
    id: string,
    key: string,
    patch: { title?: string; start?: string; end?: string; location?: string; notes?: string },
    scope: 'this' | 'following' | 'all',
  ): CalendarEvent {
    const ev = this.get(id);
    if (!ev.recurrence || scope === 'all') {
      if (!ev.recurrence) return this.update(id, patch);
      // Shift the series by the same amount the occurrence moved.
      const p = { ...patch } as Record<string, unknown>;
      if (patch.start && !ev.allDay) {
        const delta = parseWall(patch.start, ev.timeZone).diff(parseWall(key, ev.timeZone));
        const dur = parseWall(patch.end ?? ev.end, ev.timeZone).diff(parseWall(patch.start, ev.timeZone));
        const ns = parseWall(ev.start, ev.timeZone).plus(delta);
        p.start = ns.toFormat(WALL);
        p.end = ns.plus(patch.end ? dur : parseWall(ev.end, ev.timeZone).diff(parseWall(ev.start, ev.timeZone))).toFormat(WALL);
      } else if (patch.start && ev.allDay) {
        const delta = parseDate(patch.start).diff(parseDate(key), 'days').days;
        p.start = parseDate(ev.start).plus({ days: delta }).toFormat(DATE);
        p.end = parseDate(ev.end).plus({ days: delta }).toFormat(DATE);
      }
      return this.update(id, p);
    }
    if (!isOccurrence(ev, key, this.displayZone())) throw new UserError('That occurrence is not part of this series.');
    if (scope === 'this') {
      const others = ev.overrides.filter((o) => o.originalStart !== key);
      const existing = ev.overrides.find((o) => o.originalStart === key);
      const o: EventOverride = { ...existing, originalStart: key, cancelled: false };
      if (patch.title !== undefined) o.title = cleanLine(patch.title, 300);
      if (patch.location !== undefined) o.location = patch.location.slice(0, 300);
      if (patch.notes !== undefined) o.notes = patch.notes.slice(0, 20_000);
      if (patch.start !== undefined) {
        const ok = ev.allDay ? date.safeParse(patch.start).success : wall.safeParse(patch.start).success;
        if (!ok) throw new UserError('Invalid start.');
        o.start = patch.start;
      }
      if (patch.end !== undefined) {
        const ok = ev.allDay ? date.safeParse(patch.end).success : wall.safeParse(patch.end).success;
        if (!ok) throw new UserError('Invalid end.');
        o.end = patch.end;
      }
      this.saveOverrides(id, [...others, o]);
      return this.get(id);
    }
    // following: end the original series the day before and start a new one here.
    const startLocal = ev.allDay ? parseDate(key) : parseWall(key, ev.timeZone);
    const dayBefore = startLocal.minus({ days: 1 }).toFormat(DATE);
    const rule = ev.recurrence;
    const remainingCount = rule.count ? Math.max(1, rule.count - this.countBefore(ev, key)) : undefined;
    const durMs = ev.allDay ? 0 : parseWall(ev.end, ev.timeZone).diff(parseWall(ev.start, ev.timeZone)).toMillis();
    const newStart = patch.start ?? key;
    const newEnd = patch.end ?? (ev.allDay ? parseDate(newStart).plus(parseDate(ev.end).diff(parseDate(ev.start))).toFormat(DATE) : parseWall(newStart, ev.timeZone).plus({ milliseconds: durMs }).toFormat(WALL));
    return this.db.tx(() => {
      const { count: _c, ...ruleWithoutCount } = rule;
      this.update(id, { recurrence: { ...ruleWithoutCount, until: dayBefore }, overrides: ev.overrides.filter((o) => o.originalStart < key) });
      return this.create({
        ...ev,
        title: patch.title ?? ev.title,
        location: patch.location ?? ev.location,
        notes: patch.notes ?? ev.notes,
        start: newStart,
        end: newEnd,
        recurrence: { ...rule, count: remainingCount, until: rule.until },
      });
    });
  }

  private countBefore(ev: CalendarEvent, key: string): number {
    const zone = ev.allDay ? this.displayZone() : ev.timeZone;
    const at = ev.allDay ? parseDate(key, zone) : parseWall(key, zone);
    const first = ev.allDay ? parseDate(ev.start, zone) : parseWall(ev.start, zone);
    return expandEvent({ ...ev, overrides: [] }, first.minus({ days: 1 }).toJSDate(), at.toJSDate(), { displayZone: this.displayZone() }).filter((o) => o.occurrenceKey < key).length;
  }

  /** Deletes one occurrence, this and following ones, or the whole series. */
  deleteOccurrence(id: string, key: string, scope: 'this' | 'following' | 'all'): void {
    const ev = this.get(id);
    if (!ev.recurrence || scope === 'all') return this.delete(id);
    if (!isOccurrence(ev, key, this.displayZone())) throw new UserError('That occurrence is not part of this series.');
    if (scope === 'this') {
      const others = ev.overrides.filter((o) => o.originalStart !== key);
      this.saveOverrides(id, [...others, { originalStart: key, cancelled: true }]);
      return;
    }
    const first = ev.allDay ? ev.start : ev.start;
    if (key === first) return this.delete(id);
    const startLocal = ev.allDay ? parseDate(key) : parseWall(key, ev.timeZone);
    const { count: _c, ...rule } = ev.recurrence;
    const kept = this.countBefore(ev, key);
    this.update(id, {
      recurrence: ev.recurrence.count ? { ...rule, count: Math.max(1, kept) } : { ...rule, until: startLocal.minus({ days: 1 }).toFormat(DATE) },
      overrides: ev.overrides.filter((o) => o.originalStart < key),
    });
  }

  /** Clears an exception so the occurrence follows the series again. */
  restoreOccurrence(id: string, key: string): CalendarEvent {
    const ev = this.get(id);
    this.saveOverrides(
      id,
      ev.overrides.filter((o) => o.originalStart !== key),
    );
    return this.get(id);
  }

  setChecklist(id: string, checklist: ChecklistItem[]): CalendarEvent {
    return this.update(id, { checklist });
  }

  /** Occurrences of every event overlapping [from, to), sorted by start. */
  occurrences(fromIso: string, toIso: string): EventOccurrence[] {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new UserError('Invalid date range.');
    if (to.getTime() - from.getTime() > 400 * 86_400_000) throw new UserError('Date range is too long.');
    const zone = this.displayZone();
    // Only events that could overlap: non-recurring within range, or any recurring event.
    const rows = this.db.all<Row>(
      `SELECT * FROM events WHERE recurrence IS NOT NULL OR overrides != '[]' OR (start <= ? AND end >= ?)`,
      [DateTime.fromJSDate(to).setZone(zone).plus({ days: 2 }).toFormat(WALL), DateTime.fromJSDate(from).setZone(zone).minus({ days: 2 }).toFormat(DATE)],
    );
    const out: EventOccurrence[] = [];
    for (const r of rows) {
      try {
        out.push(...expandEvent(toEvent(r), from, to, { displayZone: zone }));
      } catch (err) {
        console.error(`event ${r.id} could not be expanded`, err);
      }
    }
    return out.sort((a, b) => (a.startUtc < b.startUtc ? -1 : a.startUtc > b.startUtc ? 1 : a.title.localeCompare(b.title)));
  }

  search(q: string): CalendarEvent[] {
    const like = `%${q.replace(/[%_]/g, '')}%`;
    return this.db.all<Row>('SELECT * FROM events WHERE title LIKE ? OR notes LIKE ? OR location LIKE ? ORDER BY start DESC LIMIT 100', [like, like, like]).map(toEvent);
  }

  exportAll(): CalendarEvent[] {
    return this.all();
  }
}
