import { equivalent, isSimplified, parseExpr, ParseError } from './expr';
import { parseStudentNumber, Rational } from './rational';
import type { CheckResult, Question, Response } from './types';

/**
 * Marks a response against a question. Deterministic and pure: the same answer always gets the same mark.
 * Written answers cannot be marked by code and come back with correct = null.
 */

const norm = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}'%./\- ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an) /, '');

function wrongFor(q: Question, value: string, parsed: Rational | null): string | null {
  for (const k of q.knownWrong ?? []) {
    if (parsed) {
      const kv = parseStudentNumber(k.value);
      if (kv && kv.value.eq(parsed)) return k.misconception;
    }
    if (norm(k.value) === norm(value)) return k.misconception;
  }
  return null;
}

const ok = (feedback: string, method: CheckResult['method'], score = 1): CheckResult => ({ correct: true, score, feedback, misconception: null, method });
const wrong = (feedback: string, method: CheckResult['method'], misconception: string | null = null, score = 0): CheckResult => ({ correct: false, score, feedback, misconception, method });
const unreadable = (why: string): CheckResult => ({ correct: false, score: 0, feedback: why, misconception: null, unreadable: why, method: 'none' });

function checkNumber(q: Extract<Question, { type: 'numeric' }>, text: string): CheckResult {
  let raw = text.trim();
  if (q.unit) raw = raw.replace(new RegExp(`\\s*${q.unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '');
  raw = raw.replace(/^\$\s*/, '').replace(/\s*\$$/, '');
  if (!raw) return unreadable('Type a number first.');
  const p = parseStudentNumber(raw);
  if (!p) return unreadable(`“${text.trim()}” isn’t a number I can read. Use digits, a fraction like 3/4, a mixed number like 1 1/2, or a decimal.`);
  const want = parseStudentNumber(q.answer);
  if (!want) throw new Error(`Bad answer key for ${q.id}`);
  const tol = q.tolerance ? parseStudentNumber(q.tolerance)?.value ?? null : null;
  const right = tol ? p.value.sub(want.value).abs().cmp(tol) <= 0 : p.value.eq(want.value);
  if (!right) return wrong('Not quite.', tol ? 'tolerance' : 'equivalent', wrongFor(q, raw, p.value));
  if (q.accept && !q.accept.includes(p.form)) {
    const forms = q.accept.map((f) => ({ integer: 'a whole number', fraction: 'a fraction', mixed: 'a mixed number', decimal: 'a decimal', percent: 'a percent' })[f]).join(' or ');
    return { correct: false, score: 0.5, feedback: `That value is right, but the question asks for ${forms}.`, misconception: null, method: 'equivalent' };
  }
  if (q.requireSimplest && (p.form === 'fraction' || p.form === 'mixed')) {
    const typed = /(\d+)\s*\/\s*(\d+)\s*$/.exec(raw);
    if (typed && new Rational(BigInt(typed[1]!), BigInt(typed[2]!)).d !== BigInt(typed[2]!)) {
      return { correct: false, score: 0.5, feedback: 'That is equal to the answer, but it can be simplified further.', misconception: 'not_simplified', method: 'equivalent' };
    }
  }
  return ok(tol ? 'Correct (within the allowed rounding).' : 'Correct.', tol ? 'tolerance' : 'equivalent');
}

function checkExpression(q: Extract<Question, { type: 'expression' }>, text: string): CheckResult {
  if (!text.trim()) return unreadable('Type an answer first.');
  let typed;
  let key;
  try {
    typed = parseExpr(text);
  } catch (err) {
    return unreadable(err instanceof ParseError ? `I couldn’t read that: ${err.message}. Write it like 3x + 2 or 2(x − 1).` : 'I couldn’t read that answer.');
  }
  try {
    key = parseExpr(q.answer);
  } catch {
    throw new Error(`Bad answer key for ${q.id}`);
  }
  const extra = [...new Set(text.match(/[a-zA-Z]/g) ?? [])].filter((v) => !q.variables.includes(v));
  if (extra.length) return wrong(`Your answer uses ${extra.join(', ')}, which isn’t in the question.`, 'equivalent');
  if (!equivalent(typed, key)) return wrong('Not quite.', 'equivalent', wrongFor(q, text, null));
  if (q.requireSimplified && !isSimplified(typed)) {
    return { correct: false, score: 0.5, feedback: 'That is equal to the answer, but it isn’t fully simplified yet.', misconception: 'not_simplified', method: 'equivalent' };
  }
  return ok('Correct.', 'equivalent');
}

export function checkResponse(q: Question, r: Response): CheckResult {
  switch (q.type) {
    case 'multiple_choice': {
      if (r.type !== 'choice') return unreadable('Choose an answer first.');
      if (!q.choices.some((c) => c.id === r.choice)) return unreadable('Choose one of the options.');
      if (r.choice === q.answer) return ok('Correct.', 'exact');
      const chosen = q.choices.find((c) => c.id === r.choice);
      return wrong('Not quite.', 'exact', wrongFor(q, chosen?.text ?? r.choice, null) ?? q.knownWrong?.find((k) => k.value === r.choice)?.misconception ?? null);
    }
    case 'multiple_select': {
      if (r.type !== 'choices') return unreadable('Choose at least one answer.');
      const want = new Set(q.answers);
      const got = new Set(r.choices);
      const hits = [...got].filter((c) => want.has(c)).length;
      const falseHits = [...got].filter((c) => !want.has(c)).length;
      if (hits === want.size && falseHits === 0) return ok('Correct — you found all of them.', 'exact');
      const score = Math.max(0, (hits - falseHits) / want.size);
      return wrong(
        falseHits ? `${falseHits} of your choices ${falseHits === 1 ? 'is' : 'are'} not correct.` : `You found ${hits} of ${want.size}.`,
        'exact',
        null,
        Math.round(score * 100) / 100,
      );
    }
    case 'true_false':
      if (r.type !== 'bool') return unreadable('Choose true or false.');
      return r.value === q.answer ? ok('Correct.', 'exact') : wrong('Not quite.', 'exact', q.knownWrong?.[0]?.misconception ?? null);
    case 'numeric':
      if (r.type !== 'text') return unreadable('Type a number.');
      return checkNumber(q, r.text);
    case 'expression':
      if (r.type !== 'text') return unreadable('Type an answer.');
      return checkExpression(q, r.text);
    case 'code_trace': {
      if (r.type !== 'text') return unreadable('Type what the code prints.');
      const got = r.text.trim().replace(/\s+/g, ' ');
      const want = q.answer.trim().replace(/\s+/g, ' ');
      if (got === want) return ok('Correct — that is exactly what it prints.', 'exact');
      const gn = parseStudentNumber(got);
      const wn = parseStudentNumber(want);
      if (gn && wn && gn.value.eq(wn.value)) return ok('Correct.', 'equivalent');
      return wrong('Not quite. Trace the code one line at a time and keep track of each variable.', 'exact', wrongFor(q, got, gn?.value ?? null));
    }
    case 'short_answer': {
      if (r.type !== 'text' || !r.text.trim()) return unreadable('Type an answer first.');
      const got = norm(r.text);
      if (q.accepted.some((a) => norm(a) === got)) return ok('Correct.', 'exact');
      const num = parseStudentNumber(r.text);
      if (num && q.accepted.some((a) => parseStudentNumber(a)?.value.eq(num.value))) return ok('Correct.', 'equivalent');
      if (q.keywords?.length) {
        const found = q.keywords.filter((k) => got.includes(norm(k)));
        if (found.length === q.keywords.length) return ok('Your answer includes the key ideas.', 'keywords');
        if (found.length) return { correct: false, score: found.length / q.keywords.length, feedback: `Partly there: your answer mentions ${found.join(', ')}.`, misconception: null, method: 'keywords' };
      }
      return wrong('That isn’t one of the answers we can recognise.', 'exact', wrongFor(q, r.text, null));
    }
    case 'fill_blank': {
      if (r.type !== 'blanks') return unreadable('Fill in the blanks.');
      let right = 0;
      q.blanks.forEach((b, i) => {
        const v = r.values[i] ?? '';
        if (b.numeric) {
          const p = parseStudentNumber(v);
          if (p && b.accepted.some((a) => parseStudentNumber(a)?.value.eq(p.value))) right++;
        } else if (b.accepted.some((a) => norm(a) === norm(v))) right++;
      });
      if (right === q.blanks.length) return ok('Correct.', 'exact');
      return wrong(`${right} of ${q.blanks.length} blanks are right.`, 'exact', null, right / q.blanks.length);
    }
    case 'matching': {
      if (r.type !== 'pairs') return unreadable('Match the items first.');
      const keys = Object.keys(q.pairs);
      const right = keys.filter((k) => r.pairs[k] === q.pairs[k]).length;
      if (right === keys.length) return ok('All matched correctly.', 'exact');
      return wrong(`${right} of ${keys.length} matched correctly.`, 'exact', null, right / keys.length);
    }
    case 'ordering': {
      if (r.type !== 'order') return unreadable('Put the items in order first.');
      const right = q.order.filter((id, i) => r.order[i] === id).length;
      if (right === q.order.length) return ok('That is the right order.', 'exact');
      return wrong(`${right} of ${q.order.length} are in the right place.`, 'exact', null, right / q.order.length);
    }
    case 'written': {
      if (r.type !== 'written' || !r.text.trim()) return unreadable('Write your answer first.');
      const words = r.text.trim().split(/\s+/).length;
      if (q.minWords && words < q.minWords) return unreadable(`Write at least ${q.minWords} words so there is something to give feedback on (you have ${words}).`);
      const scores = r.selfScores ? Object.values(r.selfScores) : [];
      const max = q.rubric.reduce((a, c) => a + c.levels.length - 1, 0);
      const self = scores.length && max ? scores.reduce((a, b) => a + b, 0) / max : null;
      return {
        correct: null,
        score: self ?? 0,
        feedback: self === null ? 'Written answers are not marked automatically. Compare yours with the rubric and the sample answer.' : 'You assessed your answer against the rubric. Self-assessment is not counted as proof of mastery.',
        misconception: null,
        method: self === null ? 'none' : 'self',
      };
    }
  }
}

/** The correct answer written out for the student, after they have answered. */
export function answerText(q: Question): string {
  switch (q.type) {
    case 'multiple_choice':
      return q.choices.find((c) => c.id === q.answer)?.text ?? '';
    case 'multiple_select':
      return q.choices
        .filter((c) => q.answers.includes(c.id))
        .map((c) => c.text)
        .join('; ');
    case 'true_false':
      return q.answer ? 'True' : 'False';
    case 'numeric':
      return `${q.answer}${q.unit ? ` ${q.unit}` : ''}`;
    case 'expression':
      return q.answer;
    case 'code_trace':
      return q.answer;
    case 'short_answer':
      return q.accepted[0] ?? '';
    case 'fill_blank':
      return q.blanks.map((b) => b.accepted[0]).join(', ');
    case 'matching':
      return q.left.map((l) => `${l.text} → ${q.right.find((x) => x.id === q.pairs[l.id])?.text ?? ''}`).join('; ');
    case 'ordering':
      return q.order.map((id) => q.items.find((i) => i.id === id)?.text ?? '').join(' → ');
    case 'written':
      return q.sampleAnswer ?? '';
  }
}

/** Questions where the answer appears among the options count as recognition, not application. */
export function isRecognition(q: Question): boolean {
  return q.type === 'multiple_choice' || q.type === 'multiple_select' || q.type === 'true_false' || q.type === 'matching';
}
