import katex from 'katex';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readBundleFile } from '../../src/core/curriculum/bundle';
import { Rng } from '../../src/core/study/content/kit';
import { allMisconceptions, generateQuestion, gradeOf, levelsFor, SKILL_PACKS } from '../../src/core/study/content/registry';
import { checkResponse } from '../../src/shared/study/checking';
import { parseStudentNumber } from '../../src/shared/study/rational';
import type { Block, Question, Response } from '../../src/shared/study/types';

/**
 * Quality gate for every authored skill pack: each mapping points at a real Ontario expectation, every generated
 * answer key marks itself correct, known wrong answers are recognised, keys pass an independent recomputation,
 * and all text renders (no NaN/undefined, valid LaTeX).
 */

const bundle = readBundleFile(path.join(__dirname, '..', '..', 'resources', 'curriculum', 'ontario.json.gz'));
const official = new Map(bundle.expectations.map((e) => [e.id, e]));
const SEEDS = Number(process.env.FC_CONTENT_SEEDS ?? 40);
/** FC_CONTENT_ONLY=pack-id,pack-id limits the run to some packs (handy while writing one). */
const ONLY = process.env.FC_CONTENT_ONLY?.split(',').map((x) => x.trim());
const PACKS = ONLY ? SKILL_PACKS.filter((s) => ONLY.includes(s.id)) : SKILL_PACKS;

function keyResponse(q: Question): Response {
  switch (q.type) {
    case 'multiple_choice':
      return { type: 'choice', choice: q.answer };
    case 'multiple_select':
      return { type: 'choices', choices: q.answers };
    case 'true_false':
      return { type: 'bool', value: q.answer };
    case 'numeric':
    case 'expression':
    case 'code_trace':
      return { type: 'text', text: q.answer };
    case 'short_answer':
      return { type: 'text', text: q.accepted[0]! };
    case 'fill_blank':
      return { type: 'blanks', values: q.blanks.map((b) => b.accepted[0]!) };
    case 'matching':
      return { type: 'pairs', pairs: q.pairs };
    case 'ordering':
      return { type: 'order', order: q.order };
    case 'written':
      return { type: 'written', text: q.sampleAnswer ?? 'sample answer text' };
  }
}

function texts(blocks: Block[]): string[] {
  return blocks.flatMap((b) => {
    switch (b.kind) {
      case 'p':
      case 'note':
        return [b.text];
      case 'math':
        return [`$$${b.latex}$$`];
      case 'list':
        return b.items;
      case 'table':
        return [...b.header, ...b.rows.flat()];
      case 'steps':
        return b.steps.flatMap((s) => [s.text, s.math ? `$$${s.math}$$` : '']);
      case 'code':
        return [b.code];
      case 'diagram':
        return [b.alt, JSON.stringify(b.diagram)];
      case 'official':
      case 'support':
        return [];
    }
  });
}

function assertRenders(s: string, where: string) {
  expect(s, where).not.toMatch(/\bNaN\b|\bundefined\b|\bInfinity\b|\[object Object\]/);
  for (const m of s.matchAll(/\$\$([\s\S]+?)\$\$/g)) {
    expect(() => katex.renderToString(m[1]!, { throwOnError: true, strict: 'ignore' }), `${where}: ${m[1]}`).not.toThrow();
  }
}

function questionTexts(q: Question): string[] {
  const out = [...texts(q.prompt), ...texts(q.solution), ...q.hints];
  if (q.type === 'multiple_choice' || q.type === 'multiple_select') out.push(...q.choices.map((c) => c.text));
  if (q.type === 'matching') out.push(...q.left.map((x) => x.text), ...q.right.map((x) => x.text));
  if (q.type === 'ordering') out.push(...q.items.map((x) => x.text));
  if (q.type === 'code_trace') out.push(q.code);
  return out;
}

