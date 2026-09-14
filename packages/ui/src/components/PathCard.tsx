/**
 * A learning-path card.
 *
 * A path is a route through several tracks, so the card has to answer a
 * different question from `TrackCard`: not "what is this subject" but "is this
 * where I should be going". That is why the audience line is given real
 * prominence — the fastest way to help someone choose is to let them rule
 * options out.
 */

import React from 'react';
import { View } from 'react-native';
import { formatDuration, type Path } from '@synapse/core';

import { useTheme } from '../theme/ThemeProvider';
import { Badge } from './Badge';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

export interface PathCardProps {
  path: Path;
  /** 0–1 across every lesson in the path. */
  progress: number;
  /** Tracks finished, out of the path's total. */
  tracksDone: number;
  totalTracks: number;
  totalMinutes: number;
  /** Fixed width for a horizontal rail; omit to fill the container. */
  width?: number;
  onPress?: () => void;
}

export function PathCard({
  path,
  progress,
  tracksDone,
  totalTracks,
  totalMinutes,
  width,
  onPress,
}: PathCardProps): React.JSX.Element {
  const theme = useTheme();
  const started = progress > 0;
  const complete = progress >= 1;

  return (
    <Card
      onPress={onPress}
      padded={false}
      outlined
      elevated="sm"
      accessibilityLabel={`${path.title}. ${path.tagline}. ${tracksDone} of ${totalTracks} tracks complete.`}
      style={{ overflow: 'hidden', width }}
    >
      <View style={{ flexDirection: 'row', flex: 1 }}>
        {/* Identity rail. Two stops rather than one, because a path spans
            several tracks and the gradient is the only thing carrying that. */}
        <View style={{ width: 5 }}>
          <View style={{ flex: 1, backgroundColor: path.gradient[0] }} />
          <View style={{ flex: 1, backgroundColor: path.gradient[1] }} />
        </View>

        <View style={{ flex: 1, padding: theme.layout.cardPadding }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: theme.spacing.md,
              }}
            >
              <Text variant="heading">{path.icon}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text variant="subheading" numberOfLines={1}>
                {path.title}
              </Text>
              <Text
                variant="caption"
                tone="tertiary"
                numberOfLines={2}
                style={{ marginTop: theme.spacing.xxs }}
              >
                {path.tagline}
              </Text>
            </View>
          </View>

          <Text
            variant="caption"
            tone="secondary"
            numberOfLines={2}
            style={{ marginTop: theme.spacing.md }}
          >
            {path.audience}
          </Text>

          <View style={{ marginTop: theme.spacing.md }}>
            <ProgressBar
              value={progress}
              height={6}
              color={complete ? theme.colors.success : path.gradient[0]}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: theme.spacing.sm,
              }}
            >
              <Text variant="label" tone="tertiary" caps>
                {complete
                  ? 'Complete'
                  : started
                    ? `${tracksDone} of ${totalTracks} tracks`
                    : `${totalTracks} tracks`}
              </Text>
              <Text variant="label" tone="tertiary" caps>
                ~{formatDuration(totalMinutes)}
              </Text>
            </View>
          </View>

          {started && !complete ? (
            <Badge
              label="In progress"
              tone="primary"
              style={{ marginTop: theme.spacing.md }}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}
