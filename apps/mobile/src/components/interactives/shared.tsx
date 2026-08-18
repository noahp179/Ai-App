/**
 * Shared primitives for the interactive widgets.
 *
 * Everything here is built from plain views and `PanResponder`. No SVG, no
 * charting library, no native modules — the widgets must run identically on
 * iOS, Android, and the web export that the macOS app is built from, and they
 * are the most memorable part of the product, so "works everywhere" is a hard
 * requirement rather than a preference.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text, useTheme, type Theme } from '@synapse/ui';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** A point in unit space: x and y both in [0, 1], y measured upward. */
export interface UnitPoint {
  x: number;
  y: number;
}

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Euclidean distance in unit space. */
export const dist = (a: UnitPoint, b: UnitPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------------------
// Plot canvas
// ---------------------------------------------------------------------------

export interface PlotCanvasProps {
  height?: number;
  /** Called with unit coordinates (y already flipped so up is +y). */
  onPressPoint?: (point: UnitPoint) => void;
  /** Fires continuously while dragging. Enables drag-to-move interactions. */
  onDragPoint?: (point: UnitPoint) => void;
  children: (size: { width: number; height: number }) => React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A fixed-height drawing surface that reports taps in unit coordinates and
 * hands its measured pixel size to `children`, so marks can be absolutely
 * positioned without every widget re-implementing the measurement dance.
 */
export function PlotCanvas({
  height = 200,
  onPressPoint,
  onDragPoint,
  children,
  style,
}: PlotCanvasProps): React.JSX.Element {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height });
  const sizeRef = useRef({ width: 0, height });

  const toUnit = useCallback((px: number, py: number): UnitPoint => {
    const { width, height: h } = sizeRef.current;
    if (width <= 0 || h <= 0) return { x: 0, y: 0 };
    // Flip y: screen coordinates grow downward, plots grow upward.
    return { x: clamp01(px / width), y: clamp01(1 - py / h) };
  }, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => Boolean(onPressPoint || onDragPoint),
        onMoveShouldSetPanResponder: () => Boolean(onDragPoint),
        onPanResponderGrant: (event) => {
          const point = toUnit(event.nativeEvent.locationX, event.nativeEvent.locationY);
          onPressPoint?.(point);
          onDragPoint?.(point);
        },
        onPanResponderMove: (event) => {
          if (!onDragPoint) return;
          onDragPoint(toUnit(event.nativeEvent.locationX, event.nativeEvent.locationY));
        },
      }),
    [onPressPoint, onDragPoint, toUnit],
  );

  const onLayout = (event: LayoutChangeEvent): void => {
    const next = { width: event.nativeEvent.layout.width, height };
    sizeRef.current = next;
    setSize(next);
  };

  return (
    <View
      {...responder.panHandlers}
      onLayout={onLayout}
      style={[
        {
          height,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {size.width > 0 ? children(size) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

export interface DotProps {
  point: UnitPoint;
  size: { width: number; height: number };
  color: string;
  radius?: number;
  /** Draws a ring instead of a filled dot — used for centroids and queries. */
  hollow?: boolean;
  label?: string;
}

export function Dot({
  point,
  size,
  color,
  radius = 5,
  hollow = false,
  label,
}: DotProps): React.JSX.Element {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: point.x * size.width - radius,
        top: (1 - point.y) * size.height - radius,
        width: radius * 2,
        height: radius * 2,
        borderRadius: radius,
        backgroundColor: hollow ? 'transparent' : color,
        borderWidth: hollow ? 3 : 0,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label ? (
        <Text variant="label" style={{ color, position: 'absolute', top: radius * 2 + 2 }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** A straight line between two unit points, drawn as a rotated rectangle. */
export function Line({
  from,
  to,
  size,
  color,
  thickness = 2,
  dashed = false,
}: {
  from: UnitPoint;
  to: UnitPoint;
  size: { width: number; height: number };
  color: string;
  thickness?: number;
  dashed?: boolean;
}): React.JSX.Element {
  const x1 = from.x * size.width;
  const y1 = (1 - from.y) * size.height;
  const x2 = to.x * size.width;
  const y2 = (1 - to.y) * size.height;

  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x1,
        top: y1 - thickness / 2,
        width: length,
        height: thickness,
        backgroundColor: dashed ? 'transparent' : color,
        borderTopWidth: dashed ? thickness : 0,
        borderColor: color,
        borderStyle: dashed ? 'dashed' : 'solid',
        transform: [{ translateX: 0 }, { rotate: `${angle}deg` }],
        transformOrigin: 'left center',
      }}
    />
  );
}

/** Polyline through unit points — used for loss curves and function plots. */
export function Path({
  points,
  size,
  color,
  thickness = 2,
}: {
  points: UnitPoint[];
  size: { width: number; height: number };
  color: string;
  thickness?: number;
}): React.JSX.Element {
  return (
    <>
      {points.slice(1).map((point, index) => (
        <Line
          key={index}
          from={points[index]!}
          to={point}
          size={size}
          color={color}
          thickness={thickness}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

/** A labelled readout row. Every widget shows its live numbers this way. */
export function Readout({
  items,
}: {
  items: Array<{ label: string; value: string; color?: string }>;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.lg,
        marginTop: theme.spacing.lg,
      }}
    >
      {items.map((item) => (
        <View key={item.label}>
          <Text variant="label" tone="tertiary" caps>
            {item.label}
          </Text>
          <Text variant="subheading" mono style={item.color ? { color: item.color } : undefined}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A row of mutually-exclusive options. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label?: string;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      {label ? (
        <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.xs }}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {options.map((option) => {
          const active = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radii.pill,
                borderWidth: 1,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                backgroundColor: active ? theme.colors.primarySubtle : 'transparent',
              }}
            >
              <Text variant="caption" tone={active ? 'primary' : 'secondary'}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A small action button row — Step, Reset, Run. */
export function ActionRow({
  actions,
}: {
  actions: Array<{ label: string; onPress: () => void; disabled?: boolean; primary?: boolean }>;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          disabled={action.disabled}
          accessibilityRole="button"
          style={{
            flex: 1,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.radii.md,
            alignItems: 'center',
            backgroundColor: action.primary ? theme.colors.primary : theme.colors.surfaceMuted,
            opacity: action.disabled ? 0.4 : 1,
          }}
        >
          <Text variant="caption" tone={action.primary ? 'onAccent' : 'default'}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Explanatory note under a widget. Every widget ends with one. */
export function Note({ children }: { children: string }): React.JSX.Element {
  const theme = useTheme();
  return (
    <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.lg }}>
      {children}
    </Text>
  );
}

/** Horizontal bar, for distributions and importance charts. */
export function Bar({
  fraction,
  color,
  height = 8,
}: {
  fraction: number;
  color: string;
  height?: number;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: theme.colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamp01(fraction) * 100}%`,
          height: '100%',
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

/**
 * A seeded PRNG so generated datasets are stable across re-renders.
 *
 * A scatter plot that reshuffles itself every time the component updates is
 * unusable — you cannot reason about a change you made if the data moved too.
 */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

/** Approximately normal sample via the sum of uniforms. */
export function gaussian(random: () => number, mean = 0, sd = 1): number {
  const u = random() || 1e-9;
  const v = random() || 1e-9;
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Class colours used consistently across every scatter widget. */
export function classColors(theme: Theme): string[] {
  return [theme.colors.primary, theme.colors.warning, theme.colors.success, theme.colors.info];
}
