import { describe, expect, it } from 'vitest';
import { checkResponse } from '../../src/shared/study/checking';
import { equivalent, isSimplified, parseExpr } from '../../src/shared/study/expr';
import { parseStudentNumber, R, Rational } from '../../src/shared/study/rational';
import { SUBJECTS, subjectFor } from '../../src/shared/study/subjects';
import type { Evidence, Question } from '../../src/shared/study/types';
import { adaptDifficulty, computeMastery, detectGaps, nextReview, startingDifficulty } from '../../src/core/study/mastery';
import { lessonPlan } from '../../src/core/study/lessons';
import { readBundleFile } from '../../src/core/curriculum/bundle';
import path from 'node:path';

const NOW = new Date('2026-10-22T12:00:00Z');
const ev = (o: Partial<Evidence> & { daysAgo?: number }): Evidence => ({
  at: new Date(NOW.getTime() - (o.daysAgo ?? 0) * 86_400_000).toISOString(),
  correct: o.correct ?? true,
  score: o.score ?? (o.correct === false ? 0 : 1),
  difficulty: o.difficulty ?? 2,
  cognitive: o.cognitive ?? 'application',
  hinted: o.hinted ?? false,
  weight: o.weight ?? 1,
  source: o.source ?? 'quiz',
  misconception: o.misconception ?? null,
});

describe('exact numbers', () => {
  it('does arithmetic without floating-point error', () => {
    expect(R(1, 10).add(R(2, 10)).eq(R(3, 10))).toBe(true);
    expect(Rational.parseDecimal('0.1')!.add(Rational.parseDecimal('0.2')!).toDecimal()).toBe('0.3');
    expect(R(7, 2).mixed()).toEqual({ sign: 1, whole: 3n, num: 1n, den: 2n });
    expect(R(1, 3).toDecimal()).toBeNull();
    expect(R(-3, 4).toLatex()).toBe('-\\frac{3}{4}');
  });

  it('reads numbers the way students type them', () => {
    const v = (s: string) => parseStudentNumber(s)?.value.toString();
    expect(v('3/4')).toBe('3/4');
    expect(v('-1 1/2')).toBe('-3/2');
    expect(v('0.75')).toBe('3/4');
    expect(v('75%')).toBe('3/4');
    expect(v('2,500')).toBe('2500');
    expect(v('−3')).toBe('-3');
    expect(v('3/0')).toBeUndefined();
    expect(v('three')).toBeUndefined();
    expect(parseStudentNumber('1 1/2')?.form).toBe('mixed');
  });
});

describe('algebra checking', () => {
  it('recognises equivalent expressions exactly', () => {
    const eq = (a: string, b: string) => equivalent(parseExpr(a), parseExpr(b));
    expect(eq('2(x + 3)', '2x + 6')).toBe(true);
    expect(eq('x^2 * x^3', 'x^5')).toBe(true);
    expect(eq('(x+1)(x-1)', 'x^2 - 1')).toBe(true);
    expect(eq('3x + 2x', '5x')).toBe(true);
    expect(eq('3x + 2', '5x')).toBe(false);
    expect(eq('x/2', '0.5x')).toBe(true);
    expect(eq('1/x + 1', '(x+1)/x')).toBe(true);
  });

  it('knows whether an answer is fully simplified', () => {
    const s = (e: string) => isSimplified(parseExpr(e));
    expect(s('5x + 2')).toBe(true);
    expect(s('3x + 2x')).toBe(false);
    expect(s('2(x + 1)')).toBe(false);
    expect(s('2*3x')).toBe(false);
    expect(s('x*x')).toBe(false);
    expect(s('x^7')).toBe(true);
    expect(s('-x + 4')).toBe(true);
  });
});

