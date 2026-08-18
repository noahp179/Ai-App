/**
 * Design tokens.
 *
 * The whole visual language lives here: two palettes, one spacing scale, one
 * type scale. Components read tokens and never hardcode a colour or a pixel
 * value, which is what keeps the app looking like one product rather than
 * fifteen screens built on different days.
 *
 * Dark is the primary theme. The app is used in the evening, in bed, on a
 * phone — and a dark surface makes the gradient accents that carry the brand
 * read properly.
 */

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

/** Raw ramps. Components use semantic names below, not these. */
const palette = {
  violet: {
    50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 300: '#C4B5FD',
    400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9',
    800: '#5B21B6', 900: '#4C1D95',
  },
  indigo: {
    50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC',
    400: '#818CF8', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA',
    800: '#3730A3', 900: '#312E81',
  },
  slate: {
    50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1',
    400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155',
    800: '#1E293B', 900: '#0F172A', 950: '#020617',
  },
  emerald: { 300: '#6EE7B7', 400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857' },
  rose: { 300: '#FDA4AF', 400: '#FB7185', 500: '#F43F5E', 600: '#E11D48', 700: '#BE123C' },
  amber: { 300: '#FCD34D', 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706' },
  cyan: { 300: '#67E8F9', 400: '#22D3EE', 500: '#06B6D4', 600: '#0891B2' },
  white: '#FFFFFF',
  black: '#000000',
} as const;

// ---------------------------------------------------------------------------
// Semantic colours
// ---------------------------------------------------------------------------

export interface Colors {
  /** Page background, furthest back. */
  background: string;
  /** Raised surface: cards, sheets, list rows. */
  surface: string;
  /** A surface on top of a surface — a nested card, a selected option. */
  surfaceElevated: string;
  /** Subtle fill for chips and inactive segments. */
  surfaceMuted: string;

  border: string;
  borderStrong: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  /** Text that sits on a filled brand or semantic colour. */
  textOnAccent: string;

  primary: string;
  primaryPressed: string;
  primarySubtle: string;

  success: string;
  successSubtle: string;
  danger: string;
  dangerSubtle: string;
  warning: string;
  warningSubtle: string;
  info: string;
  infoSubtle: string;

  /** Streak flame and heart colours, used in the top bar. */
  streak: string;
  heart: string;
  gem: string;
  xp: string;

  /** Scrim behind modals and sheets. */
  scrim: string;
  /** Skeleton loading blocks. */
  skeleton: string;
}

export const darkColors: Colors = {
  background: palette.slate[950],
  surface: '#0B1220',
  surfaceElevated: palette.slate[800],
  surfaceMuted: '#111C31',

  border: '#1E2A44',
  borderStrong: '#2C3B5A',

  text: palette.slate[50],
  textSecondary: palette.slate[300],
  textTertiary: palette.slate[400],
  textOnAccent: palette.white,

  primary: palette.violet[500],
  primaryPressed: palette.violet[600],
  primarySubtle: 'rgba(139, 92, 246, 0.16)',

  success: palette.emerald[400],
  successSubtle: 'rgba(52, 211, 153, 0.16)',
  danger: palette.rose[400],
  dangerSubtle: 'rgba(251, 113, 133, 0.16)',
  warning: palette.amber[400],
  warningSubtle: 'rgba(251, 191, 36, 0.16)',
  info: palette.cyan[400],
  infoSubtle: 'rgba(34, 211, 238, 0.16)',

  streak: palette.amber[400],
  heart: palette.rose[400],
  gem: palette.cyan[400],
  xp: palette.violet[400],

  scrim: 'rgba(2, 6, 23, 0.72)',
  skeleton: '#152238',
};

export const lightColors: Colors = {
  background: palette.slate[50],
  surface: palette.white,
  surfaceElevated: palette.white,
  surfaceMuted: palette.slate[100],

  border: palette.slate[200],
  borderStrong: palette.slate[300],

  text: palette.slate[900],
  textSecondary: palette.slate[600],
  textTertiary: palette.slate[500],
  textOnAccent: palette.white,

  primary: palette.violet[600],
  primaryPressed: palette.violet[700],
  primarySubtle: 'rgba(124, 58, 237, 0.10)',

  success: palette.emerald[600],
  successSubtle: 'rgba(5, 150, 105, 0.10)',
  danger: palette.rose[600],
  dangerSubtle: 'rgba(225, 29, 72, 0.10)',
  warning: palette.amber[600],
  warningSubtle: 'rgba(217, 119, 6, 0.12)',
  info: palette.cyan[600],
  infoSubtle: 'rgba(8, 145, 178, 0.10)',

  streak: palette.amber[500],
  heart: palette.rose[500],
  gem: palette.cyan[600],
  xp: palette.violet[600],

  scrim: 'rgba(15, 23, 42, 0.45)',
  skeleton: palette.slate[200],
};

// ---------------------------------------------------------------------------
// Spacing — a 4pt grid. Named by size so intent survives refactors.
// ---------------------------------------------------------------------------

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export type SpacingKey = keyof typeof spacing;

// ---------------------------------------------------------------------------
// Radii — generously rounded. This is most of why the app reads as "soft".
// ---------------------------------------------------------------------------

export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/**
 * A restrained type scale. Six sizes total — more than that and screens stop
 * looking related. Line heights are set explicitly because RN's defaults differ
 * across platforms and drift is very visible in long lesson prose.
 */
export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.2 },
  subheading: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const, letterSpacing: -0.1 },
  body: { fontSize: 16, lineHeight: 25, fontWeight: '400' as const, letterSpacing: 0 },
  bodyStrong: { fontSize: 16, lineHeight: 25, fontWeight: '600' as const, letterSpacing: 0 },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.6 },
  mono: { fontSize: 14, lineHeight: 21, fontWeight: '500' as const, letterSpacing: 0 },
} as const;

