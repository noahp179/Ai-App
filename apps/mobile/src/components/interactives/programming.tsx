/**
 * Widgets for the programming, web and cloud tracks.
 *
 * The shared idea across these five is that they make an invisible mechanism
 * visible one step at a time: the variables a program is holding, the rules an
 * operator applies, the boxes CSS is laying out, the queues the event loop
 * drains, and the line items a cloud bill is made of. None of them simulate
 * anything faithfully — they are small enough to be read in full, which is the
 * point.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, useTheme } from '@synapse/ui';

import { Slider } from '../Slider';
import { ActionRow, Bar, Note, Readout, SegmentedControl } from './shared';

// ---------------------------------------------------------------------------
// Code tracer
// ---------------------------------------------------------------------------

interface TraceLine {
  code: string;
  /** Variable bindings *after* this line has run. */
  after: Record<string, string>;
  note?: string;
}

const TRACE_PROGRAMS: Record<string, { title: string; lines: TraceLine[]; note: string }> = {
  Accumulate: {
    title: 'Summing a list',
    lines: [
      { code: 'const xs = [3, 1, 4];', after: { xs: '[3, 1, 4]' } },
      { code: 'let total = 0;', after: { xs: '[3, 1, 4]', total: '0' } },
      { code: 'for (const x of xs) {', after: { xs: '[3, 1, 4]', total: '0', x: '3' } },
      { code: '  total = total + x;', after: { xs: '[3, 1, 4]', total: '3', x: '3' } },
      { code: '} // next iteration', after: { xs: '[3, 1, 4]', total: '3', x: '1' } },
      { code: '  total = total + x;', after: { xs: '[3, 1, 4]', total: '4', x: '1' } },
      { code: '} // next iteration', after: { xs: '[3, 1, 4]', total: '4', x: '4' } },
      { code: '  total = total + x;', after: { xs: '[3, 1, 4]', total: '8', x: '4' } },
      { code: 'return total;', after: { xs: '[3, 1, 4]', total: '8', x: '4' }, note: 'Returns 8' },
    ],
    note: 'The accumulator pattern: one variable outside the loop, updated once per element. Notice that `x` is a new binding each pass — it is not shared state, which is why the loop is easy to reason about.',
  },
  Aliasing: {
    title: 'Two names, one array',
    lines: [
      { code: 'const a = [1, 2];', after: { a: '[1, 2]' } },
      { code: 'const b = a;', after: { a: '[1, 2]', b: '[1, 2]', '→': 'b and a point at ONE array' } },
      { code: 'b.push(3);', after: { a: '[1, 2, 3]', b: '[1, 2, 3]', '→': 'both changed' } },
      { code: 'const c = [...a];', after: { a: '[1, 2, 3]', b: '[1, 2, 3]', c: '[1, 2, 3]' } },
      { code: 'c.push(4);', after: { a: '[1, 2, 3]', b: '[1, 2, 3]', c: '[1, 2, 3, 4]' }, note: 'c is independent' },
    ],
    note: 'Assignment copies the reference, not the array. `b.push` is visible through `a` because there is only one array. The spread on line 4 makes a genuinely separate one — though only one level deep.',
  },
  Closure: {
    title: 'A counter that remembers',
    lines: [
      { code: 'function makeCounter() {', after: {} },
      { code: '  let count = 0;', after: { 'count (inner)': '0' } },
      { code: '  return () => ++count;', after: { 'count (inner)': '0' } },
      { code: '}', after: { 'count (inner)': '0', '→': 'makeCounter returned' } },
      { code: 'const next = makeCounter();', after: { 'count (captured)': '0', next: 'function' } },
      { code: 'next();', after: { 'count (captured)': '1', next: 'function' } },
      { code: 'next();', after: { 'count (captured)': '2', next: 'function' } },
      {
        code: 'console.log(count);',
        after: { 'count (captured)': '2', next: 'function' },
        note: 'ReferenceError — count is not visible out here',
      },
    ],
    note: 'The function outlived the call that created it and `count` came with it. Nothing outside can read or write that variable — it is private by construction, which is what makes closures useful for state.',
  },
};

