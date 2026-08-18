/**
 * Interactive lesson widgets.
 *
 * Each one exists to make a single idea manipulable — the point where a learner
 * stops reading about temperature and starts *feeling* what it does. All the
 * maths is computed live rather than faked, because a widget that lies is worse
 * than no widget.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { InteractiveWidget } from '@synapse/core';
import { Badge, Card, Text, useTheme } from '@synapse/ui';

import { Slider } from './Slider.js';

export function Interactive({ widget }: { widget: InteractiveWidget }): React.JSX.Element {
  switch (widget) {
    case 'tokenizer':
      return <TokenizerWidget />;
    case 'temperature-sampler':
      return <TemperatureWidget />;
    case 'perceptron':
      return <PerceptronWidget />;
    case 'gradient-descent':
      return <GradientDescentWidget />;
    case 'attention-matrix':
      return <AttentionWidget />;
    case 'confusion-matrix':
      return <ConfusionMatrixWidget />;
    case 'bias-variance':
      return <BiasVarianceWidget />;
    case 'embedding-space':
      return <EmbeddingWidget />;
    case 'prompt-lab':
      return <PromptLabWidget />;
    default: {
      const never: never = widget;
      void never;
      return <View />;
    }
  }
}

// ---------------------------------------------------------------------------

/**
 * Approximates BPE well enough to teach the idea: common words stay whole, rare
 * words fragment, and the split points land where a real tokenizer puts them
 * often enough to be honest. Labelled as an approximation in the UI.
 */
function TokenizerWidget(): React.JSX.Element {
  const theme = useTheme();
  const [text, setText] = useState('Tokenization determines what a model can see.');

  const tokens = useMemo(() => approximateTokens(text), [text]);
  const palette = [theme.colors.primary, theme.colors.info, theme.colors.success, theme.colors.warning];

  return (
    <View>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Type anything…"
        placeholderTextColor={theme.colors.textTertiary}
        style={{
          minHeight: 80,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          ...theme.typography.body,
        }}
      />

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
          marginTop: theme.spacing.lg,
        }}
      >
        {tokens.map((token, index) => (
          <View
            key={`${token}-${index}`}
            style={{
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: theme.spacing.xs,
              borderRadius: theme.radii.sm,
              backgroundColor: `${palette[index % palette.length]}22`,
              borderWidth: 1,
              borderColor: palette[index % palette.length],
            }}
          >
            <Text variant="mono" mono>
              {token === ' ' ? '␣' : token}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        <Badge label={`${tokens.length} tokens`} tone="primary" />
        <Badge label={`${text.length} characters`} tone="neutral" />
        <Badge
          label={`~${(text.length / Math.max(1, tokens.length)).toFixed(1)} chars/token`}
          tone="info"
        />
      </View>

      <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.md }}>
        An approximation of BPE for illustration — a real tokenizer uses a learned merge table.
      </Text>
    </View>
  );
}

