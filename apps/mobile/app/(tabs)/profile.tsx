/**
 * Profile — progress, mastery, achievements, and settings.
 *
 * The skill radar is the piece worth the space: it shows breadth across AI
 * domains at a glance, which is the thing a learner actually wants to know
 * about themselves and which no single number captures.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ACHIEVEMENTS,
  DOMAIN_LABELS,
  PLANS,
  TRACKS_BY_ID,
  achievementProgress,
  domainMastery,
  formatCompact,
  levelProgress,
  limitsFor,
  plural,
  type Domain,
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
  useThemePreference,
} from '@synapse/ui';

import { useProgress } from '../../src/store/useProgress';

export default function ProfileScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const { preference, setPreference } = useThemePreference();
  const progress = useProgress((s) => s.progress);
  const reset = useProgress((s) => s.reset);

  const level = levelProgress(progress.totalXp);
  const mastery = useMemo(() => domainMastery(progress), [progress]);
  const limits = limitsFor(progress.entitlement);
  const plan = PLANS[progress.entitlement.plan];

  const achievements = useMemo(
    () => achievementProgress(progress.stats, progress.achievements),
    [progress.stats, progress.achievements],
  );
  const unlockedCount = new Set(progress.achievements.map((a) => `${a.id}-${a.tier}`)).size;
  const totalTiers = ACHIEVEMENTS.reduce((n, a) => n + a.tiers.length, 0);

  const masteredDomains = Object.entries(mastery)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8) as Array<[Domain, number]>;

  return (
    <Screen scroll>
      {/* Identity */}
      <View style={{ alignItems: 'center', marginBottom: theme.spacing.xl }}>
        <ProgressRing value={level.fraction} size={92} thickness={7}>
          <Text variant="title">{level.level}</Text>
        </ProgressRing>
        <Text variant="heading" style={{ marginTop: theme.spacing.md }}>
          {progress.profile.displayName}
        </Text>
        <Text variant="caption" tone="tertiary">
          Level {level.level} · {level.xpIntoLevel}/{level.xpForNextLevel} XP to next
        </Text>
        <Badge
          label={plan.name}
          tone={progress.entitlement.plan === 'free' ? 'neutral' : 'primary'}
          filled={progress.entitlement.plan !== 'free'}
          style={{ marginTop: theme.spacing.md }}
        />
      </View>

      {/* Lifetime stats */}
      <Card outlined style={{ marginBottom: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <StatTile value={formatCompact(progress.totalXp)} label="XP" icon="⚡" />
          <StatTile value={String(progress.stats.lessonsCompleted)} label="Lessons" icon="📚" />
          <StatTile value={String(progress.streak.longest)} label="Best streak" icon="🔥" />
          <StatTile value={String(progress.stats.skillsMastered)} label="Mastered" icon="🧠" />
        </View>
      </Card>

      {/* Skill radar, rendered as ranked bars — honest and readable at phone size */}
      {masteredDomains.length > 0 ? (
        <View style={{ marginBottom: theme.spacing.xl }}>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
            Mastery by domain
          </Text>
          <Card outlined>
            <View style={{ gap: theme.spacing.lg }}>
              {masteredDomains.map(([domain, value]) => (
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
                      {Math.round(value * 100)}%
                    </Text>
                  </View>
                  <ProgressBar value={value} height={6} />
                </View>
              ))}
            </View>
          </Card>
        </View>
      ) : null}

      {/* Completed tracks */}
      {progress.completedTrackIds.length > 0 ? (
        <View style={{ marginBottom: theme.spacing.xl }}>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
            Completed tracks
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {progress.completedTrackIds.map((id) => (
              <Badge
                key={id}
                label={TRACKS_BY_ID.get(id)?.title ?? id}
                tone="success"
                leading={<Text variant="caption">{TRACKS_BY_ID.get(id)?.icon}</Text>}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Achievements */}
      <View style={{ marginBottom: theme.spacing.xl }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.md,
          }}
        >
          <Text variant="label" tone="tertiary" caps>
            Achievements
          </Text>
          <Text variant="label" tone="tertiary">
            {unlockedCount} / {totalTiers}
          </Text>
        </View>

        <Card outlined>
          <View style={{ gap: theme.spacing.lg }}>
            {achievements.slice(0, 6).map((entry) => (
              <View key={entry.achievement.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text
                  variant="subheading"
                  style={{
                    marginRight: theme.spacing.md,
                    opacity: entry.highestTier > 0 ? 1 : 0.3,
                  }}
                >
                  {entry.achievement.icon}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="caption">
                    {entry.achievement.title}
                    {entry.highestTier > 0 ? ` · tier ${entry.highestTier}` : ''}
                  </Text>
                  <ProgressBar
                    value={entry.fraction}
                    height={4}
                    style={{ marginTop: theme.spacing.xs }}
                  />
                </View>
                <Text variant="label" tone="tertiary" style={{ marginLeft: theme.spacing.md }}>
                  {entry.nextTier === null ? 'Max' : `${entry.currentValue}/${entry.nextTier}`}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </View>

      {/* Plan */}
      <Card outlined style={{ marginBottom: theme.spacing.xl }}>
        <Text variant="bodyStrong" style={{ marginBottom: theme.spacing.sm }}>
          {plan.name}
        </Text>
        <Text variant="caption" tone="secondary">
          {limits.heartsPerSession === null ? 'Unlimited hearts' : `${limits.heartsPerSession} hearts per session`}
          {' · '}
          {limits.aiTutorQuestionsPerDay === null
            ? 'unlimited tutor'
            : plural(limits.aiTutorQuestionsPerDay, 'tutor question') + ' per day'}
        </Text>
        {progress.entitlement.plan === 'free' ? (
          <Button
            label="Upgrade"
            variant="premium"
            size="sm"
            style={{ marginTop: theme.spacing.md, alignSelf: 'flex-start' }}
            onPress={() => router.push('/paywall?trigger=settings')}
          />
        ) : null}
      </Card>

      {/* Settings */}
      <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
        Settings
      </Text>

      <Card outlined style={{ marginBottom: theme.spacing.md }}>
        <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
          Appearance
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {(['system', 'light', 'dark'] as const).map((option) => (
            <Button
              key={option}
              label={option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
              variant={preference === option ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setPreference(option)}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </Card>

      <Card outlined style={{ marginBottom: theme.spacing.md }}>
        <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.md }}>
          Daily goal · {progress.dailyGoal.targetXp} XP
        </Text>
        <Button
          label="Retake placement test"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/placement')}
        />
      </Card>

      <Button
        label="Reset all progress"
        variant="ghost"
        size="sm"
        onPress={() => void reset()}
        accessibilityHint="Erases every lesson, streak, and achievement on this device"
      />
    </Screen>
  );
}
