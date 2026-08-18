/**
 * @synapse/ui — the design system.
 *
 * Tokens plus a small set of components. Deliberately small: every component
 * here is used on at least three screens, and anything screen-specific stays in
 * the app rather than accumulating here.
 */

export * from './theme/tokens.js';
export {
  ThemeProvider,
  useTheme,
  useThemePreference,
  useThemedStyles,
} from './theme/ThemeProvider.js';
export type { Theme, ColorScheme, ThemePreference } from './theme/ThemeProvider.js';

export * from './components/index.js';
