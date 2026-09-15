/**
 * The test harness for `code-write` exercises.
 *
 * Core owns *what* it means for a submission to pass — which cases run, in
 * what order, how values are compared, how a failure is described. It
 * deliberately does not own *how* the code is executed, because that differs
 * per platform: a web build can run the submission in a terminable worker, a
 * native build cannot. Platforms supply an `Evaluator` and get the same
 * grading behaviour everywhere.
 *
 * The visible/hidden split matters pedagogically. Visible cases make the task
 * unambiguous; hidden cases run only once the visible ones pass, which is what
 * stops `if (n === 3) return 2` from being a solution.
 */

import type { CodeCase, CodeWriteExercise } from '../domain/types';

/**
 * Runs one call of the learner's function.
 *
 * Implementations must reject rather than throw synchronously, and must impose
 * their own time limit — the harness has no way to interrupt a runaway loop.
 */
export type Evaluator = (
  source: string,
  functionName: string,
  args: readonly unknown[],
) => Promise<unknown>;

export interface CaseResult {
  label: string;
  passed: boolean;
  /** The value the submission returned, formatted. Absent when it threw. */
  actual?: string;
  expected: string;
  /** The error message, when the submission threw or timed out. */
  error?: string;
  hidden: boolean;
}

export interface CodeRunResult {
  results: CaseResult[];
  passed: number;
  total: number;
  allPassed: boolean;
  /** Set when the submission failed to load at all — a syntax error, usually. */
  fatal?: string;
}

/** How many cases run before the harness stops, so one bad submission is not 40 timeouts. */
const MAX_FAILURES_BEFORE_STOP = 3;

/**
 * Formats a value the way the results table should show it.
 *
 * Deliberately not `JSON.stringify` alone: `undefined`, `NaN` and functions all
 * stringify to something unhelpful or vanish entirely, and those are exactly
 * the values a wrong answer tends to produce.
 */
export function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
    return String(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'function') return '[function]';
  if (typeof value === 'bigint') return `${value.toString()}n`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Structural equality, with the numeric tolerance that floating point forces.
 *
 * `0.1 + 0.2 === 0.3` is false, and an exercise that asked for an average
 * should not fail on it — that is the lesson from the architecture track, not
 * a mistake by the learner.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    const scale = Math.max(1, Math.abs(a), Math.abs(b));
    return Math.abs(a - b) <= 1e-9 * scale;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => valuesEqual(x, b[i]));
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as Record<string, unknown>).sort();
    const kb = Object.keys(b as Record<string, unknown>).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) =>
      valuesEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }

  return false;
}

/** `sum([1, 2], 3) → 6` — the default label when a case does not supply one. */
export function caseLabel(functionName: string, testCase: CodeCase): string {
  if (testCase.label) return testCase.label;
  const args = testCase.args.map(formatValue).join(', ');
  return `${functionName}(${args}) → ${formatValue(testCase.expected)}`;
}

/**
 * Runs a submission against an exercise.
 *
 * Stops early after a few failures: once three cases have failed there is
 * nothing more to learn from the fourth, and every additional run costs a
 * worker round trip (or, on a runaway loop, a full timeout).
 */
export async function runCodeExercise(
  exercise: CodeWriteExercise,
  source: string,
  evaluate: Evaluator,
): Promise<CodeRunResult> {
  const visible = exercise.tests.map((t) => ({ test: t, hidden: false }));
  const hidden = (exercise.hiddenTests ?? []).map((t) => ({ test: t, hidden: true }));

  const results: CaseResult[] = [];
  let failures = 0;

  const runOne = async (test: CodeCase, isHidden: boolean): Promise<CaseResult> => {
    const label = isHidden ? 'Hidden case' : caseLabel(exercise.functionName, test);
    try {
      const actual = await evaluate(source, exercise.functionName, test.args);
      const passed = valuesEqual(actual, test.expected);
      return {
        label,
        passed,
        actual: formatValue(actual),
        expected: formatValue(test.expected),
        hidden: isHidden,
      };
    } catch (error) {
      return {
        label,
        passed: false,
        expected: formatValue(test.expected),
        error: error instanceof Error ? error.message : String(error),
        hidden: isHidden,
      };
    }
  };

  for (const { test, hidden: isHidden } of visible) {
    const result = await runOne(test, isHidden);
    results.push(result);
    if (!result.passed) {
      failures += 1;
      if (failures >= MAX_FAILURES_BEFORE_STOP) break;
    }
  }

  const visiblePassed = results.length === visible.length && results.every((r) => r.passed);

  // Hidden cases are the check against special-casing, so they only run once
  // the learner has cleared everything they were shown.
  if (visiblePassed) {
    for (const { test, hidden: isHidden } of hidden) {
      const result = await runOne(test, isHidden);
      results.push(result);
      if (!result.passed) {
        failures += 1;
        if (failures >= MAX_FAILURES_BEFORE_STOP) break;
      }
    }
  }

  const total = visible.length + (visiblePassed ? hidden.length : 0);
  const passed = results.filter((r) => r.passed).length;

  return {
    results,
    passed,
    total,
    allPassed: passed === visible.length + hidden.length,
  };
}

/**
 * Counts the cases a submission must satisfy.
 *
 * Used for the progress readout before anything has run, where the hidden
 * cases are worth acknowledging without describing.
 */
export function totalCases(exercise: CodeWriteExercise): number {
  return exercise.tests.length + (exercise.hiddenTests?.length ?? 0);
}
