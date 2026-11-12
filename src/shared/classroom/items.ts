import { z } from 'zod';
import { subjectFor } from '../study/subjects';
import type { Block, Question, Response, RubricCriterion } from '../study/types';

/**
 * Questions as teachers write them, turned into the same Question objects the Student Learning checker marks.
 * The prompt is plain text (paragraphs, with $$math$$) or ready-made blocks.
 */
const Text = z.string().trim().min(1).max(4000);
const Short = z.string().trim().min(1).max(400);
const Prompt = z.union([Text, z.array(z.record(z.string(), z.unknown())).min(1).max(20)]);
const Rubric = z
  .array(z.object({ id: z.string().min(1).max(40), label: z.string().min(1).max(120), description: z.string().max(600).default(''), levels: z.array(z.string().max(400)).length(4) }))
  .min(1)
  .max(8);

const base = { prompt: Prompt, hints: z.array(z.string().max(600)).max(5).default([]), solution: z.string().max(4000).default('') };

export const TeacherQuestion = z.discriminatedUnion('type', [
  z.object({ type: z.literal('multiple_choice'), ...base, choices: z.array(Short).min(2).max(8), answer: z.number().int().min(0) }),
  z.object({ type: z.literal('multiple_select'), ...base, choices: z.array(Short).min(2).max(8), answers: z.array(z.number().int().min(0)).min(1) }),
  z.object({ type: z.literal('true_false'), ...base, answer: z.boolean() }),
  z.object({ type: z.literal('numeric'), ...base, answer: z.string().trim().min(1).max(60), tolerance: z.string().trim().max(20).nullable().default(null), unit: z.string().trim().max(20).nullable().default(null) }),
  z.object({ type: z.literal('expression'), ...base, answer: z.string().trim().min(1).max(200), variables: z.array(z.string().regex(/^[a-zA-Z]$/)).max(4).default(['x']) }),
  z.object({ type: z.literal('short_answer'), ...base, accepted: z.array(Short).min(1).max(12), keywords: z.array(Short).max(12).default([]) }),
  z.object({ type: z.literal('fill_blank'), ...base, template: z.string().min(4).max(1000), blanks: z.array(z.object({ accepted: z.array(Short).min(1).max(8), numeric: z.boolean().default(false) })).min(1).max(8) }),
  z.object({ type: z.literal('matching'), ...base, pairs: z.array(z.object({ left: Short, right: Short })).min(2).max(8) }),
  z.object({ type: z.literal('ordering'), ...base, items: z.array(Short).min(2).max(8) }),
  z.object({ type: z.literal('written'), ...base, rubric: Rubric.optional(), sampleAnswer: z.string().max(4000).nullable().default(null), minWords: z.number().int().min(0).max(2000).default(0) }),
]);
export type TeacherQuestionT = z.infer<typeof TeacherQuestion>;

/** The practice rubric used for written answers unless the teacher writes their own. */
export const defaultWrittenRubric = (): RubricCriterion[] => subjectFor('').criteria.map((c) => ({ ...c, levels: [...c.levels] }));

const toBlocks = (p: z.infer<typeof Prompt>): Block[] =>
  typeof p === 'string'
    ? p
        .split(/\n{2,}/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text) => ({ kind: 'p', text }) as Block)
    : (p as unknown as Block[]);

/** Deterministic shuffle so the same question always shows the same starting order. */
function shuffled<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  // A starting order equal to the answer would give it away.
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}

export class ItemError extends Error {}

/** Validates a teacher-written question and returns the full Question the checker understands. */
export function toQuestion(raw: unknown, id: string, origin: Question['origin'] = 'authored'): Question {
  // Already a full Question (e.g. saved earlier, or imported from a Student Learning assessment export).
  if (raw && typeof raw === 'object' && Array.isArray((raw as { prompt?: unknown }).prompt) && 'keyVerified' in raw) {
    const q = raw as Question;
    if (q.type === 'code_trace') throw new ItemError('Code-reading questions are not supported in classroom assessments.');
    return { ...q, id, origin: q.origin === 'ai' ? 'ai' : origin };
  }
  const parsed = TeacherQuestion.safeParse(raw);
  if (!parsed.success) throw new ItemError(parsed.error.issues.map((i) => `${i.path.join('.') || 'question'}: ${i.message}`).join('; '));
  const t = parsed.data;
  const common = {
    id,
    expectationId: '',
    skillId: null,
    difficulty: 2 as const,
    cognitive: 'application' as const,
    prompt: toBlocks(t.prompt),
    hints: t.hints,
    solution: t.solution ? toBlocks(t.solution) : [],
    origin,
    // Keys written by a teacher are the teacher's; keys drafted by AI are unverified until reviewed.
    keyVerified: origin !== 'ai',
  };
  const cid = (i: number) => `c${i + 1}`;
  switch (t.type) {
    case 'multiple_choice':
      if (t.answer >= t.choices.length) throw new ItemError('Choose which choice is correct.');
      return { ...common, cognitive: 'recognition', type: t.type, choices: t.choices.map((text, i) => ({ id: cid(i), text })), answer: cid(t.answer) };
    case 'multiple_select': {
      const ids = [...new Set(t.answers)];
      if (ids.some((a) => a >= t.choices.length)) throw new ItemError('A correct choice is out of range.');
      return { ...common, cognitive: 'recognition', type: t.type, choices: t.choices.map((text, i) => ({ id: cid(i), text })), answers: ids.map(cid) };
    }
    case 'true_false':
      return { ...common, cognitive: 'recognition', type: t.type, answer: t.answer };
    case 'numeric':
      return { ...common, type: t.type, answer: t.answer, tolerance: t.tolerance, unit: t.unit };
    case 'expression':
      return { ...common, type: t.type, answer: t.answer, variables: t.variables };
    case 'short_answer':
      return { ...common, type: t.type, accepted: t.accepted, keywords: t.keywords };
    case 'fill_blank': {
      const blanks = t.template.split('___').length - 1;
      if (blanks !== t.blanks.length) throw new ItemError(`The sentence has ${blanks} blank${blanks === 1 ? '' : 's'} (___) but ${t.blanks.length} answer${t.blanks.length === 1 ? ' was' : 's were'} given.`);
      return { ...common, type: t.type, template: t.template, blanks: t.blanks };
    }
    case 'matching': {
      const left = t.pairs.map((p, i) => ({ id: `l${i + 1}`, text: p.left }));
      const right = t.pairs.map((p, i) => ({ id: `r${i + 1}`, text: p.right }));
      return { ...common, cognitive: 'recognition', type: t.type, left, right: shuffled(right, id), pairs: Object.fromEntries(left.map((l, i) => [l.id, right[i]!.id])) };
    }
    case 'ordering': {
      const items = t.items.map((text, i) => ({ id: `o${i + 1}`, text }));
      return { ...common, type: t.type, items: shuffled(items, id), order: items.map((i) => i.id) };
    }
    case 'written':
      return { ...common, cognitive: 'reasoning', type: t.type, rubric: t.rubric ?? defaultWrittenRubric(), sampleAnswer: t.sampleAnswer, minWords: t.minWords || undefined };
  }
}