describe('authored skill packs', () => {
  it('have unique ids and point only at official Ontario expectations', () => {
    expect(new Set(SKILL_PACKS.map((s) => s.id)).size).toBe(SKILL_PACKS.length);
    for (const s of PACKS) {
      expect(s.expectations.length, s.id).toBeGreaterThan(0);
      expect(s.selfCheck, `${s.id} needs an independent selfCheck`).toBeTypeOf('function');
      for (const e of s.expectations) {
        expect(official.has(e.id), `${s.id} → ${e.id} is not an official expectation`).toBe(true);
        expect(official.get(e.id)!.kind, e.id).toBe('specific');
        expect(e.note.length, `${s.id} → ${e.id} needs a mapping note`).toBeGreaterThan(10);
      }
      for (const pre of s.prerequisites) expect(SKILL_PACKS.some((x) => x.id === pre), `${s.id} prerequisite ${pre}`).toBe(true);
    }
  });

  it('teach with explanations, alternatives and worked examples that render', () => {
    for (const s of PACKS) {
      for (const e of s.expectations) {
        const ctx = { grade: gradeOf(e.id), expectationId: e.id, simple: false };
        const ex = s.explain(ctx);
        expect(ex.length, s.id).toBeGreaterThan(0);
        const alts = s.alternatives(ctx);
        expect(Object.keys(alts).length, `${s.id} alternatives`).toBeGreaterThanOrEqual(2);
        for (const t of [...texts(ex), ...Object.values(alts).flatMap((b) => texts(b!)), s.goal, ...s.summary]) assertRenders(t, s.id);
        for (let seed = 1; seed <= 10; seed++) for (const t of texts(s.example(new Rng(seed), ctx))) assertRenders(t, `${s.id} example`);
        for (const t of texts(s.explain({ ...ctx, simple: true }))) assertRenders(t, s.id);
      }
      expect(s.summary.length, s.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('generate questions whose answer keys are right, independently checked and well formed', () => {
    const misconceptions = allMisconceptions();
    let generated = 0;
    for (const s of PACKS) {
      for (const e of s.expectations) {
        for (const d of levelsFor(s, e.id)) {
          for (let seed = 1; seed <= SEEDS; seed++) {
            const q = generateQuestion(s, e.id, d, seed * 104729 + d);
            generated++;
            const where = `${s.id} ${e.id} d${d} seed ${seed}`;
            expect(q.prompt.length, where).toBeGreaterThan(0);
            expect(q.hints.length, where).toBeGreaterThan(0);
            expect(q.solution.length, where).toBeGreaterThan(0);
            expect(s.selfCheck!(q), where).toBeNull();
            const r = checkResponse(q, keyResponse(q));
            expect(r.correct, `${where}: key marked ${r.feedback}`).toBe(true);
            for (const t of questionTexts(q)) assertRenders(t, where);
            if (q.type === 'numeric') {
              const key = parseStudentNumber(q.answer);
              expect(key, `${where}: key ${q.answer}`).not.toBeNull();
              if (q.requireSimplest && q.answer.includes('/')) {
                const [n, den] = q.answer.split('/').map((x) => BigInt(x));
                const g = (a: bigint, b: bigint): bigint => (b ? g(b, a % b) : a < 0n ? -a : a);
                expect(g(n!, den!), `${where}: key ${q.answer} not simplest`).toBe(1n);
              }
            }
            if (q.type === 'multiple_choice') {
              expect(new Set(q.choices.map((c) => c.text)).size, where).toBe(q.choices.length);
              expect(q.choices.length, where).toBeGreaterThanOrEqual(2);
            }
            for (const k of q.knownWrong ?? []) {
              expect(misconceptions.has(k.misconception), `${where}: unknown misconception ${k.misconception}`).toBe(true);
              if (q.type === 'numeric') {
                const res = checkResponse(q, { type: 'text', text: k.value });
                expect(res.correct, `${where}: known wrong ${k.value} marked correct`).toBe(false);
                if (!res.unreadable && res.score === 0) expect(res.misconception, `${where}: ${k.value}`).toBe(k.misconception);
              }
              if (q.type === 'multiple_choice') {
                expect(k.value, where).not.toBe(q.answer);
                expect(checkResponse(q, { type: 'choice', choice: k.value }).misconception, where).toBe(k.misconception);
              }
            }
          }
        }
      }
    }
    expect(generated).toBeGreaterThan(ONLY ? 0 : 500);
  });

  it('declares every misconception it uses with an explanation and a fix', () => {
    for (const s of PACKS) {
      for (const m of s.misconceptions) {
        expect(m.label.length, m.id).toBeGreaterThan(3);
        expect(m.explanation.length, m.id).toBeGreaterThan(10);
        expect(m.fix.length, m.id).toBeGreaterThan(10);
        assertRenders(m.explanation, m.id);
      }
    }
  });
});
