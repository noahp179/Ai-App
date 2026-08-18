/**
 * Adaptive placement test.
 *
 * A short (12-question) adaptive quiz that decides where a new learner starts,
 * so an experienced practitioner is not made to sit through "what is AI?" and a
 * beginner is not dropped into attention math.
 *
 * The procedure is a simple one-parameter ladder rather than full IRT: start at
 * intermediate, step up on a correct answer and down on a wrong one, and place
 * by where the learner spent most of the test. That is accurate enough for a
 * starting point that the learner can override, and it is explainable — which
 * matters more here than squeezing out the last few percent of precision.
 */

import type { Domain, Exercise, Level } from '../domain/types.js';
import { LEVELS, LEVEL_ORDER } from '../domain/types.js';
import { grade, type Response } from './grading.js';

export interface PlacementQuestion {
  exercise: Exercise;
  level: Level;
  domain: Domain;
}

export interface PlacementState {
  /** Index into LEVELS for the next question to serve. */
  currentLevelIndex: number;
  asked: PlacementQuestion[];
  results: Array<{ level: Level; domain: Domain; correct: boolean }>;
  finished: boolean;
}

export const PLACEMENT_LENGTH = 12;

export function startPlacement(): PlacementState {
  return {
    currentLevelIndex: LEVEL_ORDER.intermediate,
    asked: [],
    results: [],
    finished: false,
  };
}

/**
 * Picks the next question: the right difficulty, and the domain the test has
 * sampled least so far, so the result reflects breadth rather than one topic.
 */
export function nextQuestion(
  state: PlacementState,
  pool: PlacementQuestion[],
): PlacementQuestion | null {
  if (state.finished || state.asked.length >= PLACEMENT_LENGTH) return null;

  const askedIds = new Set(state.asked.map((q) => q.exercise.id));
  const domainCounts = new Map<Domain, number>();
  for (const q of state.asked) {
    domainCounts.set(q.domain, (domainCounts.get(q.domain) ?? 0) + 1);
  }

  const targetLevel = LEVELS[state.currentLevelIndex] ?? 'intermediate';

  const candidates = pool.filter((q) => !askedIds.has(q.exercise.id));
  if (candidates.length === 0) return null;

  const atLevel = candidates.filter((q) => q.level === targetLevel);
  const searchSpace = atLevel.length > 0 ? atLevel : candidates;

  // Prefer the least-sampled domain; ties break by pool order for determinism.
  let best = searchSpace[0]!;
  let bestCount = domainCounts.get(best.domain) ?? 0;
  for (const q of searchSpace) {
    const count = domainCounts.get(q.domain) ?? 0;
    if (count < bestCount) {
      best = q;
      bestCount = count;
    }
  }
  return best;
}

/** Records an answer and moves the difficulty ladder. */
export function submitPlacementAnswer(
  state: PlacementState,
  question: PlacementQuestion,
  response: Response,
): PlacementState {
  const { correct } = grade(question.exercise, response);

  const nextIndex = correct
    ? Math.min(LEVELS.length - 1, state.currentLevelIndex + 1)
    : Math.max(0, state.currentLevelIndex - 1);

  const asked = [...state.asked, question];

  return {
    currentLevelIndex: nextIndex,
    asked,
    results: [...state.results, { level: question.level, domain: question.domain, correct }],
    finished: asked.length >= PLACEMENT_LENGTH,
  };
}

export interface PlacementResult {
  level: Level;
  /** 0–1 confidence in the placement. Low confidence prompts a re-test offer. */
  confidence: number;
  /** Per-domain accuracy, used to seed the skill radar and recommend tracks. */
  domainScores: Partial<Record<Domain, number>>;
  correctCount: number;
  totalCount: number;
}

/**
 * Scores a finished (or abandoned) placement test.
 *
 * Placement is the highest level at which the learner answered at least 60% of
 * questions correctly, defaulting to intro. Confidence is the margin of that
 * decision — a learner right at the boundary gets offered a re-test.
 */
export function scorePlacement(state: PlacementState): PlacementResult {
  const total = state.results.length;
  if (total === 0) {
    return { level: 'intro', confidence: 0, domainScores: {}, correctCount: 0, totalCount: 0 };
  }

  const byLevel = new Map<Level, { correct: number; total: number }>();
  const byDomain = new Map<Domain, { correct: number; total: number }>();

  for (const r of state.results) {
    const l = byLevel.get(r.level) ?? { correct: 0, total: 0 };
    l.total += 1;
    if (r.correct) l.correct += 1;
    byLevel.set(r.level, l);

    const d = byDomain.get(r.domain) ?? { correct: 0, total: 0 };
    d.total += 1;
    if (r.correct) d.correct += 1;
    byDomain.set(r.domain, d);
  }

  let level: Level = 'intro';
  let margin = 0;
  for (const candidate of LEVELS) {
    const stats = byLevel.get(candidate);
    if (!stats || stats.total === 0) continue;
    const accuracy = stats.correct / stats.total;
    if (accuracy >= 0.6) {
      level = candidate;
      margin = accuracy - 0.6;
    }
  }

  const domainScores: Partial<Record<Domain, number>> = {};
  for (const [domain, stats] of byDomain) {
    domainScores[domain] = stats.correct / stats.total;
  }

  const coverage = Math.min(1, total / PLACEMENT_LENGTH);
  const confidence = Math.min(1, coverage * (0.55 + margin * 1.5));
  const correctCount = state.results.filter((r) => r.correct).length;

  return { level, confidence, domainScores, correctCount, totalCount: total };
}
