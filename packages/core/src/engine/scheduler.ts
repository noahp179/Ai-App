/**
 * Spaced-repetition scheduler.
 *
 * An SM-2 variant, tuned for a mobile app where sessions are short and a lapse
 * should not feel punishing:
 *
 *   - Mastery is an exponential moving average, so one bad answer dents but
 *     does not erase a well-known skill.
 *   - Lapses drop the interval to 1 day rather than resetting all state, so a
 *     learner who slips on a hard item does not restart the ladder.
 *   - Intervals are capped so nothing disappears from review for over a year.
 */

import type { SkillId, SkillState } from '../domain/types.js';

export const DAY_MS = 86_400_000;

const EASE_MIN = 1.3;
const EASE_MAX = 2.8;
const EASE_DEFAULT = 2.5;
const INTERVAL_MAX_DAYS = 365;
const MASTERY_ALPHA = 0.3;

/** Graded recall quality, mapped from the exercise score plus response time. */
export type Recall = 'again' | 'hard' | 'good' | 'easy';

export function newSkillState(skillId: SkillId, now: number = Date.now()): SkillState {
  return {
    skillId,
    mastery: 0,
    ease: EASE_DEFAULT,
    intervalDays: 0,
    streak: 0,
    lastReviewedAt: 0,
    dueAt: now,
    totalReviews: 0,
    lapses: 0,
  };
}

/**
 * Derives a recall grade from a graded answer.
 *
 * Speed matters: a correct-but-slow answer is `hard`, which shortens the next
 * interval, because hesitation predicts forgetting better than correctness
 * alone. `expectedMs` is the exercise kind's rough budget.
 */
export function toRecall(
  score: number,
  durationMs: number,
  usedHint: boolean,
  expectedMs = 20_000,
): Recall {
  if (score < 0.5) return 'again';
  if (usedHint) return 'hard';
  if (score < 1) return 'hard';
  if (durationMs > expectedMs * 1.75) return 'hard';
  if (durationMs < expectedMs * 0.5) return 'easy';
  return 'good';
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Advances a skill's scheduling state after one review.
 *
 * Pure — returns a new state and never mutates the input, so it can be called
 * speculatively (e.g. to preview "next review in ...") from the UI.
 */
export function review(
  state: SkillState,
  recall: Recall,
  now: number = Date.now(),
): SkillState {
  const quality = { again: 0, hard: 0.6, good: 1, easy: 1 }[recall];
  const mastery = clamp(
    state.mastery + MASTERY_ALPHA * (quality - state.mastery),
    0,
    1,
  );

  let { ease, intervalDays, streak, lapses } = state;

  switch (recall) {
    case 'again':
      ease = clamp(ease - 0.2, EASE_MIN, EASE_MAX);
      intervalDays = 1;
      streak = 0;
      lapses += 1;
      break;

    case 'hard':
      ease = clamp(ease - 0.15, EASE_MIN, EASE_MAX);
      intervalDays = intervalDays === 0 ? 1 : Math.max(1, intervalDays * 1.2);
      streak += 1;
      break;

    case 'good':
      intervalDays = intervalDays === 0 ? 1 : intervalDays === 1 ? 3 : intervalDays * ease;
      streak += 1;
      break;

    case 'easy':
      ease = clamp(ease + 0.15, EASE_MIN, EASE_MAX);
      intervalDays = intervalDays === 0 ? 2 : intervalDays === 1 ? 5 : intervalDays * ease * 1.3;
      streak += 1;
      break;
  }

  intervalDays = Math.min(INTERVAL_MAX_DAYS, Math.round(intervalDays * 100) / 100);

  return {
    ...state,
    mastery,
    ease,
    intervalDays,
    streak,
    lapses,
    lastReviewedAt: now,
    dueAt: now + intervalDays * DAY_MS,
    totalReviews: state.totalReviews + 1,
  };
}

/** Skills whose review is due, most-overdue first. */
export function dueSkills(
  states: Record<SkillId, SkillState>,
  now: number = Date.now(),
  limit = Infinity,
): SkillState[] {
  return Object.values(states)
    .filter((s) => s.totalReviews > 0 && s.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, limit === Infinity ? undefined : limit);
}

/**
 * Estimated current recall probability, using the classic exponential
 * forgetting curve with a stability derived from the current interval.
 *
 * Drives the "memory strength" bars on the profile screen and lets the review
 * queue prioritize skills that are actually slipping rather than merely old.
 */
export function retention(state: SkillState, now: number = Date.now()): number {
  if (state.totalReviews === 0) return 0;
  const elapsedDays = (now - state.lastReviewedAt) / DAY_MS;
  const stability = Math.max(0.5, state.intervalDays);
  return clamp(Math.exp(-elapsedDays / stability), 0, 1);
}

/** Aggregate mastery over a set of skills, 0–1. */
export function aggregateMastery(
  states: Record<SkillId, SkillState>,
  skillIds: SkillId[],
): number {
  if (skillIds.length === 0) return 0;
  const total = skillIds.reduce((sum, id) => sum + (states[id]?.mastery ?? 0), 0);
  return total / skillIds.length;
}
