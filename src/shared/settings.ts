import { z } from 'zod';

/**
 * Every setting here is read somewhere in the app. If you add one, wire it up
 * and add it to docs/SETTINGS.md; decorative toggles are not allowed.
 */

export const MODULE_IDS = [
  'home',
  'ai',
  'notes',
  'productivity',
  'calendar',
  'prompts',
  'marketplace',
  'learning',
  'study',
  'news',
  'games',
  'creator',
  'settings',
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

/** Modules that cannot be switched off, because the app is unusable without them. */
export const ALWAYS_ON_MODULES: readonly ModuleId[] = ['home', 'settings'];

export const APP_MODES = ['personal', 'student', 'creator', 'advanced', 'parent', 'educator'] as const;
export type AppMode = (typeof APP_MODES)[number];

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');

/**
 * Electron accelerator, e.g. "CommandOrControl+Shift+Space". Validated loosely here;
 * the main process reports registration failures back to the UI.
 */
const accelerator = z
  .string()
  .max(64)
  .regex(
    /^$|^((CommandOrControl|CmdOrCtrl|Command|Cmd|Control|Ctrl|Alt|Option|AltGr|Shift|Super|Meta)\+)+([A-Z0-9]|F([1-9]|1[0-9]|2[0-4])|Space|Tab|Backspace|Delete|Insert|Return|Enter|Up|Down|Left|Right|Home|End|PageUp|PageDown|Escape|Esc|Plus|[`~!@#$%^&*()\-_=[\]{};:'",.<>/?\\|])$/,
    'Use a modifier plus a key, e.g. CommandOrControl+Shift+K',
  );

const modulesShape = Object.fromEntries(MODULE_IDS.map((id) => [id, z.boolean().default(true)])) as Record<
  ModuleId,
  z.ZodDefault<z.ZodBoolean>
>;

export const SettingsSchema = z.object({
  appearance: z
    .object({
      theme: z.enum(['system', 'light', 'dark']).default('dark'),
      accent: z.enum(['indigo', 'teal', 'violet', 'amber', 'rose']).default('indigo'),
      fontScale: z.number().min(0.85).max(1.4).default(1),
      density: z.enum(['comfortable', 'compact']).default('comfortable'),
      reducedMotion: z.enum(['system', 'reduce', 'allow']).default('system'),
      highContrast: z.boolean().default(false),
    })
    .prefault({}),
  layout: z
    .object({
      mode: z.enum(APP_MODES).default('personal'),
      modules: z.object(modulesShape).prefault({}),
      sidebarCollapsed: z.boolean().default(false),
      distractionFree: z.boolean().default(false),
      openTo: z.enum(['home', 'last', 'ai', 'notes', 'calendar']).default('home'),
    })
    .prefault({}),
  companion: z
    .object({
      enabled: z.boolean().default(true),
      showOnStartup: z.boolean().default(false),
      alwaysOnTop: z.boolean().default(true),
      opacity: z.number().min(0.4).max(1).default(1),
      dock: z.enum(['floating', 'left', 'right']).default('floating'),
    })
    .prefault({}),
  startup: z
    .object({
      launchAtLogin: z.boolean().default(false),
      startHidden: z.boolean().default(false),
      closeToTray: z.boolean().default(false),
    })
    .prefault({}),
  shortcuts: z
    .object({
      enabled: z.boolean().default(true),
      toggleCompanion: accelerator.default('CommandOrControl+Shift+Space'),
      quickCapture: accelerator.default('CommandOrControl+Shift+K'),
      showMainWindow: accelerator.default('CommandOrControl+Shift+F'),
    })
    .prefault({}),
  ai: z
    .object({
      defaultProviderId: z.string().max(64).nullable().default(null),
      systemPrompt: z.string().max(8000).default(''),
      streaming: z.boolean().default(true),
      storeConversations: z.boolean().default(true),
      retentionDays: z.number().int().min(0).max(3650).default(0),
      requestTimeoutSeconds: z.number().int().min(15).max(600).default(120),
      maxOutputTokens: z.number().int().min(0).max(128000).default(0),
      temperature: z.number().min(0).max(2).nullable().default(null),
      notifyOnCompletion: z.boolean().default(true),
    })
    .prefault({}),
  notifications: z
    .object({
      enabled: z.boolean().default(true),
      sound: z.boolean().default(true),
      quietHours: z
        .object({
          enabled: z.boolean().default(false),
          start: hhmm.default('22:00'),
          end: hhmm.default('07:00'),
        })
        .prefault({}),
      defaultReminderMinutes: z.number().int().min(0).max(10080).default(10),
      snoozeMinutes: z.number().int().min(1).max(1440).default(10),
      missedGraceMinutes: z.number().int().min(0).max(10080).default(720),
    })
    .prefault({}),
  calendar: z
    .object({
      timeZone: z.string().max(64).default('system'),
      weekStartsOn: z.union([z.literal(0), z.literal(1), z.literal(6)]).default(1),
      defaultView: z.enum(['day', 'week', 'month', 'agenda']).default('week'),
      defaultDurationMinutes: z.number().int().min(5).max(1440).default(60),
      dayStartHour: z.number().int().min(0).max(12).default(7),
      timeFormat: z.enum(['auto', '12h', '24h']).default('auto'),
    })
    .prefault({}),
  notes: z
    .object({
      defaultFormat: z.enum(['markdown', 'plain']).default('markdown'),
      autosaveDelayMs: z.number().int().min(300).max(5000).default(800),
      spellcheck: z.boolean().default(true),
      showPreview: z.boolean().default(true),
      trashRetentionDays: z.number().int().min(1).max(365).default(30),
    })
    .prefault({}),
  productivity: z
    .object({
      focusMinutes: z.number().int().min(1).max(180).default(25),
      shortBreakMinutes: z.number().int().min(1).max(60).default(5),
      longBreakMinutes: z.number().int().min(1).max(90).default(15),
      longBreakEvery: z.number().int().min(2).max(12).default(4),
      autoStartBreaks: z.boolean().default(false),
    })
    .prefault({}),
  feed: z
    .object({
      topics: z.array(z.string().max(40)).max(40).default(['ai', 'technology', 'science']),
      refreshIntervalMinutes: z.number().int().min(0).max(1440).default(60),
      previewLength: z.number().int().min(80).max(400).default(220),
      alertsEnabled: z.boolean().default(true),
      hideRead: z.boolean().default(false),
    })
    .prefault({}),
  learning: z
    .object({
      goals: z.array(z.string().max(40)).max(20).default([]),
      preferredLevel: z.enum(['any', 'beginner', 'intermediate', 'advanced']).default('any'),
      studyReminderMinutes: z.number().int().min(0).max(1440).default(10),
    })
    .prefault({}),
  study: z
    .object({
      /** Default number of questions for practice and pop quizzes. */
      quizLength: z.union([z.literal(3), z.literal(5), z.literal(10), z.literal(15)]).default(5),
      /** Practice tests start with a timer. Off by default: timed work is not right for every learner. */
      timedPracticeTests: z.boolean().default(false),
      /** Show the numeric estimate next to mastery statuses. */
      showEstimates: z.boolean().default(true),
      proficientThreshold: z.number().min(0.6).max(0.95).default(0.8),
      minIndependentCorrect: z.number().int().min(2).max(6).default(3),
      /** A daily notification when spaced reviews are due. */
      reviewReminders: z.boolean().default(true),
      reviewReminderTime: hhmm.default('16:30'),
      /** Allow AI-written lessons and the AI tutor in Student Learning (each student also has to agree). */
      aiTutor: z.boolean().default(true),
    })
    .prefault({}),
  marketplace: z
    .object({
      serverUrl: z
        .string()
        .max(200)
        .refine((v) => v === '' || /^https?:\/\/[^\s]+$/.test(v), 'Must be an http(s) URL or empty')
        .default(''),
      showPaidListings: z.boolean().default(true),
      trialExpiryReminders: z.boolean().default(true),
    })
    .prefault({}),
  browser: z
    .object({
      bridgeEnabled: z.boolean().default(false),
      bridgePort: z.number().int().min(1024).max(65535).default(47823),
    })
    .prefault({}),
  privacy: z
    .object({
      personalization: z.boolean().default(true),
      useActivityForPersonalization: z.boolean().default(false),
      useConversationsForPersonalization: z.boolean().default(false),
      confirmBeforeSendingContext: z.boolean().default(true),
    })
    .prefault({}),
  data: z
    .object({
      backupsToKeep: z.number().int().min(1).max(50).default(5),
    })
    .prefault({}),
});

export type Settings = z.infer<typeof SettingsSchema>;

/** Deep partial used for settings patches coming from the UI. */
export type DeepPartial<T> = T extends readonly (infer _U)[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
export type SettingsPatch = DeepPartial<Settings>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

/** Modules shown by default in each mode. Applying a mode is explicit and user-visible. */
export const MODE_PRESETS: Record<AppMode, { label: string; description: string; modules: Partial<Record<ModuleId, boolean>> }> = {
  personal: {
    label: 'Personal productivity',
    description: 'Notes, tasks, calendar, AI and news. Creator tools hidden.',
    modules: { creator: false },
  },
  student: {
    label: 'Student learning',
    description: 'Student Learning, learning hub, notes, calendar and AI up front. Marketplace and creator tools hidden.',
    modules: { study: true, marketplace: false, creator: false },
  },
  creator: {
    label: 'Creator and prompt publishing',
    description: 'Prompt library, marketplace and creator workspace up front.',
    modules: { creator: true, marketplace: true, prompts: true },
  },
  advanced: {
    label: 'Advanced productivity',
    description: 'Every module visible.',
    modules: Object.fromEntries(MODULE_IDS.map((m) => [m, true])),
  },
  parent: {
    label: 'Parent-managed learning',
    description:
      'Student Learning, learning hub, notes, calendar and AI. Games, news, marketplace and creator tools hidden. Use Settings → Parental Learning Controls for supervised sessions.',
    modules: { study: true, games: false, news: false, marketplace: false, creator: false },
  },
  educator: {
    label: 'Educator or supervised learning',
    description: 'Student Learning (including the assessment builder), learning hub, prompt library, calendar and AI up front. Games and marketplace hidden.',
    modules: { study: true, games: false, marketplace: false, creator: false },
  },
};
