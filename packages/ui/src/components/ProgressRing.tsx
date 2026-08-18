/**
 * Circular progress ring, drawn without an SVG dependency.
 *
 * Two half-circle masks rotate to sweep the arc. It is a well-known trick and
 * it keeps the dependency footprint at zero, which matters for a component
 * rendered a dozen times on the catalog screen.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../motion/index';
import { Text } from './Text';

export interface ProgressRingProps {
  /** 0–1. */
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  /** Rendered in the middle. Usually a percentage or an icon. */
  children?: React.ReactNode;
  showPercentage?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ProgressRing({
  value,
  size = 64,
  thickness = 6,
  color,
  trackColor,
  children,
  showPercentage = false,
  style,
}: ProgressRingProps): React.JSX.Element {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const fill = color ?? theme.colors.primary;
  const track = trackColor ?? theme.colors.surfaceMuted;

  // The two half-masks are driven by plain rotation transforms, which cannot be
  // interpolated on the native thread here, so the sweep is animated by
  // stepping React state from a listener. Cheap at this size and it keeps the
  // ring filling rather than snapping — which matters, because the ring *is*
  // the reward on the home screen.
  const animated = useRef(new Animated.Value(target)).current;
  const [clamped, setClamped] = useState(target);

  useEffect(() => {
    if (reduced) {
      setClamped(target);
      return;
    }
    const id = animated.addListener(({ value: v }) => setClamped(v));
    const animation = Animated.timing(animated, {
      toValue: target,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
      animated.removeListener(id);
    };
  }, [target, animated, reduced]);

  const degrees = clamped * 360;
  const rightRotation = Math.min(180, degrees);
  const leftRotation = Math.max(0, degrees - 180);

  const halfStyle: ViewStyle = {
    position: 'absolute',
    width: size / 2,
    height: size,
    overflow: 'hidden',
  };

  const arcStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: thickness,
    borderColor: fill,
    position: 'absolute',
  };

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: track,
        }}
      />

      {/* Right half: sweeps the first 180°. */}
      <View style={[halfStyle, { left: size / 2 }]}>
        <View style={{ width: size / 2, height: size, overflow: 'hidden' }}>
          <View
            style={[
              arcStyle,
              { left: -size / 2, transform: [{ rotate: `${rightRotation - 180}deg` }] },
            ]}
          />
        </View>
      </View>

      {/* Left half: only engages past 180°. */}
      {leftRotation > 0 ? (
        <View style={[halfStyle, { left: 0 }]}>
          <View style={{ width: size / 2, height: size, overflow: 'hidden' }}>
            <View style={[arcStyle, { transform: [{ rotate: `${leftRotation}deg` }] }]} />
          </View>
        </View>
      ) : null}

      {children ?? (showPercentage ? (
        <Text variant="caption" tone="secondary">{`${Math.round(clamped * 100)}%`}</Text>
      ) : null)}
    </View>
  );
}
