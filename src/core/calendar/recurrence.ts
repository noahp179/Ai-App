import { DateTime } from 'luxon';
import type { CalendarEvent, EventOccurrence, EventOverride, RecurrenceRule, Weekday } from '../../shared/types';

/** Wall-time formats used for event storage. */
export const WALL = "yyyy-MM-dd'T'HH:mm";
export const DATE = 'yyyy-MM-dd';

const MAX_OCCURRENCES = 5000;

export function parseWall(value: string, zone: string): DateTime {
  const dt = DateTime.fromFormat(value, WALL, { zone });
  if (!dt.isValid) throw new Error(`Invalid date/time: ${value}`);
  return dt;
}

export function parseDate(value: string, zone = 'UTC'): DateTime {
  const dt = DateTime.fromFormat(value, DATE, { zone });
  if (!dt.isValid) throw new Error(`Invalid date: ${value}`);
  return dt;
}

/**
 * Candidate occurrence starts (as wall times in the event zone, or dates for
 * all-day), in order. `from` lets series without a count skip straight to the
 * window of interest instead of walking from the first occurrence.
 */
function* candidates(start: DateTime, rule: RecurrenceRule, from: DateTime | null = null): Generator<DateTime> {
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const tod = { hour: start.hour, minute: start.minute };
  const skip = (unit: 'days' | 'weeks' | 'months' | 'years') => {
    if (!from || from <= start) return 0;
    const n = Math.floor(from.diff(start, unit).as(unit) / interval) - 1;
    return Math.max(0, n) * interval;
  };
  if (rule.freq === 'daily') {
    for (let i = skip('days'); ; i += interval) yield start.plus({ days: i });
  }
  if (rule.freq === 'weekly') {
    const days = (rule.byWeekday?.length ? [...new Set(rule.byWeekday)] : [start.weekday as Weekday]).sort((a, b) => a - b);
    const weekStart = start.startOf('week'); // ISO week, Monday
    for (let w = skip('weeks'); ; w += interval) {
      for (const d of days) {
        const day = weekStart.plus({ weeks: w, days: d - 1 }).set(tod);
        if (day < start) continue;
        yield day;
      }
    }
  }
  if (rule.freq === 'monthly') {
    const nth = rule.bySetPos;
    const wd = rule.byWeekday?.[0];
    for (let m = skip('months'); ; m += interval) {
      const month = start.startOf('month').plus({ months: m });
      if (nth && wd) {
        let day: DateTime | null = null;
        if (nth > 0) {
          let first = month;
          while (first.weekday !== wd) first = first.plus({ days: 1 });
          day = first.plus({ weeks: nth - 1 });
          if (day.month !== month.month) day = null;
        } else {
          let last = month.endOf('month').startOf('day');
          while (last.weekday !== wd) last = last.minus({ days: 1 });
          day = last;
        }
        if (day) {
          const occ = day.set(tod);
          if (occ >= start) yield occ;
        }
      } else {
        // Months without this day (e.g. the 31st) are skipped, as in RFC 5545.
        if (start.day <= (month.daysInMonth ?? 0)) {
          const occ = month.set({ day: start.day, ...tod });
          if (occ >= start) yield occ;
        }
      }
    }
  }
  if (rule.freq === 'yearly') {
    for (let y = skip('years'); ; y += interval) {
      const year = start.year + y;
      const probe = DateTime.fromObject({ year, month: start.month, day: 1 }, { zone: start.zone });
      if (start.day <= (probe.daysInMonth ?? 0)) yield probe.set({ day: start.day, ...tod });
    }
  }
}

export interface ExpandOptions {
  /** Zone used to place all-day events (floating dates) on the timeline. */
  displayZone: string;
}

interface RawOccurrence {
  key: string;
  start: DateTime;
  end: DateTime;
  override: EventOverride | undefined;
}

function occurrenceKey(ev: CalendarEvent, start: DateTime): string {
  return ev.allDay ? start.toFormat(DATE) : start.toFormat(WALL);
}

/**
 * Lists the occurrences of one event that overlap [rangeStart, rangeEnd).
 * Times are computed in the event's own zone so a 09:00 meeting stays at
 * 09:00 local time across daylight-saving changes.
 */
