import { DateTime } from 'luxon';
import type { Settings } from '../shared/settings';
import type { InboxNotification } from '../shared/types';
import type { Db } from './db/database';
import { bool, json } from './db/database';
import type { KvStore } from './kv';
import { type Clock, newId } from './util';

/** Shows a system notification. Returns false if the OS could not show it. */
export interface NotifierPort {
  show(n: { title: string; body: string; silent: boolean }, onClick: () => void): boolean;
}

export interface NotifyInput {
  /** Identifies one logical notification. A key is only ever delivered once. */
  dedupeKey: string;
  kind: InboxNotification['kind'];
  title: string;
  body?: string;
  action?: InboxNotification['action'];
  snoozable?: boolean;
  sourceRef?: string | null;
  /** The moment this was due passed while the app was not running. */
  missed?: boolean;
}

interface InboxRow {
  id: string;
  dedupe_key: string;
  kind: InboxNotification['kind'];
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  delivery: InboxNotification['delivery'];
  action: string | null;
  snoozable: number;
  source_ref: string | null;
}

function toNotification(r: InboxRow): InboxNotification {
  return {
    id: r.id,
    dedupeKey: r.dedupe_key,
    kind: r.kind,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    readAt: r.read_at,
    delivery: r.delivery,
    action: json(r.action, null),
    snoozable: bool(r.snoozable),
    sourceRef: r.source_ref,
  };
}

export function resolveZone(setting: string): string {
  if (setting && setting !== 'system' && DateTime.local().setZone(setting).isValid) return setting;
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Whether `at` falls inside quiet hours. Windows may cross midnight (22:00 → 07:00). */
export function inQuietHours(at: Date, quiet: Settings['notifications']['quietHours'], zone: string): boolean {
  if (!quiet.enabled) return false;
  const local = DateTime.fromJSDate(at).setZone(zone);
  const minutes = local.hour * 60 + local.minute;
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const start = toMin(quiet.start);
  const end = toMin(quiet.end);
  if (start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

export class NotificationCenter {
  constructor(
    private readonly db: Db,
    private readonly kv: KvStore,
    private readonly clock: Clock,
    private readonly settings: () => Settings,
    private readonly port: NotifierPort,
    private readonly onDelivered: (n: InboxNotification) => void,
    private readonly onClick: (n: InboxNotification) => void,
  ) {}

  pausedUntil(): string | null {
    const until = this.kv.get<string | null>('notifications:pausedUntil', null);
    if (until && new Date(until) > this.clock.now()) return until;
    return null;
  }

  pause(minutes: number): string {
    const until = new Date(this.clock.now().getTime() + Math.max(1, minutes) * 60_000).toISOString();
    this.kv.set('notifications:pausedUntil', until);
    return until;
  }

  resume(): void {
    this.kv.delete('notifications:pausedUntil');
  }

  alreadyDelivered(dedupeKey: string): boolean {
    return this.db.get('SELECT 1 FROM notification_log WHERE dedupe_key = ?', [dedupeKey]) !== undefined;
  }

  /**
   * Delivers a notification once. Returns null when this key was already
   * delivered, so callers can fire repeatedly (e.g. after a restart) without
   * producing duplicates.
   */
  notify(input: NotifyInput): InboxNotification | null {
    const now = this.clock.now();
    const s = this.settings();
    const zone = resolveZone(s.calendar.timeZone);
    let delivery: InboxNotification['delivery'];
    if (input.missed) delivery = 'missed';
    else if (!s.notifications.enabled) delivery = 'in_app';
    else if (this.pausedUntil() || inQuietHours(now, s.notifications.quietHours, zone)) delivery = 'quiet_hours';
    else delivery = 'os';

    const n: InboxNotification = {
      id: newId(),
      dedupeKey: input.dedupeKey,
      kind: input.kind,
      title: input.title.slice(0, 200),
      body: (input.body ?? '').slice(0, 1000),
      createdAt: now.toISOString(),
      readAt: null,
      delivery,
      action: input.action ?? null,
      snoozable: input.snoozable ?? false,
      sourceRef: input.sourceRef ?? null,
    };

    const inserted = this.db.tx(() => {
      const r = this.db.run(
        'INSERT OR IGNORE INTO notification_log (dedupe_key, kind, fired_at, delivery) VALUES (?, ?, ?, ?)',
        [n.dedupeKey, n.kind, n.createdAt, delivery],
      );
      if (r.changes === 0) return false;
      this.db.run(
        `INSERT INTO inbox (id, dedupe_key, kind, title, body, created_at, read_at, delivery, action, snoozable, source_ref)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
        [n.id, n.dedupeKey, n.kind, n.title, n.body, n.createdAt, delivery, n.action ? JSON.stringify(n.action) : null, n.snoozable, n.sourceRef],
      );
      return true;
    });
    if (!inserted) return null;

    if (delivery === 'os') {
      const shown = this.port.show({ title: n.title, body: n.body, silent: !s.notifications.sound }, () => this.onClick(n));
      if (!shown) {
        n.delivery = 'in_app';
        this.db.run("UPDATE inbox SET delivery = 'in_app' WHERE id = ?", [n.id]);
        this.db.run("UPDATE notification_log SET delivery = 'in_app' WHERE dedupe_key = ?", [n.dedupeKey]);
      }
    }
    this.onDelivered(n);
    return n;
  }

  list(limit = 100): InboxNotification[] {
    return this.db
      .all<InboxRow>('SELECT * FROM inbox ORDER BY created_at DESC LIMIT ?', [Math.min(Math.max(limit, 1), 500)])
      .map(toNotification);
  }

  unreadCount(): number {
    return this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM inbox WHERE read_at IS NULL')?.n ?? 0;
  }

  get(id: string): InboxNotification | null {
    const r = this.db.get<InboxRow>('SELECT * FROM inbox WHERE id = ?', [id]);
    return r ? toNotification(r) : null;
  }

  markRead(id: string): void {
    this.db.run('UPDATE inbox SET read_at = COALESCE(read_at, ?) WHERE id = ?', [this.clock.now().toISOString(), id]);
  }

  markAllRead(): void {
    this.db.run('UPDATE inbox SET read_at = ? WHERE read_at IS NULL', [this.clock.now().toISOString()]);
  }

  /** Removes items from the inbox. The dedupe ledger is kept so they never fire again. */
  clear(): void {
    this.db.run('DELETE FROM inbox');
  }

  /** Drops dedupe entries older than `days`; nothing older can be re-fired anyway. */
  pruneLog(days: number): void {
    const cutoff = new Date(this.clock.now().getTime() - days * 86_400_000).toISOString();
    this.db.run('DELETE FROM notification_log WHERE fired_at < ?', [cutoff]);
  }
}