type ProgramName = keyof typeof TRACE_PROGRAMS;
const PROGRAM_NAMES = Object.keys(TRACE_PROGRAMS) as ProgramName[];

export function CodeTracer(): React.JSX.Element {
  const theme = useTheme();
  const [program, setProgram] = useState<ProgramName>('Accumulate');
  const [step, setStep] = useState(0);

  const active = TRACE_PROGRAMS[program] ?? TRACE_PROGRAMS.Accumulate;
  const lines = active?.lines ?? [];
  const current = lines[step];
  const bindings = Object.entries(current?.after ?? {});

  const reset = (next: ProgramName): void => {
    setProgram(next);
    setStep(0);
  };

  return (
    <View>
      <SegmentedControl
        label="Program"
        options={PROGRAM_NAMES}
        value={program}
        onChange={reset}
      />

      <View
        accessibilityLabel={`Line ${step + 1} of ${lines.length}: ${current?.code ?? ''}`}
        style={{
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
        }}
      >
        {lines.map((line, index) => (
          <View
            key={index}
            style={{
              flexDirection: 'row',
              gap: theme.spacing.sm,
              backgroundColor: index === step ? theme.colors.primarySubtle : 'transparent',
              borderRadius: theme.radii.sm,
              paddingHorizontal: theme.spacing.xs,
            }}
          >
            <Text variant="mono" mono tone={index === step ? 'primary' : 'tertiary'}>
              {index === step ? '▶' : ' '}
            </Text>
            <Text
              variant="mono"
              mono
              tone={index <= step ? 'default' : 'tertiary'}
              style={{ flex: 1 }}
            >
              {line.code}
            </Text>
          </View>
        ))}
      </View>

      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={
          bindings.length
            ? `Variables: ${bindings.map(([k, v]) => `${k} is ${v}`).join(', ')}`
            : 'No variables yet'
        }
        style={{
          marginTop: theme.spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          minHeight: 96,
        }}
      >
        <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.sm }}>
          Variables now
        </Text>
        {bindings.length === 0 ? (
          <Text variant="caption" tone="tertiary">
            Nothing bound yet.
          </Text>
        ) : (
          bindings.map(([name, value]) => (
            <View key={name} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Text variant="mono" mono tone="primary">
                {name}
              </Text>
              <Text variant="mono" mono tone="secondary">
                = {value}
              </Text>
            </View>
          ))
        )}
        {current?.note ? (
          <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.sm }}>
            {current.note}
          </Text>
        ) : null}
      </View>

      <ActionRow
        actions={[
          {
            label: 'Step',
            primary: true,
            disabled: step >= lines.length - 1,
            onPress: () => setStep((s) => Math.min(lines.length - 1, s + 1)),
          },
          { label: 'Back', disabled: step === 0, onPress: () => setStep((s) => Math.max(0, s - 1)) },
          { label: 'Reset', onPress: () => setStep(0) },
        ]}
      />

      <Note>{active?.note ?? ''}</Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Type coercion
// ---------------------------------------------------------------------------

interface CoercionRow {
  expression: string;
  result: string;
  surprising: boolean;
  why: string;
}

const COERCIONS: CoercionRow[] = [
  { expression: '1 + 1', result: '2', surprising: false, why: 'Two numbers: arithmetic.' },
  { expression: '"1" + 1', result: '"11"', surprising: true, why: 'A string on either side makes + mean joining, so 1 is converted to "1".' },
  { expression: '"3" * 2', result: '6', surprising: true, why: '* has no string meaning, so the string is converted to a number instead.' },
  { expression: '"3" - 1', result: '2', surprising: true, why: 'Same as above — only + is overloaded for strings.' },
  { expression: '0 == "0"', result: 'true', surprising: true, why: 'Loose equality converts before comparing.' },
  { expression: '0 === "0"', result: 'false', surprising: false, why: 'Strict equality compares type first. This is why you use it.' },
  { expression: 'null == undefined', result: 'true', surprising: true, why: 'A special case in the spec — they are loosely equal to each other and nothing else.' },
  { expression: 'NaN === NaN', result: 'false', surprising: true, why: 'NaN is not equal to anything, including itself. Use Number.isNaN.' },
  { expression: '[] + []', result: '""', surprising: true, why: 'Both arrays convert to strings, and an empty array becomes an empty string.' },
  { expression: '0.1 + 0.2 === 0.3', result: 'false', surprising: true, why: 'Not coercion at all — binary floating point, from the architecture track.' },
];

