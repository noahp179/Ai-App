import { DateTime } from 'luxon';
import type { Settings } from '../shared/settings';
import type { FocusSession, FocusStats } from '../shared/types';
import type { Db } from './db/database';
import { bool } from './db/database';
import { type Clock, UserError, cleanLine, newId } from './util';

interface Row {
  id: string;
  kind: FocusSession['kind'];
  planned_minutes: number;
  started_at: string;
  ends_at: string;
  paused_at: string | null;
  remaining_ms: number | null;
  ended_at: string | null;
  completed: number;
  label: string;
}
const toSession = (r: Row): FocusSession => ({
  id: r.id,
  kind: r.kind,
  plannedMinutes: r.planned_minutes,
  startedAt: r.started_at,
  endsAt: r.ends_at,
  pausedAt: r.paused_at,
  remainingMs: r.remaining_ms,
  endedAt: r.ended_at,
  completed: bool(r.completed),
  label: r.label,
});

/** Pomodoro-style focus timer. State is persisted so a session survives a restart. */
export class FocusService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly settings: () => Settings,
    private readonly zone: () => string,
  ) {}

  current(): FocusSession | null {
    const r = this.db.get<Row>('SELECT * FROM focus_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1');
    return r ? toSession(r) : null;
  }

  /** What should come next: a long break every N focus sessions, a short one otherwise. */
  nextKind(): FocusSession['kind'] {
    const last = this.db.get<Row>('SELECT * FROM focus_sessions WHERE ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1');
    if (!last || last.kind !== 'focus' || !bool(last.completed)) return 'focus';
    const every = this.settings().productivity.longBreakEvery;
    const since = this.db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM focus_sessions WHERE kind = 'focus' AND completed = 1
       AND ended_at > COALESCE((SELECT MAX(ended_at) FROM focus_sessions WHERE kind = 'long_break'), '')`,
    )?.n ?? 0;
    return since > 0 && since % every === 0 ? 'long_break' : 'short_break';
  }

  start(kind: FocusSession['kind'] = 'focus', minutes?: number, label = ''): FocusSession {
    if (!['focus', 'short_break', 'long_break'].includes(kind)) throw new UserError('Unknown session type.');
    const p = this.settings().productivity;
    const planned = minutes ?? (kind === 'focus' ? p.focusMinutes : kind === 'short_break' ? p.shortBreakMinutes : p.longBreakMinutes);
    if (!Number.isFinite(planned) || planned < 1 || planned > 240) throw new UserError('Sessions can be 1 to 240 minutes long.');
    const now = this.clock.now();
    const id = newId();
    this.db.tx(() => {
      this.db.run('UPDATE focus_sessions SET ended_at = ?, completed = 0 WHERE ended_at IS NULL', [now.toISOString()]);
      this.db.run(
        `INSERT INTO focus_sessions (id, kind, planned_minutes, started_at, ends_at, paused_at, remaining_ms, ended_at, completed, label)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?)`,
        [id, kind, Math.round(planned), now.toISOString(), new Date(now.getTime() + planned * 60_000).toISOString(), cleanLine(label, 120)],
      );
    });
    return this.current()!;
  }

  pause(): FocusSession | null {
    const s = this.current();
    if (!s || s.pausedAt) return s;
    const now = this.clock.now();
    const remaining = Math.max(0, new Date(s.endsAt).getTime() - now.getTime());
    this.db.run('UPDATE focus_sessions SET paused_at = ?, remaining_ms = ? WHERE id = ?', [now.toISOString(), remaining, s.id]);
    return this.current();
  }

  resume(): FocusSession | null {
    const s = this.current();
    if (!s || !s.pausedAt) return s;
    const ends = new Date(this.clock.now().getTime() + (s.remainingMs ?? 0)).toISOString();
    this.db.run('UPDATE focus_sessions SET paused_at = NULL, remaining_ms = NULL, ends_at = ? WHERE id = ?', [ends, s.id]);
    return this.current();
  }

  /** Ends the current session. `completed` marks that the full time was used. */
  stop(completed = false): FocusSession | null {
    const s = this.current();
    if (!s) return null;
    this.db.run('UPDATE focus_sessions SET ended_at = ?, completed = ?, paused_at = NULL WHERE id = ?', [this.clock.now().toISOString(), completed, s.id]);
    const r = this.db.get<Row>('SELECT * FROM focus_sessions WHERE id = ?', [s.id]);
    return r ? toSession(r) : null;
  }

  /** Completes the running session if its time is up. Returns it if it just completed. */
  completeIfDue(): FocusSession | null {
    const s = this.current();
    if (!s || s.pausedAt) return null;
    if (new Date(s.endsAt).getTime() > this.clock.now().getTime()) return null;
    this.db.run('UPDATE focus_sessions SET ended_at = ?, completed = 1 WHERE id = ?', [s.endsAt, s.id]);
    const r = this.db.get<Row>('SELECT * FROM focus_sessions WHERE id = ?', [s.id]);
    return r ? toSession(r) : null;
  }

  stats(): FocusStats {
    const zone = this.zone();
    const now = DateTime.fromJSDate(this.clock.now()).setZone(zone);
    const today = now.startOf('day').toUTC().toISO()!;
    const week = now.minus({ days: 6 }).startOf('day').toUTC().toISO()!;
    const sum = (from: string) =>
      this.db.get<{ m: number | null; n: number }>(
        "SELECT SUM(planned_minutes) AS m, COUNT(*) AS n FROM focus_sessions WHERE kind = 'focus' AND completed = 1 AND started_at >= ?",
        [from],
      ) ?? { m: 0, n: 0 };
    const t = sum(today);
    const w = sum(week);
    const days = new Set(
      this.db
        .all<{ started_at: string }>("SELECT started_at FROM focus_sessions WHERE kind = 'focus' AND completed = 1 AND started_at >= ?", [
          now.minus({ days: 400 }).toUTC().toISO()!,
        ])
        .map((r) => DateTime.fromISO(r.started_at).setZone(zone).toISODate()),
    );
    let streak = 0;
    let d = now;
    if (!days.has(d.toISODate())) d = d.minus({ days: 1 });
    while (days.has(d.toISODate())) {
      streak++;
      d = d.minus({ days: 1 });
    }
    return { todayFocusMinutes: t.m ?? 0, todaySessions: t.n, weekFocusMinutes: w.m ?? 0, streakDays: streak };
  }

  history(limit = 20): FocusSession[] {
    return this.db.all<Row>('SELECT * FROM focus_sessions WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?', [Math.min(limit, 200)]).map(toSession);
  }
}
