import { z } from 'zod';
import type { ReminderRecord } from '../../shared/types';
import type { Db } from '../db/database';
import type { NotificationCenter } from '../notifications';
import type { TasksService } from '../tasks';
import { type Clock, NotFoundError, UserError, cleanLine, newId } from '../util';
import type { EventsService } from './events';

interface Row {
  id: string;
  title: string;
  body: string;
  fire_at: string;
  ref_type: ReminderRecord['refType'];
  ref_id: string | null;
  snoozed_until: string | null;
  completed_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

const toReminder = (r: Row): ReminderRecord => ({
  id: r.id,
  title: r.title,
  body: r.body,
  fireAt: r.fire_at,
  refType: r.ref_type,
  refId: r.ref_id,
  snoozedUntil: r.snoozed_until,
  completedAt: r.completed_at,
  dismissedAt: r.dismissed_at,
  createdAt: r.created_at,
});

const ReminderInput = z.object({
  title: z.string().max(200),
  body: z.string().max(2000).default(''),
  fireAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid time'),
  refType: z.enum(['task', 'resource', 'note', 'event']).nullable().default(null),
  refId: z.string().max(64).nullable().default(null),
});

/** One concrete thing to announce. The dedupe key makes delivery idempotent across restarts. */
export interface DueReminder {
  dedupeKey: string;
  fireAt: Date;
  title: string;
  body: string;
  route: string;
  snoozable: boolean;
  sourceRef: string;
}

const LOOKAHEAD_MS = 48 * 3_600_000;

function offsetLabel(min: number): string {
  if (min === 0) return 'Starting now';
  if (min < 60) return `In ${min} minutes`;
  if (min % 1440 === 0) return `In ${min / 1440} day${min === 1440 ? '' : 's'}`;
  if (min % 60 === 0) return `In ${min / 60} hour${min === 60 ? '' : 's'}`;
  return `In ${Math.floor(min / 60)} h ${min % 60} min`;
}

/**
 * Computes and delivers reminders for custom reminders, event reminders and
 * task due times. Delivery goes through NotificationCenter, whose dedupe log
 * guarantees each reminder fires once even if the app restarts or the
 * scheduler wakes twice.
 */
export class RemindersService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly events: EventsService,
    private readonly tasks: TasksService,
    private readonly notifications: NotificationCenter,
    private readonly graceMinutes: () => number,
  ) {}

  // ─────────── Custom reminders ───────────

  list(opts: { includeDone?: boolean } = {}): ReminderRecord[] {
    const where = opts.includeDone ? '' : 'WHERE completed_at IS NULL AND dismissed_at IS NULL';
    return this.db.all<Row>(`SELECT * FROM reminders ${where} ORDER BY COALESCE(snoozed_until, fire_at) LIMIT 500`).map(toReminder);
  }

  get(id: string): ReminderRecord {
    const r = this.db.get<Row>('SELECT * FROM reminders WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That reminder');
    return toReminder(r);
  }

  create(input: unknown): ReminderRecord {
    const d = ReminderInput.parse(input);
    const title = cleanLine(d.title, 200);
    if (!title) throw new UserError('Give the reminder a title.');
    const id = newId();
    this.db.run(
      `INSERT INTO reminders (id, title, body, fire_at, ref_type, ref_id, snoozed_until, completed_at, dismissed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
      [id, title, d.body, new Date(d.fireAt).toISOString(), d.refType, d.refId, this.clock.now().toISOString()],
    );
    return this.get(id);
  }

  update(id: string, patch: { title?: string; body?: string; fireAt?: string }): ReminderRecord {
    const cur = this.get(id);
    const fireAt = patch.fireAt ? new Date(patch.fireAt) : null;
    if (fireAt && Number.isNaN(fireAt.getTime())) throw new UserError('Invalid time.');
    this.db.run('UPDATE reminders SET title = ?, body = ?, fire_at = ?, snoozed_until = ? WHERE id = ?', [
      patch.title !== undefined ? cleanLine(patch.title, 200) || cur.title : cur.title,
      patch.body ?? cur.body,
      fireAt ? fireAt.toISOString() : cur.fireAt,
      fireAt ? null : cur.snoozedUntil,
      id,
    ]);
    return this.get(id);
  }

  complete(id: string): void {
    this.get(id);
    this.db.run('UPDATE reminders SET completed_at = ? WHERE id = ?', [this.clock.now().toISOString(), id]);
  }

  dismiss(id: string): void {
    this.get(id);
    this.db.run('UPDATE reminders SET dismissed_at = ? WHERE id = ?', [this.clock.now().toISOString(), id]);
  }

  delete(id: string): void {
    this.db.run('DELETE FROM reminders WHERE id = ?', [id]);
  }

  /** Snoozes a custom reminder. Returns the new time. */
  snooze(id: string, minutes: number): ReminderRecord {
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 7 * 1440) throw new UserError('Snooze between 1 minute and 7 days.');
    this.get(id);
    this.db.run('UPDATE reminders SET snoozed_until = ? WHERE id = ?', [new Date(this.clock.now().getTime() + minutes * 60_000).toISOString(), id]);
    return this.get(id);
  }

  /**
   * Snoozes a delivered notification. Custom reminders are rescheduled; event
   * and task alerts become a one-off custom reminder.
   */
  snoozeNotification(sourceRef: string, title: string, body: string, minutes: number): ReminderRecord {
    const [kind, id] = sourceRef.split(':');
    if (kind === 'reminder' && id) return this.snooze(id, minutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 7 * 1440) throw new UserError('Snooze between 1 minute and 7 days.');
    return this.create({
      title,
      body,
      fireAt: new Date(this.clock.now().getTime() + minutes * 60_000).toISOString(),
      refType: kind === 'event' ? 'event' : kind === 'task' ? 'task' : null,
      refId: id ?? null,
    });
  }

  // ─────────── Computing what is due ───────────

  /** Every reminder instance whose time falls in [from, to). */
  instances(from: Date, to: Date): DueReminder[] {
    const out: DueReminder[] = [];
    const f = from.toISOString();
    const t = to.toISOString();

    for (const r of this.db.all<Row>(
      `SELECT * FROM reminders WHERE completed_at IS NULL AND dismissed_at IS NULL AND COALESCE(snoozed_until, fire_at) >= ? AND COALESCE(snoozed_until, fire_at) < ?`,
      [f, t],
    )) {
      const at = r.snoozed_until ?? r.fire_at;
      out.push({
        dedupeKey: `reminder:${r.id}@${at}`,
        fireAt: new Date(at),
        title: r.title,
        body: r.body,
        route: r.ref_type === 'event' && r.ref_id ? `/calendar?event=${r.ref_id}` : r.ref_type === 'task' && r.ref_id ? `/productivity/tasks?task=${r.ref_id}` : '/calendar/reminders',
        snoozable: true,
        sourceRef: `reminder:${r.id}`,
      });
    }

    // Event reminders: expand occurrences that could have a reminder in range (offsets up to 4 weeks).
    const maxOffset = 40_320 * 60_000;
    for (const occ of this.events.occurrences(f, new Date(to.getTime() + maxOffset).toISOString())) {
      const ev = this.events.get(occ.eventId);
      for (const offset of ev.reminders) {
        const at = new Date(new Date(occ.startUtc).getTime() - offset * 60_000);
        if (at < from || at >= to) continue;
        out.push({
          dedupeKey: `event:${occ.eventId}@${occ.occurrenceKey}#${offset}`,
          fireAt: at,
          title: occ.title,
          body: `${occ.allDay ? (offset === 0 ? 'Today' : offsetLabel(offset)) : offsetLabel(offset)}${occ.location ? ` · ${occ.location}` : ''}`,
          route: `/calendar?event=${occ.eventId}`,
          snoozable: true,
          sourceRef: `event:${occ.eventId}`,
        });
      }
    }

    for (const task of this.tasks.dueBetween(f, t)) {
      out.push({
        dedupeKey: `task:${task.id}@${task.dueAt}`,
        fireAt: new Date(task.dueAt!),
        title: `Task due: ${task.title}`,
        body: task.notes.slice(0, 200),
        route: `/productivity/tasks?task=${task.id}`,
        snoozable: true,
        sourceRef: `task:${task.id}`,
      });
    }
    return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  }

  /** When the scheduler should next wake for reminders. */
  nextAt(): Date | null {
    const now = this.clock.now();
    const upcoming = this.instances(new Date(now.getTime() + 1), new Date(now.getTime() + LOOKAHEAD_MS));
    const next = upcoming.find((r) => !this.notifications.alreadyDelivered(r.dedupeKey));
    if (next) return next.fireAt;
    // Something may already be due and undelivered (e.g. right after startup).
    const pending = this.instances(new Date(now.getTime() - this.graceMinutes() * 60_000), new Date(now.getTime() + 1));
    return pending.some((r) => !this.notifications.alreadyDelivered(r.dedupeKey)) ? now : null;
  }

  /**
   * Delivers everything due now that has not been delivered. Reminders that
   * came due while the app was closed are delivered as "missed" if they fall
   * within the grace period; older ones are left for the reminders list.
   */
  deliverDue(): number {
    const now = this.clock.now();
    const graceMs = this.graceMinutes() * 60_000;
    let n = 0;
    for (const r of this.instances(new Date(now.getTime() - graceMs), new Date(now.getTime() + 1))) {
      const late = now.getTime() - r.fireAt.getTime() > 2 * 60_000;
      const delivered = this.notifications.notify({
        dedupeKey: r.dedupeKey,
        kind: r.sourceRef.startsWith('event') ? 'event' : 'reminder',
        title: late ? `Missed: ${r.title}` : r.title,
        body: late ? `Due ${r.fireAt.toLocaleString()} while FlowCompanion was not running. ${r.body}`.trim() : r.body,
        action: { route: r.route },
        snoozable: r.snoozable,
        sourceRef: r.sourceRef,
        missed: late,
      });
      if (delivered) n++;
    }
    return n;
  }

  /** Custom reminders that are past due and still open (shown in the UI). */
  overdue(): ReminderRecord[] {
    const now = this.clock.now().toISOString();
    return this.db
      .all<Row>('SELECT * FROM reminders WHERE completed_at IS NULL AND dismissed_at IS NULL AND COALESCE(snoozed_until, fire_at) < ? ORDER BY fire_at', [now])
      .map(toReminder);
  }
}
