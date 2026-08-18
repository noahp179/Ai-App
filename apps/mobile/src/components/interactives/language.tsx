/**
 * Language-model widgets: decoding, retrieval, routing, and precision.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Badge, Text, useTheme } from '@synapse/ui';

import { Slider } from '../Slider.js';
import { ActionRow, Bar, Note, Readout, SegmentedControl, clamp01 } from './shared.js';

// ---------------------------------------------------------------------------
// beam-search
// ---------------------------------------------------------------------------

interface BeamNode {
  tokens: string[];
  logProb: number;
}

/** A tiny hand-built next-token distribution, keyed by the sequence so far. */
const NEXT: Record<string, Array<{ token: string; p: number }>> = {
  '': [
    { token: 'The', p: 0.55 },
    { token: 'A', p: 0.3 },
    { token: 'One', p: 0.15 },
  ],
  The: [
    { token: 'cat', p: 0.4 },
    { token: 'best', p: 0.35 },
    { token: 'end', p: 0.25 },
  ],
  A: [
    { token: 'good', p: 0.5 },
    { token: 'cat', p: 0.3 },
    { token: 'day', p: 0.2 },
  ],
  One: [
    { token: 'day', p: 0.6 },
    { token: 'more', p: 0.4 },
  ],
  'The cat': [
    { token: 'sat', p: 0.7 },
    { token: 'ran', p: 0.3 },
  ],
  'The best': [
    { token: 'thing', p: 0.55 },
    { token: 'day', p: 0.45 },
  ],
  'The end': [{ token: '.', p: 1.0 }],
  'A good': [
    { token: 'day', p: 0.8 },
    { token: 'idea', p: 0.2 },
  ],
  'A cat': [{ token: 'sat', p: 1.0 }],
  'A day': [{ token: 'passed', p: 1.0 }],
  'One day': [{ token: 'ended', p: 1.0 }],
  'One more': [{ token: 'time', p: 1.0 }],
};

function expand(node: BeamNode): BeamNode[] {
  const key = node.tokens.join(' ');
  const options = NEXT[key];
  if (!options) return [];
  return options.map((o) => ({
    tokens: [...node.tokens, o.token],
    logProb: node.logProb + Math.log(o.p),
  }));
}

