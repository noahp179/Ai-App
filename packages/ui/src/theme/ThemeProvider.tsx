/**
 * Theme context.
 *
 * Follows the system appearance by default and lets the learner override it in
 * settings. The resolved theme object is memoized on the scheme alone, so a
 * theme change re-renders the tree exactly once.
 */

import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  darkColors,
  elevation,
  gradients,
  layout,
  lightColors,
  motion,
  radii,
  spacing,
  typography,
  type Colors,
} from './tokens.js';

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = ColorScheme | 'system';

export interface Theme {
  scheme: ColorScheme;
  colors: Colors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  elevation: typeof elevation;
  motion: typeof motion;
  gradients: typeof gradients;
  layout: typeof layout;
}

function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radii,
    typography,
    elevation,
    motion,
    gradients,
    layout,
  };
}

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialPreference = 'system',
}: {
  children: ReactNode;
  initialPreference?: ThemePreference;
}): React.JSX.Element {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);

  // Dark is the fallback when the system reports nothing — it is the design's
  // primary theme, and flashing light-then-dark on launch looks broken.
  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: buildTheme(scheme), preference, setPreference }),
    [scheme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Throws outside a provider — a silent default theme hides real setup bugs. */
export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a <ThemeProvider>');
  return context.theme;
}

export function useThemePreference(): {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
} {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemePreference must be used inside a <ThemeProvider>');
  return { preference: context.preference, setPreference: context.setPreference };
}

/**
 * Builds styles from the current theme, memoized per theme instance.
 *
 * Keeps `StyleSheet.create` out of render bodies while still letting styles
 * depend on theme values — the usual RN tradeoff, resolved in one place.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
