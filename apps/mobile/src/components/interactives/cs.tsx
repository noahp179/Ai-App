/**
 * Computer-science widgets.
 *
 * Same rule as the ML ones: run the real thing. The sorter really counts its
 * own comparisons, the hash table really probes, and the traversal really
 * expands a frontier — because the whole point of these is that the numbers on
 * screen are the numbers the algorithm actually produced.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Badge, Text, useTheme } from '@synapse/ui';

import { Slider } from '../Slider';
import {
  ActionRow,
  Bar,
  Note,
  Path,
  PlotCanvas,
  Readout,
  SegmentedControl,
  makeRandom,
  type UnitPoint,
} from './shared';

// ---------------------------------------------------------------------------
// Big-O explorer
// ---------------------------------------------------------------------------

const GROWTH = {
  'O(1)': () => 1,
  'O(log n)': (n: number) => Math.log2(Math.max(2, n)),
  'O(n)': (n: number) => n,
  'O(n log n)': (n: number) => n * Math.log2(Math.max(2, n)),
  'O(n²)': (n: number) => n * n,
  'O(2ⁿ)': (n: number) => Math.pow(2, Math.min(n, 60)),
} as const;

type GrowthName = keyof typeof GROWTH;
const GROWTH_NAMES = Object.keys(GROWTH) as GrowthName[];

/**
 * Growth curves on a log scale, plus the thing that actually lands the lesson:
 * a constant factor the learner can crank up and watch fail to matter.
 */
