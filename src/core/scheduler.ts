import type { Clock } from './util';

export interface ScheduleSource {
  name: string;
  /** Next moment this source needs to run, or null if nothing is pending. */
  nextAt(): Date | null;
  /** Handles everything that is due at `now`. */
  run(now: Date): void;
}

export interface TimerApi {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const MAX_SLEEP_MS = 60 * 60_000;

/**
 * Wakes up once for the earliest pending item across all sources instead of
 * polling. Sleeps at most an hour so wall-clock or time-zone changes are
 * noticed; call wake() after anything changes (and on system resume).
 */
export class Scheduler {
  private handle: unknown = null;
  private sources: ScheduleSource[] = [];
  private running = false;
  nextWakeAt: Date | null = null;

  constructor(
    private readonly clock: Clock,
    private readonly timers: TimerApi = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as NodeJS.Timeout) },
    private readonly onError: (source: string, err: unknown) => void = (s, e) => console.error(`[scheduler] ${s} failed`, e),
  ) {}

  add(source: ScheduleSource): void {
    this.sources.push(source);
  }

  /** Runs whatever is due now, then arms the timer for the next item. */
  wake(): void {
    if (this.running) return;
    this.running = true;
    try {
      const now = this.clock.now();
      for (const s of this.sources) {
        const at = s.nextAt();
        if (at && at.getTime() <= now.getTime()) {
          try {
            s.run(now);
          } catch (err) {
            this.onError(s.name, err);
          }
        }
      }
    } finally {
      this.running = false;
    }
    this.arm();
  }

  private arm(): void {
    if (this.handle !== null) this.timers.clear(this.handle);
    this.handle = null;
    const now = this.clock.now().getTime();
    let next: number | null = null;
    for (const s of this.sources) {
      let at: Date | null = null;
      try {
        at = s.nextAt();
      } catch (err) {
        this.onError(s.name, err);
      }
      if (at && (next === null || at.getTime() < next)) next = at.getTime();
    }
    const delay = next === null ? MAX_SLEEP_MS : Math.min(Math.max(next - now, 0), MAX_SLEEP_MS);
    this.nextWakeAt = new Date(now + delay);
    // Due items run on the next tick rather than recursively.
    this.handle = this.timers.set(() => this.wake(), Math.max(delay, 25));
  }

  stop(): void {
    if (this.handle !== null) this.timers.clear(this.handle);
    this.handle = null;
  }
}
