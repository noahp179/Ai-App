/**
 * Today — the home screen.
 *
 * Answers one question in the first second: what should I do right now? So the
 * continue card is the largest thing on screen, and everything else (streak,
 * goal ring, review count) is context around that single decision.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ACHIEVEMENTS_BY_ID,
  LESSON_INDEX,
  buildReviewSession,
  continueLearning,
  dueSkills,
  exercisesBySkill,
  formatCompact,
  goalMet,
  isStreakBroken,
  dayKey,
  levelProgress,
  plural,
} from '@synapse/core';
import {
  Badge,
  Button,
  Card,
  ProgressBar,
  ProgressRing,
  Screen,
  StatTile,
  Text,
  useTheme,
} from '@synapse/ui';

import { useProgress } from '../../src/store/useProgress.js';

export default function TodayScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const progress = useProgress((s) => s.progress);

  const today = dayKey(Date.now(), progress.profile.timezoneOffsetMinutes);
  const next = useMemo(() => continueLearning(progress), [progress]);
  const nextLesson = next ? LESSON_INDEX.get(next.lessonId) : undefined;

  const dueCount = useMemo(() => dueSkills(progress.skills).length, [progress.skills]);
  const reviewReady = useMemo(
    () => buildReviewSession(progress.skills, exercisesBySkill(), { maxItems: 15 }).length,
    [progress.skills],
  );

  const level = levelProgress(progress.totalXp);
  const goalFraction = Math.min(1, progress.dailyGoal.xpToday / progress.dailyGoal.targetXp);
  const goalDone = goalMet(progress.dailyGoal);
  const streakAtRisk = !goalDone && progress.streak.current > 0 && !isStreakBroken(progress.streak, today);

  const recentAchievement = progress.achievements[progress.achievements.length - 1];

  return (
    <Screen scroll>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.xl,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="label" tone="tertiary" caps>
            {greeting()}
          </Text>
          <Text variant="title" numberOfLines={1}>
            {progress.profile.displayName}
          </Text>
        </View>

        <ProgressRing value={goalFraction} size={56} thickness={5}>
          <Text variant="label" tone={goalDone ? 'success' : 'secondary'}>
            {goalDone ? '✓' : `${Math.round(goalFraction * 100)}%`}
          </Text>
        </ProgressRing>
      </View>

      {/* Stat row */}
      <Card outlined style={{ marginBottom: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <StatTile
            value={String(progress.streak.current)}
            label="Day streak"
            icon="🔥"
            color={theme.colors.streak}
          />
          <StatTile
            value={formatCompact(progress.totalXp)}
            label="Total XP"
            icon="⚡"
            color={theme.colors.xp}
          />
          <StatTile
            value={
              progress.hearts.current >= progress.hearts.max && progress.entitlement.plan !== 'free'
                ? '∞'
                : String(progress.hearts.current)
            }
            label="Hearts"
            icon="❤️"
            color={theme.colors.heart}
          />
          <StatTile
            value={String(level.level)}
            label="Level"
            icon="🎯"
            color={theme.colors.primary}
          />
        </View>
      </Card>

      {/* Daily goal */}
      <Card outlined style={{ marginBottom: theme.spacing.xl }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.sm,
          }}
        >
          <Text variant="bodyStrong">Daily goal</Text>
          <Text variant="caption" tone="tertiary">
            {progress.dailyGoal.xpToday} / {progress.dailyGoal.targetXp} XP
          </Text>
        </View>
        <ProgressBar
          value={goalFraction}
          color={goalDone ? theme.colors.success : theme.colors.primary}
          accessibilityLabel={`Daily goal ${Math.round(goalFraction * 100)} percent complete`}
        />
        {streakAtRisk ? (
          <Text variant="caption" tone="warning" style={{ marginTop: theme.spacing.sm }}>
            🔥 Finish today's goal to keep your {progress.streak.current}-day streak
          </Text>
        ) : goalDone ? (
          <Text variant="caption" tone="success" style={{ marginTop: theme.spacing.sm }}>
            Goal met — anything more is a bonus
          </Text>
        ) : null}
      </Card>

      {/* The primary action */}
      {nextLesson ? (
        <Card
          onPress={() => router.push(`/lesson/${nextLesson.lesson.id}`)}
          elevated="md"
          style={{
            marginBottom: theme.spacing.lg,
            borderLeftWidth: 5,
            borderLeftColor: nextLesson.track.gradient[0],
          }}
        >
          <Badge
            label={next?.reason === 'continue' ? 'Continue' : 'Start here'}
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

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.lg,
            }}
          >
            <Text variant="label" tone="tertiary" caps>
              {nextLesson.lesson.estimatedMinutes} min
            </Text>
            <Text variant="label" tone="tertiary">
              ·
            </Text>
            <Text variant="label" tone="tertiary" caps>
              {nextLesson.lesson.steps.length} steps
            </Text>
          </View>
        </Card>
      ) : null}

      {/* Review */}
      {reviewReady > 0 ? (
        <Card
          onPress={() => router.push('/practice')}
          outlined
          style={{ marginBottom: theme.spacing.lg }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="title" style={{ marginRight: theme.spacing.md }}>
              🔁
            </Text>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Review is due</Text>
              <Text variant="caption" tone="secondary">
                {plural(dueCount, 'skill')} ready — keep them from slipping
              </Text>
            </View>
            <Text variant="heading" tone="primary">
              →
            </Text>
          </View>
        </Card>
      ) : null}

      {/* Level progress */}
      <Card outlined style={{ marginBottom: theme.spacing.lg }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.sm,
          }}
        >
          <Text variant="caption" tone="secondary">
            Level {level.level}
          </Text>
          <Text variant="caption" tone="tertiary">
            {level.xpIntoLevel} / {level.xpForNextLevel} XP to level {level.level + 1}
          </Text>
        </View>
        <ProgressBar value={level.fraction} height={8} />
      </Card>

      {recentAchievement ? (
        <Card outlined>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="title" style={{ marginRight: theme.spacing.md }}>
              {ACHIEVEMENTS_BY_ID.get(recentAchievement.id)?.icon ?? '🏅'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text variant="label" tone="tertiary" caps>
                Latest achievement
              </Text>
              <Text variant="bodyStrong">
                {ACHIEVEMENTS_BY_ID.get(recentAchievement.id)?.title ?? 'Unlocked'} · tier{' '}
                {recentAchievement.tier}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {progress.entitlement.plan === 'free' ? (
        <Card
          onPress={() => router.push('/paywall?trigger=settings')}
          outlined
          borderColor={theme.colors.warning}
          style={{ marginTop: theme.spacing.lg }}
        >
          <Text variant="bodyStrong" tone="warning">
            Unlock every track
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.xxs }}>
            Unlimited hearts, the full curriculum, and an AI tutor that never runs out.
          </Text>
          <Button
            label="See plans"
            variant="premium"
            size="sm"
            style={{ marginTop: theme.spacing.md, alignSelf: 'flex-start' }}
            onPress={() => router.push('/paywall?trigger=settings')}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
