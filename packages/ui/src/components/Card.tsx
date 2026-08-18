/** Surface primitive. Every raised block in the app is one of these. */

import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

export interface CardProps {
  children: React.ReactNode;
  /** Makes the card pressable and gives it a press state. */
  onPress?: () => void;
  padded?: boolean;
  /** Draws a 1px border. Useful when cards sit directly on the background. */
  outlined?: boolean;
  elevated?: 'none' | 'sm' | 'md' | 'lg';
  /** Overrides the surface colour — used for selected and correct/incorrect states. */
  background?: string;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Card({
  children,
  onPress,
  padded = true,
  outlined = false,
  elevated = 'none',
  background,
  borderColor,
  style,
  accessibilityLabel,
  testID,
}: CardProps): React.JSX.Element {
  const theme = useTheme();

  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: background ?? theme.colors.surface,
      borderRadius: theme.radii.xl,
      padding: padded ? theme.layout.cardPadding : 0,
      borderWidth: outlined || borderColor ? 1 : 0,
      borderColor: borderColor ?? theme.colors.border,
    },
    theme.elevation[elevated],
    style,
  ];

  if (!onPress) {
    return (
      <View style={base} testID={testID} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed ? { opacity: 0.82, transform: [{ scale: 0.995 }] } : null]}
    >
      {children}
    </Pressable>
  );
}
