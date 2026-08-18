/**
 * The progress store.
 *
 * A thin zustand wrapper over the pure functions in `@synapse/core`. All the
 * rules live in core; this layer only owns persistence, hydration, and exposing
 * selectors to components. Keeping it thin is what makes the rules testable
 * without a running app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  completeSession,
  dayKey,
  initialProgress,
  migrateProgress,
  regenerateHearts,
  rollMeter,
  spendHeart,
  targetXpForMinutes,
  type AttemptRecord,
  type Entitlement,
  type LearnerGoal,
  type Level,
  type ProgressState,
  type UnlockedAchievement,
} from '@synapse/core';

const STORAGE_KEY = 'synapse.progress.v1';

/** Debounce window for writes. A lesson fires several updates in a few seconds. */
const PERSIST_DEBOUNCE_MS = 400;

export interface SessionResult {
  xpEarned: number;
  accuracy: number;
  perfect: boolean;
  newAchievements: UnlockedAchievement[];
  leveledUp: boolean;
  goalJustMet: boolean;
}

interface ProgressStore {
  progress: ProgressState;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  reset: () => Promise<void>;

  /** Called on app foreground: regenerates hearts and rolls the daily meter. */
  refresh: () => void;

  finishLesson: (params: {
    lessonId?: string;
    checkpointId?: string;
    attempts: AttemptRecord[];
    level: Level;
    isReview?: boolean;
  }) => SessionResult;

  loseHeart: () => void;
  refillHearts: (source: 'gems' | 'purchase' | 'ad') => boolean;

  setEntitlement: (entitlement: Entitlement) => void;
  completeOnboarding: (params: {
    displayName: string;
    selfReportedLevel: Level;
    goals: LearnerGoal[];
    dailyMinutes: number;
  }) => void;
  setPlacementLevel: (level: Level) => void;
  toggleBookmark: (lessonId: string) => void;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(state: ProgressState): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    // A failed write must never break the session in progress. The next write
    // will retry, and hydration falls back to fresh state if it never lands.
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, PERSIST_DEBOUNCE_MS);
}

export const useProgress = create<ProgressStore>((set, get) => ({
  progress: initialProgress(),
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      const restored = migrateProgress(parsed);
      set({ progress: restored, hydrated: true });
      get().refresh();
    } catch {
      // Corrupt or unreadable storage: start clean rather than crash on launch.
      set({ progress: initialProgress(), hydrated: true });
    }
  },

  reset: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    set({ progress: initialProgress() });
  },

  refresh: () => {
    const { progress } = get();
    const now = Date.now();
    const today = dayKey(now, progress.profile.timezoneOffsetMinutes);

    const next: ProgressState = {
      ...progress,
      hearts: regenerateHearts(progress.hearts, progress.entitlement, now),
      meter: rollMeter(progress.meter, today),
      dailyGoal:
        progress.dailyGoal.day === today
          ? progress.dailyGoal
          : { ...progress.dailyGoal, day: today, xpToday: 0 },
    };

    set({ progress: next });
    schedulePersist(next);
  },

  finishLesson: ({ lessonId, checkpointId, attempts, level, isReview }) => {
    const result = completeSession(get().progress, {
      lessonId,
      checkpointId,
      attempts,
      level,
      isReview,
    });

    set({ progress: result.state });
    schedulePersist(result.state);

    return {
      xpEarned: result.xp.total,
      accuracy: result.xp.accuracy,
      perfect: result.xp.perfect,
      newAchievements: result.newAchievements,
      leveledUp: result.leveledUp,
      goalJustMet: result.goalJustMet,
    };
  },

  loseHeart: () => {
    const { progress } = get();
    const next = { ...progress, hearts: spendHeart(progress.hearts) };
    set({ progress: next });
    schedulePersist(next);
  },

  refillHearts: (source) => {
    const { progress } = get();
    const GEM_COST = 100;

    if (source === 'gems' && progress.gems < GEM_COST) return false;

    const next: ProgressState = {
      ...progress,
      gems: source === 'gems' ? progress.gems - GEM_COST : progress.gems,
      hearts: { ...progress.hearts, current: progress.hearts.max, nextRefillAt: null },
    };

    set({ progress: next });
    schedulePersist(next);
    return true;
  },

  setEntitlement: (entitlement) => {
    const { progress } = get();
    // Upgrading refills hearts immediately — being stuck behind a heart wall you
    // just paid to remove is the worst possible first impression of a purchase.
    const next: ProgressState = {
      ...progress,
      entitlement,
      hearts: regenerateHearts(progress.hearts, entitlement),
    };
    set({ progress: next });
    schedulePersist(next);
  },

  completeOnboarding: ({ displayName, selfReportedLevel, goals, dailyMinutes }) => {
    const { progress } = get();
    const next: ProgressState = {
      ...progress,
      profile: { ...progress.profile, displayName, selfReportedLevel, goals, dailyMinutes },
      dailyGoal: { ...progress.dailyGoal, targetXp: targetXpForMinutes(dailyMinutes) },
    };
    set({ progress: next });
    schedulePersist(next);
  },

  setPlacementLevel: (level) => {
    const { progress } = get();
    const next: ProgressState = {
      ...progress,
      profile: { ...progress.profile, placementLevel: level },
    };
    set({ progress: next });
    schedulePersist(next);
  },

  toggleBookmark: (lessonId) => {
    const { progress } = get();
    const bookmarks = progress.bookmarks.includes(lessonId)
      ? progress.bookmarks.filter((id) => id !== lessonId)
      : [...progress.bookmarks, lessonId];

    const next = { ...progress, bookmarks };
    set({ progress: next });
    schedulePersist(next);
  },
}));

// --- Selectors --------------------------------------------------------------
// Exported as named hooks so components subscribe to one slice and do not
// re-render on every unrelated store change.

export const useLearnerProfile = (): ProgressState['profile'] =>
  useProgress((s) => s.progress.profile);

export const useEntitlement = (): Entitlement => useProgress((s) => s.progress.entitlement);

export const useHearts = (): ProgressState['hearts'] => useProgress((s) => s.progress.hearts);

export const useStreak = (): ProgressState['streak'] => useProgress((s) => s.progress.streak);

export const useTotalXp = (): number => useProgress((s) => s.progress.totalXp);

export const useDailyGoal = (): ProgressState['dailyGoal'] =>
  useProgress((s) => s.progress.dailyGoal);
