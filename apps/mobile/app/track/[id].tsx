/**
 * Track detail — the unit and lesson list.
 *
 * Shows the whole shape of the track up front, including what is locked.
 * Hiding paid content would make the catalog feel small; showing it with a
 * clear marker makes the value of upgrading legible.
 */

import React from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TRACKS_BY_ID, canAccessLesson, trackCompletion, trackMastery } from '@synapse/core';
import { Badge, Card, ProgressBar, Screen, Text, useTheme } from '@synapse/ui';

import { useProgress } from '../../src/store/useProgress.js';

export default function TrackScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const progress = useProgress((s) => s.progress);

  const track = id ? TRACKS_BY_ID.get(id) : undefined;

  if (!track) {
    return (
      <Screen>
        <Text variant="body" tone="secondary">
          That track could not be found.
        </Text>
      </Screen>
    );
  }

  const completion = trackCompletion(progress, track.id);
  const mastery = trackMastery(progress, track.id);

  return (
    <Screen scroll>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        style={{ marginBottom: theme.spacing.lg }}
      >
        <Text variant="caption" tone="primary">
          ← Learn
        </Text>
      </Pressable>

      {/* Header */}
      <View
        style={{
          padding: theme.spacing.xl,
          borderRadius: theme.radii.xxl,
          backgroundColor: `${track.gradient[0]}1A`,
          borderWidth: 1,
          borderColor: track.gradient[0],
          marginBottom: theme.spacing.xl,
        }}
      >
        <Text variant="display" style={{ marginBottom: theme.spacing.sm }}>
          {track.icon}
        </Text>
        <Text variant="title">{track.title}</Text>
        <Text variant="body" tone="secondary" style={{ marginTop: theme.spacing.sm }}>
          {track.description}
        </Text>

        <View style={{ marginTop: theme.spacing.xl }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: theme.spacing.xs,
            }}
          >
            <Text variant="label" tone="tertiary" caps>
              {Math.round(completion * 100)}% complete
            </Text>
            <Text variant="label" tone="tertiary" caps>
              {Math.round(mastery * 100)}% mastery
            </Text>
          </View>
          <ProgressBar value={completion} color={track.gradient[0]} />
        </View>
      </View>

      {/* Outcomes */}
      <Card outlined style={{ marginBottom: theme.spacing.xl }}>
        <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
          What you will be able to do
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          {track.outcomes.map((outcome) => (
            <View key={outcome} style={{ flexDirection: 'row' }}>
              <Text variant="caption" tone="success" style={{ marginRight: theme.spacing.sm }}>
                ✓
              </Text>
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                {outcome}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Units */}
      {track.units.map((unit, unitIndex) => (
        <View key={unit.id} style={{ marginBottom: theme.spacing.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs }}>
            <Text variant="label" tone="tertiary" caps>
              Unit {unitIndex + 1}
            </Text>
            {unitIndex === 0 ? (
              <Badge label="Free" tone="success" style={{ marginLeft: theme.spacing.sm }} />
            ) : null}
          </View>

          <Text variant="heading">{unit.title}</Text>
          <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.lg }}>
            {unit.description}
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            {unit.lessons.map((lesson) => {
              const done = progress.lessons[lesson.id];
              const access = canAccessLesson(
                progress.entitlement,
                lesson,
                track.id,
                unitIndex,
              );

              return (
                <Card
                  key={lesson.id}
                  outlined
                  onPress={() =>
                    access.allowed
                      ? router.push(`/lesson/${lesson.id}`)
                      : router.push(`/paywall?trigger=locked-lesson&plan=${access.upsellPlan}`)
                  }
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: theme.spacing.md,
                        backgroundColor: done
                          ? theme.colors.successSubtle
                          : theme.colors.surfaceMuted,
                      }}
                    >
                      <Text variant="caption" tone={done ? 'success' : 'tertiary'}>
                        {!access.allowed ? '🔒' : done ? '✓' : '○'}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {lesson.title}
                      </Text>
                      <Text variant="caption" tone="tertiary" numberOfLines={1}>
                        {lesson.summary}
                      </Text>
                    </View>

                    <Text variant="label" tone="tertiary" caps style={{ marginLeft: theme.spacing.sm }}>
                      {lesson.estimatedMinutes}m
                    </Text>
                  </View>

                  {done ? (
                    <Text variant="label" tone="tertiary" style={{ marginTop: theme.spacing.sm }}>
                      Best accuracy {Math.round(done.accuracy * 100)}% · {done.attempts} attempt
                      {done.attempts > 1 ? 's' : ''}
                    </Text>
                  ) : null}
                </Card>
              );
            })}

            {unit.checkpoint ? (
              <Card
                outlined
                borderColor={
                  progress.completedCheckpointIds.includes(unit.checkpoint.id)
                    ? theme.colors.success
                    : theme.colors.warning
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant="subheading" style={{ marginRight: theme.spacing.md }}>
                    {progress.completedCheckpointIds.includes(unit.checkpoint.id) ? '🏅' : '🎯'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{unit.checkpoint.title}</Text>
                    <Text variant="caption" tone="tertiary">
                      {unit.checkpoint.exercises.length} questions · pass at{' '}
                      {Math.round(unit.checkpoint.passingScore * 100)}%
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}
          </View>
        </View>
      ))}
    </Screen>
  );
}
