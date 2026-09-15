/**
 * Systems widgets — memory, concurrency, numbers, and the OS.
 *
 * Same rule as everywhere else: run the real thing. The cache simulator really
 * tracks lines, the race really loses updates on the interleavings where it
 * should, and the float explorer really decomposes the IEEE-754 bits.
 */

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Badge, Text, useTheme } from '@synapse/ui';

import { Slider } from '../Slider';
import { ActionRow, Bar, Note, Readout, SegmentedControl, makeRandom } from './shared';

// ---------------------------------------------------------------------------
// Cache locality
// ---------------------------------------------------------------------------

const CELLS = 64;
const LINE = 8; // Elements per cache line, scaled down so the grid is readable.

/**
 * Walks the same 64 elements in two orders and counts real cache-line misses.
 * Sequential order misses once per line; a shuffled order misses almost every
 * access — which is the cost linked lists pay and big-O never shows.
 */
export function CacheLocality(): React.JSX.Element {
  const theme = useTheme();
  const [mode, setMode] = useState<'Sequential' | 'Shuffled'>('Sequential');
  const [step, setStep] = useState(0);

  const order = useMemo(() => {
    const indices = Array.from({ length: CELLS }, (_, i) => i);
    if (mode === 'Sequential') return indices;
    // A deterministic shuffle, so the numbers are reproducible.
    const random = makeRandom(17);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }
    return indices;
  }, [mode]);

  // Replay the walk and record, per step, whether the line was already resident.
  const { hits, misses, resident, touched } = useMemo(() => {
    const cache = new Set<number>();
    let h = 0;
    let m = 0;
    const seen: number[] = [];
    for (let i = 0; i < step; i++) {
      const index = order[i]!;
      const line = Math.floor(index / LINE);
      if (cache.has(line)) h += 1;
      else {
        m += 1;
        cache.add(line);
      }
      seen.push(index);
    }
    return { hits: h, misses: m, resident: cache, touched: new Set(seen) };
  }, [order, step]);

  // A miss is roughly 100× a hit on real hardware; the ratio is the lesson.
  const cycles = hits * 4 + misses * 200;

  return (
    <View>
      <SegmentedControl
        options={['Sequential', 'Shuffled'] as const}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setStep(0);
        }}
        label="Traversal order"
      />

      <View style={{ gap: 3 }}>
        {Array.from({ length: CELLS / LINE }, (_, row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
            <Text variant="label" tone="tertiary" style={{ width: 22 }}>
              L{row}
            </Text>
            {Array.from({ length: LINE }, (_, col) => {
              const index = row * LINE + col;
              const isCurrent = step > 0 && order[step - 1] === index;
              return (
                <View
                  key={col}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderRadius: 3,
                    borderWidth: 1,
                    borderColor: isCurrent ? theme.colors.warning : theme.colors.border,
                    backgroundColor: touched.has(index)
                      ? theme.colors.primarySubtle
                      : resident.has(row)
                        ? theme.colors.successSubtle
                        : theme.colors.surface,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>

      <Readout
        items={[
          { label: 'Accesses', value: `${step} / ${CELLS}` },
          { label: 'Cache hits', value: String(hits), color: theme.colors.success },
          { label: 'Misses', value: String(misses), color: theme.colors.danger },
          { label: 'Est. cycles', value: cycles.toLocaleString() },
        ]}
      />

      <ActionRow
        actions={[
          { label: 'Step', onPress: () => setStep((s) => Math.min(s + 1, CELLS)), primary: true, disabled: step >= CELLS },
          { label: 'Run', onPress: () => setStep(CELLS), disabled: step >= CELLS },
          { label: 'Reset', onPress: () => setStep(0) },
        ]}
      />

      <Note>
        Run both and compare the miss count. Sequential touches each line once and rides the
        prefetcher — 8 misses for 64 reads. Shuffled misses on nearly every access, and at roughly
        100 cycles a miss against 4 for a hit, the same 64 reads cost an order of magnitude more.
        Both are O(n). This is the constant factor that makes arrays beat linked lists in practice.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Race condition
// ---------------------------------------------------------------------------

type Op = 'read' | 'add' | 'write';
const OPS: Op[] = ['read', 'add', 'write'];

/**
 * Two threads running `counter = counter + 1`, interleaved by the learner.
 * The lost update is computed, not scripted — schedule both writes after both
 * reads and the counter really does end at 1.
 */
export function RaceCondition(): React.JSX.Element {
  const theme = useTheme();
  const [locked, setLocked] = useState(false);
  const [schedule, setSchedule] = useState<Array<'A' | 'B'>>([]);

  const state = useMemo(() => {
    let counter = 0;
    const regs: Record<'A' | 'B', number> = { A: 0, B: 0 };
    const pc: Record<'A' | 'B', number> = { A: 0, B: 0 };
    let held: 'A' | 'B' | null = null;
    const log: Array<{ thread: 'A' | 'B'; text: string; blocked: boolean }> = [];

    for (const thread of schedule) {
      const index = pc[thread];
      if (index >= OPS.length) continue;

      // With a lock, a thread cannot enter the critical section while the other
      // holds it — the step is simply skipped, which is what blocking looks like.
      if (locked && index === 0 && held !== null && held !== thread) {
        log.push({ thread, text: 'blocked — waiting for the lock', blocked: true });
        continue;
      }
      if (locked && index === 0) held = thread;

      const op = OPS[index]!;
      if (op === 'read') {
        regs[thread] = counter;
        log.push({ thread, text: `read counter → ${regs[thread]}`, blocked: false });
      } else if (op === 'add') {
        regs[thread] += 1;
        log.push({ thread, text: `add 1 → ${regs[thread]}`, blocked: false });
      } else {
        counter = regs[thread];
        log.push({ thread, text: `write ${counter} → counter`, blocked: false });
        if (locked) held = null;
      }
      pc[thread] = index + 1;
    }

    return { counter, pc, log };
  }, [schedule, locked]);

  const done = state.pc.A >= OPS.length && state.pc.B >= OPS.length;
  const lost = done && state.counter < 2;

  return (
    <View>
      <SegmentedControl
        options={['No lock', 'With lock'] as const}
        value={locked ? 'With lock' : 'No lock'}
        onChange={(next) => {
          setLocked(next === 'With lock');
          setSchedule([]);
        }}
        label="Critical section"
      />

      <View
        style={{
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          minHeight: 150,
        }}
      >
        {state.log.length === 0 ? (
          <Text variant="caption" tone="tertiary">
            Both threads run `counter = counter + 1`. Step them in any order you like.
          </Text>
        ) : (
          state.log.map((entry, index) => (
            <Text
              key={index}
              variant="mono"
              mono
              style={{
                color: entry.blocked
                  ? theme.colors.textTertiary
                  : entry.thread === 'A'
                    ? theme.colors.primary
                    : theme.colors.info,
              }}
            >
              {entry.thread}: {entry.text}
            </Text>
          ))
        )}
      </View>

      <Readout
        items={[
          { label: 'counter', value: String(state.counter), color: lost ? theme.colors.danger : theme.colors.success },
          { label: 'Expected', value: '2' },
          { label: 'Thread A', value: `${Math.min(state.pc.A, 3)} / 3` },
          { label: 'Thread B', value: `${Math.min(state.pc.B, 3)} / 3` },
        ]}
      />

      <ActionRow
        actions={[
          { label: 'Step A', onPress: () => setSchedule((s) => [...s, 'A']), primary: true, disabled: done },
          { label: 'Step B', onPress: () => setSchedule((s) => [...s, 'B']), disabled: done },
          { label: 'Reset', onPress: () => setSchedule([]) },
        ]}
      />

      {lost ? (
        <Badge
          label="Lost update — both threads read 0, both wrote 1, and one increment vanished"
          tone="danger"
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}

      <Note>
        Without a lock, step A-read, B-read, A-add, B-add, A-write, B-write and the counter ends at 1
        instead of 2. Nothing crashed and no error was raised — an increment simply disappeared. Then
        switch the lock on and try the same interleaving: B cannot enter until A has written, so the
        result is 2 no matter what order you pick. That is what "atomic" buys.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Floating point
// ---------------------------------------------------------------------------

const FORMATS = {
  float64: { mantissa: 52, exponent: 11, label: 'float64' },
  float32: { mantissa: 23, exponent: 8, label: 'float32' },
  float16: { mantissa: 10, exponent: 5, label: 'float16' },
  bfloat16: { mantissa: 7, exponent: 8, label: 'bfloat16' },
} as const;

type FormatName = keyof typeof FORMATS;

/** Rounds a value to a given mantissa width, the way a narrower float would. */
function quantise(value: number, mantissaBits: number): number {
  if (value === 0 || !Number.isFinite(value)) return value;
  const exponent = Math.floor(Math.log2(Math.abs(value)));
  const scale = Math.pow(2, mantissaBits - exponent);
  return Math.round(value * scale) / scale;
}

export function FloatPrecision(): React.JSX.Element {
  const theme = useTheme();
  const [format, setFormat] = useState<FormatName>('float32');
  const [magnitude, setMagnitude] = useState(0);

  const spec = FORMATS[format];
  const value = Math.pow(10, magnitude);
  // The gap between neighbouring representable numbers at this magnitude.
  const gap = Math.pow(2, Math.floor(Math.log2(value)) - spec.mantissa);

  const sum = quantise(quantise(0.1, spec.mantissa) + quantise(0.2, spec.mantissa), spec.mantissa);
  const exact = sum === 0.3;

  return (
    <View>
      <SegmentedControl
        options={['float64', 'float32', 'float16', 'bfloat16'] as const}
        value={format}
        onChange={setFormat}
        label="Format"
      />

      <View
        style={{
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.lg,
        }}
      >
        <Text variant="label" tone="tertiary" caps>0.1 + 0.2 in {spec.label}</Text>
        <Text variant="mono" mono style={{ color: exact ? theme.colors.success : theme.colors.danger, marginTop: 4 }}>
          {sum.toPrecision(Math.min(17, Math.max(3, Math.round(spec.mantissa / 3.3) + 1)))}
        </Text>
        <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.sm }}>
          {exact
            ? 'Rounds to exactly 0.3 at this width — the error is smaller than the gap between representable numbers.'
            : 'Not 0.3. Neither 0.1 nor 0.2 is representable in binary, so the sum carries their rounding error.'}
        </Text>
      </View>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider
          value={magnitude}
          min={0}
          max={12}
          step={1}
          onChange={setMagnitude}
          label="Magnitude (10^n)"
          format={(v) => `10^${v.toFixed(0)}`}
        />
      </View>

      <Readout
        items={[
          { label: 'Mantissa bits', value: String(spec.mantissa) },
          { label: 'Value', value: value.toExponential(0) },
          {
            label: 'Gap to the next number',
            value: gap < 1 ? gap.toExponential(2) : gap.toLocaleString(),
            color: gap >= 1 ? theme.colors.warning : undefined,
          },
        ]}
      />

      <Note>
        Two things to notice. First, 0.1 + 0.2 is not 0.3 in any binary float — it is a
        representation problem, not a bug. Second, drag the magnitude up: the gap between adjacent
        representable numbers grows with the value. In float32 past about 10⁷ the gap exceeds 1, so
        adding 1 to a large number does nothing at all. That is why training accumulates gradients in
        float32 even when the weights are float16, and why bfloat16 keeps float32’s exponent range
        and spends its bits differently.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CPU scheduler
// ---------------------------------------------------------------------------

interface Job {
  name: string;
  arrival: number;
  burst: number;
}

const JOBS: Job[] = [
  { name: 'A', arrival: 0, burst: 7 },
  { name: 'B', arrival: 1, burst: 2 },
  { name: 'C', arrival: 2, burst: 4 },
  { name: 'D', arrival: 3, burst: 1 },
];

type Policy = 'FIFO' | 'Shortest job' | 'Round robin';

/** Runs the three policies for real and reports the waits they produce. */
function schedule(policy: Policy, quantum: number): { timeline: string[]; wait: Record<string, number> } {
  const remaining = new Map(JOBS.map((j) => [j.name, j.burst]));
  const finish: Record<string, number> = {};
  const timeline: string[] = [];
  let time = 0;
  const queue: string[] = [];

  const admit = (): void => {
    for (const job of JOBS) {
      if (job.arrival <= time && !queue.includes(job.name) && (remaining.get(job.name) ?? 0) > 0 && finish[job.name] === undefined) {
        if (!timeline.includes(job.name) || !queue.includes(job.name)) queue.push(job.name);
      }
    }
  };

  const seen = new Set<string>();
  while (Object.keys(finish).length < JOBS.length && time < 200) {
    // Admit newly arrived jobs.
    for (const job of JOBS) {
      if (job.arrival <= time && !seen.has(job.name)) {
        seen.add(job.name);
        queue.push(job.name);
      }
    }
    if (queue.length === 0) {
      timeline.push('·');
      time += 1;
      continue;
    }

    let pick = 0;
    if (policy === 'Shortest job') {
      pick = queue.reduce((best, name, i) => ((remaining.get(name) ?? 0) < (remaining.get(queue[best]!) ?? 0) ? i : best), 0);
    }
    const name = queue.splice(pick, 1)[0]!;
    const slice = policy === 'Round robin' ? Math.min(quantum, remaining.get(name)!) : remaining.get(name)!;

    for (let i = 0; i < slice; i++) timeline.push(name);
    time += slice;
    remaining.set(name, remaining.get(name)! - slice);

    for (const job of JOBS) {
      if (job.arrival <= time && !seen.has(job.name)) {
        seen.add(job.name);
        queue.push(job.name);
      }
    }
    if (remaining.get(name)! > 0) queue.push(name);
    else finish[name] = time;
  }
  void admit;

  const wait: Record<string, number> = {};
  for (const job of JOBS) {
    wait[job.name] = (finish[job.name] ?? time) - job.arrival - job.burst;
  }
  return { timeline, wait };
}

export function CpuScheduler(): React.JSX.Element {
  const theme = useTheme();
  const [policy, setPolicy] = useState<Policy>('FIFO');
  const [quantum, setQuantum] = useState(2);

  const { timeline, wait } = useMemo(() => schedule(policy, quantum), [policy, quantum]);
  const averageWait = JOBS.reduce((n, j) => n + (wait[j.name] ?? 0), 0) / JOBS.length;

  const colors: Record<string, string> = {
    A: theme.colors.primary,
    B: theme.colors.info,
    C: theme.colors.warning,
    D: theme.colors.success,
    '·': theme.colors.surfaceMuted,
  };

  return (
    <View>
      <SegmentedControl
        options={['FIFO', 'Shortest job', 'Round robin'] as const}
        value={policy}
        onChange={setPolicy}
        label="Policy"
      />

      <Text variant="label" tone="tertiary" caps style={{ marginBottom: 4 }}>
        Timeline
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {timeline.map((name, index) => (
          <View
            key={index}
            style={{
              width: 18,
              height: 26,
              borderRadius: 3,
              backgroundColor: colors[name] ?? theme.colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="label" tone={name === '·' ? 'tertiary' : 'onAccent'}>
              {name}
            </Text>
          </View>
        ))}
      </View>

      {policy === 'Round robin' ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <Slider
            value={quantum}
            min={1}
            max={6}
            step={1}
            onChange={setQuantum}
            label="Time quantum"
            format={(v) => v.toFixed(0)}
          />
        </View>
      ) : null}

      <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
        {JOBS.map((job) => (
          <View key={job.name} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text variant="label" style={{ color: colors[job.name], width: 16 }}>
              {job.name}
            </Text>
            <Text variant="label" tone="tertiary" style={{ width: 92 }}>
              burst {job.burst}
            </Text>
            <View style={{ flex: 1 }}>
              <Bar fraction={Math.min(1, (wait[job.name] ?? 0) / 14)} color={theme.colors.danger} />
            </View>
            <Text variant="label" tone="tertiary" style={{ width: 52, textAlign: 'right' }}>
              wait {wait[job.name]}
            </Text>
          </View>
        ))}
      </View>

      <Readout
        items={[
          { label: 'Average wait', value: averageWait.toFixed(2), color: theme.colors.warning },
          { label: 'Makespan', value: String(timeline.length) },
        ]}
      />

      <Note>
        Shortest-job-first gives the lowest average wait — provably — and will starve a long job
        forever if short ones keep arriving. FIFO is fair and lets one long job block everyone behind
        it, which is convoy effect. Round robin bounds the wait for every job and pays for it in
        context switches: shrink the quantum and responsiveness improves while total throughput falls.
        There is no policy that wins on every axis, which is why the choice depends on whether you are
        scheduling a laptop, a batch cluster, or a trading system.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Virtual memory
// ---------------------------------------------------------------------------

/** A tiny LRU pager. Push the working set past RAM and watch it thrash. */
export function VirtualMemory(): React.JSX.Element {
  const theme = useTheme();
  const [frames, setFrames] = useState(4);
  const [workingSet, setWorkingSet] = useState(4);
  const [step, setStep] = useState(0);

  const accesses = useMemo(() => {
    const random = makeRandom(9);
    return Array.from({ length: 40 }, () => Math.floor(random() * workingSet));
  }, [workingSet]);

  const { resident, faults, hits, recent } = useMemo(() => {
    const inRam: number[] = [];
    let f = 0;
    let h = 0;
    for (let i = 0; i < step; i++) {
      const page = accesses[i]!;
      const at = inRam.indexOf(page);
      if (at >= 0) {
        h += 1;
        inRam.splice(at, 1);
        inRam.push(page); // Refresh its LRU position.
      } else {
        f += 1;
        if (inRam.length >= frames) inRam.shift(); // Evict least recently used.
        inRam.push(page);
      }
    }
    return { resident: new Set(inRam), faults: f, hits: h, recent: accesses.slice(Math.max(0, step - 12), step) };
  }, [accesses, frames, step]);

  const faultRate = step === 0 ? 0 : faults / step;
  const thrashing = faultRate > 0.6 && step > 8;

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: theme.spacing.md }}>
        {Array.from({ length: workingSet }, (_, page) => (
          <View
            key={page}
            style={{
              width: 38,
              height: 38,
              borderRadius: theme.radii.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: resident.has(page) ? theme.colors.successSubtle : theme.colors.surfaceMuted,
              borderWidth: 1,
              borderColor: resident.has(page) ? theme.colors.success : theme.colors.border,
            }}
          >
            <Text variant="label" tone={resident.has(page) ? 'success' : 'tertiary'}>
              p{page}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="label" tone="tertiary" caps>Recent accesses</Text>
      <Text variant="mono" mono style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
        {recent.length ? recent.map((p) => `p${p}`).join(' ') : '—'}
      </Text>

      <Slider value={frames} min={1} max={8} step={1} onChange={(v) => { setFrames(v); setStep(0); }} label="Physical frames (RAM)" format={(v) => v.toFixed(0)} />
      <Slider value={workingSet} min={2} max={12} step={1} onChange={(v) => { setWorkingSet(v); setStep(0); }} label="Working set (pages touched)" format={(v) => v.toFixed(0)} color={theme.colors.info} />

      <Readout
        items={[
          { label: 'Accesses', value: `${step} / 40` },
          { label: 'Hits', value: String(hits), color: theme.colors.success },
          { label: 'Page faults', value: String(faults), color: theme.colors.danger },
          { label: 'Fault rate', value: `${Math.round(faultRate * 100)}%`, color: thrashing ? theme.colors.danger : undefined },
        ]}
      />

      <ActionRow
        actions={[
          { label: 'Step', onPress: () => setStep((s) => Math.min(s + 1, 40)), primary: true, disabled: step >= 40 },
          { label: 'Run', onPress: () => setStep(40), disabled: step >= 40 },
          { label: 'Reset', onPress: () => setStep(0) },
        ]}
      />

      {thrashing ? (
        <Badge
          label="Thrashing — the working set does not fit in RAM, so almost every access faults"
          tone="danger"
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}

      <Note>
        Keep the working set at or below the frame count and the fault rate collapses to almost
        nothing after the first pass. Push it one page over and the rate jumps sharply — not
        gradually. That cliff is thrashing, and it is why a machine that was fine at 90% memory
        pressure becomes unusable at 101%: it is not running slower, it is spending its time moving
        pages instead of doing work.
      </Note>
    </View>
  );
}
