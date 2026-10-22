import { Rational } from '../../../shared/study/rational';
import type { AltExplanation, Block, Cognitive, Difficulty, KnownWrong, Misconception, Question } from '../../../shared/study/types';

/**
 * Building blocks for authored skill packs: a seeded random generator (so a question can always be
 * regenerated from its seed) and helpers that build checked questions.
 */

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  next(): number {
    // mulberry32
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  /** Non-zero integer in [-max, -min] ∪ [min, max]. */
  signed(min: number, max: number): number {
    return this.int(min, max) * (this.next() < 0.5 ? -1 : 1);
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)]!;
  }
  shuffle<T>(xs: readonly T[]): T[] {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

export interface PackCtx {
  grade: number;
  expectationId: string;
  /** Plainer wording for students who asked for it. */
  simple: boolean;
}

export interface SkillExpectation {
  id: string;
  /** Why this skill teaches (part of) the expectation. Reviewed against the official wording. */
  note: string;
  /** Difficulty range that fits this grade's expectation. */
  levels?: Difficulty[];
}

export interface SkillPack {
  id: string;
  title: string;
  subject: 'math';
  expectations: SkillExpectation[];
  /** Skill ids that should be secure first. */
  prerequisites: string[];
  /** "I can …" statement, written by FlowCompanion. */
  goal: string;
  explain(ctx: PackCtx): Block[];
  alternatives(ctx: PackCtx): Partial<Record<AltExplanation, Block[]>>;
  example(rng: Rng, ctx: PackCtx): Block[];
  generate(rng: Rng, d: Difficulty, ctx: PackCtx): Draft;
  /** Recomputes the answer from the stored parameters by a different route; returns a problem or null. */
  selfCheck?(q: Question): string | null;
  summary: string[];
  misconceptions: Misconception[];
}

/** A question before ids and bookkeeping are added. */
export type Draft = Omit<Question, 'id' | 'expectationId' | 'skillId' | 'difficulty' | 'origin' | 'keyVerified'> & { params?: Record<string, unknown> };

export const p = (text: string): Block => ({ kind: 'p', text });
export const m = (latex: string): Block => ({ kind: 'math', latex });
export const list = (items: string[], ordered = false): Block => ({ kind: 'list', items, ordered });
export const tip = (text: string): Block => ({ kind: 'note', tone: 'tip', text });
export const warn = (text: string): Block => ({ kind: 'note', tone: 'warn', text });
export const steps = (...s: { text: string; math?: string }[]): Block => ({ kind: 'steps', steps: s });

/** Inline LaTeX. */
export const tex = (latex: string) => `$$${latex}$$`;
export const frac = (r: Rational, mixed = false) => r.toLatex({ mixed });
export const fracText = (n: number, d: number) => `$$\\frac{${n}}{${d}}$$`;

export function numeric(
  prompt: Block[],
  answer: Rational | number | string,
  o: {
    cognitive?: Cognitive;
    hints: string[];
    solution: Block[];
    knownWrong?: KnownWrong[];
    unit?: string;
    accept?: ('integer' | 'fraction' | 'mixed' | 'decimal' | 'percent')[];
    requireSimplest?: boolean;
    tolerance?: string;
    params?: Record<string, unknown>;
  },
): Draft {
  // Store the key in a form the question accepts: a decimal when fractions are not allowed.
  const r = typeof answer === 'string' ? null : answer instanceof Rational ? answer : Rational.of(answer);
  const wantsDecimal = !!o.accept && !o.accept.includes('fraction') && !o.accept.includes('mixed');
  const a = r ? (wantsDecimal ? (r.toDecimal() ?? r.toString()) : r.toString()) : (answer as string);
  return {
    type: 'numeric',
    prompt,
    answer: a,
    cognitive: o.cognitive ?? 'application',
    hints: o.hints,
    solution: o.solution,
    knownWrong: (o.knownWrong ?? []).filter((k) => k.value !== a),
    unit: o.unit ?? null,
    accept: o.accept,
    requireSimplest: o.requireSimplest ?? false,
    tolerance: o.tolerance ?? null,
    params: o.params,
  } as Draft;
}

export function expression(prompt: Block[], answer: string, o: { hints: string[]; solution: Block[]; variables: string[]; requireSimplified?: boolean; knownWrong?: KnownWrong[]; cognitive?: Cognitive; params?: Record<string, unknown> }): Draft {
  return {
    type: 'expression',
    prompt,
    answer,
    variables: o.variables,
    requireSimplified: o.requireSimplified ?? true,
    cognitive: o.cognitive ?? 'application',
    hints: o.hints,
    solution: o.solution,
    knownWrong: o.knownWrong,
    params: o.params,
  } as Draft;
}

/**
 * Multiple choice with shuffled options. Distractors carry the misconception they reveal. Duplicate option
 * texts are removed so there is always exactly one right answer.
 */
export function choice(
  rng: Rng,
  prompt: Block[],
  correct: string,
  distractors: { text: string; misconception?: string }[],
  o: { hints: string[]; solution: Block[]; cognitive?: Cognitive; params?: Record<string, unknown> },
): Draft {
  const seen = new Set([correct]);
  const ds = distractors.filter((d) => !seen.has(d.text) && seen.add(d.text)).slice(0, 3);
  const opts = rng.shuffle([{ text: correct, misconception: undefined as string | undefined, right: true }, ...ds.map((d) => ({ ...d, right: false }))]);
  const ids = ['a', 'b', 'c', 'd'];
  const choices = opts.map((x, i) => ({ id: ids[i]!, text: x.text }));
  return {
    type: 'multiple_choice',
    prompt,
    choices,
    answer: ids[opts.findIndex((x) => x.right)]!,
    cognitive: o.cognitive ?? 'recognition',
    hints: o.hints,
    solution: o.solution,
    knownWrong: opts.flatMap((x, i) => (x.misconception ? [{ value: ids[i]!, misconception: x.misconception }] : [])),
    params: o.params,
  } as Draft;
}

export function trueFalse(prompt: Block[], answer: boolean, o: { hints: string[]; solution: Block[]; misconception?: string; params?: Record<string, unknown> }): Draft {
  return {
    type: 'true_false',
    prompt,
    answer,
    cognitive: 'reasoning',
    hints: o.hints,
    solution: o.solution,
    knownWrong: o.misconception ? [{ value: String(!answer), misconception: o.misconception }] : [],
    params: o.params,
  } as Draft;
}

/** Formats an exact decimal for display ("1 234.5" style is not used; Ontario resources use plain digits). */
export function dec(r: Rational | number): string {
  const v = r instanceof Rational ? r : Rational.of(r);
  return v.toDecimal() ?? v.toString();
}

export const money = (r: Rational) => {
  const cents = r.mul(100);
  const rounded = new Rational((cents.n * 2n + cents.d) / (2n * cents.d));
  const s = rounded.div(100).toDecimal(2) ?? '0';
  const [i, f = ''] = s.split('.');
  return `$${i}.${f.padEnd(2, '0')}`;
};

/** Rounds a rational to a number of decimal places (half away from zero). */
export function roundTo(r: Rational, places: number): Rational {
  const scale = 10n ** BigInt(places);
  const x = r.mul(new Rational(scale));
  const sign = x.n < 0n ? -1n : 1n;
  const a = x.abs();
  const q = (a.n * 2n + a.d) / (2n * a.d);
  return new Rational(sign * q, scale);
}
