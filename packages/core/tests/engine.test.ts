import { describe, expect, it } from 'vitest';

import {
  grade,
  gradeShortAnswer,
  type Response,
} from '../src/engine/grading';
import {
  DAY_MS,
  aggregateMastery,
  dueSkills,
  newSkillState,
  retention,
  review,
  toRecall,
} from '../src/engine/scheduler';
import {
  GOAL_PRESETS,
  addXpToGoal,
  dayKey,
  goalMet,
  isStreakBroken,
  levelForXp,
  levelProgress,
  newStreak,
  recordActiveDay,
  scoreSession,
  targetXpForMinutes,
  xpForLevel,
} from '../src/engine/progression';
import { SessionRunner, buildReviewSession } from '../src/engine/session';
import {
  PLACEMENT_LENGTH,
  nextQuestion,
  scorePlacement,
  startPlacement,
  submitPlacementAnswer,
} from '../src/engine/placement';
import { placementPool } from '../src/content/placement-pool';
import type { AttemptRecord, Exercise, Step } from '../src/domain/types';

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

describe('grading', () => {
  const mcqExercise: Exercise = {
    id: 'x1',
    kind: 'multiple-choice',
    prompt: 'p',
    choices: ['a', 'b', 'c'],
    answer: 1,
    skillIds: ['sk-ai-definition'],
    explanation: 'e',
  };

  it('grades multiple choice', () => {
    expect(grade(mcqExercise, { kind: 'choice', index: 1 }).correct).toBe(true);
    expect(grade(mcqExercise, { kind: 'choice', index: 0 }).correct).toBe(false);
  });

  it('treats a mismatched response kind as incorrect rather than throwing', () => {
    const result = grade(mcqExercise, { kind: 'number', value: 1 } as Response);
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
  });

  it('scores skipped answers as zero', () => {
    expect(grade(mcqExercise, { kind: 'skipped' }).score).toBe(0);
  });

  it('gives partial credit on multi-select and penalizes false positives', () => {
    const exercise: Exercise = {
      id: 'x2',
      kind: 'multi-select',
      prompt: 'p',
      choices: ['a', 'b', 'c', 'd'],
      answers: [0, 1],
      skillIds: ['sk-ai-definition'],
      explanation: 'e',
    };

    expect(grade(exercise, { kind: 'choices', indices: [0, 1] }).score).toBe(1);
    // One hit, no false positives → half credit.
    expect(grade(exercise, { kind: 'choices', indices: [0] }).score).toBe(0.5);
    // One hit, one false positive → cancels to zero.
    expect(grade(exercise, { kind: 'choices', indices: [0, 2] }).score).toBe(0);
    // Never negative.
    expect(grade(exercise, { kind: 'choices', indices: [2, 3] }).score).toBe(0);
  });

  it('grades fill-blank case-insensitively with per-blank detail', () => {
    const exercise: Exercise = {
      id: 'x3',
      kind: 'fill-blank',
      template: '___ and ___',
      blanks: [['machine'], ['ai', 'artificial intelligence']],
      skillIds: ['sk-ai-definition'],
      explanation: 'e',
    };

    const result = grade(exercise, { kind: 'text', values: ['MACHINE', 'Artificial Intelligence'] });
    expect(result.correct).toBe(true);
    expect(result.detail).toEqual([true, true]);

    const partial = grade(exercise, { kind: 'text', values: ['machine', 'wrong'] });
    expect(partial.correct).toBe(false);
    expect(partial.score).toBe(0.5);
  });

  it('grades ordering by position', () => {
    const exercise: Exercise = {
      id: 'x4',
      kind: 'order-sequence',
      prompt: 'p',
      items: ['one', 'two', 'three'],
      skillIds: ['sk-ai-definition'],
      explanation: 'e',
    };

    expect(grade(exercise, { kind: 'order', items: ['one', 'two', 'three'] }).correct).toBe(true);
    expect(grade(exercise, { kind: 'order', items: ['two', 'one', 'three'] }).score).toBeCloseTo(1 / 3);
  });

  it('respects numeric tolerance', () => {
    const exercise: Exercise = {
      id: 'x5',
      kind: 'numeric',
      prompt: 'p',
      answer: 75,
      tolerance: 0.5,
      skillIds: ['sk-ai-definition'],
      explanation: 'e',
    };

    expect(grade(exercise, { kind: 'number', value: 75.4 }).correct).toBe(true);
    expect(grade(exercise, { kind: 'number', value: 76 }).correct).toBe(false);
    expect(grade(exercise, { kind: 'number', value: Number.NaN }).correct).toBe(false);
  });

  it('grades categorize with partial credit over the expected items', () => {
    const exercise: Exercise = {
      id: 'x7',
      kind: 'categorize',
      prompt: 'p',
      categories: ['Supervised', 'Unsupervised'],
      items: [
        { item: 'Spam filter', category: 'Supervised' },
        { item: 'Customer segments', category: 'Unsupervised' },
        { item: 'Price prediction', category: 'Supervised' },
      ],
      skillIds: ['sk-ml-paradigms'],
      explanation: 'e',
    };

    const perfect = grade(exercise, {
      kind: 'buckets',
      assignments: [
        { item: 'Spam filter', category: 'Supervised' },
        { item: 'Customer segments', category: 'Unsupervised' },
        { item: 'Price prediction', category: 'Supervised' },
      ],
    });
    expect(perfect.correct).toBe(true);
    expect(perfect.score).toBe(1);

    const partial = grade(exercise, {
      kind: 'buckets',
      assignments: [
        { item: 'Spam filter', category: 'Supervised' },
        { item: 'Customer segments', category: 'Supervised' },
        { item: 'Price prediction', category: 'Supervised' },
      ],
    });
    expect(partial.correct).toBe(false);
    expect(partial.score).toBeCloseTo(2 / 3);
    expect(partial.detail).toEqual([true, false, true]);
  });

  it('penalizes unsorted items rather than ignoring them', () => {
    const exercise: Exercise = {
      id: 'x8',
      kind: 'categorize',
      prompt: 'p',
      categories: ['A', 'B'],
      items: [
        { item: 'one', category: 'A' },
        { item: 'two', category: 'B' },
      ],
      skillIds: ['sk-ml-paradigms'],
      explanation: 'e',
    };

    // Only one of two items placed — scoring is over the expected set.
    const result = grade(exercise, {
      kind: 'buckets',
      assignments: [{ item: 'one', category: 'A' }],
    });
    expect(result.score).toBe(0.5);
    expect(result.correct).toBe(false);
  });

  it('grades categorize case-insensitively', () => {
    const exercise: Exercise = {
      id: 'x9',
      kind: 'categorize',
      prompt: 'p',
      categories: ['Alpha', 'Beta'],
      items: [{ item: 'One', category: 'Alpha' }, { item: 'Two', category: 'Beta' }],
      skillIds: ['sk-ml-paradigms'],
      explanation: 'e',
    };

    const result = grade(exercise, {
      kind: 'buckets',
      assignments: [{ item: 'one', category: 'alpha' }, { item: 'TWO', category: 'BETA' }],
    });
    expect(result.correct).toBe(true);
  });

  it('grades short answers against the rubric with stem tolerance', () => {
    const exercise = {
      id: 'x6',
      kind: 'short-answer' as const,
      prompt: 'p',
      rubricKeywords: ['training data', 'bias', 'patterns'],
      sampleAnswer: 's',
      passThreshold: 0.5,
      skillIds: ['sk-algorithmic-bias'],
      explanation: 'e',
    };

    const good = gradeShortAnswer(
      exercise,
      'The training data contained bias and the model learned those patterns.',
    );
    expect(good.correct).toBe(true);

    const empty = gradeShortAnswer(exercise, 'a');
    expect(empty.correct).toBe(false);
    expect(empty.score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

describe('scheduler', () => {
  const now = 1_700_000_000_000;

  it('starts a new skill due immediately with no history', () => {
    const state = newSkillState('sk-attention', now);
    expect(state.dueAt).toBe(now);
    expect(state.mastery).toBe(0);
    expect(state.totalReviews).toBe(0);
  });

  it('grows the interval on successive good reviews', () => {
    let state = newSkillState('sk-attention', now);
    state = review(state, 'good', now);
    expect(state.intervalDays).toBe(1);

    state = review(state, 'good', now + DAY_MS);
    expect(state.intervalDays).toBe(3);

    const third = review(state, 'good', now + 4 * DAY_MS);
    expect(third.intervalDays).toBeGreaterThan(3);
  });

  it('drops the interval to one day on a lapse without wiping mastery', () => {
    let state = newSkillState('sk-attention', now);
    state = review(state, 'good', now);
    state = review(state, 'good', now + DAY_MS);
    state = review(state, 'good', now + 4 * DAY_MS);
    const masteryBefore = state.mastery;

    const lapsed = review(state, 'again', now + 12 * DAY_MS);
    expect(lapsed.intervalDays).toBe(1);
    expect(lapsed.streak).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.mastery).toBeLessThan(masteryBefore);
    expect(lapsed.mastery).toBeGreaterThan(0);
  });

  it('keeps ease within bounds under repeated lapses', () => {
    let state = newSkillState('sk-attention', now);
    for (let i = 0; i < 40; i += 1) state = review(state, 'again', now + i * DAY_MS);
    expect(state.ease).toBeGreaterThanOrEqual(1.3);

    let easy = newSkillState('sk-other', now);
    for (let i = 0; i < 40; i += 1) easy = review(easy, 'easy', now + i * DAY_MS);
    expect(easy.ease).toBeLessThanOrEqual(2.8);
    expect(easy.intervalDays).toBeLessThanOrEqual(365);
  });

  it('maps score, duration and hints to a recall grade', () => {
    expect(toRecall(0, 5_000, false)).toBe('again');
    expect(toRecall(1, 5_000, true)).toBe('hard');
    expect(toRecall(0.7, 5_000, false)).toBe('hard');
    expect(toRecall(1, 60_000, false)).toBe('hard');
    expect(toRecall(1, 5_000, false)).toBe('easy');
    expect(toRecall(1, 15_000, false)).toBe('good');
  });

  it('returns due skills most-overdue first and excludes unreviewed ones', () => {
    const a = review(newSkillState('a', now), 'good', now - 10 * DAY_MS);
    const b = review(newSkillState('b', now), 'good', now - 2 * DAY_MS);
    const fresh = newSkillState('c', now);

    const due = dueSkills({ a, b, c: fresh }, now);
    expect(due.map((s) => s.skillId)).toEqual(['a', 'b']);
  });

  it('decays retention with elapsed time', () => {
    const state = review(newSkillState('a', now), 'good', now);
    expect(retention(state, now)).toBeCloseTo(1, 2);
    expect(retention(state, now + 5 * DAY_MS)).toBeLessThan(0.1);
    expect(retention(newSkillState('b', now), now)).toBe(0);
  });

  it('averages mastery across skills', () => {
    const states = {
      a: { ...newSkillState('a', now), mastery: 1 },
      b: { ...newSkillState('b', now), mastery: 0 },
    };
    expect(aggregateMastery(states, ['a', 'b'])).toBe(0.5);
    expect(aggregateMastery(states, [])).toBe(0);
    expect(aggregateMastery(states, ['missing'])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

describe('progression', () => {
  const attempt = (
    stepId: string,
    outcome: AttemptRecord['outcome'],
    usedHint = false,
  ): AttemptRecord => ({
    stepId,
    skillIds: ['sk-ai-definition'],
    outcome,
    durationMs: 10_000,
    usedHint,
    at: 0,
  });

  it('awards a perfect bonus and reports full accuracy', () => {
    const result = scoreSession(
      [attempt('a', 'correct'), attempt('b', 'correct')],
      'intro',
    );
    expect(result.perfect).toBe(true);
    expect(result.accuracy).toBe(1);
    expect(result.bonus).toBeGreaterThan(0);
  });

  it('scores a retried step by its final outcome but withholds first-try XP', () => {
    const bothTries = scoreSession(
      [attempt('a', 'incorrect'), attempt('a', 'correct')],
      'intro',
    );
    const firstTry = scoreSession([attempt('a', 'correct')], 'intro');

    expect(bothTries.accuracy).toBe(1);
    expect(bothTries.perfect).toBe(true);
    expect(bothTries.base).toBeLessThan(firstTry.base);
  });

  it('scales XP by level', () => {
    const attempts = [attempt('a', 'correct')];
    const intro = scoreSession(attempts, 'intro').total;
    const expert = scoreSession(attempts, 'expert').total;
    expect(expert).toBeGreaterThan(intro);
  });

  it('gives no lesson-completion bonus for review sessions', () => {
    const result = scoreSession([attempt('a', 'correct')], 'intro', { isReview: true });
    expect(result.bonus).toBe(0);
  });

  it('handles an empty session', () => {
    const result = scoreSession([], 'intro');
    expect(result.accuracy).toBe(0);
    expect(result.perfect).toBe(false);
  });

  it('has a monotonically increasing level curve', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(levelForXp(0)).toBe(1);
    for (let level = 1; level < 20; level += 1) {
      expect(xpForLevel(level + 1)).toBeGreaterThan(xpForLevel(level));
    }
    const progress = levelProgress(xpForLevel(5));
    expect(progress.level).toBe(5);
    expect(progress.fraction).toBe(0);
  });

  it('computes the local day key against a timezone offset', () => {
    // 2023-11-14T22:13:20Z; UTC-8 (offset +480 minutes) is still the 14th.
    expect(dayKey(1_700_000_000_000, 480)).toBe('2023-11-14');
    // UTC+13 (offset -780) has already rolled to the 15th.
    expect(dayKey(1_700_000_000_000, -780)).toBe('2023-11-15');
  });

  describe('streaks', () => {
    it('extends on consecutive days and is idempotent within a day', () => {
      let streak = recordActiveDay(newStreak(), '2026-03-01');
      expect(streak.current).toBe(1);

      streak = recordActiveDay(streak, '2026-03-01');
      expect(streak.current).toBe(1);

      streak = recordActiveDay(streak, '2026-03-02');
      expect(streak.current).toBe(2);
      expect(streak.longest).toBe(2);
    });

    it('spends a freeze to absorb exactly one missed day', () => {
      let streak = recordActiveDay(newStreak(1), '2026-03-01');
      streak = recordActiveDay(streak, '2026-03-03');

      expect(streak.current).toBe(2);
      expect(streak.freezesAvailable).toBe(0);
      expect(streak.freezesUsed).toBe(1);
    });

    it('restarts when the gap exceeds what freezes cover', () => {
      let streak = recordActiveDay(newStreak(1), '2026-03-01');
      streak = recordActiveDay(streak, '2026-03-02');
      streak = recordActiveDay(streak, '2026-03-10');

      expect(streak.current).toBe(1);
      expect(streak.longest).toBe(2);
    });

    it('ignores a backwards date rather than corrupting state', () => {
      const streak = recordActiveDay(newStreak(), '2026-03-05');
      const rewound = recordActiveDay(streak, '2026-03-01');
      expect(rewound).toEqual(streak);
    });

    it('reports whether a streak is already broken', () => {
      const streak = recordActiveDay(newStreak(0), '2026-03-01');
      expect(isStreakBroken(streak, '2026-03-02')).toBe(false);
      expect(isStreakBroken(streak, '2026-03-03')).toBe(true);
      expect(isStreakBroken(newStreak(), '2026-03-03')).toBe(false);
    });
  });

  it('rolls the daily goal over at the day boundary', () => {
    const goal = { targetXp: 100, xpToday: 80, day: '2026-03-01' };
    expect(goalMet(goal)).toBe(false);

    const sameDay = addXpToGoal(goal, 30, '2026-03-01');
    expect(sameDay.xpToday).toBe(110);
    expect(goalMet(sameDay)).toBe(true);

    const nextDay = addXpToGoal(sameDay, 10, '2026-03-02');
    expect(nextDay.xpToday).toBe(10);
    expect(nextDay.day).toBe('2026-03-02');
  });

  it('maps goal presets to XP targets', () => {
    for (const preset of GOAL_PRESETS) {
      expect(targetXpForMinutes(preset.minutes)).toBe(preset.targetXp);
    }
    expect(targetXpForMinutes(45)).toBe(450);
    expect(targetXpForMinutes(1)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Session runner
// ---------------------------------------------------------------------------

describe('SessionRunner', () => {
  const exercise = (id: string): Exercise => ({
    id,
    kind: 'true-false',
    statement: 's',
    answer: true,
    skillIds: ['sk-ai-definition'],
    explanation: 'e',
  });

  const steps = (ids: string[]): Step[] =>
    ids.map((id) => ({ id, type: 'exercise', exercise: exercise(id) }));

  it('advances through steps and completes', () => {
    const runner = new SessionRunner({
      mode: 'lesson',
      level: 'intro',
      steps: steps(['a', 'b']),
      hearts: null,
      requeueMistakes: false,
    });

    expect(runner.snapshot().currentStep?.id).toBe('a');
    runner.submit({ kind: 'boolean', value: true });
    runner.advance();
    expect(runner.snapshot().currentStep?.id).toBe('b');

    runner.submit({ kind: 'boolean', value: true });
    const final = runner.advance();
    expect(final.status).toBe('complete');
    expect(runner.accuracy()).toBe(1);
  });

  it('re-queues a missed step so it is answered before the session ends', () => {
    const runner = new SessionRunner({
      mode: 'lesson',
      level: 'intro',
      steps: steps(['a']),
      hearts: null,
      requeueMistakes: true,
    });

    runner.submit({ kind: 'boolean', value: false });
    expect(runner.snapshot().total).toBe(2);

    runner.advance();
    expect(runner.snapshot().currentStep?.id).toBe('a');
    runner.submit({ kind: 'boolean', value: true });
    expect(runner.advance().status).toBe('complete');
    // Accuracy uses the final outcome per step.
    expect(runner.accuracy()).toBe(1);
  });

  it('fails the session when hearts run out', () => {
    const runner = new SessionRunner({
      mode: 'lesson',
      level: 'intro',
      steps: steps(['a', 'b']),
      hearts: 1,
      requeueMistakes: false,
    });

    runner.submit({ kind: 'boolean', value: false });
    const snapshot = runner.snapshot();
    expect(snapshot.heartsRemaining).toBe(0);
    expect(snapshot.status).toBe('failed');
  });

  it('resumes after a heart refill', () => {
    const runner = new SessionRunner({
      mode: 'lesson',
      level: 'intro',
      steps: steps(['a', 'b']),
      hearts: 1,
      requeueMistakes: false,
    });

    runner.submit({ kind: 'boolean', value: false });
    runner.refillHearts(5);
    expect(runner.snapshot().status).toBe('active');
  });

  it('never runs out of hearts when they are unlimited', () => {
    const runner = new SessionRunner({
      mode: 'lesson',
      level: 'intro',
      steps: steps(['a', 'b']),
      hearts: null,
      requeueMistakes: false,
    });

    runner.submit({ kind: 'boolean', value: false });
    expect(runner.snapshot().status).toBe('active');
    expect(runner.snapshot().heartsRemaining).toBeNull();
  });

  it('records hint usage on the attempt', () => {
    const runner = new SessionRunner({
      mode: 'lesson',
      level: 'intro',
      steps: steps(['a']),
      hearts: null,
      requeueMistakes: false,
    });

    runner.useHint();
    runner.submit({ kind: 'boolean', value: true });
    expect(runner.getAttempts()[0]?.usedHint).toBe(true);
  });

  it('ignores submissions once the session has ended', () => {
    const runner = new SessionRunner({
      mode: 'lesson',
      level: 'intro',
      steps: steps(['a']),
      hearts: null,
      requeueMistakes: false,
    });

    runner.submit({ kind: 'boolean', value: true });
    runner.advance();
    expect(runner.snapshot().status).toBe('complete');

    runner.submit({ kind: 'boolean', value: true });
    expect(runner.getAttempts()).toHaveLength(1);
  });
});

describe('buildReviewSession', () => {
  const now = 1_700_000_000_000;

  it('prioritizes the least-retained due skills and respects the cap', () => {
    const stale = review(newSkillState('sk-a', now), 'good', now - 30 * DAY_MS);
    const recent = review(newSkillState('sk-b', now), 'good', now - 1.5 * DAY_MS);

    const exercises = new Map<string, Exercise[]>([
      ['sk-a', [{ id: 'ex-a', kind: 'true-false', statement: 's', answer: true, skillIds: ['sk-a'], explanation: 'e' }]],
      ['sk-b', [{ id: 'ex-b', kind: 'true-false', statement: 's', answer: true, skillIds: ['sk-b'], explanation: 'e' }]],
    ]);

    const session = buildReviewSession({ 'sk-a': stale, 'sk-b': recent }, exercises, {
      now,
      maxItems: 1,
    });
    expect(session).toHaveLength(1);
    expect(session[0]?.id).toBe('ex-a');
  });

  it('skips skills with no exercises rather than stalling', () => {
    const state = review(newSkillState('sk-orphan', now), 'good', now - 30 * DAY_MS);
    expect(buildReviewSession({ 'sk-orphan': state }, new Map(), { now })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

describe('placement', () => {
  it('runs a full adaptive test and places a strong learner at expert', () => {
    const pool = placementPool();
    let state = startPlacement();

    while (!state.finished) {
      const question = nextQuestion(state, pool);
      if (!question) break;
      const correctResponse = correctResponseFor(question.exercise);
      state = submitPlacementAnswer(state, question, correctResponse);
    }

    expect(state.asked).toHaveLength(PLACEMENT_LENGTH);
    const result = scorePlacement(state);
    expect(result.level).toBe('expert');
    expect(result.correctCount).toBe(PLACEMENT_LENGTH);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('places a learner who answers everything wrong at intro', () => {
    const pool = placementPool();
    let state = startPlacement();

    while (!state.finished) {
      const question = nextQuestion(state, pool);
      if (!question) break;
      state = submitPlacementAnswer(state, question, { kind: 'skipped' });
    }

    const result = scorePlacement(state);
    expect(result.level).toBe('intro');
    expect(result.correctCount).toBe(0);
  });

  it('scores an untaken test as intro with zero confidence', () => {
    const result = scorePlacement(startPlacement());
    expect(result.level).toBe('intro');
    expect(result.confidence).toBe(0);
    expect(result.totalCount).toBe(0);
  });

  it('never repeats a question and spreads across domains', () => {
    const pool = placementPool();
    let state = startPlacement();
    const seen = new Set<string>();

    while (!state.finished) {
      const question = nextQuestion(state, pool);
      if (!question) break;
      expect(seen.has(question.exercise.id)).toBe(false);
      seen.add(question.exercise.id);
      state = submitPlacementAnswer(state, question, { kind: 'skipped' });
    }

    const domains = new Set(state.asked.map((q) => q.domain));
    expect(domains.size).toBeGreaterThanOrEqual(4);
  });
});

/** Builds the correct response for any exercise kind, for test drivers. */
function correctResponseFor(exercise: Exercise): Response {
  switch (exercise.kind) {
    case 'multiple-choice':
    case 'code-output':
      return { kind: 'choice', index: exercise.answer };
    case 'multi-select':
      return { kind: 'choices', indices: exercise.answers };
    case 'true-false':
      return { kind: 'boolean', value: exercise.answer };
    case 'fill-blank':
      return { kind: 'text', values: exercise.blanks.map((b) => b[0] ?? '') };
    case 'order-sequence':
      return { kind: 'order', items: exercise.items };
    case 'match-pairs':
      return { kind: 'pairs', pairs: exercise.pairs };
    case 'numeric':
      return { kind: 'number', value: exercise.answer };
    case 'short-answer':
      return { kind: 'text', values: [exercise.rubricKeywords.join(' ')] };
    case 'categorize':
      return { kind: 'buckets', assignments: exercise.items };
  }
}

export { correctResponseFor };
