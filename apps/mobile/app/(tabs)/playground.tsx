/**
 * Lab — the interactive widgets, freed from their lessons.
 *
 * Everything here is also embedded in a lesson, but having them in one place
 * gives the app a browsable sandbox: somewhere to go when you want to poke at
 * an idea without committing to a session.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { InteractiveWidget } from '@synapse/core';
import { Card, Screen, Text, useTheme } from '@synapse/ui';

import { Interactive } from '../../src/components/Interactive.js';

interface LabEntry {
  widget: InteractiveWidget;
  title: string;
  blurb: string;
  icon: string;
}

const LAB_ENTRIES: LabEntry[] = [
  {
    widget: 'tokenizer',
    title: 'Tokenizer',
    blurb: 'See how text becomes the units a model actually processes.',
    icon: '🔤',
  },
  {
    widget: 'temperature-sampler',
    title: 'Temperature',
    blurb: 'Watch one distribution reshape from deterministic to noise.',
    icon: '🌡️',
  },
  {
    widget: 'attention-matrix',
    title: 'Attention',
    blurb: 'Trace which words a token looks at, and why pronouns resolve.',
    icon: '👁️',
  },
  {
    widget: 'perceptron',
    title: 'Perceptron',
    blurb: 'Tune weights and a bias until one neuron learns AND.',
    icon: '🔌',
  },
  {
    widget: 'gradient-descent',
    title: 'Gradient descent',
    blurb: 'Find the learning rate that converges — and the one that explodes.',
    icon: '⛰️',
  },
  {
    widget: 'confusion-matrix',
    title: 'Precision vs recall',
    blurb: 'Move the threshold and watch the two trade against each other.',
    icon: '🎯',
  },
  {
    widget: 'bias-variance',
    title: 'Bias–variance',
    blurb: 'Slide model complexity across underfit, good fit, and overfit.',
    icon: '⚖️',
  },
  {
    widget: 'embedding-space',
    title: 'Embedding space',
    blurb: 'Explore why meaning behaves like direction.',
    icon: '🧭',
  },
  {
    widget: 'prompt-lab',
    title: 'Prompt lab',
    blurb: 'Build a prompt one component at a time and watch ambiguity close.',
    icon: '✍️',
  },
];

export default function PlaygroundScreen(): React.JSX.Element {
  const theme = useTheme();
  const [active, setActive] = useState<LabEntry | null>(null);

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
      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.xl }}>
        Nine ideas you can pull on directly. Nothing here is graded.
      </Text>

      <View style={{ gap: theme.spacing.md }}>
        {LAB_ENTRIES.map((entry) => (
          <Card key={entry.widget} onPress={() => setActive(entry)} outlined>
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
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} />
    </Screen>
  );
}
