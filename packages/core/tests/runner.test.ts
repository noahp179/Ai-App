/**
 * The code-write harness, and every authored solution run against its own cases.
 *
 * The second half is the valuable part. A `code-write` exercise whose worked
 * solution does not actually pass is worse than a missing exercise: the learner
 * is told they are wrong by a test the author could not satisfy either. Running
 * the solutions here means that can never ship.
 */

import { describe, expect, it } from 'vitest';

import { TRACKS } from '../src/content/index';
import {
  caseLabel,
  formatValue,
  runCodeExercise,
  totalCases,
  valuesEqual,
  type Evaluator,
} from '../src/engine/runner';
import { grade } from '../src/engine/grading';
import type { CodeWriteExercise, Exercise } from '../src/domain/types';

/**
 * Node has no Worker in this context and no untrusted input — the sources here
 * are our own content — so the test evaluator runs directly.
 */
const evaluate: Evaluator = async (source, functionName, args) => {
  const factory = new Function(
    `${source}\n;return typeof ${functionName} === 'function' ? ${functionName} : undefined;`,
  ) as () => ((...a: unknown[]) => unknown) | undefined;
  const fn = factory();
  if (typeof fn !== 'function') throw new Error(`No function named ${functionName}`);
  return fn(...args);
};

function allCodeExercises(): Array<{ trackId: string; exercise: CodeWriteExercise }> {
  const out: Array<{ trackId: string; exercise: CodeWriteExercise }> = [];
  const collect = (trackId: string, exercise: Exercise): void => {
    if (exercise.kind === 'code-write') out.push({ trackId, exercise });
  };
  for (const track of TRACKS) {
    for (const unit of track.units) {
      for (const lesson of unit.lessons) {
        for (const step of lesson.steps) {
          if (step.type === 'exercise') collect(track.id, step.exercise);
        }
      }
      for (const exercise of unit.checkpoint?.exercises ?? []) collect(track.id, exercise);
    }
  }
  return out;
}

describe('value comparison', () => {
  it('treats close floats as equal', () => {
    expect(valuesEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(valuesEqual(1e9 + 0.0000001, 1e9)).toBe(true);
  });

  it('does not treat genuinely different numbers as equal', () => {
    expect(valuesEqual(1, 1.001)).toBe(false);
    expect(valuesEqual(0, 1e-6)).toBe(false);
  });

  it('compares arrays and objects structurally', () => {
    expect(valuesEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(valuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('distinguishes NaN, null and undefined', () => {
    expect(valuesEqual(NaN, NaN)).toBe(true);
    expect(valuesEqual(null, undefined)).toBe(false);
    expect(formatValue(undefined)).toBe('undefined');
    expect(formatValue(NaN)).toBe('NaN');
  });
});

describe('the harness', () => {
  const exercise: CodeWriteExercise = {
    id: 'test-cw',
    kind: 'code-write',
    language: 'javascript',
    prompt: 'Double it.',
    functionName: 'double',
    starter: 'function double(n) {\n}',
    tests: [
      { args: [2], expected: 4 },
      { args: [5], expected: 10 },
    ],
    hiddenTests: [{ args: [-3], expected: -6 }],
    solution: 'function double(n) { return n * 2; }',
    skillIds: [],
    explanation: '',
  };

  it('passes a correct solution including the hidden case', async () => {
    const run = await runCodeExercise(exercise, exercise.solution, evaluate);
    expect(run.allPassed).toBe(true);
    expect(run.passed).toBe(3);
  });

  it('does not run hidden cases until the visible ones pass', async () => {
    const run = await runCodeExercise(
      exercise,
      'function double(n) { return n === 2 ? 4 : 0; }',
      evaluate,
    );
    expect(run.allPassed).toBe(false);
    expect(run.results.every((r) => !r.hidden)).toBe(true);
  });

  it('catches a submission that special-cases the visible inputs', async () => {
    const run = await runCodeExercise(
      exercise,
      'function double(n) { if (n === 2) return 4; if (n === 5) return 10; return 0; }',
      evaluate,
    );
    expect(run.allPassed).toBe(false);
    expect(run.results.some((r) => r.hidden && !r.passed)).toBe(true);
  });

  it('reports a thrown error rather than crashing', async () => {
    const run = await runCodeExercise(exercise, 'function double(n) { throw new Error("nope"); }', evaluate);
    expect(run.allPassed).toBe(false);
    expect(run.results[0]?.error).toContain('nope');
  });

  it('reports a missing function by name', async () => {
    const run = await runCodeExercise(exercise, 'const x = 1;', evaluate);
    expect(run.results[0]?.error).toContain('double');
  });

  it('labels a case from its call and expected value', () => {
    expect(caseLabel('sum', { args: [[1, 2]], expected: 3 })).toBe('sum([1,2]) → 3');
    expect(caseLabel('sum', { args: [], expected: 0, label: 'empty' })).toBe('empty');
  });
});

describe('grading a code submission', () => {
  const exercise: CodeWriteExercise = {
    id: 'g',
    kind: 'code-write',
    language: 'javascript',
    prompt: '',
    functionName: 'f',
    starter: 'function f() {}',
    tests: [{ args: [], expected: 1 }],
    solution: 'function f() { return 1; }',
    skillIds: [],
    explanation: '',
  };

  it('is correct only when every case passes', () => {
    expect(grade(exercise, { kind: 'code', source: '', passed: 4, total: 4 }).correct).toBe(true);
    expect(grade(exercise, { kind: 'code', source: '', passed: 3, total: 4 }).correct).toBe(false);
  });

  it('gives partial credit proportional to cases passing', () => {
    expect(grade(exercise, { kind: 'code', source: '', passed: 3, total: 4 }).score).toBeCloseTo(0.75);
  });

  it('rejects a response of the wrong shape', () => {
    expect(grade(exercise, { kind: 'choice', index: 0 }).correct).toBe(false);
  });
});

describe('authored content', () => {
  const exercises = allCodeExercises();

  it('has code-write exercises to check', () => {
    expect(exercises.length).toBeGreaterThan(0);
  });

  it('every worked solution passes every one of its own cases', async () => {
    const failures: string[] = [];
    for (const { trackId, exercise } of exercises) {
      const run = await runCodeExercise(exercise, exercise.solution, evaluate);
      if (!run.allPassed) {
        const bad = run.results.filter((r) => !r.passed);
        failures.push(
          `${trackId}/${exercise.functionName}: ${bad
            .map((r) => r.error ?? `${r.label} got ${r.actual}`)
            .join('; ')}`,
        );
      }
    }
    expect(failures).toEqual([]);
  });

  it('every starter template fails at least one case', async () => {
    // A starter that already passes is a giveaway, and usually means the
    // solution was pasted into the wrong field.
    const giveaways: string[] = [];
    for (const { trackId, exercise } of exercises) {
      const run = await runCodeExercise(exercise, exercise.starter, evaluate);
      if (run.allPassed) giveaways.push(`${trackId}/${exercise.functionName}`);
    }
    expect(giveaways).toEqual([]);
  });

  it('counts hidden cases in the total', () => {
    for (const { exercise } of exercises) {
      expect(totalCases(exercise)).toBe(
        exercise.tests.length + (exercise.hiddenTests?.length ?? 0),
      );
    }
  });
});
