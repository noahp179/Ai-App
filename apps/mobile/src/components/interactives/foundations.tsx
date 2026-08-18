/**
 * Foundations and data widgets.
 *
 * These target the ideas people most often think they understand and do not:
 * which paradigm a problem belongs to, why the test set is sacred, how bias
 * enters through sampling, and why base rates dominate Bayes.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Text, useTheme } from '@synapse/ui';

import { Slider } from '../Slider.js';
import { ActionRow, Bar, Note, PlotCanvas, Readout, SegmentedControl, clamp01 } from './shared.js';

// ---------------------------------------------------------------------------
// ml-type-sorter
// ---------------------------------------------------------------------------

const PARADIGMS = ['Supervised', 'Unsupervised', 'Reinforcement', 'Self-supervised'] as const;
type Paradigm = (typeof PARADIGMS)[number];

const SCENARIOS: Array<{ text: string; answer: Paradigm; why: string }> = [
  { text: 'Predict house price from 50,000 labelled sales', answer: 'Supervised', why: 'Each example carries the true price.' },
  { text: 'Group customers into segments nobody defined', answer: 'Unsupervised', why: 'No target exists — only structure to find.' },
  { text: 'Teach a robot to walk by rewarding distance', answer: 'Reinforcement', why: 'Reward after acting, with no correct action given.' },
  { text: 'Predict the next word across a trillion tokens', answer: 'Self-supervised', why: 'The label is the word you hid from the model.' },
  { text: 'Detect fraud using confirmed fraud cases', answer: 'Supervised', why: 'Confirmed cases are labels.' },
  { text: 'Find unusual server logs, no examples of "unusual"', answer: 'Unsupervised', why: 'Density estimation over normal behaviour.' },
  { text: 'Learn chess from self-play and win/loss', answer: 'Reinforcement', why: 'Delayed reward at the end of a game.' },
  { text: 'Reconstruct a masked patch of an image', answer: 'Self-supervised', why: 'The patch you removed is the answer key.' },
];

export function MlTypeSorter(): React.JSX.Element {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Paradigm | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const scenario = SCENARIOS[index]!;
  const answered = picked !== null;
  const correct = picked === scenario.answer;

  const choose = (paradigm: Paradigm): void => {
    if (answered) return;
    setPicked(paradigm);
    setScore((s) => ({
      right: s.right + (paradigm === scenario.answer ? 1 : 0),
      total: s.total + 1,
    }));
  };

  const next = (): void => {
    setPicked(null);
    setIndex((i) => (i + 1) % SCENARIOS.length);
  };

  return (
    <View>
      <View
        style={{
          padding: theme.spacing.lg,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surfaceMuted,
          marginBottom: theme.spacing.lg,
          minHeight: 84,
          justifyContent: 'center',
        }}
      >
        <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.xs }}>
          Scenario {index + 1} of {SCENARIOS.length}
        </Text>
        <Text variant="bodyStrong">{scenario.text}</Text>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {PARADIGMS.map((paradigm) => {
          const isAnswer = paradigm === scenario.answer;
          const isPicked = paradigm === picked;

          const background = !answered
            ? 'transparent'
            : isAnswer
              ? theme.colors.successSubtle
              : isPicked
                ? theme.colors.dangerSubtle
                : 'transparent';
          const border = !answered
            ? theme.colors.border
            : isAnswer
              ? theme.colors.success
              : isPicked
                ? theme.colors.danger
                : theme.colors.border;

          return (
            <Pressable
              key={paradigm}
              onPress={() => choose(paradigm)}
              disabled={answered}
              accessibilityRole="button"
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radii.md,
                borderWidth: 1.5,
                borderColor: border,
                backgroundColor: background,
              }}
            >
              <Text variant="caption">{paradigm}</Text>
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Badge
            label={correct ? 'Correct' : `Actually: ${scenario.answer}`}
            tone={correct ? 'success' : 'danger'}
          />
          <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.sm }}>
            {scenario.why}
          </Text>
        </View>
      ) : null}

      <ActionRow
        actions={[{ label: answered ? 'Next scenario' : 'Pick one', onPress: next, disabled: !answered, primary: true }]}
      />

      <Readout
        items={[
          { label: 'Score', value: `${score.right}/${score.total}` },
          {
            label: 'Accuracy',
            value: score.total === 0 ? '—' : `${Math.round((score.right / score.total) * 100)}%`,
          },
        ]}
      />

      <Note>
        The test is always the same: who or what supplies the training signal? A human annotator, nobody,
        the consequences of acting, or the data itself.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// train-test-split
// ---------------------------------------------------------------------------

export function TrainTestSplit(): React.JSX.Element {
  const theme = useTheme();
  const [trainPct, setTrainPct] = useState(70);
  const [valPct, setValPct] = useState(15);
  const [peeks, setPeeks] = useState(0);

  const testPct = Math.max(0, 100 - trainPct - valPct);
  const testRows = Math.round((testPct / 100) * 20000);

  /**
   * Each peek at the test set biases the reported score upward, and the
   * expected inflation grows roughly with sqrt(number of comparisons) while
   * shrinking with test-set size. Approximated here to make the effect legible.
   */
  const inflation = peeks === 0 ? 0 : Math.sqrt(peeks) * (40 / Math.max(200, testRows)) * 100;
  const trueScore = 84;
  const reported = Math.min(99.9, trueScore + inflation);

  const segments = [
    { label: 'Train', pct: trainPct, color: theme.colors.primary },
    { label: 'Validation', pct: valPct, color: theme.colors.info },
    { label: 'Test', pct: testPct, color: theme.colors.success },
  ];

  return (
    <View>
      <View style={{ flexDirection: 'row', height: 48, borderRadius: theme.radii.md, overflow: 'hidden' }}>
        {segments.map((segment) => (
          <View
            key={segment.label}
            style={{
              flex: Math.max(0.001, segment.pct),
              backgroundColor: segment.color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {segment.pct >= 10 ? (
              <Text variant="label" tone="onAccent" caps>
                {segment.pct}%
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.sm }}>
        {segments.map((segment) => (
          <View key={segment.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: segment.color }} />
            <Text variant="label" tone="tertiary">
              {segment.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Slider value={trainPct} min={40} max={90} step={1} onChange={setTrainPct} label="Training %" format={(v) => `${v.toFixed(0)}%`} />
        <Slider
          value={valPct}
          min={0}
          max={Math.max(0, 100 - trainPct - 5)}
          step={1}
          onChange={setValPct}
          label="Validation %"
          format={(v) => `${v.toFixed(0)}%`}
          color={theme.colors.info}
        />
      </View>

      <Readout
        items={[
          { label: 'Test rows', value: testRows.toLocaleString() },
          { label: 'True accuracy', value: `${trueScore.toFixed(1)}%`, color: theme.colors.success },
          {
            label: 'Reported',
            value: `${reported.toFixed(1)}%`,
            color: peeks > 0 ? theme.colors.danger : theme.colors.success,
          },
        ]}
      />

      <ActionRow
        actions={[
          { label: `Peek at test set (${peeks})`, onPress: () => setPeeks((p) => p + 1) },
          { label: 'Reset', onPress: () => setPeeks(0) },
        ]}
      />

      {peeks > 0 ? (
        <Badge
          label={`${peeks} model${peeks > 1 ? 's' : ''} selected on test — reported score is now ${(reported - trueScore).toFixed(1)} points optimistic`}
          tone="danger"
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}

      <Note>
        Every time you compare models on the test set, the winner is partly lucky on that specific sample.
        A smaller test set inflates faster — which is why 3,000 rows gives a far more stable estimate than 300.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// data-bias
// ---------------------------------------------------------------------------

export function DataBias(): React.JSX.Element {
  const theme = useTheme();
  const [groupAShare, setGroupAShare] = useState(0.9);

  /**
   * Accuracy per group as a function of that group's representation.
   * A model trained overwhelmingly on one group performs well there and poorly
   * elsewhere — the shape here is a simple saturating curve, which is the
   * qualitative behaviour observed in real audits.
   */
  const accuracy = (share: number): number => {
    const n = share * 10000;
    return 0.55 + 0.42 * (1 - Math.exp(-n / 1200));
  };

  const accA = accuracy(groupAShare);
  const accB = accuracy(1 - groupAShare);
  const gap = Math.abs(accA - accB);
  const overall = accA * groupAShare + accB * (1 - groupAShare);

  return (
    <View>
      <Slider
        value={groupAShare}
        min={0.5}
        max={0.99}
        step={0.01}
        onChange={setGroupAShare}
        label="Share of training data from Group A"
        format={(v) => `${(v * 100).toFixed(0)}%`}
      />

      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
        {[
          { name: 'Group A', share: groupAShare, acc: accA, color: theme.colors.primary },
          { name: 'Group B', share: 1 - groupAShare, acc: accB, color: theme.colors.warning },
        ].map((group) => (
          <View key={group.name}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text variant="caption">
                {group.name} · {(group.share * 100).toFixed(0)}% of data
              </Text>
              <Text variant="caption" mono tone="tertiary">
                {(group.acc * 100).toFixed(1)}% accurate
              </Text>
            </View>
            <Bar fraction={group.acc} color={group.color} height={10} />
          </View>
        ))}
      </View>

      <Readout
        items={[
          { label: 'Overall accuracy', value: `${(overall * 100).toFixed(1)}%`, color: theme.colors.success },
          {
            label: 'Accuracy gap',
            value: `${(gap * 100).toFixed(1)} pts`,
            color: gap > 0.1 ? theme.colors.danger : theme.colors.textSecondary,
          },
        ]}
      />

      {gap > 0.1 ? (
        <Badge
          label="Headline accuracy looks fine while one group is badly served"
          tone="danger"
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}

      <Note>
        Nothing about the algorithm changed — only who is in the data. This is why an aggregate accuracy
        number can hide a serious harm, and why per-group metrics are the minimum standard for any system
        that makes decisions about people.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// bayes-calculator
// ---------------------------------------------------------------------------

export function BayesCalculator(): React.JSX.Element {
  const theme = useTheme();
  const [prevalencePer1000, setPrevalence] = useState(1);
  const [sensitivity, setSensitivity] = useState(0.99);
  const [specificity, setSpecificity] = useState(0.99);

  const population = 100000;
  const withDisease = (prevalencePer1000 / 1000) * population;
  const withoutDisease = population - withDisease;

  const truePositives = withDisease * sensitivity;
  const falseNegatives = withDisease - truePositives;
  const falsePositives = withoutDisease * (1 - specificity);
  const trueNegatives = withoutDisease - falsePositives;

  const totalPositive = truePositives + falsePositives;
  const posteriorPositive = totalPositive === 0 ? 0 : truePositives / totalPositive;

  return (
    <View>
      <Slider
        value={prevalencePer1000}
        min={0.1}
        max={200}
        step={0.1}
        onChange={setPrevalence}
        label="Prevalence (per 1,000 people)"
        format={(v) => `${v.toFixed(1)} / 1000`}
      />
      <Slider
        value={sensitivity}
        min={0.5}
        max={0.999}
        step={0.001}
        onChange={setSensitivity}
        label="Sensitivity — catches true cases"
        format={(v) => `${(v * 100).toFixed(1)}%`}
        color={theme.colors.success}
      />
      <Slider
        value={specificity}
        min={0.5}
        max={0.999}
        step={0.001}
        onChange={setSpecificity}
        label="Specificity — correctly clears healthy people"
        format={(v) => `${(v * 100).toFixed(1)}%`}
        color={theme.colors.info}
      />

      <View
        style={{
          marginTop: theme.spacing.lg,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <Text variant="label" tone="tertiary" caps>
          In 100,000 people
        </Text>
        <View style={{ marginTop: theme.spacing.sm, gap: 4 }}>
          <Text variant="caption" mono tone="secondary">
            {Math.round(truePositives).toLocaleString()} true positives
          </Text>
          <Text variant="caption" mono tone="secondary">
            {Math.round(falsePositives).toLocaleString()} false positives
          </Text>
          <Text variant="caption" mono tone="tertiary">
            {Math.round(falseNegatives).toLocaleString()} missed cases · {Math.round(trueNegatives).toLocaleString()} correctly cleared
          </Text>
        </View>
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.xs }}>
          If you test positive, chance you actually have it
        </Text>
        <Bar
          fraction={posteriorPositive}
          color={posteriorPositive < 0.3 ? theme.colors.danger : theme.colors.success}
          height={14}
        />
        <Text
          variant="title"
          mono
          style={{
            marginTop: theme.spacing.sm,
            color: posteriorPositive < 0.3 ? theme.colors.danger : theme.colors.success,
          }}
        >
          {(posteriorPositive * 100).toFixed(1)}%
        </Text>
      </View>

      <Note>
        Hold the test accuracy fixed and drag prevalence. The test did not get worse — the population did.
        When the healthy group is a thousand times larger, its small error rate produces more false positives
        than the rare group produces true ones.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// entropy-explorer
// ---------------------------------------------------------------------------

export function EntropyExplorer(): React.JSX.Element {
  const theme = useTheme();
  const [p, setP] = useState(0.5);

  const q = 1 - p;
  const safeLog = (x: number): number => (x <= 0 ? 0 : Math.log2(x));
  const entropy = -(p * safeLog(p) + q * safeLog(q));
  const gini = 1 - (p * p + q * q);

  // Cross-entropy of the true distribution against a fixed model prediction,
  // to show that it is minimised exactly when the two distributions match.
  const [predicted, setPredicted] = useState(0.5);
  const crossEntropy = -(p * safeLog(predicted) + q * safeLog(1 - predicted));

  return (
    <View>
      <Slider
        value={p}
        min={0.01}
        max={0.99}
        step={0.01}
        onChange={setP}
        label="True P(class A)"
        format={(v) => v.toFixed(2)}
      />

      <View style={{ flexDirection: 'row', height: 40, borderRadius: theme.radii.md, overflow: 'hidden', marginTop: theme.spacing.sm }}>
        <View style={{ flex: Math.max(0.001, p), backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          {p > 0.15 ? <Text variant="label" tone="onAccent">A</Text> : null}
        </View>
        <View style={{ flex: Math.max(0.001, q), backgroundColor: theme.colors.warning, alignItems: 'center', justifyContent: 'center' }}>
          {q > 0.15 ? <Text variant="label" tone="onAccent">B</Text> : null}
        </View>
      </View>

      <Readout
        items={[
          { label: 'Entropy', value: `${entropy.toFixed(3)} bits`, color: theme.colors.primary },
          { label: 'Gini', value: gini.toFixed(3), color: theme.colors.info },
        ]}
      />

      <View style={{ marginTop: theme.spacing.xl }}>
        <Slider
          value={predicted}
          min={0.01}
          max={0.99}
          step={0.01}
          onChange={setPredicted}
          label="Model's predicted P(class A)"
          format={(v) => v.toFixed(2)}
          color={theme.colors.success}
        />
        <Readout
          items={[
            {
              label: 'Cross-entropy',
              value: crossEntropy.toFixed(3),
              color: Math.abs(predicted - p) < 0.02 ? theme.colors.success : theme.colors.warning,
            },
            { label: 'Minimum possible', value: entropy.toFixed(3), color: theme.colors.textTertiary },
          ]}
        />
      </View>

      <Note>
        Entropy peaks at an even split — maximum uncertainty — and falls to zero when one class takes
        everything. Cross-entropy always sits at or above entropy, and reaches it exactly when the model's
        prediction matches the truth. That is why minimising cross-entropy is minimising the gap between
        the model's beliefs and reality.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// feature-scaling
// ---------------------------------------------------------------------------

export function FeatureScaling(): React.JSX.Element {
  const theme = useTheme();
  const [scaled, setScaled] = useState(false);

  // Age 18–90, income 20k–200k. Deliberately mismatched magnitudes.
  const points = useMemo(
    () => [
      { name: 'A', age: 25, income: 30000 },
      { name: 'B', age: 27, income: 32000 },
      { name: 'C', age: 62, income: 31000 },
      { name: 'D', age: 26, income: 150000 },
    ],
    [],
  );
  const query = { age: 26, income: 31000 };

  const stats = useMemo(() => {
    const ages = points.map((p) => p.age);
    const incomes = points.map((p) => p.income);
    const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;
    const sd = (a: number[], m: number): number =>
      Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) || 1;
    const ma = mean(ages);
    const mi = mean(incomes);
    return { ma, sa: sd(ages, ma), mi, si: sd(incomes, mi) };
  }, [points]);

  const distances = points.map((point) => {
    if (!scaled) {
      return {
        ...point,
        d: Math.hypot(point.age - query.age, point.income - query.income),
      };
    }
    const za = (point.age - stats.ma) / stats.sa;
    const zi = (point.income - stats.mi) / stats.si;
    const qa = (query.age - stats.ma) / stats.sa;
    const qi = (query.income - stats.mi) / stats.si;
    return { ...point, d: Math.hypot(za - qa, zi - qi) };
  });

  const sorted = [...distances].sort((a, b) => a.d - b.d);
  const nearest = sorted[0]!;

  return (
    <View>
      <SegmentedControl
        options={['Raw features', 'Standardised'] as const}
        value={scaled ? 'Standardised' : 'Raw features'}
        onChange={(v) => setScaled(v === 'Standardised')}
        label="Preprocessing"
      />

      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
        Query point: age {query.age}, income ${query.income.toLocaleString()}
      </Text>

      <View style={{ gap: theme.spacing.sm }}>
        {sorted.map((point, rank) => (
          <View
            key={point.name}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              backgroundColor: rank === 0 ? theme.colors.primarySubtle : theme.colors.surfaceMuted,
              borderWidth: rank === 0 ? 1 : 0,
              borderColor: theme.colors.primary,
            }}
          >
            <Text variant="caption" tone={rank === 0 ? 'primary' : 'tertiary'} style={{ width: 20 }}>
              {rank + 1}
            </Text>
            <Text variant="caption" style={{ flex: 1 }}>
              {point.name} · age {point.age}, ${(point.income / 1000).toFixed(0)}k
            </Text>
            <Text variant="caption" mono tone="tertiary">
              d = {point.d < 100 ? point.d.toFixed(2) : point.d.toFixed(0)}
            </Text>
          </View>
        ))}
      </View>

      <Badge
        label={`Nearest neighbour: ${nearest.name}`}
        tone={scaled ? 'success' : 'warning'}
        style={{ marginTop: theme.spacing.lg }}
      />

      <Note>
        Unscaled, income differences of tens of thousands swamp age differences of a few years, so the
        model effectively sees one feature. Standardising puts both on comparable footing — and changes
        which point is "nearest". Same data, same algorithm, different answer.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// cross-validation
// ---------------------------------------------------------------------------

export function CrossValidation(): React.JSX.Element {
  const theme = useTheme();
  const [k, setK] = useState(5);
  const [activeFold, setActiveFold] = useState(0);

  // Per-fold scores with realistic variance, deterministic in k.
  const scores = useMemo(
    () => Array.from({ length: k }, (_, i) => 0.78 + 0.14 * Math.sin(i * 2.4 + k)),
    [k],
  );
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const sd = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length);

  return (
    <View>
      <Slider value={k} min={2} max={10} step={1} onChange={(v) => { setK(v); setActiveFold(0); }} label="Number of folds (k)" format={(v) => v.toFixed(0)} />

      <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.lg }}>
        {Array.from({ length: k }, (_, round) => (
          <Pressable key={round} onPress={() => setActiveFold(round)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Text variant="label" tone={round === activeFold ? 'primary' : 'tertiary'} style={{ width: 56 }}>
                Round {round + 1}
              </Text>
              <View style={{ flex: 1, flexDirection: 'row', gap: 2, opacity: round === activeFold ? 1 : 0.35 }}>
                {Array.from({ length: k }, (_, fold) => (
                  <View
                    key={fold}
                    style={{
                      flex: 1,
                      height: 20,
                      borderRadius: 4,
                      backgroundColor: fold === round ? theme.colors.success : theme.colors.primary,
                    }}
                  />
                ))}
              </View>
              <Text variant="label" mono tone="tertiary" style={{ width: 42, textAlign: 'right' }}>
                {(scores[round]! * 100).toFixed(0)}%
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: theme.colors.primary }} />
          <Text variant="label" tone="tertiary">Train</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: theme.colors.success }} />
          <Text variant="label" tone="tertiary">Held out</Text>
        </View>
      </View>

      <Readout
        items={[
          { label: 'Models trained', value: String(k) },
          { label: 'Mean score', value: `${(mean * 100).toFixed(1)}%`, color: theme.colors.success },
          {
            label: 'Std dev',
            value: `${(sd * 100).toFixed(1)} pts`,
            color: sd > 0.06 ? theme.colors.warning : theme.colors.textSecondary,
          },
        ]}
      />

      <Note>
        Every example is used for both training and validation, just never in the same round. Watch the
        standard deviation: a wide spread across folds means your single-split estimate would have been
        largely luck, and the honest thing to report is the mean plus that spread.
      </Note>
    </View>
  );
}
