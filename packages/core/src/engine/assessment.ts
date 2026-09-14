/**
 * Knowledge tests.
 *
 * The catalog has three kinds of assessment and they answer different
 * questions:
 *
 *  - **Placement** (`engine/placement.ts`) — where should I start? Adaptive,
 *    taken once, spans every domain.
 *  - **Unit checkpoint** — did that unit land? Hand-authored, short, sits at the
 *    end of a unit.
 *  - **Track exam** — do I know this whole subject? Assembled here from the
 *    track's own exercises, weighted to cover as many distinct skills as
 *    possible, and usable either as a final or as a way to test out of a track
 *    you already know.
 *
 * Exams are generated rather than hand-written on purpose. A separate authored
 * exam per track would be another 250 exercises to keep in sync with the
 * lessons, and it would drift; sampling the track's own questions cannot.
 */

import type { AttemptRecord, Exercise, SkillId, TrackId, Unit } from '../domain/types';
import { TRACKS_BY_ID } from '../content/index';
import { SKILLS_BY_ID } from '../content/skills';
import { hashString, seededShuffle } from '../util/format';

export type AssessmentKind = 'checkpoint' | 'exam';

export interface Assessment {
  id: string;
  kind: AssessmentKind;
  title: string;
  /** One line describing what it covers. */
  subtitle: string;
  /** 0–1. */
  passingScore: number;
  exercises: Exercise[];
  trackId: TrackId;
  /** Present for checkpoints only. */
  unitId?: string;
}

/** Exams pass at 70% — high enough to mean something, low enough to be fair. */
export const EXAM_PASSING_SCORE = 0.7;

/** Questions in a generated track exam, before the track's own supply caps it. */
export const EXAM_QUESTION_TARGET = 15;

export function trackExamId(trackId: TrackId): string {
  return `exam-${trackId}`;
}

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

function unitExercises(unit: Unit): Exercise[] {
  const out: Exercise[] = [];
  for (const lesson of unit.lessons) {
    for (const step of lesson.steps) {
      if (step.type === 'exercise') out.push(step.exercise);
    }
  }
  return out;
}

/**
 * Assembles a track exam.
 *
 * Breadth beats depth here: the point is to find what the learner does not
 * know, so the sampler round-robins across distinct skills before it ever takes
 * a second question on one. Deterministic per track and seed, so a learner who
 * reloads the page gets the same paper rather than a fresh one.
 */
export function buildTrackExam(
  trackId: TrackId,
  options: { questions?: number; seed?: number } = {},
): Assessment | undefined {
  const track = TRACKS_BY_ID.get(trackId);
  if (!track) return undefined;

  const target = options.questions ?? EXAM_QUESTION_TARGET;
  const seed = options.seed ?? hashString(trackId);

  // Group by the exercise's primary skill. Checkpoint exercises are included —
  // they were written to assess, which is exactly what is wanted here.
  const bySkill = new Map<SkillId, Exercise[]>();
  for (const unit of track.units) {
    const pool = [...unitExercises(unit), ...(unit.checkpoint?.exercises ?? [])];
    for (const exercise of pool) {
      const skillId = exercise.skillIds[0];
      if (!skillId) continue;
      const list = bySkill.get(skillId) ?? [];
      list.push(exercise);
      bySkill.set(skillId, list);
    }
  }

  // Shuffle within each skill so repeat attempts vary, and shuffle the skill
  // order so the paper is not always grouped the same way.
  const skillIds = seededShuffle([...bySkill.keys()], seed);
  const queues = new Map<SkillId, Exercise[]>(
    skillIds.map((id) => [id, seededShuffle(bySkill.get(id) ?? [], seed + hashString(id))]),
  );

  const chosen: Exercise[] = [];
  const taken = new Set<string>();
  let exhausted = false;
  while (chosen.length < target && !exhausted) {
    exhausted = true;
    for (const skillId of skillIds) {
      if (chosen.length >= target) break;
      const queue = queues.get(skillId);
      const next = queue?.shift();
      if (!next) continue;
      exhausted = false;
      if (taken.has(next.id)) continue;
      taken.add(next.id);
      chosen.push(next);
    }
  }

  if (chosen.length === 0) return undefined;

  return {
    id: trackExamId(trackId),
    kind: 'exam',
    title: `${track.title} exam`,
    subtitle: `${chosen.length} questions spanning every unit. Pass at ${Math.round(EXAM_PASSING_SCORE * 100)}%.`,
    passingScore: EXAM_PASSING_SCORE,
    exercises: seededShuffle(chosen, seed + 1),
    trackId: track.id,
  };
}

