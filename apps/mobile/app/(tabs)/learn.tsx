/**
 * Learn — the catalog.
 *
 * The full curriculum, filterable by level and searchable. Recommended order is
 * the default sort, because a new learner faced with eleven tracks needs a
 * suggested path more than they need alphabetical order.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  LEVELS,
  TRACKS_BY_ID,
  catalogStats,
  filterTracks,
  recommendTracks,
  trackCompletion,
  type Level,
} from '@synapse/core';
import { Badge, Card, Screen, Text, TrackCard, useTheme } from '@synapse/ui';

import { useProgress } from '../../src/store/useProgress';

export default function LearnScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const progress = useProgress((s) => s.progress);
  const [levelFilter, setLevelFilter] = useState<Level | null>(null);

  const stats = useMemo(() => catalogStats(), []);

  const tracks = useMemo(() => {
    const recommended = recommendTracks(
      progress.profile.placementLevel ?? progress.profile.selfReportedLevel,
      progress.completedTrackIds,
    );
    const completed = progress.completedTrackIds
      .map((id) => TRACKS_BY_ID.get(id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);

    const ordered = [...recommended, ...completed];
    if (!levelFilter) return ordered;

    const allowed = new Set(filterTracks({ level: levelFilter }).map((t) => t.id));
    return ordered.filter((t) => allowed.has(t.id));
  }, [progress.profile, progress.completedTrackIds, levelFilter]);

  return (
    <Screen scroll>
      <Text variant="title" style={{ marginBottom: theme.spacing.xs }}>
        Learn
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.lg }}>
        {stats.tracks} tracks · {stats.lessons} lessons · {stats.exercises} exercises
      </Text>

      {/* Level filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}
      >
        <FilterChip
          label="All levels"
          active={levelFilter === null}
          onPress={() => setLevelFilter(null)}
        />
        {LEVELS.map((level) => (
          <FilterChip
            key={level}
            label={level === 'intro' ? 'Intro' : level === 'intermediate' ? 'Intermediate' : 'Expert'}
            active={levelFilter === level}
            onPress={() => setLevelFilter(levelFilter === level ? null : level)}
          />
        ))}
      </ScrollView>

      <View style={{ gap: theme.spacing.md }}>
        {tracks.map((track) => {
          const completion = trackCompletion(progress, track.id);
          const unmet = track.prerequisites.filter(
            (id) => !progress.completedTrackIds.includes(id),
          );
          // Prerequisites are advisory, not enforced — a learner who knows the
          // material should not be blocked from proving it.
          const prerequisiteHint =
            unmet.length > 0
              ? `Suggested first: ${unmet.map((id) => TRACKS_BY_ID.get(id)?.title ?? id).join(', ')}`
              : undefined;

          return (
            <TrackCard
              key={track.id}
              track={track}
              progress={completion}
              lockedReason={prerequisiteHint}
              onPress={() => router.push(`/track/${track.id}`)}
            />
          );
        })}
      </View>

      {tracks.length === 0 ? (
        <Card outlined style={{ marginTop: theme.spacing.xl }}>
          <Text variant="body" tone="secondary" align="center">
            No tracks at this level yet.
          </Text>
        </Card>
      ) : null}

      <Card outlined style={{ marginTop: theme.spacing.xl }}>
        <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.sm }}>
          Not sure where to start?
        </Text>
        <Text variant="body" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
          A 12-question placement test finds your level in about three minutes.
        </Text>
        <Pressable onPress={() => router.push('/placement')}>
          <Badge label="Take the placement test →" tone="primary" filled />
        </Pressable>
      </Card>
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
        paddingHorizontal: theme.spacing.lg,
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
