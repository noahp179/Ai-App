import { describe, expect, it } from 'vitest';

import {
  completeSession,
  continueLearning,
  domainMastery,
  initialProgress,
  migrateProgress,
  nextLessonInTrack,
  trackCompletion,
  trackMastery,
  type ProgressState,
} from '../src/store/progress';
import { TRACKS_BY_ID } from '../src/content/index';
import type { AttemptRecord } from '../src/domain/types';
import { formatCompact, formatDuration, formatRelativeDue, hashString, plural, seededShuffle } from '../src/util/format';
import { DAY_MS } from '../src/engine/scheduler';

const NOW = Date.UTC(2026, 2, 1, 12, 0, 0);

const attempt = (
  stepId: string,
  outcome: AttemptRecord['outcome'],
  skillIds = ['sk-ai-definition'],
): AttemptRecord => ({
  stepId,
  skillIds,
  outcome,
  durationMs: 12_000,
  usedHint: false,
  at: NOW,
});

const base = (): ProgressState => initialProgress({ timezoneOffsetMinutes: 0 }, NOW);

describe('initial progress', () => {
  it('starts a learner on the free plan with a full heart bar', () => {
    const state = base();
    expect(state.entitlement.plan).toBe('free');
    expect(state.hearts.current).toBe(5);
    expect(state.totalXp).toBe(0);
    expect(state.streak.current).toBe(0);
    expect(state.dailyGoal.targetXp).toBeGreaterThan(0);
  });
});

describe('completeSession', () => {
  it('awards XP, records the lesson, and schedules its skills', () => {
    const result = completeSession(base(), {
      lessonId: 'lesson-what-is-ai',
      attempts: [attempt('a', 'correct'), attempt('b', 'correct', ['sk-narrow-vs-general'])],
      level: 'intro',
      now: NOW,
    });

    expect(result.xp.total).toBeGreaterThan(0);
    expect(result.state.totalXp).toBe(result.xp.total);
    expect(result.state.lessons['lesson-what-is-ai']?.accuracy).toBe(1);
    expect(result.state.skills['sk-ai-definition']?.totalReviews).toBe(1);
    expect(result.state.skills['sk-narrow-vs-general']?.dueAt).toBeGreaterThan(NOW);
  });

  it('counts a replayed lesson once and keeps the best accuracy', () => {
    const first = completeSession(base(), {
      lessonId: 'lesson-what-is-ai',
      attempts: [attempt('a', 'correct'), attempt('b', 'incorrect')],
      level: 'intro',
      now: NOW,
    });
    const second = completeSession(first.state, {
      lessonId: 'lesson-what-is-ai',
      attempts: [attempt('a', 'correct'), attempt('b', 'correct')],
      level: 'intro',
      now: NOW + 1000,
    });

    expect(second.state.stats.lessonsCompleted).toBe(1);
    expect(second.state.lessons['lesson-what-is-ai']?.attempts).toBe(2);
    expect(second.state.lessons['lesson-what-is-ai']?.accuracy).toBe(1);
  });

  it('extends the streak only once the daily goal is met', () => {
    const state = base();
    const small = completeSession(state, {
      lessonId: 'lesson-what-is-ai',
      attempts: [attempt('a', 'correct')],
      level: 'intro',
      now: NOW,
    });
    expect(small.goalJustMet).toBe(false);
    expect(small.state.streak.current).toBe(0);

    const many = Array.from({ length: 20 }, (_, i) => attempt(`s${i}`, 'correct'));
    const big = completeSession(state, {
      lessonId: 'lesson-what-is-ai',
      attempts: many,
      level: 'intro',
      now: NOW,
    });
    expect(big.goalJustMet).toBe(true);
    expect(big.state.streak.current).toBe(1);
    expect(big.state.gems).toBeGreaterThan(state.gems);
  });

  it('records a checkpoint pass exactly once', () => {
    const first = completeSession(base(), {
      checkpointId: 'checkpoint-foundations-1',
      attempts: [attempt('a', 'correct')],
      level: 'intro',
      now: NOW,
    });
    expect(first.state.stats.checkpointsPassed).toBe(1);

    const second = completeSession(first.state, {
      checkpointId: 'checkpoint-foundations-1',
      attempts: [attempt('a', 'correct')],
      level: 'intro',
      now: NOW + 1000,
    });
    expect(second.state.stats.checkpointsPassed).toBe(1);
  });

  it('counts review sessions separately and skips the completion bonus', () => {
    const result = completeSession(base(), {
      attempts: [attempt('a', 'correct')],
      level: 'intro',
      isReview: true,
      now: NOW,
    });
    expect(result.state.stats.reviewSessions).toBe(1);
    expect(result.xp.bonus).toBe(0);
  });

  it('unlocks achievements and reports a level-up', () => {
    const many = Array.from({ length: 40 }, (_, i) => attempt(`s${i}`, 'correct'));
    const result = completeSession(base(), {
      lessonId: 'lesson-what-is-ai',
      attempts: many,
      level: 'expert',
      now: NOW,
    });

    expect(result.newAchievements.length).toBeGreaterThan(0);
    expect(result.leveledUp).toBe(true);
    expect(result.state.achievements.length).toBe(result.newAchievements.length);
  });

  it('tags an early-morning session as an early bird', () => {
    const dawn = Date.UTC(2026, 2, 1, 6, 30, 0);
    const result = completeSession(base(), {
      lessonId: 'lesson-what-is-ai',
      attempts: [attempt('a', 'correct')],
      level: 'intro',
      now: dawn,
    });
    expect(result.state.stats.earlyBirdSessions).toBe(1);
    expect(result.state.stats.nightOwlSessions).toBe(0);
  });

  it('marks a track complete once every lesson is done', () => {
    const track = TRACKS_BY_ID.get('track-foundations')!;
    let state = base();

    for (const unit of track.units) {
      for (const lesson of unit.lessons) {
        state = completeSession(state, {
          lessonId: lesson.id,
          attempts: [attempt('a', 'correct')],
          level: 'intro',
          now: NOW,
        }).state;
      }
    }

    expect(state.completedTrackIds).toContain('track-foundations');
    expect(trackCompletion(state, 'track-foundations')).toBe(1);
    expect(nextLessonInTrack(state, 'track-foundations')).toBeNull();
  });
});

