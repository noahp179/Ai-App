/**
 * Practice — spaced review.
 *
 * Review is where retention actually happens, so this screen makes the queue
 * legible: what is due, how strong each skill currently is, and when the next
 * item comes back. An empty queue is framed as success, not as a dead end.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  SKILLS_BY_ID,
  buildReviewSession,
  dueSkills,
  exercisesBySkill,
  formatRelativeDue,
  plural,
  retention,
} from '@synapse/core';
import { Badge, Button, Card, EmptyState, ProgressBar, Screen, Text, useTheme } from '@synapse/ui';

import { useProgress } from '../../src/store/useProgress.js';
import { useSession } from '../../src/store/useSession.js';

export default function PracticeScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const progress = useProgress((s) => s.progress);
  const startSession = useSession((s) => s.start);

  const due = useMemo(() => dueSkills(progress.skills), [progress.skills]);
  const reviewExercises = useMemo(
    () => buildReviewSession(progress.skills, exercisesBySkill(), { maxItems: 15 }),
    [progress.skills],
  );

  /** Weakest-first, so the profile view surfaces what is actually slipping. */
  const weakest = useMemo(
    () =>
      Object.values(progress.skills)
        .filter((s) => s.totalReviews > 0)
        .map((state) => ({ state, retention: retention(state) }))
        .sort((a, b) => a.retention - b.retention)
        .slice(0, 8),
    [progress.skills],
  );

  const startReview = (): void => {
    if (reviewExercises.length === 0) return;
    startSession({
      steps: reviewExercises.map((exercise) => ({
        id: exercise.id,
        type: 'exercise' as const,
        exercise,
      })),
      level: 'intermediate',
      mode: 'review',
      // Review never costs hearts. Being locked out of strengthening a skill
      // you already half-know is the exact opposite of what review is for.
      hearts: null,
      requeueMistakes: false,
    });
    router.push('/lesson/review');
  };

  const totalTracked = Object.values(progress.skills).filter((s) => s.totalReviews > 0).length;

  return (
    <Screen scroll>
      <Text variant="title" style={{ marginBottom: theme.spacing.xs }}>
        Practice
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.xl }}>
        Spaced review brings a skill back just as you are about to forget it.
      </Text>

      {reviewExercises.length > 0 ? (
        <Card elevated="md" style={{ marginBottom: theme.spacing.xl }}>
          <Badge label={`${due.length} due`} tone="primary" style={{ marginBottom: theme.spacing.md }} />
          <Text variant="heading">Review session</Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.xs }}>
            {plural(reviewExercises.length, 'question')} · about{' '}
            {Math.max(2, Math.round(reviewExercises.length * 0.4))} min · no hearts spent
          </Text>
          <Button
            label="Start review"
            fullWidth
            size="lg"
            style={{ marginTop: theme.spacing.lg }}
            onPress={startReview}
          />
        </Card>
      ) : totalTracked === 0 ? (
        <EmptyState
          icon="🌱"
          title="Nothing to review yet"
          message="Finish a lesson and the skills you practise will start appearing here on a schedule."
          actionLabel="Go to lessons"
          onAction={() => router.push('/learn')}
        />
      ) : (
        <EmptyState
          icon="✅"
          title="All caught up"
          message="Nothing is due right now. Come back when the next batch matures — or get ahead with a new lesson."
          actionLabel="Learn something new"
          onAction={() => router.push('/learn')}
        />
      )}

      {weakest.length > 0 ? (
        <View>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
            Memory strength
          </Text>

          <Card outlined>
            <View style={{ gap: theme.spacing.lg }}>
              {weakest.map(({ state, retention: strength }) => {
                const skill = SKILLS_BY_ID.get(state.skillId);
                return (
                  <View key={state.skillId}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: theme.spacing.xs,
                      }}
                    >
                      <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                        {skill?.name ?? state.skillId}
                      </Text>
                      <Text variant="label" tone="tertiary">
                        {state.dueAt <= Date.now() ? 'due now' : formatRelativeDue(state.dueAt)}
                      </Text>
                    </View>
                    <ProgressBar
                      value={strength}
                      height={6}
                      color={
                        strength > 0.7
                          ? theme.colors.success
                          : strength > 0.35
                            ? theme.colors.warning
                            : theme.colors.danger
                      }
                    />
                  </View>
                );
              })}
            </View>
          </Card>

          <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.md }}>
            Bars show estimated recall right now. Reviewing a weak skill resets it and lengthens the
            interval before it comes back.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
