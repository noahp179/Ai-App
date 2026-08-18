/**
 * XP, levels, streaks, and daily goals.
 *
 * The design rule here: rewards are generous and predictable, penalties are
 * mild. Nothing in this file can take XP away or end a streak for a reason the
 * learner cannot see on screen.
 */

import type { AttemptRecord, DailyGoal, Level, StreakState } from '../domain/types.js';

// ---------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------

export const XP = {
  correct: 10,
  correctFirstTry: 15,
  hintUsed: 5,
  incorrect: 2,
  lessonComplete: 20,
  perfectLessonBonus: 25,
  checkpointPass: 60,
  reviewCorrect: 8,
  dailyGoalBonus: 30,
} as const;

/** Difficulty multiplier — expert material is worth more per correct answer. */
export const LEVEL_MULTIPLIER: Record<Level, number> = {
  intro: 1,
  intermediate: 1.25,
  expert: 1.5,
};

export interface SessionXp {
  base: number;
  bonus: number;
  total: number;
  perfect: boolean;
  accuracy: number;
}

/**
 * Scores a completed lesson from its attempt records.
 *
 * `attempts` may contain more than one record per step (a retried step), so
 * accuracy is computed over distinct steps using each step's final outcome.
 */
export function scoreSession(
  attempts: AttemptRecord[],
  level: Level,
  opts: { isReview?: boolean; xpMultiplier?: number } = {},
): SessionXp {
  const finalByStep = new Map<string, AttemptRecord>();
  const firstTryByStep = new Map<string, boolean>();

  for (const a of attempts) {
    if (!firstTryByStep.has(a.stepId)) {
      firstTryByStep.set(a.stepId, a.outcome === 'correct');
    }
    finalByStep.set(a.stepId, a);
  }

  let base = 0;
  let correctCount = 0;

  for (const [stepId, record] of finalByStep) {
    if (record.outcome === 'correct') {
      correctCount += 1;
      if (opts.isReview) base += XP.reviewCorrect;
      else if (record.usedHint) base += XP.hintUsed;
      else if (firstTryByStep.get(stepId)) base += XP.correctFirstTry;
      else base += XP.correct;
    } else {
      base += XP.incorrect;
    }
  }

  const stepCount = finalByStep.size;
  const accuracy = stepCount === 0 ? 0 : correctCount / stepCount;
  const perfect = stepCount > 0 && correctCount === stepCount;

  let bonus = opts.isReview ? 0 : XP.lessonComplete;
  if (perfect && !opts.isReview) bonus += XP.perfectLessonBonus;

  const multiplier = LEVEL_MULTIPLIER[level] * (opts.xpMultiplier ?? 1);
  const scaledBase = Math.round(base * multiplier);
  const scaledBonus = Math.round(bonus * multiplier);

  return {
    base: scaledBase,
    bonus: scaledBonus,
    total: scaledBase + scaledBonus,
    perfect,
    accuracy,
  };
}

// ---------------------------------------------------------------------------
// Learner level curve
// ---------------------------------------------------------------------------

/**
 * Total XP required to reach a given level. Quadratic growth keeps early
 * levels quick (a first session should level you up) and later ones meaningful.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return 50 * n * n + 100 * n;
}

export function levelForXp(totalXp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp && level < 200) level += 1;
  return level;
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** 0–1. */
  fraction: number;
}

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelForXp(totalXp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const span = ceiling - floor;
  return {
    level,
    xpIntoLevel: totalXp - floor,
    xpForNextLevel: span,
    fraction: span === 0 ? 0 : (totalXp - floor) / span,
  };
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

/** Local calendar day key. Streaks are judged in the learner's own timezone. */
export function dayKey(timestamp: number, timezoneOffsetMinutes: number): string {
  const shifted = new Date(timestamp - timezoneOffsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const toMs = (k: string): number => Date.parse(`${k}T00:00:00Z`);
  return Math.round((toMs(b) - toMs(a)) / 86_400_000);
}

export function newStreak(freezes = 1): StreakState {
  return {
    current: 0,
    longest: 0,
    lastActiveDay: null,
    freezesAvailable: freezes,
    freezesUsed: 0,
  };
}

/**
 * Records that the learner met their daily goal on `today`.
 *
 * Handles the three transitions: same day (no-op), consecutive day (extend),
 * and a gap. A single missed day is absorbed by a streak freeze if one is
 * available; anything longer restarts the streak at 1.
 */
export function recordActiveDay(streak: StreakState, today: string): StreakState {
  if (streak.lastActiveDay === today) return streak;

  if (streak.lastActiveDay === null) {
    return { ...streak, current: 1, longest: Math.max(1, streak.longest), lastActiveDay: today };
  }

  const gap = daysBetween(streak.lastActiveDay, today);

  // Clock skew or a timezone change moved us backwards — leave state alone.
  if (gap <= 0) return streak;

  if (gap === 1) {
    const current = streak.current + 1;
    return {
      ...streak,
      current,
      longest: Math.max(current, streak.longest),
      lastActiveDay: today,
    };
  }

  if (gap === 2 && streak.freezesAvailable > 0) {
    const current = streak.current + 1;
    return {
      ...streak,
      current,
      longest: Math.max(current, streak.longest),
      lastActiveDay: today,
      freezesAvailable: streak.freezesAvailable - 1,
      freezesUsed: streak.freezesUsed + 1,
    };
  }

  return { ...streak, current: 1, longest: Math.max(1, streak.longest), lastActiveDay: today };
}

/**
 * Whether the streak is already broken as of `today`, without mutating it.
 * The home screen uses this to show "your streak ends in N hours".
 */
export function isStreakBroken(streak: StreakState, today: string): boolean {
  if (streak.lastActiveDay === null) return false;
  const gap = daysBetween(streak.lastActiveDay, today);
  return gap > (streak.freezesAvailable > 0 ? 2 : 1);
}

// ---------------------------------------------------------------------------
// Daily goals
// ---------------------------------------------------------------------------

/** Preset daily commitments, in minutes, mapped to an XP target. */
export const GOAL_PRESETS = [
  { minutes: 5, targetXp: 50, label: 'Casual' },
  { minutes: 10, targetXp: 100, label: 'Regular' },
  { minutes: 20, targetXp: 200, label: 'Serious' },
  { minutes: 30, targetXp: 300, label: 'Intense' },
] as const;

export function targetXpForMinutes(minutes: number): number {
  const preset = GOAL_PRESETS.find((p) => p.minutes === minutes);
  return preset ? preset.targetXp : Math.max(50, Math.round(minutes * 10));
}

export function addXpToGoal(goal: DailyGoal, xp: number, today: string): DailyGoal {
  if (goal.day !== today) return { ...goal, day: today, xpToday: xp };
  return { ...goal, xpToday: goal.xpToday + xp };
}

export function goalMet(goal: DailyGoal): boolean {
  return goal.xpToday >= goal.targetXp;
}
