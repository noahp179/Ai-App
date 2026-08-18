/**
 * Answer grading.
 *
 * Every exercise kind grades locally and synchronously. `short-answer` also has
 * a remote path (the AI tutor) that produces richer feedback, but the local
 * keyword rubric here is always the fallback so the app stays fully usable
 * offline and without a subscription.
 */

import type { Exercise, ShortAnswerExercise } from '../domain/types';

/** The shape of a learner's response, discriminated by exercise kind. */
export type Response =
  | { kind: 'choice'; index: number }
  | { kind: 'choices'; indices: number[] }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'text'; values: string[] }
  | { kind: 'order'; items: string[] }
  | { kind: 'pairs'; pairs: Array<{ left: string; right: string }> }
  | { kind: 'number'; value: number }
  | { kind: 'buckets'; assignments: Array<{ item: string; category: string }> }
  | { kind: 'skipped' };

export interface GradeResult {
  correct: boolean;
  /** 0–1. Partial credit where the exercise kind supports it. */
  score: number;
  /** Per-slot correctness, for kinds that render item-level feedback. */
  detail?: boolean[];
  feedback?: string;
}

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s.+-]/gu, '')
    .replace(/\s+/g, ' ');

const sameSet = (a: number[], b: number[]): boolean => {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x));
};

/**
 * Grades a response against an exercise.
 *
 * A response whose kind does not match the exercise is treated as incorrect
 * rather than throwing — a malformed response from a stale UI should not crash
 * a learning session.
 */
export function grade(exercise: Exercise, response: Response): GradeResult {
  if (response.kind === 'skipped') {
    return { correct: false, score: 0, feedback: 'Skipped' };
  }

  switch (exercise.kind) {
    case 'multiple-choice':
    case 'code-output': {
      if (response.kind !== 'choice') return miss();
      const correct = response.index === exercise.answer;
      return { correct, score: correct ? 1 : 0 };
    }

    case 'true-false': {
      if (response.kind !== 'boolean') return miss();
      const correct = response.value === exercise.answer;
      return { correct, score: correct ? 1 : 0 };
    }

    case 'multi-select': {
      if (response.kind !== 'choices') return miss();
      const correct = sameSet(response.indices, exercise.answers);
      if (correct) return { correct: true, score: 1 };
      // Partial credit: reward hits, penalize false positives, floor at 0.
      const answerSet = new Set(exercise.answers);
      const hits = response.indices.filter((i) => answerSet.has(i)).length;
      const falsePositives = response.indices.length - hits;
      const raw = (hits - falsePositives) / exercise.answers.length;
      return { correct: false, score: Math.max(0, Math.min(1, raw)) };
    }

    case 'fill-blank': {
      if (response.kind !== 'text') return miss();
      const detail = exercise.blanks.map((accepted, i) => {
        const given = normalize(response.values[i] ?? '');
        return accepted.some((a) => normalize(a) === given);
      });
      const hits = detail.filter(Boolean).length;
      return {
        correct: hits === exercise.blanks.length,
        score: exercise.blanks.length === 0 ? 1 : hits / exercise.blanks.length,
        detail,
      };
    }

    case 'order-sequence': {
      if (response.kind !== 'order') return miss();
      const detail = exercise.items.map((item, i) => response.items[i] === item);
      const hits = detail.filter(Boolean).length;
      return {
        correct: hits === exercise.items.length,
        score: exercise.items.length === 0 ? 1 : hits / exercise.items.length,
        detail,
      };
    }

    case 'match-pairs': {
      if (response.kind !== 'pairs') return miss();
      const truth = new Map(exercise.pairs.map((p) => [normalize(p.left), normalize(p.right)]));
      const detail = response.pairs.map(
        (p) => truth.get(normalize(p.left)) === normalize(p.right),
      );
      const hits = detail.filter(Boolean).length;
      return {
        correct: hits === exercise.pairs.length,
        score: exercise.pairs.length === 0 ? 1 : hits / exercise.pairs.length,
        detail,
      };
    }

    case 'numeric': {
      if (response.kind !== 'number') return miss();
      if (!Number.isFinite(response.value)) return miss();
      const tolerance = exercise.tolerance ?? 0;
      const correct = Math.abs(response.value - exercise.answer) <= tolerance;
      return { correct, score: correct ? 1 : 0 };
    }

    case 'short-answer': {
      if (response.kind !== 'text') return miss();
      return gradeShortAnswer(exercise, response.values[0] ?? '');
    }

    case 'categorize': {
      if (response.kind !== 'buckets') return miss();
      const truth = new Map(exercise.items.map((i) => [normalize(i.item), normalize(i.category)]));
      // Score over the *expected* items, so leaving items unsorted costs marks
      // rather than being silently ignored.
      const placed = new Map(
        response.assignments.map((a) => [normalize(a.item), normalize(a.category)]),
      );
      const detail = exercise.items.map(
        (i) => placed.get(normalize(i.item)) === truth.get(normalize(i.item)),
      );
      const hits = detail.filter(Boolean).length;
      return {
        correct: hits === exercise.items.length,
        score: exercise.items.length === 0 ? 1 : hits / exercise.items.length,
        detail,
      };
    }

    default: {
      // Exhaustiveness guard: a new exercise kind must be handled above.
      const _never: never = exercise;
      void _never;
      return miss();
    }
  }
}

/**
 * Local rubric grading for free-response answers.
 *
 * Deliberately generous: this is a teaching aid, not an exam proctor. It looks
 * for rubric keywords (and their obvious morphological variants) and passes at
 * the exercise's threshold.
 */
export function gradeShortAnswer(
  exercise: ShortAnswerExercise,
  answer: string,
): GradeResult {
  const text = normalize(answer);
  if (text.length < 3) {
    return { correct: false, score: 0, feedback: 'Give it a real attempt first.' };
  }

  const detail = exercise.rubricKeywords.map((keyword) => {
    const k = normalize(keyword);
    if (text.includes(k)) return true;
    // Tolerate simple plural/gerund variants without pulling in a stemmer.
    const stem = k.replace(/(ing|es|s)$/u, '');
    return stem.length >= 4 && text.includes(stem);
  });

  const hits = detail.filter(Boolean).length;
  const total = exercise.rubricKeywords.length || 1;
  const score = hits / total;
  const threshold = exercise.passThreshold ?? 0.5;
  const missed = exercise.rubricKeywords.filter((_, i) => !detail[i]);

  return {
    correct: score >= threshold,
    score,
    detail,
    feedback:
      score >= threshold
        ? 'Good — you hit the key ideas.'
        : `Also worth mentioning: ${missed.slice(0, 3).join(', ')}.`,
  };
}

function miss(): GradeResult {
  return { correct: false, score: 0 };
}
