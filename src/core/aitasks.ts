import type { AiTask, AiTaskConfidence, AiTaskSource, AiTaskState } from '../shared/types';
import type { Db } from './db/database';
import { type Clock, NotFoundError, UserError, cleanLine, newId } from './util';

const STATES: AiTaskState[] = ['idle', 'running', 'waiting_input', 'completed', 'failed', 'canceled', 'unknown'];
const FINAL: AiTaskState[] = ['completed', 'failed', 'canceled'];

interface Row {
  id: string;
  title: string;
  source: AiTaskSource;
  state: AiTaskState;
  confidence: AiTaskConfidence;
  ref_type: AiTask['refType'];
  ref_id: string | null;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
  timeout_at: string | null;
  notified_at: string | null;
  detail: string;
}

const toTask = (r: Row): AiTask => ({
  id: r.id,
  title: r.title,
  source: r.source,
  state: r.state,
  confidence: r.confidence,
  refType: r.ref_type,
  refId: r.ref_id,
  startedAt: r.started_at,
  updatedAt: r.updated_at,
  finishedAt: r.finished_at,
  timeoutAt: r.timeout_at,
  notifiedAt: r.notified_at,
  detail: r.detail,
});

/**
 * Tracks AI tasks and how sure we are about their state:
 * - native: FlowCompanion's own API requests → confirmed by the provider response
 * - browser: signals from the paired browser extension → as reliable as the signal (manual clicks)
 * - timer: a user-set timer → only an estimate; expiry never marks a task completed
 * - manual: the user set the state
 */
export class AiTasksService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly onChange: (t: AiTask) => void = () => {},
  ) {}

  private now(): string {
    return this.clock.now().toISOString();
  }

  get(id: string): AiTask {
    const r = this.db.get<Row>('SELECT * FROM ai_tasks WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That AI task');
    return toTask(r);
  }

  list(opts: { active?: boolean; limit?: number } = {}): AiTask[] {
    const where = opts.active ? `WHERE state NOT IN ('completed', 'failed', 'canceled')` : '';
    return this.db.all<Row>(`SELECT * FROM ai_tasks ${where} ORDER BY updated_at DESC LIMIT ?`, [Math.min(opts.limit ?? 50, 500)]).map(toTask);
  }

  create(input: {
    title: string;
    source: AiTaskSource;
    state?: AiTaskState;
    confidence: AiTaskConfidence;
    refType?: AiTask['refType'];
    refId?: string | null;
    timeoutAt?: string | null;
    detail?: string;
  }): AiTask {
    const id = newId();
    const now = this.now();
    this.db.run(
      `INSERT INTO ai_tasks (id, title, source, state, confidence, ref_type, ref_id, started_at, updated_at, finished_at, timeout_at, notified_at, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?)`,
      [id, cleanLine(input.title, 200) || 'AI task', input.source, input.state ?? 'running', input.confidence, input.refType ?? null, input.refId ?? null, now, now, input.timeoutAt ?? null, input.detail ?? ''],
    );
    const t = this.get(id);
    this.onChange(t);
    return t;
  }

  setState(id: string, state: AiTaskState, confidence: AiTaskConfidence, detail?: string): AiTask {
    if (!STATES.includes(state)) throw new UserError('Unknown task state.');
    const cur = this.get(id);
    const now = this.now();
    this.db.run('UPDATE ai_tasks SET state = ?, confidence = ?, detail = ?, updated_at = ?, finished_at = ? WHERE id = ?', [
      state,
      confidence,
      detail ?? cur.detail,
      now,
      FINAL.includes(state) ? (cur.finishedAt ?? now) : null,
      id,
    ]);
    const t = this.get(id);
    this.onChange(t);
    return t;
  }

  /** A state the user set by hand. Always labelled "manual". */
  setManual(id: string, state: AiTaskState): AiTask {
    return this.setState(id, state, 'manual', 'Set by you.');
  }

  /** A reminder-style timer for work happening elsewhere (e.g. a long job in another AI app). */
  startTimer(title: string, minutes: number, url: string | null = null): AiTask {
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) throw new UserError('Timers can run from 1 minute to 24 hours.');
    return this.create({
      title,
      source: 'timer',
      confidence: 'estimated',
      refType: url ? 'url' : null,
      refId: url,
      timeoutAt: new Date(this.clock.now().getTime() + minutes * 60_000).toISOString(),
      detail: `Timer for ${minutes} min. FlowCompanion cannot see whether the work finished.`,
    });
  }

  /**
   * Timers whose time is up and that have not been announced. Their state
   * becomes "unknown", never "completed": a timer only estimates.
   */
  expireTimers(): AiTask[] {
    const now = this.now();
    const due = this.db.all<Row>(
      "SELECT * FROM ai_tasks WHERE source = 'timer' AND state = 'running' AND timeout_at IS NOT NULL AND timeout_at <= ? AND notified_at IS NULL",
      [now],
    );
    return due.map((r) => {
      this.db.run("UPDATE ai_tasks SET state = 'unknown', detail = ?, updated_at = ? WHERE id = ?", [
        'Timer ended. Check the task and mark it done if it finished.',
        now,
        r.id,
      ]);
      return this.get(r.id);
    });
  }

  nextTimerAt(): string | null {
    return this.db.get<{ t: string | null }>("SELECT MIN(timeout_at) AS t FROM ai_tasks WHERE source = 'timer' AND state = 'running' AND notified_at IS NULL")?.t ?? null;
  }

  markNotified(id: string): void {
    this.db.run('UPDATE ai_tasks SET notified_at = ? WHERE id = ? AND notified_at IS NULL', [this.now(), id]);
  }

  /** After a restart, requests that were in flight did not report back. Say so instead of guessing. */
  recoverAfterRestart(): number {
    return this.db.run(
      "UPDATE ai_tasks SET state = 'unknown', confidence = 'estimated', detail = 'FlowCompanion closed while this was running; the result was not received.', updated_at = ? WHERE source = 'native' AND state IN ('running', 'waiting_input')",
      [this.now()],
    ).changes;
  }

  delete(id: string): void {
    this.db.run('DELETE FROM ai_tasks WHERE id = ?', [id]);
  }

  clearFinished(): number {
    return this.db.run("DELETE FROM ai_tasks WHERE state IN ('completed', 'failed', 'canceled')").changes;
  }
}
