import type { Difficulty, Misconception, Question } from '../../../shared/study/types';
import { Rng, type PackCtx, type SkillPack } from './kit';
import { addSubtractFractions, fractionDecimalPercent, multiplyDivideFractions, simplifyFractions } from './math/fractions';
import { MATH_PACKS_ALGEBRA } from './math/algebra';
import { MATH_PACKS_GEOMETRY } from './math/geometry';
import { MATH_PACKS_NUMBER } from './math/number';
import { MATH_PACKS_RATIO } from './math/ratio';

/**
 * Every authored skill pack. A pack teaches one skill and lists the official expectations it serves, with a
 * note on how it maps. Coverage numbers in the app are computed from this list, never typed in by hand.
 */
export const SKILL_PACKS: SkillPack[] = [simplifyFractions, addSubtractFractions, multiplyDivideFractions, fractionDecimalPercent, ...MATH_PACKS_NUMBER, ...MATH_PACKS_RATIO, ...MATH_PACKS_ALGEBRA, ...MATH_PACKS_GEOMETRY];

const byId = new Map(SKILL_PACKS.map((s) => [s.id, s]));
const byExpectation = new Map<string, SkillPack[]>();
for (const s of SKILL_PACKS) {
  for (const e of s.expectations) {
    const l = byExpectation.get(e.id) ?? [];
    l.push(s);
    byExpectation.set(e.id, l);
  }
}

export function skill(id: string): SkillPack | undefined {
  return byId.get(id);
}

export function skillsFor(expectationId: string): SkillPack[] {
  return byExpectation.get(expectationId) ?? [];
}

export function authoredExpectations(): Set<string> {
  return new Set(byExpectation.keys());
}

export function allMisconceptions(): Map<string, Misconception> {
  const m = new Map<string, Misconception>();
  for (const s of SKILL_PACKS) for (const x of s.misconceptions) if (!m.has(x.id)) m.set(x.id, x);
  return m;
}

/** Difficulty levels a pack offers for an expectation (all four unless the mapping narrows it). */
export function levelsFor(pack: SkillPack, expectationId: string): Difficulty[] {
  return pack.expectations.find((e) => e.id === expectationId)?.levels ?? [1, 2, 3, 4];
}

/** Grade of an expectation id, from the course it belongs to (elementary ids carry "g6", secondary ones are MTH1W). */
export function gradeOf(expectationId: string): number {
  const g = /-g(\d+)-/.exec(expectationId);
  if (g) return Number(g[1]);
  if (expectationId.startsWith('on-mth1w:')) return 9;
  return 9;
}

let counter = 0;

/**
 * Generates a question and checks its answer key by a second, independent calculation. A generated question
 * whose key fails the check is thrown away (and the next seed tried), so a student never sees one.
 */
export function generateQuestion(pack: SkillPack, expectationId: string, difficulty: Difficulty, seed: number, ctx: Partial<PackCtx> = {}): Question {
  const levels = levelsFor(pack, expectationId);
  const d = levels.includes(difficulty) ? difficulty : levels.reduce((best, l) => (Math.abs(l - difficulty) < Math.abs(best - difficulty) ? l : best), levels[0]!);
  const c: PackCtx = { grade: gradeOf(expectationId), expectationId, simple: false, ...ctx };
  for (let attempt = 0; attempt < 20; attempt++) {
    const s = (seed + attempt * 7919) >>> 0;
    const draft = pack.generate(new Rng(s), d, c);
    const q = { ...draft, id: `${pack.id}:${s}:${d}:${++counter}`, expectationId, skillId: pack.id, difficulty: d, origin: 'generated', keyVerified: true } as Question;
    const problem = pack.selfCheck?.(q) ?? null;
    if (!problem) return q;
    console.warn(`[content] discarded ${pack.id} seed ${s}: ${problem}`);
  }
  throw new Error(`Could not generate a checked question for ${pack.id}`);
}
