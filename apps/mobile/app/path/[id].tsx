/**
 * Path detail — the ordered route through several tracks.
 *
 * The job of this screen is to answer "where am I and what is next", so the
 * continue button is the largest thing on it and the track list below is a map
 * rather than a menu: numbered, in order, with each track's own progress on it.
 */

import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  LESSON_INDEX,
  TRACKS_BY_ID,
  formatDuration,
  getPath,
  pathProgress,
  pathStats,
  trackCompletion,
} from '@synapse/core';
import {
  Badge,
  Button,
  Card,
  Entrance,
  ProgressBar,
  ProgressRing,
  Screen,
  Text,
  useTheme,
} from '@synapse/ui';

import { useProgress } from '../../src/store/useProgress';

export default function PathScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const progress = useProgress((s) => s.progress);

  const path = id ? getPath(id) : undefined;

  const completedLessonIds = useMemo(
    () => new Set(Object.keys(progress.lessons)),
    [progress.lessons],
  );

  const state = useMemo(
    () => (path ? pathProgress(path, completedLessonIds) : null),
    [path, completedLessonIds],
  );
  const stats = useMemo(() => (path ? pathStats(path) : null), [path]);

  if (!path || !state || !stats) {
    return (
      <Screen>
        <Text variant="body" tone="secondary">
          That path could not be found.
        </Text>
      </Screen>
    );
  }

  const nextLesson = state.next ? LESSON_INDEX.get(state.next.lessonId) : undefined;
  const tracksDone = state.trackProgress.filter((t) => t.fraction >= 1).length;

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
          backgroundColor: `${path.gradient[0]}1A`,
          borderWidth: 1,
          borderColor: path.gradient[0],
          marginBottom: theme.spacing.xl,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text variant="label" tone="tertiary" caps>
              Learning path
            </Text>
            <Text variant="title" style={{ marginTop: theme.spacing.xs }}>
              {path.title}
            </Text>
            <Text variant="body" tone="secondary" style={{ marginTop: theme.spacing.sm }}>
              {path.tagline}
            </Text>
          </View>
          <ProgressRing
            value={state.fraction}
            size={56}
            thickness={5}
            color={state.fraction >= 1 ? theme.colors.success : path.gradient[0]}
            style={{ marginLeft: theme.spacing.md }}
          >
            <Text variant="label" tone={state.fraction >= 1 ? 'success' : 'secondary'}>
              {state.fraction >= 1 ? '✓' : `${Math.round(state.fraction * 100)}%`}
            </Text>
          </ProgressRing>
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.xl,
          }}
        >
          <Text variant="label" tone="tertiary" caps>
            {stats.tracks} tracks
          </Text>
          <Text variant="label" tone="tertiary">·</Text>
          <Text variant="label" tone="tertiary" caps>
            {stats.lessons} lessons
          </Text>
          <Text variant="label" tone="tertiary">·</Text>
          <Text variant="label" tone="tertiary" caps>
            ~{formatDuration(stats.minutes)}
          </Text>
        </View>
      </View>

      {/* The one decision this screen exists for */}
      {nextLesson ? (
        <Entrance index={0}>
          <Card elevated="md" style={{ marginBottom: theme.spacing.xl }}>
            <Badge
              label={state.completedLessons > 0 ? 'Continue' : 'Start here'}
              tone="primary"
              style={{ marginBottom: theme.spacing.md }}
            />
            <Text variant="label" tone="tertiary" caps>
              {nextLesson.track.title}
            </Text>
            <Text variant="heading" style={{ marginTop: theme.spacing.xs }}>
              {nextLesson.lesson.title}
            </Text>
            <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.xs }}>
              {nextLesson.lesson.summary}
            </Text>
            <Button
              label="Continue path"
              size="lg"
              fullWidth
              style={{ marginTop: theme.spacing.lg }}
              onPress={() => router.push(`/lesson/${nextLesson.lesson.id}`)}
            />
          </Card>
        </Entrance>
      ) : (
        <Card outlined borderColor={theme.colors.success} style={{ marginBottom: theme.spacing.xl }}>
          <Text variant="heading" tone="success">
            Path complete
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.xs }}>
            Every lesson in all {stats.tracks} tracks. Review is still scheduled — mastery decays
            whether or not the badge says done.
          </Text>
        </Card>
      )}

      {/* Who it is for */}
      <Card outlined style={{ marginBottom: theme.spacing.xl }}>
        <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.xs }}>
          Who this is for
        </Text>
        <Text variant="body" tone="secondary">
          {path.audience}
        </Text>
        <Text variant="body" tone="secondary" style={{ marginTop: theme.spacing.md }}>
          {path.description}
        </Text>
      </Card>

      {/* The route */}
      <Text variant="heading" style={{ marginBottom: theme.spacing.md }}>
        The route
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.lg }}>
        In order, though nothing is locked — skip ahead if you already know it.
      </Text>

      <View style={{ gap: theme.spacing.md }}>
        {state.trackProgress.map((entry, index) => {
          const track = TRACKS_BY_ID.get(entry.trackId);
          if (!track) return null;
          const done = entry.fraction >= 1;
          const isNext = state.next?.trackId === entry.trackId;

          return (
            <Entrance key={entry.trackId} index={index + 1}>
              <Card
                onPress={() => router.push(`/track/${track.id}`)}
                outlined
                borderColor={isNext ? theme.colors.primary : undefined}
                padded={false}
                style={{ overflow: 'hidden', opacity: done ? 0.75 : 1 }}
              >
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ width: 5, backgroundColor: track.gradient[0] }} />
                  <View style={{ flex: 1, padding: theme.layout.cardPadding }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {/* The step number is the point of this list — it is the
                          only thing that makes it a route rather than a set. */}
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: theme.spacing.md,
                          backgroundColor: done
                            ? theme.colors.successSubtle
                            : theme.colors.surfaceMuted,
                        }}
                      >
                        <Text variant="label" tone={done ? 'success' : 'tertiary'}>
                          {done ? '✓' : index + 1}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong" numberOfLines={1}>
                          {track.title}
                        </Text>
                        <Text variant="caption" tone="tertiary" numberOfLines={1}>
                          {track.tagline}
                        </Text>
                      </View>

                      {isNext ? <Badge label="Next" tone="primary" /> : null}
                    </View>

                    <View style={{ marginTop: theme.spacing.md }}>
                      <ProgressBar
                        value={trackCompletion(progress, track.id)}
                        height={6}
                        color={done ? theme.colors.success : track.gradient[0]}
                      />
                      <Text
                        variant="label"
                        tone="tertiary"
                        caps
                        style={{ marginTop: theme.spacing.sm }}
                      >
                        {entry.completed} of {entry.total} lessons
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            </Entrance>
          );
        })}
      </View>

      {/* Outcomes */}
      <Card outlined style={{ marginTop: theme.spacing.xl }}>
        <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
          By the end you will be able to
        </Text>
        {path.outcomes.map((outcome) => (
          <View
            key={outcome}
            style={{ flexDirection: 'row', marginBottom: theme.spacing.sm }}
          >
            <Text variant="body" tone="primary" style={{ marginRight: theme.spacing.sm }}>
              ✓
            </Text>
            <Text variant="body" tone="secondary" style={{ flex: 1 }}>
              {outcome}
            </Text>
          </View>
        ))}
      </Card>

      <Text
        variant="caption"
        tone="tertiary"
        align="center"
        style={{ marginTop: theme.spacing.xl }}
      >
        {tracksDone} of {stats.tracks} tracks finished. Lessons count toward every path that
        contains them.
      </Text>
    </Screen>
  );
}
