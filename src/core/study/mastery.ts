import type { Difficulty, Evidence, Gap, MasteryRecord, MasteryStatus } from '../../shared/study/types';

/**
 * The mastery model, kept as plain functions so it can be explained and tested. It looks at the most recent
 * answers for one curriculum expectation and weighs them by how hard they were, whether hints were used, how
 * much the marking can be trusted, and how long ago they happened. The resulting estimate is a weighted share of
 * recent evidence — not a probability and not an Ontario achievement level.
 */

export interface MasteryConfig {
  /** Estimate needed (with enough independent evidence) for "proficient". */
  proficientThreshold: number;
  /** Correct answers without hints needed for "proficient". */
  minIndependentCorrect: number;
  /** Evidence loses half its weight after this many days. */
  halfLifeDays: number;
  /** How many recent answers count. */
  window: number;
}

export const DEFAULT_MASTERY: MasteryConfig = { proficientThreshold: 0.8, minIndependentCorrect: 3, halfLifeDays: 30, window: 12 };

const DIFFICULTY_WEIGHT: Record<Difficulty, number> = { 1: 0.6, 2: 1, 3: 1.2, 4: 1.3 };
/** A correct answer reached with hints counts for this share of an independent one. */
export const ASSISTED_CREDIT = 0.6;
const DAY = 86_400_000;

export interface ReviewState {
  intervalDays: number;
  ease: number;
}

export function computeMastery(
  expectationId: string,
  evidence: Evidence[],
  now: Date,
  cfg: MasteryConfig = DEFAULT_MASTERY,
  review: { nextReviewAt: string | null; intervalDays: number } = { nextReviewAt: null, intervalDays: 0 },
): MasteryRecord {
  const sorted = [...evidence].sort((a, b) => a.at.localeCompare(b.at));
  const recent = sorted.slice(-cfg.window);
  const base: MasteryRecord = {
    expectationId,
    status: 'not_assessed',
    estimate: 0,
    evidenceCount: sorted.length,
    independentCorrect: 0,
    assistedCorrect: 0,
    incorrect: 0,
    lastPracticedAt: sorted.at(-1)?.at ?? null,
    lastIndependentSuccessAt: null,
    nextReviewAt: review.nextReviewAt,
    reviewIntervalDays: review.intervalDays,
    misconceptions: {},
    reasons: [],
    updatedAt: now.toISOString(),
  };
  const counted = recent.filter((e) => e.weight > 0);
  if (!counted.length) {
    base.reasons = sorted.length ? ['Only self-assessed or unmarked answers so far; they do not count as evidence.'] : ['No answers yet.'];
    return base;
  }

  let wsum = 0;
  let total = 0;
  for (const e of counted) {
    const age = Math.max(0, (now.getTime() - new Date(e.at).getTime()) / DAY);
    const w = e.weight * DIFFICULTY_WEIGHT[e.difficulty] * 0.5 ** (age / cfg.halfLifeDays);
    const credit = e.correct ? (e.hinted ? ASSISTED_CREDIT : 1) * Math.max(e.score, 1) : e.score * (e.hinted ? ASSISTED_CREDIT : 1);
    wsum += w;
    total += w * Math.min(1, credit);
    if (e.misconception) base.misconceptions[e.misconception] = (base.misconceptions[e.misconception] ?? 0) + 1;
  }
  const estimate = wsum ? total / wsum : 0;
  const independent = counted.filter((e) => e.correct && !e.hinted && e.weight >= 0.5);
  const assisted = counted.filter((e) => e.correct && e.hinted);
  /** Right without hints, but on questions whose answer key was not checked by code (they count for less). */
  const unverified = counted.filter((e) => e.correct && !e.hinted && e.weight < 0.5);
  const incorrect = counted.filter((e) => !e.correct);
  const days = new Set(independent.map((e) => e.at.slice(0, 10)));
  const coreOrHarder = independent.some((e) => e.difficulty >= 2);
  const hardIndependent = independent.some((e) => e.difficulty >= 3);
  base.estimate = Math.round(estimate * 1000) / 1000;
  base.independentCorrect = independent.length;
  base.assistedCorrect = assisted.length;
  base.incorrect = incorrect.length;
  base.lastIndependentSuccessAt = [...sorted].reverse().find((e) => e.correct && !e.hinted && e.weight >= 0.5)?.at ?? null;

  let status: MasteryStatus;
  const reasons = [
    `Based on your last ${counted.length} answer${counted.length === 1 ? '' : 's'}: ${independent.length} right without hints, ${assisted.length} right with hints, ${incorrect.length} not yet right.`,
    ...(unverified.length ? [`${unverified.length} right on AI-written questions, which count for less because their answers aren’t checked by FlowCompanion.`] : []),
  ];
  if (!independent.length && !assisted.length && !unverified.length) {
    status = 'not_yet';
    reasons.push('No correct answers yet.');
  } else if (estimate < 0.5) {
    status = 'in_progress';
    reasons.push('Fewer than half of your recent answers were right.');
  } else if (estimate < cfg.proficientThreshold || independent.length < cfg.minIndependentCorrect || !coreOrHarder) {
    status = 'developing';
    if (independent.length < cfg.minIndependentCorrect) reasons.push(`Proficient needs at least ${cfg.minIndependentCorrect} correct answers without hints.`);
    if (!coreOrHarder) reasons.push('So far only warm-up questions have been answered without hints.');
    if (estimate < cfg.proficientThreshold) reasons.push(`Your recent answers come to ${Math.round(estimate * 100)}%; proficient needs ${Math.round(cfg.proficientThreshold * 100)}%.`);
  } else if (estimate >= 0.9 && hardIndependent && independent.length >= cfg.minIndependentCorrect + 1 && days.size >= 2) {
    status = 'extension_ready';
    reasons.push('Strong, independent results including harder questions on more than one day.');
  } else {
    status = 'proficient';
    reasons.push('Enough correct answers without hints, at grade level.');
  }
  if ((status === 'proficient' || status === 'extension_ready') && review.nextReviewAt && new Date(review.nextReviewAt) <= now) {
    status = 'review';
    reasons.push('It is time to review this so it stays fresh.');
  }
  const last = counted.at(-1)!;
  if ((status === 'proficient' || status === 'extension_ready') && !last.correct) {
    status = 'developing';
    reasons.push('Your most recent answer was not right, so this is back to developing until you get it again.');
  }
  base.status = status;
  base.reasons = reasons;
  return base;
}

