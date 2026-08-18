/**
 * Lab — every interactive widget, freed from its lesson.
 *
 * All 36 are also embedded in lessons, but a browsable sandbox is worth having
 * on its own: somewhere to poke at an idea without committing to a session, and
 * somewhere to come back to when a concept has gone fuzzy.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { InteractiveWidget } from '@synapse/core';
import { Badge, Card, Entrance, Screen, Text, useTheme } from '@synapse/ui';

import { Interactive } from '../../src/components/interactives/index';

interface LabEntry {
  widget: InteractiveWidget;
  title: string;
  blurb: string;
  icon: string;
  group: LabGroup;
}

type LabGroup = 'Foundations' | 'Classic ML' | 'Deep learning' | 'Language models' | 'Applied';

const GROUPS: LabGroup[] = ['Foundations', 'Classic ML', 'Deep learning', 'Language models', 'Applied'];

const LAB_ENTRIES: LabEntry[] = [
  // --- Foundations ---
  { widget: 'ml-type-sorter', title: 'Which type of ML?', blurb: 'Sort real scenarios into the four learning paradigms.', icon: '🗂️', group: 'Foundations' },
  { widget: 'train-test-split', title: 'Train / test split', blurb: 'Resize the splits, then watch peeking at test inflate your score.', icon: '✂️', group: 'Foundations' },
  { widget: 'data-bias', title: 'How bias enters', blurb: 'Skew the sample and watch per-group accuracy diverge.', icon: '⚖️', group: 'Foundations' },
  { widget: 'bayes-calculator', title: 'Bayes and base rates', blurb: 'Why a 99% accurate test can be usually wrong.', icon: '🎲', group: 'Foundations' },
  { widget: 'entropy-explorer', title: 'Entropy', blurb: 'Drag a distribution and watch uncertainty rise and fall.', icon: '📉', group: 'Foundations' },
  { widget: 'feature-scaling', title: 'Feature scaling', blurb: 'Same data, same algorithm, different nearest neighbour.', icon: '📏', group: 'Foundations' },
  { widget: 'cross-validation', title: 'Cross-validation', blurb: 'Step through the folds and watch the variance of the estimate.', icon: '🔀', group: 'Foundations' },

  // --- Classic ML ---
  { widget: 'linear-regression', title: 'Fit a line', blurb: 'Drag slope and intercept against live mean squared error.', icon: '📈', group: 'Classic ML' },
  { widget: 'knn', title: 'k-nearest neighbours', blurb: 'Move the query point and sweep k from 1 to 25.', icon: '🎯', group: 'Classic ML' },
  { widget: 'kmeans', title: 'k-means clustering', blurb: 'Place points and step the algorithm to convergence.', icon: '🔵', group: 'Classic ML' },
  { widget: 'decision-tree', title: 'Decision tree splits', blurb: 'Pick a split and watch Gini impurity and information gain.', icon: '🌳', group: 'Classic ML' },
  { widget: 'ensemble-vote', title: 'Ensembles', blurb: 'Why a committee of weak models beats a strong one.', icon: '🗳️', group: 'Classic ML' },
  { widget: 'pca-projection', title: 'PCA', blurb: 'Rotate the axis to find the direction of maximum variance.', icon: '🧭', group: 'Classic ML' },
  { widget: 'anomaly-detection', title: 'Anomaly detection', blurb: 'Move the threshold and trade catches against false alarms.', icon: '🚨', group: 'Classic ML' },
  { widget: 'roc-curve', title: 'ROC and PR curves', blurb: 'Trace the curve, then see AUC lie on imbalanced data.', icon: '📐', group: 'Classic ML' },
  { widget: 'confusion-matrix', title: 'Precision vs recall', blurb: 'The threshold is a product decision, not a technical one.', icon: '🔲', group: 'Classic ML' },
  { widget: 'regularization', title: 'L1 vs L2', blurb: 'Watch L1 zero out weights and L2 merely shrink them.', icon: '🪫', group: 'Classic ML' },
  { widget: 'bias-variance', title: 'Bias–variance', blurb: 'Slide complexity across underfit, good fit, and overfit.', icon: '⚗️', group: 'Classic ML' },

  // --- Deep learning ---
  { widget: 'perceptron', title: 'One neuron', blurb: 'Tune weights and bias until a single neuron learns AND.', icon: '🔌', group: 'Deep learning' },
  { widget: 'neural-net-trainer', title: 'Train a network', blurb: 'A real MLP with real backprop. Try XOR with no hidden layer.', icon: '🧠', group: 'Deep learning' },
  { widget: 'activation-explorer', title: 'Activations', blurb: 'Plot each function against its derivative — where gradients die.', icon: '〰️', group: 'Deep learning' },
  { widget: 'convolution', title: 'Convolution', blurb: 'Step a kernel across pixels and watch each output computed.', icon: '🔍', group: 'Deep learning' },
  { widget: 'gradient-descent', title: 'Gradient descent', blurb: 'Find the learning rate that converges — and the one that explodes.', icon: '⛰️', group: 'Deep learning' },
  { widget: 'learning-rate-schedule', title: 'LR schedules', blurb: 'Constant, step, cosine, and why warmup exists.', icon: '📅', group: 'Deep learning' },

  // --- Language models ---
  { widget: 'tokenizer', title: 'Tokenizer', blurb: 'See how text becomes the units a model actually processes.', icon: '🔤', group: 'Language models' },
  { widget: 'temperature-sampler', title: 'Temperature', blurb: 'Watch one distribution reshape from deterministic to noise.', icon: '🌡️', group: 'Language models' },
  { widget: 'attention-matrix', title: 'Attention', blurb: 'Trace which words a token attends to, and why pronouns resolve.', icon: '👁️', group: 'Language models' },
  { widget: 'embedding-space', title: 'Embeddings', blurb: 'Explore why meaning behaves like direction.', icon: '🗺️', group: 'Language models' },
  { widget: 'beam-search', title: 'Beam search', blurb: 'Greedy decoding versus keeping several sequences alive.', icon: '🔦', group: 'Language models' },
  { widget: 'moe-router', title: 'Mixture of experts', blurb: 'Route tokens to experts and watch the router collapse.', icon: '🎛️', group: 'Language models' },
  { widget: 'quantization', title: 'Quantization', blurb: 'Drop precision and watch memory, speed, and error move.', icon: '🗜️', group: 'Language models' },
  { widget: 'rag-retrieval', title: 'RAG retrieval', blurb: 'Rank chunks by similarity — and see where semantic search fails.', icon: '📚', group: 'Language models' },
  { widget: 'prompt-lab', title: 'Prompt lab', blurb: 'Build a prompt one component at a time and close the ambiguity.', icon: '✍️', group: 'Language models' },

  // --- Applied ---
  { widget: 'q-learning', title: 'Q-learning', blurb: 'Train an agent in a gridworld and watch reward propagate back.', icon: '🎮', group: 'Applied' },
  { widget: 'agent-loop-sim', title: 'Agent loop', blurb: 'Step through observe-think-act, then inject a tool failure.', icon: '🤖', group: 'Applied' },
  { widget: 'diffusion-denoise', title: 'Diffusion', blurb: 'Drag from pure noise to a finished image, one step at a time.', icon: '🎨', group: 'Applied' },
  { widget: 'drift-monitor', title: 'Drift monitoring', blurb: 'Watch a model degrade while every health dashboard stays green.', icon: '📡', group: 'Applied' },
];

export default function PlaygroundScreen(): React.JSX.Element {
  const theme = useTheme();
  const [active, setActive] = useState<LabEntry | null>(null);
  const [group, setGroup] = useState<LabGroup | null>(null);

  const visible = useMemo(
    () => (group ? LAB_ENTRIES.filter((e) => e.group === group) : LAB_ENTRIES),
    [group],
  );

  if (active) {
    return (
      <Screen scroll>
        <Pressable
          onPress={() => setActive(null)}
          style={{ marginBottom: theme.spacing.lg }}
          accessibilityRole="button"
        >
          <Text variant="caption" tone="primary">
            ← All experiments
          </Text>
        </Pressable>

        <Badge label={active.group} tone="primary" style={{ marginBottom: theme.spacing.md }} />
        <Text variant="title">{active.title}</Text>
        <Text variant="body" tone="secondary" style={{ marginVertical: theme.spacing.lg }}>
          {active.blurb}
        </Text>

        <Card outlined>
          <Interactive widget={active.widget} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text variant="title" style={{ marginBottom: theme.spacing.xs }}>
        Lab
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.lg }}>
        {LAB_ENTRIES.length} ideas you can pull on directly. Nothing here is graded.
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
        <FilterChip label="All" active={group === null} onPress={() => setGroup(null)} />
        {GROUPS.map((g) => (
          <FilterChip
            key={g}
            label={g}
            active={group === g}
            onPress={() => setGroup(group === g ? null : g)}
          />
        ))}
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {visible.map((entry, cardIndex) => (
          <Entrance key={entry.widget} index={cardIndex}>
          <Card onPress={() => setActive(entry)} outlined>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: theme.spacing.md,
                }}
              >
                <Text variant="subheading">{entry.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{entry.title}</Text>
                <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.xxs }}>
                  {entry.blurb}
                </Text>
              </View>
              <Text variant="subheading" tone="tertiary">
                →
              </Text>
            </View>
          </Card>
          </Entrance>
        ))}
      </View>
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        borderColor: active ? theme.colors.primary : theme.colors.border,
        backgroundColor: active ? theme.colors.primarySubtle : 'transparent',
      }}
    >
      <Text variant="caption" tone={active ? 'primary' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}
