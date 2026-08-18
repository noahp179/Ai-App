/**
 * Learner progress state and its transitions.
 *
 * Pure data and pure functions — no React, no storage, no clock beyond an
 * injected `now`. The app layer wraps this in a store and persists it; keeping
 * the rules here means every transition is testable without a running app.
 */

import type {
  AttemptRecord,
  DailyGoal,
  LearnerProfile,
  LessonProgress,
  Level,
  SkillId,
  SkillState,
  TrackId,
  UnlockedAchievement,
} from '../domain/types';
import { SKILLS_BY_ID } from '../content/skills';
import { LESSON_INDEX, TRACKS_BY_ID, skillsInTrack } from '../content/index';
import type { AchievementStats } from '../content/achievements';
import { evaluateAchievements } from '../content/achievements';
import { newSkillState, review, toRecall } from '../engine/scheduler';
import {
  addXpToGoal,
  dayKey,
  goalMet,
  recordActiveDay,
  scoreSession,
  targetXpForMinutes,
  type SessionXp,
} from '../engine/progression';
import type { StreakState } from '../domain/types';
import { newStreak } from '../engine/progression';
import {
  FREE_ENTITLEMENT,
  newHearts,
  newMeter,
  rollMeter,
  type Entitlement,
  type HeartState,
  type MeterState,
} from '../monetization/entitlements';

export interface ProgressState {
  profile: LearnerProfile;
  entitlement: Entitlement;

  skills: Record<SkillId, SkillState>;
  lessons: Record<string, LessonProgress>;
  completedCheckpointIds: string[];
  completedTrackIds: TrackId[];

  totalXp: number;
  streak: StreakState;
  dailyGoal: DailyGoal;
  hearts: HeartState;
  meter: MeterState;
  gems: number;

  achievements: UnlockedAchievement[];
  stats: AchievementStats;

  /** Lesson ids the learner explicitly bookmarked. */
  bookmarks: string[];
  /** Schema version, so persisted state can be migrated across releases. */
  version: number;
}

export const PROGRESS_SCHEMA_VERSION = 1;

