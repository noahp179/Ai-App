/**
 * The adaptive placement test.
 *
 * Twelve questions that get harder when you are right and easier when you are
 * wrong. The result is a starting level and a per-domain profile — and it is
 * always presented as a suggestion the learner can override, because a test
 * that tells someone they are a beginner when they disagree just loses them.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  DOMAIN_LABELS,
  PLACEMENT_LENGTH,
  nextQuestion,
  placementPool,
  scorePlacement,
  startPlacement,
  submitPlacementAnswer,
  type Domain,
  type PlacementState,
  type Response,
} from '@synapse/core';
import { Badge, Button, Card, ProgressBar, Screen, Text, useTheme } from '@synapse/ui';

import { ExerciseView } from '../src/components/ExerciseView';
import { useProgress } from '../src/store/useProgress';

export default function PlacementScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const setPlacementLevel = useProgress((s) => s.setPlacementLevel);

  const pool = useMemo(() => placementPool(), []);
  const [state, setState] = useState<PlacementState>(() => startPlacement());
  const [draft, setDraft] = useState<Response | null>(null);

  const question = useMemo(() => nextQuestion(state, pool), [state, pool]);
  const finished = state.finished || question === null;

  const submit = (): void => {
    if (!question || !draft) return;
    setState(submitPlacementAnswer(state, question, draft));
    setDraft(null);
  };

  if (finished) {
    const result = scorePlacement(state);
    const domains = Object.entries(result.domainScores) as Array<[Domain, number]>;

    return (
      <Screen scroll>
        <Text variant="display" style={{ marginBottom: theme.spacing.lg }}>
          🎯
        </Text>
        <Text variant="title">
          You are starting at{' '}
          {result.level === 'intro'
            ? 'Intro'
            : result.level === 'intermediate'
              ? 'Intermediate'
              : 'Expert'}
        </Text>
        <Text variant="body" tone="secondary" style={{ marginTop: theme.spacing.sm }}>
          {result.correctCount} of {result.totalCount} correct.
          {result.confidence < 0.5
            ? ' That was close to a boundary — you can retake this any time from your profile.'
            : ' You can change this any time; nothing is locked to it.'}
        </Text>

        {domains.length > 0 ? (
          <Card outlined style={{ marginTop: theme.spacing.xxl }}>
            <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
              By domain
            </Text>
            <View style={{ gap: theme.spacing.md }}>
              {domains
                .sort(([, a], [, b]) => b - a)
                .map(([domain, score]) => (
                  <View key={domain}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: theme.spacing.xs,
                      }}
                    >
                      <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                        {DOMAIN_LABELS[domain] ?? domain}
                      </Text>
                      <Text variant="label" tone="tertiary">
                        {Math.round(score * 100)}%
                      </Text>
                    </View>
                    <ProgressBar
                      value={score}
                      height={6}
                      color={score >= 0.6 ? theme.colors.success : theme.colors.warning}
                    />
                  </View>
                ))}
            </View>
          </Card>
        ) : null}

        <Button
          label="Start learning"
          size="lg"
          fullWidth
          style={{ marginTop: theme.spacing.xxl }}
          onPress={() => {
            setPlacementLevel(result.level);
            router.replace('/(tabs)');
          }}
        />

        <Pressable
          onPress={() => setState(startPlacement())}
          style={{ marginTop: theme.spacing.lg, alignItems: 'center' }}
        >
          <Text variant="caption" tone="tertiary">
            Retake the test
          </Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.layout.screenPadding,
          paddingBottom: theme.spacing.lg,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text variant="heading" tone="tertiary">
            ✕
          </Text>
        </Pressable>
        <ProgressBar value={state.asked.length / PLACEMENT_LENGTH} style={{ flex: 1 }} />
        <Text variant="caption" tone="tertiary">
          {state.asked.length + 1}/{PLACEMENT_LENGTH}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.layout.screenPadding,
          paddingBottom: 160,
          maxWidth: theme.layout.maxReadingWidth,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        <Badge
          label={
            question.level === 'intro'
              ? 'Intro'
              : question.level === 'intermediate'
                ? 'Intermediate'
                : 'Expert'
          }
          tone="primary"
          style={{ marginBottom: theme.spacing.lg }}
        />

        <ExerciseView
          exercise={question.exercise}
          draft={draft}
          onDraftChange={setDraft}
          result={null}
        />
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: theme.layout.screenPadding,
          backgroundColor: theme.colors.background,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        }}
      >
        <Button label="Submit" size="lg" fullWidth disabled={draft === null} onPress={submit} />
        <Pressable
          onPress={() => {
            setState(submitPlacementAnswer(state, question, { kind: 'skipped' }));
            setDraft(null);
          }}
          style={{ marginTop: theme.spacing.md, alignItems: 'center' }}
        >
          <Text variant="caption" tone="tertiary">
            I don't know
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
