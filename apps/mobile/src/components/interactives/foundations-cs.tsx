/**
 * Widgets for the hardware, compilers, information theory and statistics tracks.
 *
 * Three of these exist because the concept is genuinely hard to hold in your
 * head from prose — a carry rippling through an adder, a Huffman tree
 * assembling from the bottom, a confidence interval missing one time in twenty.
 * The statistics pair in particular are built so the learner can *watch* a
 * false positive happen, which is more convincing than being told the rate.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, useTheme } from '@synapse/ui';

import { Slider } from '../Slider';
import { ActionRow, Bar, Note, Readout, SegmentedControl, makeRandom } from './shared';

// ---------------------------------------------------------------------------
// Logic gates
// ---------------------------------------------------------------------------

type GateName = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR';

const GATES: Record<GateName, (a: boolean, b: boolean) => boolean> = {
  AND: (a, b) => a && b,
  OR: (a, b) => a || b,
  XOR: (a, b) => a !== b,
  NAND: (a, b) => !(a && b),
  NOR: (a, b) => !(a || b),
};

const GATE_NOTES: Record<GateName, string> = {
  AND: 'Output is 1 only when both inputs are 1. This is the carry bit of a half adder.',
  OR: 'Output is 1 when at least one input is 1 — inclusive, unlike the English word.',
  XOR: 'Output is 1 when the inputs differ. This is addition without the carry, and it is also parity, which is why it turns up in error detection and in one-time pads.',
  NAND: 'AND inverted. Functionally complete on its own: tie both inputs together and it is NOT; follow it with that NOT and it is AND. Every other gate follows.',
  NOR: 'OR inverted, and also functionally complete. Two cross-coupled NOR gates form a latch — the first circuit in this catalog that can remember anything.',
};

export function LogicGates(): React.JSX.Element {
  const theme = useTheme();
  const [gate, setGate] = useState<GateName>('AND');
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);

  const fn = GATES[gate] ?? GATES.AND;
  const out = fn(a, b);

  const Toggle = ({
    label,
    value,
    onToggle,
  }: {
    label: string;
    value: boolean;
    onToggle: () => void;
  }): React.JSX.Element => (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      aria-checked={value}
      accessibilityLabel={`Input ${label}, currently ${value ? '1' : '0'}`}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radii.md,
        borderWidth: 2,
        borderColor: value ? theme.colors.primary : theme.colors.border,
        backgroundColor: value ? theme.colors.primarySubtle : theme.colors.surface,
      }}
    >
      <Text variant="label" tone="tertiary" caps>
        {label}
      </Text>
      <Text variant="title" tone={value ? 'primary' : 'tertiary'}>
        {value ? '1' : '0'}
      </Text>
    </Pressable>
  );

  return (
    <View>
      <SegmentedControl
        label="Gate"
        options={['AND', 'OR', 'XOR', 'NAND', 'NOR'] as const}
        value={gate}
        onChange={setGate}
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Toggle label="A" value={a} onToggle={() => setA((v) => !v)} />
        <Toggle label="B" value={b} onToggle={() => setB((v) => !v)} />
        <View
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Output ${out ? '1' : '0'}`}
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: theme.spacing.md,
            borderRadius: theme.radii.md,
            backgroundColor: out ? theme.colors.successSubtle : theme.colors.surfaceMuted,
          }}
        >
          <Text variant="label" tone="tertiary" caps>
            Out
          </Text>
          <Text variant="title" tone={out ? 'success' : 'tertiary'}>
            {out ? '1' : '0'}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.xs }}>
          Truth table
        </Text>
        {[
          [false, false],
          [false, true],
          [true, false],
          [true, true],
        ].map(([ra, rb]) => {
          const active = ra === a && rb === b;
          return (
            <View
              key={`${String(ra)}${String(rb)}`}
              style={{
                flexDirection: 'row',
                paddingVertical: theme.spacing.xs,
                paddingHorizontal: theme.spacing.sm,
                borderRadius: theme.radii.sm,
                backgroundColor: active ? theme.colors.primarySubtle : 'transparent',
              }}
            >
              <Text variant="mono" mono tone="secondary" style={{ flex: 1 }}>
                {ra ? 1 : 0}
              </Text>
              <Text variant="mono" mono tone="secondary" style={{ flex: 1 }}>
                {rb ? 1 : 0}
              </Text>
              <Text variant="mono" mono tone={fn(ra ?? false, rb ?? false) ? 'success' : 'tertiary'} style={{ flex: 1 }}>
                {fn(ra ?? false, rb ?? false) ? 1 : 0}
              </Text>
            </View>
          );
        })}
      </View>

      <Note>{GATE_NOTES[gate] ?? ''}</Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Binary adder
// ---------------------------------------------------------------------------

const WIDTH = 4;

const toBits = (n: number): number[] =>
  Array.from({ length: WIDTH }, (_, i) => (n >> (WIDTH - 1 - i)) & 1);

export function BinaryAdder(): React.JSX.Element {
  const theme = useTheme();
  const [a, setA] = useState(11);
  const [b, setB] = useState(7);
  const [stage, setStage] = useState(WIDTH);

  const bitsA = toBits(a);
  const bitsB = toBits(b);

  // Compute column by column from the right, exactly as the hardware does.
  const columns = useMemo(() => {
    const out: Array<{ sum: number; carryIn: number; carryOut: number }> = [];
    let carry = 0;
    for (let i = WIDTH - 1; i >= 0; i--) {
      const x = bitsA[i] ?? 0;
      const y = bitsB[i] ?? 0;
      const total = x + y + carry;
      out.unshift({ sum: total % 2, carryIn: carry, carryOut: total > 1 ? 1 : 0 });
      carry = total > 1 ? 1 : 0;
    }
    return { columns: out, finalCarry: carry };
  }, [bitsA, bitsB]);

  // How many columns from the right have been computed.
  const settled = stage;
  const sumBits = columns.columns.map((c, i) => (WIDTH - i <= settled ? c.sum : null));

  const Row = ({ label, bits, tone }: { label: string; bits: Array<number | null>; tone: 'default' | 'primary' }): React.JSX.Element => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <Text variant="label" tone="tertiary" caps style={{ width: 44 }}>
        {label}
      </Text>
      {bits.map((bit, i) => (
        <View
          key={i}
          style={{
            width: 34,
            height: 34,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radii.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: bit === null ? theme.colors.surfaceMuted : theme.colors.surface,
          }}
        >
          <Text variant="mono" mono tone={bit === null ? 'tertiary' : tone}>
            {bit === null ? '·' : bit}
          </Text>
        </View>
      ))}
    </View>
  );

  const result = settled >= WIDTH ? a + b : null;

  return (
    <View>
      <Slider label="A" value={a} min={0} max={15} step={1} onChange={(v) => { setA(v); setStage(0); }} />
      <Slider label="B" value={b} min={0} max={15} step={1} onChange={(v) => { setB(v); setStage(0); }} />

      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={
          result === null
            ? `${settled} of ${WIDTH} columns settled`
            : `${a} plus ${b} equals ${a + b}`
        }
        style={{ gap: theme.spacing.xs, marginTop: theme.spacing.md }}
      >
        <Row label="A" bits={bitsA} tone="default" />
        <Row label="B" bits={bitsB} tone="default" />
        <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.xs }} />
        <Row label="Sum" bits={sumBits} tone="primary" />
        <Row
          label="Carry"
          bits={columns.columns.map((c, i) => (WIDTH - i <= settled ? c.carryOut : null))}
          tone="default"
        />
      </View>

      <Readout
        items={[
          { label: 'Columns settled', value: `${settled} / ${WIDTH}` },
          { label: 'Decimal', value: result === null ? '—' : String(result) },
          {
            label: 'Overflow',
            value: columns.finalCarry && settled >= WIDTH ? 'yes' : 'no',
            color: columns.finalCarry && settled >= WIDTH ? theme.colors.danger : undefined,
          },
        ]}
      />

      <ActionRow
        actions={[
          {
            label: 'Ripple one column',
            primary: true,
            disabled: settled >= WIDTH,
            onPress: () => setStage((s) => Math.min(WIDTH, s + 1)),
          },
          { label: 'Reset', onPress: () => setStage(0) },
        ]}
      />

      <Note>
        {columns.finalCarry && settled >= WIDTH
          ? `The result needed ${WIDTH + 1} bits and only ${WIDTH} are available, so the carry out of the top column is discarded — this is exactly the integer overflow from the architecture track, happening in front of you.`
          : 'Each column cannot settle until the carry from the column to its right arrives. That serial dependency is why a 64-bit ripple-carry adder waits for 64 stages, and why real processors compute the carries in parallel instead.'}
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

const KEYWORDS = new Set(['let', 'const', 'if', 'else', 'return', 'function', 'for', 'while']);

interface Token {
  text: string;
  kind: 'keyword' | 'identifier' | 'number' | 'operator' | 'punctuation' | 'string' | 'comment' | 'whitespace';
}

/** A deliberately small lexer — the point is that it is readable in full. */
function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i] ?? '';
    if (/\s/.test(ch)) {
      let j = i;
      while (j < source.length && /\s/.test(source[j] ?? '')) j++;
      tokens.push({ text: source.slice(i, j), kind: 'whitespace' });
      i = j;
    } else if (source.startsWith('//', i)) {
      tokens.push({ text: source.slice(i), kind: 'comment' });
      i = source.length;
    } else if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== ch) j++;
      tokens.push({ text: source.slice(i, j + 1), kind: 'string' });
      i = j + 1;
    } else if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < source.length && /[0-9.]/.test(source[j] ?? '')) j++;
      tokens.push({ text: source.slice(i, j), kind: 'number' });
      i = j;
    } else if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < source.length && /[A-Za-z0-9_$]/.test(source[j] ?? '')) j++;
      const text = source.slice(i, j);
      tokens.push({ text, kind: KEYWORDS.has(text) ? 'keyword' : 'identifier' });
      i = j;
    } else if (/[+\-*/=<>!&|%]/.test(ch)) {
      let j = i;
      while (j < source.length && /[+\-*/=<>!&|%]/.test(source[j] ?? '')) j++;
      tokens.push({ text: source.slice(i, j), kind: 'operator' });
      i = j;
    } else {
      tokens.push({ text: ch, kind: 'punctuation' });
      i += 1;
    }
  }
  return tokens;
}