export function TypeCoercion(): React.JSX.Element {
  const theme = useTheme();
  const [revealed, setRevealed] = useState<number[]>([]);
  const [filter, setFilter] = useState<'All' | 'Surprising'>('All');

  const rows = useMemo(
    () => (filter === 'All' ? COERCIONS : COERCIONS.filter((r) => r.surprising)),
    [filter],
  );

  return (
    <View>
      <SegmentedControl
        label="Show"
        options={['All', 'Surprising'] as const}
        value={filter}
        onChange={setFilter}
      />

      <View style={{ gap: theme.spacing.xs }}>
        {rows.map((row) => {
          const index = COERCIONS.indexOf(row);
          const open = revealed.includes(index);
          return (
            <Pressable
              key={row.expression}
              accessibilityRole="button"
              accessibilityLabel={`${row.expression}. ${open ? `Result ${row.result}. ${row.why}` : 'Tap to reveal the result'}`}
              onPress={() =>
                setRevealed((prev) =>
                  prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
                )
              }
              style={{
                borderWidth: 1,
                borderColor: open && row.surprising ? theme.colors.warning : theme.colors.border,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
                backgroundColor: theme.colors.surface,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="mono" mono>
                  {row.expression}
                </Text>
                <Text variant="mono" mono tone={open ? 'primary' : 'tertiary'}>
                  {open ? row.result : 'tap'}
                </Text>
              </View>
              {open ? (
                <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.xs }}>
                  {row.why}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <ActionRow
        actions={[
          { label: 'Reveal all', primary: true, onPress: () => setRevealed(COERCIONS.map((_, i) => i)) },
          { label: 'Hide all', onPress: () => setRevealed([]) },
        ]}
      />

      <Note>
        Guess before you tap. Every surprising row here has cost somebody a production incident,
        and every one of them is avoided by the same habit: use strict equality, and convert types
        deliberately rather than letting an operator do it for you.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Box model
// ---------------------------------------------------------------------------

export function BoxModel(): React.JSX.Element {
  const theme = useTheme();
  const [width, setWidth] = useState(160);
  const [padding, setPadding] = useState(16);
  const [border, setBorder] = useState(4);
  const [margin, setMargin] = useState(12);
  const [sizing, setSizing] = useState<'content-box' | 'border-box'>('content-box');

  const borderBox = sizing === 'border-box';
  const contentWidth = borderBox ? Math.max(0, width - 2 * padding - 2 * border) : width;
  const visualWidth = borderBox ? width : width + 2 * padding + 2 * border;
  const totalFootprint = visualWidth + 2 * margin;

  return (
    <View>
      <SegmentedControl
        label="box-sizing"
        options={['content-box', 'border-box'] as const}
        value={sizing}
        onChange={setSizing}
      />

      <Slider label="width" value={width} min={80} max={240} step={8} onChange={setWidth} format={(v) => `${v}px`} />
      <Slider label="padding" value={padding} min={0} max={40} step={4} onChange={setPadding} format={(v) => `${v}px`} />
      <Slider label="border" value={border} min={0} max={16} step={2} onChange={setBorder} format={(v) => `${v}px`} />
      <Slider label="margin" value={margin} min={0} max={40} step={4} onChange={setMargin} format={(v) => `${v}px`} />

      <View
        accessibilityLabel={`Content ${contentWidth} pixels, element ${visualWidth} pixels, total footprint ${totalFootprint} pixels`}
        style={{
          alignItems: 'center',
          paddingVertical: theme.spacing.lg,
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.warningSubtle,
            padding: margin,
            borderRadius: theme.radii.sm,
          }}
        >
          <View
            style={{
              borderWidth: border,
              borderColor: theme.colors.primary,
              backgroundColor: theme.colors.infoSubtle,
              padding: padding,
              borderRadius: theme.radii.sm,
            }}
          >
            <View
              style={{
                width: Math.max(8, contentWidth),
                height: 44,
                backgroundColor: theme.colors.primarySubtle,
                borderRadius: theme.radii.sm,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="caption" tone="primary">
                {contentWidth}px
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Readout
        items={[
          { label: 'Content', value: `${contentWidth}px` },
          { label: 'Element', value: `${visualWidth}px`, color: theme.colors.primary },
          { label: 'With margin', value: `${totalFootprint}px` },
        ]}
      />

      <Note>
        {borderBox
          ? 'With border-box, width means the whole element: padding and border eat into the content rather than adding to the outside. The number you set is the number you get, which is why almost every codebase sets this globally.'
          : 'With the default content-box, width means the content only — padding and border are added on top, so the element is wider than the number you wrote. Margin sits outside the element entirely and is never part of its width.'}
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Event loop
// ---------------------------------------------------------------------------

interface LoopItem {
  id: number;
  label: string;
  queue: 'sync' | 'micro' | 'macro';
}

const LOOP_SCRIPT: LoopItem[] = [
  { id: 1, label: 'console.log("A")', queue: 'sync' },
  { id: 2, label: 'setTimeout(B, 0)', queue: 'sync' },
  { id: 3, label: 'Promise.then(C)', queue: 'sync' },
  { id: 4, label: 'console.log("D")', queue: 'sync' },
];

export function EventLoop(): React.JSX.Element {
  const theme = useTheme();
  const [step, setStep] = useState(0);

  // Each step is a snapshot of the three queues plus what was just logged.
  const frames = useMemo(
    () => [
      { stack: ['script'], micro: [] as string[], macro: [] as string[], out: [] as string[], note: 'The script itself is the first task. Nothing else can run until it finishes.' },
      { stack: ['script', 'log A'], micro: [], macro: [], out: ['A'], note: 'Synchronous code runs immediately.' },
      { stack: ['script'], micro: [], macro: ['B'], out: ['A'], note: 'setTimeout does not run B — it queues it as a macrotask, even with a delay of 0.' },
      { stack: ['script'], micro: ['C'], macro: ['B'], out: ['A'], note: 'The promise callback goes to the microtask queue, which is a separate, higher-priority queue.' },
      { stack: ['script', 'log D'], micro: ['C'], macro: ['B'], out: ['A', 'D'], note: 'Still synchronous. D prints before anything queued.' },
      { stack: [], micro: ['C'], macro: ['B'], out: ['A', 'D'], note: 'The task is finished. Now — and only now — the loop looks at the queues.' },
      { stack: ['C'], micro: [], macro: ['B'], out: ['A', 'D', 'C'], note: 'Microtasks drain FIRST, and completely. C runs.' },
      { stack: [], micro: [], macro: ['B'], out: ['A', 'D', 'C'], note: 'Microtask queue empty. The browser may render here.' },
      { stack: ['B'], micro: [], macro: [], out: ['A', 'D', 'C', 'B'], note: 'Only now does the first macrotask run. B was queued second and runs last.' },
    ],
    [],
  );

  const frame = frames[Math.min(step, frames.length - 1)];

  const Queue = ({ title, items, color }: { title: string; items: string[]; color: string }): React.JSX.Element => (
    <View style={{ flex: 1 }}>
      <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.xs }}>
        {title}
      </Text>
      <View
        style={{
          minHeight: 72,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.sm,
          padding: theme.spacing.xs,
          gap: theme.spacing.xxs,
        }}
      >
        {items.length === 0 ? (
          <Text variant="caption" tone="tertiary">
            empty
          </Text>
        ) : (
          items.map((item) => (
            <View
              key={item}
              style={{
                backgroundColor: color,
                borderRadius: theme.radii.sm,
                paddingHorizontal: theme.spacing.xs,
                paddingVertical: 2,
              }}
            >
              <Text variant="mono" mono>
                {item}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );

  return (
    <View>
      <View
        style={{
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
        }}
      >
        {LOOP_SCRIPT.map((line) => (
          <Text key={line.id} variant="mono" mono tone="secondary">
            {line.label};
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Queue title="Call stack" items={frame?.stack ?? []} color={theme.colors.primarySubtle} />
        <Queue title="Microtasks" items={frame?.micro ?? []} color={theme.colors.successSubtle} />
        <Queue title="Macrotasks" items={frame?.macro ?? []} color={theme.colors.warningSubtle} />
      </View>

      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Output so far: ${(frame?.out ?? []).join(', ') || 'nothing'}. ${frame?.note ?? ''}`}
        style={{ marginTop: theme.spacing.md }}
      >
        <Text variant="label" tone="tertiary" caps>
          Output
        </Text>
        <Text variant="mono" mono tone="primary">
          {(frame?.out ?? []).join(' ') || '—'}
        </Text>
        <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.sm }}>
          {frame?.note ?? ''}
        </Text>
      </View>

      <ActionRow
        actions={[
          {
            label: 'Step',
            primary: true,
            disabled: step >= frames.length - 1,
            onPress: () => setStep((s) => Math.min(frames.length - 1, s + 1)),
          },
          { label: 'Reset', onPress: () => setStep(0) },
        ]}
      />

      <Note>
        The final order is A D C B — not the order the lines were written. Synchronous code first,
        then every microtask, then one macrotask. A `setTimeout` of 0 means "after everything
        currently pending", which is a much longer wait than it looks.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cloud cost
// ---------------------------------------------------------------------------

export function CloudCost(): React.JSX.Element {
  const theme = useTheme();
  const [instances, setInstances] = useState(6);
  const [utilisation, setUtilisation] = useState(30);
  const [egressTb, setEgressTb] = useState(2);
  const [storageTb, setStorageTb] = useState(4);
  const [kind, setKind] = useState<'CPU' | 'GPU'>('CPU');

  // Deliberately round numbers, roughly in line with public list prices.
  const hourly = kind === 'GPU' ? 3.2 : 0.16;
  const compute = instances * hourly * 730;
  const egress = egressTb * 1024 * 0.09;
  const storage = storageTb * 1024 * 0.023;
  const total = compute + egress + storage;
  const wasted = compute * (1 - utilisation / 100);

  const money = (n: number): string =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  const rows = [
    { label: 'Compute', value: compute, color: theme.colors.primary },
    { label: 'Egress', value: egress, color: theme.colors.warning },
    { label: 'Storage', value: storage, color: theme.colors.info },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <View>
      <SegmentedControl
        label="Instance type"
        options={['CPU', 'GPU'] as const}
        value={kind}
        onChange={setKind}
      />
      <Slider label="Instances" value={instances} min={1} max={40} step={1} onChange={setInstances} />
      <Slider label="Utilisation" value={utilisation} min={5} max={100} step={5} onChange={setUtilisation} format={(v) => `${v}%`} />
      <Slider label="Egress" value={egressTb} min={0} max={50} step={1} onChange={setEgressTb} format={(v) => `${v} TB`} />
      <Slider label="Storage" value={storageTb} min={0} max={100} step={1} onChange={setStorageTb} format={(v) => `${v} TB`} />

      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Monthly total ${money(total)}, of which ${money(wasted)} is idle capacity`}
        style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}
      >
        {rows.map((row) => (
          <View key={row.label}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" tone="secondary">
                {row.label}
              </Text>
              <Text variant="mono" mono>
                {money(row.value)}
              </Text>
            </View>
            <Bar fraction={row.value / max} color={row.color} />
          </View>
        ))}
      </View>

      <Readout
        items={[
          { label: 'Monthly', value: money(total) },
          { label: 'Idle capacity', value: money(wasted), color: theme.colors.danger },
          { label: 'Per year', value: money(total * 12) },
        ]}
      />

      <Note>
        {utilisation < 40
          ? `At ${utilisation}% utilisation you are paying ${money(wasted)} a month for machines doing nothing. Raising utilisation is almost always a bigger lever than any per-unit discount — and for GPUs, a starved data loader is the usual cause.`
          : `At ${utilisation}% utilisation the compute is mostly earning its keep. Check egress next: cross-zone chatter between services is charged, and a talkative architecture can spend more on network than on machines.`}
      </Note>
    </View>
  );
}
