import { describe, expect, it } from 'vitest';

import {
  LESSON_INDEX,
  TRACKS,
  TRACKS_BY_ID,
  allExercises,
  allLessons,
  catalogStats,
  exercisesBySkill,
  filterTracks,
  getLesson,
  getTrack,
  recommendTracks,
  skillsInTrack,
  validateCatalog,
} from '../src/content/index.js';
import { SKILLS, SKILLS_BY_ID } from '../src/content/skills.js';
import { ACHIEVEMENTS, achievementProgress, evaluateAchievements } from '../src/content/achievements.js';
import type { AchievementStats } from '../src/content/achievements.js';
import { grade } from '../src/engine/grading.js';
import { correctResponseFor } from './engine.test.js';

describe('catalog integrity', () => {
  const issues = validateCatalog();
  const errors = issues.filter((i) => i.severity === 'error');

  it('has no validation errors', () => {
    expect(errors.map((e) => `${e.location}: ${e.message}`)).toEqual([]);
  });

  it('has no orphaned skills or empty lessons', () => {
    const warnings = issues.filter((i) => i.severity === 'warning');
    expect(warnings.map((w) => `${w.location}: ${w.message}`)).toEqual([]);
  });

  it('ships a substantial catalog', () => {
    const stats = catalogStats();
    expect(stats.tracks).toBeGreaterThanOrEqual(10);
    expect(stats.lessons).toBeGreaterThanOrEqual(25);
    expect(stats.exercises).toBeGreaterThanOrEqual(150);
    expect(stats.totalMinutes).toBeGreaterThan(100);
  });

  it('covers all three levels', () => {
    const stats = catalogStats();
    expect(stats.byLevel.intro).toBeGreaterThan(0);
    expect(stats.byLevel.intermediate).toBeGreaterThan(0);
    expect(stats.byLevel.expert).toBeGreaterThan(0);
  });

  it('every exercise is answerable — the stated answer grades as correct', () => {
    const failures: string[] = [];
    for (const exercise of allExercises()) {
      const result = grade(exercise, correctResponseFor(exercise));
      if (!result.correct) failures.push(`${exercise.id} (${exercise.kind})`);
    }
    expect(failures).toEqual([]);
  });

  it('every track prerequisite resolves to a real track', () => {
    for (const track of TRACKS) {
      for (const prereq of track.prerequisites) {
        expect(TRACKS_BY_ID.has(prereq)).toBe(true);
      }
    }
  });

  it('has no circular track prerequisites', () => {
    const visit = (id: string, seen: Set<string>): void => {
      if (seen.has(id)) throw new Error(`Prerequisite cycle at ${id}`);
      const track = TRACKS_BY_ID.get(id);
      if (!track) return;
      const next = new Set(seen).add(id);
      for (const prereq of track.prerequisites) visit(prereq, next);
    };
    expect(() => TRACKS.forEach((t) => visit(t.id, new Set()))).not.toThrow();
  });

  it('has no circular skill prerequisites', () => {
    const visit = (id: string, seen: Set<string>): void => {
      if (seen.has(id)) throw new Error(`Skill cycle at ${id}`);
      const skill = SKILLS_BY_ID.get(id);
      if (!skill) return;
      const next = new Set(seen).add(id);
      for (const prereq of skill.prerequisites) visit(prereq, next);
    };
    expect(() => SKILLS.forEach((s) => visit(s.id, new Set()))).not.toThrow();
  });

  it('resolves every skill prerequisite', () => {
    for (const skill of SKILLS) {
      for (const prereq of skill.prerequisites) {
        expect(SKILLS_BY_ID.has(prereq), `${skill.id} -> ${prereq}`).toBe(true);
      }
    }
  });

  it('indexes every lesson with its location', () => {
    const lessons = allLessons();
    expect(LESSON_INDEX.size).toBe(lessons.length);
    for (const lesson of lessons) {
      const location = getLesson(lesson.id);
      expect(location).toBeDefined();
      expect(location?.track.units[location.unitIndex]?.id).toBe(location?.unitId);
    }
  });

  it('offers free content in every track so nothing is fully paywalled', () => {
    for (const track of TRACKS) {
      expect(track.units.length, track.id).toBeGreaterThan(0);
      expect(track.units[0]?.lessons.length, track.id).toBeGreaterThan(0);
    }
  });

  it('maps skills to the exercises that practise them', () => {
    const map = exercisesBySkill();
    expect(map.size).toBeGreaterThan(50);
    for (const [skillId, exercises] of map) {
      expect(SKILLS_BY_ID.has(skillId)).toBe(true);
      expect(exercises.length).toBeGreaterThan(0);
    }
  });

  it('lists the skills each track teaches', () => {
    expect(skillsInTrack('track-foundations').length).toBeGreaterThan(5);
    expect(skillsInTrack('does-not-exist')).toEqual([]);
  });
});

