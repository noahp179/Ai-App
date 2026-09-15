/**
 * Widgets for the quantum, graphics, robotics and product tracks.
 *
 * The quantum pair exist to replace the "both at once" intuition with
 * something you can actually manipulate — amplitudes that move, and a
 * measurement that destroys them. The PID tuner and the incident timeline are
 * both closer to exercises than to visualisations: they are places to make the
 * standard mistake safely and watch what it does.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, useTheme } from '@synapse/ui';

import { Slider } from '../Slider';
import { ActionRow, Bar, Note, PlotCanvas, Readout, SegmentedControl, makeRandom } from './shared';

// ---------------------------------------------------------------------------
// Bloch sphere
// ---------------------------------------------------------------------------

export function QubitBloch(): React.JSX.Element {
  const theme = useTheme();
  // Polar angle from |0>. 0 = |0>, 180 = |1>, 90 = equal superposition.
  const [theta, setTheta] = useState(0);
  const [measurements, setMeasurements] = useState<number[]>([]);
  const [collapsed, setCollapsed] = useState<number | null>(null);

  const half = (theta * Math.PI) / 360;
  const alpha = Math.cos(half);
  const beta = Math.sin(half);
  const p0 = alpha * alpha;

  const measure = (): void => {
    const random = makeRandom(measurements.length * 31 + Math.round(theta) + 7);
    const outcome = random() < p0 ? 0 : 1;
    setMeasurements((m) => [...m, outcome]);
    setCollapsed(outcome);
  };

  const zeros = measurements.filter((m) => m === 0).length;
  const observed = measurements.length ? zeros / measurements.length : null;

  // Position on a circle standing in for the sphere, |0> at the top.
  const angle = (theta * Math.PI) / 180;
  const x = 0.5 + 0.38 * Math.sin(angle);
  const y = 0.5 - 0.38 * Math.cos(angle);

  return (
    <View>
      <Slider
        label="State"
        value={theta}
        min={0}
        max={180}
        step={5}
        onChange={(v) => {
          setTheta(v);
          setCollapsed(null);
          setMeasurements([]);
        }}
        format={(v) => (v === 0 ? '|0⟩' : v === 180 ? '|1⟩' : v === 90 ? 'equal' : `${v}°`)}
      />

      <PlotCanvas
        height={200}
        accessibilityLabel="The qubit state as a point on a circle, with the zero pole at the top and the one pole at the bottom"
      >
        {({ width, height }) => {
          const toPx = (u: { x: number; y: number }): { x: number; y: number } => ({
            x: u.x * width,
            y: u.y * height,
          });
          const centre = toPx({ x: 0.5, y: 0.5 });
          const point = toPx({ x, y });
          const top = toPx({ x: 0.5, y: 0.12 });
          const bottom = toPx({ x: 0.5, y: 0.88 });
          return (
            <>
              <View
                style={{
                  position: 'absolute',
                  left: centre.x - 76,
                  top: centre.y - 76,
                  width: 152,
                  height: 152,
                  borderRadius: 76,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              />
              <Text
                variant="mono"
                mono
                tone="tertiary"
                style={{ position: 'absolute', left: top.x - 12, top: top.y - 20 }}
              >
                |0⟩
              </Text>
              <Text
                variant="mono"
                mono
                tone="tertiary"
                style={{ position: 'absolute', left: bottom.x - 12, top: bottom.y + 4 }}
              >
                |1⟩
              </Text>
              <View
                style={{
                  position: 'absolute',
                  left: point.x - 8,
                  top: point.y - 8,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor:
                    collapsed === null
                      ? theme.colors.primary
                      : collapsed === 0
                        ? theme.colors.success
                        : theme.colors.danger,
                }}
              />
            </>
          );
        }}
      </PlotCanvas>

      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Probability of measuring zero is ${(p0 * 100).toFixed(0)} percent${collapsed === null ? '' : `. Last measurement was ${collapsed}`}`}
      >
        <Readout
          items={[
            { label: 'α', value: alpha.toFixed(3) },
            { label: 'β', value: beta.toFixed(3) },
            { label: 'P(0) = |α|²', value: `${(p0 * 100).toFixed(0)}%`, color: theme.colors.primary },
          ]}
        />
      </View>

      <ActionRow
        actions={[
          { label: 'Measure', primary: true, onPress: measure },
          { label: 'Reset', onPress: () => { setMeasurements([]); setCollapsed(null); } },
        ]}
      />

      {measurements.length > 0 ? (
        <Readout
          items={[
            { label: 'Measurements', value: String(measurements.length) },
            { label: 'Observed P(0)', value: `${((observed ?? 0) * 100).toFixed(0)}%` },
            { label: 'Last', value: collapsed === null ? '—' : `|${collapsed}⟩` },
          ]}
        />
      ) : null}

      <Note>
        α and β are amplitudes, not probabilities — their squared magnitudes are. Notice what
        measurement gives you: one bit. Two real numbers went in and a single 0 or 1 came out, and
        the state is gone. That loss is why quantum algorithms have to arrange for the right answer
        to have large amplitude *before* anyone looks.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Quantum circuit
// ---------------------------------------------------------------------------

type GateOp = 'H' | 'X' | 'Z' | 'CNOT';

/** Amplitudes over |00>, |01>, |10>, |11>. Real-valued is enough here. */
function applyGate(state: number[], gate: GateOp): number[] {
  const [a = 0, b = 0, c = 0, d = 0] = state;
  const r = Math.SQRT1_2;
  switch (gate) {
    case 'H': // Hadamard on qubit 0 (the high bit).
      return [r * (a + c), r * (b + d), r * (a - c), r * (b - d)];
    case 'X': // NOT on qubit 0.
      return [c, d, a, b];
    case 'Z': // Phase flip on qubit 0.
      return [a, b, -c, -d];
    case 'CNOT': // Control qubit 0, target qubit 1.
      return [a, b, d, c];
    default:
      return state;
  }
}

