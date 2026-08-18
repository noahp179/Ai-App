/**
 * Deep learning widgets.
 *
 * `NeuralNetTrainer` runs a genuine MLP — real forward pass, real
 * backpropagation, real gradient descent — in a few dozen lines. Watching a
 * network you configured actually fail to learn XOR without a hidden layer is
 * worth more than any diagram of the same fact.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Badge, Text, useTheme } from '@synapse/ui';

import { Slider } from '../Slider.js';
import {
  ActionRow,
  Dot,
  Note,
  Path,
  PlotCanvas,
  Readout,
  SegmentedControl,
  clamp01,
  gaussian,
  makeRandom,
  type UnitPoint,
} from './shared.js';

// ---------------------------------------------------------------------------
// activation-explorer
// ---------------------------------------------------------------------------

const ACTIVATIONS = ['ReLU', 'Sigmoid', 'Tanh', 'GELU', 'Leaky ReLU'] as const;
type Activation = (typeof ACTIVATIONS)[number];

const ACTIVATION_FNS: Record<Activation, { f: (z: number) => number; df: (z: number) => number; note: string }> = {
  ReLU: {
    f: (z) => Math.max(0, z),
    df: (z) => (z > 0 ? 1 : 0),
    note: 'Derivative is exactly 1 for positive inputs — gradients pass through undiminished. But it is exactly 0 for negatives, so a unit pushed negative can die permanently.',
  },
  Sigmoid: {
    f: (z) => 1 / (1 + Math.exp(-z)),
    df: (z) => {
      const s = 1 / (1 + Math.exp(-z));
      return s * (1 - s);
    },
    note: 'Derivative peaks at just 0.25 and vanishes at both ends. Chain fifty of these and the gradient reaching layer one is effectively zero — this is why deep networks were untrainable before ReLU.',
  },
  Tanh: {
    f: (z) => Math.tanh(z),
    df: (z) => 1 - Math.tanh(z) ** 2,
    note: 'Zero-centred, which helps optimisation, and its derivative peaks at 1 rather than 0.25. Still saturates at both ends.',
  },
  GELU: {
    f: (z) => 0.5 * z * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (z + 0.044715 * z ** 3))),
    df: (z) => {
      const h = 1e-4;
      const g = (x: number): number => 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
      return (g(z + h) - g(z - h)) / (2 * h);
    },
    note: 'A smooth gate — small negative values pass partially rather than being clipped. Standard in transformers, and its smoothness helps optimisation.',
  },
  'Leaky ReLU': {
    f: (z) => (z > 0 ? z : 0.1 * z),
    df: (z) => (z > 0 ? 1 : 0.1),
    note: 'ReLU with a small negative slope, so no unit can ever have exactly zero gradient. Directly fixes the dying-ReLU problem.',
  },
};

export function ActivationExplorer(): React.JSX.Element {
  const theme = useTheme();
  const [activation, setActivation] = useState<Activation>('ReLU');
  const { f, df, note } = ACTIVATION_FNS[activation];

  const RANGE = 5;
  const toUnit = (z: number, value: number, scale: number): UnitPoint => ({
    x: (z + RANGE) / (2 * RANGE),
    y: clamp01(0.5 + value / scale),
  });

  const curve = useMemo(() => {
    const pts: UnitPoint[] = [];
    for (let z = -RANGE; z <= RANGE; z += 0.1) pts.push(toUnit(z, f(z), 6));
    return pts;
  }, [f]);

  const derivative = useMemo(() => {
    const pts: UnitPoint[] = [];
    for (let z = -RANGE; z <= RANGE; z += 0.1) pts.push(toUnit(z, df(z) * 2, 6));
    return pts;
  }, [df]);

  return (
    <View>
      <SegmentedControl options={ACTIVATIONS} value={activation} onChange={setActivation} label="Activation" />

      <PlotCanvas height={200}>
        {(size) => (
          <>
            {/* Axes */}
            <View style={{ position: 'absolute', left: 0, right: 0, top: size.height / 2, height: 1, backgroundColor: theme.colors.border }} />
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: size.width / 2, width: 1, backgroundColor: theme.colors.border }} />
            <Path points={curve} size={size} color={theme.colors.primary} thickness={3} />
            <Path points={derivative} size={size} color={theme.colors.warning} thickness={2} />
          </>
        )}
      </PlotCanvas>

      <View style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 12, height: 3, backgroundColor: theme.colors.primary }} />
          <Text variant="label" tone="tertiary">f(z)</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 12, height: 3, backgroundColor: theme.colors.warning }} />
          <Text variant="label" tone="tertiary">f'(z) — the gradient</Text>
        </View>
      </View>

      <Readout
        items={[
          { label: 'f(-2)', value: f(-2).toFixed(3) },
          { label: 'f(2)', value: f(2).toFixed(3) },
          { label: "max f'", value: Math.max(df(0), df(1), df(-1), df(3)).toFixed(3), color: theme.colors.warning },
        ]}
      />

      <Note>{note}</Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// convolution