describe('answer checking', () => {
  const base = { id: 'q', expectationId: 'e', skillId: null, difficulty: 2 as const, cognitive: 'application' as const, prompt: [], hints: [], solution: [], origin: 'generated' as const, keyVerified: true };
  it('marks fractions, decimals and simplest form', () => {
    const q: Question = { ...base, type: 'numeric', answer: '3/4', requireSimplest: true, accept: ['fraction', 'decimal'], knownWrong: [{ value: '2/7', misconception: 'frac_add_across' }] };
    expect(checkResponse(q, { type: 'text', text: '3/4' }).correct).toBe(true);
    expect(checkResponse(q, { type: 'text', text: '0.75' }).correct).toBe(true);
    const unsimplified = checkResponse(q, { type: 'text', text: '6/8' });
    expect(unsimplified).toMatchObject({ correct: false, score: 0.5, misconception: 'not_simplified' });
    expect(checkResponse(q, { type: 'text', text: '2/7' }).misconception).toBe('frac_add_across');
    const bad = checkResponse(q, { type: 'text', text: 'abc' });
    expect(bad.unreadable).toBeTruthy();
  });

  it('strips units and dollar signs, and uses tolerance only when asked', () => {
    const q: Question = { ...base, type: 'numeric', answer: '12.5', unit: 'cm' };
    expect(checkResponse(q, { type: 'text', text: '12.5 cm' }).correct).toBe(true);
    expect(checkResponse({ ...q, unit: null }, { type: 'text', text: '$12.50' }).correct).toBe(true);
    expect(checkResponse({ ...q, tolerance: '0.05' }, { type: 'text', text: '12.54' }).correct).toBe(true);
    expect(checkResponse(q, { type: 'text', text: '12.54' }).correct).toBe(false);
  });

  it('marks matching, ordering and multiple select with partial credit', () => {
    const m: Question = { ...base, type: 'matching', left: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], right: [{ id: '1', text: '1' }, { id: '2', text: '2' }], pairs: { a: '1', b: '2' } };
    expect(checkResponse(m, { type: 'pairs', pairs: { a: '1', b: '1' } })).toMatchObject({ correct: false, score: 0.5 });
    const o: Question = { ...base, type: 'ordering', items: [{ id: 'x', text: 'x' }, { id: 'y', text: 'y' }, { id: 'z', text: 'z' }], order: ['x', 'y', 'z'] };
    expect(checkResponse(o, { type: 'order', order: ['x', 'y', 'z'] }).correct).toBe(true);
    const s: Question = { ...base, type: 'multiple_select', choices: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }, { id: 'c', text: 'c' }], answers: ['a', 'b'] };
    expect(checkResponse(s, { type: 'choices', choices: ['a', 'c'] })).toMatchObject({ correct: false, score: 0 });
    expect(checkResponse(s, { type: 'choices', choices: ['a'] })).toMatchObject({ correct: false, score: 0.5 });
  });

  it('never marks written answers automatically', () => {
    const w: Question = { ...base, type: 'written', rubric: SUBJECTS[0]!.criteria, sampleAnswer: null, minWords: 5 };
    expect(checkResponse(w, { type: 'written', text: 'too short' }).unreadable).toBeTruthy();
    const r = checkResponse(w, { type: 'written', text: 'This is a longer answer with an example and a reason.' });
    expect(r.correct).toBeNull();
    expect(r.method).toBe('none');
  });

  it('checks code-reading answers by exact output', () => {
    const c: Question = { ...base, type: 'code_trace', code: 'print(2+3)', answer: '5' };
    expect(checkResponse(c, { type: 'text', text: ' 5 ' }).correct).toBe(true);
    expect(checkResponse(c, { type: 'text', text: '23' }).correct).toBe(false);
  });
});

