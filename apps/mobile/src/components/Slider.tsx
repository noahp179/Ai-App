/**
 * A minimal slider built on PanResponder.
 *
 * `@react-native-community/slider` is a native module, which means it does not
 * work in the web export the desktop app is built from. The interactive widgets
 * are the reason people remember these lessons, so they need to work everywhere.
 */

import React, { useCallback, useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';
import { Text, useTheme } from '@synapse/ui';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  /** Formats the readout. Defaults to two significant decimals. */
  format?: (value: number) => string;
  color?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 0.01,
  onChange,
  label,
  format,
  color,
}: SliderProps): React.JSX.Element {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const accent = color ?? theme.colors.primary;

  const setFromX = useCallback(
    (x: number) => {
      const w = widthRef.current;
      if (w <= 0) return;
      const ratio = Math.max(0, Math.min(1, x / w));
      const raw = min + ratio * (max - min);
      const snapped = Math.round(raw / step) * step;
      // Re-clamp: snapping can overshoot the bounds by up to half a step.
      onChange(Math.max(min, Math.min(max, Number(snapped.toFixed(6)))));
    },
    [min, max, step, onChange],
  );

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => setFromX(event.nativeEvent.locationX),
      onPanResponderMove: (event) => setFromX(event.nativeEvent.locationX),
    }),
  ).current;

  const onLayout = (event: LayoutChangeEvent): void => {
    const next = event.nativeEvent.layout.width;
    widthRef.current = next;
    setWidth(next);
  };

  const fraction = max === min ? 0 : (value - min) / (max - min);
  const readout = format ? format(value) : value.toFixed(2);

  return (
    <View>
      {label ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.sm,
          }}
        >
          <Text variant="caption" tone="secondary">
            {label}
          </Text>
          <Text variant="caption" mono style={{ color: accent }}>
            {readout}
          </Text>
        </View>
      ) : null}

      <View
        {...responder.panHandlers}
        onLayout={onLayout}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value }}
        // A generous vertical hit area around a thin visual track.
        style={{ height: 40, justifyContent: 'center' }}
      >
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.colors.surfaceMuted,
            overflow: 'hidden',
          }}
        >
          <View style={{ width: `${fraction * 100}%`, height: '100%', backgroundColor: accent }} />
        </View>

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: Math.max(0, fraction * width - 12),
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: accent,
            borderWidth: 3,
            borderColor: theme.colors.background,
          }}
        />
      </View>
    </View>
  );
}