export type TypographyKey = keyof typeof typography;

/** Platform-appropriate monospace stack, for code exercises. */
export const monoFontFamily = {
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
} as const;

// ---------------------------------------------------------------------------
// Elevation
// ---------------------------------------------------------------------------

/**
 * Shadows are deliberately soft and low-contrast. On dark surfaces a heavy
 * shadow reads as a smudge, so depth comes mostly from the surface ramp with
 * shadow as a light reinforcement.
 */
export const elevation = {
  none: {
    shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 }, elevation: 0,
  },
  sm: {
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  md: {
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  lg: {
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
} as const;

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

/**
 * Durations in ms. Short enough that the app never feels like it is waiting on
 * itself. Anything above `slow` belongs to a celebration, not to navigation.
 */
export const motion = {
  instant: 90,
  fast: 160,
  normal: 240,
  slow: 380,
  celebration: 700,
} as const;

/** Standard easing curves as cubic-bezier control points. */
export const easing = {
  /** Default for most transitions — quick out, gentle settle. */
  standard: [0.2, 0, 0, 1] as const,
  /** Entering elements. */
  decelerate: [0, 0, 0.2, 1] as const,
  /** Exiting elements. */
  accelerate: [0.4, 0, 1, 1] as const,
  /** Slight overshoot, for correct-answer feedback. */
  spring: [0.34, 1.56, 0.64, 1] as const,
} as const;

// ---------------------------------------------------------------------------
// Gradients
// ---------------------------------------------------------------------------

export const gradients = {
  brand: ['#8B5CF6', '#6366F1'] as [string, string],
  success: ['#34D399', '#10B981'] as [string, string],
  danger: ['#FB7185', '#E11D48'] as [string, string],
  streak: ['#FBBF24', '#F59E0B'] as [string, string],
  premium: ['#F59E0B', '#EC4899'] as [string, string],
  /** Behind the app bar and hero cards. */
  ambient: ['rgba(139,92,246,0.22)', 'rgba(99,102,241,0.04)'] as [string, string],
} as const;

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

export const layout = {
  /** Minimum tappable size. Apple asks 44, Android 48; take the larger. */
  minTouchTarget: 48,
  screenPadding: spacing.xl,
  cardPadding: spacing.lg,
  /** Reading measure for lesson prose on wide screens (tablet, macOS). */
  maxReadingWidth: 680,
  /** Content width cap on desktop so the layout does not stretch absurdly. */
  maxContentWidth: 1080,
  tabBarHeight: 64,
  appBarHeight: 56,
} as const;

export { palette };