export function BigOExplorer(): React.JSX.Element {
  const theme = useTheme();
  const [n, setN] = useState(32);
  const [constant, setConstant] = useState(1);
  const [slow, setSlow] = useState<GrowthName>('O(n²)');

  const colors: Record<GrowthName, string> = {
    'O(1)': theme.colors.success,
    'O(log n)': theme.colors.info,
    'O(n)': theme.colors.primary,
    'O(n log n)': theme.colors.xp,
    'O(n²)': theme.colors.warning,
    'O(2ⁿ)': theme.colors.danger,
  };

  const MAX_N = 64;
  // Log scale, because linear axes make everything past O(n) a vertical wall.
  // The 0.03 floor keeps O(1) off the axis so it draws as a visible flat line
  // rather than being clipped into nothing.
  const toY = (ops: number): number => 0.03 + (Math.log10(Math.max(1, ops)) / 12) * 0.95;

  const curves = useMemo(() => {
    const out: Array<{ name: GrowthName; points: UnitPoint[] }> = [];
    for (const name of GROWTH_NAMES) {
      const points: UnitPoint[] = [];
      for (let i = 1; i <= MAX_N; i++) {
        const y = toY(GROWTH[name](i));
        // Stop at the ceiling rather than running along it — a curve that
        // leaves the top reads as "off the chart", which is the truth.
        if (y > 1) break;
        points.push({ x: i / MAX_N, y });
      }
      out.push({ name, points });
    }
    return out;
  }, []);

  // The fast algorithm carries the constant; the slow one does not. The
  // crossover is where "but mine is 50× faster per step" stops being an answer.
  const fastOps = constant * GROWTH['O(n log n)'](n);
  const slowOps = GROWTH[slow](n);
  const crossover = useMemo(() => {
    for (let i = 2; i <= 4096; i++) {
      if (GROWTH[slow](i) > constant * GROWTH['O(n log n)'](i)) return i;
    }
    return null;
  }, [constant, slow]);

  return (
    <View>
      <SegmentedControl
        options={GROWTH_NAMES.filter((g) => g !== 'O(n log n)')}
        value={slow}
        onChange={setSlow}
        label="Compare O(n log n) against"
      />

      <PlotCanvas
        height={190}
        accessibilityLabel="Growth curves for each complexity class against input size"
      >
        {(size) => (
          <>
            {curves.map((curve) => (
              <Path
                key={curve.name}
                points={curve.points}
                size={size}
                color={colors[curve.name]}
                thickness={curve.name === slow || curve.name === 'O(n log n)' ? 3 : 1}
              />
            ))}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: (n / MAX_N) * size.width,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: theme.colors.borderStrong,
              }}
            />
          </>
        )}
      </PlotCanvas>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
        {GROWTH_NAMES.map((name) => (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 3, backgroundColor: colors[name], borderRadius: 2 }} />
            <Text variant="label" tone="tertiary">{name}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider value={n} min={1} max={MAX_N} step={1} onChange={setN} label="Input size n" format={(v) => v.toFixed(0)} />
        <Slider
          value={constant}
          min={1}
          max={200}
          step={1}
          onChange={setConstant}
          label="Constant factor on the O(n log n) algorithm"
          format={(v) => `${v.toFixed(0)}×`}
          color={theme.colors.info}
        />
      </View>

      <Readout
        items={[
          { label: `n`, value: String(n) },
          { label: `${constant}× n log n`, value: Math.round(fastOps).toLocaleString() },
          { label: slow, value: Math.round(slowOps).toLocaleString(), color: slowOps > fastOps ? theme.colors.danger : theme.colors.success },
        ]}
      />

      {crossover ? (
        <Badge
          label={
            constant === 1
              ? `O(n log n) overtakes ${slow} at n = ${crossover} and never looks back`
              : `Beyond n = ${crossover}, the ${constant}× slower O(n log n) algorithm wins`
          }
          tone="info"
          style={{ marginTop: theme.spacing.md }}
        />
      ) : (
        <Badge
          label={`${slow} still wins at n = 4096 — at this constant the asymptotics have not caught up`}
          tone="warning"
          style={{ marginTop: theme.spacing.md }}
        />
      )}

      <Note>
        Crank the constant to 200 and the O(n log n) algorithm looks terrible — until n gets large
        enough, and then it wins permanently and by a widening margin. That is the entire argument
        for asymptotic analysis: constants decide which is faster today, the exponent decides which
        is faster at scale. It also shows the other half, usually left out: for small n the constant
        is the only thing that matters, which is why real sort implementations switch to insertion
        sort under about 16 elements.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sorting visualizer
// ---------------------------------------------------------------------------

type SortName = 'Bubble' | 'Insertion' | 'Selection' | 'Merge';

interface SortFrame {
  values: number[];
  active: [number, number] | null;
  comparisons: number;
  writes: number;
}

/** Records every step so the widget can scrub rather than only animate. */
function runSort(name: SortName, input: number[]): SortFrame[] {
  const a = [...input];
  const frames: SortFrame[] = [];
  let comparisons = 0;
  let writes = 0;
  const snap = (active: [number, number] | null): void => {
    frames.push({ values: [...a], active, comparisons, writes });
  };
  snap(null);

  if (name === 'Bubble') {
    for (let i = 0; i < a.length; i++) {
      let swapped = false;
      for (let j = 0; j < a.length - i - 1; j++) {
        comparisons += 1;
        snap([j, j + 1]);
        if (a[j]! > a[j + 1]!) {
          [a[j], a[j + 1]] = [a[j + 1]!, a[j]!];
          writes += 2;
          swapped = true;
        }
      }
      if (!swapped) break; // Already sorted — the best case that makes bubble O(n).
    }
  } else if (name === 'Insertion') {
    for (let i = 1; i < a.length; i++) {
      const key = a[i]!;
      let j = i - 1;
      while (j >= 0) {
        comparisons += 1;
        snap([j, i]);
        if (a[j]! <= key) break;
        a[j + 1] = a[j]!;
        writes += 1;
        j -= 1;
      }
      a[j + 1] = key;
      writes += 1;
    }
  } else if (name === 'Selection') {
    for (let i = 0; i < a.length; i++) {
      let min = i;
      for (let j = i + 1; j < a.length; j++) {
        comparisons += 1;
        snap([min, j]);
        if (a[j]! < a[min]!) min = j;
      }
      if (min !== i) {
        [a[i], a[min]] = [a[min]!, a[i]!];
        writes += 2;
      }
    }
  } else {
    // Bottom-up merge sort: the same O(n log n) work, easier to record.
    const buffer = [...a];
    for (let width = 1; width < a.length; width *= 2) {
      for (let lo = 0; lo < a.length; lo += 2 * width) {
        const mid = Math.min(lo + width, a.length);
        const hi = Math.min(lo + 2 * width, a.length);
        let i = lo;
        let j = mid;
        for (let k = lo; k < hi; k++) {
          if (i < mid && (j >= hi || a[i]! <= a[j]!)) {
            if (j < hi) comparisons += 1;
            buffer[k] = a[i]!;
            i += 1;
          } else {
            if (i < mid) comparisons += 1;
            buffer[k] = a[j]!;
            j += 1;
          }
          writes += 1;
        }
        for (let k = lo; k < hi; k++) a[k] = buffer[k]!;
        snap([lo, hi - 1]);
      }
    }
  }
  snap(null);
  return frames;
}

export function SortingVisualizer(): React.JSX.Element {
  const theme = useTheme();
  const [algorithm, setAlgorithm] = useState<SortName>('Bubble');
  const [size, setSize] = useState(16);
  const [seed, setSeed] = useState(7);
  const [frame, setFrame] = useState(0);

  const input = useMemo(() => {
    const random = makeRandom(seed);
    return Array.from({ length: size }, () => Math.round(random() * 95) + 5);
  }, [size, seed]);

  const frames = useMemo(() => runSort(algorithm, input), [algorithm, input]);
  const current = frames[Math.min(frame, frames.length - 1)]!;
  const atEnd = frame >= frames.length - 1;

  const reset = useCallback(() => setFrame(0), []);

  return (
    <View>
      <SegmentedControl
        options={['Bubble', 'Insertion', 'Selection', 'Merge'] as const}
        value={algorithm}
        onChange={(next) => {
          setAlgorithm(next);
          setFrame(0);
        }}
        label="Algorithm"
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          height: 140,
          gap: 2,
          padding: theme.spacing.sm,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        {current.values.map((value, index) => {
          const touched = current.active?.includes(index) ?? false;
          return (
            <View
              key={index}
              style={{
                flex: 1,
                height: `${value}%`,
                borderRadius: 2,
                backgroundColor: touched ? theme.colors.warning : theme.colors.primary,
              }}
            />
          );
        })}
      </View>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider
          value={size}
          min={6}
          max={32}
          step={1}
          onChange={(next) => {
            setSize(next);
            setFrame(0);
          }}
          label="Array length"
          format={(v) => v.toFixed(0)}
        />
      </View>

      <Readout
        items={[
          { label: 'Step', value: `${Math.min(frame, frames.length - 1)} / ${frames.length - 1}` },
          { label: 'Comparisons', value: String(current.comparisons) },
          { label: 'Writes', value: String(current.writes) },
        ]}
      />

      <ActionRow
        actions={[
          { label: 'Step', onPress: () => setFrame((f) => Math.min(f + 1, frames.length - 1)), primary: true, disabled: atEnd },
          { label: 'Run', onPress: () => setFrame(frames.length - 1), disabled: atEnd },
          { label: 'Reshuffle', onPress: () => { setSeed((s) => s + 1); reset(); } },
        ]}
      />

      <Note>
        Watch the comparison count, not the bars. Bubble, insertion and selection all do roughly n²/2
        comparisons and merge does about n log n — at 32 elements that is roughly 500 against 160, and
        the gap grows without limit. Then reshuffle until you get a nearly-sorted array and step
        insertion sort: it finishes in almost n comparisons, which is why it beats merge sort on small
        or nearly-ordered input and why real library sorts fall back to it.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hash table probing
// ---------------------------------------------------------------------------

/** Linear probing, run for real, so the probe counts are measured not modelled. */
export function HashTableProbe(): React.JSX.Element {
  const theme = useTheme();
  const [buckets, setBuckets] = useState(16);
  const [count, setCount] = useState(8);
  const [seed, setSeed] = useState(3);

  const { table, probes, worst } = useMemo(() => {
    const slots: Array<number | null> = Array.from({ length: buckets }, () => null);
    const random = makeRandom(seed);
    let total = 0;
    let max = 0;
    for (let i = 0; i < Math.min(count, buckets); i++) {
      const key = Math.floor(random() * 9973);
      let index = key % buckets;
      let steps = 1;
      while (slots[index] !== null) {
        index = (index + 1) % buckets;
        steps += 1;
      }
      slots[index] = key;
      total += steps;
      max = Math.max(max, steps);
    }
    const inserted = Math.min(count, buckets);
    return { table: slots, probes: inserted === 0 ? 0 : total / inserted, worst: max };
  }, [buckets, count, seed]);

  const load = Math.min(count, buckets) / buckets;
  // Knuth's expected probes for successful linear-probing search.
  const predicted = load >= 1 ? Infinity : 0.5 * (1 + 1 / (1 - load));

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {table.map((slot, index) => (
          <View
            key={index}
            style={{
              width: 34,
              height: 34,
              borderRadius: theme.radii.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: slot === null ? theme.colors.surfaceMuted : theme.colors.primarySubtle,
              borderWidth: 1,
              borderColor: slot === null ? theme.colors.border : theme.colors.primary,
            }}
          >
            <Text variant="label" tone={slot === null ? 'tertiary' : 'primary'}>
              {slot === null ? '·' : String(slot % 100)}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Slider value={buckets} min={8} max={32} step={1} onChange={setBuckets} label="Buckets" format={(v) => v.toFixed(0)} />
        <Slider
          value={count}
          min={0}
          max={32}
          step={1}
          onChange={setCount}
          label="Keys inserted"
          format={(v) => v.toFixed(0)}
          color={theme.colors.info}
        />
      </View>

      <View style={{ marginTop: theme.spacing.md }}>
        <Text variant="label" tone="tertiary" caps>Load factor</Text>
        <Bar fraction={load} color={load > 0.75 ? theme.colors.danger : theme.colors.success} />
      </View>

      <Readout
        items={[
          { label: 'Load α', value: load.toFixed(2), color: load > 0.75 ? theme.colors.danger : theme.colors.success },
          { label: 'Avg probes', value: probes.toFixed(2) },
          { label: 'Worst probe', value: String(worst), color: worst > 4 ? theme.colors.warning : undefined },
          { label: 'Predicted (large n)', value: Number.isFinite(predicted) ? predicted.toFixed(2) : '∞' },
        ]}
      />

      <ActionRow actions={[{ label: 'Rehash with new keys', onPress: () => setSeed((s) => s + 1), primary: true }]} />

      <Note>
        The average probe count is flat and small while the load factor stays below about 0.7, then
        climbs sharply — and the worst case climbs first. That curve is why every real hash table
        grows and rehashes at a load threshold rather than waiting until it is full: O(1) average is a
        statement about a table with slack in it, not about hashing. The predicted figure is the
        asymptotic expectation for linear probing; on a table this small the measured value scatters
        around it noticeably, which is its own useful lesson about averages on small samples.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Graph traversal
// ---------------------------------------------------------------------------

const GRID = 9;

/** BFS and DFS over the same grid, expanded one node at a time. */
export function GraphTraversal(): React.JSX.Element {
  const theme = useTheme();
  const [mode, setMode] = useState<'BFS' | 'DFS'>('BFS');
  const [step, setStep] = useState(0);
  const [seed, setSeed] = useState(5);

  // Generate walls, then check the goal is actually reachable and reseed if it
  // is not. Without this, an unlucky seed can box the start in behind two walls
  // and the widget opens on a maze that demonstrates nothing.
  const walls = useMemo(() => {
    const goal = GRID * GRID - 1;

    const reachable = (blocked: Set<number>): boolean => {
      const seen = new Set<number>([0]);
      const queue = [0];
      while (queue.length > 0) {
        const node = queue.shift()!;
        if (node === goal) return true;
        const row = Math.floor(node / GRID);
        const col = node % GRID;
        for (const next of [
          col + 1 < GRID ? node + 1 : -1,
          row + 1 < GRID ? node + GRID : -1,
          col - 1 >= 0 ? node - 1 : -1,
          row - 1 >= 0 ? node - GRID : -1,
        ]) {
          if (next < 0 || seen.has(next) || blocked.has(next)) continue;
          seen.add(next);
          queue.push(next);
        }
      }
      return false;
    };

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const random = makeRandom(seed + attempt * 101);
      const set = new Set<number>();
      for (let i = 0; i < GRID * GRID; i += 1) {
        if (i === 0 || i === goal) continue;
        if (random() < 0.24) set.add(i);
      }
      if (reachable(set)) return set;
    }
    return new Set<number>();
  }, [seed]);

  const { order, foundAt, parents } = useMemo(() => {
    const start = 0;
    const goal = GRID * GRID - 1;
    const seen = new Set<number>([start]);
    const from = new Map<number, number>();
    const frontier: number[] = [start];
    const visited: number[] = [];
    let found = -1;

    while (frontier.length > 0) {
      // A queue for BFS, a stack for DFS. One line of difference, and it is the
      // whole difference between shortest-path and go-deep-first.
      const node = mode === 'BFS' ? frontier.shift()! : frontier.pop()!;
      visited.push(node);
      if (node === goal) {
        found = visited.length - 1;
        break;
      }
      const row = Math.floor(node / GRID);
      const col = node % GRID;
      const neighbours = [
        col + 1 < GRID ? node + 1 : -1,
        row + 1 < GRID ? node + GRID : -1,
        col - 1 >= 0 ? node - 1 : -1,
        row - 1 >= 0 ? node - GRID : -1,
      ];
      for (const next of neighbours) {
        if (next < 0 || seen.has(next) || walls.has(next)) continue;
        seen.add(next);
        from.set(next, node);
        frontier.push(next);
      }
    }
    return { order: visited, foundAt: found, parents: from };
  }, [mode, walls]);

  const shown = order.slice(0, step);
  const reached = foundAt >= 0 && step > foundAt;

  const pathCells = useMemo(() => {
    if (!reached) return new Set<number>();
    const cells = new Set<number>();
    let node: number | undefined = GRID * GRID - 1;
    while (node !== undefined) {
      cells.add(node);
      node = parents.get(node);
    }
    return cells;
  }, [reached, parents]);

  return (
    <View>
      <SegmentedControl
        options={['BFS', 'DFS'] as const}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setStep(0);
        }}
        label="Traversal"
      />

      <View style={{ gap: 3 }}>
        {Array.from({ length: GRID }, (_, row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: GRID }, (_, col) => {
              const index = row * GRID + col;
              const isWall = walls.has(index);
              const visitIndex = shown.indexOf(index);
              const onPath = pathCells.has(index);
              // Walls need to read as solid, not as empty space — on the light
              // theme surfaceElevated is white, which looks like a gap.
              const background = isWall
                ? theme.colors.borderStrong
                : onPath
                  ? theme.colors.success
                  : visitIndex >= 0
                    ? theme.colors.primarySubtle
                    : theme.colors.surface;
              return (
                <View
                  key={col}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderRadius: 4,
                    backgroundColor: background,
                    borderWidth: 1,
                    borderColor:
                      index === shown[shown.length - 1] ? theme.colors.warning : theme.colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {index === 0 || index === GRID * GRID - 1 ? (
                    <Text variant="label" tone={onPath ? 'onAccent' : 'tertiary'}>
                      {index === 0 ? 'S' : 'G'}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <Readout
        items={[
          { label: 'Expanded', value: String(shown.length) },
          {
            label: 'Reached goal',
            value: reached ? `after ${foundAt + 1}` : '—',
            color: reached ? theme.colors.success : undefined,
          },
          { label: 'Frontier', value: mode === 'BFS' ? 'queue' : 'stack' },
        ]}
      />

      <ActionRow
        actions={[
          { label: 'Step', onPress: () => setStep((s) => Math.min(s + 1, order.length)), primary: true, disabled: step >= order.length },
          { label: 'Run', onPress: () => setStep(order.length) },
          { label: 'New maze', onPress: () => { setSeed((s) => s + 1); setStep(0); } },
        ]}
      />

      <Note>
        Run both on the same maze and count the expansions. BFS spreads out in rings and the first
        time it touches the goal it has found a shortest path, because it never looks at distance
        d + 1 before finishing distance d. DFS plunges down one corridor, often reaches the goal
        sooner, and the route it took is usually not the shortest. The only difference in the code is
        whether the frontier is a queue or a stack.
      </Note>
    </View>
  );
}