const SAMPLES = [
  'let total = price * 2;',
  'if (n >= 10) { return "big"; }',
  'const rate = 0.075; // VAT',
];

export function LexerTokens(): React.JSX.Element {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [keepTrivia, setKeepTrivia] = useState<'Discarded' | 'Shown'>('Discarded');

  const source = SAMPLES[index] ?? SAMPLES[0] ?? '';
  const all = useMemo(() => lex(source), [source]);
  const tokens =
    keepTrivia === 'Shown'
      ? all
      : all.filter((t) => t.kind !== 'whitespace' && t.kind !== 'comment');

  const colours: Record<Token['kind'], string> = {
    keyword: theme.colors.primary,
    identifier: theme.colors.text,
    number: theme.colors.info,
    operator: theme.colors.warning,
    punctuation: theme.colors.textTertiary,
    string: theme.colors.success,
    comment: theme.colors.textTertiary,
    whitespace: theme.colors.textTertiary,
  };

  return (
    <View>
      <SegmentedControl
        label="Whitespace and comments"
        options={['Discarded', 'Shown'] as const}
        value={keepTrivia}
        onChange={setKeepTrivia}
      />

      <View
        style={{
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
        }}
      >
        <Text variant="mono" mono>
          {source}
        </Text>
      </View>

      <Text variant="label" tone="tertiary" caps style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
        {tokens.length} tokens
      </Text>

      <View
        accessibilityLabel={`Tokens: ${tokens.map((t) => `${t.kind} ${t.text.trim() || 'whitespace'}`).join(', ')}`}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}
      >
        {tokens.map((token, i) => (
          <View
            key={i}
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.sm,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: theme.spacing.xxs,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Text variant="mono" mono style={{ color: colours[token.kind] }}>
              {token.text.trim() || '␣'}
            </Text>
            <Text variant="label" tone="tertiary" caps>
              {token.kind}
            </Text>
          </View>
        ))}
      </View>

      <ActionRow
        actions={[
          {
            label: 'Next example',
            primary: true,
            onPress: () => setIndex((i) => (i + 1) % SAMPLES.length),
          },
        ]}
      />

      <Note>
        Switch trivia on and off. Whitespace and comments carry no meaning for the parser, so the
        lexer drops them — which is also why reformatting code cannot change what it does, and why
        a language with significant indentation has to emit indent tokens instead.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// AST explorer
// ---------------------------------------------------------------------------

interface AstNode {
  label: string;
  value?: number;
  left?: AstNode;
  right?: AstNode;
}

const AST_EXAMPLES: Array<{ expression: string; tree: AstNode; note: string }> = [
  {
    expression: '2 + 3 * 4',
    tree: {
      label: '+',
      left: { label: '2', value: 2 },
      right: { label: '*', left: { label: '3', value: 3 }, right: { label: '4', value: 4 } },
    },
    note: 'Multiplication sits lower in the tree because the grammar puts `term` below `expr`. Evaluating bottom-up gives 14 with no precedence rules consulted — the shape already decided it.',
  },
  {
    expression: '(2 + 3) * 4',
    tree: {
      label: '*',
      left: { label: '+', left: { label: '2', value: 2 }, right: { label: '3', value: 3 } },
      right: { label: '4', value: 4 },
    },
    note: 'The parentheses changed the shape, not the evaluation rules. They appear nowhere in the tree — their entire job was done during parsing.',
  },
  {
    expression: '10 - 4 - 3',
    tree: {
      label: '-',
      left: { label: '-', left: { label: '10', value: 10 }, right: { label: '4', value: 4 } },
      right: { label: '3', value: 3 },
    },
    note: 'Subtraction is left-associative, so it nests to the left: (10 − 4) − 3 = 3, not 10 − (4 − 3) = 9. Associativity is encoded in the grammar exactly as precedence is.',
  },
];

function evaluate(node: AstNode): number {
  if (node.value !== undefined) return node.value;
  const l = node.left ? evaluate(node.left) : 0;
  const r = node.right ? evaluate(node.right) : 0;
  switch (node.label) {
    case '+':
      return l + r;
    case '-':
      return l - r;
    case '*':
      return l * r;
    default:
      return 0;
  }
}

export function AstExplorer(): React.JSX.Element {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const example = AST_EXAMPLES[index] ?? AST_EXAMPLES[0];
  if (!example) return <View />;

  const renderNode = (node: AstNode, depth: number): React.JSX.Element => {
    const isLeaf = node.value !== undefined;
    return (
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.radii.pill,
            backgroundColor: isLeaf ? theme.colors.surfaceMuted : theme.colors.primarySubtle,
            borderWidth: 1,
            borderColor: isLeaf ? theme.colors.border : theme.colors.primary,
          }}
        >
          <Text variant="mono" mono tone={isLeaf ? 'secondary' : 'primary'}>
            {node.label}
            {revealed && !isLeaf ? ` = ${evaluate(node)}` : ''}
          </Text>
        </View>
        {node.left || node.right ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
            {node.left ? renderNode(node.left, depth + 1) : null}
            {node.right ? renderNode(node.right, depth + 1) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View>
      <View
        style={{
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          alignItems: 'center',
        }}
      >
        <Text variant="mono" mono>
          {example.expression}
        </Text>
      </View>

      <View
        accessibilityLabel={`Syntax tree for ${example.expression}${revealed ? `, evaluating to ${evaluate(example.tree)}` : ''}`}
        style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}
      >
        {renderNode(example.tree, 0)}
      </View>

      <ActionRow
        actions={[
          {
            label: revealed ? 'Hide values' : 'Evaluate bottom-up',
            primary: true,
            onPress: () => setRevealed((r) => !r),
          },
          {
            label: 'Next',
            onPress: () => {
              setIndex((i) => (i + 1) % AST_EXAMPLES.length);
              setRevealed(false);
            },
          },
        ]}
      />

      <Note>{example.note}</Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Garbage collector
// ---------------------------------------------------------------------------

interface HeapObject {
  id: string;
  refs: string[];
  rooted: boolean;
}

const INITIAL_HEAP: HeapObject[] = [
  { id: 'A', refs: ['B'], rooted: true },
  { id: 'B', refs: [], rooted: false },
  { id: 'C', refs: ['D'], rooted: false },
  { id: 'D', refs: ['C'], rooted: false },
  { id: 'E', refs: [], rooted: false },
];

export function GcSimulator(): React.JSX.Element {
  const theme = useTheme();
  const [heap, setHeap] = useState<HeapObject[]>(INITIAL_HEAP);
  const [strategy, setStrategy] = useState<'Tracing' | 'Reference counting'>('Tracing');
  const [collected, setCollected] = useState<string[] | null>(null);

  const reachable = useMemo(() => {
    const seen = new Set<string>();
    const walk = (id: string): void => {
      if (seen.has(id)) return;
      seen.add(id);
      const obj = heap.find((o) => o.id === id);
      for (const ref of obj?.refs ?? []) walk(ref);
    };
    for (const obj of heap) if (obj.rooted) walk(obj.id);
    return seen;
  }, [heap]);

  const refCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const obj of heap) counts.set(obj.id, obj.rooted ? 1 : 0);
    for (const obj of heap) {
      for (const ref of obj.refs) counts.set(ref, (counts.get(ref) ?? 0) + 1);
    }
    return counts;
  }, [heap]);

  const collect = (): void => {
    const doomed =
      strategy === 'Tracing'
        ? heap.filter((o) => !reachable.has(o.id)).map((o) => o.id)
        : heap.filter((o) => (refCounts.get(o.id) ?? 0) === 0).map((o) => o.id);
    setCollected(doomed);
    setHeap((h) =>
      h
        .filter((o) => !doomed.includes(o.id))
        .map((o) => ({ ...o, refs: o.refs.filter((r) => !doomed.includes(r)) })),
    );
  };

  const cut = (id: string): void => {
    setHeap((h) => h.map((o) => (o.id === id ? { ...o, rooted: false, refs: [] } : o)));
    setCollected(null);
  };

  return (
    <View>
      <SegmentedControl
        label="Strategy"
        options={['Tracing', 'Reference counting'] as const}
        value={strategy}
        onChange={(v) => {
          setStrategy(v);
          setCollected(null);
        }}
      />

      <View style={{ gap: theme.spacing.xs }}>
        {heap.map((obj) => {
          const live = strategy === 'Tracing' ? reachable.has(obj.id) : (refCounts.get(obj.id) ?? 0) > 0;
          return (
            <Pressable
              key={obj.id}
              onPress={() => cut(obj.id)}
              accessibilityRole="button"
              accessibilityLabel={`Object ${obj.id}, ${live ? 'live' : 'garbage'}, references ${obj.refs.join(' and ') || 'nothing'}. Tap to drop its references.`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                borderWidth: 1,
                borderColor: live ? theme.colors.border : theme.colors.danger,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
                backgroundColor: live ? theme.colors.surface : theme.colors.dangerSubtle,
              }}
            >
              <Text variant="bodyStrong" tone={obj.rooted ? 'primary' : 'default'}>
                {obj.id}
              </Text>
              <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
                {obj.rooted ? 'root · ' : ''}
                {obj.refs.length ? `→ ${obj.refs.join(', ')}` : 'no references out'}
              </Text>
              <Text variant="mono" mono tone={live ? 'success' : 'danger'}>
                {strategy === 'Tracing' ? (live ? 'reachable' : 'garbage') : `rc=${refCounts.get(obj.id) ?? 0}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ActionRow
        actions={[
          { label: 'Collect', primary: true, onPress: collect },
          {
            label: 'Reset',
            onPress: () => {
              setHeap(INITIAL_HEAP);
              setCollected(null);
            },
          },
        ]}
      />

      {collected ? (
        <Readout
          items={[
            { label: 'Collected', value: collected.length ? collected.join(', ') : 'nothing' },
            { label: 'Remaining', value: String(heap.length) },
          ]}
        />
      ) : null}

      <Note>
        C and D refer to each other and nothing refers to them. Tracing starts from the roots and
        never reaches them, so both are collected. Reference counting sees each with a count of 1 —
        from the other — and frees neither. That cycle is why Python ships a separate cycle
        collector alongside its reference counting.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Huffman tree
// ---------------------------------------------------------------------------

interface HuffNode {
  symbol?: string;
  weight: number;
  left?: HuffNode;
  right?: HuffNode;
}

function buildHuffman(weights: Array<{ symbol: string; weight: number }>): HuffNode | null {
  let nodes: HuffNode[] = weights
    .filter((w) => w.weight > 0)
    .map((w) => ({ symbol: w.symbol, weight: w.weight }));
  if (nodes.length === 0) return null;
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.weight - b.weight);
    const [x, y, ...rest] = nodes;
    if (!x || !y) break;
    nodes = [...rest, { weight: x.weight + y.weight, left: x, right: y }];
  }
  return nodes[0] ?? null;
}

function codesOf(node: HuffNode | null, prefix = ''): Record<string, string> {
  if (!node) return {};
  if (node.symbol !== undefined) return { [node.symbol]: prefix || '0' };
  return { ...codesOf(node.left ?? null, `${prefix}0`), ...codesOf(node.right ?? null, `${prefix}1`) };
}

export function HuffmanTree(): React.JSX.Element {
  const theme = useTheme();
  const [weights, setWeights] = useState([
    { symbol: 'A', weight: 50 },
    { symbol: 'B', weight: 25 },
    { symbol: 'C', weight: 13 },
    { symbol: 'D', weight: 12 },
  ]);

  const total = weights.reduce((s, w) => s + w.weight, 0) || 1;
  const tree = useMemo(() => buildHuffman(weights), [weights]);
  const codes = useMemo(() => codesOf(tree), [tree]);

  const entropy = weights.reduce((sum, w) => {
    const p = w.weight / total;
    return p > 0 ? sum - p * Math.log2(p) : sum;
  }, 0);

  const averageLength = weights.reduce((sum, w) => {
    const p = w.weight / total;
    return sum + p * (codes[w.symbol]?.length ?? 0);
  }, 0);

  const setWeight = (symbol: string, value: number): void =>
    setWeights((ws) => ws.map((w) => (w.symbol === symbol ? { ...w, weight: value } : w)));

  return (
    <View>
      {weights.map((w) => (
        <Slider
          key={w.symbol}
          label={`P(${w.symbol})`}
          value={w.weight}
          min={1}
          max={80}
          step={1}
          onChange={(v) => setWeight(w.symbol, v)}
          format={(v) => `${((v / total) * 100).toFixed(0)}%`}
        />
      ))}

      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Average code length ${averageLength.toFixed(2)} bits against an entropy of ${entropy.toFixed(2)} bits`}
        style={{ marginTop: theme.spacing.md, gap: theme.spacing.xs }}
      >
        {weights.map((w) => (
          <View key={w.symbol} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text variant="bodyStrong" style={{ width: 24 }}>
              {w.symbol}
            </Text>
            <View style={{ flex: 1 }}>
              <Bar fraction={w.weight / total} color={theme.colors.primary} />
            </View>
            <Text variant="mono" mono tone="primary" style={{ width: 64, textAlign: 'right' }}>
              {codes[w.symbol] ?? '—'}
            </Text>
          </View>
        ))}
      </View>

      <Readout
        items={[
          { label: 'Entropy', value: `${entropy.toFixed(2)} bits` },
          { label: 'Average code', value: `${averageLength.toFixed(2)} bits`, color: theme.colors.primary },
          { label: 'Overhead', value: `${(averageLength - entropy).toFixed(3)} bits` },
        ]}
      />

      <Note>
        {averageLength - entropy < 0.005
          ? 'The average code length has hit the entropy exactly. That happens when every probability is a power of one half, which is the only case where whole-bit codes can be perfect.'
          : 'The average code length sits above the entropy because Huffman must spend a whole number of bits per symbol. The gap is always under one bit, and arithmetic coding removes it entirely by encoding a whole message as a single number.'}
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// A/B test simulator
// ---------------------------------------------------------------------------

/** Normal approximation to a two-proportion z-test — enough for the teaching point. */
function twoProportionP(
  convA: number,
  nA: number,
  convB: number,
  nB: number,
): { p: number; lift: number } {
  const pA = convA / nA;
  const pB = convB / nB;
  const pooled = (convA + convB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  if (se === 0) return { p: 1, lift: 0 };
  const z = Math.abs(pB - pA) / se;
  // Two-sided p from a normal tail, via a standard logistic approximation.
  const p = 2 * (1 - 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z * z * z))));
  return { p: Math.max(0, Math.min(1, p)), lift: pB - pA };
}

export function AbTestSim(): React.JSX.Element {
  const theme = useTheme();
  const [trueLift, setTrueLift] = useState(0);
  const [perArm, setPerArm] = useState(2000);
  const [seed, setSeed] = useState(1);
  const [history, setHistory] = useState<Array<{ p: number; lift: number }>>([]);

  const run = useMemo(() => {
    const random = makeRandom(seed);
    const baseline = 0.1;
    let convA = 0;
    let convB = 0;
    for (let i = 0; i < perArm; i++) {
      if (random() < baseline) convA += 1;
      if (random() < baseline + trueLift / 100) convB += 1;
    }
    return twoProportionP(convA, perArm, convB, perArm);
  }, [perArm, seed, trueLift]);

  const significant = run.p < 0.05;
  const falsePositive = significant && trueLift === 0;
  const falseNegative = !significant && trueLift > 0;

  const rate = history.length
    ? history.filter((h) => h.p < 0.05).length / history.length
    : null;

  return (
    <View>
      <Slider
        label="True lift"
        value={trueLift}
        min={0}
        max={3}
        step={0.5}
        onChange={(v) => {
          setTrueLift(v);
          setHistory([]);
        }}
        format={(v) => (v === 0 ? 'none' : `+${v}pp`)}
      />
      <Slider
        label="Users per arm"
        value={perArm}
        min={200}
        max={20000}
        step={200}
        onChange={(v) => {
          setPerArm(v);
          setHistory([]);
        }}
      />

      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Observed lift ${(run.lift * 100).toFixed(2)} percentage points, p equals ${run.p.toFixed(3)}, ${significant ? 'significant' : 'not significant'}`}
        style={{
          marginTop: theme.spacing.md,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.md,
          borderWidth: 2,
          borderColor: falsePositive
            ? theme.colors.danger
            : significant
              ? theme.colors.success
              : theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Readout
          items={[
            { label: 'Observed lift', value: `${(run.lift * 100).toFixed(2)}pp` },
            { label: 'p-value', value: run.p.toFixed(3) },
            {
              label: 'Verdict',
              value: significant ? 'significant' : 'no effect',
              color: significant ? theme.colors.success : theme.colors.textTertiary,
            },
          ]}
        />
        {falsePositive ? (
          <Text variant="caption" style={{ color: theme.colors.danger, marginTop: theme.spacing.sm }}>
            False positive — the true lift is zero and this run crossed the line anyway.
          </Text>
        ) : null}
        {falseNegative ? (
          <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.sm }}>
            False negative — there is a real effect and this run missed it. That is what low power
            feels like from the inside.
          </Text>
        ) : null}
      </View>

      <ActionRow
        actions={[
          {
            label: 'Run again',
            primary: true,
            onPress: () => {
              setHistory((h) => [...h, run]);
              setSeed((s) => s + 1);
            },
          },
          { label: 'Reset', onPress: () => { setHistory([]); setSeed(1); } },
        ]}
      />

      {rate !== null ? (
        <Readout
          items={[
            { label: 'Runs', value: String(history.length) },
            {
              label: 'Reached significance',
              value: `${(rate * 100).toFixed(0)}%`,
              color: trueLift === 0 ? theme.colors.danger : theme.colors.success,
            },
          ]}
        />
      ) : null}

      <Note>
        {trueLift === 0
          ? 'With no true effect, roughly one run in twenty will still reach p < 0.05. Press "run again" a dozen times and watch it happen — that is the false positive rate you accepted when you chose a 5% threshold, and it is exactly why stopping at the first significant look is a problem.'
          : 'With a real effect, the fraction of runs reaching significance is your statistical power. Shrink the sample and watch it fall — and notice that the runs which do succeed report an inflated lift, which is the winner’s curse behind a great deal of failed replication.'}
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Confidence intervals
// ---------------------------------------------------------------------------

export function ConfidenceIntervalWidget(): React.JSX.Element {
  const theme = useTheme();
  const [sampleSize, setSampleSize] = useState(40);
  const [batch, setBatch] = useState(0);

  const TRUE_MEAN = 0.5;

  const intervals = useMemo(() => {
    const random = makeRandom(batch * 97 + 3);
    return Array.from({ length: 20 }, () => {
      let sum = 0;
      let sumSq = 0;
      for (let i = 0; i < sampleSize; i++) {
        // Sum of two uniforms — visibly non-normal, which is the point.
        const x = (random() + random()) / 2;
        sum += x;
        sumSq += x * x;
      }
      const mean = sum / sampleSize;
      const variance = Math.max(1e-9, sumSq / sampleSize - mean * mean);
      const se = Math.sqrt(variance / sampleSize);
      const half = 1.96 * se;
      return { mean, low: mean - half, high: mean + half, covers: mean - half <= TRUE_MEAN && TRUE_MEAN <= mean + half };
    });
  }, [batch, sampleSize]);

  const misses = intervals.filter((i) => !i.covers).length;

  return (
    <View>
      <Slider
        label="Sample size"
        value={sampleSize}
        min={10}
        max={400}
        step={10}
        onChange={setSampleSize}
      />

      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${misses} of 20 intervals miss the true value`}
        style={{ marginTop: theme.spacing.md, gap: 3 }}
      >
        {intervals.map((interval, i) => {
          const left = Math.max(0, Math.min(1, (interval.low - 0.2) / 0.6));
          const right = Math.max(0, Math.min(1, (interval.high - 0.2) / 0.6));
          return (
            <View key={i} style={{ height: 12, justifyContent: 'center' }}>
              <View
                style={{
                  position: 'absolute',
                  left: `${left * 100}%`,
                  width: `${Math.max(1, (right - left) * 100)}%`,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: interval.covers ? theme.colors.success : theme.colors.danger,
                }}
              />
            </View>
          );
        })}
        <View
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: theme.colors.text,
          }}
        />
      </View>

      <Readout
        items={[
          { label: 'Intervals', value: '20' },
          { label: 'Missing the truth', value: String(misses), color: misses > 0 ? theme.colors.danger : undefined },
          { label: 'Coverage', value: `${(((20 - misses) / 20) * 100).toFixed(0)}%` },
        ]}
      />

      <ActionRow
        actions={[
          { label: 'Draw 20 more', primary: true, onPress: () => setBatch((b) => b + 1) },
          { label: 'Reset', onPress: () => setBatch(0) },
        ]}
      />

      <Note>
        The vertical line is the true value. About one interval in twenty misses it — that is what
        "95% confidence" means, and it is a property of the procedure rather than of any one
        interval. Raise the sample size and the intervals narrow, but the miss rate stays at 5%:
        more data buys precision, not certainty.
      </Note>
    </View>
  );
}
