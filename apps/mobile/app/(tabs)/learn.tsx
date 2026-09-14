/**
 * Learn — the catalog.
 *
 * Paths first, then the full curriculum filterable by level. Sixteen tracks is
 * more than anyone can order for themselves on arrival, so the screen leads
 * with routes through the catalog and offers the catalog itself second.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  LEVELS,
  TRACKS_BY_ID,
  catalogStats,
  filterTracks,
  pathProgress,
  pathStats,
  recommendPaths,
  recommendTracks,
  trackCompletion,
  type Level,
} from '@synapse/core';
import {
  Badge,
  Card,
  Entrance,
  PathCard,
  Screen,
  Text,
  TrackCard,
  useTheme,
} from '@synapse/ui';

import { useProgress } from '../../src/store/useProgress';

export default function LearnScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const progress = useProgress((s) => s.progress);
  const [levelFilter, setLevelFilter] = useState<Level | null>(null);

  const stats = useMemo(() => catalogStats(), []);

  // Paths are curation over the same tracks, so a lesson finished anywhere
  // moves every path containing it. Started paths sort to the front.
  const completedLessonIds = useMemo(
    () => new Set(Object.keys(progress.lessons)),
    [progress.lessons],
  );
  const paths = useMemo(
    () => recommendPaths(completedLessonIds, progress.profile.goals),
    [completedLessonIds, progress.profile.goals],
  );

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

      {/* Paths — a route through the catalog, before the catalog itself.
          Sixteen tracks is a list; someone arriving needs an order. */}
      <Text variant="heading" style={{ marginBottom: theme.spacing.xs }}>
        Where are you going?
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
        Pick a route and the order is decided for you.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xxl }}
      >
        {paths.map((path) => {
          const state = pathProgress(path, completedLessonIds);
          const pStats = pathStats(path);
          return (
            <PathCard
              key={path.id}
              path={path}
              progress={state.fraction}
              tracksDone={state.trackProgress.filter((t) => t.fraction >= 1).length}
              totalTracks={pStats.tracks}
              totalMinutes={pStats.minutes}
              width={286}
              onPress={() => router.push(`/path/${path.id}`)}
            />
          );
        })}
      </ScrollView>

      <Text variant="heading" style={{ marginBottom: theme.spacing.xs }}>
        All tracks
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
        Or browse the whole curriculum and build your own order.
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
        {tracks.map((track, cardIndex) => {
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
            <Entrance key={track.id} index={cardIndex}>
              <TrackCard
                track={track}
                progress={completion}
                lockedReason={prerequisiteHint}
                onPress={() => router.push(`/track/${track.id}`)}
              />
            </Entrance>
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