describe('progress queries', () => {
  it('reports partial track completion and mastery', () => {
    const state = completeSession(base(), {
      lessonId: 'lesson-what-is-ai',
      attempts: [attempt('a', 'correct')],
      level: 'intro',
      now: NOW,
    }).state;

    const completion = trackCompletion(state, 'track-foundations');
    expect(completion).toBeGreaterThan(0);
    expect(completion).toBeLessThan(1);
    expect(trackMastery(state, 'track-foundations')).toBeGreaterThan(0);
    expect(trackCompletion(state, 'nope')).toBe(0);
    expect(trackMastery(state, 'nope')).toBe(0);
  });

  it('suggests starting the first track for a new learner', () => {
    const next = continueLearning(base());
    expect(next?.reason).toBe('start');
    expect(next?.lessonId).toBeTruthy();
  });

  it('suggests continuing the most recently touched track', () => {
    const state = completeSession(base(), {
      lessonId: 'lesson-what-is-ai',
      attempts: [attempt('a', 'correct')],
      level: 'intro',
      now: NOW,
    }).state;

    const next = continueLearning(state);
    expect(next?.reason).toBe('continue');
    expect(next?.trackId).toBe('track-foundations');
    expect(next?.lessonId).not.toBe('lesson-what-is-ai');
  });

  it('aggregates mastery per domain', () => {
    const state = completeSession(base(), {
      lessonId: 'lesson-what-is-ai',
      attempts: [attempt('a', 'correct')],
      level: 'intro',
      now: NOW,
    }).state;

    const mastery = domainMastery(state);
    expect(mastery.foundations).toBeGreaterThan(0);
    expect(mastery.foundations).toBeLessThanOrEqual(1);
  });
});

describe('migration', () => {
  it('returns fresh state for junk input rather than throwing', () => {
    expect(migrateProgress(null).totalXp).toBe(0);
    expect(migrateProgress('nope').totalXp).toBe(0);
    expect(migrateProgress({}).totalXp).toBe(0);
  });

  it('preserves a valid persisted blob', () => {
    const state = completeSession(base(), {
      lessonId: 'lesson-what-is-ai',
      attempts: [attempt('a', 'correct')],
      level: 'intro',
      now: NOW,
    }).state;

    const restored = migrateProgress(JSON.parse(JSON.stringify(state)));
    expect(restored.totalXp).toBe(state.totalXp);
    expect(restored.lessons['lesson-what-is-ai']).toBeDefined();
  });
});

describe('formatting', () => {
  it('formats compact numbers', () => {
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(1500)).toBe('1.5k');
    expect(formatCompact(24_000)).toBe('24k');
    expect(formatCompact(2_400_000)).toBe('2.4M');
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(80)).toBe('1 hr 20 min');
  });

  it('formats relative due dates', () => {
    const now = NOW;
    expect(formatRelativeDue(now - 1000, now)).toBe('now');
    expect(formatRelativeDue(now + 30 * 60_000, now)).toBe('in 30 min');
    expect(formatRelativeDue(now + DAY_MS, now)).toBe('tomorrow');
    expect(formatRelativeDue(now + 5 * DAY_MS, now)).toBe('in 5 days');
    expect(formatRelativeDue(now + 60 * DAY_MS, now)).toBe('in 2 months');
  });

  it('pluralizes', () => {
    expect(plural(1, 'lesson')).toBe('1 lesson');
    expect(plural(4, 'lesson')).toBe('4 lessons');
  });

  it('shuffles deterministically from a seed without losing items', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const seed = hashString('exercise-1');
    expect(seededShuffle(items, seed)).toEqual(seededShuffle(items, seed));
    expect([...seededShuffle(items, seed)].sort()).toEqual([...items].sort());
    expect(seededShuffle(items, seed)).not.toEqual(seededShuffle(items, hashString('exercise-2')));
  });
});
