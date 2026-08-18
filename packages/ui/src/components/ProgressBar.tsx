/**
 * Progress bar.
 *
 * Animates to its new value rather than jumping, because in a lesson the bar
 * advancing is the reward for answering — a jump-cut throws that away.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider.js';

export interface ProgressBarProps {
  /** 0–1. Values outside the range are clamped. */
  value: number;
  height?: number;
  color?: string;
  trackColor?: string;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function ProgressBar({
  value,
  height = 10,
  color,
  trackColor,
  animated = true,
  style,
  accessibilityLabel,
}: ProgressBarProps): React.JSX.Element {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const progress = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    if (!animated) {
      progress.setValue(clamped);
      return;
    }
    Animated.timing(progress, {
      toValue: clamped,
      duration: theme.motion.normal,
      useNativeDriver: false,
    }).start();
  }, [clamped, animated, progress, theme.motion.normal]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        {
          height,
          borderRadius: height / 2,
          backgroundColor: trackColor ?? theme.colors.surfaceMuted,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? theme.colors.primary,
        }}
      />
    </View>
  );
}