export function BeamSearch(): React.JSX.Element {
  const theme = useTheme();
  const [beamWidth, setBeamWidth] = useState(3);

  const result = useMemo(() => {
    // Greedy: always take the single highest-probability continuation.
    let greedy: BeamNode = { tokens: [], logProb: 0 };
    for (let depth = 0; depth < 3; depth += 1) {
      const children = expand(greedy);
      if (children.length === 0) break;
      greedy = children.reduce((best, c) => (c.logProb > best.logProb ? c : best));
    }

    // Beam: keep the top-k partial sequences at every depth.
    let beams: BeamNode[] = [{ tokens: [], logProb: 0 }];
    const trace: BeamNode[][] = [];
    for (let depth = 0; depth < 3; depth += 1) {
      const children = beams.flatMap(expand);
      if (children.length === 0) break;
      beams = children.sort((a, b) => b.logProb - a.logProb).slice(0, beamWidth);
      trace.push(beams);
    }

    return { greedy, best: beams[0]!, trace };
  }, [beamWidth]);

  const better = result.best.logProb > result.greedy.logProb + 1e-9;

  return (
    <View>
      <Slider value={beamWidth} min={1} max={4} step={1} onChange={setBeamWidth} label="Beam width" format={(v) => v.toFixed(0)} />

      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
        {result.trace.map((level, depth) => (
          <View key={depth}>
            <Text variant="label" tone="tertiary" caps style={{ marginBottom: 4 }}>
              Step {depth + 1} — top {level.length} kept
            </Text>
            <View style={{ gap: 4 }}>
              {level.map((node, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: theme.spacing.sm,
                    borderRadius: theme.radii.sm,
                    backgroundColor: i === 0 ? theme.colors.primarySubtle : theme.colors.surfaceMuted,
                  }}
                >
                  <Text variant="caption" mono style={{ flex: 1 }}>
                    {node.tokens.join(' ')}
                  </Text>
                  <Text variant="label" mono tone="tertiary">
                    {node.logProb.toFixed(3)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
        <View style={{ padding: theme.spacing.md, borderRadius: theme.radii.md, backgroundColor: theme.colors.surfaceMuted }}>
          <Text variant="label" tone="tertiary" caps>Greedy</Text>
          <Text variant="caption" mono>{result.greedy.tokens.join(' ')}</Text>
          <Text variant="label" mono tone="tertiary">log P = {result.greedy.logProb.toFixed(3)}</Text>
        </View>
        <View
          style={{
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            backgroundColor: better ? theme.colors.successSubtle : theme.colors.surfaceMuted,
          }}
        >
          <Text variant="label" tone="tertiary" caps>Beam (width {beamWidth})</Text>
          <Text variant="caption" mono>{result.best.tokens.join(' ')}</Text>
          <Text variant="label" mono tone="tertiary">log P = {result.best.logProb.toFixed(3)}</Text>
        </View>
      </View>

      {better ? (
        <Badge label="Beam found a higher-probability sequence than greedy" tone="success" style={{ marginTop: theme.spacing.md }} />
      ) : null}

      <Note>
        Greedy commits to the best next token at every step and can be led into a dead end — a high-probability
        first word followed by only mediocre continuations. Beam keeps several partial sequences alive and
        scores whole sequences, so it can trade a slightly worse first token for a much better ending.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// rag-retrieval
// ---------------------------------------------------------------------------

const CHUNKS = [
  { text: 'Refunds are processed within 5 business days of approval.', terms: ['refund', 'process', 'days', 'business', 'approval'] },
  { text: 'To return an item, request an RMA number from support.', terms: ['return', 'item', 'rma', 'support', 'request'] },
  { text: 'Order ORD-4471 shipped on 12 March via express courier.', terms: ['order', 'ord-4471', 'shipped', 'march', 'courier'] },
  { text: 'Our warranty covers manufacturing defects for 24 months.', terms: ['warranty', 'defect', 'months', 'cover', 'manufacturing'] },
  { text: 'Express delivery arrives in 1–2 days for most postcodes.', terms: ['express', 'delivery', 'days', 'postcode', 'arrive'] },
];

export function RagRetrieval(): React.JSX.Element {
  const theme = useTheme();
  const [query, setQuery] = useState('how long until I get my money back');
  const [hybrid, setHybrid] = useState(false);

  const results = useMemo(() => {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

    return CHUNKS.map((chunk) => {
      // Semantic score: soft term overlap, standing in for embedding cosine.
      let semantic = 0;
      for (const qt of queryTerms) {
        for (const ct of chunk.terms) {
          if (ct === qt) semantic += 1;
          else if (ct.startsWith(qt.slice(0, 4)) && qt.length >= 4) semantic += 0.6;
        }
      }
      // A hand-tuned nudge so paraphrase behaves like real embeddings would.
      const paraphrase = /money|back|refund|reimburse/.test(query.toLowerCase()) ? (chunk.terms.includes('refund') ? 1.6 : 0) : 0;
      semantic = (semantic + paraphrase) / Math.max(1, queryTerms.length);

      // Keyword score: exact token match only, like BM25.
      const keyword =
        queryTerms.filter((qt) => chunk.text.toLowerCase().includes(qt)).length / Math.max(1, queryTerms.length);

      return {
        ...chunk,
        semantic: clamp01(semantic),
        keyword: clamp01(keyword),
        score: hybrid ? clamp01(0.6 * semantic + 0.4 * keyword) : clamp01(semantic),
      };
    }).sort((a, b) => b.score - a.score);
  }, [query, hybrid]);

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Ask a question…"
        placeholderTextColor={theme.colors.textTertiary}
        style={{
          padding: theme.spacing.md,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
          ...theme.typography.caption,
        }}
      />

      <SegmentedControl
        options={['Semantic only', 'Hybrid (semantic + keyword)'] as const}
        value={hybrid ? 'Hybrid (semantic + keyword)' : 'Semantic only'}
        onChange={(v) => setHybrid(v.startsWith('Hybrid'))}
      />

      <View style={{ gap: theme.spacing.sm }}>
        {results.map((chunk, rank) => (
          <View
            key={chunk.text}
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              backgroundColor: rank < 2 ? theme.colors.primarySubtle : theme.colors.surfaceMuted,
              borderWidth: rank < 2 ? 1 : 0,
              borderColor: theme.colors.primary,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text variant="label" tone={rank < 2 ? 'primary' : 'tertiary'} caps>
                {rank < 2 ? `Retrieved #${rank + 1}` : 'Not retrieved'}
              </Text>
              <Text variant="label" mono tone="tertiary">
                {chunk.score.toFixed(3)}
              </Text>
            </View>
            <Text variant="caption" tone="secondary">
              {chunk.text}
            </Text>
            <View style={{ marginTop: theme.spacing.sm }}>
              <Bar fraction={chunk.score} color={rank < 2 ? theme.colors.primary : theme.colors.textTertiary} height={5} />
            </View>
          </View>
        ))}
      </View>

      <ActionRow
        actions={[
          { label: 'Try "ORD-4471"', onPress: () => setQuery('ORD-4471') },
          { label: 'Try a paraphrase', onPress: () => setQuery('how long until I get my money back') },
        ]}
      />

      <Note>
        Search for "ORD-4471" with semantic only and watch it struggle — embeddings are weak on exact
        identifiers, product codes, and proper nouns. Switch to hybrid and the keyword component finds it
        instantly. This is why production RAG systems almost always combine the two.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// moe-router
// ---------------------------------------------------------------------------

export function MoeRouter(): React.JSX.Element {
  const theme = useTheme();
  const [expertsTotal, setExpertsTotal] = useState(8);
  const [topK, setTopK] = useState(2);
  const [balanced, setBalanced] = useState(true);

  const tokens = ['The', 'protein', 'folds', 'into', 'a', 'helix', 'structure', 'quickly'];

  const routing = useMemo(() => {
    return tokens.map((token, i) => {
      const chosen: number[] = [];
      for (let slot = 0; slot < topK; slot += 1) {
        // Balanced routing spreads tokens; collapsed routing funnels them.
        const expert = balanced
          ? (i * 3 + slot * 5) % expertsTotal
          : (slot + (i % 2 === 0 ? 0 : 1)) % expertsTotal;
        if (!chosen.includes(expert)) chosen.push(expert);
      }
      return { token, experts: chosen };
    });
  }, [tokens, expertsTotal, topK, balanced]);

  const load = useMemo(() => {
    const counts = Array.from({ length: expertsTotal }, () => 0);
    for (const r of routing) for (const e of r.experts) counts[e]! += 1;
    return counts;
  }, [routing, expertsTotal]);

  const maxLoad = Math.max(...load, 1);
  const idle = load.filter((c) => c === 0).length;

  const paramsPerExpert = 8;
  const totalParams = expertsTotal * paramsPerExpert;
  const activeParams = topK * paramsPerExpert;

  return (
    <View>
      <Slider value={expertsTotal} min={4} max={16} step={1} onChange={setExpertsTotal} label="Total experts" format={(v) => v.toFixed(0)} />
      <Slider value={topK} min={1} max={4} step={1} onChange={setTopK} label="Experts active per token (top-k)" format={(v) => v.toFixed(0)} color={theme.colors.info} />

      <SegmentedControl
        options={['Balanced router', 'Collapsed router'] as const}
        value={balanced ? 'Balanced router' : 'Collapsed router'}
        onChange={(v) => setBalanced(v === 'Balanced router')}
        label="Routing behaviour"
      />

      <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.xs }}>
        Token → experts
      </Text>
      <View style={{ gap: 4, marginBottom: theme.spacing.lg }}>
        {routing.map((r) => (
          <View key={r.token} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="caption" mono style={{ width: 82 }}>
              {r.token}
            </Text>
            <View style={{ flexDirection: 'row', gap: 3, flex: 1 }}>
              {Array.from({ length: expertsTotal }, (_, e) => (
                <View
                  key={e}
                  style={{
                    flex: 1,
                    height: 14,
                    borderRadius: 3,
                    backgroundColor: r.experts.includes(e) ? theme.colors.primary : theme.colors.surfaceMuted,
                  }}
                />
              ))}
            </View>
          </View>
        ))}
      </View>

      <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.xs }}>
        Expert load
      </Text>
      <View style={{ flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 50 }}>
        {load.map((count, e) => (
          <View
            key={e}
            style={{
              flex: 1,
              height: Math.max(3, (count / maxLoad) * 50),
              borderRadius: 3,
              backgroundColor: count === 0 ? theme.colors.danger : theme.colors.success,
            }}
          />
        ))}
      </View>

      <Readout
        items={[
          { label: 'Total params', value: `${totalParams}B` },
          { label: 'Active per token', value: `${activeParams}B`, color: theme.colors.success },
          { label: 'Compute saved', value: `${Math.round((1 - activeParams / totalParams) * 100)}%` },
          { label: 'Idle experts', value: String(idle), color: idle > 0 ? theme.colors.danger : theme.colors.textSecondary },
        ]}
      />

      {idle > 0 ? (
        <Badge label={`${idle} experts never activate — their parameters occupy memory and contribute nothing`} tone="danger" style={{ marginTop: theme.spacing.md }} />
      ) : null}

      <Note>
        Total parameters stay in memory regardless; only the active ones cost compute. Switch to the
        collapsed router and watch most experts go idle — the model is paying full memory for a fraction
        of the capacity. This is exactly why MoE training adds an explicit load-balancing loss.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// quantization
// ---------------------------------------------------------------------------

const PRECISIONS = ['FP32', 'FP16', 'INT8', 'INT4'] as const;
type Precision = (typeof PRECISIONS)[number];

const BITS: Record<Precision, number> = { FP32: 32, FP16: 16, INT8: 8, INT4: 4 };

export function Quantization(): React.JSX.Element {
  const theme = useTheme();
  const [precision, setPrecision] = useState<Precision>('FP16');
  const [paramsB, setParamsB] = useState(70);

  const bits = BITS[precision];
  const memoryGb = (paramsB * 1e9 * (bits / 8)) / 1e9;

  // Sample weights, and what they become after quantizing to `bits`.
  const weights = useMemo(() => [0.8123, -0.4567, 0.0891, -0.9234, 0.3456, -0.1122], []);
  const levels = Math.pow(2, bits - 1);
  const quantized = weights.map((w) => Math.round(w * levels) / levels);
  const meanError =
    weights.reduce((s, w, i) => s + Math.abs(w - quantized[i]!), 0) / weights.length;

  // Throughput is roughly bandwidth-bound, so it scales inversely with bytes.
  const relativeThroughput = 32 / bits;
  const qualityLoss = bits >= 16 ? 0 : bits === 8 ? 0.3 : 1.8;

  return (
    <View>
      <SegmentedControl options={PRECISIONS} value={precision} onChange={setPrecision} label="Weight precision" />
      <Slider value={paramsB} min={1} max={200} step={1} onChange={setParamsB} label="Model size (billions of parameters)" format={(v) => `${v.toFixed(0)}B`} />

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        {weights.map((w, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text variant="label" mono tone="tertiary" style={{ width: 62 }}>
              {w.toFixed(4)}
            </Text>
            <Text variant="label" tone="tertiary">→</Text>
            <Text variant="label" mono style={{ width: 62, color: theme.colors.primary }}>
              {quantized[i]!.toFixed(4)}
            </Text>
            <View style={{ flex: 1 }}>
              <Bar fraction={Math.abs(w - quantized[i]!) * 20} color={theme.colors.warning} height={5} />
            </View>
          </View>
        ))}
      </View>

      <Readout
        items={[
          { label: 'Memory', value: `${memoryGb.toFixed(1)} GB`, color: memoryGb > 80 ? theme.colors.danger : theme.colors.success },
          { label: 'Throughput', value: `${relativeThroughput.toFixed(1)}×`, color: theme.colors.success },
          { label: 'Mean weight error', value: meanError.toFixed(5), color: theme.colors.warning },
          { label: 'Quality cost', value: `~${qualityLoss.toFixed(1)}%`, color: qualityLoss > 1 ? theme.colors.warning : theme.colors.success },
        ]}
      />

      {memoryGb > 80 ? (
        <Badge label="Exceeds a single 80GB GPU — needs multi-GPU sharding or lower precision" tone="danger" style={{ marginTop: theme.spacing.md }} />
      ) : null}

      <Note>
        Generating a token requires reading every weight, so at low batch sizes inference is
        memory-bandwidth bound rather than compute bound. Halving the bytes per weight nearly halves the
        time per token — the speedup is a bandwidth effect, not an arithmetic one.
      </Note>
    </View>
  );
}
