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
};
