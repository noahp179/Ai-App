/**
 * Classic ML algorithm widgets.
 *
 * Each one runs the real algorithm rather than an animation of it — k-means
 * genuinely converges to a local optimum, k-NN genuinely votes, the tree
 * genuinely computes information gain. A widget that fakes the maths teaches
 * the wrong intuition, which is worse than teaching none.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Badge, Text, useTheme, useTicker } from '@synapse/ui';

import { Slider } from '../Slider';
import {
  ActionRow,
  Bar,
  Dot,
  Line,
  MovingDot,
  Note,
  Path,
  PlotCanvas,
  Readout,
  SegmentedControl,
  classColors,
  clamp01,
  dist,
  gaussian,
  makeRandom,
  type UnitPoint,
} from './shared';

// ---------------------------------------------------------------------------
// linear-regression
// ---------------------------------------------------------------------------

export function LinearRegression(): React.JSX.Element {
  const theme = useTheme();
  const [slope, setSlope] = useState(0.5);
  const [intercept, setIntercept] = useState(0.2);
  const [withOutlier, setWithOutlier] = useState(false);

  const points = useMemo<UnitPoint[]>(() => {
    const random = makeRandom(42);
    const base = Array.from({ length: 14 }, (_, i) => {
      const x = (i + 0.5) / 14;
      return { x, y: clamp01(0.15 + 0.7 * x + gaussian(random, 0, 0.06)) };
    });
    return base;
  }, []);

  const data = withOutlier ? [...points, { x: 0.85, y: 0.05 }] : points;

  const mse = useMemo(() => {
    const total = data.reduce((sum, p) => sum + (slope * p.x + intercept - p.y) ** 2, 0);
    return total / data.length;
  }, [data, slope, intercept]);

  /** Closed-form ordinary least squares — the true optimum for this data. */
  const optimal = useMemo(() => {
    const n = data.length;
    const mx = data.reduce((s, p) => s + p.x, 0) / n;
    const my = data.reduce((s, p) => s + p.y, 0) / n;
    const num = data.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
    const den = data.reduce((s, p) => s + (p.x - mx) ** 2, 0) || 1e-9;
    const m = num / den;
    return { slope: m, intercept: my - m * mx };
  }, [data]);

  const optimalMse = useMemo(() => {
    const total = data.reduce(
      (sum, p) => sum + (optimal.slope * p.x + optimal.intercept - p.y) ** 2,
      0,
    );
    return total / data.length;
  }, [data, optimal]);

  return (
    <View>
      <PlotCanvas height={200}>
        {(size) => (
          <>
            {/* Residuals — the vertical errors being squared. */}
            {data.map((p, i) => (
              <Line
                key={`r-${i}`}
                from={p}
                to={{ x: p.x, y: clamp01(slope * p.x + intercept) }}
                size={size}
                color={theme.colors.danger}
                thickness={1}
              />
            ))}
            <Line
              from={{ x: 0, y: intercept }}
              to={{ x: 1, y: slope + intercept }}
              size={size}
              color={theme.colors.primary}
              thickness={3}
            />
            {data.map((p, i) => (
              <Dot key={i} point={p} size={size} color={theme.colors.info} radius={5} />
            ))}
          </>
        )}
      </PlotCanvas>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Slider value={slope} min={-0.5} max={1.5} step={0.01} onChange={setSlope} label="Slope (w)" />
        <Slider value={intercept} min={-0.2} max={0.8} step={0.01} onChange={setIntercept} label="Intercept (b)" color={theme.colors.info} />
      </View>

      <Readout
        items={[
          { label: 'Your MSE', value: mse.toFixed(4), color: mse < optimalMse * 1.05 ? theme.colors.success : theme.colors.warning },
          { label: 'Best possible', value: optimalMse.toFixed(4), color: theme.colors.textTertiary },
        ]}
      />

      <ActionRow
        actions={[
          {
            label: 'Solve exactly',
            onPress: () => {
              setSlope(Math.round(optimal.slope * 100) / 100);
              setIntercept(Math.round(optimal.intercept * 100) / 100);
            },
            primary: true,
          },
          { label: withOutlier ? 'Remove outlier' : 'Add an outlier', onPress: () => setWithOutlier((v) => !v) },
        ]}
      />

      <Note>
        The red lines are the residuals — MSE squares each one, so a single distant point contributes
        enormously. Add the outlier and press solve: the whole fitted line tilts to chase one observation.
        That sensitivity is exactly why mean absolute error and Huber loss exist.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// knn
// ---------------------------------------------------------------------------

export function Knn(): React.JSX.Element {
  const theme = useTheme();
  const colors = classColors(theme);
  const [k, setK] = useState(5);
  const [query, setQuery] = useState<UnitPoint>({ x: 0.5, y: 0.5 });

  const training = useMemo(() => {
    const random = makeRandom(7);
    const classA = Array.from({ length: 18 }, () => ({
      x: clamp01(gaussian(random, 0.32, 0.13)),
      y: clamp01(gaussian(random, 0.62, 0.13)),
      label: 0,
    }));
    const classB = Array.from({ length: 18 }, () => ({
      x: clamp01(gaussian(random, 0.68, 0.13)),
      y: clamp01(gaussian(random, 0.38, 0.13)),
      label: 1,
    }));
    return [...classA, ...classB];
  }, []);

  const neighbours = useMemo(() => {
    return [...training]
      .map((p) => ({ ...p, d: dist(p, query) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, k);
  }, [training, query, k]);

  const votes = neighbours.reduce(
    (acc, n) => {
      acc[n.label] = (acc[n.label] ?? 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );
  const votesA = votes[0] ?? 0;
  const votesB = votes[1] ?? 0;
  const predicted = votesA >= votesB ? 0 : 1;
  const confidence = Math.max(votesA, votesB) / k;

  return (
    <View>
      <PlotCanvas height={210} onPressPoint={setQuery} onDragPoint={setQuery}>
        {(size) => (
          <>
            {neighbours.map((n, i) => (
              <Line key={`l-${i}`} from={query} to={n} size={size} color={theme.colors.textTertiary} thickness={1} />
            ))}
            {training.map((p, i) => {
              const isNeighbour = neighbours.some((n) => n.x === p.x && n.y === p.y);
              return (
                <Dot
                  key={i}
                  point={p}
                  size={size}
                  color={colors[p.label]!}
                  radius={isNeighbour ? 7 : 4}
                />
              );
            })}
            <Dot point={query} size={size} color={colors[predicted]!} radius={11} hollow />
          </>
        )}
      </PlotCanvas>

      <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.sm }}>
        Tap or drag anywhere on the plot to move the query point.
      </Text>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider value={k} min={1} max={25} step={1} onChange={setK} label="k — how many neighbours vote" format={(v) => v.toFixed(0)} />
      </View>

      <Readout
        items={[
          { label: 'Class A votes', value: String(votesA), color: colors[0] },
          { label: 'Class B votes', value: String(votesB), color: colors[1] },
          { label: 'Prediction', value: predicted === 0 ? 'A' : 'B', color: colors[predicted] },
          { label: 'Confidence', value: `${Math.round(confidence * 100)}%` },
        ]}
      />

      <Note>
        At k=1 the prediction flips the moment you cross any single point — maximum variance. At k=25
        the vote is dominated by whichever class is larger overall and stops responding to local
        structure — maximum bias. The useful value is somewhere in between, and cross-validation is how
        you find it.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// kmeans
// ---------------------------------------------------------------------------

interface KMeansState {
  centroids: UnitPoint[];
  assignments: number[];
  iteration: number;
  converged: boolean;
}

export function KMeans(): React.JSX.Element {
  const theme = useTheme();
  const colors = classColors(theme);
  const [k, setK] = useState(3);
  const [seed, setSeed] = useState(1);
  const [extraPoints, setExtraPoints] = useState<UnitPoint[]>([]);

  const basePoints = useMemo(() => {
    const random = makeRandom(11);
    const blob = (cx: number, cy: number, n: number): UnitPoint[] =>
      Array.from({ length: n }, () => ({
        x: clamp01(gaussian(random, cx, 0.09)),
        y: clamp01(gaussian(random, cy, 0.09)),
      }));
    return [...blob(0.25, 0.7, 14), ...blob(0.72, 0.72, 14), ...blob(0.5, 0.25, 14)];
  }, []);

  const points = useMemo(() => [...basePoints, ...extraPoints], [basePoints, extraPoints]);

  const initial = useCallback((): KMeansState => {
    const random = makeRandom(seed * 97 + k);
    const centroids = Array.from({ length: k }, () => ({ x: random(), y: random() }));
    return { centroids, assignments: points.map(() => 0), iteration: 0, converged: false };
  }, [k, seed, points]);

  const [state, setState] = useState<KMeansState>(initial);
  const [playing, setPlaying] = useState(false);

  // Reset whenever the configuration changes underneath us.
  const configKey = `${k}-${seed}-${points.length}`;
  const [lastKey, setLastKey] = useState(configKey);
  if (configKey !== lastKey) {
    setLastKey(configKey);
    setState(initial());
    setPlaying(false);
  }

  const step = (): void => {
    setState((prev) => {
      // Assign each point to its nearest centroid.
      const assignments = points.map((p) => {
        let best = 0;
        let bestD = Infinity;
        prev.centroids.forEach((c, i) => {
          const d = dist(p, c);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        return best;
      });

      // Move each centroid to the mean of its assigned points.
      const centroids = prev.centroids.map((c, i) => {
        const members = points.filter((_, idx) => assignments[idx] === i);
        if (members.length === 0) return c; // Empty cluster keeps its position.
        return {
          x: members.reduce((s, p) => s + p.x, 0) / members.length,
          y: members.reduce((s, p) => s + p.y, 0) / members.length,
        };
      });

      const moved = centroids.some((c, i) => dist(c, prev.centroids[i]!) > 0.001);
      if (!moved) setPlaying(false);
      return { centroids, assignments, iteration: prev.iteration + 1, converged: !moved };
    });
  };

  // Paced at 900ms so each assign-and-move is separately readable — faster and
  // it becomes a blur, slower and it feels stalled.
  useTicker(playing && !state.converged, 900, step);

  const inertia = useMemo(() => {
    if (state.iteration === 0) return null;
    return points.reduce((sum, p, i) => {
      const c = state.centroids[state.assignments[i] ?? 0];
      return c ? sum + dist(p, c) ** 2 : sum;
    }, 0);
  }, [points, state]);

  return (
    <View>
      <PlotCanvas height={220} onPressPoint={(p) => setExtraPoints((prev) => [...prev, p])}>
        {(size) => (
          <>
            {points.map((p, i) => (
              <Dot
                key={i}
                point={p}
                size={size}
                color={state.iteration === 0 ? theme.colors.textTertiary : colors[state.assignments[i] ?? 0]!}
                radius={4}
              />
            ))}
            {state.centroids.map((c, i) => (
              <MovingDot
                key={`c-${i}`}
                point={c}
                size={size}
                color={colors[i]!}
                radius={10}
                hollow
                duration={700}
              />
            ))}
          </>
        )}
      </PlotCanvas>

      <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.sm }}>
        Tap the plot to add points. Rings are centroids.
      </Text>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider value={k} min={2} max={4} step={1} onChange={setK} label="k — number of clusters" format={(v) => v.toFixed(0)} />
      </View>

      <Readout
        items={[
          { label: 'Iteration', value: String(state.iteration) },
          { label: 'Inertia', value: inertia === null ? '—' : inertia.toFixed(3) },
          {
            label: 'Status',
            value: state.converged ? 'Converged' : state.iteration === 0 ? 'Not started' : 'Running',
            color: state.converged ? theme.colors.success : theme.colors.warning,
          },
        ]}
      />

      <ActionRow
        actions={[
          {
            label: playing ? 'Pause' : 'Run',
            onPress: () => setPlaying((p) => !p),
            disabled: state.converged,
            primary: true,
          },
          { label: 'Step once', onPress: step, disabled: state.converged || playing },
          { label: 'New seed', onPress: () => { setSeed((s) => s + 1); setPlaying(false); } },
        ]}
      />

      <Note>
        Each step assigns points to the nearest centroid, then moves each centroid to the mean of its
        members. Inertia never increases — that is why it always converges. Press "new seed" a few times
        and watch it land on genuinely different answers from different starting points: k-means finds a
        local optimum, not the global one.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// decision-tree
// ---------------------------------------------------------------------------

export function DecisionTree(): React.JSX.Element {
  const theme = useTheme();
  const colors = classColors(theme);
  const [feature, setFeature] = useState<'x' | 'y'>('x');
  const [threshold, setThreshold] = useState(0.5);

  const points = useMemo(() => {
    const random = makeRandom(23);
    return [
      ...Array.from({ length: 16 }, () => ({
        x: clamp01(gaussian(random, 0.3, 0.12)),
        y: clamp01(gaussian(random, 0.5, 0.22)),
        label: 0,
      })),
      ...Array.from({ length: 16 }, () => ({
        x: clamp01(gaussian(random, 0.72, 0.12)),
        y: clamp01(gaussian(random, 0.5, 0.22)),
        label: 1,
      })),
    ];
  }, []);

  const gini = (subset: Array<{ label: number }>): number => {
    if (subset.length === 0) return 0;
    const p = subset.filter((s) => s.label === 0).length / subset.length;
    return 1 - (p * p + (1 - p) ** 2);
  };

  const left = points.filter((p) => p[feature] < threshold);
  const right = points.filter((p) => p[feature] >= threshold);

  const parentGini = gini(points);
  const weighted =
    (left.length / points.length) * gini(left) + (right.length / points.length) * gini(right);
  const gain = parentGini - weighted;

  /** The best achievable gain over every candidate threshold on this feature. */
  const bestGain = useMemo(() => {
    let best = 0;
    let bestT = 0.5;
    for (let t = 0.05; t <= 0.95; t += 0.01) {
      const l = points.filter((p) => p[feature] < t);
      const r = points.filter((p) => p[feature] >= t);
      const w = (l.length / points.length) * gini(l) + (r.length / points.length) * gini(r);
      const g = parentGini - w;
      if (g > best) {
        best = g;
        bestT = t;
      }
    }
    return { gain: best, threshold: bestT };
  }, [points, feature, parentGini]);

  return (
    <View>
      <PlotCanvas height={200}>
        {(size) => (
          <>
            {feature === 'x' ? (
              <Line from={{ x: threshold, y: 0 }} to={{ x: threshold, y: 1 }} size={size} color={theme.colors.warning} thickness={3} />
            ) : (
              <Line from={{ x: 0, y: threshold }} to={{ x: 1, y: threshold }} size={size} color={theme.colors.warning} thickness={3} />
            )}
            {points.map((p, i) => (
              <Dot key={i} point={p} size={size} color={colors[p.label]!} radius={5} />
            ))}
          </>
        )}
      </PlotCanvas>

      <View style={{ marginTop: theme.spacing.lg }}>
        <SegmentedControl
          options={['x', 'y'] as const}
          value={feature}
          onChange={setFeature}
          label="Split on feature"
        />
        <Slider value={threshold} min={0.05} max={0.95} step={0.01} onChange={setThreshold} label="Threshold" color={theme.colors.warning} />
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
        {[
          { name: `${feature} < ${threshold.toFixed(2)}`, subset: left },
          { name: `${feature} ≥ ${threshold.toFixed(2)}`, subset: right },
        ].map((node) => (
          <View
            key={node.name}
            style={{
              flex: 1,
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            <Text variant="label" tone="tertiary" caps>
              {node.name}
            </Text>
            <Text variant="caption" mono style={{ marginTop: 4 }}>
              n = {node.subset.length}
            </Text>
            <Text variant="caption" mono tone="secondary">
              gini = {gini(node.subset).toFixed(3)}
            </Text>
          </View>
        ))}
      </View>

      <Readout
        items={[
          { label: 'Parent gini', value: parentGini.toFixed(3) },
          {
            label: 'Information gain',
            value: gain.toFixed(3),
            color: gain > bestGain.gain * 0.95 ? theme.colors.success : theme.colors.warning,
          },
          { label: 'Best possible', value: bestGain.gain.toFixed(3), color: theme.colors.textTertiary },
        ]}
      />

      <ActionRow
        actions={[
          { label: 'Show the best split', onPress: () => setThreshold(Math.round(bestGain.threshold * 100) / 100), primary: true },
        ]}
      />

      <Note>
        The algorithm tries every feature and every threshold and keeps whichever maximises information
        gain. Switch to feature y and notice the best achievable gain collapses — the classes are not
        separated along that axis, so no threshold on it helps.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ensemble-vote
// ---------------------------------------------------------------------------

export function EnsembleVote(): React.JSX.Element {
  const theme = useTheme();
  const [members, setMembers] = useState(1);
  const [correlation, setCorrelation] = useState(0.1);

  const individualAccuracy = 0.62;

  /**
   * Effective ensemble accuracy under a majority vote of correlated learners.
   * With independent members it approaches 1 quickly; as correlation rises the
   * effective number of independent votes collapses toward one.
   */
  const ensembleAccuracy = useMemo(() => {
    const effective = 1 + (members - 1) * (1 - correlation);
    const variance = (individualAccuracy * (1 - individualAccuracy)) / effective;
    const z = (individualAccuracy - 0.5) / Math.sqrt(Math.max(variance, 1e-9));
    // Normal CDF approximation.
    const cdf = 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z * z * z)));
    return Math.min(0.999, Math.max(individualAccuracy, cdf));
  }, [members, correlation]);

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: theme.spacing.lg }}>
        {Array.from({ length: members }, (_, i) => (
          <View
            key={i}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              backgroundColor: theme.colors.primary,
              opacity: 0.4 + 0.6 * (1 - correlation),
            }}
          />
        ))}
      </View>

      <Slider value={members} min={1} max={40} step={1} onChange={setMembers} label="Number of weak learners" format={(v) => v.toFixed(0)} />
      <Slider
        value={correlation}
        min={0}
        max={0.95}
        step={0.01}
        onChange={setCorrelation}
        label="Correlation between them"
        format={(v) => v.toFixed(2)}
        color={correlation > 0.6 ? theme.colors.danger : theme.colors.info}
      />

      <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text variant="caption" tone="secondary">One weak learner</Text>
            <Text variant="caption" mono tone="tertiary">{(individualAccuracy * 100).toFixed(1)}%</Text>
          </View>
          <Bar fraction={individualAccuracy} color={theme.colors.textTertiary} height={10} />
        </View>
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text variant="caption" tone="secondary">The ensemble</Text>
            <Text variant="caption" mono tone="tertiary">{(ensembleAccuracy * 100).toFixed(1)}%</Text>
          </View>
          <Bar fraction={ensembleAccuracy} color={theme.colors.success} height={10} />
        </View>
      </View>

      <Readout
        items={[
          { label: 'Gain over one', value: `+${((ensembleAccuracy - individualAccuracy) * 100).toFixed(1)} pts`, color: theme.colors.success },
          { label: 'Effective votes', value: (1 + (members - 1) * (1 - correlation)).toFixed(1) },
        ]}
      />

      {correlation > 0.7 ? (
        <Badge label="Highly correlated members make the same mistakes — averaging cannot cancel them" tone="danger" style={{ marginTop: theme.spacing.md }} />
      ) : null}

      <Note>
        Averaging works because the members' errors cancel — and errors only cancel when they are
        different. Push correlation toward 1 and forty models perform like one. This is exactly why
        Random Forest randomises both rows and features: the randomness is not incidental, it is the
        mechanism.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// pca-projection
// ---------------------------------------------------------------------------

export function PcaProjection(): React.JSX.Element {
  const theme = useTheme();
  const [angleDeg, setAngle] = useState(30);

  const points = useMemo(() => {
    const random = makeRandom(5);
    // A correlated cloud stretched along roughly 35°.
    return Array.from({ length: 40 }, () => {
      const t = gaussian(random, 0, 0.22);
      const n = gaussian(random, 0, 0.06);
      return { x: clamp01(0.5 + t * 0.82 - n * 0.57), y: clamp01(0.5 + t * 0.57 + n * 0.82) };
    });
  }, []);

  const angle = (angleDeg * Math.PI) / 180;
  const axis = { x: Math.cos(angle), y: Math.sin(angle) };

  const stats = useMemo(() => {
    const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const my = points.reduce((s, p) => s + p.y, 0) / points.length;
    const projections = points.map((p) => (p.x - mx) * axis.x + (p.y - my) * axis.y);
    const mean = projections.reduce((s, v) => s + v, 0) / projections.length;
    const variance = projections.reduce((s, v) => s + (v - mean) ** 2, 0) / projections.length;

    // Total variance is direction-independent, so the ratio is the % explained.
    const total =
      points.reduce((s, p) => s + (p.x - mx) ** 2 + (p.y - my) ** 2, 0) / points.length;
    return { mx, my, variance, explained: total === 0 ? 0 : variance / total, projections };
  }, [points, axis]);

  const bestAngle = useMemo(() => {
    let best = 0;
    let bestVar = -1;
    for (let deg = 0; deg < 180; deg += 1) {
      const a = (deg * Math.PI) / 180;
      const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
      const my = points.reduce((s, p) => s + p.y, 0) / points.length;
      const proj = points.map((p) => (p.x - mx) * Math.cos(a) + (p.y - my) * Math.sin(a));
      const m = proj.reduce((s, v) => s + v, 0) / proj.length;
      const v = proj.reduce((s, x) => s + (x - m) ** 2, 0) / proj.length;
      if (v > bestVar) {
        bestVar = v;
        best = deg;
      }
    }
    return best;
  }, [points]);

  return (
    <View>
      <PlotCanvas height={210}>
        {(size) => (
          <>
            <Line
              from={{ x: clamp01(stats.mx - axis.x * 0.6), y: clamp01(stats.my - axis.y * 0.6) }}
              to={{ x: clamp01(stats.mx + axis.x * 0.6), y: clamp01(stats.my + axis.y * 0.6) }}
              size={size}
              color={theme.colors.warning}
              thickness={3}
            />
            {points.map((p, i) => {
              const t = stats.projections[i]!;
              const projected = { x: clamp01(stats.mx + axis.x * t), y: clamp01(stats.my + axis.y * t) };
              return (
                <React.Fragment key={i}>
                  <Line from={p} to={projected} size={size} color={theme.colors.border} thickness={1} />
                  <Dot point={p} size={size} color={theme.colors.info} radius={4} />
                  <Dot point={projected} size={size} color={theme.colors.warning} radius={3} />
                </React.Fragment>
              );
            })}
          </>
        )}
      </PlotCanvas>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Slider value={angleDeg} min={0} max={179} step={1} onChange={setAngle} label="Projection angle" format={(v) => `${v.toFixed(0)}°`} color={theme.colors.warning} />
      </View>

      <Readout
        items={[
          {
            label: 'Variance explained',
            value: `${(stats.explained * 100).toFixed(1)}%`,
            color: stats.explained > 0.85 ? theme.colors.success : theme.colors.warning,
          },
          { label: 'Best angle', value: `${bestAngle}°`, color: theme.colors.textTertiary },
        ]}
      />

      <ActionRow actions={[{ label: 'Snap to PC1', onPress: () => setAngle(bestAngle), primary: true }]} />

      <Note>
        Each grey line is a point being projected onto the axis. Rotate to find the direction where the
        projected points spread out most — that direction *is* the first principal component. There is
        nothing more mysterious to it than maximising the variance you keep.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// anomaly-detection
// ---------------------------------------------------------------------------

export function AnomalyDetection(): React.JSX.Element {
  const theme = useTheme();
  const [threshold, setThreshold] = useState(0.75);

  const data = useMemo(() => {
    const random = makeRandom(19);
    const normal = Array.from({ length: 60 }, () => ({ v: clamp01(gaussian(random, 0.4, 0.11)), anomaly: false }));
    const anomalies = Array.from({ length: 6 }, () => ({ v: clamp01(gaussian(random, 0.82, 0.07)), anomaly: true }));
    return [...normal, ...anomalies];
  }, []);

  const flagged = data.filter((d) => d.v >= threshold);
  const tp = flagged.filter((d) => d.anomaly).length;
  const fp = flagged.length - tp;
  const fn = data.filter((d) => d.anomaly).length - tp;
  const precision = flagged.length === 0 ? 0 : tp / flagged.length;
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);

  return (
    <View>
      <PlotCanvas height={160}>
        {(size) => (
          <>
            <Line from={{ x: threshold, y: 0 }} to={{ x: threshold, y: 1 }} size={size} color={theme.colors.warning} thickness={3} />
            {data.map((d, i) => (
              <Dot
                key={i}
                point={{ x: d.v, y: 0.15 + ((i * 37) % 70) / 100 }}
                size={size}
                color={d.anomaly ? theme.colors.danger : theme.colors.info}
                radius={d.anomaly ? 6 : 4}
              />
            ))}
          </>
        )}
      </PlotCanvas>

      <View style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.info }} />
          <Text variant="label" tone="tertiary">Normal</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.danger }} />
          <Text variant="label" tone="tertiary">True anomaly</Text>
        </View>
      </View>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider value={threshold} min={0.3} max={0.98} step={0.01} onChange={setThreshold} label="Anomaly threshold" color={theme.colors.warning} />
      </View>

      <Readout
        items={[
          { label: 'Caught', value: `${tp}/${tp + fn}`, color: theme.colors.success },
          { label: 'False alarms', value: String(fp), color: fp > 5 ? theme.colors.danger : theme.colors.textSecondary },
          { label: 'Precision', value: `${(precision * 100).toFixed(0)}%` },
          { label: 'Recall', value: `${(recall * 100).toFixed(0)}%` },
        ]}
      />

      <Note>
        The two distributions overlap, so there is no threshold that catches every anomaly without any
        false alarms. Where you put the line is a decision about which error costs more — and that is a
        judgement about consequences, not a technical question the model can answer for you.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// roc-curve
// ---------------------------------------------------------------------------

export function RocCurve(): React.JSX.Element {
  const theme = useTheme();
  const [threshold, setThreshold] = useState(0.5);
  const [imbalanced, setImbalanced] = useState(false);

  const data = useMemo(() => {
    const random = makeRandom(31);
    const positives = Array.from({ length: imbalanced ? 15 : 60 }, () => ({
      score: clamp01(gaussian(random, 0.68, 0.16)),
      actual: true,
    }));
    const negatives = Array.from({ length: imbalanced ? 1200 : 60 }, () => ({
      score: clamp01(gaussian(random, 0.34, 0.16)),
      actual: false,
    }));
    return [...positives, ...negatives];
  }, [imbalanced]);

  const metricsAt = useCallback(
    (t: number) => {
      let tp = 0, fp = 0, fn = 0, tn = 0;
      for (const d of data) {
        const predicted = d.score >= t;
        if (d.actual && predicted) tp += 1;
        else if (!d.actual && predicted) fp += 1;
        else if (d.actual && !predicted) fn += 1;
        else tn += 1;
      }
      return {
        tpr: tp + fn === 0 ? 0 : tp / (tp + fn),
        fpr: fp + tn === 0 ? 0 : fp / (fp + tn),
        precision: tp + fp === 0 ? 1 : tp / (tp + fp),
        tp, fp, fn, tn,
      };
    },
    [data],
  );

  const curve = useMemo(() => {
    const pts: UnitPoint[] = [];
    for (let t = 1; t >= 0; t -= 0.02) {
      const m = metricsAt(t);
      pts.push({ x: m.fpr, y: m.tpr });
    }
    return pts;
  }, [metricsAt]);

  const auc = useMemo(() => {
    let area = 0;
    for (let i = 1; i < curve.length; i += 1) {
      const a = curve[i - 1]!;
      const b = curve[i]!;
      area += (b.x - a.x) * ((a.y + b.y) / 2);
    }
    return Math.abs(area);
  }, [curve]);

  const current = metricsAt(threshold);

  return (
    <View>
      <SegmentedControl
        options={['Balanced', 'Imbalanced (1%)'] as const}
        value={imbalanced ? 'Imbalanced (1%)' : 'Balanced'}
        onChange={(v) => setImbalanced(v === 'Imbalanced (1%)')}
        label="Dataset"
      />

      <PlotCanvas height={190}>
        {(size) => (
          <>
            <Line from={{ x: 0, y: 0 }} to={{ x: 1, y: 1 }} size={size} color={theme.colors.border} thickness={1} dashed />
            <Path points={curve} size={size} color={theme.colors.primary} thickness={2} />
            <Dot point={{ x: current.fpr, y: current.tpr }} size={size} color={theme.colors.warning} radius={8} hollow />
          </>
        )}
      </PlotCanvas>

      <Text variant="label" tone="tertiary" caps align="center" style={{ marginTop: 4 }}>
        False positive rate → · true positive rate ↑
      </Text>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider value={threshold} min={0.02} max={0.98} step={0.01} onChange={setThreshold} label="Decision threshold" color={theme.colors.warning} />
      </View>

      <Readout
        items={[
          { label: 'ROC-AUC', value: auc.toFixed(3), color: theme.colors.primary },
          { label: 'Recall (TPR)', value: `${(current.tpr * 100).toFixed(0)}%` },
          {
            label: 'Precision',
            value: `${(current.precision * 100).toFixed(0)}%`,
            color: current.precision < 0.3 ? theme.colors.danger : theme.colors.success,
          },
          { label: 'False positives', value: String(current.fp) },
        ]}
      />

      {imbalanced && current.precision < 0.3 ? (
        <Badge
          label={`AUC ${auc.toFixed(2)} looks strong — precision is ${(current.precision * 100).toFixed(0)}%`}
          tone="danger"
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}

      <Note>
        Switch to the imbalanced dataset. ROC-AUC barely moves, because false positive rate has 1,200
        negatives in its denominator and hundreds of false alarms hardly register. Precision has the
        flagged set as its denominator and tells you the truth: most of your alerts are wrong.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// regularization
// ---------------------------------------------------------------------------

export function Regularization(): React.JSX.Element {
  const theme = useTheme();
  const [penalty, setPenalty] = useState(0);
  const [mode, setMode] = useState<'L1 (Lasso)' | 'L2 (Ridge)'>('L1 (Lasso)');

  // Unregularised coefficients: a few strong, several weak and noisy.
  const base = useMemo(() => [0.92, -0.71, 0.44, 0.19, -0.12, 0.07, -0.04, 0.02], []);

  const coefficients = base.map((w) => {
    if (mode === 'L1 (Lasso)') {
      // Soft thresholding — the closed-form L1 proximal operator.
      const shrunk = Math.max(0, Math.abs(w) - penalty);
      return Math.sign(w) * shrunk;
    }
    // L2 shrinks proportionally and never reaches zero.
    return w / (1 + penalty * 4);
  });

  const zeroed = coefficients.filter((w) => Math.abs(w) < 1e-9).length;
  const maxAbs = Math.max(...base.map(Math.abs));

  return (
    <View>
      <SegmentedControl
        options={['L1 (Lasso)', 'L2 (Ridge)'] as const}
        value={mode}
        onChange={setMode}
        label="Penalty type"
      />

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        {coefficients.map((w, i) => {
          const dead = Math.abs(w) < 1e-9;
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Text variant="label" tone="tertiary" style={{ width: 28 }}>
                w{i + 1}
              </Text>
              <View style={{ flex: 1, height: 14, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  {w < 0 ? (
                    <View style={{ width: `${(Math.abs(w) / maxAbs) * 100}%`, height: 10, backgroundColor: theme.colors.danger, borderRadius: 2 }} />
                  ) : null}
                </View>
                <View style={{ width: 1, height: 14, backgroundColor: theme.colors.borderStrong }} />
                <View style={{ flex: 1 }}>
                  {w > 0 ? (
                    <View style={{ width: `${(Math.abs(w) / maxAbs) * 100}%`, height: 10, backgroundColor: theme.colors.primary, borderRadius: 2 }} />
                  ) : null}
                </View>
              </View>
              <Text variant="label" mono tone={dead ? 'danger' : 'tertiary'} style={{ width: 44, textAlign: 'right' }}>
                {dead ? '0' : w.toFixed(2)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Slider value={penalty} min={0} max={0.6} step={0.01} onChange={setPenalty} label="Penalty strength λ" />
      </View>

      <Readout
        items={[
          {
            label: 'Weights at exactly zero',
            value: `${zeroed}/${base.length}`,
            color: zeroed > 0 ? theme.colors.success : theme.colors.textSecondary,
          },
          { label: 'Model', value: mode === 'L1 (Lasso)' ? 'Sparse' : 'Dense' },
        ]}
      />

      <Note>
        L1's gradient is constant all the way down, so weak weights hit exactly zero and drop out of the
        model — feature selection as a side effect of the penalty. L2's gradient shrinks with the weight,
        so coefficients approach zero asymptotically and never arrive. That single difference is why L1
        gives you a short, readable model and L2 does not.
      </Note>
    </View>
  );
}
