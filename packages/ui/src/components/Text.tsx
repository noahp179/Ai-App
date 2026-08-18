/**
 * Typed text primitive.
 *
 * Every string in the app goes through here, so type scale and colour roles
 * stay consistent and a global change is a one-file change.
 */

import React from 'react';
import { Platform, Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider.js';
import { monoFontFamily, type TypographyKey } from '../theme/tokens.js';

export type TextTone =
  | 'default'
  | 'secondary'
  | 'tertiary'
  | 'onAccent'
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning';

export interface TextProps extends RNTextProps {
  variant?: TypographyKey;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  /** Renders in the platform monospace face. For code and token displays. */
  mono?: boolean;
  /** Renders uppercase with tracking. Pairs with the `label` variant. */
  caps?: boolean;
}

export function Text({
  variant = 'body',
  tone = 'default',
  align,
  mono = false,
  caps = false,
  style,
  ...rest
}: TextProps): React.JSX.Element {
  const theme = useTheme();

  const toneColor: Record<TextTone, string> = {
    default: theme.colors.text,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    onAccent: theme.colors.textOnAccent,
    primary: theme.colors.primary,
    success: theme.colors.success,
    danger: theme.colors.danger,
    warning: theme.colors.warning,
  };

  return (
    <RNText
      {...rest}
      style={[
        theme.typography[variant],
        { color: toneColor[tone] },
        align ? { textAlign: align } : null,
        mono ? { fontFamily: Platform.select(monoFontFamily) } : null,
        caps ? { textTransform: 'uppercase' } : null,
        style,
      ]}
    />
  );
}
