import { describe, expect, it } from 'vitest';
import { Scheduler } from '../../src/core/scheduler';
import { FakeClock } from '../helpers/db';

function fakeTimers() {
  const pending: { fn: () => void; ms: number; id: number }[] = [];
  let id = 0;
  return {
    pending,
    api: {
      set: (fn: () => void, ms: number) => {
        pending.push({ fn, ms, id: ++id });
        return id;
      },
      clear: (h: unknown) => {
        const i = pending.findIndex((p) => p.id === h);
        if (i >= 0) pending.splice(i, 1);
      },
    },
  };
}

describe('scheduler', () => {
  it('sleeps until the earliest source and runs only due sources', () => {
    const clock = new FakeClock('2026-01-01T00:00:00Z');
    const t = fakeTimers();
    const s = new Scheduler(clock, t.api);
    const ran: string[] = [];
    let aAt: Date | null = new Date('2026-01-01T00:10:00Z');
    s.add({ name: 'a', nextAt: () => aAt, run: () => { ran.push('a'); aAt = null; } });
    s.add({ name: 'b', nextAt: () => new Date('2026-01-01T00:30:00Z'), run: () => ran.push('b') });
    s.wake();
    expect(t.pending).toHaveLength(1);
    expect(t.pending[0]!.ms).toBe(10 * 60_000);
    clock.advanceMinutes(10);
    t.pending.shift()!.fn();
    expect(ran).toEqual(['a']);
    expect(t.pending[0]!.ms).toBe(20 * 60_000);
  });

  it('never sleeps longer than an hour and keeps one timer', () => {
    const clock = new FakeClock();
    const t = fakeTimers();
    const s = new Scheduler(clock, t.api);
    s.add({ name: 'far', nextAt: () => new Date(clock.now().getTime() + 5 * 3_600_000), run: () => {} });
    s.wake();
    s.wake();
    expect(t.pending).toHaveLength(1);
    expect(t.pending[0]!.ms).toBe(3_600_000);
  });

  it('isolates a failing source', () => {
    const clock = new FakeClock();
    const errors: string[] = [];
    const s = new Scheduler(clock, fakeTimers().api, (name) => errors.push(name));
    const ran: string[] = [];
    s.add({ name: 'bad', nextAt: () => clock.now(), run: () => { throw new Error('x'); } });
    s.add({ name: 'good', nextAt: () => clock.now(), run: () => ran.push('good') });
    s.wake();
    expect(errors).toEqual(['bad']);
    expect(ran).toEqual(['good']);
  });
});
