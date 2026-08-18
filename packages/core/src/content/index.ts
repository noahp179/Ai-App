/**
 * The catalog: every track, plus derived indexes and a validator.
 *
 * `validateCatalog` runs in the test suite and in dev builds. Content is data,
 * and data written by hand drifts — a skill id typo would otherwise silently
 * break review scheduling for that exercise with no visible error.
 */

import type {
  Domain,
  Exercise,
  Lesson,
  LessonId,
  Level,
  SkillId,
  Track,
  TrackId,
  UnitId,
} from '../domain/types';
import { SKILLS_BY_ID } from './skills';
import { foundationsTrack } from './tracks/foundations';
import { machineLearningTrack } from './tracks/machine-learning';
import { deepLearningTrack } from './tracks/deep-learning';
import { llmTrack } from './tracks/llms';
import { promptEngineeringTrack } from './tracks/prompt-engineering';
import { generativeAiTrack } from './tracks/generative-ai';
import { agentsTrack } from './tracks/agents';
import { mathTrack } from './tracks/math';
import { typesOfMlTrack } from './tracks/types-of-ml';
import { classicMlTrack } from './tracks/classic-ml';
import { dataEngineeringTrack } from './tracks/data-engineering';
import { mlopsTrack, ethicsTrack, reinforcementLearningTrack } from './tracks/applied';

export const TRACKS: Track[] = [
  foundationsTrack,
  promptEngineeringTrack,
  mathTrack,
  typesOfMlTrack,
  machineLearningTrack,
  classicMlTrack,
  dataEngineeringTrack,
  deepLearningTrack,
  llmTrack,
  generativeAiTrack,
  agentsTrack,
  reinforcementLearningTrack,
  mlopsTrack,
  ethicsTrack,
];

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

export const TRACKS_BY_ID: ReadonlyMap<TrackId, Track> = new Map(TRACKS.map((t) => [t.id, t]));

/** Where a lesson lives, so the UI can render breadcrumbs and gate access. */
export interface LessonLocation {
  lesson: Lesson;
  track: Track;
  unitId: UnitId;
  /** Unit position within its track. Unit 0 of every track is free. */
  unitIndex: number;
  lessonIndex: number;
}

const lessonIndex = new Map<LessonId, LessonLocation>();
for (const track of TRACKS) {
  track.units.forEach((unit, unitIdx) => {
    unit.lessons.forEach((lesson, lessonIdx) => {
      lessonIndex.set(lesson.id, {
        lesson,
        track,
        unitId: unit.id,
        unitIndex: unitIdx,
        lessonIndex: lessonIdx,
      });
    });
  });
}

export const LESSON_INDEX: ReadonlyMap<LessonId, LessonLocation> = lessonIndex;

export function getLesson(id: LessonId): LessonLocation | undefined {
  return lessonIndex.get(id);
}

export function getTrack(id: TrackId): Track | undefined {
  return TRACKS_BY_ID.get(id);
}

/** Every lesson, in catalog order. */
export function allLessons(): Lesson[] {
  return TRACKS.flatMap((t) => t.units.flatMap((u) => u.lessons));
}

/** Every exercise in the catalog, including checkpoint exercises. */
export function allExercises(): Exercise[] {
  const out: Exercise[] = [];
  for (const track of TRACKS) {
    for (const unit of track.units) {
      for (const lesson of unit.lessons) {
        for (const step of lesson.steps) {
          if (step.type === 'exercise') out.push(step.exercise);
        }
      }
      if (unit.checkpoint) out.push(...unit.checkpoint.exercises);
    }
  }
  return out;
}

/** Skill id → the exercises that practise it. Drives the review queue. */
export function exercisesBySkill(): Map<SkillId, Exercise[]> {
  const map = new Map<SkillId, Exercise[]>();
  for (const exercise of allExercises()) {
    for (const skillId of exercise.skillIds) {
      const list = map.get(skillId);
      if (list) list.push(exercise);
      else map.set(skillId, [exercise]);
    }
  }
  return map;
}

/** All skill ids taught by a track — used for the track mastery ring. */
export function skillsInTrack(trackId: TrackId): SkillId[] {
  const track = TRACKS_BY_ID.get(trackId);
  if (!track) return [];
  const skills = new Set<SkillId>();
  for (const unit of track.units) {
    for (const lesson of unit.lessons) {
      for (const step of lesson.steps) {
        if (step.type === 'exercise') {
          for (const id of step.exercise.skillIds) skills.add(id);
        }
      }
    }
    for (const exercise of unit.checkpoint?.exercises ?? []) {
      for (const id of exercise.skillIds) skills.add(id);
    }
  }
  return [...skills];
}

