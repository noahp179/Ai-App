/**
 * Interactive widget registry.
 *
 * Content references a widget by name; this maps the name to a component. The
 * switch is exhaustive over `InteractiveWidget`, so adding a widget to the
 * domain type without implementing it is a compile error rather than a blank
 * screen a learner discovers.
 */

import React from 'react';
import { View } from 'react-native';
import type { InteractiveWidget } from '@synapse/core';
import { Badge, Card, Text, useTheme } from '@synapse/ui';

import {
  AttentionWidget,
  BiasVarianceWidget,
  ConfusionMatrixWidget,
  EmbeddingWidget,
  GradientDescentWidget,
  PerceptronWidget,
  PromptLabWidget,
  TemperatureWidget,
  TokenizerWidget,
} from './core.js';
import {
  BayesCalculator,
  CrossValidation,
  DataBias,
  EntropyExplorer,
  FeatureScaling,
  MlTypeSorter,
  TrainTestSplit,
} from './foundations.js';
import {
  AnomalyDetection,
  DecisionTree,
  EnsembleVote,
  KMeans,
  Knn,
  LinearRegression,
  PcaProjection,
  Regularization,
  RocCurve,
} from './classic.js';
import {
  ActivationExplorer,
  Convolution,
  LearningRateSchedule,
  NeuralNetTrainer,
} from './deep.js';
import { BeamSearch, MoeRouter, Quantization, RagRetrieval } from './language.js';
import { AgentLoopSim, DiffusionDenoise, DriftMonitor, QLearning } from './applied.js';

export function Interactive({ widget }: { widget: InteractiveWidget }): React.JSX.Element {
  switch (widget) {
    // --- Foundations & data ---
    case 'ml-type-sorter':
      return <MlTypeSorter />;
    case 'train-test-split':
      return <TrainTestSplit />;
    case 'data-bias':
      return <DataBias />;
    case 'bayes-calculator':
      return <BayesCalculator />;
    case 'entropy-explorer':
      return <EntropyExplorer />;
    case 'feature-scaling':
      return <FeatureScaling />;
    case 'cross-validation':
      return <CrossValidation />;

    // --- Classic ML ---
    case 'linear-regression':
      return <LinearRegression />;
    case 'knn':
      return <Knn />;
    case 'kmeans':
      return <KMeans />;
    case 'decision-tree':
      return <DecisionTree />;
    case 'ensemble-vote':
      return <EnsembleVote />;
    case 'pca-projection':
      return <PcaProjection />;
    case 'anomaly-detection':
      return <AnomalyDetection />;
    case 'roc-curve':
      return <RocCurve />;
    case 'confusion-matrix':
      return <ConfusionMatrixWidget />;
    case 'regularization':
      return <Regularization />;
    case 'bias-variance':
      return <BiasVarianceWidget />;

    // --- Deep learning ---
    case 'perceptron':
      return <PerceptronWidget />;
    case 'neural-net-trainer':
      return <NeuralNetTrainer />;
    case 'activation-explorer':
      return <ActivationExplorer />;
    case 'convolution':
      return <Convolution />;
    case 'gradient-descent':
      return <GradientDescentWidget />;
    case 'learning-rate-schedule':
      return <LearningRateSchedule />;

    // --- Language models ---
    case 'tokenizer':
      return <TokenizerWidget />;
    case 'temperature-sampler':
      return <TemperatureWidget />;
    case 'attention-matrix':
      return <AttentionWidget />;
    case 'embedding-space':
      return <EmbeddingWidget />;
    case 'beam-search':
      return <BeamSearch />;
    case 'moe-router':
      return <MoeRouter />;
    case 'quantization':
      return <Quantization />;
    case 'rag-retrieval':
      return <RagRetrieval />;
    case 'prompt-lab':
      return <PromptLabWidget />;

    // --- Applied ---
    case 'q-learning':
      return <QLearning />;
    case 'agent-loop-sim':
      return <AgentLoopSim />;
    case 'diffusion-denoise':
      return <DiffusionDenoise />;
    case 'drift-monitor':
      return <DriftMonitor />;

    default: {
      // Exhaustiveness guard — a new widget name must be handled above.
      const never: never = widget;
      void never;
      return <View />;
    }
  }
}

/**
 * Chrome around a widget in a lesson.
 *
 * Interactives are the one step type with no right answer and no Check button,
 * which is disorienting the first time a learner hits one. So the framing is
 * explicit: a "Hands-on" badge, the instructions in a tinted callout that reads
 * as a prompt rather than as body copy, and a plain statement that nothing here
 * is graded. That removes the "what am I supposed to do?" beat entirely.
 */
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        }}
      >
        <Badge label="Hands-on" tone="info" filled />
        <Text variant="label" tone="tertiary" caps>
          Nothing here is graded
        </Text>
      </View>

      <Text variant="title" style={{ marginBottom: theme.spacing.lg }}>
        {title}
      </Text>

      {/* The instructions are the most important text on the screen — they say
          what to do and what to notice — so they get a tinted callout with a
          left rule rather than sitting in the flow as ordinary prose. */}
      <View
        style={{
          flexDirection: 'row',
          marginBottom: theme.spacing.xl,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.infoSubtle,
          overflow: 'hidden',
        }}
      >
        <View style={{ width: 4, backgroundColor: theme.colors.info }} />
        <View style={{ flex: 1, padding: theme.spacing.lg }}>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.xs }}>
            Try this
          </Text>
          <Text variant="body" tone="secondary">
            {instructions}
          </Text>
        </View>
      </View>

      <Card outlined>
        <Interactive widget={widget} />
      </Card>

      <Text
        variant="caption"
        tone="tertiary"
        align="center"
        style={{ marginTop: theme.spacing.lg }}
      >
        Take as long as you like — continue when you are ready.
      </Text>
    </View>
  );
}
