/**
 * A selectable answer row.
 *
 * The single most-used interactive element in the app, so it carries the most
 * state: unselected, selected, correct, incorrect, and "this was the right one"
 * revealed after a wrong answer. Colour alone never carries the state — each
 * one also has a distinct icon, for colour-blind users and for glanceability.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Burst, usePop, useShake } from '../motion/index';
import { Text } from './Text';

export type AnswerState = 'idle' | 'selected' | 'correct' | 'incorrect' | 'revealed';

export interface AnswerOptionProps {
  label: string;
  state?: AnswerState;
  onPress?: () => void;
  disabled?: boolean;
  /** Shows a keyboard shortcut hint. Desktop only. */
  shortcut?: string;
  /** Renders the label in monospace — for code and token answers. */
  mono?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AnswerOption({
  label,
  state = 'idle',
  onPress,
  disabled = false,
  shortcut,
  mono = false,
  style,
  testID,
}: AnswerOptionProps): React.JSX.Element {
  const theme = useTheme();
  const { style: popStyle, pop } = usePop();
  const { style: shakeStyle, shake } = useShake();
  const burst = useRef(0);
  const previousState = useRef<AnswerState>(state);

  // React to the *transition* into a graded state, not to every render, so the
  // celebration fires once when the answer lands rather than on each re-render.
  useEffect(() => {
    if (previousState.current === state) return;
    previousState.current = state;
    if (state === 'correct') {
      burst.current += 1;
      pop();
    } else if (state === 'incorrect') {
      shake();
    }
  }, [state, pop, shake]);

  const styling: Record<AnswerState, { border: string; background: string; icon: string | null; iconColor: string }> = {
    idle: {
      border: theme.colors.border,
      background: theme.colors.surface,
      icon: null,
      iconColor: theme.colors.text,
    },
    selected: {
      border: theme.colors.primary,
      background: theme.colors.primarySubtle,
      icon: null,
      iconColor: theme.colors.primary,
    },
    correct: {
      border: theme.colors.success,
      background: theme.colors.successSubtle,
      icon: '✓',
      iconColor: theme.colors.success,
    },
    incorrect: {
      border: theme.colors.danger,
      background: theme.colors.dangerSubtle,
      icon: '✕',
      iconColor: theme.colors.danger,
    },
    revealed: {
      border: theme.colors.success,
      background: 'transparent',
      icon: '→',
      iconColor: theme.colors.success,
    },
  };

  const current = styling[state];

  return (
    <Animated.View style={[popStyle, shakeStyle]}>
      {state === 'correct' ? (
        <Burst
          trigger={burst.current}
          colors={[theme.colors.success, theme.colors.primary]}
          radius={70}
          particleCount={10}
        />
      ) : null}
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: state !== 'idle', disabled }}
      accessibilityLabel={label}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: theme.layout.minTouchTarget + 8,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.lg,
          borderWidth: 2,
          borderColor: current.border,
          backgroundColor: current.background,
          borderStyle: state === 'revealed' ? 'dashed' : 'solid',
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        style,
      ]}
    >
      <Text variant={mono ? 'mono' : 'body'} mono={mono} style={{ flex: 1 }}>
        {label}
      </Text>

      {shortcut ? (
        <View
          style={{
            marginLeft: theme.spacing.sm,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 2,
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        >
          <Text variant="label" tone="tertiary">{shortcut}</Text>
        </View>
      ) : null}

      {current.icon ? (
        <Text
          variant="subheading"
          style={{ marginLeft: theme.spacing.sm, color: current.iconColor }}
        >
          {current.icon}
        </Text>
      ) : null}
    </Pressable>
    </Animated.View>
  );
}
