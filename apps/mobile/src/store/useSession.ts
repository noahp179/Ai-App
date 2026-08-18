/**
 * The active lesson session.
 *
 * Wraps `SessionRunner` from core and republishes its snapshot. Components read
 * this store; nothing in here decides session rules, which stay in core.
 */

import { create } from 'zustand';
import {
  SessionRunner,
  grade,
  type Exercise,
  type GradeResult,
  type Level,
  type Response,
  type SessionMode,
  type SessionSnapshot,
  type Step,
} from '@synapse/core';

export interface SessionStore {
  runner: SessionRunner | null;
  snapshot: SessionSnapshot | null;

  /** Set once an answer is submitted, cleared on advance. Drives the feedback sheet. */
  lastResult: GradeResult | null;
  /** The learner's in-progress response for the current step. */
  draft: Response | null;
  hintRevealed: boolean;

  /** Metadata for the completion screen. */
  context: { lessonId?: string; checkpointId?: string; level: Level; mode: SessionMode } | null;
  startedAt: number;

  start: (params: {
    steps: Step[];
    level: Level;
    mode: SessionMode;
    hearts: number | null;
    requeueMistakes?: boolean;
    lessonId?: string;
    checkpointId?: string;
  }) => void;

  setDraft: (draft: Response | null) => void;
  revealHint: () => void;
  submit: () => GradeResult | null;
  advance: () => void;
  refillHearts: (to: number | null) => void;
  end: () => void;
}

export const useSession = create<SessionStore>((set, get) => ({
  runner: null,
  snapshot: null,
  lastResult: null,
  draft: null,
  hintRevealed: false,
  context: null,
  startedAt: 0,

  start: ({ steps, level, mode, hearts, requeueMistakes = true, lessonId, checkpointId }) => {
    const runner = new SessionRunner({ mode, level, steps, hearts, requeueMistakes });
    set({
      runner,
      snapshot: runner.snapshot(),
      lastResult: null,
      draft: null,
      hintRevealed: false,
      context: { lessonId, checkpointId, level, mode },
      startedAt: Date.now(),
    });
  },

  setDraft: (draft) => set({ draft }),

  revealHint: () => {
    get().runner?.useHint();
    set({ hintRevealed: true });
  },

  submit: () => {
    const { runner, draft } = get();
    if (!runner || !draft) return null;

    const result = runner.submit(draft);
    set({ lastResult: result, snapshot: runner.snapshot() });
    return result;
  },

  advance: () => {
    const { runner } = get();
    if (!runner) return;
    const snapshot = runner.advance();
    set({ snapshot, lastResult: null, draft: null, hintRevealed: false });
  },

  refillHearts: (to) => {
    const { runner } = get();
    if (!runner) return;
    runner.refillHearts(to);
    set({ snapshot: runner.snapshot() });
  },

  end: () =>
    set({
      runner: null,
      snapshot: null,
      lastResult: null,
      draft: null,
      hintRevealed: false,
      context: null,
      startedAt: 0,
    }),
}));

/** Grades a response without touching session state — for preview and tests. */
export function previewGrade(exercise: Exercise, response: Response): GradeResult {
  return grade(exercise, response);
}