export function initialProgress(
  profile: Partial<LearnerProfile> = {},
  now: number = Date.now(),
): ProgressState {
  const timezoneOffsetMinutes =
    profile.timezoneOffsetMinutes ?? new Date(now).getTimezoneOffset();
  const today = dayKey(now, timezoneOffsetMinutes);
  const dailyMinutes = profile.dailyMinutes ?? 10;

  return {
    profile: {
      id: profile.id ?? `learner-${now.toString(36)}`,
      displayName: profile.displayName ?? 'Learner',
      selfReportedLevel: profile.selfReportedLevel ?? 'intro',
      placementLevel: profile.placementLevel ?? null,
      goals: profile.goals ?? [],
      dailyMinutes,
      createdAt: profile.createdAt ?? now,
      timezoneOffsetMinutes,
    },
    entitlement: FREE_ENTITLEMENT,
    skills: {},
    lessons: {},
    completedCheckpointIds: [],
    completedTrackIds: [],
    totalXp: 0,
    streak: newStreak(1),
    dailyGoal: { targetXp: targetXpForMinutes(dailyMinutes), xpToday: 0, day: today },
    hearts: newHearts(5),
    meter: newMeter(today),
    gems: 50,
    achievements: [],
    stats: {
      currentStreak: 0,
      lessonsCompleted: 0,
      totalXp: 0,
      perfectLessons: 0,
      tracksCompleted: 0,
      skillsMastered: 0,
      checkpointsPassed: 0,
      reviewSessions: 0,
      earlyBirdSessions: 0,
      nightOwlSessions: 0,
      domainsPractised: 0,
    },
    bookmarks: [],
    version: PROGRESS_SCHEMA_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Session completion
// ---------------------------------------------------------------------------

export interface CompletionResult {
  state: ProgressState;
  xp: SessionXp;
  newAchievements: UnlockedAchievement[];
  leveledUp: boolean;
  goalJustMet: boolean;
}

/**
 * Applies a finished session to progress state.
 *
 * This is the one place where XP, mastery, streak, goal, and achievements all
 * move, which keeps them consistent — a session can never award XP without also
 * updating the skill states that XP came from.
 */
export function completeSession(
  state: ProgressState,
  params: {
    lessonId?: string;
    checkpointId?: string;
    attempts: AttemptRecord[];
    level: Level;
    isReview?: boolean;
    now?: number;
  },
): CompletionResult {
  const now = params.now ?? Date.now();
  const tz = state.profile.timezoneOffsetMinutes;
  const today = dayKey(now, tz);

  const xp = scoreSession(params.attempts, params.level, {
    isReview: params.isReview ?? false,
  });

  // --- skill scheduling ---------------------------------------------------
  const skills: Record<SkillId, SkillState> = { ...state.skills };
  const finalBySkill = new Map<SkillId, AttemptRecord>();
  for (const attempt of params.attempts) {
    for (const skillId of attempt.skillIds) finalBySkill.set(skillId, attempt);
  }

  for (const [skillId, attempt] of finalBySkill) {
    const existing = skills[skillId] ?? newSkillState(skillId, now);
    const score = attempt.outcome === 'correct' ? 1 : 0;
    const recall = toRecall(score, attempt.durationMs, attempt.usedHint);
    skills[skillId] = review(existing, recall, now);
  }

  // --- lesson record ------------------------------------------------------
  const lessons = { ...state.lessons };
  let lessonsCompletedDelta = 0;
  let perfectDelta = 0;

  if (params.lessonId) {
    const previous = lessons[params.lessonId];
    if (!previous) lessonsCompletedDelta = 1;
    if (xp.perfect && (!previous || previous.accuracy < 1)) perfectDelta = 1;

    lessons[params.lessonId] = {
      lessonId: params.lessonId,
      completedAt: now,
      accuracy: Math.max(previous?.accuracy ?? 0, xp.accuracy),
      xpEarned: (previous?.xpEarned ?? 0) + xp.total,
      attempts: (previous?.attempts ?? 0) + 1,
    };
  }

  // --- checkpoints --------------------------------------------------------
  const completedCheckpointIds = [...state.completedCheckpointIds];
  let checkpointDelta = 0;
  if (params.checkpointId && !completedCheckpointIds.includes(params.checkpointId)) {
    completedCheckpointIds.push(params.checkpointId);
    checkpointDelta = 1;
  }

  // --- streak, goal, XP ---------------------------------------------------
  const totalXp = state.totalXp + xp.total;
  const previousGoal = state.dailyGoal;
  const rolledGoal: DailyGoal =
    previousGoal.day === today ? previousGoal : { ...previousGoal, day: today, xpToday: 0 };
  const dailyGoal = addXpToGoal(rolledGoal, xp.total, today);

  const wasMet = goalMet(rolledGoal);
  const isMet = goalMet(dailyGoal);
  const goalJustMet = !wasMet && isMet;
  const streak = isMet ? recordActiveDay(state.streak, today) : state.streak;

  // --- derived counters ---------------------------------------------------
  const completedTrackIds = recomputeCompletedTracks(lessons, state.completedTrackIds);

  const skillsMastered = Object.values(skills).filter((s) => s.mastery >= 0.8).length;
  const domainsPractised = new Set(
    Object.keys(skills)
      .map((id) => SKILLS_BY_ID.get(id)?.domain)
      .filter((d): d is NonNullable<typeof d> => d !== undefined),
  ).size;

  const localHour = new Date(now - tz * 60_000).getUTCHours();

  const stats: AchievementStats = {
    currentStreak: streak.current,
    lessonsCompleted: state.stats.lessonsCompleted + lessonsCompletedDelta,
    totalXp,
    perfectLessons: state.stats.perfectLessons + perfectDelta,
    tracksCompleted: completedTrackIds.length,
    skillsMastered,
    checkpointsPassed: state.stats.checkpointsPassed + checkpointDelta,
    reviewSessions: state.stats.reviewSessions + (params.isReview ? 1 : 0),
    earlyBirdSessions: state.stats.earlyBirdSessions + (localHour < 8 ? 1 : 0),
    nightOwlSessions: state.stats.nightOwlSessions + (localHour >= 23 ? 1 : 0),
    domainsPractised,
  };

  const newAchievements = evaluateAchievements(stats, state.achievements, now);

  // Gems reward hitting the daily goal and unlocking achievements.
  const gems =
    state.gems + (goalJustMet ? 15 : 0) + newAchievements.length * 10;

  const nextState: ProgressState = {
    ...state,
    skills,
    lessons,
    completedCheckpointIds,
    completedTrackIds,
    totalXp,
    streak,
    dailyGoal,
    meter: rollMeter(state.meter, today),
    gems,
    achievements: [...state.achievements, ...newAchievements],
    stats,
  };

  return {
    state: nextState,
    xp,
    newAchievements,
    leveledUp: crossedLevel(state.totalXp, totalXp),
    goalJustMet,
  };
}

function crossedLevel(before: number, after: number): boolean {
  // Imported lazily to avoid a cycle; the curve is cheap to recompute.
  const levelFor = (xp: number): number => {
    let level = 1;
    while (50 * level * level + 100 * level <= xp && level < 200) level += 1;
    return level;
  };
  return levelFor(after) > levelFor(before);
}

/** A track counts as complete once every lesson in it has been finished. */
function recomputeCompletedTracks(
  lessons: Record<string, LessonProgress>,
  previous: TrackId[],
): TrackId[] {
  const complete = new Set(previous);
  for (const track of TRACKS_BY_ID.values()) {
    if (complete.has(track.id)) continue;
    const allLessonIds = track.units.flatMap((u) => u.lessons.map((l) => l.id));
    if (allLessonIds.length > 0 && allLessonIds.every((id) => lessons[id])) {
      complete.add(track.id);
    }
  }
  return [...complete];
}

// ---------------------------------------------------------------------------
// Queries the UI needs
// ---------------------------------------------------------------------------

/** 0–1 completion of a track by lessons finished. */
export function trackCompletion(state: ProgressState, trackId: TrackId): number {
  const track = TRACKS_BY_ID.get(trackId);
  if (!track) return 0;
  const lessonIds = track.units.flatMap((u) => u.lessons.map((l) => l.id));
  if (lessonIds.length === 0) return 0;
  const done = lessonIds.filter((id) => state.lessons[id]).length;
  return done / lessonIds.length;
}

/** 0–1 average mastery across the skills a track teaches. */
export function trackMastery(state: ProgressState, trackId: TrackId): number {
  const skillIds = skillsInTrack(trackId);
  if (skillIds.length === 0) return 0;
  const total = skillIds.reduce((sum, id) => sum + (state.skills[id]?.mastery ?? 0), 0);
  return total / skillIds.length;
}

/**
 * The next lesson to do in a track: the first unfinished one in order.
 * Returns null when the track is complete.
 */
export function nextLessonInTrack(state: ProgressState, trackId: TrackId): string | null {
  const track = TRACKS_BY_ID.get(trackId);
  if (!track) return null;
  for (const unit of track.units) {
    for (const lesson of unit.lessons) {
      if (!state.lessons[lesson.id]) return lesson.id;
    }
  }
  return null;
}

/**
 * What to show on the home screen: continue the track most recently touched,
 * or start the first recommended one.
 */
export function continueLearning(state: ProgressState): {
  lessonId: string;
  trackId: TrackId;
  reason: 'continue' | 'start';
} | null {
  let mostRecent: { lessonId: string; at: number } | null = null;
  for (const progress of Object.values(state.lessons)) {
    if (!mostRecent || progress.completedAt > mostRecent.at) {
      mostRecent = { lessonId: progress.lessonId, at: progress.completedAt };
    }
  }

  if (mostRecent) {
    const location = LESSON_INDEX.get(mostRecent.lessonId);
    if (location) {
      const next = nextLessonInTrack(state, location.track.id);
      if (next) return { lessonId: next, trackId: location.track.id, reason: 'continue' };
    }
  }

  for (const track of TRACKS_BY_ID.values()) {
    const next = nextLessonInTrack(state, track.id);
    if (next) return { lessonId: next, trackId: track.id, reason: 'start' };
  }
  return null;
}

/** Per-domain mastery, for the profile radar chart. */
export function domainMastery(state: ProgressState): Record<string, number> {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const [skillId, skillState] of Object.entries(state.skills)) {
    const domain = SKILLS_BY_ID.get(skillId)?.domain;
    if (!domain) continue;
    const entry = totals.get(domain) ?? { sum: 0, count: 0 };
    entry.sum += skillState.mastery;
    entry.count += 1;
    totals.set(domain, entry);
  }

  const result: Record<string, number> = {};
  for (const [domain, { sum, count }] of totals) {
    result[domain] = count === 0 ? 0 : sum / count;
  }
  return result;
}

/**
 * Migrates persisted state across schema versions.
 *
 * Called on load. Returns fresh state when the stored blob is unusable rather
 * than throwing — losing progress is bad, but crashing on launch is worse, and
 * the caller can report the discrepancy.
 */
export function migrateProgress(raw: unknown): ProgressState {
  if (!raw || typeof raw !== 'object') return initialProgress();
  const candidate = raw as Partial<ProgressState>;

  if (typeof candidate.version !== 'number' || !candidate.profile) {
    return initialProgress();
  }

  // Future versions add their migration steps here, in order.
  const base = initialProgress(candidate.profile);
  return {
    ...base,
    ...candidate,
    profile: { ...base.profile, ...candidate.profile },
    stats: { ...base.stats, ...(candidate.stats ?? {}) },
    version: PROGRESS_SCHEMA_VERSION,
  };
}
