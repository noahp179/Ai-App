/** Small status pill: level tags, "FREE", "PLUS", streak counts. */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider.js';
import { Text } from './Text.js';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'info';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Filled badges read as a state; subtle ones as metadata. */
  filled?: boolean;
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Badge({
  label,
  tone = 'neutral',
  filled = false,
  leading,
  style,
}: BadgeProps): React.JSX.Element {
  const theme = useTheme();

  const tones: Record<BadgeTone, { solid: string; subtle: string }> = {
    neutral: { solid: theme.colors.surfaceElevated, subtle: theme.colors.surfaceMuted },
    primary: { solid: theme.colors.primary, subtle: theme.colors.primarySubtle },
    success: { solid: theme.colors.success, subtle: theme.colors.successSubtle },
    danger: { solid: theme.colors.danger, subtle: theme.colors.dangerSubtle },
    warning: { solid: theme.colors.warning, subtle: theme.colors.warningSubtle },
    info: { solid: theme.colors.info, subtle: theme.colors.infoSubtle },
  };

  const palette = tones[tone];
  const textTone =
    filled && tone !== 'neutral'
      ? 'onAccent'
      : tone === 'neutral'
        ? 'secondary'
        : tone === 'primary'
          ? 'primary'
          : tone === 'success'
            ? 'success'
            : tone === 'danger'
              ? 'danger'
              : tone === 'warning'
                ? 'warning'
                : 'primary';

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          backgroundColor: filled ? palette.solid : palette.subtle,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radii.pill,
        },
        style,
      ]}
    >
      {leading ? <View style={{ marginRight: theme.spacing.xs }}>{leading}</View> : null}
      <Text variant="label" tone={textTone} caps>
        {label}
      </Text>
    </View>
  );
}
