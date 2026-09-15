/**
 * Named diagrams, drawn with plain views.
 *
 * Every figure is composed from boxes and text rather than shipped as an image:
 * they scale to any screen, respond to the theme, stay readable at accessibility
 * text sizes, and add nothing to the bundle. A registry keyed by name means
 * content stays pure data — it references a figure, it does not embed one.
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { FigureName } from '@synapse/core';
import { Card, Text, useTheme, type Theme } from '@synapse/ui';

export function Figure({
  name,
  style,
}: {
  name: FigureName;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element | null {
  const theme = useTheme();
  const render = FIGURES[name];
  if (!render) return null;

  return (
    <Card background={theme.colors.surfaceMuted} style={style}>
      {render(theme)}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function Chip({
  label,
  color,
  theme,
  flex,
}: {
  label: string;
  color: string;
  theme: Theme;
  flex?: number;
}): React.JSX.Element {
  return (
    <View
      style={{
        flex,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radii.md,
        backgroundColor: `${color}22`,
        borderWidth: 1,
        borderColor: color,
        alignItems: 'center',
      }}
    >
      <Text variant="caption" align="center" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

function Arrow({ theme, vertical = false }: { theme: Theme; vertical?: boolean }): React.JSX.Element {
  return (
    <Text
      variant="caption"
      tone="tertiary"
      align="center"
      style={vertical ? { marginVertical: theme.spacing.xs } : { marginHorizontal: theme.spacing.xs }}
    >
      {vertical ? '↓' : '→'}
    </Text>
  );
}

function Caption({ text, theme }: { text: string; theme: Theme }): React.JSX.Element {
  return (
    <Text
      variant="label"
      tone="tertiary"
      align="center"
      caps
      style={{ marginTop: theme.spacing.md }}
    >
      {text}
    </Text>
  );
}


/**
 * A vertical stack of labelled bands, top to bottom.
 *
 * Several of the computer-science figures are layer diagrams rather than
 * flows: a memory hierarchy, an abstraction stack, a protocol stack. The
 * shared idea is that each band rests on the one below, so they are drawn
 * touching rather than separated by arrows.
 */
