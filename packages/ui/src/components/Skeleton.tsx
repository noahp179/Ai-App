/**
 * Shimmering placeholder for loading content.
 *
 * Pulses opacity rather than sliding a gradient — cheaper, and it does not
 * need a gradient dependency to look intentional.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider.js';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius,
  style,
}: SkeletonProps): React.JSX.Element {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radii.sm,
          backgroundColor: theme.colors.skeleton,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }),
        },
        style,
      ]}
    />
  );
}