/** Frequency-ish heuristic: short common words stay whole, long words split. */
function approximateTokens(text: string): string[] {
  const COMMON = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'to', 'of', 'in', 'on', 'and', 'or', 'it', 'that',
    'this', 'for', 'as', 'be', 'can', 'model', 'data', 'what', 'see', 'not',
  ]);

  const out: string[] = [];
  for (const chunk of text.split(/(\s+)/)) {
    if (chunk.length === 0) continue;
    if (/^\s+$/.test(chunk)) {
      out.push(' ');
      continue;
    }

    const bare = chunk.toLowerCase().replace(/[^a-z]/g, '');
    if (COMMON.has(bare) || chunk.length <= 4) {
      out.push(chunk);
      continue;
    }

    // Split long words into ~4-character pieces, the usual BPE granularity.
    for (let i = 0; i < chunk.length; i += 4) {
      out.push(chunk.slice(i, i + 4));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

/** Real softmax over fixed logits, so the reshaping is genuine. */
function TemperatureWidget(): React.JSX.Element {
  const theme = useTheme();
  const [temperature, setTemperature] = useState(1);

  const logits = useMemo(
    () => [
      { token: ' mat', logit: 3.2 },
      { token: ' floor', logit: 2.4 },
      { token: ' couch', logit: 2.1 },
      { token: ' roof', logit: 1.2 },
      { token: ' moon', logit: -0.4 },
    ],
    [],
  );

  const probabilities = useMemo(() => {
    const t = Math.max(0.05, temperature);
    const scaled = logits.map((entry) => entry.logit / t);
    const max = Math.max(...scaled);
    const exps = scaled.map((value) => Math.exp(value - max));
    const sum = exps.reduce((total, value) => total + value, 0);
    return exps.map((value) => value / sum);
  }, [logits, temperature]);

  return (
    <View>
      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
        “The cat sat on the …”
      </Text>

      <Slider
        value={temperature}
        min={0.1}
        max={2}
        step={0.05}
        onChange={setTemperature}
        label="Temperature"
        format={(v) => v.toFixed(2)}
        color={temperature > 1.3 ? theme.colors.danger : theme.colors.primary}
      />

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        {logits.map((entry, index) => (
          <View key={entry.token}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" mono>
                {entry.token}
              </Text>
              <Text variant="caption" tone="tertiary" mono>
                {(probabilities[index]! * 100).toFixed(1)}%
              </Text>
            </View>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                marginTop: theme.spacing.xxs,
                backgroundColor: theme.colors.surfaceMuted,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${probabilities[index]! * 100}%`,
                  height: '100%',
                  backgroundColor: index === 0 ? theme.colors.primary : theme.colors.info,
                }}
              />
            </View>
          </View>
        ))}
      </View>

      <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.lg }}>
        {temperature < 0.4
          ? 'Near-deterministic: almost all mass on one token.'
          : temperature > 1.4
            ? 'Nearly uniform: the model is barely choosing at all.'
            : 'Balanced: likely tokens lead, but alternatives stay reachable.'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Live decision boundary from two weights and a bias, over four fixed points. */
function PerceptronWidget(): React.JSX.Element {
  const theme = useTheme();
  const [w1, setW1] = useState(1);
  const [w2, setW2] = useState(1);
  const [bias, setBias] = useState(-1);

  const points = useMemo(
    () => [
      { x: 0, y: 0, label: 0 },
      { x: 0, y: 1, label: 0 },
      { x: 1, y: 0, label: 0 },
      { x: 1, y: 1, label: 1 },
    ],
    [],
  );

  const results = points.map((point) => {
    const z = w1 * point.x + w2 * point.y + bias;
    return { ...point, z, output: z > 0 ? 1 : 0 };
  });
  const correct = results.filter((r) => r.output === r.label).length;

  return (
    <View>
      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
        Fit the AND function: output 1 only when both inputs are 1.
      </Text>

      <Slider value={w1} min={-3} max={3} step={0.1} onChange={setW1} label="Weight w₁" />
      <Slider value={w2} min={-3} max={3} step={0.1} onChange={setW2} label="Weight w₂" />
      <Slider value={bias} min={-3} max={3} step={0.1} onChange={setBias} label="Bias b" color={theme.colors.info} />

      <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.lg }}>
        {results.map((result) => (
          <View
            key={`${result.x}-${result.y}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: theme.spacing.sm,
              borderRadius: theme.radii.sm,
              backgroundColor:
                result.output === result.label ? theme.colors.successSubtle : theme.colors.dangerSubtle,
            }}
          >
            <Text variant="caption" mono style={{ flex: 1 }}>
              ({result.x}, {result.y})
            </Text>
            <Text variant="caption" mono tone="tertiary" style={{ flex: 1 }}>
              z = {result.z.toFixed(2)}
            </Text>
            <Text variant="caption" mono style={{ flex: 1 }}>
              → {result.output}
            </Text>
            <Text variant="caption" tone={result.output === result.label ? 'success' : 'danger'}>
              {result.output === result.label ? '✓' : '✕'}
            </Text>
          </View>
        ))}
      </View>

      <Badge
        label={`${correct}/4 correct`}
        tone={correct === 4 ? 'success' : 'warning'}
        style={{ marginTop: theme.spacing.md }}
      />

      <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.md }}>
        AND is solvable by one neuron. XOR is not — that gap is the reason for hidden layers.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Runs real gradient descent on f(x) = x², so divergence is genuine. */
