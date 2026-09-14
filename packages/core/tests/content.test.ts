import { describe, expect, it } from 'vitest';

import {
  LESSON_INDEX,
  PATHS,
  TRACKS,
  TRACKS_BY_ID,
  allExercises,
  allLessons,
  catalogStats,
  exercisesBySkill,
  filterTracks,
  getLesson,
  getPath,
  getTrack,
  pathProgress,
  pathStats,
  pathTracks,
  recommendPaths,
  recommendTracks,
  skillsInTrack,
  validateCatalog,
} from '../src/content/index';
import { SKILLS, SKILLS_BY_ID } from '../src/content/skills';
import { ACHIEVEMENTS, achievementProgress, evaluateAchievements } from '../src/content/achievements';
import type { AchievementStats } from '../src/content/achievements';
import { grade } from '../src/engine/grading';
import { correctResponseFor } from './engine.test';

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

  it('uses every declared interactive widget at least once', () => {
    const used = new Set<string>();
    for (const lesson of allLessons()) {
      for (const step of lesson.steps) {
        if (step.type === 'interactive') used.add(step.widget);
      }
    }
    // Every name in the InteractiveWidget union must appear in content;
    // an unused one is a widget nobody can reach.
    const declared = new Set<string>([
      'ml-type-sorter', 'train-test-split', 'data-bias', 'bayes-calculator',
      'entropy-explorer', 'feature-scaling', 'cross-validation',
      'linear-regression', 'knn', 'kmeans', 'decision-tree', 'ensemble-vote',
      'pca-projection', 'anomaly-detection', 'roc-curve', 'confusion-matrix',
      'regularization', 'bias-variance',
      'perceptron', 'neural-net-trainer', 'activation-explorer', 'convolution',
      'gradient-descent', 'learning-rate-schedule',
      'tokenizer', 'temperature-sampler', 'attention-matrix', 'embedding-space',
      'beam-search', 'moe-router', 'quantization', 'rag-retrieval', 'prompt-lab',
      'q-learning', 'agent-loop-sim', 'diffusion-denoise', 'drift-monitor',
      'big-o-explorer', 'sorting-visualizer', 'hash-table-probe', 'graph-traversal',
    ]);

    const unused = [...declared].filter((w) => !used.has(w));
    expect(unused).toEqual([]);
    expect(used.size).toBe(declared.size);
  });

  it('spreads interactives across the catalog rather than clustering them', () => {
    const tracksWithInteractives = TRACKS.filter((track) =>
      track.units.some((unit) =>
        unit.lessons.some((lesson) => lesson.steps.some((s) => s.type === 'interactive')),
      ),
    );
    // Every track should have at least one hands-on moment.
    expect(tracksWithInteractives.length).toBe(TRACKS.length);
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

describe('learning paths', () => {
  it('routes every track through at least one path', () => {
    const routed = new Set(PATHS.flatMap((p) => p.trackIds));
    const unrouted = TRACKS.filter((t) => !routed.has(t.id)).map((t) => t.id);
    expect(unrouted).toEqual([]);
  });

  it('references only tracks that exist', () => {
    const ids = new Set(TRACKS.map((t) => t.id));
    const broken = PATHS.flatMap((p) =>
      p.trackIds.filter((id) => !ids.has(id)).map((id) => `${p.id} -> ${id}`),
    );
    expect(broken).toEqual([]);
  });

  it('lists no track twice within a path', () => {
    for (const path of PATHS) {
      expect(new Set(path.trackIds).size, path.id).toBe(path.trackIds.length);
    }
  });

  it('reports stats that match the tracks it contains', () => {
    for (const path of PATHS) {
      const stats = pathStats(path);
      expect(stats.tracks, path.id).toBe(path.trackIds.length);
      expect(stats.lessons, path.id).toBeGreaterThan(0);
      expect(stats.minutes, path.id).toBeGreaterThan(0);
    }
  });

  it('starts at zero progress and points at the first lesson', () => {
    const path = PATHS[0]!;
    const progress = pathProgress(path, new Set());
    expect(progress.completedLessons).toBe(0);
    expect(progress.fraction).toBe(0);
    expect(progress.next?.trackId).toBe(path.trackIds[0]);
  });

  it('completes fully when every lesson in it is done', () => {
    const path = PATHS[0]!;
    const done = new Set(
      pathTracks(path).flatMap((t) => t.units.flatMap((u) => u.lessons.map((l) => l.id))),
    );
    const progress = pathProgress(path, done);
    expect(progress.fraction).toBe(1);
    expect(progress.next).toBeNull();
    expect(progress.completedLessons).toBe(progress.totalLessons);
  });

  it('advances the next lesson as earlier ones are completed', () => {
    const path = PATHS[0]!;
    const first = pathProgress(path, new Set()).next!;
    const after = pathProgress(path, new Set([first.lessonId])).next!;
    expect(after.lessonId).not.toBe(first.lessonId);
  });

  it('ranks every started path above every path with nothing completed in it', () => {
    const cv = getTrack('track-computer-vision')!;
    const done = new Set([cv.units[0]!.lessons[0]!.id]);

    const ranked = recommendPaths(done);
    const started = ranked.filter((p) => pathProgress(p, done).completedLessons > 0);
    const untouched = ranked.filter((p) => pathProgress(p, done).completedLessons === 0);

    expect(started.length).toBeGreaterThan(0);
    expect(untouched.length).toBeGreaterThan(0);

    const lastStarted = Math.max(...started.map((p) => ranked.indexOf(p)));
    const firstUntouched = Math.min(...untouched.map((p) => ranked.indexOf(p)));
    expect(lastStarted).toBeLessThan(firstUntouched);
  });

  it('sinks a finished path to the bottom', () => {
    const finished = PATHS[0]!;
    const done = new Set(
      pathTracks(finished).flatMap((t) => t.units.flatMap((u) => u.lessons.map((l) => l.id))),
    );
    const ranked = recommendPaths(done);
    expect(ranked[ranked.length - 1]?.id).toBe(finished.id);
  });

  it('promotes paths matching the learner’s stated goals', () => {
    const forLeaders = recommendPaths(new Set(), ['lead-teams']);
    expect(forLeaders[0]?.goals).toContain('lead-teams');

    const forResearch = recommendPaths(new Set(), ['research']);
    expect(forResearch[0]?.goals).toContain('research');
  });

  it('gives every path at least one goal so none is unreachable by intent', () => {
    for (const path of PATHS) {
      expect(path.goals.length, path.id).toBeGreaterThan(0);
    }
  });

  it('covers every onboarding goal with at least one path', () => {
    const served = new Set(PATHS.flatMap((p) => p.goals));
    const goals = ['curious', 'career-switch', 'build-products', 'research', 'lead-teams', 'exam-prep'];
    expect(goals.filter((g) => !served.has(g as never))).toEqual([]);
  });

  it('returns undefined for an unknown path id', () => {
    expect(getPath('does-not-exist')).toBeUndefined();
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