const BASIS = ['|00⟩', '|01⟩', '|10⟩', '|11⟩'];

export function QuantumCircuit(): React.JSX.Element {
  const theme = useTheme();
  const [ops, setOps] = useState<GateOp[]>([]);

  const state = useMemo(
    () => ops.reduce((s, g) => applyGate(s, g), [1, 0, 0, 0]),
    [ops],
  );

  const probs = state.map((amp) => amp * amp);
  const entangled =
    Math.abs((state[0] ?? 0) * (state[3] ?? 0) - (state[1] ?? 0) * (state[2] ?? 0)) > 1e-6;

  return (
    <View>
      <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.sm }}>
        Circuit
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
          minHeight: 40,
          padding: theme.spacing.sm,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        {ops.length === 0 ? (
          <Text variant="caption" tone="tertiary">
            Starting at |00⟩ — add gates below.
          </Text>
        ) : (
          ops.map((op, i) => (
            <View
              key={i}
              style={{
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: theme.spacing.xxs,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors.primarySubtle,
              }}
            >
              <Text variant="mono" mono tone="primary">
                {op}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.md }}>
        {(['H', 'X', 'Z', 'CNOT'] as const).map((gate) => (
          <Pressable
            key={gate}
            onPress={() => setOps((o) => [...o, gate])}
            accessibilityRole="button"
            accessibilityLabel={`Add a ${gate} gate`}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text variant="mono" mono>
              {gate}
            </Text>
          </Pressable>
        ))}
      </View>

      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={BASIS.map((b, i) => `${b} ${((probs[i] ?? 0) * 100).toFixed(0)} percent`).join(', ')}
        style={{ marginTop: theme.spacing.lg, gap: theme.spacing.xs }}
      >
        {BASIS.map((basis, i) => (
          <View key={basis} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text variant="mono" mono tone="secondary" style={{ width: 44 }}>
              {basis}
            </Text>
            <View style={{ flex: 1 }}>
              <Bar fraction={probs[i] ?? 0} color={theme.colors.primary} />
            </View>
            <Text variant="mono" mono tone={(state[i] ?? 0) < 0 ? 'danger' : 'secondary'} style={{ width: 60, textAlign: 'right' }}>
              {(state[i] ?? 0).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <ActionRow
        actions={[
          { label: 'Clear', primary: true, onPress: () => setOps([]) },
          { label: 'Bell pair', onPress: () => setOps(['H', 'CNOT']) },
        ]}
      />

      <Note>
        {entangled
          ? 'This state is entangled — it cannot be written as two independent qubits. Measure one and the other is determined, however far apart they are. Press "Bell pair" and note that |01⟩ and |10⟩ have amplitude exactly zero: the two qubits will always agree.'
          : 'The right-hand column is the amplitude, which can be negative — that is what Z does, and it changes no probability on its own. It matters because a later gate can make a negative amplitude cancel a positive one, and that cancellation is the whole source of quantum speedup.'}
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Rasterizer
// ---------------------------------------------------------------------------

const GRID = 12;

export function Rasterizer(): React.JSX.Element {
  const theme = useTheme();
  const [vertexIndex, setVertexIndex] = useState(0);
  const [vertices, setVertices] = useState([
    { x: 2.2, y: 1.5 },
    { x: 9.6, y: 3.8 },
    { x: 4.1, y: 9.4 },
  ]);
  const [antialias, setAntialias] = useState<'Off' | 'On'>('Off');

  /** Coverage of a cell, by sampling its centre or a 3×3 grid within it. */
  const coverage = (cx: number, cy: number): number => {
    const [a, b, c] = vertices;
    if (!a || !b || !c) return 0;
    const inside = (px: number, py: number): boolean => {
      const sign = (p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }): number =>
        (px - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (py - p3.y);
      const d1 = sign(a, b, c);
      const d2 = (px - a.x) * (c.y - a.y) - (c.x - a.x) * (py - a.y);
      const d3 = (px - b.x) * (a.y - b.y) - (a.x - b.x) * (py - b.y);
      const d4 = (px - c.x) * (b.y - c.y) - (b.x - c.x) * (py - c.y);
      const hasNeg = d2 < 0 || d3 < 0 || d4 < 0;
      const hasPos = d2 > 0 || d3 > 0 || d4 > 0;
      void d1;
      return !(hasNeg && hasPos);
    };
    if (antialias === 'Off') return inside(cx + 0.5, cy + 0.5) ? 1 : 0;
    let hits = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (inside(cx + (i + 0.5) / 3, cy + (j + 0.5) / 3)) hits += 1;
      }
    }
    return hits / 9;
  };

  const cells = useMemo(() => {
    const out: Array<{ x: number; y: number; cov: number }> = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const cov = coverage(x, y);
        if (cov > 0) out.push({ x, y, cov });
      }
    }
    return out;
  }, [vertices, antialias]);

  const move = (dx: number, dy: number): void =>
    setVertices((vs) =>
      vs.map((v, i) =>
        i === vertexIndex
          ? { x: Math.max(0.2, Math.min(GRID - 0.2, v.x + dx)), y: Math.max(0.2, Math.min(GRID - 0.2, v.y + dy)) }
          : v,
      ),
    );

  return (
    <View>
      <SegmentedControl
        label="Sampling"
        options={['Off', 'On'] as const}
        value={antialias}
        onChange={setAntialias}
      />

      <PlotCanvas
        height={240}
        accessibilityLabel="A pixel grid with the triangle rasterized onto it, and the three draggable vertices"
      >
        {({ width, height }) => {
          const toPx = (u: { x: number; y: number }): { x: number; y: number } => ({
            x: u.x * width,
            y: u.y * height,
          });
          const cell = Math.min(width, height) / GRID;
          return (
            <>
              {cells.map((c) => (
                <View
                  key={`${c.x}-${c.y}`}
                  style={{
                    position: 'absolute',
                    left: c.x * cell,
                    top: c.y * cell,
                    width: cell,
                    height: cell,
                    backgroundColor: theme.colors.primary,
                    opacity: 0.25 + 0.75 * c.cov,
                  }}
                />
              ))}
              {vertices.map((v, i) => {
                const p = toPx({ x: (v.x * cell) / width, y: (v.y * cell) / height });
                return (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: p.x - 6,
                      top: p.y - 6,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: i === vertexIndex ? theme.colors.warning : theme.colors.text,
                    }}
                  />
                );
              })}
            </>
          );
        }}
      </PlotCanvas>

      <Readout
        items={[
          { label: 'Pixels lit', value: String(cells.length) },
          { label: 'Partial', value: String(cells.filter((c) => c.cov < 1).length) },
          { label: 'Editing', value: `vertex ${vertexIndex + 1}` },
        ]}
      />

      <ActionRow
        actions={[
          { label: '← ', onPress: () => move(-1, 0) },
          { label: ' →', onPress: () => move(1, 0) },
          { label: '↑', onPress: () => move(0, -1) },
          { label: '↓', onPress: () => move(0, 1) },
          { label: 'Next vertex', primary: true, onPress: () => setVertexIndex((i) => (i + 1) % 3) },
        ]}
      />

      <Note>
        {antialias === 'Off'
          ? 'One sample per pixel, at its centre — so a pixel is either fully in or fully out, and the edge is a staircase. That is aliasing, and it comes from sampling a sharp edge at a fixed rate.'
          : 'Nine samples per pixel, averaged, so edge pixels get partial coverage and the staircase softens. This is supersampling: more samples, more cost, and the same principle as every other anti-aliasing technique.'}
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ray tracer
// ---------------------------------------------------------------------------

export function RayTracer(): React.JSX.Element {
  const theme = useTheme();
  const [bounces, setBounces] = useState(1);
  const [samples, setSamples] = useState(1);
  const [showShadow, setShowShadow] = useState<'Shadows off' | 'Shadows on'>('Shadows on');

  // Noise falls as 1/sqrt(samples) — the number is the teaching point.
  const noise = 1 / Math.sqrt(samples);
  const rays = samples * (1 + bounces + (showShadow === 'Shadows on' ? bounces : 0));

  return (
    <View>
      <Slider label="Bounces" value={bounces} min={0} max={6} step={1} onChange={setBounces} />
      <Slider
        label="Samples per pixel"
        value={samples}
        min={1}
        max={256}
        step={1}
        onChange={setSamples}
      />
      <SegmentedControl
        label="Shadow rays"
        options={['Shadows on', 'Shadows off'] as const}
        value={showShadow}
        onChange={setShowShadow}
      />

      <PlotCanvas
        height={200}
        accessibilityLabel="The camera ray reaching a surface, with reflection and shadow rays drawn from the hit point"
      >
        {({ width, height }) => {
          const toPx = (u: { x: number; y: number }): { x: number; y: number } => ({
            x: u.x * width,
            y: u.y * height,
          });
          const eye = toPx({ x: 0.08, y: 0.5 });
          const surface = toPx({ x: 0.58, y: 0.62 });
          const light = toPx({ x: 0.9, y: 0.12 });
          const reflect = toPx({ x: 0.92, y: 0.78 });
          const lineStyle = (
            from: { x: number; y: number },
            to: { x: number; y: number },
            color: string,
          ): object => {
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            return {
              position: 'absolute' as const,
              left: from.x,
              top: from.y,
              width: Math.hypot(dx, dy),
              height: 2,
              backgroundColor: color,
              transform: [{ translateY: -1 }, { rotate: `${Math.atan2(dy, dx)}rad` }],
              transformOrigin: 'left center' as const,
            };
          };
          return (
            <>
              <View style={lineStyle(eye, surface, theme.colors.primary)} />
              {bounces > 0 ? <View style={lineStyle(surface, reflect, theme.colors.info)} /> : null}
              {showShadow === 'Shadows on' ? (
                <View style={lineStyle(surface, light, theme.colors.warning)} />
              ) : null}
              {[
                { p: eye, label: 'camera', color: theme.colors.text },
                { p: surface, label: 'hit', color: theme.colors.primary },
                { p: light, label: 'light', color: theme.colors.warning },
              ].map((m) => (
                <View key={m.label} style={{ position: 'absolute', left: m.p.x - 5, top: m.p.y - 5 }}>
                  <View
                    style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color }}
                  />
                  <Text variant="label" tone="tertiary" caps style={{ marginTop: 2 }}>
                    {m.label}
                  </Text>
                </View>
              ))}
            </>
          );
        }}
      </PlotCanvas>

      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${rays} rays per pixel, relative noise ${noise.toFixed(3)}`}
      >
        <Readout
          items={[
            { label: 'Rays per pixel', value: String(rays) },
            { label: 'Relative noise', value: noise.toFixed(3), color: theme.colors.warning },
            { label: 'Cost vs 1 spp', value: `${rays}×` },
          ]}
        />
      </View>

      <Note>
        Halving the noise needs four times the samples, because Monte Carlo converges as one over
        the square root. Take it from 16 to 64 and watch the cost quadruple for a factor of two in
        quality — which is why real-time path tracing leans on neural denoisers rather than on more
        rays.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PID tuner
// ---------------------------------------------------------------------------

export function PidTuner(): React.JSX.Element {
  const theme = useTheme();
  const [kp, setKp] = useState(1);
  const [ki, setKi] = useState(0);
  const [kd, setKd] = useState(0);
  const [disturbance, setDisturbance] = useState<'None' | 'Step load'>('None');

  const trace = useMemo(() => {
    const target = 1;
    const dt = 0.05;
    let value = 0;
    let velocity = 0;
    let integral = 0;
    let lastError = target;
    const out: number[] = [];
    for (let i = 0; i < 120; i++) {
      const load = disturbance === 'Step load' && i > 60 ? 0.35 : 0;
      const error = target - value;
      integral = Math.max(-5, Math.min(5, integral + error * dt));
      const derivative = (error - lastError) / dt;
      lastError = error;
      const control = kp * error + ki * integral + kd * derivative;
      // A simple second-order plant with damping, plus the disturbance.
      velocity += (control - 0.6 * velocity - load) * dt;
      value += velocity * dt;
      out.push(value);
    }
    return out;
  }, [disturbance, kd, ki, kp]);

  const settled = trace.slice(-20);
  const finalValue = settled.reduce((a, b) => a + b, 0) / (settled.length || 1);
  const steadyError = Math.abs(1 - finalValue);
  const overshoot = Math.max(0, Math.max(...trace) - 1);

  return (
    <View>
      <Slider label="P (proportional)" value={kp} min={0} max={8} step={0.25} onChange={setKp} />
      <Slider label="I (integral)" value={ki} min={0} max={6} step={0.25} onChange={setKi} />
      <Slider label="D (derivative)" value={kd} min={0} max={2} step={0.05} onChange={setKd} />
      <SegmentedControl
        label="Disturbance"
        options={['None', 'Step load'] as const}
        value={disturbance}
        onChange={setDisturbance}
      />

      <PlotCanvas
        height={180}
        accessibilityLabel="The controlled value plotted over time against the target line"
      >
        {({ width, height }) => (
          <>
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0.35 * height,
                height: 1,
                backgroundColor: theme.colors.borderStrong,
              }}
            />
            {trace.map((v, i) => {
              const y = Math.max(0.02, Math.min(0.98, 0.35 + (1 - v) * 0.3));
              const p = { x: (i / trace.length) * width, y: y * height };
              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: p.x,
                    top: p.y - 1,
                    width: Math.max(2, width / trace.length),
                    height: 2,
                    backgroundColor: theme.colors.primary,
                  }}
                />
              );
            })}
          </>
        )}
      </PlotCanvas>

      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Steady-state error ${steadyError.toFixed(3)}, overshoot ${overshoot.toFixed(3)}`}
      >
        <Readout
          items={[
            {
              label: 'Steady error',
              value: steadyError.toFixed(3),
              color: steadyError > 0.05 ? theme.colors.warning : theme.colors.success,
            },
            {
              label: 'Overshoot',
              value: overshoot.toFixed(2),
              color: overshoot > 0.3 ? theme.colors.danger : undefined,
            },
          ]}
        />
      </View>

      <ActionRow
        actions={[
          { label: 'P only', onPress: () => { setKp(3); setKi(0); setKd(0); } },
          { label: 'PI', onPress: () => { setKp(3); setKi(2); setKd(0); } },
          { label: 'PID', primary: true, onPress: () => { setKp(3); setKi(2); setKd(0.4); } },
        ]}
      />

      <Note>
        {steadyError > 0.05 && ki < 0.1
          ? 'Proportional alone settles below the target: at the target the error is zero, so the output is zero, so it falls back. Add integral to accumulate that persistent error until it closes.'
          : overshoot > 0.3
            ? 'That overshoot is too much gain without enough damping. Add derivative, which responds to how fast the error is closing and eases off before you sail past.'
            : 'Now add the step load and watch the loop reject it. Nothing told the controller a disturbance happened — it only sees the error grow, and corrects. That is the whole appeal of feedback.'}
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Usability audit
// ---------------------------------------------------------------------------

interface AuditItem {
  id: string;
  description: string;
  violation: string | null;
}

const AUDIT_ITEMS: AuditItem[] = [
  {
    id: 'a',
    description: 'Tapping "Submit" does nothing visible for two seconds, then the page changes.',
    violation: 'Visibility of system status — no feedback, so people tap again',
  },
  {
    id: 'b',
    description: 'The delete action shows a confirmation dialogue every single time.',
    violation: 'User control — undo would be better; confirmations get clicked through',
  },
  {
    id: 'c',
    description: 'An error reads "Operation failed: code 0x80004005".',
    violation: 'Error recovery — no plain language and no suggested action',
  },
  {
    id: 'd',
    description: 'The primary action is a filled button in the brand colour, top right on every screen.',
    violation: null,
  },
  {
    id: 'e',
    description: 'The settings screen calls it "soft delete"; the rest of the app says "archive".',
    violation: 'Consistency, and match to the real world — two names for one thing',
  },
  {
    id: 'f',
    description: 'Required fields are marked only by being red.',
    violation: 'Inclusive design — colour alone is not perceivable by everyone',
  },
  {
    id: 'g',
    description: 'Long lists show a skeleton placeholder while loading.',
    violation: null,
  },
];

export function UsabilityAudit(): React.JSX.Element {
  const theme = useTheme();
  const [flagged, setFlagged] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);

  const toggle = (id: string): void =>
    setFlagged((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const correct = AUDIT_ITEMS.filter(
    (item) => (item.violation !== null) === flagged.includes(item.id),
  ).length;

  return (
    <View>
      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
        Flag the ones you think violate a usability heuristic, then reveal.
      </Text>

      <View style={{ gap: theme.spacing.xs }}>
        {AUDIT_ITEMS.map((item) => {
          const isFlagged = flagged.includes(item.id);
          const right = revealed && (item.violation !== null) === isFlagged;
          const wrong = revealed && !right;
          return (
            <Pressable
              key={item.id}
              onPress={() => !revealed && toggle(item.id)}
              accessibilityRole="checkbox"
              aria-checked={isFlagged}
              accessibilityLabel={`${item.description}${revealed ? `. ${item.violation ?? 'No violation'}` : ''}`}
              style={{
                borderWidth: 1,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
                borderColor: wrong
                  ? theme.colors.danger
                  : right
                    ? theme.colors.success
                    : isFlagged
                      ? theme.colors.primary
                      : theme.colors.border,
                backgroundColor: isFlagged ? theme.colors.primarySubtle : theme.colors.surface,
              }}
            >
              <Text variant="caption" tone="default">
                {isFlagged ? '⚑ ' : '○ '}
                {item.description}
              </Text>
              {revealed ? (
                <Text
                  variant="caption"
                  tone={item.violation ? 'secondary' : 'tertiary'}
                  style={{ marginTop: theme.spacing.xs }}
                >
                  {item.violation ?? 'No violation — this one is fine.'}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <ActionRow
        actions={[
          { label: revealed ? 'Try again' : 'Reveal', primary: true, onPress: () => { if (revealed) { setFlagged([]); } setRevealed((r) => !r); } },
        ]}
      />

      {revealed ? (
        <Readout items={[{ label: 'Correct', value: `${correct} / ${AUDIT_ITEMS.length}` }]} />
      ) : null}

      <Note>
        The two most commonly missed are the first and the last: missing feedback, because the
        developer knows the request was sent, and colour-only marking, because it looks fine to
        anyone whose colour vision is typical. Both are found immediately by a checklist and almost
        never by intuition.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Incident timeline
// ---------------------------------------------------------------------------

interface IncidentStep {
  prompt: string;
  options: Array<{ label: string; score: number; note: string }>;
}

const INCIDENT: IncidentStep[] = [
  {
    prompt: 'Error rate on checkout jumps to 18%. Alerts are firing. What first?',
    options: [
      { label: 'Declare an incident and name a commander', score: 2, note: 'Correct. Structure first — without it, three people debug in parallel and nobody coordinates.' },
      { label: 'Start reading the logs', score: 0, note: 'The instinct, and the trap. Nobody is coordinating or communicating while you read.' },
      { label: 'Email the stakeholders', score: 1, note: 'Communication matters, but not before anyone owns the response.' },
    ],
  },
  {
    prompt: 'A deploy went out twelve minutes ago. What now?',
    options: [
      { label: 'Roll it back', score: 2, note: 'Correct. Mitigate first. If it was the deploy, service is restored; if not, you have eliminated it.' },
      { label: 'Find the root cause before touching anything', score: 0, note: 'Every minute of diagnosis is a minute of outage. Understanding can wait.' },
      { label: 'Add more logging and redeploy', score: 0, note: 'A new deploy during an incident adds a variable and takes longer than a rollback.' },
    ],
  },
  {
    prompt: 'The rollback is running. It will take six minutes. Meanwhile?',
    options: [
      { label: 'Post a status update and keep a timeline', score: 2, note: 'Correct. One update prevents a dozen interruptions, and nobody remembers the sequence afterwards.' },
      { label: 'Wait quietly until it finishes', score: 0, note: 'Silence is when stakeholders start messaging people individually.' },
      { label: 'Also restart the database, to be safe', score: 0, note: 'Two simultaneous changes and you no longer know which one did what.' },
    ],
  },
  {
    prompt: 'Service is restored. Next?',
    options: [
      { label: 'Confirm recovery, then schedule a blameless postmortem', score: 2, note: 'Correct. Verify with the metrics, not with a hopeful glance, then learn from it.' },
      { label: 'Close the incident and move on', score: 0, note: 'The outage recurs, because nothing changed.' },
      { label: 'Find out who deployed it', score: 0, note: 'Blame reliably reduces what you learn from the next one.' },
    ],
  },
];

export function IncidentTimeline(): React.JSX.Element {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);

  const current = INCIDENT[Math.min(step, INCIDENT.length - 1)];
  const done = step >= INCIDENT.length;

  const choose = (index: number): void => {
    if (chosen !== null) return;
    setChosen(index);
    setScore((s) => s + (current?.options[index]?.score ?? 0));
  };

  if (done) {
    return (
      <View>
        <Readout
          items={[
            { label: 'Score', value: `${score} / ${INCIDENT.length * 2}` },
            { label: 'Steps', value: String(INCIDENT.length) },
          ]}
        />
        <ActionRow
          actions={[
            { label: 'Run it again', primary: true, onPress: () => { setStep(0); setScore(0); setChosen(null); } },
          ]}
        />
        <Note>
          The pattern the scoring rewards is: structure, mitigate, communicate, then diagnose. Most
          engineers reverse the middle two under pressure — diagnosing feels productive and
          communicating feels like an interruption, and both instincts extend the outage.
        </Note>
      </View>
    );
  }

  return (
    <View>
      <Text variant="label" tone="tertiary" caps>
        Step {step + 1} of {INCIDENT.length}
      </Text>
      <Text variant="bodyStrong" style={{ marginVertical: theme.spacing.md }}>
        {current?.prompt}
      </Text>

      <View style={{ gap: theme.spacing.sm }}>
        {(current?.options ?? []).map((option, i) => {
          const picked = chosen === i;
          const good = (option.score ?? 0) === 2;
          return (
            <Pressable
              key={option.label}
              onPress={() => choose(i)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              style={{
                borderWidth: 1,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
                borderColor:
                  chosen === null
                    ? theme.colors.border
                    : good
                      ? theme.colors.success
                      : picked
                        ? theme.colors.danger
                        : theme.colors.border,
                backgroundColor: picked ? theme.colors.surfaceMuted : theme.colors.surface,
              }}
            >
              <Text variant="caption" tone="default">
                {option.label}
              </Text>
              {chosen !== null ? (
                <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.xs }}>
                  {option.note}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {chosen !== null ? (
        <ActionRow
          actions={[
            {
              label: 'Next',
              primary: true,
              onPress: () => {
                setStep((s) => s + 1);
                setChosen(null);
              },
            },
          ]}
        />
      ) : null}
    </View>
  );
}