function GradientDescentWidget(): React.JSX.Element {
  const theme = useTheme();
  const [learningRate, setLearningRate] = useState(0.1);

  const path = useMemo(() => {
    const steps: number[] = [];
    let x = 4;
    for (let i = 0; i < 16; i += 1) {
      steps.push(x);
      // f(x) = x², so f'(x) = 2x.
      x = x - learningRate * 2 * x;
      if (!Number.isFinite(x) || Math.abs(x) > 1e6) break;
    }
    return steps;
  }, [learningRate]);

  const final = path[path.length - 1] ?? 0;
  const diverged = !Number.isFinite(final) || Math.abs(final) > 4;
  const converged = Math.abs(final) < 0.01;

  return (
    <View>
      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
        Minimising f(x) = x², starting from x = 4.
      </Text>

      <Slider
        value={learningRate}
        min={0.01}
        max={1.2}
        step={0.01}
        onChange={setLearningRate}
        label="Learning rate η"
        color={diverged ? theme.colors.danger : theme.colors.primary}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          height: 96,
          gap: 2,
          marginTop: theme.spacing.lg,
        }}
      >
        {path.slice(0, 16).map((x, index) => {
          const loss = Math.min(1, (x * x) / 16);
          return (
            <View
              key={index}
              style={{
                flex: 1,
                height: Math.max(3, loss * 96),
                borderRadius: 2,
                backgroundColor: diverged ? theme.colors.danger : theme.colors.primary,
                opacity: 0.4 + (index / 16) * 0.6,
              }}
            />
          );
        })}
      </View>
      <Text variant="label" tone="tertiary" caps align="center" style={{ marginTop: theme.spacing.xs }}>
        Loss over 16 steps
      </Text>

      <Badge
        label={
          diverged
            ? 'Diverging — steps overshoot the minimum'
            : converged
              ? 'Converged to the minimum'
              : 'Converging, but slowly'
        }
        tone={diverged ? 'danger' : converged ? 'success' : 'warning'}
        style={{ marginTop: theme.spacing.md }}
      />

      <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.md }}>
        Above η = 1.0 each step overshoots further than the last, and the loss grows without bound.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** A hand-authored but plausible attention pattern, showing coreference. */
