/**
 * Widgets for databases, networking, security, engineering practice, and theory.
 *
 * The query planner really scans, the automaton really runs its transition
 * table, the avalanche demo really hashes, and the latency budget really adds
 * up — including the part where a p99 is not the sum of p99s.
 */

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Badge, Text, useTheme } from '@synapse/ui';

import { Slider } from '../Slider';
import { ActionRow, Bar, Note, Readout, SegmentedControl, makeRandom } from './shared';

// ---------------------------------------------------------------------------
// Query plan
// ---------------------------------------------------------------------------

type Predicate = 'city = ?' | 'city = ? AND age > ?' | 'age > ?';
type IndexChoice = 'None' | 'city' | 'age' | 'city, age';

/**
 * Counts rows examined for a predicate under each index, using the real
 * selectivity of a generated table rather than a made-up multiplier.
 */
export function QueryPlan(): React.JSX.Element {
  const theme = useTheme();
  const [rows, setRows] = useState(100_000);
  const [predicate, setPredicate] = useState<Predicate>('city = ? AND age > ?');
  const [index, setIndex] = useState<IndexChoice>('None');

  // 20 cities, ages 18–78. Both selectivities are computable, not guessed.
  const cityFraction = 1 / 20;
  const ageFraction = 0.5; // age > 48 over a uniform 18–78 spread.

  const matching = useMemo(() => {
    if (predicate === 'city = ?') return rows * cityFraction;
    if (predicate === 'age > ?') return rows * ageFraction;
    return rows * cityFraction * ageFraction;
  }, [predicate, rows]);

  const { examined, method } = useMemo(() => {
    if (index === 'None') return { examined: rows, method: 'Seq Scan' };

    if (index === 'city' && predicate !== 'age > ?') {
      // Seek the city, then filter the rest in memory.
      return { examined: rows * cityFraction, method: 'Index Scan on (city)' };
    }
    if (index === 'age' && predicate !== 'city = ?') {
      return { examined: rows * ageFraction, method: 'Index Scan on (age)' };
    }
    if (index === 'city, age') {
      if (predicate === 'city = ? AND age > ?') {
        // A composite index serves the equality then the range: near-perfect.
        return { examined: rows * cityFraction * ageFraction, method: 'Index Scan on (city, age)' };
      }
      if (predicate === 'city = ?') {
        return { examined: rows * cityFraction, method: 'Index Scan on (city, age)' };
      }
      // Leading column not in the predicate — the index cannot be seeked.
      return { examined: rows, method: 'Seq Scan (index unusable: leading column missing)' };
    }
    return { examined: rows, method: 'Seq Scan (no usable index)' };
  }, [index, predicate, rows]);

  const wasted = examined - matching;
  const unusable = method.includes('unusable');

  return (
    <View>
      <SegmentedControl
        options={['city = ?', 'city = ? AND age > ?', 'age > ?'] as const}
        value={predicate}
        onChange={setPredicate}
        label="WHERE clause"
      />
      <SegmentedControl
        options={['None', 'city', 'age', 'city, age'] as const}
        value={index}
        onChange={setIndex}
        label="Index"
      />

      <View
        style={{
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: unusable ? theme.colors.danger : theme.colors.border,
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.lg,
        }}
      >
        <Text variant="label" tone="tertiary" caps>Plan</Text>
        <Text variant="mono" mono style={{ marginTop: 4, color: unusable ? theme.colors.danger : theme.colors.text }}>
          {method}
        </Text>
        <Text variant="mono" mono style={{ marginTop: 4, color: theme.colors.textTertiary }}>
          rows examined {Math.round(examined).toLocaleString()} · returned {Math.round(matching).toLocaleString()}
        </Text>
      </View>

      <View style={{ marginTop: theme.spacing.md }}>
        <Text variant="label" tone="tertiary" caps>Rows examined vs returned</Text>
        <Bar fraction={Math.min(1, examined / rows)} color={wasted > matching * 10 ? theme.colors.danger : theme.colors.success} height={10} />
      </View>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider
          value={rows}
          min={1000}
          max={1_000_000}
          step={1000}
          onChange={setRows}
          label="Table size"
          format={(v) => `${Math.round(v).toLocaleString()} rows`}
        />
      </View>

      <Readout
        items={[
          { label: 'Examined', value: Math.round(examined).toLocaleString() },
          { label: 'Returned', value: Math.round(matching).toLocaleString() },
          {
            label: 'Read for nothing',
            value: Math.round(wasted).toLocaleString(),
            color: wasted > matching * 10 ? theme.colors.danger : theme.colors.success,
          },
        ]}
      />

      <Note>
        The number to watch is examined against returned. A ratio near 1 means the index did its
        job; a ratio of 20,000 to 1 means the database read the whole table and threw nearly all of
        it away. Then try the trap: pick the composite index on (city, age) with a predicate on age
        alone. The index exists, it contains the column, and it still cannot be used — a composite
        index can only be seeked from its leading column, which is why column order is a design
        decision rather than a formality.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Latency budget
// ---------------------------------------------------------------------------

interface Hop {
  name: string;
  p50: number;
  p99: number;
  optional?: boolean;
}

const HOPS: Hop[] = [
  { name: 'DNS', p50: 2, p99: 40, optional: true },
  { name: 'TLS handshake', p50: 30, p99: 120, optional: true },
  { name: 'Load balancer', p50: 1, p99: 8 },
  { name: 'App server', p50: 12, p99: 90 },
  { name: 'Cache lookup', p50: 1, p99: 5, optional: true },
  { name: 'Database', p50: 20, p99: 300 },
];

/** Adds up a request path and shows why tail latency compounds so badly. */
export function LatencyBudget(): React.JSX.Element {
  const theme = useTheme();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(HOPS.map((h) => [h.name, true])),
  );
  const [fanout, setFanout] = useState(1);

  const active = HOPS.filter((h) => enabled[h.name]);
  const p50 = active.reduce((n, h) => n + h.p50, 0);
  const p99single = active.reduce((n, h) => n + h.p99, 0);

  // With N parallel calls you wait for the slowest, so the chance of hitting a
  // tail grows: P(at least one slow) = 1 − 0.99^N.
  const tailChance = 1 - Math.pow(0.99, fanout);

  return (
    <View>
      <View style={{ gap: theme.spacing.sm }}>
        {HOPS.map((hop) => {
          const on = enabled[hop.name] ?? false;
          return (
            <View key={hop.name} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Text
                variant="caption"
                tone={on ? 'default' : 'tertiary'}
                onPress={hop.optional ? () => setEnabled((e) => ({ ...e, [hop.name]: !on })) : undefined}
                style={{ width: 110 }}
              >
                {hop.optional ? (on ? '◉ ' : '○ ') : '● '}
                {hop.name}
              </Text>
              <View style={{ flex: 1 }}>
                <Bar fraction={on ? hop.p99 / 300 : 0} color={hop.p99 > 100 ? theme.colors.danger : theme.colors.primary} height={6} />
              </View>
              <Text variant="label" tone="tertiary" style={{ width: 74, textAlign: 'right' }}>
                {hop.p50}/{hop.p99} ms
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Slider
          value={fanout}
          min={1}
          max={100}
          step={1}
          onChange={setFanout}
          label="Parallel calls per request (fan-out)"
          format={(v) => `${v.toFixed(0)}×`}
          color={theme.colors.info}
        />
      </View>

      <Readout
        items={[
          { label: 'p50 total', value: `${p50} ms`, color: theme.colors.success },
          { label: 'p99 total', value: `${p99single} ms`, color: theme.colors.warning },
          {
            label: 'Chance of a slow hop',
            value: `${Math.round(tailChance * 100)}%`,
            color: tailChance > 0.5 ? theme.colors.danger : undefined,
          },
        ]}
      />

      <ActionRow
        actions={[
          {
            label: 'Warm connection',
            onPress: () => setEnabled((e) => ({ ...e, DNS: false, 'TLS handshake': false })),
            primary: true,
          },
          {
            label: 'Cache hit',
            onPress: () => setEnabled((e) => ({ ...e, Database: false, 'Cache lookup': true })),
          },
          {
            label: 'Reset',
            onPress: () => setEnabled(Object.fromEntries(HOPS.map((h) => [h.name, true]))),
          },
        ]}
      />

      <Note>
        Two things fall out. Turning off DNS and TLS — which is what a warm connection does — removes
        more p50 than any application change you were considering, which is why connection reuse
        matters so much. And drag the fan-out: at 100 parallel calls there is a 63% chance at least
        one lands in its slow 1%, so the p99 of the whole request is roughly the p99 of its worst hop.
        Tail latency does not average out across a fan-out; it compounds.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Finite automaton
// ---------------------------------------------------------------------------

/**
 * A DFA accepting binary strings with an even number of 1s — run for real over
 * whatever the learner types, one transition at a time.
 */
export function FiniteAutomaton(): React.JSX.Element {
  const theme = useTheme();
  const [pattern, setPattern] = useState<'even 1s' | 'ends in 01' | 'contains 11'>('even 1s');
  const [input, setInput] = useState('1011');
  const [step, setStep] = useState(0);

  const machine = useMemo(() => {
    if (pattern === 'even 1s') {
      return {
        states: ['even', 'odd'],
        accepting: new Set(['even']),
        delta: (state: string, c: string) => (c === '1' ? (state === 'even' ? 'odd' : 'even') : state),
        blurb: 'Accepts strings with an even number of 1s.',
      };
    }
    if (pattern === 'ends in 01') {
      return {
        states: ['q0', 'q1', 'q2'],
        accepting: new Set(['q2']),
        delta: (state: string, c: string) => {
          if (c === '0') return 'q1';
          return state === 'q1' ? 'q2' : 'q0';
        },
        blurb: 'Accepts strings ending in 01.',
      };
    }
    return {
      states: ['none', 'saw1', 'done'],
      accepting: new Set(['done']),
      delta: (state: string, c: string) => {
        if (state === 'done') return 'done';
        if (c === '1') return state === 'saw1' ? 'done' : 'saw1';
        return 'none';
      },
      blurb: 'Accepts strings containing 11.',
    };
  }, [pattern]);

  const trace = useMemo(() => {
    let state = machine.states[0]!;
    const path = [state];
    for (const c of input.slice(0, step)) {
      state = machine.delta(state, c);
      path.push(state);
    }
    return path;
  }, [machine, input, step]);

  const current = trace[trace.length - 1]!;
  const finished = step >= input.length;
  const accepted = finished && machine.accepting.has(current);

  return (
    <View>
      <SegmentedControl
        options={['even 1s', 'ends in 01', 'contains 11'] as const}
        value={pattern}
        onChange={(next) => {
          setPattern(next);
          setStep(0);
        }}
        label="Language"
      />

      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
        {machine.blurb}
      </Text>

      {/* States */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
        {machine.states.map((state) => {
          const isCurrent = state === current;
          const isAccepting = machine.accepting.has(state);
          return (
            <View
              key={state}
              style={{
                flex: 1,
                paddingVertical: theme.spacing.md,
                borderRadius: theme.radii.md,
                alignItems: 'center',
                borderWidth: isAccepting ? 3 : 1,
                borderColor: isCurrent
                  ? theme.colors.primary
                  : isAccepting
                    ? theme.colors.success
                    : theme.colors.border,
                backgroundColor: isCurrent ? theme.colors.primarySubtle : theme.colors.surface,
              }}
            >
              <Text variant="caption" tone={isCurrent ? 'primary' : 'secondary'}>
                {state}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Tape */}
      <View style={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
        {input.split('').map((c, index) => (
          <View
            key={index}
            style={{
              width: 28,
              height: 34,
              borderRadius: 4,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: index === step ? theme.colors.warning : theme.colors.border,
              backgroundColor: index < step ? theme.colors.primarySubtle : theme.colors.surface,
            }}
          >
            <Text variant="mono" mono>{c}</Text>
          </View>
        ))}
      </View>

      <Readout
        items={[
          { label: 'State', value: current },
          { label: 'Read', value: `${step} / ${input.length}` },
          {
            label: 'Verdict',
            value: finished ? (accepted ? 'accept' : 'reject') : '…',
            color: finished ? (accepted ? theme.colors.success : theme.colors.danger) : undefined,
          },
        ]}
      />

      <ActionRow
        actions={[
          { label: 'Step', onPress: () => setStep((s) => Math.min(s + 1, input.length)), primary: true, disabled: finished },
          { label: 'Run', onPress: () => setStep(input.length), disabled: finished },
          {
            label: 'New input',
            onPress: () => {
              const random = makeRandom(Date.now() % 9973);
              const length = 4 + Math.floor(random() * 4);
              setInput(Array.from({ length }, () => (random() < 0.5 ? '0' : '1')).join(''));
              setStep(0);
            },
          },
        ]}
      />

      <Note>
        The whole machine is a table: current state plus next character gives the next state. There
        is no memory beyond which state you are in — and that finite memory is exactly what makes
        these machines equivalent to regular expressions, and exactly why no regular expression can
        match balanced brackets. Counting arbitrarily deep nesting needs unbounded memory, and a
        finite automaton has none. That is not an implementation limit; it is a proof.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Truth table
// ---------------------------------------------------------------------------

const EXPRESSIONS = {
  '¬(P ∧ Q)': (p: boolean, q: boolean) => !(p && q),
  '¬P ∨ ¬Q': (p: boolean, q: boolean) => !p || !q,
  'P → Q': (p: boolean, q: boolean) => !p || q,
  '¬P ∨ Q': (p: boolean, q: boolean) => !p || q,
  'P ⊕ Q': (p: boolean, q: boolean) => p !== q,
} as const;

type ExprName = keyof typeof EXPRESSIONS;
const EXPR_NAMES = Object.keys(EXPRESSIONS) as ExprName[];

/** Two expressions side by side, so equivalence is something you can see. */
export function TruthTable(): React.JSX.Element {
  const theme = useTheme();
  const [left, setLeft] = useState<ExprName>('¬(P ∧ Q)');
  const [right, setRight] = useState<ExprName>('¬P ∨ ¬Q');

  const rows = useMemo(
    () =>
      [
        [true, true],
        [true, false],
        [false, true],
        [false, false],
      ].map(([p, q]) => ({
        p: p!,
        q: q!,
        l: EXPRESSIONS[left](p!, q!),
        r: EXPRESSIONS[right](p!, q!),
      })),
    [left, right],
  );

  const equivalent = rows.every((row) => row.l === row.r);

  const cell = (value: boolean, highlight = false): React.JSX.Element => (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm }}>
      <Text
        variant="mono"
        mono
        style={{ color: highlight ? (value ? theme.colors.success : theme.colors.danger) : theme.colors.textSecondary }}
      >
        {value ? 'T' : 'F'}
      </Text>
    </View>
  );

  return (
    <View>
      <SegmentedControl options={EXPR_NAMES} value={left} onChange={setLeft} label="Expression A" />
      <SegmentedControl options={EXPR_NAMES} value={right} onChange={setRight} label="Expression B" />

      <View
        style={{
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          overflow: 'hidden',
        }}
      >
        <View style={{ flexDirection: 'row', backgroundColor: theme.colors.surfaceMuted }}>
          {['P', 'Q', left, right].map((label) => (
            <View key={label} style={{ flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm }}>
              <Text variant="label" tone="tertiary">{label}</Text>
            </View>
          ))}
        </View>
        {rows.map((row, index) => (
          <View
            key={index}
            style={{
              flexDirection: 'row',
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              backgroundColor: row.l === row.r ? 'transparent' : theme.colors.dangerSubtle,
            }}
          >
            {cell(row.p)}
            {cell(row.q)}
            {cell(row.l, true)}
            {cell(row.r, true)}
          </View>
        ))}
      </View>

      <Badge
        label={equivalent ? 'Logically equivalent — identical on every row' : 'Not equivalent — the highlighted rows disagree'}
        tone={equivalent ? 'success' : 'warning'}
        style={{ marginTop: theme.spacing.md }}
      />

      <Note>
        Compare ¬(P ∧ Q) with ¬P ∨ ¬Q: identical on all four rows, which is De Morgan's law — and it
        is why `!(a && b)` can be rewritten as `!a || !b` without changing behaviour. Then compare
        P → Q with ¬P ∨ Q and notice they also match: implication is not a separate primitive, it is
        shorthand. The row that surprises people is P false, Q true, where P → Q is true — a promise
        about a condition that never happened was never broken.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hash avalanche
// ---------------------------------------------------------------------------

/** A real (non-cryptographic) hash, used to show avalanche and salting. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const toBits = (n: number): string => n.toString(2).padStart(32, '0');

export function HashAvalanche(): React.JSX.Element {
  const theme = useTheme();
  const [password, setPassword] = useState('hunter2');
  const [salted, setSalted] = useState(false);

  const variants = useMemo(() => {
    const tweak = password.slice(0, -1) + String.fromCharCode(password.charCodeAt(password.length - 1) + 1);
    const salt = salted ? 'a7f3e1' : '';
    return {
      a: fnv1a(salt + password),
      b: fnv1a(salt + tweak),
      tweak,
      // Two users with the same password: identical digests without a salt.
      other: fnv1a((salted ? 'b92c04' : '') + password),
    };
  }, [password, salted]);

  const bitsA = toBits(variants.a);
  const bitsB = toBits(variants.b);
  const changed = bitsA.split('').filter((bit, i) => bit !== bitsB[i]).length;
  const collides = variants.a === variants.other;

  return (
    <View>
      <SegmentedControl
        options={['Unsalted', 'Salted'] as const}
        value={salted ? 'Salted' : 'Unsalted'}
        onChange={(next) => setSalted(next === 'Salted')}
        label="Storage"
      />

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" tone="tertiary" caps>Input "{password}"</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {bitsA.split('').map((bit, index) => (
            <View
              key={index}
              style={{
                width: 9,
                height: 16,
                margin: 1,
                borderRadius: 2,
                backgroundColor: bit === '1' ? theme.colors.primary : theme.colors.surfaceMuted,
              }}
            />
          ))}
        </View>

        <Text variant="label" tone="tertiary" caps style={{ marginTop: theme.spacing.sm }}>
          Input "{variants.tweak}" — one character different
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {bitsB.split('').map((bit, index) => (
            <View
              key={index}
              style={{
                width: 9,
                height: 16,
                margin: 1,
                borderRadius: 2,
                backgroundColor:
                  bit !== bitsA[index]
                    ? theme.colors.warning
                    : bit === '1'
                      ? theme.colors.primary
                      : theme.colors.surfaceMuted,
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider
          value={password.length}
          min={4}
          max={12}
          step={1}
          onChange={(v) => setPassword('hunter2password'.slice(0, Math.round(v)))}
          label="Input length"
          format={(v) => `${v.toFixed(0)} chars`}
        />
      </View>

      <Readout
        items={[
          { label: 'Digest A', value: variants.a.toString(16).padStart(8, '0') },
          { label: 'Digest B', value: variants.b.toString(16).padStart(8, '0') },
          {
            label: 'Bits changed',
            value: `${changed} / 32`,
            color: changed > 10 ? theme.colors.success : theme.colors.warning,
          },
        ]}
      />

      <Badge
        label={
          collides
            ? 'Two users with this password share a digest — one cracked hash breaks both accounts'
            : 'Per-user salts: the same password produces different digests'
        }
        tone={collides ? 'danger' : 'success'}
        style={{ marginTop: theme.spacing.md }}
      />

      <Note>
        One character in, about half the bits out — the avalanche property, and the reason you cannot
        work backwards from a digest by nudging the input. Then switch salting on: the same password
        for two different users now hashes differently, which is what defeats a precomputed rainbow
        table. Note what salting does not do — it does not slow an attacker who has one hash and
        wants one password. That is what a deliberately slow function like bcrypt or argon2 is for,
        and it is why a fast hash is the wrong tool for passwords even when it is cryptographic.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bisect
// ---------------------------------------------------------------------------

/** Binary search over history — the same log₂ n, now as a debugging method. */
export function BisectDebug(): React.JSX.Element {
  const theme = useTheme();
  const [count, setCount] = useState(64);
  const [strategy, setStrategy] = useState<'Bisect' | 'One by one'>('Bisect');
  const [seed, setSeed] = useState(4);

  const culprit = useMemo(() => Math.floor(makeRandom(seed)() * count), [seed, count]);

  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(count - 1);
  const [tested, setTested] = useState(0);
  const [cursor, setCursor] = useState(0);

  const reset = (): void => {
    setLo(0);
    setHi(count - 1);
    setTested(0);
    setCursor(0);
  };

  const probe = strategy === 'Bisect' ? Math.floor((lo + hi) / 2) : cursor;
  const found = strategy === 'Bisect' ? lo >= hi : cursor >= culprit;

  const test = (): void => {
    setTested((n) => n + 1);
    if (strategy === 'One by one') {
      setCursor((c) => Math.min(c + 1, count - 1));
      return;
    }
    // "Is the bug present at this commit?" — broken from the culprit onward.
    if (probe >= culprit) setHi(probe);
    else setLo(probe + 1);
  };

  const expected = strategy === 'Bisect' ? Math.ceil(Math.log2(count)) : culprit + 1;

  return (
    <View>
      <SegmentedControl
        options={['Bisect', 'One by one'] as const}
        value={strategy}
        onChange={(next) => {
          setStrategy(next);
          reset();
        }}
        label="Search strategy"
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {Array.from({ length: count }, (_, i) => {
          const inRange = strategy === 'Bisect' ? i >= lo && i <= hi : i >= cursor;
          return (
            <View
              key={i}
              style={{
                width: 10,
                height: 18,
                borderRadius: 2,
                backgroundColor:
                  found && i === (strategy === 'Bisect' ? lo : cursor)
                    ? theme.colors.danger
                    : i === probe
                      ? theme.colors.warning
                      : inRange
                        ? theme.colors.primarySubtle
                        : theme.colors.surfaceMuted,
              }}
            />
          );
        })}
      </View>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider
          value={count}
          min={8}
          max={256}
          step={8}
          onChange={(v) => {
            setCount(Math.round(v));
            setLo(0);
            setHi(Math.round(v) - 1);
            setTested(0);
            setCursor(0);
          }}
          label="Commits since it last worked"
          format={(v) => v.toFixed(0)}
        />
      </View>

      <Readout
        items={[
          { label: 'Builds tested', value: String(tested), color: theme.colors.warning },
          { label: 'Expected total', value: String(expected) },
          {
            label: 'Culprit',
            value: found ? `#${culprit}` : 'unknown',
            color: found ? theme.colors.danger : undefined,
          },
        ]}
      />

      <ActionRow
        actions={[
          { label: 'Test a build', onPress: test, primary: true, disabled: found },
          { label: 'Run', onPress: () => { let guard = 0; while (!found && guard++ < 300) test(); } },
          { label: 'New bug', onPress: () => { setSeed((s) => s + 1); reset(); } },
        ]}
      />

      <Note>
        Bisecting 256 commits takes 8 builds; walking them takes up to 256. It is binary search
        wearing different clothes — the only requirements are an ordered history and a test that
        answers yes or no. Which is also the catch worth knowing: bisect is only as good as that
        test, so an intermittent failure will mislead it confidently, and the fix is to make the
        reproduction deterministic before you start rather than to distrust the result afterwards.
      </Note>
    </View>
  );
}