/**
 * Spaced review after an activity. Good independent results stretch the gap before the next review; weak
 * results bring it back to tomorrow. A due date (e.g. a test) caps the gap so a review happens before it.
 */
export function nextReview(prev: ReviewState, independentShare: number, now: Date, dueBy: Date | null = null): ReviewState & { nextReviewAt: string } {
  let { intervalDays, ease } = prev;
  if (independentShare >= 0.8) {
    intervalDays = intervalDays <= 0 ? 1 : intervalDays === 1 ? 3 : Math.round(intervalDays * ease);
    ease = Math.min(2.8, ease + 0.1);
  } else if (independentShare >= 0.5) {
    intervalDays = Math.max(1, intervalDays);
    ease = Math.max(1.3, ease - 0.05);
  } else {
    intervalDays = 1;
    ease = Math.max(1.3, ease - 0.2);
  }
  intervalDays = Math.min(intervalDays, 120);
  let at = new Date(now.getTime() + intervalDays * DAY);
  if (dueBy && at > dueBy) {
    const before = new Date(Math.max(now.getTime() + DAY / 2, dueBy.getTime() - DAY));
    at = before;
    intervalDays = Math.max(1, Math.round((at.getTime() - now.getTime()) / DAY));
  }
  return { intervalDays, ease, nextReviewAt: at.toISOString() };
}

/**
 * Picks the difficulty for the next question. It never changes after a single wrong answer: two independent
 * correct answers in a row at the current level move up, and two wrong answers among the last three move down.
 */
