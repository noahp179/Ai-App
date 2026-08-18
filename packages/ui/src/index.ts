/**
 * @synapse/ui — the design system.
 *
 * Tokens plus a small set of components. Deliberately small: every component
 * here is used on at least three screens, and anything screen-specific stays in
 * the app rather than accumulating here.
 */

export * from './theme/tokens';
export {
  ThemeProvider,
  useTheme,
  useThemePreference,
  useThemedStyles,
} from './theme/ThemeProvider';
export type { Theme, ColorScheme, ThemePreference } from './theme/ThemeProvider';

export * from './components/index';

export {
  MotionProvider,
  useReducedMotion,
  useDuration,
  useEntrance,
  Entrance,
  Stagger,
  usePop,
  useShake,
  usePulse,
  useCountUp,
  Burst,
  StepTransition,
  useAnimatedValue,
  useTicker,
} from './motion/index';
export type { EntranceOptions } from './motion/index';
