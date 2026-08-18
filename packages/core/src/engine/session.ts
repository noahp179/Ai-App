/**
 * Session assembly and playback.
 *
 * Two things live here:
 *
 *  1. `buildReviewSession` — assembles a mixed-review session from whatever is
 *     due in the scheduler, drawing the actual exercises from the catalog.
 *  2. `SessionRunner` — a small state machine that plays any ordered list of
 *     steps, tracking attempts, hearts, and elapsed time. The UI is a thin
 *     rendering layer over this; all session rules live here so they are
 *     testable without mounting a component.
 */

import type {
  AttemptRecord,
  Exercise,
  Lesson,
  Level,
  SkillId,
  SkillState,
  Step,
} from '../domain/types';
import { grade, type GradeResult, type Response } from './grading';
import { dueSkills, retention } from './scheduler';

// ---------------------------------------------------------------------------
// Review session assembly
// ---------------------------------------------------------------------------

export interface ReviewSessionOptions {
  /** Hard cap on exercises in the session. */
  maxItems?: number;
  now?: number;
}

/**
 * Picks exercises to review, prioritizing skills whose estimated retention has
 * decayed furthest. Skills with no exercise in the catalog are skipped rather
 * than blocking the queue.
 */
export function buildReviewSession(
  states: Record<SkillId, SkillState>,
  exercisesBySkill: Map<SkillId, Exercise[]>,
  options: ReviewSessionOptions = {},
): Exercise[] {
  const { maxItems = 15, now = Date.now() } = options;

  const due = dueSkills(states, now)
    .map((s) => ({ state: s, retention: retention(s, now) }))
    .sort((a, b) => a.retention - b.retention);

  const chosen: Exercise[] = [];
  const usedIds = new Set<string>();

  for (const { state } of due) {
    if (chosen.length >= maxItems) break;
    const pool = exercisesBySkill.get(state.skillId);
    if (!pool || pool.length === 0) continue;

    // Rotate through a skill's exercises by review count so the learner does
    // not see the same question every single time the skill comes up.
    const exercise = pool[state.totalReviews % pool.length]!;
    if (usedIds.has(exercise.id)) continue;

    usedIds.add(exercise.id);
    chosen.push(exercise);
  }

  return chosen;
}

// ---------------------------------------------------------------------------
// Session runner
// ---------------------------------------------------------------------------

export type SessionMode = 'lesson' | 'review' | 'checkpoint' | 'placement';

export interface SessionConfig {
  mode: SessionMode;
  level: Level;
  steps: Step[];
  /**
   * Hearts limit mistakes in a session. `null` disables them entirely — which
   * is what Plus subscribers get, and what checkpoint mode uses.
   */
  hearts: number | null;
  /** Wrong answers are re-queued at the end of the session until answered right. */
  requeueMistakes: boolean;
}

export interface SessionSnapshot {
  index: number;
  total: number;
  currentStep: Step | null;
  heartsRemaining: number | null;
  attempts: AttemptRecord[];
  status: 'active' | 'complete' | 'failed';
  /** 0–1 through the session, counting re-queued items. */
  progress: number;
}

/**
 * Plays a session. Not a React thing — the store wraps it and republishes
 * snapshots, which keeps every session rule unit-testable in isolation.
 */
export class SessionRunner {
  private queue: Step[];
  private index = 0;
  private hearts: number | null;
  private readonly attempts: AttemptRecord[] = [];
  private stepStartedAt: number;
  private hintUsed = false;
  private status: SessionSnapshot['status'] = 'active';
  private readonly originalLength: number;

  constructor(
    private readonly config: SessionConfig,
    private readonly now: () => number = Date.now,
  ) {
    this.queue = [...config.steps];
    this.originalLength = config.steps.length;
    this.hearts = config.hearts;
    this.stepStartedAt = this.now();
  }

  snapshot(): SessionSnapshot {
    return {
      index: this.index,
      total: this.queue.length,
      currentStep: this.queue[this.index] ?? null,
      heartsRemaining: this.hearts,
      attempts: [...this.attempts],
      status: this.status,
      progress: this.queue.length === 0 ? 1 : Math.min(1, this.index / this.queue.length),
    };
  }

  /** Marks the current step's hint as revealed, which reduces its XP award. */
  useHint(): void {
    this.hintUsed = true;
  }

  /**
   * Submits an answer for the current exercise step.
   *
   * Returns the grade so the UI can render feedback. Advancing is a separate
   * call (`advance`) so the learner controls when the explanation is dismissed.
   */
  submit(response: Response): GradeResult {
    const step = this.queue[this.index];
    if (!step || step.type !== 'exercise' || this.status !== 'active') {
      return { correct: false, score: 0 };
    }

    const result = grade(step.exercise, response);
    const now = this.now();

    this.attempts.push({
      stepId: step.id,
      skillIds: step.exercise.skillIds,
      outcome: response.kind === 'skipped' ? 'skipped' : result.correct ? 'correct' : 'incorrect',
      durationMs: now - this.stepStartedAt,
      usedHint: this.hintUsed,
      at: now,
    });

    if (!result.correct) {
      if (this.hearts !== null) {
        this.hearts -= 1;
        if (this.hearts <= 0) this.status = 'failed';
      }
      if (this.config.requeueMistakes && this.status === 'active') {
        this.queue.push(step);
      }
    }

    return result;
  }

  /** Moves to the next step. Concept and interactive steps advance directly. */
  advance(): SessionSnapshot {
    if (this.status !== 'active') return this.snapshot();

    this.index += 1;
    this.hintUsed = false;
    this.stepStartedAt = this.now();

    if (this.index >= this.queue.length) {
      this.status = 'complete';
      this.index = this.queue.length;
    }
    return this.snapshot();
  }

  /** Refills hearts mid-session (a rewarded ad, a Plus upgrade, or a gem spend). */
  refillHearts(to: number | null): void {
    this.hearts = to;
    if (this.status === 'failed' && (to === null || to > 0)) {
      this.status = 'active';
    }
  }

  /** Distinct steps answered correctly over distinct steps attempted. */
  accuracy(): number {
    const final = new Map<string, AttemptRecord>();
    for (const a of this.attempts) final.set(a.stepId, a);
    if (final.size === 0) return 0;
    let correct = 0;
    for (const a of final.values()) if (a.outcome === 'correct') correct += 1;
    return correct / final.size;
  }

  getAttempts(): AttemptRecord[] {
    return [...this.attempts];
  }

  getConfig(): SessionConfig {
    return this.config;
  }

  /** Steps in the original lesson, ignoring re-queued mistakes. */
  getOriginalLength(): number {
    return this.originalLength;
  }
}

/** Builds a runner for a catalog lesson, applying the learner's entitlements. */
export function lessonSession(
  lesson: Lesson,
  opts: { unlimitedHearts: boolean; hearts?: number } = { unlimitedHearts: false },
): SessionRunner {
  return new SessionRunner({
    mode: 'lesson',
    level: lesson.level,
    steps: lesson.steps,
    hearts: opts.unlimitedHearts ? null : (opts.hearts ?? 5),
    requeueMistakes: true,
  });
}
