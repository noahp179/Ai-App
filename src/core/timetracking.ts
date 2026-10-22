import { DateTime } from 'luxon';
import type { TimeEntry } from '../shared/types';
import type { Db } from './db/database';
import { type Clock, NotFoundError, UserError, cleanLine, newId } from './util';

interface Row {
  id: string;
  label: string;
  task_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}
const toEntry = (r: Row): TimeEntry => ({ id: r.id, label: r.label, taskId: r.task_id, startedAt: r.started_at, endedAt: r.ended_at, createdAt: r.created_at });

export class TimeTrackingService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly zone: () => string,
  ) {}

  running(): TimeEntry | null {
    const r = this.db.get<Row>('SELECT * FROM time_entries WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1');
    return r ? toEntry(r) : null;
  }

  /** Starts a timer. Any running timer is stopped first, so only one runs at a time. */
  start(label: string, taskId: string | null = null): TimeEntry {
    const clean = cleanLine(String(label ?? ''), 200) || 'Untitled';
    if (taskId && !this.db.get('SELECT 1 FROM tasks WHERE id = ?', [taskId])) throw new NotFoundError('That task');
    const now = this.clock.now().toISOString();
    const id = newId();
    this.db.tx(() => {
      this.db.run('UPDATE time_entries SET ended_at = ? WHERE ended_at IS NULL', [now]);
      this.db.run('INSERT INTO time_entries (id, label, task_id, started_at, ended_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)', [id, clean, taskId, now, now]);
    });
    return this.running()!;
  }

  stop(): TimeEntry | null {
    const cur = this.running();
    if (!cur) return null;
    this.db.run('UPDATE time_entries SET ended_at = ? WHERE id = ?', [this.clock.now().toISOString(), cur.id]);
    return this.get(cur.id);
  }

  get(id: string): TimeEntry {
    const r = this.db.get<Row>('SELECT * FROM time_entries WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That time entry');
    return toEntry(r);
  }

  list(days = 7): TimeEntry[] {
    const from = DateTime.fromJSDate(this.clock.now()).setZone(this.zone()).minus({ days: Math.max(0, days - 1) }).startOf('day').toUTC().toISO()!;
    return this.db.all<Row>('SELECT * FROM time_entries WHERE started_at >= ? OR ended_at IS NULL ORDER BY started_at DESC', [from]).map(toEntry);
  }

  update(id: string, patch: { label?: string; startedAt?: string; endedAt?: string | null }): TimeEntry {
    const cur = this.get(id);
    const start = patch.startedAt !== undefined ? new Date(patch.startedAt) : new Date(cur.startedAt);
    const endRaw = patch.endedAt !== undefined ? patch.endedAt : cur.endedAt;
    const end = endRaw ? new Date(endRaw) : null;
    if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) throw new UserError('Invalid time.');
    if (end && end < start) throw new UserError('The end time must be after the start time.');
    this.db.run('UPDATE time_entries SET label = ?, started_at = ?, ended_at = ? WHERE id = ?', [
      patch.label !== undefined ? cleanLine(patch.label, 200) || cur.label : cur.label,
      start.toISOString(),
      end ? end.toISOString() : null,
      id,
    ]);
    return this.get(id);
  }

  delete(id: string): void {
    if (this.db.run('DELETE FROM time_entries WHERE id = ?', [id]).changes === 0) throw new NotFoundError('That time entry');
  }

  /** Totals in minutes per label and per local day over the last `days` days. */
  summary(days = 7): { byLabel: { label: string; minutes: number }[]; byDay: { date: string; minutes: number }[]; totalMinutes: number } {
    const now = this.clock.now().getTime();
    const zone = this.zone();
    const byLabel = new Map<string, number>();
    const byDay = new Map<string, number>();
    let total = 0;
    for (const e of this.list(days)) {
      const s = new Date(e.startedAt).getTime();
      const end = e.endedAt ? new Date(e.endedAt).getTime() : now;
      const min = Math.max(0, (end - s) / 60_000);
      total += min;
      byLabel.set(e.label, (byLabel.get(e.label) ?? 0) + min);
      const day = DateTime.fromMillis(s).setZone(zone).toISODate()!;
      byDay.set(day, (byDay.get(day) ?? 0) + min);
    }
    return {
      byLabel: [...byLabel].map(([label, minutes]) => ({ label, minutes })).sort((a, b) => b.minutes - a.minutes),
      byDay: [...byDay].map(([date, minutes]) => ({ date, minutes })).sort((a, b) => a.date.localeCompare(b.date)),
      totalMinutes: total,
    };
  }
}