describe('catalog queries', () => {
  it('filters by level, domain, and free-text', () => {
    expect(filterTracks({ level: 'intro' }).every((t) => t.level === 'intro')).toBe(true);
    expect(filterTracks({ domain: 'llms' }).every((t) => t.domain === 'llms')).toBe(true);

    const found = filterTracks({ query: 'attention' });
    expect(found.length).toBeGreaterThan(0);
    expect(filterTracks({ query: 'zzzznotathing' })).toEqual([]);
  });

  it('recommends prerequisite-satisfied tracks first', () => {
    const recommended = recommendTracks('intro', []);
    expect(recommended[0]?.prerequisites).toEqual([]);
    expect(recommended.some((t) => t.id === 'track-foundations')).toBe(true);
  });

  it('excludes completed tracks and promotes newly unblocked ones', () => {
    const recommended = recommendTracks('intermediate', ['track-foundations']);
    expect(recommended.some((t) => t.id === 'track-foundations')).toBe(false);
    expect(recommended[0]?.prerequisites.every((p) => p === 'track-foundations' || p === '')).toBe(true);
  });

  it('weights the learner interests it was given', () => {
    const withInterest = recommendTracks('intermediate', ['track-foundations'], ['ethics-safety']);
    const rank = withInterest.findIndex((t) => t.domain === 'ethics-safety');
    const without = recommendTracks('intermediate', ['track-foundations']);
    const baseRank = without.findIndex((t) => t.domain === 'ethics-safety');
    expect(rank).toBeLessThanOrEqual(baseRank);
  });

  it('returns undefined for unknown ids rather than throwing', () => {
    expect(getTrack('nope')).toBeUndefined();
    expect(getLesson('nope')).toBeUndefined();
  });
});

describe('achievements', () => {
  const emptyStats: AchievementStats = {
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
  };

  it('unlocks nothing at zero', () => {
    expect(evaluateAchievements(emptyStats, [])).toEqual([]);
  });

  it('unlocks every crossed tier at once', () => {
    const unlocked = evaluateAchievements({ ...emptyStats, currentStreak: 14 }, []);
    const streakTiers = unlocked.filter((u) => u.id === 'ach-streak').map((u) => u.tier);
    expect(streakTiers).toEqual([3, 7, 14]);
  });

  it('is idempotent — re-evaluating returns nothing new', () => {
    const stats = { ...emptyStats, lessonsCompleted: 25 };
    const first = evaluateAchievements(stats, []);
    expect(first.length).toBeGreaterThan(0);
    expect(evaluateAchievements(stats, first)).toEqual([]);
  });

  it('reports progress toward the next tier', () => {
    const progress = achievementProgress({ ...emptyStats, lessonsCompleted: 5 }, []);
    const scholar = progress.find((p) => p.achievement.id === 'ach-lessons');
    expect(scholar?.nextTier).toBe(1);
    expect(scholar?.fraction).toBe(1);

    const fresh = achievementProgress(emptyStats, []);
    expect(fresh.find((p) => p.achievement.id === 'ach-lessons')?.fraction).toBe(0);
  });

  it('has strictly increasing tiers', () => {
    for (const achievement of ACHIEVEMENTS) {
      for (let i = 1; i < achievement.tiers.length; i += 1) {
        expect(achievement.tiers[i]!).toBeGreaterThan(achievement.tiers[i - 1]!);
      }
    }
  });
});