export function expandEvent(ev: CalendarEvent, rangeStart: Date, rangeEnd: Date, opts: ExpandOptions): EventOccurrence[] {
  const zone = ev.allDay ? opts.displayZone : ev.timeZone;
  const start = ev.allDay ? parseDate(ev.start, zone) : parseWall(ev.start, zone);
  const endRaw = ev.allDay ? parseDate(ev.end, zone).plus({ days: 1 }) : parseWall(ev.end, zone);
  const durationMs = Math.max(0, endRaw.toMillis() - start.toMillis());
  const allDayDays = ev.allDay ? Math.max(1, Math.round(endRaw.diff(start, 'days').days)) : 0;
  const overrides = new Map(ev.overrides.map((o) => [o.originalStart, o]));
  const rs = rangeStart.getTime();
  const re = rangeEnd.getTime();
  const out: RawOccurrence[] = [];

  const endOf = (s: DateTime) => (ev.allDay ? s.plus({ days: allDayDays }) : s.plus({ milliseconds: durationMs }));

  const push = (s: DateTime) => {
    const key = occurrenceKey(ev, s);
    out.push({ key, start: s, end: endOf(s), override: overrides.get(key) });
  };

  if (!ev.recurrence) {
    push(start);
  } else {
    const rule = ev.recurrence;
    const until = rule.until ? parseDate(rule.until, zone).endOf('day') : null;
    // Pad the window so occurrences moved by an override can still be found.
    const padMs = 31 * 86_400_000;
    const from = rule.count ? null : DateTime.fromMillis(rs - padMs - durationMs, { zone });
    let produced = 0;
    for (const s of candidates(start, rule, from)) {
      if (rule.count && produced >= rule.count) break;
      if (until && s > until) break;
      if (s.toMillis() > re + padMs) break;
      produced++;
      if (endOf(s).toMillis() >= rs - padMs) push(s);
      if (produced > MAX_OCCURRENCES * 40) break; // hard safety stop
    }
  }

  const result: EventOccurrence[] = [];
  for (const o of out) {
    if (o.override?.cancelled) continue;
    let s = o.start;
    let e = o.end;
    if (o.override?.start) s = ev.allDay ? parseDate(o.override.start, zone) : parseWall(o.override.start, zone);
    if (o.override?.end) e = ev.allDay ? parseDate(o.override.end, zone).plus({ days: 1 }) : parseWall(o.override.end, zone);
    else if (o.override?.start) e = endOf(s);
    // Zero-length events still occupy their instant.
    const overlaps = s.toMillis() < re && (e.toMillis() > rs || (e.toMillis() === s.toMillis() && s.toMillis() >= rs));
    if (!overlaps) continue;
    result.push({
      eventId: ev.id,
      occurrenceKey: o.key,
      title: o.override?.title ?? ev.title,
      location: o.override?.location ?? ev.location,
      category: ev.category,
      allDay: ev.allDay,
      startUtc: s.toUTC().toISO()!,
      endUtc: e.toUTC().toISO()!,
      startDate: ev.allDay ? s.toFormat(DATE) : undefined,
      endDate: ev.allDay ? e.minus({ days: 1 }).toFormat(DATE) : undefined,
      recurring: !!ev.recurrence,
      modified: !!o.override && !o.override.cancelled,
    });
  }
  return result;
}

/** True when `key` is a genuine occurrence of the series (ignoring cancellations). */
export function isOccurrence(ev: CalendarEvent, key: string, displayZone: string): boolean {
  const zone = ev.allDay ? displayZone : ev.timeZone;
  const at = ev.allDay ? parseDate(key, zone) : parseWall(key, zone);
  const probe: CalendarEvent = { ...ev, overrides: [] };
  return expandEvent(probe, at.minus({ days: 1 }).toJSDate(), at.plus({ days: 2 }).toJSDate(), { displayZone }).some((o) => o.occurrenceKey === key);
}

export function describeRule(rule: RecurrenceRule | null, startLocal: DateTime): string {
  if (!rule) return 'Does not repeat';
  const every = (unit: string) => (rule.interval > 1 ? `Every ${rule.interval} ${unit}s` : `Every ${unit}`);
  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let s: string;
  if (rule.freq === 'daily') s = rule.interval > 1 ? every('day') : 'Daily';
  else if (rule.freq === 'weekly') {
    const days = (rule.byWeekday?.length ? rule.byWeekday : [startLocal.weekday as Weekday]).map((d) => dayNames[d]).join(', ');
    s = `${rule.interval > 1 ? every('week') : 'Weekly'} on ${days}`;
  } else if (rule.freq === 'monthly') {
    if (rule.bySetPos && rule.byWeekday?.[0]) {
      const ord = rule.bySetPos === -1 ? 'last' : ['', 'first', 'second', 'third', 'fourth'][rule.bySetPos];
      s = `${rule.interval > 1 ? every('month') : 'Monthly'} on the ${ord} ${startLocal.set({ weekday: rule.byWeekday[0] }).toFormat('cccc')}`;
    } else s = `${rule.interval > 1 ? every('month') : 'Monthly'} on day ${startLocal.day}`;
  } else s = `${rule.interval > 1 ? every('year') : 'Yearly'} on ${startLocal.toFormat('LLLL d')}`;
  if (rule.count) s += `, ${rule.count} times`;
  if (rule.until) s += `, until ${rule.until}`;
  return s;
}
