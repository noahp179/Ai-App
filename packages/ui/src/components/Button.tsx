/**
 * Button.
 *
 * The press animation is deliberate: a 2px downward translate plus a slight
 * scale, which reads as physically depressing the control. On the answer-check
 * button — pressed dozens of times per session — that tactility is most of what
 * makes the app feel good rather than merely functional.
 */

import React, { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider.js';
import { Text } from './Text.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'premium';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Stretches to the container width. Default for primary session actions. */
  fullWidth?: boolean;
  /** Rendered before the label — an emoji or an icon element. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leading,
  trailing,
  style,
  accessibilityHint,
  testID,
}: ButtonProps): React.JSX.Element {
  const theme = useTheme();
  const press = useRef(new Animated.Value(0)).current;

  const animate = useCallback(
    (toValue: number) => {
      Animated.timing(press, {
        toValue,
        duration: theme.motion.instant,
        useNativeDriver: true,
      }).start();
    },
    [press, theme.motion.instant],
  );

  const heights: Record<ButtonSize, number> = { sm: 40, md: 52, lg: 58 };
  const paddings: Record<ButtonSize, number> = {
    sm: theme.spacing.lg,
    md: theme.spacing.xl,
    lg: theme.spacing.xxl,
  };

  const surfaces: Record<ButtonVariant, { background: string; border: string; textTone: 'default' | 'onAccent' | 'primary' }> = {
    primary: { background: theme.colors.primary, border: 'transparent', textTone: 'onAccent' },
    secondary: { background: theme.colors.surfaceElevated, border: theme.colors.borderStrong, textTone: 'default' },
    ghost: { background: 'transparent', border: 'transparent', textTone: 'primary' },
    success: { background: theme.colors.success, border: 'transparent', textTone: 'onAccent' },
    danger: { background: theme.colors.danger, border: 'transparent', textTone: 'onAccent' },
    premium: { background: theme.colors.warning, border: 'transparent', textTone: 'onAccent' },
  };

  const surface = surfaces[variant];
  const inactive = disabled || loading;

  return (
    <Animated.View
      style={[
        fullWidth ? styles.fullWidth : null,
        {
          opacity: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }),
          transform: [
            { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) },
            { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) },
          ],
        },
        style,
      ]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress}
        onPressIn={() => animate(1)}
        onPressOut={() => animate(0)}
        style={[
          styles.base,
          {
            height: heights[size],
            paddingHorizontal: paddings[size],
            borderRadius: theme.radii.lg,
            backgroundColor: surface.background,
            borderColor: surface.border,
            borderWidth: variant === 'secondary' ? 1 : 0,
            opacity: inactive ? 0.45 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={surface.textTone === 'onAccent' ? theme.colors.textOnAccent : theme.colors.primary}
          />
        ) : (
          <View style={styles.content}>
            {leading ? <View style={{ marginRight: theme.spacing.sm }}>{leading}</View> : null}
            <Text variant={size === 'sm' ? 'caption' : 'bodyStrong'} tone={surface.textTone}>
              {label}
            </Text>
            {trailing ? <View style={{ marginLeft: theme.spacing.sm }}>{trailing}</View> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  content: { flexDirection: 'row', alignItems: 'center' },
  fullWidth: { alignSelf: 'stretch' },
});
