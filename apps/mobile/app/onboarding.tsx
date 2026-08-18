/**
 * Onboarding.
 *
 * Four short steps, and every one of them changes what the app does afterwards:
 * goals feed track recommendations, self-reported level sets the starting
 * difficulty, and the daily commitment sets the XP target the streak runs on.
 * Nothing here is asked purely to be asked.
 */

import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GOAL_PRESETS, LEVELS, type LearnerGoal, type Level } from '@synapse/core';
import { Button, Card, ProgressBar, Screen, Text, useTheme } from '@synapse/ui';

import { useProgress } from '../src/store/useProgress.js';

const GOALS: Array<{ id: LearnerGoal; icon: string; label: string; blurb: string }> = [
  { id: 'curious', icon: '🤔', label: 'Understand the hype', blurb: 'Follow the conversation properly' },
  { id: 'career-switch', icon: '🚀', label: 'Change careers', blurb: 'Build toward an AI or ML role' },
  { id: 'build-products', icon: '🛠️', label: 'Build with AI', blurb: 'Ship features that use models' },
  { id: 'research', icon: '🔬', label: 'Go deep', blurb: 'Read papers and understand the maths' },
  { id: 'lead-teams', icon: '🧭', label: 'Lead a team', blurb: 'Make good calls about AI projects' },
  { id: 'exam-prep', icon: '📝', label: 'Pass an exam', blurb: 'Coursework or a certification' },
];

const LEVEL_COPY: Record<Level, { label: string; blurb: string }> = {
  intro: { label: 'New to this', blurb: 'Little or no background — start from first principles' },
  intermediate: { label: 'Some background', blurb: 'You know the vocabulary and have used the tools' },
  expert: { label: 'Experienced', blurb: 'You have trained models or shipped AI systems' },
};

export default function OnboardingScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const completeOnboarding = useProgress((s) => s.completeOnboarding);

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [goals, setGoals] = useState<LearnerGoal[]>([]);
  const [level, setLevel] = useState<Level>('intro');
  const [minutes, setMinutes] = useState(10);

  const steps = ['name', 'goals', 'level', 'commitment'] as const;
  const current = steps[stepIndex]!;

  const canAdvance =
    current === 'name'
      ? name.trim().length > 0
      : current === 'goals'
        ? goals.length > 0
        : true;

  const next = (): void => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
      return;
    }

    completeOnboarding({
      displayName: name.trim() || 'Learner',
      selfReportedLevel: level,
      goals,
      dailyMinutes: minutes,
    });

    // Offer placement rather than forcing it — an experienced learner wants it,
    // a nervous beginner is put off by a test before they have learned anything.
    router.replace(level === 'intro' ? '/(tabs)' : '/placement');
  };

  const toggleGoal = (goal: LearnerGoal): void =>
    setGoals((current) =>
      current.includes(goal) ? current.filter((g) => g !== goal) : [...current, goal],
    );

  return (
    <Screen scroll footerSpace={96}>
      <ProgressBar
        value={(stepIndex + 1) / steps.length}
        height={6}
        style={{ marginBottom: theme.spacing.xxxl }}
      />

      {current === 'name' ? (
        <View>
          <Text variant="display" style={{ marginBottom: theme.spacing.lg }}>
            ✦
          </Text>
          <Text variant="title">Welcome to Synapse</Text>
          <Text variant="body" tone="secondary" style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.xxl }}>
            Learn how AI actually works — from first principles to production systems.
          </Text>

          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.sm }}>
            What should we call you?
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={theme.colors.textTertiary}
            autoFocus
            style={{
              padding: theme.spacing.lg,
              borderRadius: theme.radii.lg,
              borderWidth: 2,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              ...theme.typography.subheading,
            }}
          />
        </View>
      ) : null}

      {current === 'goals' ? (
        <View>
          <Text variant="title">Why are you here?</Text>
          <Text variant="body" tone="secondary" style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
            Pick everything that applies — this shapes which tracks we suggest first.
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            {GOALS.map((goal) => {
              const selected = goals.includes(goal.id);
              return (
                <Card
                  key={goal.id}
                  onPress={() => toggleGoal(goal.id)}
                  outlined
                  borderColor={selected ? theme.colors.primary : undefined}
                  background={selected ? theme.colors.primarySubtle : undefined}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text variant="subheading" style={{ marginRight: theme.spacing.md }}>
                      {goal.icon}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{goal.label}</Text>
                      <Text variant="caption" tone="tertiary">
                        {goal.blurb}
                      </Text>
                    </View>
                    {selected ? <Text variant="body" tone="primary">✓</Text> : null}
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      ) : null}

      {current === 'level' ? (
        <View>
          <Text variant="title">Where are you starting?</Text>
          <Text variant="body" tone="secondary" style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
            Be honest — you can change this any time, and the placement test can settle it for you.
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            {LEVELS.map((candidate) => {
              const selected = level === candidate;
              return (
                <Card
                  key={candidate}
                  onPress={() => setLevel(candidate)}
                  outlined
                  borderColor={selected ? theme.colors.primary : undefined}
                  background={selected ? theme.colors.primarySubtle : undefined}
                >
                  <Text variant="bodyStrong">{LEVEL_COPY[candidate].label}</Text>
                  <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.xxs }}>
                    {LEVEL_COPY[candidate].blurb}
                  </Text>
                </Card>
              );
            })}
          </View>
        </View>
      ) : null}

      {current === 'commitment' ? (
        <View>
          <Text variant="title">How much time a day?</Text>
          <Text variant="body" tone="secondary" style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
            Consistency beats intensity. Five minutes every day genuinely outperforms an hour on Sundays.
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            {GOAL_PRESETS.map((preset) => {
              const selected = minutes === preset.minutes;
              return (
                <Card
                  key={preset.minutes}
                  onPress={() => setMinutes(preset.minutes)}
                  outlined
                  borderColor={selected ? theme.colors.primary : undefined}
                  background={selected ? theme.colors.primarySubtle : undefined}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">
                        {preset.label} · {preset.minutes} min
                      </Text>
                      <Text variant="caption" tone="tertiary">
                        {preset.targetXp} XP a day
                      </Text>
                    </View>
                    {selected ? <Text variant="body" tone="primary">✓</Text> : null}
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: theme.spacing.xxxl, gap: theme.spacing.md }}>
        <Button
          label={stepIndex === steps.length - 1 ? 'Start learning' : 'Continue'}
          size="lg"
          fullWidth
          disabled={!canAdvance}
          onPress={next}
        />
        {stepIndex > 0 ? (
          <Pressable onPress={() => setStepIndex(stepIndex - 1)} style={{ alignItems: 'center' }}>
            <Text variant="caption" tone="tertiary">
              Back
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
