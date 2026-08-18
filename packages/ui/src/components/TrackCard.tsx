/**
 * A track card for the catalog.
 *
 * Carries the track's identity colour as a left accent bar rather than a full
 * gradient fill — ten saturated cards in a scroll list is exhausting, and the
 * accent gives the same recognisability at a fraction of the visual weight.
 */

import React from 'react';
import { View } from 'react-native';
import type { Level, Track } from '@synapse/core';

import { useTheme } from '../theme/ThemeProvider.js';
import { Badge } from './Badge.js';
import { Card } from './Card.js';
import { ProgressRing } from './ProgressRing.js';
import { Text } from './Text.js';

export interface TrackCardProps {
  track: Track;
  /** 0–1 lessons completed. */
  progress: number;
  locked?: boolean;
  /** Names the prerequisite that is not yet met, for the locked hint. */
  lockedReason?: string;
  onPress?: () => void;
}

const LEVEL_LABEL: Record<Level, string> = {
  intro: 'Intro',
  intermediate: 'Intermediate',
  expert: 'Expert',
};

export function TrackCard({
  track,
  progress,
  locked = false,
  lockedReason,
  onPress,
}: TrackCardProps): React.JSX.Element {
  const theme = useTheme();
  const accent = track.gradient[0];
  const started = progress > 0;
  const complete = progress >= 1;

  const lessonCount = track.units.reduce((n, unit) => n + unit.lessons.length, 0);

  return (
    <Card
      onPress={onPress}
      padded={false}
      outlined
      elevated="sm"
      accessibilityLabel={`${track.title}. ${LEVEL_LABEL[track.level]}. ${Math.round(progress * 100)} percent complete.`}
      style={{ overflow: 'hidden', opacity: locked ? 0.6 : 1 }}
    >
      <View style={{ flexDirection: 'row' }}>
        {/* Identity accent. */}
        <View style={{ width: 5, backgroundColor: accent }} />

        <View style={{ flex: 1, padding: theme.layout.cardPadding }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
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
              <Text variant="heading">{locked ? '🔒' : track.icon}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text variant="subheading" numberOfLines={1}>
                {track.title}
              </Text>
              <Text
                variant="caption"
                tone="tertiary"
                numberOfLines={2}
                style={{ marginTop: theme.spacing.xxs }}
              >
                {track.tagline}
              </Text>
            </View>

            {started && !locked ? (
              <ProgressRing
                value={progress}
                size={40}
                thickness={4}
                color={complete ? theme.colors.success : accent}
                style={{ marginLeft: theme.spacing.sm }}
              >
                <Text variant="label" tone={complete ? 'success' : 'secondary'}>
                  {complete ? '✓' : `${Math.round(progress * 100)}`}
                </Text>
              </ProgressRing>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.md,
            }}
          >
            <Badge label={LEVEL_LABEL[track.level]} tone="primary" />
            <Text variant="label" tone="tertiary" caps>
              {lessonCount} lessons
            </Text>
          </View>

          {locked && lockedReason ? (
            <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.sm }}>
              {lockedReason}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