/** The hand-authored checkpoint at the end of a unit, as an `Assessment`. */
export function getCheckpoint(checkpointId: string): Assessment | undefined {
  for (const track of TRACKS_BY_ID.values()) {
    for (const unit of track.units) {
      if (unit.checkpoint?.id !== checkpointId) continue;
      return {
        id: unit.checkpoint.id,
        kind: 'checkpoint',
        title: unit.checkpoint.title,
        subtitle: `${unit.checkpoint.exercises.length} questions on ${unit.title}. Pass at ${Math.round(unit.checkpoint.passingScore * 100)}%.`,
        passingScore: unit.checkpoint.passingScore,
        exercises: unit.checkpoint.exercises,
        trackId: track.id,
        unitId: unit.id,
      };
    }
  }
  return undefined;
}

/** Resolves any assessment id — a checkpoint id or `exam-<trackId>`. */
export function getAssessment(id: string, seed?: number): Assessment | undefined {
  if (id.startsWith('exam-')) {
    return buildTrackExam(id.slice('exam-'.length), seed === undefined ? {} : { seed });
  }
  return getCheckpoint(id);
}

/** Every assessment in the catalog: one per unit checkpoint, one per track. */
export function allAssessments(): Assessment[] {
  const out: Assessment[] = [];
  for (const track of TRACKS_BY_ID.values()) {
    for (const unit of track.units) {
      if (!unit.checkpoint) continue;
      const checkpoint = getCheckpoint(unit.checkpoint.id);
      if (checkpoint) out.push(checkpoint);
    }
    const exam = buildTrackExam(track.id);
    if (exam) out.push(exam);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

export interface SkillBreakdown {
  skillId: SkillId;
  name: string;
  correct: number;
  total: number;
  /** 0–1. */
  fraction: number;
}

export interface AssessmentResult {
  correct: number;
  total: number;
  /** 0–1. */
  score: number;
  passed: boolean;
  passingScore: number;
  /** Per-skill performance, worst first — the part a learner should act on. */
  bySkill: SkillBreakdown[];
  /** Skills answered wrong at least once. What to review next. */
  weakest: SkillBreakdown[];
}

/**
 * Scores an assessment from its attempt records.
 *
 * Note the deliberate difference from a lesson: an assessment counts the
 * *first* answer to each question. A lesson re-queues mistakes until they are
 * answered right, which is good teaching and would make any test meaningless.
 */
export function gradeAssessment(
  assessment: Assessment,
  attempts: readonly AttemptRecord[],
): AssessmentResult {
  const firstByExercise = new Map<string, AttemptRecord>();
  for (const attempt of attempts) {
    if (!firstByExercise.has(attempt.stepId)) firstByExercise.set(attempt.stepId, attempt);
  }

  let correct = 0;
  const totals = new Map<SkillId, { correct: number; total: number }>();

  for (const exercise of assessment.exercises) {
    const attempt = firstByExercise.get(exercise.id);
    const wasCorrect = attempt?.outcome === 'correct';
    if (wasCorrect) correct += 1;

    for (const skillId of exercise.skillIds) {
      const entry = totals.get(skillId) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (wasCorrect) entry.correct += 1;
      totals.set(skillId, entry);
    }
  }

  const total = assessment.exercises.length;
  const score = total === 0 ? 0 : correct / total;

  const bySkill: SkillBreakdown[] = [...totals.entries()]
    .map(([skillId, entry]) => ({
      skillId,
      name: SKILLS_BY_ID.get(skillId)?.name ?? skillId,
      correct: entry.correct,
      total: entry.total,
      fraction: entry.total === 0 ? 0 : entry.correct / entry.total,
    }))
    // Worst first, then by how much evidence there is, then alphabetically so
    // the order is stable across renders.
    .sort((a, b) => a.fraction - b.fraction || b.total - a.total || a.name.localeCompare(b.name));

  return {
    correct,
    total,
    score,
    passed: score >= assessment.passingScore,
    passingScore: assessment.passingScore,
    bySkill,
    weakest: bySkill.filter((s) => s.fraction < 1),
  };
}
