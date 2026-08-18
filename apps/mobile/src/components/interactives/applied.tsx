/**
 * Applied widgets: reinforcement learning, agent loops, and diffusion.
 *
 * The Q-learning gridworld runs the real update rule, so reward genuinely
 * propagates backwards from the goal one episode at a time — which is the
 * single thing about RL that is hard to convey any other way.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Badge, Text, useTheme, useTicker } from '@synapse/ui';

import { Slider } from '../Slider';
import {
  ActionRow,
  Bar,
  Note,
  PlotCanvas,
  Readout,
  SegmentedControl,
  clamp01,
  makeRandom,
} from './shared';

// ---------------------------------------------------------------------------
// q-learning
// ---------------------------------------------------------------------------

const GRID_W = 5;
const GRID_H = 4;
const GOAL = 19; // bottom-right in row-major order
const PIT = 12;
const ACTIONS = [
  { dx: 0, dy: -1, glyph: '↑' },
  { dx: 1, dy: 0, glyph: '→' },
  { dx: 0, dy: 1, glyph: '↓' },
  { dx: -1, dy: 0, glyph: '←' },
];

export function QLearning(): React.JSX.Element {
  const theme = useTheme();
  const [alpha, setAlpha] = useState(0.5);
  const [gamma, setGamma] = useState(0.9);
  const [epsilon, setEpsilon] = useState(0.2);
  const [q, setQ] = useState<number[][]>(() =>
    Array.from({ length: GRID_W * GRID_H }, () => [0, 0, 0, 0]),
  );
  const [episodes, setEpisodes] = useState(0);
  const [lastReturn, setLastReturn] = useState<number | null>(null);
  const [learning, setLearning] = useState(false);
  const [randomState] = useState(() => makeRandom(99));

  const stepEnv = useCallback((state: number, action: number): { next: number; reward: number; done: boolean } => {
    const x = state % GRID_W;
    const y = Math.floor(state / GRID_W);
    const a = ACTIONS[action]!;
    const nx = Math.max(0, Math.min(GRID_W - 1, x + a.dx));
    const ny = Math.max(0, Math.min(GRID_H - 1, y + a.dy));
    const next = ny * GRID_W + nx;

    if (next === GOAL) return { next, reward: 10, done: true };
    if (next === PIT) return { next, reward: -10, done: true };
    return { next, reward: -0.1, done: false }; // small step cost
  }, []);

  const runEpisodes = (count: number): void => {
    setQ((prevQ) => {
      const table = prevQ.map((row) => [...row]);
      let totalReturn = 0;

      for (let e = 0; e < count; e += 1) {
        let state = 0;
        let episodeReturn = 0;

        for (let t = 0; t < 60; t += 1) {
          // ε-greedy action selection.
          const explore = randomState() < epsilon;
          const row = table[state]!;
          const action = explore
            ? Math.floor(randomState() * 4) % 4
            : row.indexOf(Math.max(...row));

          const { next, reward, done } = stepEnv(state, action);
          episodeReturn += reward;

          // Q-learning update: bootstrap off the best next action.
          const bestNext = done ? 0 : Math.max(...table[next]!);
          const current = table[state]![action]!;
          table[state]![action] = current + alpha * (reward + gamma * bestNext - current);

          state = next;
          if (done) break;
        }
        totalReturn = episodeReturn;
      }

      setLastReturn(totalReturn);
      return table;
    });
    setEpisodes((n) => n + count);
  };

  const reset = (): void => {
    setQ(Array.from({ length: GRID_W * GRID_H }, () => [0, 0, 0, 0]));
    setEpisodes(0);
    setLastReturn(null);
    setLearning(false);
  };

  // Three episodes per tick: fast enough that value visibly floods backwards
  // from the goal within seconds, slow enough to watch the wavefront spread.
  useTicker(learning, 160, () => runEpisodes(3));

  const maxQ = Math.max(0.01, ...q.flat().map(Math.abs));

  return (
    <View>
      <View style={{ gap: 3 }}>
        {Array.from({ length: GRID_H }, (_, y) => (
          <View key={y} style={{ flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: GRID_W }, (_, x) => {
              const state = y * GRID_W + x;
              const row = q[state]!;
              const best = row.indexOf(Math.max(...row));
              const value = Math.max(...row);
              const isGoal = state === GOAL;
              const isPit = state === PIT;
              const isStart = state === 0;

              return (
                <View
                  key={x}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderRadius: theme.radii.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isGoal
                      ? theme.colors.success
                      : isPit
                        ? theme.colors.danger
                        : value > 0
                          ? `rgba(139, 92, 246, ${clamp01(value / maxQ) * 0.85})`
                          : theme.colors.surfaceMuted,
                    borderWidth: isStart ? 2 : 0,
                    borderColor: theme.colors.info,
                  }}
                >
                  {isGoal ? (
                    <Text variant="caption" tone="onAccent">🏁</Text>
                  ) : isPit ? (
                    <Text variant="caption" tone="onAccent">✕</Text>
                  ) : (
                    <>
                      <Text variant="caption">{episodes > 0 ? ACTIONS[best]!.glyph : '·'}</Text>
                      {episodes > 0 ? (
                        <Text variant="label" mono tone="tertiary" style={{ fontSize: 9 }}>
                          {value.toFixed(1)}
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <Text variant="label" tone="tertiary" caps style={{ marginTop: theme.spacing.sm }}>
        Blue border = start · 🏁 = goal (+10) · ✕ = pit (−10)
      </Text>

      <View style={{ marginTop: theme.spacing.md }}>
        <Slider value={alpha} min={0.05} max={1} step={0.05} onChange={setAlpha} label="Learning rate α" />
        <Slider value={gamma} min={0.5} max={0.99} step={0.01} onChange={setGamma} label="Discount γ" color={theme.colors.info} />
        <Slider
          value={epsilon}
          min={0}
          max={0.8}
          step={0.01}
          onChange={setEpsilon}
          label="Exploration ε"
          color={epsilon === 0 ? theme.colors.danger : theme.colors.success}
        />
      </View>

      <Readout
        items={[
          { label: 'Episodes', value: String(episodes) },
          {
            label: 'Last return',
            value: lastReturn === null ? '—' : lastReturn.toFixed(1),
            color: (lastReturn ?? 0) > 5 ? theme.colors.success : theme.colors.warning,
          },
        ]}
      />

      <ActionRow
        actions={[
          {
            label: learning ? 'Pause' : 'Learn',
            onPress: () => setLearning((v) => !v),
            primary: true,
          },
          { label: 'One episode', onPress: () => runEpisodes(1), disabled: learning },
          { label: 'Reset', onPress: reset },
        ]}
      />

      {epsilon === 0 && episodes > 20 ? (
        <Badge
          label="ε = 0 means pure exploitation — the agent locks onto the first path it found and never discovers a better one"
          tone="danger"
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}

      <Note>
        Watch value spread backwards from the goal. Only the final step gets direct reward; every earlier
        cell learns its value by bootstrapping off its successor, one episode at a time. That backwards
        propagation is credit assignment, and it is why RL needs so many more samples than supervised
        learning — a single scalar reward has to be distributed across a whole trajectory.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// agent-loop-sim
// ---------------------------------------------------------------------------

interface AgentEvent {
  kind: 'thought' | 'action' | 'observation' | 'answer' | 'error';
  text: string;
}

const SCRIPT: AgentEvent[] = [
  { kind: 'thought', text: 'I need this customer’s recent orders before I can answer.' },
  { kind: 'action', text: 'search_orders(customer_id="C-4821")' },
  { kind: 'observation', text: '3 orders. Most recent: ORD-9912, 14 Feb, status DELAYED.' },
  { kind: 'thought', text: 'The delay explains the complaint. Check the shipment record.' },
  { kind: 'action', text: 'get_shipment(order_id="ORD-9912")' },
  { kind: 'observation', text: 'Held at depot since 16 Feb. No delivery attempt logged.' },
  { kind: 'thought', text: 'I have enough to answer. A refund would need human approval.' },
  { kind: 'answer', text: 'Order ORD-9912 is held at the depot with no delivery attempt since 16 Feb. Escalating for refund approval.' },
];

const FAILURE_AT = 4;

export function AgentLoopSim(): React.JSX.Element {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [injectFailure, setInjectFailure] = useState(false);
  const maxSteps = 12;

  const events = useMemo(() => {
    const out: AgentEvent[] = [];
    let scriptIndex = 0;

    for (let i = 0; i < step && out.length < maxSteps; i += 1) {
      if (injectFailure && i === FAILURE_AT) {
        out.push({ kind: 'error', text: 'Error: get_shipment timed out after 30s' });
        out.push({ kind: 'thought', text: 'The tool failed. I will retry once before giving up.' });
        continue;
      }
      const event = SCRIPT[scriptIndex];
      if (!event) break;
      out.push(event);
      scriptIndex += 1;
    }
    return out;
  }, [step, injectFailure]);

  const done = events.some((e) => e.kind === 'answer');
  const toolCalls = events.filter((e) => e.kind === 'action').length;
  const estimatedCost = toolCalls * 0.004 + events.length * 0.0015;

  const styleFor = (kind: AgentEvent['kind']) => {
    switch (kind) {
      case 'thought':
        return { color: theme.colors.textSecondary, label: 'Thought', bg: theme.colors.surfaceMuted };
      case 'action':
        return { color: theme.colors.primary, label: 'Action', bg: theme.colors.primarySubtle };
      case 'observation':
        return { color: theme.colors.info, label: 'Observation', bg: theme.colors.infoSubtle };
      case 'error':
        return { color: theme.colors.danger, label: 'Error', bg: theme.colors.dangerSubtle };
      case 'answer':
        return { color: theme.colors.success, label: 'Answer', bg: theme.colors.successSubtle };
    }
  };

  return (
    <View>
      <SegmentedControl
        options={['Happy path', 'Inject a tool failure'] as const}
        value={injectFailure ? 'Inject a tool failure' : 'Happy path'}
        onChange={(v) => {
          setInjectFailure(v === 'Inject a tool failure');
          setStep(0);
        }}
      />

      <View style={{ gap: theme.spacing.sm, minHeight: 180 }}>
        {events.length === 0 ? (
          <Text variant="caption" tone="tertiary">
            Goal: “Why is my order late?” — press step to run the loop.
          </Text>
        ) : (
          events.map((event, i) => {
            const s = styleFor(event.kind);
            return (
              <View
                key={i}
                style={{ padding: theme.spacing.md, borderRadius: theme.radii.md, backgroundColor: s.bg }}
              >
                <Text variant="label" caps style={{ color: s.color, marginBottom: 2 }}>
                  {s.label}
                </Text>
                <Text variant="caption" mono={event.kind === 'action'} tone="secondary">
                  {event.text}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <Readout
        items={[
          { label: 'Steps', value: `${events.length}/${maxSteps}` },
          { label: 'Tool calls', value: String(toolCalls) },
          { label: 'Est. cost', value: `$${estimatedCost.toFixed(4)}` },
          {
            label: 'Status',
            value: done ? 'Complete' : events.length >= maxSteps ? 'Step limit hit' : 'Running',
            color: done ? theme.colors.success : events.length >= maxSteps ? theme.colors.danger : theme.colors.warning,
          },
        ]}
      />

      <ActionRow
        actions={[
          { label: 'Step', onPress: () => setStep((s) => s + 1), disabled: done || events.length >= maxSteps, primary: true },
          { label: 'Reset', onPress: () => setStep(0) },
        ]}
      />

      <Note>
        The observation is appended back into context each round, which is what makes this a loop rather
        than a chain — the agent can see a tool failure and react to it. Inject the failure and keep
        stepping: without a step limit, a persistently failing tool produces an unbounded loop against a
        paid API. That is why max steps and max spend are non-negotiable in production.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// diffusion-denoise
// ---------------------------------------------------------------------------

export function DiffusionDenoise(): React.JSX.Element {
  const theme = useTheme();
  const [timestep, setTimestep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(50);
  const [playing, setPlaying] = useState(false);

  // Walks the timestep from pure noise to finished image. Diffusion is a
  // *process*, and a slider you have to drag yourself hides that — most people
  // never move it far enough to see the image resolve.
  useTicker(playing, 60, () => {
    setTimestep((t) => {
      const next = t - 0.02;
      if (next <= 0) {
        setPlaying(false);
        return 0;
      }
      return next;
    });
  });

  const SIZE = 12;

  /** The clean target: a simple circle, which reads clearly at low resolution. */
  const target = useMemo(() => {
    return Array.from({ length: SIZE }, (_, r) =>
      Array.from({ length: SIZE }, (_, c) => {
        const d = Math.hypot(r - SIZE / 2 + 0.5, c - SIZE / 2 + 0.5);
        return clamp01(1 - d / (SIZE / 2.6));
      }),
    );
  }, []);

  const noise = useMemo(() => {
    const random = makeRandom(77);
    return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => random()));
  }, []);

  // Fewer sampling steps means a coarser approximation of the reverse process.
  const stepQuality = clamp01(totalSteps / 50);
  const cleanFraction = clamp01((1 - timestep) * (0.55 + 0.45 * stepQuality));

  const image = target.map((row, r) =>
    row.map((v, c) => clamp01(v * cleanFraction + noise[r]![c]! * (1 - cleanFraction))),
  );

  return (
    <View>
      <View style={{ alignSelf: 'center' }}>
        {image.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {row.map((v, c) => (
              <View
                key={c}
                style={{
                  width: 18,
                  height: 18,
                  margin: 0.5,
                  borderRadius: 2,
                  backgroundColor: `rgba(196, 181, 253, ${v})`,
                }}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Slider
          value={timestep}
          min={0}
          max={1}
          step={0.01}
          onChange={setTimestep}
          label="Timestep — 1 is pure noise, 0 is the finished image"
          format={(v) => `t = ${(v * totalSteps).toFixed(0)}`}
        />
        <Slider
          value={totalSteps}
          min={4}
          max={50}
          step={1}
          onChange={setTotalSteps}
          label="Total sampling steps"
          format={(v) => v.toFixed(0)}
          color={totalSteps < 15 ? theme.colors.warning : theme.colors.info}
        />
      </View>

      <ActionRow
        actions={[
          {
            label: playing ? 'Pause' : timestep <= 0.01 ? 'Replay' : 'Denoise',
            onPress: () => {
              if (timestep <= 0.01) setTimestep(1);
              setPlaying((p) => !p);
            },
            primary: true,
          },
          { label: 'Back to noise', onPress: () => { setTimestep(1); setPlaying(false); } },
        ]}
      />

      <Readout
        items={[
          { label: 'Signal', value: `${(cleanFraction * 100).toFixed(0)}%`, color: theme.colors.primary },
          { label: 'Noise', value: `${((1 - cleanFraction) * 100).toFixed(0)}%`, color: theme.colors.textTertiary },
          {
            label: 'Sample quality',
            value: totalSteps < 15 ? 'Degraded' : 'Good',
            color: totalSteps < 15 ? theme.colors.warning : theme.colors.success,
          },
        ]}
      />

      <Note>
        Drag the timestep from 1 to 0 and watch structure resolve out of static — each step the network
        predicts the noise present and subtracts a little of it. Then cut the total step count to 6: the
        reverse process is approximated too coarsely and quality drops. Samplers that get good results in
        20 steps instead of 1,000 are why diffusion became practical.
      </Note>
    </View>
  );
}

// ---------------------------------------------------------------------------
// drift-monitor
// ---------------------------------------------------------------------------

/**
 * The silent-degradation demo.
 *
 * Shows the thing that is genuinely hard to convey in prose: system health
 * stays green, the input distribution moves, and accuracy only confirms the
 * problem long after it started.
 */
export function DriftMonitor(): React.JSX.Element {
  const theme = useTheme();
  const [week, setWeek] = useState(0);
  const [labelLagWeeks] = useState(8);

  const BINS = 10;

  /** Training reference distribution — fixed, and never re-baselined. */
  const reference = useMemo(
    () => Array.from({ length: BINS }, (_, i) => Math.exp(-((i - 3) ** 2) / 3)),
    [],
  );

  /** Live distribution drifts rightwards and widens as weeks pass. */
  const live = useMemo(() => {
    const shift = 3 + week * 0.28;
    const spread = 3 + week * 0.35;
    return Array.from({ length: BINS }, (_, i) => Math.exp(-((i - shift) ** 2) / spread));
  }, [week]);

  const normalise = (a: number[]): number[] => {
    const total = a.reduce((s, v) => s + v, 0) || 1;
    return a.map((v) => v / total);
  };

  const refN = normalise(reference);
  const liveN = normalise(live);

  /** Population Stability Index — the standard drift statistic. */
  const psi = refN.reduce((sum, r, i) => {
    const l = Math.max(1e-6, liveN[i]!);
    const rr = Math.max(1e-6, r);
    return sum + (l - rr) * Math.log(l / rr);
  }, 0);

  const psiStatus =
    psi < 0.1 ? { label: 'Stable', tone: theme.colors.success } :
    psi < 0.25 ? { label: 'Moderate drift', tone: theme.colors.warning } :
    { label: 'Significant drift', tone: theme.colors.danger };

  // Accuracy tracks drift, but is only *observable* once labels arrive.
  const trueAccuracy = clamp01(0.91 - psi * 0.55);
  const labelsArrived = week >= labelLagWeeks;
  const observedWeek = Math.max(0, week - labelLagWeeks);
  const observedPsi = refN.reduce((sum, r, i) => {
    const shift = 3 + observedWeek * 0.28;
    const spread = 3 + observedWeek * 0.35;
    const raw = Math.exp(-((i - shift) ** 2) / spread);
    const total = Array.from({ length: BINS }, (_, j) =>
      Math.exp(-((j - shift) ** 2) / spread),
    ).reduce((s, v) => s + v, 0);
    const l = Math.max(1e-6, raw / total);
    const rr = Math.max(1e-6, r);
    return sum + (l - rr) * Math.log(l / rr);
  }, 0);
  const observedAccuracy = clamp01(0.91 - observedPsi * 0.55);

  const maxBar = Math.max(...refN, ...liveN);

  return (
    <View>
      {/* Distribution comparison */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 3 }}>
        {refN.map((r, i) => (
          <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
            <View
              style={{
                height: `${(liveN[i]! / maxBar) * 100}%`,
                backgroundColor: theme.colors.warning,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
                opacity: 0.9,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${(r / maxBar) * 100}%`,
                borderTopWidth: 2,
                borderColor: theme.colors.info,
              }}
            />
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 12, height: 2, backgroundColor: theme.colors.info }} />
          <Text variant="label" tone="tertiary">Training data</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 8, backgroundColor: theme.colors.warning, borderRadius: 2 }} />
          <Text variant="label" tone="tertiary">Live traffic</Text>
        </View>
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <Slider
          value={week}
          min={0}
          max={26}
          step={1}
          onChange={setWeek}
          label="Weeks since deployment"
          format={(v) => `week ${v.toFixed(0)}`}
        />
      </View>

      {/* Monitoring layers */}
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        {[
          { name: 'Latency p99', value: '184 ms', ok: true, note: 'green' },
          { name: 'Error rate', value: '0.02%', ok: true, note: 'green' },
          {
            name: 'Input drift (PSI)',
            value: psi.toFixed(3),
            ok: psi < 0.25,
            note: psiStatus.label,
          },
          {
            name: 'Measured accuracy',
            value: labelsArrived ? `${(observedAccuracy * 100).toFixed(1)}%` : 'awaiting labels',
            ok: !labelsArrived || observedAccuracy > 0.8,
            note: labelsArrived ? `from week ${observedWeek}` : `${labelLagWeeks}-week lag`,
          },
        ].map((row) => (
          <View
            key={row.name}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              backgroundColor: row.ok ? theme.colors.surfaceMuted : theme.colors.dangerSubtle,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginRight: theme.spacing.md,
                backgroundColor: row.ok ? theme.colors.success : theme.colors.danger,
              }}
            />
            <Text variant="caption" style={{ flex: 1 }}>
              {row.name}
            </Text>
            <Text variant="caption" mono tone="secondary">
              {row.value}
            </Text>
            <Text variant="label" tone="tertiary" style={{ width: 96, textAlign: 'right' }}>
              {row.note}
            </Text>
          </View>
        ))}
      </View>

      <Readout
        items={[
          { label: 'True accuracy now', value: `${(trueAccuracy * 100).toFixed(1)}%`, color: trueAccuracy < 0.8 ? theme.colors.danger : theme.colors.success },
          {
            label: 'What you can see',
            value: labelsArrived ? `${(observedAccuracy * 100).toFixed(1)}%` : '—',
            color: theme.colors.textTertiary,
          },
          { label: 'Blind spot', value: `${(Math.abs(trueAccuracy - (labelsArrived ? observedAccuracy : 0.91)) * 100).toFixed(1)} pts`, color: theme.colors.warning },
        ]}
      />

      {psi >= 0.25 && !labelsArrived ? (
        <Badge
          label="Drift is significant and no labels have arrived yet — this is exactly the window where drift monitoring is the only signal you have"
          tone="danger"
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}

      <Note>
        Latency and error rate stay green throughout — they describe the service, not the predictions.
        PSI moves immediately because it needs no labels. Measured accuracy lags by weeks or months,
        so by the time it confirms the problem the model has already been making bad decisions for a
        long time.
      </Note>
    </View>
  );
}