function Stack({
  bands,
  theme,
}: {
  bands: Array<{ label: string; detail?: string; color: string }>;
  theme: Theme;
}): React.JSX.Element {
  return (
    <View style={{ gap: 2 }}>
      {bands.map((band) => (
        <View
          key={band.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radii.sm,
            backgroundColor: `${band.color}22`,
            borderLeftWidth: 3,
            borderLeftColor: band.color,
          }}
        >
          <Text variant="caption" style={{ color: band.color }}>
            {band.label}
          </Text>
          {band.detail ? (
            <Text variant="label" tone="tertiary" caps>
              {band.detail}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

const FIGURES: Partial<Record<FigureName, (theme: Theme) => React.JSX.Element>> = {
  'ai-ml-dl-venn': (theme) => (
    <View>
      {/* Concentric boxes stand in for nested circles — the nesting is the point. */}
      <View
        style={{
          padding: theme.spacing.lg,
          borderRadius: theme.radii.lg,
          borderWidth: 2,
          borderColor: theme.colors.primary,
        }}
      >
        <Text variant="label" tone="primary" caps>
          Artificial Intelligence
        </Text>
        <View
          style={{
            marginTop: theme.spacing.md,
            padding: theme.spacing.lg,
            borderRadius: theme.radii.md,
            borderWidth: 2,
            borderColor: theme.colors.info,
          }}
        >
          <Text variant="label" tone="primary" caps style={{ color: theme.colors.info }}>
            Machine Learning
          </Text>
          <View
            style={{
              marginTop: theme.spacing.md,
              padding: theme.spacing.lg,
              borderRadius: theme.radii.sm,
              borderWidth: 2,
              borderColor: theme.colors.success,
            }}
          >
            <Text variant="label" caps style={{ color: theme.colors.success }}>
              Deep Learning
            </Text>
          </View>
        </View>
      </View>
      <Caption text="Each sits entirely inside the one before" theme={theme} />
    </View>
  ),

  'supervised-flow': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="Features" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Model" color={theme.colors.primary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Prediction" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <View style={{ marginTop: theme.spacing.md, alignItems: 'center' }}>
        <Text variant="caption" tone="tertiary">
          ↑ adjust weights ← compare to label
        </Text>
      </View>
      <Caption text="Predict, compare, adjust — repeat" theme={theme} />
    </View>
  ),

  'neuron-anatomy': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <Chip label="x₁ × w₁" color={theme.colors.info} theme={theme} />
          <Chip label="x₂ × w₂" color={theme.colors.info} theme={theme} />
          <Chip label="x₃ × w₃" color={theme.colors.info} theme={theme} />
        </View>
        <Arrow theme={theme} />
        <Chip label={'Σ + b'} color={theme.colors.primary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="f(z)" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Caption text="Weight, sum, then bend" theme={theme} />
    </View>
  ),

  'mlp-layers': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="Input" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Hidden" color={theme.colors.primary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Hidden" color={theme.colors.primary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Output" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Caption text="Edges → parts → objects" theme={theme} />
    </View>
  ),

  'overfitting-curves': (theme) => (
    <View>
      <View style={{ gap: theme.spacing.md }}>
        <View>
          <Text variant="caption" tone="secondary">
            Training loss — falls forever
          </Text>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              marginTop: theme.spacing.xs,
              backgroundColor: theme.colors.success,
            }}
          />
        </View>
        <View>
          <Text variant="caption" tone="secondary">
            Validation loss — falls, then rises
          </Text>
          <View style={{ flexDirection: 'row', marginTop: theme.spacing.xs }}>
            <View style={{ flex: 2, height: 6, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, backgroundColor: theme.colors.info }} />
            <View style={{ flex: 3, height: 6, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: theme.colors.danger }} />
          </View>
        </View>
      </View>
      <Caption text="Stop where validation bottoms out" theme={theme} />
    </View>
  ),

  'train-val-test-split': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        <Chip label="Train 70%" color={theme.colors.primary} theme={theme} flex={7} />
        <Chip label="Val 15%" color={theme.colors.info} theme={theme} flex={2} />
        <Chip label="Test 15%" color={theme.colors.success} theme={theme} flex={2} />
      </View>
      <Caption text="The test set is opened once" theme={theme} />
    </View>
  ),

  'confusion-matrix': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        <Chip label={'True\nPositive'} color={theme.colors.success} theme={theme} flex={1} />
        <Chip label={'False\nPositive'} color={theme.colors.warning} theme={theme} flex={1} />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
        <Chip label={'False\nNegative'} color={theme.colors.danger} theme={theme} flex={1} />
        <Chip label={'True\nNegative'} color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Caption text="Not all mistakes cost the same" theme={theme} />
    </View>
  ),

  'transformer-block': (theme) => (
    <View>
      <Chip label="Layer norm" color={theme.colors.textTertiary} theme={theme} />
      <Arrow theme={theme} vertical />
      <Chip label="Multi-head self-attention" color={theme.colors.primary} theme={theme} />
      <Arrow theme={theme} vertical />
      <Chip label="+ residual" color={theme.colors.success} theme={theme} />
      <Arrow theme={theme} vertical />
      <Chip label="Feed-forward network" color={theme.colors.info} theme={theme} />
      <Arrow theme={theme} vertical />
      <Chip label="+ residual" color={theme.colors.success} theme={theme} />
      <Caption text="Repeated 32–120 times" theme={theme} />
    </View>
  ),

  'attention-heads': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        <Chip label="Q" color={theme.colors.primary} theme={theme} flex={1} />
        <Chip label="K" color={theme.colors.info} theme={theme} flex={1} />
        <Chip label="V" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Arrow theme={theme} vertical />
      <Chip label={'softmax(QKᵀ / √dₖ) · V'} color={theme.colors.warning} theme={theme} />
      <Caption text="Score, normalize, aggregate" theme={theme} />
    </View>
  ),

  'rag-pipeline': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="Query" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Retrieve" color={theme.colors.primary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Augment" color={theme.colors.warning} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Generate" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Caption text="Ground the answer in real documents" theme={theme} />
    </View>
  ),

  'diffusion-steps': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="Noise" color={theme.colors.textTertiary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Less noise" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Emerging" color={theme.colors.primary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Image" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Caption text="Denoise, repeatedly" theme={theme} />
    </View>
  ),

  'agent-loop': (theme) => (
    <View>
      <Chip label="Observe goal and history" color={theme.colors.info} theme={theme} />
      <Arrow theme={theme} vertical />
      <Chip label="Think — decide next step" color={theme.colors.primary} theme={theme} />
      <Arrow theme={theme} vertical />
      <Chip label="Act — call a tool" color={theme.colors.warning} theme={theme} />
      <Arrow theme={theme} vertical />
      <Chip label="Observe result → loop" color={theme.colors.success} theme={theme} />
      <Caption text="Until done, or the step limit is hit" theme={theme} />
    </View>
  ),

  'rlhf-pipeline': (theme) => (
    <View>
      <Chip label="Pretrain — next-token prediction" color={theme.colors.textTertiary} theme={theme} />
      <Arrow theme={theme} vertical />
      <Chip label="SFT — instruction pairs" color={theme.colors.info} theme={theme} />
      <Arrow theme={theme} vertical />
      <Chip label="Reward model — human preferences" color={theme.colors.primary} theme={theme} />
      <Arrow theme={theme} vertical />
      <Chip label="PPO with KL penalty" color={theme.colors.success} theme={theme} />
      <Caption text="Knowledge, then format, then judgement" theme={theme} />
    </View>
  ),

  'cnn-filters': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="Edges" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Textures" color={theme.colors.primary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Parts" color={theme.colors.warning} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Objects" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Caption text="A hierarchy nobody designed" theme={theme} />
    </View>
  ),

  'loss-landscape': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 88, gap: 3 }}>
        {[80, 62, 44, 30, 18, 10, 6, 10, 20, 34, 52].map((height, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              height,
              borderRadius: 3,
              backgroundColor: height <= 10 ? theme.colors.success : theme.colors.primary,
              opacity: height <= 10 ? 1 : 0.5,
            }}
          />
        ))}
      </View>
      <Caption text="Follow the slope to the valley" theme={theme} />
    </View>
  ),

  'mlops-lifecycle': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="Train" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Deploy" color={theme.colors.primary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Monitor" color={theme.colors.warning} theme={theme} flex={1} />
      </View>
      <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: theme.spacing.sm }}>
        ↑ drift detected → retrain
      </Text>
      <Caption text="Shipping is the start, not the end" theme={theme} />
    </View>
  ),

  // --- Computer science ---------------------------------------------------

  'abstraction-stack': (theme) => (
    <View>
      <Stack
        theme={theme}
        bands={[
          { label: 'Applications', detail: 'what people use', color: theme.colors.success },
          { label: 'Operating system', detail: 'shares the machine', color: theme.colors.info },
          { label: 'Machine code', detail: 'what the CPU runs', color: theme.colors.primary },
          { label: 'Datapath and registers', detail: 'executes it', color: theme.colors.warning },
          { label: 'Logic gates', detail: 'boolean functions', color: theme.colors.danger },
          { label: 'Transistors', detail: 'switches', color: theme.colors.textTertiary },
        ]}
      />
      <Caption text="Each layer hides the one below completely" theme={theme} />
    </View>
  ),

  'memory-hierarchy': (theme) => (
    <View>
      <Stack
        theme={theme}
        bands={[
          { label: 'Registers', detail: '~0 cycles', color: theme.colors.success },
          { label: 'L1 cache', detail: '~4 cycles', color: theme.colors.info },
          { label: 'L2 / L3 cache', detail: '~12–40', color: theme.colors.primary },
          { label: 'Main memory', detail: '~200', color: theme.colors.warning },
          { label: 'SSD', detail: '~50,000', color: theme.colors.danger },
        ]}
      />
      <Caption text="Each tier ~10× slower and ~10× larger" theme={theme} />
    </View>
  ),

  'compiler-pipeline': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="Source" color={theme.colors.textTertiary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Tokens" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Tree" color={theme.colors.primary} theme={theme} flex={1} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm }}>
        <Chip label="Types" color={theme.colors.primary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="IR" color={theme.colors.warning} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Machine code" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Caption text="Each phase knows more than the last" theme={theme} />
    </View>
  ),

  'chomsky-hierarchy': (theme) => (
    <View>
      <View
        style={{
          padding: theme.spacing.md,
          borderRadius: theme.radii.lg,
          borderWidth: 2,
          borderColor: theme.colors.danger,
        }}
      >
        <Text variant="label" caps style={{ color: theme.colors.danger }}>
          Turing — unbounded tape
        </Text>
        <View
          style={{
            marginTop: theme.spacing.sm,
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            borderWidth: 2,
            borderColor: theme.colors.warning,
          }}
        >
          <Text variant="label" caps style={{ color: theme.colors.warning }}>
            Context-sensitive
          </Text>
          <View
            style={{
              marginTop: theme.spacing.sm,
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              borderWidth: 2,
              borderColor: theme.colors.primary,
            }}
          >
            <Text variant="label" caps style={{ color: theme.colors.primary }}>
              Context-free — a stack
            </Text>
            <View
              style={{
                marginTop: theme.spacing.sm,
                padding: theme.spacing.md,
                borderRadius: theme.radii.sm,
                borderWidth: 2,
                borderColor: theme.colors.success,
              }}
            >
              <Text variant="label" caps style={{ color: theme.colors.success }}>
                Regular — finite memory
              </Text>
            </View>
          </View>
        </View>
      </View>
      <Caption text="Each level adds memory to the machine" theme={theme} />
    </View>
  ),

  'p-vs-np': (theme) => (
    <View>
      <View
        style={{
          padding: theme.spacing.lg,
          borderRadius: theme.radii.lg,
          borderWidth: 2,
          borderColor: theme.colors.warning,
        }}
      >
        <Text variant="label" caps style={{ color: theme.colors.warning }}>
          NP — easy to check
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
          <Chip label="P — easy to solve" color={theme.colors.success} theme={theme} flex={1} />
          <Chip label="NP-complete" color={theme.colors.danger} theme={theme} flex={1} />
        </View>
      </View>
      <Caption text="Whether P equals NP is unresolved since 1971" theme={theme} />
    </View>
  ),

  'network-layers': (theme) => (
    <View>
      <Stack
        theme={theme}
        bands={[
          { label: 'Application — HTTP', detail: 'what the bytes mean', color: theme.colors.success },
          { label: 'Transport — TCP', detail: 'reliable, ordered', color: theme.colors.primary },
          { label: 'Network — IP', detail: 'routing, no promises', color: theme.colors.info },
          { label: 'Link — Ethernet', detail: 'next device', color: theme.colors.textTertiary },
        ]}
      />
      <Caption text="Each layer solves one problem and hides it" theme={theme} />
    </View>
  ),

  'request-path': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="DNS" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="TCP" color={theme.colors.primary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="TLS" color={theme.colors.warning} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="HTTP" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: theme.spacing.sm }}>
        ~50ms + 1 RTT + 1 RTT before the first byte
      </Text>
      <Caption text="Reusing the connection skips the first three" theme={theme} />
    </View>
  ),

  'acid-transaction': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="BEGIN" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Debit" color={theme.colors.textTertiary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Credit" color={theme.colors.textTertiary} theme={theme} flex={1} />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        <Chip label="COMMIT — both applied" color={theme.colors.success} theme={theme} flex={1} />
        <Chip label="ROLLBACK — neither" color={theme.colors.danger} theme={theme} flex={1} />
      </View>
      <Caption text="Halfway is never a state anyone observes" theme={theme} />
    </View>
  ),

  'shared-responsibility': (theme) => (
    <View>
      <Stack
        theme={theme}
        bands={[
          { label: 'Your code and data', detail: 'you', color: theme.colors.danger },
          { label: 'Your configuration', detail: 'you', color: theme.colors.danger },
          { label: 'Runtime and OS', detail: 'depends', color: theme.colors.warning },
          { label: 'Virtualisation', detail: 'provider', color: theme.colors.success },
          { label: 'Hardware and network', detail: 'provider', color: theme.colors.success },
        ]}
      />
      <Caption text="Nearly every cloud breach is in the red bands" theme={theme} />
    </View>
  ),

  'render-pipeline': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="Parse" color={theme.colors.textTertiary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Style" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Layout" color={theme.colors.danger} theme={theme} flex={1} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm }}>
        <Chip label="Paint" color={theme.colors.warning} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Composite" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Caption text="Animate transform and opacity — composite only" theme={theme} />
    </View>
  ),

  'event-loop-queues': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Chip label="1. Call stack" color={theme.colors.primary} theme={theme} flex={1} />
        <Chip label="2. Microtasks" color={theme.colors.success} theme={theme} flex={1} />
        <Chip label="3. Macrotasks" color={theme.colors.warning} theme={theme} flex={1} />
      </View>
      <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: theme.spacing.md }}>
        Finish the task → drain every microtask → render → one macrotask
      </Text>
      <Caption text="setTimeout(fn, 0) is not soon" theme={theme} />
    </View>
  ),

  'graphics-pipeline': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="Vertices" color={theme.colors.textTertiary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Transform" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Rasterize" color={theme.colors.primary} theme={theme} flex={1} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm }}>
        <Chip label="Shade" color={theme.colors.warning} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Depth test" color={theme.colors.danger} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Composite" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Caption text="Every stage independent — hence thousands of cores" theme={theme} />
    </View>
  ),

  'control-loop': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="Target" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Error" color={theme.colors.danger} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Controller" color={theme.colors.primary} theme={theme} flex={1} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm }}>
        <Chip label="Plant" color={theme.colors.warning} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Sensor" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: theme.spacing.sm }}>
        ↑ measured value feeds back into the error
      </Text>
      <Caption text="Corrects disturbances nobody told it about" theme={theme} />
    </View>
  ),

  'entropy-bound': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 76, gap: 4 }}>
        {[72, 58, 40, 26, 26, 26, 26].map((height, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              height,
              borderRadius: 3,
              backgroundColor: index >= 3 ? theme.colors.danger : theme.colors.primary,
            }}
          />
        ))}
      </View>
      <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: theme.spacing.sm }}>
        Better compression ← → the entropy floor
      </Text>
      <Caption text="No algorithm goes below the red line" theme={theme} />
    </View>
  ),

  'tls-handshake': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="Certificate" color={theme.colors.info} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Verify chain" color={theme.colors.primary} theme={theme} flex={1} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm }}>
        <Chip label="Agree a key" color={theme.colors.warning} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <Chip label="Symmetric data" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Caption text="Public key for the introduction, AES for the conversation" theme={theme} />
    </View>
  ),

  'ab-test-flow': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Chip label="Users" color={theme.colors.textTertiary} theme={theme} flex={1} />
        <Arrow theme={theme} />
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <Chip label="Control" color={theme.colors.info} theme={theme} />
          <Chip label="Treatment" color={theme.colors.primary} theme={theme} />
        </View>
        <Arrow theme={theme} />
        <Chip label="Compare" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Caption text="Random assignment balances what you never measured" theme={theme} />
    </View>
  ),

  'test-pyramid': (theme) => (
    <View>
      <View style={{ alignItems: 'center', gap: 3 }}>
        <View style={{ width: '35%' }}>
          <Chip label="End to end" color={theme.colors.danger} theme={theme} />
        </View>
        <View style={{ width: '65%' }}>
          <Chip label="Integration" color={theme.colors.warning} theme={theme} />
        </View>
        <View style={{ width: '100%' }}>
          <Chip label="Unit" color={theme.colors.success} theme={theme} />
        </View>
      </View>
      <Caption text="Fast and many at the base, slow and few at the top" theme={theme} />
    </View>
  ),

  'persona-spectrum': (theme) => (
    <View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Chip label="Permanent — one arm" color={theme.colors.danger} theme={theme} flex={1} />
        <Chip label="Temporary — a cast" color={theme.colors.warning} theme={theme} flex={1} />
        <Chip label="Situational — a baby" color={theme.colors.success} theme={theme} flex={1} />
      </View>
      <Caption text="One design serves all three" theme={theme} />
    </View>
  ),
};