describe('mastery model', () => {
  it('starts at not assessed and needs repeated independent evidence for proficient', () => {
    expect(computeMastery('e', [], NOW).status).toBe('not_assessed');
    expect(computeMastery('e', [ev({ correct: false })], NOW).status).toBe('not_yet');
    // One correct answer is not enough, however good.
    expect(computeMastery('e', [ev({})], NOW).status).toBe('developing');
    const three = [ev({ daysAgo: 2 }), ev({ daysAgo: 1 }), ev({})];
    expect(computeMastery('e', three, NOW).status).toBe('proficient');
  });

  it('treats hinted answers as assisted, not independent', () => {
    const hinted = [ev({ hinted: true }), ev({ hinted: true }), ev({ hinted: true }), ev({ hinted: true })];
    const r = computeMastery('e', hinted, NOW);
    expect(r.independentCorrect).toBe(0);
    expect(r.assistedCorrect).toBe(4);
    expect(r.status).toBe('developing');
    expect(r.reasons.join(' ')).toMatch(/without hints/);
  });

  it('only counts warm-up questions as a start', () => {
    const easy = [ev({ difficulty: 1 }), ev({ difficulty: 1 }), ev({ difficulty: 1 })];
    expect(computeMastery('e', easy, NOW).status).toBe('developing');
  });

  it('gives AI-keyed answers less weight and ignores self-assessment', () => {
    const r = computeMastery('e', [ev({ weight: 0.4 }), ev({ weight: 0.4 }), ev({ weight: 0.4 }), ev({ weight: 0 })], NOW);
    expect(r.independentCorrect).toBe(0);
    expect(r.status).toBe('developing');
  });

  it('moves to extension only with strong results on harder questions over more than one day', () => {
    const evs = [ev({ daysAgo: 3, difficulty: 3 }), ev({ daysAgo: 3 }), ev({ daysAgo: 1, difficulty: 3 }), ev({ difficulty: 2 })];
    expect(computeMastery('e', evs, NOW).status).toBe('extension_ready');
  });

  it('flags a review when it is due, and drops back after a wrong answer', () => {
    const evs = [ev({ daysAgo: 20 }), ev({ daysAgo: 19 }), ev({ daysAgo: 18 })];
    expect(computeMastery('e', evs, NOW, undefined, { nextReviewAt: new Date(NOW.getTime() - 3600_000).toISOString(), intervalDays: 7 }).status).toBe('review');
    expect(computeMastery('e', [...evs, ev({ correct: false })], NOW).status).not.toBe('proficient');
  });

  it('spaces reviews out after success and brings them back after mistakes, before a test', () => {
    let s = nextReview({ intervalDays: 0, ease: 2.3 }, 1, NOW);
    expect(s.intervalDays).toBe(1);
    s = nextReview(s, 1, NOW);
    expect(s.intervalDays).toBe(3);
    s = nextReview(s, 1, NOW);
    expect(s.intervalDays).toBeGreaterThanOrEqual(7);
    const fail = nextReview(s, 0.2, NOW);
    expect(fail.intervalDays).toBe(1);
    const capped = nextReview({ intervalDays: 30, ease: 2.5 }, 1, NOW, new Date(NOW.getTime() + 5 * 86_400_000));
    expect(new Date(capped.nextReviewAt).getTime()).toBeLessThan(NOW.getTime() + 5 * 86_400_000);
  });

  it('does not change difficulty after a single wrong answer', () => {
    expect(adaptDifficulty(2, [{ correct: false, hinted: false, difficulty: 2 }]).difficulty).toBe(2);
    expect(adaptDifficulty(2, [{ correct: false, hinted: false, difficulty: 2 }, { correct: false, hinted: false, difficulty: 2 }]).difficulty).toBe(1);
    expect(adaptDifficulty(2, [{ correct: true, hinted: false, difficulty: 2 }, { correct: true, hinted: false, difficulty: 2 }]).difficulty).toBe(3);
    // Hinted successes don't count as a reason to go up.
    expect(adaptDifficulty(2, [{ correct: true, hinted: true, difficulty: 2 }, { correct: true, hinted: false, difficulty: 2 }]).difficulty).toBe(2);
    expect(adaptDifficulty(4, [{ correct: true, hinted: false, difficulty: 4 }, { correct: true, hinted: false, difficulty: 4 }]).difficulty).toBe(4);
    expect(startingDifficulty('proficient')).toBe(3);
    expect(startingDifficulty('not_assessed', [1, 2, 3, 4], true)).toBe(1);
  });

  it('finds repeated mistakes, recognition-only success and hint dependence', () => {
    const evs = [
      ev({ cognitive: 'recognition', daysAgo: 5 }),
      ev({ cognitive: 'recognition', daysAgo: 5 }),
      ...Array.from({ length: 5 }, () => ev({ hinted: true, daysAgo: 4 })),
      ev({ correct: false, misconception: 'frac_add_across', daysAgo: 1 }),
      ev({ correct: false, misconception: 'frac_add_across' }),
    ];
    const gaps = detectGaps('e', evs, computeMastery('e', evs, NOW), NOW);
    expect(gaps.map((g) => g.kind).sort()).toEqual(['hint_dependence', 'recognition_not_application', 'repeated_error']);
    expect(gaps.find((g) => g.kind === 'repeated_error')!.misconception).toBe('frac_add_across');
  });
});

describe('lesson plans', () => {
  it('follow the teaching cycle and fit the time available', () => {
    expect(lessonPlan('full', null, { proficient: false, hasPrerequisites: true }).map((s) => s.kind)).toEqual(['objective', 'prerequisites', 'explain', 'worked_example', 'guided', 'independent', 'check', 'summary', 'next']);
    expect(lessonPlan('short', null, { proficient: false, hasPrerequisites: false }).some((s) => s.questions > 0)).toBe(false);
    const five = lessonPlan('timed', 5, { proficient: false, hasPrerequisites: false });
    const thirty = lessonPlan('timed', 30, { proficient: false, hasPrerequisites: true });
    const q = (p: typeof five) => p.reduce((a, s) => a + s.questions, 0);
    expect(q(thirty)).toBeGreaterThan(q(five));
    // A student who is already proficient skips the explanation in a timed session.
    expect(lessonPlan('timed', 10, { proficient: true, hasPrerequisites: false }).some((s) => s.kind === 'explain')).toBe(false);
  });
});

describe('subject profiles', () => {
  it('cover every curriculum document in the bundle', () => {
    const b = readBundleFile(path.join(__dirname, '..', '..', 'resources', 'curriculum', 'ontario.json.gz'));
    for (const d of b.documents) expect(subjectFor(d.title).id, d.title).not.toBe('general');
    for (const s of SUBJECTS) {
      expect(s.criteria.map((c) => c.label)[0]).toBe('Knowledge and Understanding');
      expect(s.limitations.length + s.feedbackRules.length).toBeGreaterThan(0);
      expect(s.questionFormats.length).toBeGreaterThan(0);
    }
  });
});
