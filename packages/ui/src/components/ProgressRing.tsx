/**
 * Circular progress ring, drawn without an SVG dependency.
 *
 * Two half-circle masks rotate to sweep the arc. It is a well-known trick and
 * it keeps the dependency footprint at zero, which matters for a component
 * rendered a dozen times on the catalog screen.
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
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
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const fill = color ?? theme.colors.primary;
  const track = trackColor ?? theme.colors.surfaceMuted;

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
