/**
 * Empty state.
 *
 * Every empty list in the app gets one of these rather than a blank screen —
 * an empty review queue is good news and should say so.
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider.js';
import { Button } from './Button.js';
import { Text } from './Text.js';

export interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: theme.spacing.giant,
          paddingHorizontal: theme.spacing.xl,
        },
        style,
      ]}
    >
      <Text variant="display" style={{ marginBottom: theme.spacing.md }}>
        {icon}
      </Text>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text
        variant="body"
        tone="secondary"
        align="center"
        style={{ marginTop: theme.spacing.sm, maxWidth: 320 }}
      >
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          style={{ marginTop: theme.spacing.xl }}
        />
      ) : null}
    </View>
  );
}