/** A question with its answer key and solution removed, safe to send to a student. */
export function redactQuestion(q: Question): Question {
  const b = { ...q, solution: [], knownWrong: [], params: undefined } as Question;
  switch (b.type) {
    case 'multiple_choice':
    case 'numeric':
    case 'expression':
    case 'code_trace':
      return { ...b, answer: '' };
    case 'multiple_select':
      return { ...b, answers: [] };
    case 'true_false':
      return { ...b, answer: false };
    case 'short_answer':
      return { ...b, accepted: [], keywords: [] };
    case 'fill_blank':
      return { ...b, blanks: b.blanks.map(() => ({ accepted: [] })) };
    case 'matching':
      return { ...b, pairs: {} };
    case 'ordering':
      return { ...b, order: [] };
    case 'written':
      return { ...b, sampleAnswer: null };
  }
}

export const isAutoGraded = (q: Question): boolean => q.type !== 'written';

const R = z.discriminatedUnion('type', [
  z.object({ type: z.literal('choice'), choice: z.string().max(20) }),
  z.object({ type: z.literal('choices'), choices: z.array(z.string().max(20)).max(12) }),
  z.object({ type: z.literal('bool'), value: z.boolean() }),
  z.object({ type: z.literal('text'), text: z.string().max(2000) }),
  z.object({ type: z.literal('blanks'), values: z.array(z.string().max(400)).max(12) }),
  z.object({ type: z.literal('pairs'), pairs: z.record(z.string().max(20), z.string().max(20)) }),
  z.object({ type: z.literal('order'), order: z.array(z.string().max(20)).max(12) }),
  z.object({ type: z.literal('written'), text: z.string().max(40_000) }),
]);
const EXPECTED: Record<Question['type'], Response['type']> = {
  multiple_choice: 'choice',
  multiple_select: 'choices',
  true_false: 'bool',
  numeric: 'text',
  expression: 'text',
  short_answer: 'text',
  code_trace: 'text',
  fill_blank: 'blanks',
  matching: 'pairs',
  ordering: 'order',
  written: 'written',
};

/** Validates a student's response for a question; returns null when it has the wrong shape. */
export function parseResponse(q: Question, raw: unknown): Response | null {
  const r = R.safeParse(raw);
  return r.success && r.data.type === EXPECTED[q.type] ? (r.data as Response) : null;
}

/** Whether the student has actually answered (an untouched input does not count). */
export function isAnswered(r: Response | null | undefined): boolean {
  if (!r) return false;
  switch (r.type) {
    case 'choice':
      return !!r.choice;
    case 'choices':
      return r.choices.length > 0;
    case 'bool':
      return true;
    case 'text':
    case 'written':
      return r.text.trim().length > 0;
    case 'blanks':
      return r.values.some((v) => v.trim());
    case 'pairs':
      return Object.keys(r.pairs).length > 0;
    case 'order':
      return r.order.length > 0;
  }
}

/** A student's response as text, for the gradebook, exports and "common wrong answers". */
export function responseText(q: Question, r: Response | null | undefined): string {
  if (!r) return '';
  switch (r.type) {
    case 'choice':
      return 'choices' in q ? (q.choices.find((c) => c.id === r.choice)?.text ?? '') : '';
    case 'choices':
      return 'choices' in q ? r.choices.map((id) => q.choices.find((c) => c.id === id)?.text ?? '').join('; ') : '';
    case 'bool':
      return r.value ? 'True' : 'False';
    case 'text':
    case 'written':
      return r.text;
    case 'blanks':
      return r.values.join(' | ');
    case 'pairs':
      return q.type === 'matching' ? q.left.map((l) => `${l.text} → ${q.right.find((x) => x.id === r.pairs[l.id])?.text ?? '—'}`).join('; ') : '';
    case 'order':
      return q.type === 'ordering' ? r.order.map((id) => q.items.find((i) => i.id === id)?.text ?? '').join(' → ') : '';
  }
}

/** The plain text of a question's prompt. */
export function promptText(q: Question): string {
  return q.prompt
    .map((b) => ('text' in b && typeof b.text === 'string' ? b.text : b.kind === 'math' ? `$$${b.latex}$$` : b.kind === 'list' ? b.items.join('\n') : ''))
    .filter(Boolean)
    .join('\n');
}