// ---------------------------------------------------------------------------

const KERNELS: Record<string, number[][]> = {
  'Edge detect': [
    [-1, -1, -1],
    [-1, 8, -1],
    [-1, -1, -1],
  ],
  'Vertical edges': [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ],
  Blur: [
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
  ],
  Sharpen: [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ],
};

export function Convolution(): React.JSX.Element {
  const theme = useTheme();
  const [kernelName, setKernelName] = useState<string>('Edge detect');
  const [position, setPosition] = useState(0);

  const SIZE = 8;
  const image = useMemo(() => {
    // A simple shape: a bright square on a dark field, with a soft edge.
    return Array.from({ length: SIZE }, (_, r) =>
      Array.from({ length: SIZE }, (_, c) => (r >= 2 && r <= 5 && c >= 2 && c <= 5 ? 0.9 : 0.1)),
    );
  }, []);

  const kernel = KERNELS[kernelName]!;
  const outSize = SIZE - 2;
  const totalPositions = outSize * outSize;
  const activeRow = Math.floor(Math.min(position, totalPositions - 1) / outSize);
  const activeCol = Math.min(position, totalPositions - 1) % outSize;

  const featureMap = useMemo(() => {
    return Array.from({ length: outSize }, (_, r) =>
      Array.from({ length: outSize }, (_, c) => {
        let sum = 0;
        for (let kr = 0; kr < 3; kr += 1) {
          for (let kc = 0; kc < 3; kc += 1) {
            sum += (image[r + kr]?.[c + kc] ?? 0) * (kernel[kr]?.[kc] ?? 0);
          }
        }
        return sum;
      }),
    );
  }, [image, kernel, outSize]);

  const currentValue = featureMap[activeRow]?.[activeCol] ?? 0;

  const cell = (value: number, highlighted: boolean, key: string): React.JSX.Element => (
    <View
      key={key}
      style={{
        flex: 1,
        aspectRatio: 1,
        margin: 1,
        borderRadius: 2,
        backgroundColor: `rgba(226, 232, 240, ${clamp01(Math.abs(value))})`,
        borderWidth: highlighted ? 2 : 0,
        borderColor: theme.colors.warning,
      }}
    />
  );

  return (
    <View>
      <SegmentedControl options={Object.keys(KERNELS)} value={kernelName} onChange={setKernelName} label="Kernel" />

      <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: 4 }}>
            Input
          </Text>
          {image.map((row, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {row.map((v, c) =>
                cell(v, r >= activeRow && r < activeRow + 3 && c >= activeCol && c < activeCol + 3, `${r}-${c}`),
              )}
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }}>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: 4 }}>
            Feature map
          </Text>
          {featureMap.map((row, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {row.map((v, c) => cell(v, r === activeRow && c === activeCol, `f-${r}-${c}`))}
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          marginTop: theme.spacing.lg,
          padding: theme.spacing.md,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <Text variant="label" tone="tertiary" caps style={{ marginBottom: 4 }}>
          Kernel at position ({activeRow}, {activeCol})
        </Text>
        {kernel.map((row, r) => (
          <Text key={r} variant="caption" mono tone="secondary">
            {row.map((v) => v.toFixed(2).padStart(6)).join(' ')}
          </Text>
        ))}
        <Text variant="caption" mono style={{ marginTop: theme.spacing.sm, color: theme.colors.warning }}>
          output = {currentValue.toFixed(3)}
        </Text>
      </View>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider
          value={position}
          min={0}
          max={totalPositions - 1}
          step={1}
          onChange={setPosition}
          label="Kernel position"
          format={(v) => `${v.toFixed(0)} / ${totalPositions - 1}`}
          color={theme.colors.warning}
        />
      </View>

      <Note>
        Step the kernel across the image and watch each output value get computed as one elementwise
        multiply-and-sum. The same nine numbers are reused at every position — that is weight sharing,
        and it is why a convolutional layer needs 28 parameters where a fully connected one would need
        millions.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// neural-net-trainer
// ---------------------------------------------------------------------------

type DatasetName = 'XOR' | 'Circle' | 'Two blobs';

interface Sample {
  x: number;
  y: number;
  label: number;
}

function makeDataset(name: DatasetName): Sample[] {
  const random = makeRandom(name.length * 13 + 3);
  const out: Sample[] = [];

  for (let i = 0; i < 80; i += 1) {
    const x = random();
    const y = random();
    let label = 0;

    if (name === 'XOR') label = (x > 0.5) !== (y > 0.5) ? 1 : 0;
    else if (name === 'Circle') label = Math.hypot(x - 0.5, y - 0.5) < 0.28 ? 1 : 0;
    else label = x + y > 1 ? 1 : 0;

    out.push({ x, y, label });
  }
  return out;
}

/**
 * A minimal MLP with one optional hidden layer, trained by full-batch gradient
 * descent. Deliberately small and explicit — the whole point is that the reader
 * can see there is no magic in it.
 */
class TinyNet {
  private w1: number[][] = [];
  private b1: number[] = [];
  private w2: number[] = [];
  private b2 = 0;

  constructor(
    private readonly hidden: number,
    seed: number,
  ) {
    const random = makeRandom(seed);
    // He-style initialisation keeps the initial activations well-scaled.
    const scale = Math.sqrt(2 / Math.max(1, 2));
    this.w1 = Array.from({ length: hidden }, () => [gaussian(random, 0, scale), gaussian(random, 0, scale)]);
    this.b1 = Array.from({ length: hidden }, () => 0);
    this.w2 = Array.from({ length: Math.max(1, hidden) }, () => gaussian(random, 0, scale));
    this.b2 = 0;
  }

  private static relu(z: number): number {
    return Math.max(0, z);
  }
  private static sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
  }

  forward(x: number, y: number): { hidden: number[]; output: number } {
    if (this.hidden === 0) {
      // No hidden layer: a plain logistic regression on the two inputs.
      const z = this.w2[0]! * x + (this.w2[1] ?? 0) * y + this.b2;
      return { hidden: [], output: TinyNet.sigmoid(z) };
    }
    const hidden = this.w1.map((w, i) => TinyNet.relu(w[0]! * x + w[1]! * y + this.b1[i]!));
    const z = hidden.reduce((s, h, i) => s + h * this.w2[i]!, this.b2);
    return { hidden, output: TinyNet.sigmoid(z) };
  }

  /** One full-batch gradient step. Returns the mean binary cross-entropy. */
  trainStep(data: Sample[], lr: number): number {
    const n = data.length;
    let loss = 0;

    const gw1 = this.w1.map(() => [0, 0]);
    const gb1 = this.b1.map(() => 0);
    const gw2 = this.w2.map(() => 0);
    let gb2 = 0;

    for (const sample of data) {
      const { hidden, output } = this.forward(sample.x, sample.y);
      const p = Math.min(1 - 1e-7, Math.max(1e-7, output));
      loss += -(sample.label * Math.log(p) + (1 - sample.label) * Math.log(1 - p));

      // dL/dz for sigmoid + BCE simplifies to (prediction − target).
      const dz = output - sample.label;

      if (this.hidden === 0) {
        gw2[0]! += dz * sample.x;
        if (gw2.length > 1) gw2[1]! += dz * sample.y;
        gb2 += dz;
        continue;
      }

      hidden.forEach((h, i) => {
        gw2[i]! += dz * h;
        // ReLU derivative gates the gradient flowing back into the hidden unit.
        const dh = dz * this.w2[i]! * (h > 0 ? 1 : 0);
        gw1[i]![0]! += dh * sample.x;
        gw1[i]![1]! += dh * sample.y;
        gb1[i]! += dh;
      });
      gb2 += dz;
    }

    this.w2 = this.w2.map((w, i) => w - (lr * gw2[i]!) / n);
    this.b2 -= (lr * gb2) / n;
    if (this.hidden > 0) {
      this.w1 = this.w1.map((w, i) => [w[0]! - (lr * gw1[i]![0]!) / n, w[1]! - (lr * gw1[i]![1]!) / n]);
      this.b1 = this.b1.map((b, i) => b - (lr * gb1[i]!) / n);
    }

    return loss / n;
  }

  accuracy(data: Sample[]): number {
    const correct = data.filter((s) => (this.forward(s.x, s.y).output >= 0.5 ? 1 : 0) === s.label).length;
    return correct / data.length;
  }
}

export function NeuralNetTrainer(): React.JSX.Element {
  const theme = useTheme();
  const [dataset, setDataset] = useState<DatasetName>('XOR');
  const [hidden, setHidden] = useState(4);
  const [lr, setLr] = useState(0.5);
  const [epoch, setEpoch] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [accuracy, setAccuracy] = useState(0);
  const [, forceRender] = useState(0);

  const data = useMemo(() => makeDataset(dataset), [dataset]);
  const netRef = useRef(new TinyNet(hidden, 7));

  const reset = useCallback(() => {
    netRef.current = new TinyNet(hidden, 7 + epoch);
    setEpoch(0);
    setHistory([]);
    setAccuracy(0);
    forceRender((v) => v + 1);
  }, [hidden, epoch]);

  // Rebuild the net whenever its shape changes.
  const shapeKey = `${hidden}-${dataset}`;
  const [lastShape, setLastShape] = useState(shapeKey);
  if (shapeKey !== lastShape) {
    setLastShape(shapeKey);
    netRef.current = new TinyNet(hidden, 7);
    setEpoch(0);
    setHistory([]);
    setAccuracy(0);
  }

  const train = (steps: number): void => {
    let loss = 0;
    for (let i = 0; i < steps; i += 1) loss = netRef.current.trainStep(data, lr);
    setEpoch((e) => e + steps);
    setHistory((h) => [...h.slice(-59), loss]);
    setAccuracy(netRef.current.accuracy(data));
    forceRender((v) => v + 1);
  };

  // Sample the decision surface on a coarse grid.
  const GRID = 14;
  const surface = useMemo(() => {
    const cells: Array<{ x: number; y: number; p: number }> = [];
    for (let r = 0; r < GRID; r += 1) {
      for (let c = 0; c < GRID; c += 1) {
        const x = (c + 0.5) / GRID;
        const y = (r + 0.5) / GRID;
        cells.push({ x, y, p: netRef.current.forward(x, y).output });
      }
    }
    return cells;
    // Recomputed on every render tick, which is what makes training visible.
  }, [epoch, hidden, dataset, lr]);

  const lossCurve = useMemo<UnitPoint[]>(() => {
    if (history.length < 2) return [];
    const max = Math.max(...history, 0.1);
    return history.map((v, i) => ({ x: i / (history.length - 1), y: clamp01(v / max) }));
  }, [history]);

  return (
    <View>
      <SegmentedControl options={['XOR', 'Circle', 'Two blobs'] as const} value={dataset} onChange={setDataset} label="Dataset" />

      <PlotCanvas height={210}>
        {(size) => (
          <>
            {surface.map((cell, i) => (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (cell.x - 0.5 / GRID) * size.width,
                  top: (1 - cell.y - 0.5 / GRID) * size.height,
                  width: size.width / GRID + 1,
                  height: size.height / GRID + 1,
                  backgroundColor:
                    cell.p >= 0.5
                      ? `rgba(139, 92, 246, ${(cell.p - 0.5) * 0.9})`
                      : `rgba(251, 191, 36, ${(0.5 - cell.p) * 0.9})`,
                }}
              />
            ))}
            {data.map((s, i) => (
              <Dot
                key={i}
                point={{ x: s.x, y: s.y }}
                size={size}
                color={s.label === 1 ? theme.colors.primary : theme.colors.warning}
                radius={4}
              />
            ))}
          </>
        )}
      </PlotCanvas>

      {lossCurve.length > 1 ? (
        <View style={{ marginTop: theme.spacing.sm }}>
          <Text variant="label" tone="tertiary" caps>
            Loss
          </Text>
          <PlotCanvas height={60}>
            {(size) => <Path points={lossCurve} size={size} color={theme.colors.success} thickness={2} />}
          </PlotCanvas>
        </View>
      ) : null}

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider value={hidden} min={0} max={8} step={1} onChange={setHidden} label="Hidden units (0 = no hidden layer)" format={(v) => v.toFixed(0)} />
        <Slider value={lr} min={0.05} max={3} step={0.05} onChange={setLr} label="Learning rate" color={theme.colors.info} />
      </View>

      <Readout
        items={[
          { label: 'Epoch', value: String(epoch) },
          { label: 'Loss', value: history.length ? history[history.length - 1]!.toFixed(4) : '—' },
          {
            label: 'Accuracy',
            value: `${(accuracy * 100).toFixed(1)}%`,
            color: accuracy > 0.9 ? theme.colors.success : theme.colors.warning,
          },
        ]}
      />

      <ActionRow
        actions={[
          { label: 'Train 50', onPress: () => train(50), primary: true },
          { label: 'Train 500', onPress: () => train(500) },
          { label: 'Reset', onPress: reset },
        ]}
      />

      {dataset === 'XOR' && hidden === 0 && epoch > 200 ? (
        <Badge
          label="Stuck near 50% — XOR is not linearly separable, and with no hidden layer this network cannot represent it at all"
          tone="danger"
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}

      <Note>
        This is a real network: real forward pass, real backpropagation, real gradient descent. Set
        hidden units to 0 and train on XOR — it can never get past chance, because a model with no
        nonlinearity is a straight line and XOR has no straight line. Add one hidden unit at a time and
        watch the boundary start to bend.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// learning-rate-schedule
// ---------------------------------------------------------------------------

const SCHEDULES = ['Constant', 'Step decay', 'Cosine', 'Warmup + cosine'] as const;
type Schedule = (typeof SCHEDULES)[number];

export function LearningRateSchedule(): React.JSX.Element {
  const theme = useTheme();
  const [schedule, setSchedule] = useState<Schedule>('Warmup + cosine');
  const [peak, setPeak] = useState(1);

  const STEPS = 100;
  const WARMUP = 10;

  const rateAt = useCallback(
    (step: number): number => {
      const t = step / STEPS;
      switch (schedule) {
        case 'Constant':
          return peak;
        case 'Step decay':
          return peak * Math.pow(0.1, Math.floor(step / 33));
        case 'Cosine':
          return peak * 0.5 * (1 + Math.cos(Math.PI * t));
        case 'Warmup + cosine': {
          if (step < WARMUP) return (peak * step) / WARMUP;
          const progress = (step - WARMUP) / (STEPS - WARMUP);
          return peak * 0.5 * (1 + Math.cos(Math.PI * progress));
        }
      }
    },
    [schedule, peak],
  );

  const curve = useMemo<UnitPoint[]>(
    () => Array.from({ length: STEPS }, (_, i) => ({ x: i / (STEPS - 1), y: clamp01(rateAt(i) / 1.05) })),
    [rateAt],
  );

  /**
   * A crude but honest loss proxy: too-large steps early destabilise, and
   * annealing late lets the model settle. Warmup only pays off at high peaks.
   */
  const finalLoss = useMemo(() => {
    let loss = 1;
    for (let i = 0; i < STEPS; i += 1) {
      const lr = rateAt(i);
      const instability = lr > 1.4 ? (lr - 1.4) * 0.06 : 0;
      loss = Math.max(0.02, loss - lr * 0.012 * loss + instability);
    }
    return loss;
  }, [rateAt]);

  return (
    <View>
      <SegmentedControl options={SCHEDULES} value={schedule} onChange={setSchedule} label="Schedule" />

      <PlotCanvas height={150}>
        {(size) => <Path points={curve} size={size} color={theme.colors.primary} thickness={3} />}
      </PlotCanvas>
      <Text variant="label" tone="tertiary" caps align="center" style={{ marginTop: 4 }}>
        Training step → · learning rate ↑
      </Text>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider value={peak} min={0.1} max={2} step={0.05} onChange={setPeak} label="Peak learning rate" />
      </View>

      <Readout
        items={[
          { label: 'Start', value: rateAt(0).toFixed(3) },
          { label: 'Peak', value: Math.max(...curve.map((p) => p.y * 1.05)).toFixed(3) },
          { label: 'End', value: rateAt(STEPS - 1).toFixed(3) },
          {
            label: 'Final loss',
            value: finalLoss.toFixed(3),
            color: finalLoss < 0.2 ? theme.colors.success : theme.colors.warning,
          },
        ]}
      />

      <Note>
        Constant never settles into a minimum. Step decay works but is crude. Cosine anneals smoothly and
        is the modern default. Warmup matters most at high peak rates: Adam's variance estimates are
        unreliable in the first few hundred steps, and taking full-size steps on unreliable estimates
        destabilises training immediately — push the peak above 1.5 and compare with and without it.
      </Note>
    </View>
  );
}
