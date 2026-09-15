/**
 * Executing a learner's code.
 *
 * Core owns the test harness; this owns the dangerous part. Two things have to
 * be true for running arbitrary submitted code to be acceptable here:
 *
 * 1. **It must not be able to hang the app.** A beginner writing their first
 *    `while` loop will write an infinite one, and that is a normal part of
 *    learning rather than an edge case. On web the submission runs inside a
 *    Worker that is `terminate()`d after a deadline, which is the only way to
 *    interrupt runaway synchronous JavaScript.
 *
 * 2. **It must not reach anything.** The worker is created from a blob, so it
 *    has no module scope of ours. `fetch`, `XMLHttpRequest` and `importScripts`
 *    are deleted inside it before the submission is evaluated. This is not a
 *    security boundary in the hostile-input sense — the code came from the
 *    person running it, on their own device — it is there so a copied-in
 *    snippet cannot quietly do something surprising.
 *
 * Where no Worker exists (a native build on Hermes) the submission is run
 * directly and the deadline cannot be enforced. `canRunCode` reports which
 * situation the app is in so the UI can say so rather than appearing broken.
 */

import type { Evaluator } from '@synapse/core';

/** How long one call may take before the worker is killed. */
const DEADLINE_MS = 2000;

/**
 * The worker body, as source.
 *
 * Written as a string rather than a separate file because a bundled worker
 * entry point is an extra build configuration per platform, and this is eight
 * lines of logic.
 */
const WORKER_SOURCE = `
self.fetch = undefined;
self.XMLHttpRequest = undefined;
self.importScripts = undefined;
self.WebSocket = undefined;
self.onmessage = function (event) {
  var payload = event.data;
  try {
    var factory = new Function(
      payload.source + '\\n;return typeof ' + payload.name + " === 'function' ? " +
        payload.name + ' : undefined;'
    );
    var fn = factory();
    if (typeof fn !== 'function') {
      self.postMessage({ ok: false, error: 'No function named ' + payload.name + ' was defined.' });
      return;
    }
    var result = fn.apply(null, payload.args);
    self.postMessage({ ok: true, result: result });
  } catch (error) {
    self.postMessage({ ok: false, error: (error && error.message) || String(error) });
  }
};
`;

type WorkerMessage =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

/** Whether submissions can be executed at all on this platform. */
export function canRunCode(): boolean {
  if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') return true;
  try {
    // eslint-disable-next-line no-new-func
    new Function('return 1');
    return true;
  } catch {
    return false;
  }
}

/** Whether a runaway loop will actually be stopped, or merely hang. */
export function canEnforceDeadline(): boolean {
  return typeof Worker !== 'undefined' && typeof Blob !== 'undefined';
}

/**
 * Runs one call in a worker, killing it if it overruns.
 *
 * A fresh worker per call is deliberate. Reusing one would be faster, but a
 * submission that mutates globals or leaves a timer running would then affect
 * the next case, and a test suite whose results depend on order is worse than
 * a slow one.
 */
function runInWorker(
  source: string,
  functionName: string,
  args: readonly unknown[],
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    let settled = false;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            `Timed out after ${DEADLINE_MS} ms — check for a loop that never ends.`,
          ),
        ),
      );
    }, DEADLINE_MS);

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;
      finish(() => (data.ok ? resolve(data.result) : reject(new Error(data.error))));
    };

    worker.onerror = (event: ErrorEvent) => {
      finish(() => reject(new Error(event.message || 'The code could not be loaded.')));
    };

    // Structured clone rejects functions and symbols; arguments in content are
    // always plain data, so a failure here is a bug in the exercise, not in the
    // submission — say so rather than reporting it as a failed case.
    try {
      worker.postMessage({ source, name: functionName, args });
    } catch {
      finish(() => reject(new Error('This exercise has an argument that cannot be sent.')));
    }
  });
}

/** Direct execution, for platforms without Worker. No deadline is possible. */
async function runDirect(
  source: string,
  functionName: string,
  args: readonly unknown[],
): Promise<unknown> {
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    `${source}\n;return typeof ${functionName} === 'function' ? ${functionName} : undefined;`,
  );
  const fn = factory() as ((...a: unknown[]) => unknown) | undefined;
  if (typeof fn !== 'function') {
    throw new Error(`No function named ${functionName} was defined.`);
  }
  return fn(...args);
}

/** The evaluator to hand to `runCodeExercise`. */
export const evaluate: Evaluator = async (source, functionName, args) => {
  if (canEnforceDeadline()) return runInWorker(source, functionName, args);
  return runDirect(source, functionName, args);
};