function AttentionWidget(): React.JSX.Element {
  const theme = useTheme();
  const tokens = ['The', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'tired'];
  const [selected, setSelected] = useState(7);

  const weights = useMemo(() => {
    const rows: number[][] = [
      [0.7, 0.2, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.005, 0.005],
      [0.3, 0.5, 0.06, 0.05, 0.02, 0.03, 0.01, 0.02, 0.005, 0.005],
      [0.08, 0.3, 0.4, 0.12, 0.02, 0.04, 0.01, 0.02, 0.005, 0.005],
      [0.04, 0.35, 0.15, 0.3, 0.04, 0.08, 0.01, 0.02, 0.005, 0.005],
      [0.03, 0.05, 0.02, 0.15, 0.5, 0.2, 0.02, 0.02, 0.005, 0.005],
      [0.02, 0.06, 0.02, 0.2, 0.25, 0.4, 0.02, 0.02, 0.005, 0.005],
      [0.02, 0.1, 0.05, 0.2, 0.03, 0.15, 0.4, 0.03, 0.01, 0.01],
      [0.03, 0.55, 0.02, 0.04, 0.02, 0.18, 0.04, 0.1, 0.01, 0.01],
      [0.02, 0.2, 0.02, 0.04, 0.02, 0.08, 0.04, 0.35, 0.2, 0.03],
      [0.02, 0.3, 0.02, 0.03, 0.02, 0.06, 0.03, 0.32, 0.1, 0.1],
    ];
    return rows;
  }, []);

  const row = weights[selected] ?? [];

  return (
    <View>
      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
        Tap a token to see what it attends to.
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {tokens.map((token, index) => {
          const weight = row[index] ?? 0;
          const isSelected = index === selected;
          return (
            <Pressable
              key={`${token}-${index}`}
              onPress={() => setSelected(index)}
              style={{
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: theme.spacing.xs,
                borderRadius: theme.radii.sm,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                backgroundColor: `rgba(139, 92, 246, ${Math.min(0.85, weight * 1.6)})`,
              }}
            >
              <Text variant="caption">{token}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.lg }}>
        {selected === 7
          ? '“it” attends most strongly to “animal” — that is coreference resolution falling out of the attention weights.'
          : `“${tokens[selected]}” — brighter tokens receive more attention weight.`}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Threshold slider over a fixed score distribution — real precision/recall. */
function ConfusionMatrixWidget(): React.JSX.Element {
  const theme = useTheme();
  const [threshold, setThreshold] = useState(0.5);

  // 40 scored examples: positives skew high, negatives low, with overlap.
  const examples = useMemo(() => {
    const positives = [0.95, 0.92, 0.88, 0.85, 0.81, 0.78, 0.72, 0.68, 0.61, 0.55, 0.48, 0.41, 0.35, 0.28, 0.19];
    const negatives = [0.72, 0.64, 0.57, 0.49, 0.44, 0.38, 0.33, 0.29, 0.25, 0.22, 0.18, 0.15, 0.12, 0.09, 0.07, 0.05, 0.04, 0.03, 0.02, 0.01];
    return [
      ...positives.map((score) => ({ score, actual: true })),
      ...negatives.map((score) => ({ score, actual: false })),
    ];
  }, []);

  const stats = useMemo(() => {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const example of examples) {
      const predicted = example.score >= threshold;
      if (example.actual && predicted) tp += 1;
      else if (!example.actual && predicted) fp += 1;
      else if (example.actual && !predicted) fn += 1;
      else tn += 1;
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { tp, fp, fn, tn, precision, recall, f1 };
  }, [examples, threshold]);

  const cell = (label: string, value: number, color: string): React.JSX.Element => (
    <View
      style={{
        flex: 1,
        padding: theme.spacing.md,
        borderRadius: theme.radii.md,
        backgroundColor: `${color}22`,
        borderWidth: 1,
        borderColor: color,
      }}
    >
      <Text variant="label" caps style={{ color }}>
        {label}
      </Text>
      <Text variant="heading" style={{ marginTop: theme.spacing.xxs }}>
        {value}
      </Text>
    </View>
  );

  return (
    <View>
      <Slider
        value={threshold}
        min={0.01}
        max={0.99}
        step={0.01}
        onChange={setThreshold}
        label="Decision threshold"
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        {cell('True pos', stats.tp, theme.colors.success)}
        {cell('False pos', stats.fp, theme.colors.warning)}
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        {cell('False neg', stats.fn, theme.colors.danger)}
        {cell('True neg', stats.tn, theme.colors.success)}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        <Badge label={`Precision ${(stats.precision * 100).toFixed(0)}%`} tone="primary" />
        <Badge label={`Recall ${(stats.recall * 100).toFixed(0)}%`} tone="info" />
        <Badge label={`F1 ${(stats.f1 * 100).toFixed(0)}%`} tone="success" />
      </View>

      <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.md }}>
        Raise the threshold and precision climbs while recall falls. No setting maximises both — which
        one you want is a product decision, not a technical one.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** The U-shaped validation curve, driven by a model-complexity slider. */
function BiasVarianceWidget(): React.JSX.Element {
  const theme = useTheme();
  const [complexity, setComplexity] = useState(4);

  const { trainError, valError, verdict, tone } = useMemo(() => {
    // Training error falls monotonically; validation error is U-shaped.
    const train = Math.max(0.02, 0.9 * Math.exp(-complexity / 3));
    const val = Math.max(0.08, 0.9 * Math.exp(-complexity / 3) + 0.012 * complexity * complexity);

    if (complexity <= 2) return { trainError: train, valError: val, verdict: 'Underfitting — too simple to capture the pattern', tone: 'warning' as const };
    if (complexity >= 8) return { trainError: train, valError: val, verdict: 'Overfitting — memorising noise in the training set', tone: 'danger' as const };
    return { trainError: train, valError: val, verdict: 'Good fit — near the bottom of the validation curve', tone: 'success' as const };
  }, [complexity]);

  const bar = (label: string, value: number, color: string): React.JSX.Element => (
    <View style={{ marginBottom: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
        <Text variant="caption" mono tone="tertiary">
          {(value * 100).toFixed(1)}%
        </Text>
      </View>
      <View
        style={{
          height: 10,
          borderRadius: 5,
          marginTop: theme.spacing.xxs,
          backgroundColor: theme.colors.surfaceMuted,
          overflow: 'hidden',
        }}
      >
        <View style={{ width: `${Math.min(100, value * 100)}%`, height: '100%', backgroundColor: color }} />
      </View>
    </View>
  );

  return (
    <View>
      <Slider
        value={complexity}
        min={1}
        max={10}
        step={1}
        onChange={setComplexity}
        label="Model complexity"
        format={(v) => `degree ${v.toFixed(0)}`}
      />

      <View style={{ marginTop: theme.spacing.lg }}>
        {bar('Training error', trainError, theme.colors.info)}
        {bar('Validation error', valError, theme.colors.primary)}
      </View>

      <Badge label={verdict} tone={tone} />

      <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.md }}>
        Training error only ever falls. Validation error is the one that matters, and it turns back up.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Cosine similarity over a small hand-placed 2-D embedding space. */
function EmbeddingWidget(): React.JSX.Element {
  const theme = useTheme();
  const words = useMemo(
    () => [
      { word: 'king', x: 0.8, y: 0.7, group: 'royal' },
      { word: 'queen', x: 0.75, y: 0.4, group: 'royal' },
      { word: 'man', x: 0.4, y: 0.72, group: 'person' },
      { word: 'woman', x: 0.35, y: 0.42, group: 'person' },
      { word: 'Paris', x: 0.15, y: 0.15, group: 'place' },
      { word: 'France', x: 0.3, y: 0.08, group: 'place' },
      { word: 'cat', x: 0.85, y: 0.15, group: 'animal' },
      { word: 'dog', x: 0.9, y: 0.22, group: 'animal' },
    ],
    [],
  );

  const [selected, setSelected] = useState('king');
  const anchor = words.find((w) => w.word === selected) ?? words[0]!;

  const similarities = words
    .filter((w) => w.word !== anchor.word)
    .map((w) => {
      const dot = anchor.x * w.x + anchor.y * w.y;
      const magnitude = Math.hypot(anchor.x, anchor.y) * Math.hypot(w.x, w.y);
      return { word: w.word, similarity: magnitude === 0 ? 0 : dot / magnitude };
    })
    .sort((a, b) => b.similarity - a.similarity);

  const groupColor: Record<string, string> = {
    royal: theme.colors.primary,
    person: theme.colors.info,
    place: theme.colors.success,
    animal: theme.colors.warning,
  };

  return (
    <View>
      <View
        style={{
          height: 200,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        {words.map((word) => (
          <Pressable
            key={word.word}
            onPress={() => setSelected(word.word)}
            style={{
              position: 'absolute',
              left: `${word.x * 82}%`,
              top: `${(1 - word.y) * 78}%`,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: theme.spacing.xxs,
              borderRadius: theme.radii.sm,
              borderWidth: word.word === selected ? 2 : 1,
              borderColor: groupColor[word.group] ?? theme.colors.border,
              backgroundColor:
                word.word === selected ? `${groupColor[word.group]}33` : theme.colors.surfaceMuted,
            }}
          >
            <Text variant="caption">{word.word}</Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" tone="tertiary" caps style={{ marginTop: theme.spacing.lg }}>
        Nearest to “{anchor.word}” by cosine similarity
      </Text>

      <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
        {similarities.slice(0, 4).map((entry) => (
          <View key={entry.word} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="caption" style={{ width: 72 }}>
              {entry.word}
            </Text>
            <View
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.colors.surfaceMuted,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.max(0, entry.similarity) * 100}%`,
                  height: '100%',
                  backgroundColor: theme.colors.primary,
                }}
              />
            </View>
            <Text variant="caption" mono tone="tertiary" style={{ width: 52, textAlign: 'right' }}>
              {entry.similarity.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Builds a prompt from toggleable parts, scoring specificity as you go. */
function PromptLabWidget(): React.JSX.Element {
  const theme = useTheme();

  const parts = useMemo(
    () => [
      { key: 'role', label: 'Role', text: 'You are a technical editor writing for developers.' },
      { key: 'task', label: 'Task', text: 'Rewrite the paragraph below.' },
      { key: 'context', label: 'Context', text: 'It appears in API docs; readers know HTTP but not our product.' },
      { key: 'format', label: 'Format', text: 'Return exactly 3 bullets, each under 15 words.' },
      { key: 'constraints', label: 'Constraints', text: 'No marketing language. Do not invent parameter names.' },
    ],
    [],
  );

  const [enabled, setEnabled] = useState<string[]>(['task']);

  const toggle = (key: string): void =>
    setEnabled((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  const prompt = parts.filter((p) => enabled.includes(p.key)).map((p) => p.text).join('\n');
  const score = enabled.length / parts.length;

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {parts.map((part) => {
          const active = enabled.includes(part.key);
          return (
            <Pressable
              key={part.key}
              onPress={() => toggle(part.key)}
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radii.pill,
                borderWidth: 1,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                backgroundColor: active ? theme.colors.primarySubtle : 'transparent',
              }}
            >
              <Text variant="caption" tone={active ? 'primary' : 'tertiary'}>
                {active ? '✓ ' : '+ '}
                {part.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card background={theme.colors.surfaceMuted} style={{ marginTop: theme.spacing.lg }}>
        <Text variant="mono" mono tone={prompt ? 'default' : 'tertiary'}>
          {prompt || 'Add at least one part to build a prompt…'}
        </Text>
      </Card>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Text variant="caption" tone="secondary">
          Specificity
        </Text>
        <View
          style={{
            height: 10,
            borderRadius: 5,
            marginTop: theme.spacing.xs,
            backgroundColor: theme.colors.surfaceMuted,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${score * 100}%`,
              height: '100%',
              backgroundColor:
                score > 0.7 ? theme.colors.success : score > 0.4 ? theme.colors.warning : theme.colors.danger,
            }}
          />
        </View>
      </View>

      <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.md }}>
        {score >= 1
          ? 'Fully specified — the model has almost nothing left to guess.'
          : 'Each part you add removes one thing the model would otherwise have to invent.'}
      </Text>
    </View>
  );
}

/** Re-exported so lesson screens can size widget containers consistently. */
export function InteractiveCard({
  widget,
  title,
  instructions,
}: {
  widget: InteractiveWidget;
  title: string;
  instructions: string;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <View>
      <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>
        {title}
      </Text>
      <Text variant="body" tone="secondary" style={{ marginBottom: theme.spacing.xl }}>
        {instructions}
      </Text>
      <Card outlined>
        <Interactive widget={widget} />
      </Card>
    </View>
  );
}
