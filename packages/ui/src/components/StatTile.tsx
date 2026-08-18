/**
 * A single headline number with a label. Used in the home header row and on
 * the profile screen.
 *
 * The value is the largest thing in the tile and the label is deliberately
 * quiet — a stat row should be scannable in about a second.
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { useCountUp } from '../motion/index';
import { Text } from './Text';

export interface StatTileProps {
  value: string;
  label: string;
  icon?: string;
  /** Tints the value. Use it to key the tile to a colour the user knows. */
  color?: string;
  align?: 'left' | 'center';
  /**
   * Counts up from zero on mount when the value is numeric. On by default —
   * these tiles show XP, streaks, and hearts, and watching them arrive is part
   * of why they are worth showing at all.
   */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function StatTile({
  value,
  label,
  icon,
  color,
  align = 'center',
  animate = true,
  style,
}: StatTileProps): React.JSX.Element {
  const theme = useTheme();

  // Only animate plain integers. Values like "∞", "12.5k", or "3/5" have no
  // meaningful intermediate states, so they render as-is.
  const numeric = /^\d+$/.test(value) ? Number.parseInt(value, 10) : null;
  const counted = useCountUp(numeric ?? 0, { enabled: animate && numeric !== null });
  const shown = numeric !== null && animate ? String(counted) : value;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${value} ${label}`}
      style={[{ alignItems: align === 'center' ? 'center' : 'flex-start' }, style]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        {icon ? <Text variant="subheading">{icon}</Text> : null}
        <Text variant="title" style={color ? { color } : undefined}>
          {shown}
        </Text>
      </View>
      <Text variant="label" tone="tertiary" caps style={{ marginTop: theme.spacing.xxs }}>
        {label}
      </Text>
    </View>
  );
}
