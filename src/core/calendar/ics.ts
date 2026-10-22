import { DateTime } from 'luxon';
import type { CalendarEvent } from '../../shared/types';
import { parseDate, parseWall } from './recurrence';

/** RFC 5545 text escaping and line folding. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, 'utf8') > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

const DAY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function dt(ev: CalendarEvent, value: string): string {
  if (ev.allDay) return `;VALUE=DATE:${parseDate(value).toFormat('yyyyLLdd')}`;
  return `;TZID=${ev.timeZone}:${parseWall(value, ev.timeZone).toFormat("yyyyLLdd'T'HHmmss")}`;
}

function rrule(ev: CalendarEvent): string | null {
  const r = ev.recurrence;
  if (!r) return null;
  const parts = [`FREQ=${r.freq.toUpperCase()}`];
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`);
  if (r.byWeekday?.length) parts.push(`BYDAY=${r.byWeekday.map((d) => (r.bySetPos ? `${r.bySetPos}${DAY[d]}` : DAY[d])).join(',')}`);
  if (r.count) parts.push(`COUNT=${r.count}`);
  if (r.until) parts.push(`UNTIL=${r.until.replace(/-/g, '')}${ev.allDay ? '' : 'T235959Z'}`);
  return `RRULE:${parts.join(';')}`;
}

/** Exports local events to iCalendar so they can be opened in other calendar apps. */
export function toIcs(events: CalendarEvent[], now: Date): string {
  const stamp = DateTime.fromJSDate(now).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FlowCompanion//Local Calendar//EN', 'CALSCALE:GREGORIAN'];
  for (const ev of events) {
    const endValue = ev.allDay ? parseDate(ev.end).plus({ days: 1 }).toFormat('yyyy-LL-dd') : ev.end;
    const common = (summary: string, location: string, notes: string) => [
      `SUMMARY:${esc(summary)}`,
      ...(location ? [`LOCATION:${esc(location)}`] : []),
      ...(notes || ev.meetingUrl ? [`DESCRIPTION:${esc([notes, ev.meetingUrl].filter(Boolean).join('\n'))}`] : []),
      ...(ev.meetingUrl ? [`URL:${ev.meetingUrl}`] : []),
      `CATEGORIES:${esc(ev.category)}`,
    ];
    lines.push('BEGIN:VEVENT', `UID:${ev.id}@flowcompanion.local`, `DTSTAMP:${stamp}`, `DTSTART${dt(ev, ev.start)}`, `DTEND${dt(ev, endValue)}`, ...common(ev.title, ev.location, ev.notes));
    const rule = rrule(ev);
    if (rule) lines.push(rule);
    for (const o of ev.overrides.filter((x) => x.cancelled)) lines.push(`EXDATE${dt(ev, o.originalStart)}`);
    for (const offset of ev.reminders) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(ev.title)}`, `TRIGGER:-PT${offset}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
    for (const o of ev.overrides.filter((x) => !x.cancelled)) {
      const durMs = ev.allDay ? 0 : parseWall(ev.end, ev.timeZone).diff(parseWall(ev.start, ev.timeZone)).toMillis();
      const s = o.start ?? o.originalStart;
      const e = o.end ?? (ev.allDay ? s : parseWall(s, ev.timeZone).plus({ milliseconds: durMs }).toFormat("yyyy-LL-dd'T'HH:mm"));
      lines.push(
        'BEGIN:VEVENT',
        `UID:${ev.id}@flowcompanion.local`,
        `DTSTAMP:${stamp}`,
        `RECURRENCE-ID${dt(ev, o.originalStart)}`,
        `DTSTART${dt(ev, s)}`,
        `DTEND${dt(ev, ev.allDay ? parseDate(e).plus({ days: 1 }).toFormat('yyyy-LL-dd') : e)}`,
        ...common(o.title ?? ev.title, o.location ?? ev.location, o.notes ?? ev.notes),
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