export function adaptDifficulty(current: Difficulty, history: { correct: boolean | null; hinted: boolean; difficulty: Difficulty }[], allowed: Difficulty[] = [1, 2, 3, 4]): { difficulty: Difficulty; reason: string } {
  const atLevel = history.filter((h) => h.difficulty === current && h.correct !== null);
  const last2 = atLevel.slice(-2);
  const last3 = atLevel.slice(-3);
  const up = allowed.filter((d) => d > current)[0];
  const down = [...allowed].reverse().find((d) => d < current);
  if (last2.length === 2 && last2.every((h) => h.correct && !h.hinted) && up) return { difficulty: up, reason: 'Two right in a row without hints, so the next question is a little harder.' };
  if (last3.filter((h) => !h.correct).length >= 2 && down) return { difficulty: down, reason: 'Two of the last three were not right, so the next question steps back to build the idea up.' };
  return { difficulty: current, reason: 'Staying at this level for now.' };
}

/** Where to start, from what the student has already shown. */
export function startingDifficulty(status: MasteryStatus, allowed: Difficulty[] = [1, 2, 3, 4], prerequisiteGap = false): Difficulty {
  const want: Difficulty = prerequisiteGap ? 1 : status === 'extension_ready' ? 4 : status === 'proficient' || status === 'review' ? 3 : status === 'developing' ? 2 : status === 'in_progress' ? 2 : 2;
  return allowed.includes(want) ? want : allowed.reduce((b, d) => (Math.abs(d - want) < Math.abs(b - want) ? d : b), allowed[0]!);
}

/** Knowledge-gap signals for one expectation. Never a diagnosis: only patterns in the answers. */
export function detectGaps(expectationId: string, evidence: Evidence[], record: MasteryRecord, now: Date): Gap[] {
  const gaps: Gap[] = [];
  const recent = [...evidence].sort((a, b) => a.at.localeCompare(b.at)).filter((e) => e.weight > 0).slice(-10);
  const counts = new Map<string, number>();
  for (const e of recent.slice(-6)) if (e.misconception && !e.correct) counts.set(e.misconception, (counts.get(e.misconception) ?? 0) + 1);
  for (const [m, n] of counts) if (n >= 2) gaps.push({ kind: 'repeated_error', expectationId, misconception: m, relatedExpectationId: null, detail: `The same mistake came up ${n} times recently.` });
  const rec = recent.filter((e) => e.cognitive === 'recognition');
  const app = recent.filter((e) => e.cognitive !== 'recognition');
  const share = (xs: Evidence[]) => xs.filter((e) => e.correct && !e.hinted).length / xs.length;
  if (rec.length >= 2 && app.length >= 2 && share(rec) >= 0.75 && share(app) <= 0.5) {
    gaps.push({ kind: 'recognition_not_application', expectationId, misconception: null, relatedExpectationId: null, detail: `Choosing the right answer goes well (${Math.round(share(rec) * 100)}%), working it out is harder (${Math.round(share(app) * 100)}%).` });
  }
  const assisted = recent.filter((e) => e.correct && e.hinted).length;
  const independent = recent.filter((e) => e.correct && !e.hinted).length;
  if (assisted >= 3 && independent < assisted / 2) gaps.push({ kind: 'hint_dependence', expectationId, misconception: null, relatedExpectationId: null, detail: `${assisted} recent answers were right with hints, ${independent} without.` });
  if (record.lastIndependentSuccessAt && record.independentCorrect >= 2) {
    const daysSince = (now.getTime() - new Date(record.lastPracticedAt ?? record.lastIndependentSuccessAt).getTime()) / DAY;
    if (daysSince > 30 && record.nextReviewAt && new Date(record.nextReviewAt) < now) gaps.push({ kind: 'decay', expectationId, misconception: null, relatedExpectationId: null, detail: `Last practised ${Math.round(daysSince)} days ago.` });
  }
  return gaps;
}