// ---------------------------------------------------------------------------
// Filtering & recommendation
// ---------------------------------------------------------------------------

export interface CatalogFilter {
  level?: Level;
  domain?: Domain;
  query?: string;
}

export function filterTracks(filter: CatalogFilter): Track[] {
  const q = filter.query?.toLowerCase().trim();
  return TRACKS.filter((track) => {
    if (filter.level && track.level !== filter.level) return false;
    if (filter.domain && track.domain !== filter.domain) return false;
    if (q) {
      const haystack =
        `${track.title} ${track.tagline} ${track.description} ${track.outcomes.join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Recommends a starting track order for a learner.
 *
 * Tracks whose prerequisites are already complete come first, then tracks at
 * or just below the learner's level, then everything else. Deliberately simple
 * and explainable — the UI shows *why* each track is recommended.
 */
export function recommendTracks(
  level: Level,
  completedTrackIds: TrackId[],
  interests: Domain[] = [],
): Track[] {
  const completed = new Set(completedTrackIds);
  const levelRank: Record<Level, number> = { intro: 0, intermediate: 1, expert: 2 };
  const learnerRank = levelRank[level];

  return [...TRACKS]
    .filter((t) => !completed.has(t.id))
    .map((track) => {
      let score = 0;
      const prereqsMet = track.prerequisites.every((p) => completed.has(p));
      if (prereqsMet) score += 100;
      if (interests.includes(track.domain)) score += 40;

      // Prefer tracks at the learner's level; penalise reaching too far up.
      const gap = levelRank[track.level] - learnerRank;
      score += gap === 0 ? 30 : gap < 0 ? 10 : Math.max(0, 20 - gap * 25);

      return { track, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.track);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  severity: 'error' | 'warning';
  location: string;
  message: string;
}

/**
 * Checks catalog integrity: unique ids, resolvable skill references, sane
 * exercise definitions, and satisfiable track prerequisites.
 */
export function validateCatalog(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenTrackIds = new Set<string>();
  const seenLessonIds = new Set<string>();
  const seenStepIds = new Set<string>();
  const trackIds = new Set(TRACKS.map((t) => t.id));

  const err = (location: string, message: string): void => {
    issues.push({ severity: 'error', location, message });
  };
  const warn = (location: string, message: string): void => {
    issues.push({ severity: 'warning', location, message });
  };

  for (const track of TRACKS) {
    if (seenTrackIds.has(track.id)) err(track.id, 'Duplicate track id');
    seenTrackIds.add(track.id);

    for (const prereq of track.prerequisites) {
      if (!trackIds.has(prereq)) err(track.id, `Unknown prerequisite track "${prereq}"`);
    }
    if (track.units.length === 0) warn(track.id, 'Track has no units');

    for (const unit of track.units) {
      if (unit.lessons.length === 0) warn(unit.id, 'Unit has no lessons');

      const checkExercise = (exercise: Exercise, location: string): void => {
        if (seenStepIds.has(exercise.id)) err(location, `Duplicate exercise id "${exercise.id}"`);
        seenStepIds.add(exercise.id);

        if (exercise.skillIds.length === 0) {
          warn(location, `Exercise "${exercise.id}" references no skills`);
        }
        for (const skillId of exercise.skillIds) {
          if (!SKILLS_BY_ID.has(skillId)) {
            err(location, `Exercise "${exercise.id}" references unknown skill "${skillId}"`);
          }
        }
        if (!exercise.explanation.trim()) {
          err(location, `Exercise "${exercise.id}" has an empty explanation`);
        }

        switch (exercise.kind) {
          case 'multiple-choice':
          case 'code-output':
            if (exercise.choices.length < 2) {
              err(location, `Exercise "${exercise.id}" needs at least 2 choices`);
            }
            if (exercise.answer < 0 || exercise.answer >= exercise.choices.length) {
              err(location, `Exercise "${exercise.id}" answer index out of range`);
            }
            break;
          case 'multi-select':
            if (exercise.answers.length === 0) {
              err(location, `Exercise "${exercise.id}" has no correct answers`);
            }
            for (const a of exercise.answers) {
              if (a < 0 || a >= exercise.choices.length) {
                err(location, `Exercise "${exercise.id}" answer index ${a} out of range`);
              }
            }
            break;
          case 'fill-blank': {
            const blankCount = (exercise.template.match(/___/g) ?? []).length;
            if (blankCount !== exercise.blanks.length) {
              err(
                location,
                `Exercise "${exercise.id}" has ${blankCount} blanks in the template but ${exercise.blanks.length} answer sets`,
              );
            }
            break;
          }
          case 'match-pairs':
            if (exercise.pairs.length < 2) {
              err(location, `Exercise "${exercise.id}" needs at least 2 pairs`);
            }
            break;
          case 'order-sequence':
            if (exercise.items.length < 2) {
              err(location, `Exercise "${exercise.id}" needs at least 2 items`);
            }
            break;
          case 'short-answer':
            if (exercise.rubricKeywords.length === 0) {
              err(location, `Exercise "${exercise.id}" has no rubric keywords`);
            }
            break;
          case 'categorize': {
            if (exercise.categories.length < 2) {
              err(location, `Exercise "${exercise.id}" needs at least 2 categories`);
            }
            if (exercise.items.length < 2) {
              err(location, `Exercise "${exercise.id}" needs at least 2 items`);
            }
            const declared = new Set(exercise.categories);
            for (const entry of exercise.items) {
              if (!declared.has(entry.category)) {
                err(
                  location,
                  `Exercise "${exercise.id}" item "${entry.item}" targets undeclared category "${entry.category}"`,
                );
              }
            }
            // Every bucket should receive at least one item, or the learner is
            // shown a decoy that can never be correct.
            const used = new Set(exercise.items.map((i) => i.category));
            for (const category of exercise.categories) {
              if (!used.has(category)) {
                warn(location, `Exercise "${exercise.id}" category "${category}" has no items`);
              }
            }
            break;
          }
          default:
            break;
        }
      };

      for (const lesson of unit.lessons) {
        if (seenLessonIds.has(lesson.id)) err(lesson.id, 'Duplicate lesson id');
        seenLessonIds.add(lesson.id);

        if (lesson.steps.length === 0) err(lesson.id, 'Lesson has no steps');

        const hasExercise = lesson.steps.some((s) => s.type === 'exercise');
        if (!hasExercise) warn(lesson.id, 'Lesson has no exercises — nothing is practised');

        for (const step of lesson.steps) {
          if (step.type === 'exercise') {
            checkExercise(step.exercise, lesson.id);
          } else {
            if (seenStepIds.has(step.id)) err(lesson.id, `Duplicate step id "${step.id}"`);
            seenStepIds.add(step.id);
          }
        }
      }

      if (unit.checkpoint) {
        if (unit.checkpoint.exercises.length === 0) {
          err(unit.checkpoint.id, 'Checkpoint has no exercises');
        }
        if (unit.checkpoint.passingScore <= 0 || unit.checkpoint.passingScore > 1) {
          err(unit.checkpoint.id, 'Checkpoint passingScore must be in (0, 1]');
        }
        for (const exercise of unit.checkpoint.exercises) {
          checkExercise(exercise, unit.checkpoint.id);
        }
      }
    }
  }

  // Skills defined but never practised are dead weight in the radar chart.
  const practised = new Set(allExercises().flatMap((e) => e.skillIds));
  for (const skillId of SKILLS_BY_ID.keys()) {
    if (!practised.has(skillId)) {
      warn(skillId, 'Skill is defined but no exercise practises it');
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Catalog statistics — shown on the catalog screen and used in marketing copy.
// ---------------------------------------------------------------------------

export interface CatalogStats {
  tracks: number;
  units: number;
  lessons: number;
  exercises: number;
  skills: number;
  totalMinutes: number;
  byLevel: Record<Level, number>;
}

export function catalogStats(): CatalogStats {
  const lessons = allLessons();
  const byLevel: Record<Level, number> = { intro: 0, intermediate: 0, expert: 0 };
  for (const lesson of lessons) byLevel[lesson.level] += 1;

  return {
    tracks: TRACKS.length,
    units: TRACKS.reduce((n, t) => n + t.units.length, 0),
    lessons: lessons.length,
    exercises: allExercises().length,
    skills: SKILLS_BY_ID.size,
    totalMinutes: lessons.reduce((n, l) => n + l.estimatedMinutes, 0),
    byLevel,
  };
}

export { SKILLS, SKILLS_BY_ID, getSkill } from './skills';
export { ACHIEVEMENTS, evaluateAchievements } from './achievements';
export { placementPool } from './placement-pool';
