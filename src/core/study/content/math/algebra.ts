import { equivalent, evaluate, isSimplified, parseExpr, toPoly } from '../../../../shared/study/expr';
import { parseStudentNumber, R, Rational } from '../../../../shared/study/rational';
import type { Block, KnownWrong, Question } from '../../../../shared/study/types';
import { choice, expression, list, m, money, numeric, p, steps, tex, tip, trueFalse, warn, type Draft, type Rng, type SkillPack } from '../kit';

/**
 * Algebra packs (Grades 6–9): evaluating expressions, collecting like terms, solving equations and inequalities,
 * pattern rules, linear relations and reading code. Every answer key is computed with exact rationals; each
 * selfCheck recomputes it another way (floating point, substitution back into the equation, enumeration,
 * iterating a pattern, closed-form sums for loops, or polynomial equivalence for expressions).
 */

const G6 = 'on-elementary-mathematics-g6-math';
const G7 = 'on-elementary-mathematics-g7-math';
const G8 = 'on-elementary-mathematics-g8-math';
const W = 'on-mth1w';

const NAMES = ['Amira', 'Liam', 'Priya', 'Mateo', 'Aiyana', 'Noah', 'Mei', 'Jaden', 'Zara', 'Owen', 'Fatima', 'Kai', 'Sofia', 'Ethan', 'Nia', 'Arjun', 'Chloé', 'Malik', 'Hana', 'Lucas'] as const;

// ─────────── Numbers and formatting ───────────

const rat = (v: Rational | number) => Rational.of(v);
/** A decimal from a whole number of tenths (or hundredths). */
const dz = (n: number, den = 10) => R(n, den);

/** A number inside LaTeX: 12, -3.5, \frac{2}{3}. */
function nl(v: Rational | number): string {
  const r = rat(v);
  return r.toDecimal(6) ?? r.toLatex();
}
/** A number for plain text, with a true minus sign; repeating fractions as inline LaTeX. */
function nt(v: Rational | number): string {
  const r = rat(v);
  const d = r.toDecimal(6);
  return d ? d.replace('-', '−') : tex(r.toLatex());
}
/** A number as a student would type it (answer keys): 12, -3.5, 7/3. */
function na(v: Rational | number): string {
  const r = rat(v);
  return r.toDecimal(6) ?? r.toString();
}
/** A number inside a LaTeX sum: negative numbers go in brackets. */
const nb = (v: Rational | number) => (rat(v).cmp(0) < 0 ? `(${nl(v)})` : nl(v));

type Term = [Rational | number, string];

/** A sum of terms written cleanly (no 1x, + -3 or 0x), as LaTeX and as typed text. Like terms are NOT combined. */
function lin(terms: Term[]): { tex: string; asc: string } {
  const parts = terms.map(([c, v]) => [rat(c), v] as const).filter(([c]) => !c.isZero());
  if (!parts.length) return { tex: '0', asc: '0' };
  let t = '';
  let a = '';
  parts.forEach(([c, v], i) => {
    const neg = c.cmp(0) < 0;
    const abs = c.abs();
    const one = v && abs.eq(1);
    const ct = one ? '' : nl(abs);
    const ca = one ? '' : abs.toDecimal(6) ? na(abs) : `(${abs.toString()})`;
    if (i === 0) {
      t += `${neg ? '-' : ''}${ct}${v}`;
      a += `${neg ? '-' : ''}${ca}${v}`;
    } else {
      t += ` ${neg ? '-' : '+'} ${ct}${v}`;
      a += ` ${neg ? '-' : '+'} ${ca}${v}`;
    }
  });
  return { tex: t, asc: a };
}
/** A monomial: 3x, -x, x. */
const mono = (c: number | Rational, v: string) => lin([[c, v]]).asc;

/** Known wrong numeric answers: drops missing values, duplicates and anything equal to the key. */
function wrongs(correct: Rational, list: [Rational | null, string][]): KnownWrong[] {
  const seen: Rational[] = [correct];
  const out: KnownWrong[] = [];
  for (const [v, mis] of list) {
    if (!v || seen.some((s) => s.eq(v))) continue;
    seen.push(v);
    out.push({ value: na(v), misconception: mis });
  }
  return out;
}
/** Known wrong expressions: drops duplicates and anything equivalent to the key. */
function exprWrongs(key: string, list: [string, string][]): KnownWrong[] {
  const k = parseExpr(key);
  const seen = new Set<string>();
  const out: KnownWrong[] = [];
  for (const [v, mis] of list) {
    if (seen.has(v)) continue;
    seen.add(v);
    try {
      if (!equivalent(parseExpr(v), k)) out.push({ value: v, misconception: mis });
    } catch {
      // not a readable expression: skip it
    }
  }
  return out;
}
const safe = (f: () => Rational): Rational | null => {
  try {
    return f();
  } catch {
    return null;
  }
};

// ─────────── selfCheck helpers ───────────

const keyNum = (q: Question): Rational | null => (q.type === 'numeric' || q.type === 'code_trace' ? (parseStudentNumber(q.answer)?.value ?? null) : null);
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
const fl = (s: unknown) => parseStudentNumber(String(s))?.value.toNumber() ?? Number.NaN;
const rq = (s: unknown) => parseStudentNumber(String(s))?.value ?? R(0);
const rightText = (q: Question) => (q.type === 'multiple_choice' ? (q.choices.find((c) => c.id === q.answer)?.text ?? '') : '');
const otherTexts = (q: Question) => (q.type === 'multiple_choice' ? q.choices.filter((c) => c.id !== q.answer).map((c) => c.text) : []);
const strip = (s: string) => s.replace(/\$\$/g, '').trim();
const evalAt = (src: string, env: Record<string, Rational>) => evaluate(parseExpr(src), env);
const numIs = (q: Question, want: number, what: string) => {
  const k = keyNum(q);
  return k && close(k.toNumber(), want) ? null : `${what}: key ${q.type === 'numeric' ? q.answer : '?'} is not ${want}`;
};

function nameOf(rng: Rng): string {
  return rng.pick(NAMES);
}

// ═══════════════════════ Pack 1: evaluating expressions ═══════════════════════

type PT = { c: Rational; v: string; p: number };
const term = (c: Rational | number, v = '', pw = 1): PT => ({ c: rat(c), v, p: pw });
const ptName = (t: PT) => (t.v ? (t.p > 1 ? `${t.v}^${t.p}` : t.v) : '');
const ptTex = (ts: PT[]) => lin(ts.map((t) => [t.c, ptName(t)] as Term)).tex;
const ptVal = (t: PT, vals: Record<string, Rational>) => (t.v ? t.c.mul(vals[t.v]!.pow(t.p)) : t.c);
function ptSub(ts: PT[], vals: Record<string, Rational>): string {
  return ts
    .map((t, i) => {
      const neg = t.c.cmp(0) < 0;
      const a = t.c.abs();
      const body = t.v ? `${a.eq(1) ? '' : nl(a)}(${nl(vals[t.v]!)})${t.p > 1 ? `^${t.p}` : ''}` : nl(a);
      return i === 0 ? `${neg ? '-' : ''}${body}` : ` ${neg ? '-' : '+'} ${body}`;
    })
    .join('');
}
const sumTex = (vs: Rational[]) => vs.map((x, i) => (i === 0 ? nl(x) : x.cmp(0) < 0 ? ` - ${nl(x.abs())}` : ` + ${nl(x)}`)).join('');

function evalDraft(ts: PT[], vals: Record<string, Rational>, extra: [Rational | null, string][] = []): Draft {
  const tv = ts.map((t) => ptVal(t, vals));
  const ans = tv.reduce((s, x) => s.add(x), R(0));
  const letters = Object.keys(vals);
  const given = letters.map((l) => `$$${l} = ${nl(vals[l]!)}$$`).join(' and ');
  const hasPow = ts.some((t) => t.p > 1);
  const first = ts.find((t) => t.v)!;
  const list: [Rational | null, string][] = [...extra];
  // 3x with x = 4 read as 34.
  const cc = ts.find((t) => t.v && t.p === 1 && t.c.isInteger() && t.c.cmp(2) >= 0 && t.c.cmp(9) <= 0 && vals[t.v]!.isInteger() && vals[t.v]!.cmp(1) >= 0 && vals[t.v]!.cmp(9) <= 0);
  if (cc) list.push([ans.sub(ptVal(cc, vals)).add(Number(`${cc.c.n}${vals[cc.v]!.n}`)), 'alg_sub_concat']);
  for (const t of ts.filter((x) => x.p === 2)) {
    list.push([ans.sub(ptVal(t, vals)).add(t.c.mul(vals[t.v]!).pow(2)), 'alg_power_coef']);
    list.push([ans.sub(ptVal(t, vals)).add(t.c.mul(vals[t.v]!).mul(2)), 'alg_square_double']);
  }
  if (letters.some((l) => vals[l]!.cmp(0) < 0)) {
    const absVals = Object.fromEntries(letters.map((l) => [l, vals[l]!.abs()]));
    list.push([ts.reduce((s, t) => s.add(ptVal(t, absVals)), R(0)), 'alg_neg_value']);
  }
  const fv = vals[first.v]!;
  return numeric([p(`Evaluate the expression when ${given}.`), m(ptTex(ts))], na(ans), {
    hints: [
      `Rewrite the expression with each value in brackets where its letter was. ${hasPow ? 'Then do the powers first.' : 'Then multiply before you add or subtract.'}`,
      `Start with the first term: $$${ptSub([first], vals)} = ${nl(ptVal(first, vals))}$$${fv.cmp(0) < 0 ? ' (watch the signs)' : ''}.`,
    ],
    solution: [
      steps(
        { text: 'Replace each letter with its value, in brackets.', math: ptSub(ts, vals) },
        { text: hasPow ? 'Work out the powers, then multiply each term.' : 'Multiply each term first.', math: `= ${sumTex(tv)}` },
        { text: 'Add and subtract from left to right.', math: `= ${nl(ans)}` },
      ),
    ],
    knownWrong: wrongs(ans, list),
    params: { kind: 'poly', terms: ts.map((t) => [t.c.toString(), t.v, t.p]), vals: Object.fromEntries(letters.map((l) => [l, vals[l]!.toString()])) },
  });
}

const LETTER_PAIRS = [
  ['x', 'y'],
  ['m', 'n'],
  ['a', 'b'],
  ['p', 'q'],
  ['r', 's'],
] as const;

/** a·x + b with whole numbers (warm-up for every grade). Sometimes written constant-first to test the order of operations. */
function evalSimple(rng: Rng): Draft {
  const [x] = rng.pick(LETTER_PAIRS);
  const a = rng.int(2, 9);
  const b = rng.int(1, 20);
  const xv = R(rng.int(2, 9));
  const constFirst = rng.chance(0.4);
  const ts = constFirst ? [term(b), term(a, x)] : [term(a, x), term(b)];
  return evalDraft(ts, { [x]: xv }, constFirst ? [[R(b + a).mul(xv), 'alg_order_ops']] : []);
}

/** Pick a value for a letter by grade: tenths in Grade 6, hundredths in Grade 7, integers and fractions in Grade 8. */
function evalLevel(rng: Rng, g: number, d: number): Draft {
  const [x, y] = rng.pick(LETTER_PAIRS);
  if (g <= 6) {
    if (d === 2) {
      if (rng.chance(0.5)) return evalDraft([term(rng.int(2, 9), x), term(rng.int(1, 15))], { [x]: dz(rng.int(11, 99)) });
      return evalDraft([term(rng.int(2, 9), x), term(rng.int(2, 9), y), term(-rng.int(1, 5))], { [x]: R(rng.int(3, 9)), [y]: dz(rng.int(11, 99)) });
    }
    return evalDraft([term(rng.int(2, 9), x), term(rng.int(2, 9), y), term(-rng.int(1, 4))], { [x]: dz(rng.int(15, 99)), [y]: dz(rng.int(15, 99)) });
  }
  if (g === 7) {
    if (d === 2) return evalDraft([term(dz(rng.int(15, 95)), x), term(dz(rng.int(5, 99)))], { [x]: rng.chance(0.5) ? dz(rng.int(11, 99)) : dz(rng.int(101, 999), 100) });
    if (d === 3) {
      const xv = dz(rng.int(11, 99));
      const yv = dz(rng.int(101, 999), 100);
      const a = rng.int(2, 9);
      const b = rng.int(2, 9);
      const minus = R(a).mul(xv).cmp(R(b).mul(yv)) > 0;
      return evalDraft([term(a, x), term(minus ? -b : b, y), term(dz(rng.int(5, 50)))], { [x]: xv, [y]: yv });
    }
    return evalDraft([term(rng.int(2, 5), x, 2), term(rng.int(2, 9), y), term(-rng.int(1, 9))], { [x]: dz(rng.int(11, 39)), [y]: R(rng.int(2, 9)) });
  }
  // Grade 8: rational numbers, including negatives and fractions.
  if (d === 2) {
    let xv = rng.signed(1, 9);
    const yv = rng.signed(1, 9);
    if (xv > 0 && yv > 0) xv = -xv;
    return evalDraft([term(rng.signed(2, 9), x), term(rng.signed(2, 9), y), term(rng.signed(1, 12))], { [x]: R(xv), [y]: R(yv) });
  }
  const frac = () => {
    const den = rng.pick([2, 3, 4, 5]);
    let num = rng.int(1, 2 * den - 1);
    if (num % den === 0) num++;
    return R(num * (rng.chance(0.5) ? -1 : 1), den);
  };
  if (d === 3) {
    const xv = frac();
    const a = rng.signed(2, 9);
    return rng.chance(0.5) ? evalDraft([term(a, x), term(rng.signed(1, 12))], { [x]: xv }) : evalDraft([term(a, x), term(rng.signed(2, 9), y)], { [x]: xv, [y]: R(rng.signed(1, 9)) });
  }
  const xv = rng.chance(0.5) ? R(-rng.int(2, 6)) : rng.pick([R(1, 2), R(-1, 2), R(3, 2), R(-3, 2), R(2, 3), R(-2, 3)]);
  return evalDraft([term(rng.signed(2, 5), x, 2), term(rng.signed(2, 9), x), term(rng.signed(1, 9))], { [x]: xv });
}

function evalSubstChoice(rng: Rng): Draft {
  const [x] = rng.pick(LETTER_PAIRS);
  const a = rng.int(2, 9);
  const v = rng.int(2, 9);
  const b = rng.int(1, 20);
  return choice(
    rng,
    [p(`Which shows $$${x} = ${v}$$ substituted correctly into $$${a}${x} + ${b}$$?`)],
    `$$${a}(${v}) + ${b}$$`,
    [
      { text: `$$${a}${v} + ${b}$$`, misconception: 'alg_sub_concat' },
      { text: `$$${a} + ${v} + ${b}$$`, misconception: 'alg_coef_add' },
      { text: `$$${a}(${v} + ${b})$$`, misconception: 'alg_order_ops' },
    ],
    {
      hints: [`$$${a}${x}$$ means $$${a} \\times ${x}$$.`, `Put $$${v}$$ in brackets where $$${x}$$ was, so the ${a} multiplies it.`],
      solution: [p(`$$${a}${x}$$ means ${a} times $$${x}$$, so it becomes $$${a}(${v})$$. The $$+ ${b}$$ is added after multiplying: $$${a}(${v}) + ${b} = ${a * v} + ${b} = ${a * v + b}$$.`)],
      params: { kind: 'subst', a, v, b },
    },
  );
}

function evalPowerTF(rng: Rng, g: number): Draft {
  if (g >= 8 && rng.chance(0.5)) {
    const v = -rng.int(2, 9);
    const truth = rng.chance(0.5);
    const claim = truth ? v * v : -(v * v);
    return trueFalse([p(`True or false: when $$x = ${v}$$, the value of $$x^2$$ is $$${claim}$$.`)], truth, {
      hints: ['$$x^2$$ means $$x \\times x$$. Write the value in brackets first.', `$$(${v})^2 = (${v}) \\times (${v})$$. What is a negative times a negative?`],
      solution: [m(`(${v})^2 = (${v}) \\times (${v}) = ${v * v}`), p(`So the statement is **${truth ? 'true' : 'false'}**.`)],
      misconception: truth ? undefined : 'alg_neg_square',
      params: { kind: 'tf', k: 1, v, claim },
    });
  }
  const k = rng.int(2, 5);
  const v = g >= 8 ? R(rng.signed(2, 6)) : rng.chance(0.5) ? R(rng.int(2, 6)) : dz(rng.int(11, 29));
  const truth = rng.chance(0.5);
  const right = R(k).mul(v.pow(2));
  const claim = truth ? right : R(k).mul(v).pow(2);
  return trueFalse([p(`True or false: when $$m = ${nl(v)}$$, the value of $$${k}m^2$$ is $$${nl(claim)}$$.`)], truth, {
    hints: ['In $$' + k + 'm^2$$, only the $$m$$ is squared. The exponent is worked out before multiplying.', `Find $$(${nl(v)})^2$$ first, then multiply by ${k}.`],
    solution: [m(`${k}(${nl(v)})^2 = ${k}(${nl(v.pow(2))}) = ${nl(right)}`), p(`So the statement is **${truth ? 'true' : 'false'}**.${truth ? '' : ` $$${nl(claim)}$$ comes from squaring $$${k} \\times ${nl(v)}$$, which squares the ${k} too.`}`)],
    misconception: truth ? undefined : 'alg_power_coef',
    params: { kind: 'tf', k, v: v.toString(), claim: claim.toString() },
  });
}

function evalFormula(rng: Rng, g: number): Draft {
  const ids = g <= 6 ? ['rectP', 'triA', 'cost'] : g === 7 ? ['rectP', 'triA', 'trapA', 'prismV'] : ['tempF', 'ballH', 'triFrac'];
  const f = rng.pick(ids);
  const t6 = () => dz(rng.int(11, 99));
  const t7 = () => (rng.chance(0.5) ? dz(rng.int(11, 99)) : dz(rng.int(101, 999), 100));
  switch (f) {
    case 'rectP': {
      const l = g <= 6 ? dz(rng.int(31, 99)) : t7();
      const w = g <= 6 ? dz(rng.int(11, 30)) : t7();
      const ans = l.mul(2).add(w.mul(2));
      return numeric([p(`The perimeter of a rectangle is given by the formula $$P = 2l + 2w$$. Find the perimeter, in centimetres, of a rectangle with $$l = ${nl(l)}$$ cm and $$w = ${nl(w)}$$ cm.`)], na(ans), {
        hints: ['Substitute the length for $$l$$ and the width for $$w$$, in brackets.', `$$P = 2(${nl(l)}) + 2(${nl(w)})$$. Multiply first, then add.`],
        solution: [steps({ text: 'Substitute.', math: `P = 2(${nl(l)}) + 2(${nl(w)})` }, { text: 'Multiply.', math: `= ${nl(l.mul(2))} + ${nl(w.mul(2))}` }, { text: 'Add.', math: `= ${nl(ans)} \\text{ cm}` })],
        unit: 'cm',
        knownWrong: wrongs(ans, [[l.add(w), 'alg_skip_coef']]),
        params: { kind: 'formula', f, l: l.toString(), w: w.toString() },
      });
    }
    case 'triA': {
      const b = g <= 6 ? t6() : t7();
      const h = g <= 6 ? R(rng.int(2, 12)) : t6();
      const ans = b.mul(h).div(2);
      return numeric([p(`The area of a triangle is $$A = bh \\div 2$$. Find the area, in square centimetres, when $$b = ${nl(b)}$$ cm and $$h = ${nl(h)}$$ cm.`)], na(ans), {
        hints: ['$$bh$$ means $$b \\times h$$.', `Work out $$${nl(b)} \\times ${nl(h)}$$, then divide by 2.`],
        solution: [steps({ text: 'Substitute.', math: `A = (${nl(b)})(${nl(h)}) \\div 2` }, { text: 'Multiply.', math: `= ${nl(b.mul(h))} \\div 2` }, { text: 'Divide.', math: `= ${nl(ans)} \\text{ cm}^2` })],
        unit: 'cm²',
        knownWrong: wrongs(ans, [[b.mul(h), 'alg_skip_coef']]),
        params: { kind: 'formula', f, b: b.toString(), h: h.toString() },
      });
    }
    case 'cost': {
      const r = dz(rng.int(5, 45));
      const fee = rng.int(2, 9);
      const n = rng.int(3, 12);
      const ans = r.mul(n).add(fee);
      return numeric([p(`A bowling alley uses the expression $$${nl(r)}g + ${fee}$$ to find the cost, in dollars, of bowling $$g$$ games, including shoe rental. What is the cost of ${n} games? Answer in dollars.`)], na(ans), {
        hints: [`Replace $$g$$ with ${n}.`, `$$${nl(r)}(${n})$$ first, then add ${fee}.`],
        solution: [steps({ text: 'Substitute.', math: `${nl(r)}(${n}) + ${fee}` }, { text: 'Multiply.', math: `= ${nl(r.mul(n))} + ${fee}` }, { text: 'Add.', math: `= ${nl(ans)}` }), p(`The cost is ${money(ans)}.`)],
        knownWrong: wrongs(ans, [[r.mul(R(n).add(fee)), 'alg_order_ops']]),
        params: { kind: 'formula', f, r: r.toString(), fee, n },
      });
    }
    case 'trapA': {
      const a = t6();
      const b = t6();
      const h = R(rng.int(2, 12));
      const ans = a.add(b).div(2).mul(h);
      return numeric([p(`The area of a trapezoid is $$A = \\left(\\frac{a + b}{2}\\right)h$$. Find the area, in square centimetres, when $$a = ${nl(a)}$$ cm, $$b = ${nl(b)}$$ cm and $$h = ${nl(h)}$$ cm.`)], na(ans), {
        hints: ['Work out the brackets first: add $$a$$ and $$b$$, then divide by 2.', `$$\\frac{${nl(a)} + ${nl(b)}}{2} = ${nl(a.add(b).div(2))}$$. Now multiply by $$h$$.`],
        solution: [steps({ text: 'Substitute.', math: `A = \\left(\\frac{${nl(a)} + ${nl(b)}}{2}\\right)(${nl(h)})` }, { text: 'Brackets first.', math: `= (${nl(a.add(b).div(2))})(${nl(h)})` }, { text: 'Multiply.', math: `= ${nl(ans)} \\text{ cm}^2` })],
        unit: 'cm²',
        knownWrong: wrongs(ans, [[a.add(b).mul(h), 'alg_skip_coef'], [a.add(b.div(2)).mul(h), 'alg_order_ops']]),
        params: { kind: 'formula', f, a: a.toString(), b: b.toString(), h: h.toString() },
      });
    }
    case 'prismV': {
      const l = t6();
      const w = t6();
      const h = R(rng.int(2, 9));
      const ans = l.mul(w).mul(h);
      return numeric([p(`The volume of a rectangular prism is $$V = lwh$$. Find the volume, in cubic centimetres, when $$l = ${nl(l)}$$ cm, $$w = ${nl(w)}$$ cm and $$h = ${nl(h)}$$ cm.`)], na(ans), {
        hints: ['$$lwh$$ means $$l \\times w \\times h$$.', `First $$${nl(l)} \\times ${nl(w)} = ${nl(l.mul(w))}$$.`],
        solution: [steps({ text: 'Substitute.', math: `V = (${nl(l)})(${nl(w)})(${nl(h)})` }, { text: 'Multiply the first two.', math: `= (${nl(l.mul(w))})(${nl(h)})` }, { text: 'Multiply by the height.', math: `= ${nl(ans)} \\text{ cm}^3` })],
        unit: 'cm³',
        knownWrong: wrongs(ans, [[l.add(w).add(h), 'alg_skip_coef']]),
        params: { kind: 'formula', f, l: l.toString(), w: w.toString(), h: h.toString() },
      });
    }
    case 'tempF': {
      const c = -5 * rng.int(1, 8);
      const ans = dz(18).mul(c).add(32);
      return numeric([p(`To change a temperature from degrees Celsius to degrees Fahrenheit, use $$F = 1.8C + 32$$. A winter morning in Winnipeg is $$${c}$$ °C. What is that in degrees Fahrenheit?`)], na(ans), {
        hints: ['Put the Celsius temperature in brackets: $$1.8(' + c + ') + 32$$.', `A positive times a negative is negative: $$1.8(${c}) = ${nl(dz(18).mul(c))}$$.`],
        solution: [steps({ text: 'Substitute.', math: `F = 1.8(${c}) + 32` }, { text: 'Multiply.', math: `= ${nl(dz(18).mul(c))} + 32` }, { text: 'Add.', math: `= ${nl(ans)}` })],
        knownWrong: wrongs(ans, [[dz(18).mul(-c).add(32), 'alg_neg_value']]),
        params: { kind: 'formula', f, c },
      });
    }
    case 'ballH': {
      const t = rng.pick([R(1, 2), R(1), R(3, 2), R(2), R(5, 2), R(3), R(7, 2)]);
      const ans = t.mul(20).sub(t.pow(2).mul(5));
      return numeric([p(`A ball is thrown upward. Its height in metres after $$t$$ seconds is $$h = 20t - 5t^2$$. Find its height when $$t = ${nl(t)}$$.`)], na(ans), {
        hints: ['Do the power first: square $$t$$ before multiplying by 5.', `$$(${nl(t)})^2 = ${nl(t.pow(2))}$$.`],
        solution: [steps({ text: 'Substitute.', math: `h = 20(${nl(t)}) - 5(${nl(t)})^2` }, { text: 'Power first.', math: `= 20(${nl(t)}) - 5(${nl(t.pow(2))})` }, { text: 'Multiply.', math: `= ${nl(t.mul(20))} - ${nl(t.pow(2).mul(5))}` }, { text: 'Subtract.', math: `= ${nl(ans)} \\text{ m}` })],
        unit: 'm',
        knownWrong: wrongs(ans, [[t.mul(20).sub(t.mul(5).pow(2)), 'alg_power_coef'], [t.mul(20).sub(t.mul(10)), 'alg_square_double']]),
        params: { kind: 'formula', f, t: t.toString() },
      });
    }
    default: {
      const b = R(rng.int(1, 7), rng.pick([2, 3, 4]));
      const h = R(rng.int(1, 9), rng.pick([2, 3, 5]));
      const ans = b.mul(h).div(2);
      return numeric([p(`The area of a triangle is $$A = \\frac{1}{2}bh$$. Find the area, in square metres, when $$b = ${nl(b)}$$ m and $$h = ${nl(h)}$$ m. Give your answer as a fraction or a decimal.`)], na(ans), {
        hints: ['Multiply the fractions: numerators together, denominators together.', `$$\\frac{1}{2} \\times ${nl(b)} \\times ${nl(h)}$$`],
        solution: [steps({ text: 'Substitute.', math: `A = \\frac{1}{2}\\left(${nl(b)}\\right)\\left(${nl(h)}\\right)` }, { text: 'Multiply.', math: `= ${nl(ans)} \\text{ m}^2` })],
        unit: 'm²',
        knownWrong: wrongs(ans, [[b.mul(h), 'alg_skip_coef']]),
        params: { kind: 'formula', f: 'triFrac', b: b.toString(), h: h.toString() },
      });
    }
  }
}

export const evaluateExpressions: SkillPack = {
  id: 'eval-expr',
  title: 'Evaluating algebraic expressions',
  subject: 'math',
  expectations: [
    { id: `${G6}:C2.2`, note: 'Evaluates expressions and formulas (perimeter, area, cost) by substituting whole numbers and decimal tenths and following the order of operations.', levels: [1, 2, 3] },
    { id: `${G7}:C2.2`, note: 'Evaluates expressions and formulas (perimeter, area of triangles and trapezoids, volume of prisms) with whole numbers and decimal numbers, including expressions with a squared term.', levels: [1, 2, 3, 4] },
    { id: `${G8}:C2.2`, note: 'Evaluates expressions and formulas with rational numbers: negative integers, fractions and decimals, including squared terms. Expressions with π are not included.', levels: [2, 3, 4] },
  ],
  prerequisites: [],
  goal: 'I can evaluate an algebraic expression by replacing each variable with its value and following the order of operations.',
  explain: (c) => [
    p('An **algebraic expression** uses letters, called **variables**, to stand for numbers, like $$3m + 2n - 1$$. To **evaluate** it, replace each letter with its value and calculate.'),
    steps(
      { text: 'Rewrite the expression with each value in brackets where its letter was. A number right next to a bracket means multiply.', math: '4.5m \\text{ with } m = 7: \\quad 4.5(7)' },
      { text: 'Follow the order of operations: brackets, exponents, then multiply and divide, then add and subtract.', math: '4.5(7) + 3 = 31.5 + 3' },
      { text: 'Finish the calculation.', math: '= 34.5' },
    ),
    warn('$$3x$$ with $$x = 4$$ is $$3 \\times 4 = 12$$, not 34. The brackets stop the digits from running together.'),
    ...(c.grade >= 8 ? [p('With negative numbers, brackets matter even more: when $$x = -3$$, $$x^2 = (-3)^2 = 9$$, because a negative times a negative is positive.')] : []),
    c.simple ? tip('Swap each letter for its number, then do the math in the right order.') : tip('Formulas such as $$P = 2l + 2w$$ are expressions too. Using a formula means substituting and calculating.'),
  ],
  alternatives: (c) => ({
    simpler: [p('A letter is a box with a number hidden inside. Open the box (put the number in brackets), then calculate.'), m('2x + 5, \\; x = 3: \\quad 2(3) + 5 = 6 + 5 = 11')],
    analogy: [p('An expression is like a recipe for a number. $$2l + 2w$$ says: “double the length, double the width, add them”. Substituting is putting in the ingredients; evaluating is following the recipe in order.')],
    steps: [steps({ text: 'Write the expression again.' }, { text: 'Replace each letter with its value in brackets.' }, { text: 'Do powers, then multiplication and division.' }, { text: 'Then addition and subtraction, left to right.' })],
    visual: [
      { kind: 'table', header: ['Expression', 'Substitute', 'Value'], rows: [['$$3x + 2$$, $$x = 4$$', '$$3(4) + 2$$', '14'], ['$$2l + 2w$$, $$l = 6.5$$, $$w = 5.1$$', '$$2(6.5) + 2(5.1)$$', '23.2'], [c.grade >= 8 ? '$$x^2 - 2x$$, $$x = -3$$' : '$$2m^2$$, $$m = 3$$', c.grade >= 8 ? '$$(-3)^2 - 2(-3)$$' : '$$2(3)^2$$', c.grade >= 8 ? '15' : '18']] },
    ],
    compare: [p('You already use formulas: the perimeter of a square is 4 times the side. Writing that as $$P = 4s$$ and putting in $$s = 2.5$$ gives $$4(2.5) = 10$$.')],
  }),
  example: (rng, c) => {
    const a = rng.int(2, 6);
    const b = rng.int(2, 9);
    const xv = c.grade >= 8 ? R(-rng.int(2, 5)) : c.grade === 7 ? dz(rng.int(11, 49)) : R(rng.int(2, 9));
    const ans = R(a).mul(xv).add(b);
    return [
      p(`Evaluate $$${a}x + ${b}$$ when $$x = ${nl(xv)}$$.`),
      steps({ text: 'Substitute, using brackets.', math: `${a}(${nl(xv)}) + ${b}` }, { text: 'Multiply first.', math: `= ${nl(R(a).mul(xv))} + ${b}` }, { text: 'Then add.', math: `= ${nl(ans)}` }),
    ];
  },
  generate: (rng, d, c) => {
    const g = c.grade;
    if (d === 1) return rng.chance(0.35) ? evalSubstChoice(rng) : evalSimple(rng);
    if (d === 3) return rng.chance(0.6) ? evalFormula(rng, g) : evalLevel(rng, g, 3);
    if (g >= 7 && rng.chance(d === 4 ? 0.3 : 0.15)) return evalPowerTF(rng, g);
    return evalLevel(rng, g, d);
  },
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Record<string, unknown>;
    switch (pr.kind) {
      case 'poly': {
        const vals = pr.vals as Record<string, string>;
        const want = (pr.terms as [string, string, number][]).reduce((s, [c, v, pw]) => s + fl(c) * (v ? fl(vals[v]) ** pw : 1), 0);
        return numIs(q, want, 'expression value');
      }
      case 'subst': {
        const want = Number(pr.a) * Number(pr.v) + Number(pr.b);
        const got = evalAt(strip(rightText(q)), {}).toNumber();
        if (!close(got, want)) return 'substitution choice has the wrong value';
        return otherTexts(q).some((t) => strip(t) === `${pr.a}(${pr.v}) + ${pr.b}`) ? 'duplicate correct option' : null;
      }
      case 'tf': {
        const truth = close(Number(pr.k) * fl(pr.v) * fl(pr.v), fl(pr.claim));
        return q.type === 'true_false' && q.answer === truth ? null : 'true/false key is wrong';
      }
      case 'formula': {
        const n = (k: string) => fl(pr[k]);
        const want: Record<string, () => number> = {
          rectP: () => 2 * (n('l') + n('w')),
          triA: () => 0.5 * n('b') * n('h'),
          cost: () => n('r') * n('n') + n('fee'),
          trapA: () => (n('a') * n('h') + n('b') * n('h')) / 2,
          prismV: () => n('l') * n('w') * n('h'),
          tempF: () => (n('c') * 9) / 5 + 32,
          ballH: () => 5 * n('t') * (4 - n('t')),
          triFrac: () => (n('b') * n('h')) / 2,
        };
        const f = want[String(pr.f)];
        return f ? numIs(q, f(), String(pr.f)) : 'unknown formula';
      }
      default:
        return 'unknown question kind';
    }
  },
  summary: ['Replace each variable with its value, written in brackets.', 'Follow the order of operations: brackets, exponents, multiply/divide, then add/subtract.', 'Formulas are expressions: substituting values into a formula is evaluating it.'],
  misconceptions: [
    { id: 'alg_sub_concat', label: 'Wrote the digits side by side', explanation: '$$3x$$ means 3 times $$x$$. With $$x = 4$$, writing 34 joins the digits instead of multiplying.', fix: 'Put the value in brackets: $$3(4) = 12$$.' },
    { id: 'alg_order_ops', label: 'Calculated in the wrong order', explanation: 'Multiplication happens before addition, unless brackets say otherwise.', fix: 'Multiply each term first, then add or subtract from left to right.' },
    { id: 'alg_coef_add', label: 'Added the coefficient instead of multiplying', explanation: 'A number written next to a letter multiplies it: $$5x$$ is $$5 \\times x$$, not $$5 + x$$.', fix: 'Read $$5x$$ as “5 times $$x$$”.' },
    { id: 'alg_power_coef', label: 'Squared the coefficient too', explanation: 'In $$3m^2$$ only the $$m$$ is squared. Squaring $$3m$$ as a whole would need brackets: $$(3m)^2$$.', fix: 'Do the exponent on the variable first, then multiply by the coefficient.' },
    { id: 'alg_square_double', label: 'Doubled instead of squaring', explanation: '$$m^2$$ means $$m \\times m$$, not $$2 \\times m$$.', fix: 'Squaring multiplies a number by itself: $$3^2 = 3 \\times 3 = 9$$.' },
    { id: 'alg_neg_value', label: 'Lost a negative sign', explanation: 'A negative value was used as if it were positive.', fix: 'Write the value in brackets with its sign, and use the integer rules when multiplying.' },
    { id: 'alg_neg_square', label: 'Thought a negative squared is negative', explanation: 'A negative times a negative is positive, so $$(-4)^2 = 16$$.', fix: 'Write the square as a product: $$(-4) \\times (-4)$$.' },
    { id: 'alg_skip_coef', label: 'Left out part of the formula', explanation: 'A number in the formula, such as the 2s in $$2l + 2w$$ or the $$\\div 2$$ in a triangle’s area, was skipped.', fix: 'Copy the whole formula first, then substitute into every part of it.' },
  ],
};

// ═══════════════════════ Pack 2: like terms and simplifying ═══════════════════════

function simplifyDraft(prompt: Block[], src: string, key: string, vars: string[], o: { hints: string[]; solution: Block[]; wrong: [string, string][] }): Draft {
  return expression(prompt, key, { hints: o.hints, solution: o.solution, variables: vars, requireSimplified: true, knownWrong: exprWrongs(key, o.wrong), params: { kind: 'simplify', src } });
}

/** Adds numbers as integers for clean coefficients. */
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function likeElem(rng: Rng, d: number, g: number): Draft {
  const [x, y] = rng.pick(LETTER_PAIRS);
  const ask = 'Simplify by collecting like terms.';
  if (g <= 6) {
    if (d <= 1) {
      const cs = Array.from({ length: rng.int(2, 3) }, () => (rng.chance(0.25) ? 1 : rng.int(2, 9)));
      const src = lin(cs.map((c) => [c, x] as Term)).asc;
      const tot = sum(cs);
      const ones = cs.filter((c) => c === 1).length;
      return simplifyDraft([p(ask), m(src)], src, mono(tot, x), [x], {
        hints: [`All the terms have the same variable, $$${x}$$, so they are like terms.`, `Add the coefficients. A term written as $$${x}$$ has a coefficient of 1.`],
        solution: [m(`${src} = (${cs.join(' + ')})${x} = ${mono(tot, x)}`)],
        wrong: [...(ones ? [[mono(tot - ones, x), 'alg_coef_one'] as [string, string]] : []), [`${tot}${x}^${cs.length}`, 'alg_add_exponents']],
      });
    }
    if (rng.chance(0.3)) {
      const k = rng.int(3, 8);
      const n = rng.int(2, 6);
      const src = Array.from({ length: n }, () => `${k}h`).join(' + ');
      return simplifyDraft([p(`A tile is made of ${k} hexagons, and each hexagon costs $$h$$ dollars, so one tile costs $$${k}h$$. Write a simplified expression for the cost of ${n} tiles.`), m(src)], src, `${k * n}h`, ['h'], {
        hints: [`Add $$${k}h$$ to itself ${n} times.`, `${n} groups of ${k} hexagons is $$${n} \\times ${k}$$ hexagons.`],
        solution: [m(`${src} = ${k * n}h`)],
        wrong: [[`${k + n}h`, 'alg_combine_unlike']],
      });
    }
    const a = rng.int(1, 9);
    const b = rng.int(1, 9);
    const c = rng.int(2, 9);
    const e = rng.int(1, 9);
    const src = lin([
      [a, x],
      [b, y],
      [c, x],
      [e, y],
    ]).asc;
    const key = lin([
      [a + c, x],
      [b + e, y],
    ]).asc;
    return simplifyDraft([p(ask), m(src)], src, key, [x, y], {
      hints: [`Only terms with the same variable can be combined. Group the $$${x}$$ terms and the $$${y}$$ terms.`, `$$${lin([[a, x], [c, x]]).asc} = ${mono(a + c, x)}$$`],
      solution: [steps({ text: 'Group like terms.', math: `${lin([[a, x], [c, x]]).asc} + ${lin([[b, y], [e, y]]).asc}` }, { text: 'Add the coefficients in each group.', math: key })],
      wrong: [
        [`${a + b + c + e}${x}${y}`, 'alg_combine_unlike'],
        [`${a + b + c + e}${x}`, 'alg_combine_unlike'],
      ],
    });
  }
  if (g === 7) {
    if (d <= 1) {
      const a = rng.int(5, 12);
      const b = rng.int(2, a - 1);
      const src = lin([
        [a, x],
        [-b, x],
      ]).asc;
      return simplifyDraft([p(ask), m(src)], src, mono(a - b, x), [x], {
        hints: ['Both terms have the same variable, so they can be combined.', 'Subtract the coefficients and keep the variable.'],
        solution: [m(`${src} = (${a} - ${b})${x} = ${mono(a - b, x)}`)],
        wrong: [
          [`${a - b}`, 'alg_drop_variable'],
          [mono(a + b, x), 'alg_sub_sign'],
        ],
      });
    }
    if (d === 2) {
      const a = rng.int(4, 12);
      const c = rng.int(1, a - 1);
      const b = rng.int(4, 12);
      const e = rng.int(1, b - 1);
      const src = lin([
        [a, x],
        [b, y],
        [-c, x],
        [-e, y],
      ]).asc;
      const key = lin([
        [a - c, x],
        [b - e, y],
      ]).asc;
      return simplifyDraft([p(ask), m(src)], src, key, [x, y], {
        hints: [`Group the $$${x}$$ terms and the $$${y}$$ terms. Each term keeps the sign in front of it.`, `$$${lin([[a, x], [-c, x]]).asc} = ${mono(a - c, x)}$$`],
        solution: [steps({ text: 'Group like terms, keeping their signs.', math: `${lin([[a, x], [-c, x]]).asc} + ${lin([[b, y], [-e, y]]).asc}` }, { text: 'Combine each group.', math: key })],
        wrong: [
          [lin([[a + c, x], [b + e, y]]).asc, 'alg_sub_sign'],
          [`${a - c + b - e}${x}${y}`, 'alg_combine_unlike'],
        ],
      });
    }
    if (rng.chance(0.5)) {
      const a = rng.int(2, 8);
      const b = rng.int(a + 2, 15);
      return simplifyDraft([p(`What monomial goes in the box to make this true? Type the missing term.`), m(`${a}x + \\square = ${b}x`)], `${b}x - ${a}x`, `${b - a}x`, ['x'], {
        hints: [`Think: ${a} of something plus how many more makes ${b} of them?`, `Subtract: $$${b}x - ${a}x$$.`],
        solution: [m(`${b}x - ${a}x = ${b - a}x, \\text{ so } ${a}x + ${b - a}x = ${b}x`)],
        wrong: [
          [`${a + b}x`, 'alg_sub_sign'],
          [`${b - a}`, 'alg_drop_variable'],
        ],
      });
    }
    const name = nameOf(rng);
    const a = rng.int(6, 12);
    const b = rng.int(2, a - 2);
    const c = rng.int(2, 9);
    const src = `${a}n - ${b}n + ${c}n`;
    return simplifyDraft([p(`${name} has ${a} bags of marbles with $$n$$ marbles in each bag. ${name} gives away ${b} bags, then buys ${c} more bags. Write a simplified expression for the number of marbles ${name} has now.`)], src, `${a - b + c}n`, ['n'], {
      hints: ['Write a term for each step: start, give away (subtract), buy (add).', `$$${src}$$`],
      solution: [m(`${src} = (${a} - ${b} + ${c})n = ${a - b + c}n`)],
      wrong: [
        [`${a + b + c}n`, 'alg_sub_sign'],
        [`${a - b - c}n`, 'alg_sub_sign'],
      ],
    });
  }
  // Grade 8: integers, and adding binomials.
  if (d <= 2) {
    if (rng.chance(0.5)) {
      const a = rng.int(2, 9);
      const b = rng.int(1, 9);
      const c = rng.signed(1, 9);
      const e = rng.signed(1, 9);
      const src = `${mono(a, x)} + ${mono(b, x)} - (${c > 0 ? '+' : ''}${mono(c, x)}) - (${e > 0 ? '+' : ''}${mono(e, x)})`;
      const key = mono(a + b - c - e, x);
      if (a + b - c - e === 0) return likeElem(rng, d, g);
      return simplifyDraft([p(ask), m(src)], src, key, [x], {
        hints: ['Subtracting a number is the same as adding its opposite.', `$$- (${e}${x})$$ becomes $$${e < 0 ? '+' : '-'} ${Math.abs(e)}${x}$$.`],
        solution: [steps({ text: 'Change each subtraction to adding the opposite.', math: lin([[a, x], [b, x], [-c, x], [-e, x]]).asc }, { text: 'Add the coefficients.', math: `= ${key}` })],
        wrong: [
          [mono(a + b - Math.abs(c) - Math.abs(e), x), 'alg_neg_sub'],
          [mono(a + b + c + e, x), 'alg_sub_sign'],
        ],
      });
    }
    const a = rng.signed(2, 9);
    const b = rng.int(2, 9);
    const c = rng.signed(2, 9);
    const e = rng.int(1, 5);
    const src = `${mono(a, x)} + ${mono(b, y)} - (${mono(c, x)}) + (${mono(-e, y)})`;
    const key = lin([
      [a - c, x],
      [b - e, y],
    ]).asc;
    if (a - c === 0 && b - e === 0) return likeElem(rng, d, g);
    return simplifyDraft([p(ask), m(src)], src, key, [x, y], {
      hints: ['Rewrite the subtraction as adding the opposite, and drop the brackets.', `Collect the $$${x}$$ terms, then the $$${y}$$ terms.`],
      solution: [steps({ text: 'Add the opposite.', math: lin([[a, x], [b, y], [-c, x], [-e, y]]).asc }, { text: 'Collect like terms.', math: `= ${key}` })],
      wrong: [
        [lin([[a + c, x], [b - e, y]]).asc, 'alg_neg_sub'],
        [`${a - c + b - e}${x}${y}`, 'alg_combine_unlike'],
      ],
    });
  }
  if (d === 3) {
    const useConst = rng.chance(0.4);
    const v2 = useConst ? '' : y;
    const a = rng.signed(1, 9);
    const b = rng.signed(1, 9);
    const c = rng.signed(1, 9);
    const e = rng.signed(1, 9);
    if (a + c === 0 && b + e === 0) return likeElem(rng, d, g);
    const s1 = lin([[a, x], [b, v2]]).asc;
    const s2 = lin([[c, x], [e, v2]]).asc;
    const src = `(${s1}) + (${s2})`;
    const key = lin([[a + c, x], [b + e, v2]]).asc;
    const vars = useConst ? [x] : [x, y];
    return simplifyDraft([p('Add the binomials. Simplify your answer.'), m(src)], src, key, vars, {
      hints: ['When you add, the brackets can be removed without changing any signs.', `Collect the $$${x}$$ terms together and the ${useConst ? 'numbers' : `$$${y}$$ terms`} together.`],
      solution: [steps({ text: 'Remove the brackets.', math: lin([[a, x], [b, v2], [c, x], [e, v2]]).asc }, { text: 'Collect like terms.', math: `= ${key}` })],
      wrong: [[useConst ? mono(a + b + c + e, x) : `${a + b + c + e}${x}${y}`, 'alg_combine_unlike']],
    });
  }
  if (rng.chance(0.5)) {
    const sides: [number, number][] = [
      [rng.int(1, 4), rng.signed(1, 6)],
      [rng.int(1, 4), rng.signed(1, 6)],
      [rng.int(1, 4), rng.int(1, 6)],
    ];
    const src = sides.map(([a, b]) => `(${lin([[a, 'x'], [b, '']]).asc})`).join(' + ');
    const A = sum(sides.map((s) => s[0]));
    const B = sum(sides.map((s) => s[1]));
    if (B === 0) return likeElem(rng, d, g);
    const key = lin([
      [A, 'x'],
      [B, ''],
    ]).asc;
    return simplifyDraft([p(`A triangle has sides of length $$${sides.map(([a, b]) => lin([[a, 'x'], [b, '']]).asc).join('$$, $$')}$$ (in centimetres). Write a simplified expression for its perimeter.`)], src, key, ['x'], {
      hints: ['The perimeter is the sum of the three sides.', 'Add the $$x$$ terms, then add the numbers.'],
      solution: [m(`${src} = ${key}`)],
      wrong: [[mono(A + B, 'x'), 'alg_combine_unlike']],
    });
  }
  const h = rng.int(3, 9);
  const t = rng.int(2, 12);
  const k = rng.int(2, 4);
  const one = `${h}h + ${t}t`;
  const src = Array.from({ length: k }, () => `(${one})`).join(' + ');
  return simplifyDraft([p(`One tile costs $$${one}$$ dollars, where $$h$$ is the cost of a hexagon and $$t$$ the cost of a triangle. Write a simplified expression for the cost of ${k} tiles.`), m(src)], src, `${h * k}h + ${t * k}t`, ['h', 't'], {
    hints: [`Add the binomial to itself ${k} times.`, 'Collect the $$h$$ terms and the $$t$$ terms separately.'],
    solution: [m(`${src} = ${h * k}h + ${t * k}t`)],
    wrong: [
      [`${(h + t) * k}ht`, 'alg_combine_unlike'],
      [`${h * k}h + ${t}t`, 'alg_dist_first_only'],
    ],
  });
}

function likeMth1w(rng: Rng, d: number): Draft {
  const ask = 'Simplify.';
  if (d <= 2) {
    if (rng.chance(0.5)) {
      const k = rng.int(2, 7);
      const b = rng.signed(1, 9);
      const c = rng.signed(1, 9);
      const src = `${k}(x ${b < 0 ? '-' : '+'} ${Math.abs(b)}) ${c < 0 ? '-' : '+'} ${mono(Math.abs(c), 'x')}`;
      const key = lin([
        [k + c, 'x'],
        [k * b, ''],
      ]).asc;
      return simplifyDraft([p(ask), m(src)], src, key, ['x'], {
        hints: ['Use the distributive property: multiply **each** term in the bracket by the number outside.', `$$${k}(x ${b < 0 ? '-' : '+'} ${Math.abs(b)}) = ${lin([[k, 'x'], [k * b, '']]).asc}$$`],
        solution: [steps({ text: 'Expand the bracket.', math: `${lin([[k, 'x'], [k * b, '']]).asc} ${c < 0 ? '-' : '+'} ${mono(Math.abs(c), 'x')}` }, { text: 'Collect like terms.', math: `= ${key}` })],
        wrong: [
          [lin([[k + c, 'x'], [b, '']]).asc, 'alg_dist_first_only'],
          [lin([[k + c, 'x'], [k + b, '']]).asc, 'alg_dist_add'],
        ],
      });
    }
    const a = rng.int(2, 9);
    const b = rng.int(1, 9);
    const c = rng.int(1, 9);
    const e = rng.int(1, 9);
    const src = `(${lin([[a, 'x'], [b, 'y']]).asc}) - (${lin([[c, 'x'], [-e, 'y']]).asc})`;
    if (a === c) return likeMth1w(rng, d);
    const key = lin([
      [a - c, 'x'],
      [b + e, 'y'],
    ]).asc;
    return simplifyDraft([p(ask), m(src)], src, key, ['x', 'y'], {
      hints: ['Subtracting a bracket subtracts **every** term inside it, so each sign inside changes.', `$$-(${lin([[c, 'x'], [-e, 'y']]).asc}) = ${lin([[-c, 'x'], [e, 'y']]).asc}$$`],
      solution: [steps({ text: 'Remove the brackets, changing the signs in the second one.', math: lin([[a, 'x'], [b, 'y'], [-c, 'x'], [e, 'y']]).asc }, { text: 'Collect like terms.', math: `= ${key}` })],
      wrong: [[lin([[a - c, 'x'], [b - e, 'y']]).asc, 'alg_sub_binomial']],
    });
  }
  if (d === 3) {
    const r = rng.next();
    if (r < 0.35) {
      const a = rng.int(2, 7);
      const b = rng.signed(1, 6);
      const c = rng.signed(1, 9);
      const e = rng.signed(1, 9);
      if (a + b === 0 || c + e === 0) return likeMth1w(rng, d);
      const src = lin([
        [a, 'x^2'],
        [c, 'x'],
        [b, 'x^2'],
        [e, 'x'],
      ]).asc;
      const key = lin([
        [a + b, 'x^2'],
        [c + e, 'x'],
      ]).asc;
      return simplifyDraft([p(ask), m(src)], src, key, ['x'], {
        hints: ['$$x^2$$ terms and $$x$$ terms are **not** like terms: the exponents must match.', 'Add the coefficients of the $$x^2$$ terms, then of the $$x$$ terms. The exponents do not change.'],
        solution: [steps({ text: 'Group like terms.', math: `${lin([[a, 'x^2'], [b, 'x^2']]).asc} + (${lin([[c, 'x'], [e, 'x']]).asc})` }, { text: 'Combine.', math: `= ${key}` })],
        wrong: [
          [lin([[a + b, 'x^4'], [c + e, 'x^2']]).asc, 'alg_add_exponents'],
          [mono(a + b + c + e, 'x^3'), 'alg_combine_unlike'],
        ],
      });
    }
    if (r < 0.6) {
      const a = rng.signed(2, 6);
      const b = rng.int(2, 6);
      const p1 = rng.int(1, 2);
      const p2 = rng.int(1, 3);
      const t1 = p1 === 1 ? 'x' : `x^${p1}`;
      const t2 = p2 === 1 ? 'x' : `x^${p2}`;
      const src = `(${a}${t1})(${b}${t2})`;
      const key = mono(a * b, `x^${p1 + p2}`);
      return simplifyDraft([p(ask), m(src)], src, key, ['x'], {
        hints: ['Multiply the coefficients, then multiply the variable parts.', `When you multiply powers of the same base, add the exponents: $$${t1} \\times ${t2} = x^{${p1} + ${p2}}$$.`],
        solution: [m(`(${a}${t1})(${b}${t2}) = (${a} \\times ${b})(${t1} \\times ${t2}) = ${key}`)],
        wrong: [
          [mono(a * b, `x^${p1 * p2}`), 'alg_exp_multiply'],
          [mono(a + b, `x^${p1 + p2}`), 'alg_coef_add_mult'],
        ],
      });
    }
    const k = rng.int(2, 6);
    const j = rng.signed(2, 5);
    const b = rng.int(1, 9);
    const e = rng.int(1, 9);
    if (k + j === 0) return likeMth1w(rng, d);
    const src = `${k}(x + ${b}) ${j < 0 ? '-' : '+'} ${Math.abs(j)}(x - ${e})`;
    const key = lin([
      [k + j, 'x'],
      [k * b - j * e, ''],
    ]).asc;
    if (k * b - j * e === 0) return likeMth1w(rng, d);
    return simplifyDraft([p(ask), m(src)], src, key, ['x'], {
      hints: ['Expand each bracket with the distributive property. Keep the sign in front of each number outside a bracket.', `$$${j < 0 ? '-' : '+'}${Math.abs(j)}(x - ${e}) = ${lin([[j, 'x'], [-j * e, '']]).asc}$$`],
      solution: [steps({ text: 'Expand both brackets.', math: lin([[k, 'x'], [k * b, ''], [j, 'x'], [-j * e, '']]).asc }, { text: 'Collect like terms.', math: `= ${key}` })],
      wrong: [
        [lin([[k + j, 'x'], [b - e, '']]).asc, 'alg_dist_first_only'],
        [lin([[k + j, 'x'], [k * b + j * e, '']]).asc, 'alg_dist_sign'],
      ],
    });
  }
  if (rng.chance(0.6)) {
    const a = rng.signed(1, 6);
    const b = rng.int(2, 4);
    const c = rng.signed(1, 6);
    const e = rng.int(1, 9);
    if (1 + b === 0 || a + b * c === 0) return likeMth1w(rng, d);
    const src = `x(x ${a < 0 ? '-' : '+'} ${Math.abs(a)}) + ${b}(${lin([[1, 'x^2'], [c, 'x'], [-e, '']]).asc})`;
    const key = lin([
      [1 + b, 'x^2'],
      [a + b * c, 'x'],
      [-b * e, ''],
    ]).asc;
    return simplifyDraft([p(ask), m(src)], src, key, ['x'], {
      hints: ['Expand each bracket first. In the first one, $$x \\times x = x^2$$.', `$$${b}(${lin([[1, 'x^2'], [c, 'x'], [-e, '']]).asc}) = ${lin([[b, 'x^2'], [b * c, 'x'], [-b * e, '']]).asc}$$`],
      solution: [steps({ text: 'Expand.', math: lin([[1, 'x^2'], [a, 'x'], [b, 'x^2'], [b * c, 'x'], [-b * e, '']]).asc }, { text: 'Collect like terms.', math: `= ${key}` })],
      wrong: [
        [lin([[1 + b, 'x^2'], [a + c, 'x'], [-e, '']]).asc, 'alg_dist_first_only'],
        [lin([[b, 'x^2'], [1 + a + b * c, 'x'], [-b * e, '']]).asc, 'alg_xx_as_x'],
      ],
    });
  }
  const a = rng.int(2, 9);
  const b = rng.int(1, 9);
  if (a === b) return likeMth1w(rng, d);
  const src = `-${a}ab - (-${b}ba)`;
  const key = mono(b - a, 'ab');
  return simplifyDraft([p(ask), m(src)], src, key, ['a', 'b'], {
    hints: ['$$ba$$ and $$ab$$ are like terms: multiplication can be done in any order.', 'Subtracting a negative is the same as adding.'],
    solution: [m(`-${a}ab - (-${b}ab) = -${a}ab + ${b}ab = ${key}`)],
    wrong: [[mono(-a - b, 'ab'), 'alg_neg_sub']],
  });
}

type EqOpt = { text: string; misconception?: string };
/** Builds a source expression, an equivalent form and non-equivalent forms tied to misconceptions. */
function equivSet(rng: Rng, d: number): { src: string; right: string[]; wrong: EqOpt[] } {
  const v = rng.pick(['x', 'm', 'n', 'a']);
  if (d <= 2) {
    if (rng.chance(0.5)) {
      const a = rng.int(2, 9);
      const b = rng.int(2, 9);
      const k = rng.int(1, 4);
      return {
        src: `${a}${v} + ${b}${v}`,
        right: [mono(a + b, v), `${mono(a + b + k, v)} - ${mono(k, v)}`, `-${v} + ${mono(a + b + 1, v)}`],
        wrong: [
          { text: mono(a * b, v), misconception: 'alg_coef_add_mult' },
          { text: mono(a + b, `${v}^2`), misconception: 'alg_add_exponents' },
          { text: mono(a + b - 1, v) },
          { text: `-${v} + ${mono(a + b, v)}` },
        ],
      };
    }
    const k = rng.int(2, 6);
    const b = rng.int(2, 9);
    return {
      src: `${k}(${v} + ${b})`,
      right: [`${k}${v} + ${k * b}`, `${k * b} + ${k}${v}`],
      wrong: [
        { text: `${k}${v} + ${b}`, misconception: 'alg_dist_first_only' },
        { text: `${v} + ${k * b}`, misconception: 'alg_dist_first_only' },
        { text: `${k}${v} + ${k + b}`, misconception: 'alg_dist_add' },
      ],
    };
  }
  if (d === 3 || rng.chance(0.5)) {
    if (rng.chance(0.5)) {
      const a = rng.signed(2, 5);
      const b = rng.int(2, 9);
      const c = rng.signed(1, 9);
      const right = lin([
        [a, `${v}^2`],
        [a * b, v],
        [c, ''],
      ]).asc;
      return {
        src: `${a}${v}(${v} + ${b}) ${c < 0 ? '-' : '+'} ${Math.abs(c)}`,
        right: [right],
        wrong: [
          { text: lin([[a, `${v}^2`], [b + c, '']]).asc, misconception: 'alg_dist_first_only' },
          { text: lin([[a + a * b, v], [c, '']]).asc, misconception: 'alg_xx_as_x' },
          { text: lin([[a, `${v}^2`], [-a * b, v], [c, '']]).asc, misconception: 'alg_dist_sign' },
        ],
      };
    }
    const a = rng.int(3, 9);
    const b = rng.int(1, 9);
    const c = rng.int(1, a - 1);
    const e = rng.int(1, 9);
    return {
      src: `(${lin([[a, 'x'], [b, 'y']]).asc}) - (${lin([[c, 'x'], [-e, 'y']]).asc})`,
      right: [lin([[a - c, 'x'], [b + e, 'y']]).asc],
      wrong: [
        { text: lin([[a - c, 'x'], [b - e, 'y']]).asc, misconception: 'alg_sub_binomial' },
        { text: lin([[a + c, 'x'], [b + e, 'y']]).asc, misconception: 'alg_sub_sign' },
        { text: `${a - c + b + e}xy`, misconception: 'alg_combine_unlike' },
      ],
    };
  }
  // d4: an expression with a common factor taken out, as in the Ministry's −2x(x + 5) − 2 vs −2(x² + 5x − 1).
  const k = -rng.int(2, 5);
  const b = rng.int(2, 9);
  const c = rng.int(1, 9);
  return {
    src: `${k}${v}(${v} + ${b}) ${k < 0 ? '-' : '+'} ${Math.abs(k * c)}`,
    right: [`${k}(${lin([[1, `${v}^2`], [b, v], [c, '']]).asc})`, lin([[k, `${v}^2`], [k * b, v], [k * c, '']]).asc],
    wrong: [
      { text: `${k}(${lin([[1, `${v}^2`], [b, v], [-c, '']]).asc})`, misconception: 'alg_dist_sign' },
      { text: lin([[k, `${v}^2`], [b, v], [k * c, '']]).asc, misconception: 'alg_dist_first_only' },
      { text: `${k}(${lin([[1, `${v}^2`], [b, v], [k * c, '']]).asc})` },
    ],
  };
}

function equivDraft(rng: Rng, d: number): Draft {
  const s0 = equivSet(rng, d);
  const srcE = parseExpr(s0.src);
  const s = { ...s0, wrong: s0.wrong.filter((w) => !equivalent(parseExpr(w.text), srcE)) };
  const right = rng.pick(s.right);
  const vars = [...new Set(s.src.match(/[a-z]/g) ?? [])];
  const at = Object.fromEntries(vars.map((v, i) => [v, R(2 + i)]));
  const valOf = (e: string) => nl(evalAt(e, at));
  const atText = vars.map((v) => `$$${v} = ${nl(at[v]!)}$$`).join(' and ');
  if (rng.chance(0.35)) {
    const truth = rng.chance(0.5);
    const w = rng.pick(s.wrong);
    const other = truth ? right : w.text;
    return trueFalse([p(`True or false: these two expressions are equivalent.`), m(`${s.src} \\quad \\text{and} \\quad ${other}`)], truth, {
      hints: [`Simplify $$${s.src}$$ first, or substitute the same value into both.`, `Try ${atText} in both expressions. Equivalent expressions give the same value for **every** value.`],
      solution: [
        p(`Simplify the first expression: $$${s.src} = ${s.right[0]}$$.`),
        p(`Check with ${atText}: the first gives $$${valOf(s.src)}$$ and the second gives $$${valOf(other)}$$.`),
        p(truth ? 'The simplified forms match, so they are **equivalent** (true).' : 'They are **not** equivalent (false). One value that gives different results is enough to show it.'),
      ],
      misconception: truth ? undefined : w.misconception,
      params: { kind: 'equivTF', a: s.src, b: other },
    });
  }
  if (d >= 4) {
    const pairText = (a: string, b: string) => `$$${a}$$ and $$${b}$$`;
    const others = s.wrong.slice(0, 3).map((w) => ({ text: pairText(s.src, w.text), misconception: w.misconception }));
    return choice(rng, [p('Which pair of expressions is equivalent?')], pairText(s.src, right), others, {
      hints: [`Simplify the first expression by expanding the bracket.`, `Substitute ${atText} into each pair. Equivalent expressions always give the same value.`],
      solution: [p(`Expanding: $$${s.src} = ${s.right[0]}$$, which ${s.right.length > 1 ? `can also be written as $$${s.right[1]}$$` : 'matches'}.`), p(`Check with ${atText}: $$${s.src}$$ gives $$${valOf(s.src)}$$, and so does $$${right}$$.`)],
      params: { kind: 'equivPair' },
    });
  }
  return choice(rng, [p(`Which expression is equivalent to $$${s.src}$$?`)], `$$${right}$$`, rng.shuffle(s.wrong).map((w) => ({ text: `$$${w.text}$$`, misconception: w.misconception })), {
    hints: ['Simplify the given expression first: expand any brackets and collect like terms.', `You can also substitute ${atText} into each option and compare with the value of $$${s.src}$$.`],
    solution: [p(`$$${s.src} = ${s.right[0]}$$.${right !== s.right[0] ? ` The option $$${right}$$ simplifies to the same thing.` : ''}`), p(`Check with ${atText}: both give $$${valOf(s.src)}$$.`)],
    params: { kind: 'equiv', src: s.src },
  });
}

export const likeTerms: SkillPack = {
  id: 'like-terms',
  title: 'Like terms and simplifying expressions',
  subject: 'math',
  expectations: [
    { id: `${G6}:C2.1`, note: 'Adds monomials with a degree of 1 and whole-number coefficients, including in a pattern-block cost context. Tools such as algebra tiles appear in explanations; using them is not assessed.', levels: [1, 2] },
    { id: `${G7}:C2.1`, note: 'Adds and subtracts monomials with a degree of 1 and whole numbers, including finding a missing addend and a word context. Using tools is shown, not assessed.', levels: [1, 2, 3] },
    { id: `${G8}:C2.1`, note: 'Adds and subtracts monomials with integer coefficients (including subtracting negatives) and adds binomials with a degree of 1. Using tools is shown, not assessed.', levels: [2, 3, 4] },
    { id: `${W}:C1.4`, note: 'Simplifies expressions using the distributive property, subtracting binomials, collecting degree 1 and 2 terms, and multiplying monomials. Representations such as area models are explained but not assessed.', levels: [2, 3, 4] },
    { id: `${W}:C1.3`, note: 'Identifies equivalent expressions by simplifying or substituting values (multiple choice and true/false), with the justification shown in the solution. Concrete and graphical comparisons and expressions with integer exponents are not assessed.', levels: [2, 3, 4] },
  ],
  prerequisites: ['eval-expr'],
  goal: 'I can simplify an expression by collecting like terms, and tell when two expressions are equivalent.',
  explain: (c) => [
    p('**Like terms** have exactly the same variable part: $$3x$$ and $$5x$$ are like terms, but $$3x$$ and $$5y$$ are not, and neither are $$x$$ and $$x^2$$.'),
    p('To **collect** like terms, add or subtract their coefficients (the numbers in front). The variable part stays the same.'),
    m('3x + 5x + x = (3 + 5 + 1)x = 9x'),
    warn('$$3x + 5y$$ can’t be combined. Think of $$x$$ as apples and $$y$$ as bananas: 3 apples and 5 bananas is not 8 of anything.'),
    ...(c.grade >= 8 ? [p('Subtracting a negative is adding: $$4m - (-2m) = 4m + 2m = 6m$$. When you add binomials, just remove the brackets and collect: $$(4x + 3y) + (5x - 2y) = 9x + y$$.')] : []),
    ...(c.grade >= 9
      ? [
          p('The **distributive property** multiplies every term inside a bracket: $$3(x + 4) = 3x + 12$$. A minus sign in front of a bracket changes every sign inside: $$-(x - y) = -x + y$$.'),
          p('Two expressions are **equivalent** if they give the same value for every value of the variable. Simplify both, or test values: one value that gives different results proves they are not equivalent.'),
        ]
      : []),
    c.simple ? tip('Same letter (and same power)? Add the numbers in front. Different letters? Leave them apart.') : tip('A variable with no number in front, like $$x$$, has a coefficient of 1.'),
  ],
  alternatives: (c) => ({
    simpler: [p('Count the same things together. $$2x + 4x$$ is 2 x’s and 4 more x’s, so 6 x’s: $$6x$$.')],
    analogy: [p('Sorting coins: 3 loonies + 2 quarters + 4 loonies is 7 loonies and 2 quarters. You don’t say “9 coins” if you want the value: loonies and quarters are different, like $$x$$ and $$y$$.')],
    visual: [
      { kind: 'table', header: ['Algebra tiles', 'Expression'], rows: [['3 long x-tiles and 2 more long x-tiles', '$$3x + 2x = 5x$$'], ['2 x-tiles and 4 small unit tiles', '$$2x + 4$$ (can’t combine)'], ['3 groups of (1 x-tile and 4 units)', '$$3(x + 4) = 3x + 12$$']] },
    ],
    steps: [steps({ text: 'Expand any brackets (multiply every term inside).' }, { text: 'Underline like terms with the same colour.' }, { text: 'Add or subtract the coefficients in each group, keeping each term’s sign.' }, { text: 'Write the result with one term per group.' })],
    ...(c.grade >= 9 ? { compare: [p('Checking equivalence is like checking two recipes make the same dish: try them with the same ingredients (substitute a number). If one test gives different results, they are different.')] } : { compare: [p('You already know 3 tens + 5 tens = 8 tens. Here “tens” is replaced by a letter: $$3x + 5x = 8x$$.')] }),
  }),
  example: (rng, c) => {
    const a = rng.int(2, 7);
    const b = rng.int(2, 7);
    const e = rng.int(1, 6);
    if (c.grade >= 9) {
      return [p(`Simplify $$${a}(x + ${e}) + ${b}x$$.`), steps({ text: 'Expand the bracket.', math: `${a}x + ${a * e} + ${b}x` }, { text: 'Collect the x terms.', math: `= ${a + b}x + ${a * e}` })];
    }
    return [p(`Simplify $$${a}x + ${e}y + ${b}x$$.`), steps({ text: 'Group like terms.', math: `${a}x + ${b}x + ${mono(e, 'y')}` }, { text: 'Add the coefficients of x.', math: `= ${a + b}x + ${mono(e, 'y')}` })];
  },
  generate: (rng, d, c) => {
    if (c.expectationId === `${W}:C1.3`) return equivDraft(rng, d);
    if (c.expectationId === `${W}:C1.4`) return likeMth1w(rng, d);
    return likeElem(rng, d, c.grade);
  },
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Record<string, unknown>;
    try {
      if (pr.kind === 'simplify' && q.type === 'expression') {
        const k = parseExpr(q.answer);
        if (!equivalent(k, parseExpr(String(pr.src)))) return 'simplified key is not equivalent to the question';
        if (!isSimplified(k)) return 'key is not simplified';
        const letters = new Set(String(pr.src).match(/[a-z]/g) ?? []);
        return [...letters].every((l) => q.variables.includes(l)) ? null : 'variables list is incomplete';
      }
      if (pr.kind === 'equiv') {
        const src = parseExpr(String(pr.src));
        if (!equivalent(parseExpr(strip(rightText(q))), src)) return 'correct option is not equivalent';
        return otherTexts(q).some((t) => equivalent(parseExpr(strip(t)), src)) ? 'a distractor is equivalent too' : null;
      }
      if (pr.kind === 'equivPair') {
        const pair = (t: string) => t.split(' and ').map((s) => parseExpr(strip(s)));
        const [a, b] = pair(rightText(q));
        if (!a || !b || !equivalent(a, b)) return 'correct pair is not equivalent';
        return otherTexts(q).some((t) => {
          const [x, y] = pair(t);
          return !x || !y || equivalent(x, y);
        })
          ? 'a distractor pair is equivalent'
          : null;
      }
      if (pr.kind === 'equivTF' && q.type === 'true_false') return equivalent(parseExpr(String(pr.a)), parseExpr(String(pr.b))) === q.answer ? null : 'true/false key is wrong';
    } catch {
      return 'unreadable expression';
    }
    return 'unknown question kind';
  },
  summary: ['Like terms have the same variables with the same exponents; only like terms can be combined.', 'Collect like terms by adding or subtracting their coefficients; expand brackets first by multiplying every term inside.', 'Equivalent expressions give the same value for every value of the variable: simplify both or test values.'],
  misconceptions: [
    { id: 'alg_coef_one', label: 'Treated a lone variable as zero', explanation: 'A term like $$x$$ means $$1x$$. Skipping it makes the total one short.', fix: 'Write a 1 in front of any variable with no number before you add.' },
    { id: 'alg_add_exponents', label: 'Changed the exponent when adding', explanation: 'Adding like terms counts how many there are; it doesn’t change what they are. $$2x + 3x = 5x$$, not $$5x^2$$.', fix: 'When adding or subtracting, keep the variable part exactly the same.' },
    { id: 'alg_combine_unlike', label: 'Combined unlike terms', explanation: 'Terms with different variables (or different exponents) are different kinds of things, so they can’t be added into one term.', fix: 'Group terms by their variable part first. Leave different groups as separate terms.' },
    { id: 'alg_sub_sign', label: 'Lost a subtraction sign', explanation: 'The minus sign belongs to the term after it, so that term must be subtracted.', fix: 'Circle each term together with the sign in front of it before collecting.' },
    { id: 'alg_drop_variable', label: 'Dropped the variable', explanation: '$$7x - 3x$$ is $$4x$$, not 4: you still have x’s left.', fix: 'Collecting like terms changes the number in front, not the variable.' },
    { id: 'alg_neg_sub', label: 'Subtracting a negative', explanation: 'Taking away a negative amount makes the total bigger: $$-(-3x) = +3x$$.', fix: 'Rewrite subtraction as adding the opposite before you collect terms.' },
    { id: 'alg_dist_first_only', label: 'Multiplied only part of the bracket', explanation: 'The number outside a bracket multiplies **every** term inside: $$2(m + 5) = 2m + 10$$, not $$2m + 5$$.', fix: 'Draw an arrow from the outside number to each term inside the bracket.' },
    { id: 'alg_dist_add', label: 'Added instead of multiplying into the bracket', explanation: 'In $$3(x + 4)$$ the 3 multiplies the 4, giving 12, not 7.', fix: 'A number touching a bracket means multiply.' },
    { id: 'alg_sub_binomial', label: 'Changed only the first sign in a subtracted bracket', explanation: 'A minus in front of a bracket subtracts every term inside, so every sign in the bracket changes.', fix: 'Think of $$-(a - b)$$ as $$-1(a - b) = -a + b$$.' },
    { id: 'alg_exp_multiply', label: 'Multiplied the exponents', explanation: 'When you multiply powers of the same base, you add the exponents: $$x \\times x^2 = x^3$$.', fix: 'Write the powers out: $$x \\times x \\times x = x^3$$.' },
    { id: 'alg_coef_add_mult', label: 'Added coefficients when multiplying', explanation: 'In a product like $$(2x)(3x^2)$$ the coefficients multiply: $$2 \\times 3 = 6$$.', fix: 'Multiply the numbers, then multiply the variable parts.' },
    { id: 'alg_xx_as_x', label: 'Wrote x times x as x', explanation: '$$x \\times x = x^2$$, a different kind of term from $$x$$.', fix: 'Multiplying a variable by itself raises its exponent.' },
    { id: 'alg_dist_sign', label: 'Sign error when expanding', explanation: 'A negative number outside a bracket changes the sign of every term it multiplies.', fix: 'Multiply each term by the outside number, sign included, one at a time.' },
    { id: 'not_simplified', label: 'Stopped simplifying too early', explanation: 'The answer is equal to the right one, but it still has like terms that can be combined.', fix: 'Check for terms with the same variable part and combine them.' },
  ],
};

// ═══════════════════════ Pack 3: solving equations ═══════════════════════

type EqT = { tex: string; lhs: string; rhs: string; v: string; ans: Rational; solve: { text: string; math?: string }[]; hints: string[]; wrong: [Rational | null, string][]; intro?: string; unit?: string };

function eqDraft(o: EqT): Draft {
  const env = { [o.v]: o.ans };
  const ls = evalAt(o.lhs, env);
  const rs = evalAt(o.rhs, env);
  const prompt = o.intro ? [p(o.intro), m(o.tex)] : [p(`Solve for $$${o.v}$$.`), m(o.tex)];
  return numeric(prompt, na(o.ans), {
    hints: o.hints,
    solution: [steps(...o.solve), p(`**Check:** substitute $$${o.v} = ${nl(o.ans)}$$. Left side $$= ${nl(ls)}$$, right side $$= ${nl(rs)}$$. They match.`)],
    knownWrong: wrongs(o.ans, o.wrong),
    unit: o.unit,
    params: { kind: 'eq', lhs: o.lhs, rhs: o.rhs, v: o.v },
  });
}

const VARS = ['x', 'm', 'n', 'd', 'h', 'k', 'p', 't', 'y'] as const;
/** a·v as LaTeX / ascii pieces. */
const tv = (a: Rational | number, v: string) => lin([[a, v]]);

function eqCollect(rng: Rng, sub: boolean): Draft {
  const v = rng.pick(VARS);
  const s = rng.int(2, 12);
  const a = rng.int(sub ? 4 : 2, 9);
  const b = sub ? rng.int(1, a - 1) : rng.int(1, 9);
  const k = sub ? a - b : a + b;
  const total = k * s;
  const c = sub ? total + rng.int(1, 20) : rng.int(1, total - 1);
  const e = sub ? c - total : total - c;
  const left = lin([
    [a, v],
    [sub ? -b : b, v],
  ]);
  const op = sub ? '-' : '+';
  return eqDraft({
    tex: `${left.tex} = ${c} ${op} ${e}`,
    lhs: left.asc,
    rhs: `${c} ${op} ${e}`,
    v,
    ans: R(s),
    hints: ['Simplify each side first: collect the like terms on the left and work out the numbers on the right.', `$$${left.tex} = ${mono(k, v)}$$ and $$${c} ${op} ${e} = ${total}$$.`],
    solve: [{ text: 'Simplify both sides.', math: `${mono(k, v)} = ${total}` }, { text: `Divide both sides by ${k}.`, math: `${v} = ${total} \\div ${k} = ${s}` }],
    wrong: [
      [R(total, a), 'alg_collect_missed'],
      [R(total - k), 'alg_inverse_op'],
    ],
  });
}

function eqTwoStep(rng: Rng, g: number): Draft {
  const v = rng.pick(VARS);
  const neg = g >= 8;
  const a = neg ? rng.signed(2, 9) : rng.int(2, 9);
  const s = neg ? rng.signed(1, 12) : rng.int(2, 12);
  const b = neg ? rng.signed(1, 20) : rng.int(1, 20) * (rng.chance(0.5) ? 1 : -1);
  if (!neg && a * s + b <= 0) return eqTwoStep(rng, g);
  const c = a * s + b;
  const left = lin([
    [a, v],
    [b, ''],
  ]);
  return eqDraft({
    tex: `${left.tex} = ${c}`,
    lhs: left.asc,
    rhs: `${c}`,
    v,
    ans: R(s),
    hints: [`Undo the operations in reverse order: first undo the ${b > 0 ? 'adding' : 'subtracting'} of ${Math.abs(b)}, then undo the multiplying by ${a}.`, `$$${mono(a, v)} = ${c} ${b > 0 ? '-' : '+'} ${Math.abs(b)} = ${c - b}$$`],
    solve: [{ text: `${b > 0 ? 'Subtract' : 'Add'} ${Math.abs(b)} on both sides.`, math: `${mono(a, v)} = ${c - b}` }, { text: `Divide both sides by ${nb(a)}.`, math: `${v} = ${nb(c - b)} \\div ${nb(a)} = ${s}` }],
    wrong: [
      [R(c + b, a), 'alg_inverse_op'],
      [safe(() => R(c, a).sub(b)), 'alg_order_undo'],
      [neg && a < 0 ? R(-s) : null, 'alg_sign_flip'],
    ],
  });
}

function eqRightSide(rng: Rng): Draft {
  const v = rng.pick(VARS);
  const k = rng.int(2, 5);
  const s = rng.int(2, 15);
  const c = (k + 1) * s;
  return eqDraft({
    tex: `${c} = ${v} + ${k}${v}`,
    lhs: `${c}`,
    rhs: `${v} + ${k}${v}`,
    v,
    ans: R(s),
    hints: [`$$${v}$$ is the same as $$1${v}$$.`, `$$${v} + ${k}${v} = ${k + 1}${v}$$`],
    solve: [{ text: 'Collect like terms on the right.', math: `${c} = ${k + 1}${v}` }, { text: `Divide both sides by ${k + 1}.`, math: `${v} = ${c} \\div ${k + 1} = ${s}` }],
    wrong: [
      [R(c, k), 'alg_collect_missed'],
      [R(c - k - 1), 'alg_inverse_op'],
    ],
  });
}

function eqDivide(rng: Rng, g: number): Draft {
  const v = rng.pick(VARS);
  const k = rng.pick(g === 7 ? [2, 4, 5, 10] : [2, 3, 4, 5, 6]);
  let b: Rational;
  let c: Rational;
  if (g === 6) {
    b = R(rng.int(1, 9));
    c = R(rng.int(2, 15));
  } else if (g === 7) {
    b = dz(rng.int(11, 49));
    c = dz(rng.int(11, 99));
  } else {
    b = R(rng.int(1, 9));
    c = R(-rng.int(b.toNumber() + 1, 15));
  }
  const s = c.add(b).mul(k);
  return eqDraft({
    tex: `\\frac{${v}}{${k}} - ${nl(b)} = ${nl(c)}`,
    lhs: `${v}/${k} - ${na(b)}`,
    rhs: na(c),
    v,
    ans: s,
    hints: [`$$${v}$$ was divided by ${k}, then ${nl(b)} was subtracted. Undo these in reverse order.`, `First add ${nl(b)} to both sides: $$\\frac{${v}}{${k}} = ${nl(c.add(b))}$$.`],
    solve: [{ text: `Add ${nl(b)} to both sides.`, math: `\\frac{${v}}{${k}} = ${nl(c.add(b))}` }, { text: `Multiply both sides by ${k}.`, math: `${v} = ${nb(c.add(b))} \\times ${k} = ${nl(s)}` }],
    wrong: [
      [c.add(b).div(k), 'alg_inverse_op'],
      [c.mul(k).add(b), 'alg_order_undo'],
      [c.sub(b).mul(k), 'alg_sign_move'],
    ],
  });
}

function eqContext6(rng: Rng): Draft {
  const name = nameOf(rng);
  if (rng.chance(0.5)) {
    const a = rng.int(2, 6);
    const b = rng.int(2, 6);
    const s = rng.int(4, 15);
    const t = (a + b) * s;
    return eqDraft({
      intro: `${name} buys ${a} packs of trading cards and a friend buys ${b} packs. Every pack has the same number of cards, $$n$$. Together they have ${t} cards. Solve the equation to find the number of cards in a pack.`,
      tex: `${a}n + ${b}n = ${t}`,
      lhs: `${a}n + ${b}n`,
      rhs: `${t}`,
      v: 'n',
      ans: R(s),
      unit: 'cards',
      hints: ['Collect the like terms on the left.', `$$${a}n + ${b}n = ${a + b}n$$`],
      solve: [{ text: 'Collect like terms.', math: `${a + b}n = ${t}` }, { text: `Divide both sides by ${a + b}.`, math: `n = ${s}` }],
      wrong: [
        [R(t, a), 'alg_collect_missed'],
        [R(t - a - b), 'alg_inverse_op'],
      ],
    });
  }
  const k = rng.int(2, 4);
  const s = rng.int(10, 40);
  const t = (k + 1) * s;
  return eqDraft({
    intro: `A school club sold $$x$$ tickets on Friday and ${k} times as many on Saturday, for ${t} tickets in total. Solve the equation to find how many tickets were sold on Friday.`,
    tex: `x + ${k}x = ${t}`,
    lhs: `x + ${k}x`,
    rhs: `${t}`,
    v: 'x',
    ans: R(s),
    unit: 'tickets',
    hints: [`$$x$$ means $$1x$$.`, `$$x + ${k}x = ${k + 1}x$$`],
    solve: [{ text: 'Collect like terms.', math: `${k + 1}x = ${t}` }, { text: `Divide by ${k + 1}.`, math: `x = ${s}` }],
    wrong: [[R(t, k), 'alg_collect_missed']],
  });
}

function eqDecimalCoef(rng: Rng): Draft {
  const v = rng.pick(VARS);
  const a = dz(rng.int(12, 49));
  const s = rng.chance(0.6) ? R(rng.int(2, 9)) : dz(rng.int(11, 59));
  const total = a.mul(s);
  if (!total.mul(10).isInteger()) return eqDecimalCoef(rng);
  const lo = 10;
  const hi = Number(total.mul(10).n) - 10;
  if (hi < lo) return eqDecimalCoef(rng);
  const c = dz(rng.int(lo, hi));
  const e = total.sub(c);
  return eqDraft({
    tex: `${tv(a, v).tex} = ${nl(c)} + ${nl(e)}`,
    lhs: tv(a, v).asc,
    rhs: `${na(c)} + ${na(e)}`,
    v,
    ans: s,
    hints: ['Add the numbers on the right side first.', `Then divide both sides by ${nl(a)}.`],
    solve: [{ text: 'Simplify the right side.', math: `${tv(a, v).tex} = ${nl(total)}` }, { text: `Divide both sides by ${nl(a)}.`, math: `${v} = ${nl(total)} \\div ${nl(a)} = ${nl(s)}` }],
    wrong: [
      [total.sub(a), 'alg_inverse_op'],
      [a.div(total), 'alg_div_order'],
    ],
  });
}

function eqDecimalRev(rng: Rng): Draft {
  const v = rng.pick(VARS);
  const a = dz(rng.int(30, 99));
  const b = dz(rng.int(10, Number(a.mul(10).n) - 5));
  const k = a.sub(b);
  const s = R(rng.int(2, 9));
  const total = k.mul(s);
  const e = dz(rng.int(10, 99));
  const c = total.add(e);
  return eqDraft({
    tex: `${nl(c)} - ${nl(e)} = ${lin([[a, v], [b.neg(), v]]).tex}`,
    lhs: `${na(c)} - ${na(e)}`,
    rhs: lin([
      [a, v],
      [b.neg(), v],
    ]).asc,
    v,
    ans: s,
    hints: ['Simplify each side: subtract the numbers on the left and collect the like terms on the right.', `$$${lin([[a, v], [b.neg(), v]]).tex} = ${tv(k, v).tex}$$`],
    solve: [{ text: 'Simplify both sides.', math: `${nl(total)} = ${tv(k, v).tex}` }, { text: `Divide both sides by ${nl(k)}.`, math: `${v} = ${nl(total)} \\div ${nl(k)} = ${nl(s)}` }],
    wrong: [
      [safe(() => total.div(a)), 'alg_collect_missed'],
      [safe(() => c.add(e).div(k)), 'alg_inverse_op'],
    ],
  });
}

function eqBothSides(rng: Rng, mode: 'pos' | 'int'): Draft {
  const v = rng.pick(VARS);
  let a: number;
  let c: number;
  let s: number;
  let b: Rational;
  if (mode === 'pos') {
    a = rng.int(3, 9);
    c = rng.int(1, a - 1);
    s = rng.int(2, 9);
    b = dz(rng.int(5, 60));
  } else {
    a = rng.signed(1, 9);
    c = rng.signed(1, 9);
    if (a === c) c = a > 0 ? a - 3 : a + 3;
    if (c === 0) c = 2;
    s = rng.signed(1, 9);
    b = R(rng.signed(1, 15));
  }
  const e = R(a - c).mul(s).add(b);
  const L = lin([
    [a, v],
    [b, ''],
  ]);
  const Rr = lin([
    [c, v],
    [e, ''],
  ]);
  return eqDraft({
    tex: `${L.tex} = ${Rr.tex}`,
    lhs: L.asc,
    rhs: Rr.asc,
    v,
    ans: R(s),
    hints: [`Get the $$${v}$$ terms on one side: ${c > 0 ? 'subtract' : 'add'} $$${tv(Math.abs(c), v).tex}$$ on both sides.`, `Then the numbers: you should reach $$${tv(a - c, v).tex} = ${nl(e.sub(b))}$$.`],
    solve: [
      { text: `${c > 0 ? 'Subtract' : 'Add'} $$${tv(Math.abs(c), v).tex}$$ on both sides.`, math: `${lin([[a - c, v], [b, '']]).tex} = ${nl(e)}` },
      { text: `${b.cmp(0) > 0 ? 'Subtract' : 'Add'} ${nl(b.abs())} on both sides.`, math: `${tv(a - c, v).tex} = ${nl(e.sub(b))}` },
      { text: `Divide both sides by ${nb(a - c)}.`, math: `${v} = ${nl(s)}` },
    ],
    wrong: [
      [safe(() => e.sub(b).div(a + c)), 'alg_sign_move'],
      [safe(() => e.add(b).div(a - c)), 'alg_sign_move'],
    ],
  });
}

function eqNegCollect(rng: Rng): Draft {
  const v = rng.pick(VARS);
  const a = rng.int(2, 7);
  const b = rng.int(1, 6);
  const s = rng.signed(1, 6);
  const total = -(a + b) * s;
  const e = rng.int(1, 9);
  const c = total - e;
  return eqDraft({
    tex: `-${a}${v} - ${mono(b, v)} = ${c} - (-${e})`,
    lhs: `-${a}${v} - ${mono(b, v)}`,
    rhs: `${c} - (-${e})`,
    v,
    ans: R(s),
    hints: ['Simplify each side. Subtracting a negative is adding.', `$$-${a}${v} - ${mono(b, v)} = -${a + b}${v}$$ and $$${c} - (-${e}) = ${total}$$.`],
    solve: [{ text: 'Simplify both sides.', math: `-${a + b}${v} = ${total}` }, { text: `Divide both sides by $$-${a + b}$$.`, math: `${v} = ${total} \\div (-${a + b}) = ${s}` }],
    wrong: [
      [R(c - e, -(a + b)), 'alg_neg_sub'],
      [R(-s), 'alg_sign_flip'],
    ],
  });
}

function eqDecimalNeg(rng: Rng): Draft {
  const v = rng.pick(VARS);
  const a = dz(rng.signed(12, 49));
  const s = rng.chance(0.6) ? R(rng.signed(1, 6)) : R(rng.signed(1, 9), 2);
  const b = dz(rng.signed(11, 99));
  const c = a.mul(s).add(b);
  if (!c.mul(100).isInteger()) return eqDecimalNeg(rng);
  const L = lin([
    [a, v],
    [b, ''],
  ]);
  return eqDraft({
    tex: `${L.tex} = ${nl(c)}`,
    lhs: L.asc,
    rhs: na(c),
    v,
    ans: s,
    hints: [`Undo the ${b.cmp(0) > 0 ? 'adding' : 'subtracting'} first: ${b.cmp(0) > 0 ? 'subtract' : 'add'} ${nl(b.abs())} on both sides.`, `Then divide by ${nl(a)}. Watch the signs.`],
    solve: [{ text: `${b.cmp(0) > 0 ? 'Subtract' : 'Add'} ${nl(b.abs())} on both sides.`, math: `${tv(a, v).tex} = ${nl(c.sub(b))}` }, { text: `Divide both sides by ${nb(a)}.`, math: `${v} = ${nl(s)}` }],
    wrong: [
      [c.add(b).div(a), 'alg_inverse_op'],
      [s.neg(), 'alg_sign_flip'],
    ],
  });
}

function eqContext7(rng: Rng): Draft {
  const name = nameOf(rng);
  const fee = dz(rng.int(4, 16) * 5);
  const r = dz(rng.int(5, 20) * 5, 100);
  const n = rng.int(3, 12);
  const total = fee.add(r.mul(n));
  return eqDraft({
    intro: `At a fall fair, entry costs ${money(fee)} and each ride costs ${money(r)}. ${name} spends ${money(total)} in total. Solve the equation to find the number of rides, $$r$$.`,
    tex: `${nl(r)}r + ${nl(fee)} = ${nl(total)}`,
    lhs: `${na(r)}r + ${na(fee)}`,
    rhs: na(total),
    v: 'r',
    ans: R(n),
    unit: 'rides',
    hints: ['Subtract the entry fee from both sides first.', `$$${nl(r)}r = ${nl(total.sub(fee))}$$. Now divide.`],
    solve: [{ text: 'Subtract the entry fee.', math: `${nl(r)}r = ${nl(total.sub(fee))}` }, { text: `Divide by ${nl(r)}.`, math: `r = ${n}` }],
    wrong: [
      [safe(() => total.div(r)), 'alg_ignore_constant'],
      [safe(() => total.add(fee).div(r)), 'alg_inverse_op'],
    ],
  });
}

function eqContext8(rng: Rng): Draft {
  const t0 = rng.int(3, 12);
  const k = rng.int(2, 5);
  const h = rng.int(3, 9);
  const T = t0 - k * h;
  if (T >= 0) return eqContext8(rng);
  return eqDraft({
    intro: `At noon in Iqaluit the temperature is ${t0} °C. It falls ${k} °C every hour. Solve the equation to find after how many hours, $$h$$, the temperature reaches ${nt(T)} °C.`,
    tex: `${t0} - ${k}h = ${T}`,
    lhs: `${t0} - ${k}h`,
    rhs: `${T}`,
    v: 'h',
    ans: R(h),
    unit: 'hours',
    hints: [`Subtract ${t0} from both sides.`, `$$-${k}h = ${T - t0}$$. Divide by $$-${k}$$: a negative divided by a negative is positive.`],
    solve: [{ text: `Subtract ${t0} from both sides.`, math: `-${k}h = ${T - t0}` }, { text: `Divide both sides by $$-${k}$$.`, math: `h = ${h}` }],
    wrong: [
      [R(-h), 'alg_sign_flip'],
      [R(T + t0, k), 'alg_inverse_op'],
    ],
  });
}

function eqBracket(rng: Rng): Draft {
  if (rng.chance(0.35)) {
    const n = rng.int(5, 12);
    const S = 180 * (n - 2);
    return eqDraft({
      intro: `The interior angles of a polygon with $$n$$ sides add up to $$180(n - 2)$$ degrees. A polygon’s interior angles add up to ${S}°. Solve the equation to find how many sides it has.`,
      tex: `180(n - 2) = ${S}`,
      lhs: '180(n - 2)',
      rhs: `${S}`,
      v: 'n',
      ans: R(n),
      unit: 'sides',
      hints: ['Divide both sides by 180 first (or expand the bracket).', `$$n - 2 = ${S / 180}$$`],
      solve: [{ text: 'Divide both sides by 180.', math: `n - 2 = ${S / 180}` }, { text: 'Add 2 to both sides.', math: `n = ${n}` }],
      wrong: [
        [R(S / 180 - 2), 'alg_inverse_op'],
        [R(S + 2, 180), 'alg_dist_first_only'],
      ],
    });
  }
  const v = rng.pick(VARS);
  const k = rng.int(2, 6);
  const b = rng.signed(1, 9);
  const s = rng.signed(1, 12);
  const c = k * (s + b);
  const inner = lin([
    [1, v],
    [b, ''],
  ]);
  return eqDraft({
    tex: `${k}(${inner.tex}) = ${c}`,
    lhs: `${k}(${inner.asc})`,
    rhs: `${c}`,
    v,
    ans: R(s),
    hints: [`Divide both sides by ${k}, or expand the bracket first.`, `$$${inner.tex} = ${nl(R(c, k))}$$`],
    solve: [{ text: `Divide both sides by ${k}.`, math: `${inner.tex} = ${nl(R(c, k))}` }, { text: `${b > 0 ? 'Subtract' : 'Add'} ${Math.abs(b)}.`, math: `${v} = ${s}` }],
    wrong: [
      [R(c - b, k), 'alg_dist_first_only'],
      [R(c, k).add(b), 'alg_sign_move'],
    ],
  });
}

function eqFrac(rng: Rng): Draft {
  const v = rng.pick(VARS);
  const k = rng.int(2, 5);
  const b = rng.signed(1, 9);
  const c = rng.signed(1, 9);
  const s = k * c + b;
  const inner = lin([
    [1, v],
    [-b, ''],
  ]);
  return eqDraft({
    tex: `\\frac{${inner.tex}}{${k}} = ${c}`,
    lhs: `(${inner.asc})/${k}`,
    rhs: `${c}`,
    v,
    ans: R(s),
    hints: [`Multiply both sides by ${k} to clear the fraction.`, `$$${inner.tex} = ${k * c}$$`],
    solve: [{ text: `Multiply both sides by ${k}.`, math: `${inner.tex} = ${k * c}` }, { text: `${b > 0 ? 'Add' : 'Subtract'} ${Math.abs(b)} ${b > 0 ? 'to' : 'from'} both sides.`, math: `${v} = ${s}` }],
    wrong: [
      [R(c, k).add(b), 'alg_inverse_op'],
      [R(k * c - b), 'alg_sign_move'],
    ],
  });
}

function eqBracketBoth(rng: Rng): Draft {
  const v = rng.pick(VARS);
  const a = rng.int(2, 7);
  let k = rng.int(2, 6);
  if (k === a) k++;
  const b = rng.signed(1, 9);
  const e = rng.int(1, 9);
  const s = R(-k * e - b, a - k);
  const L = lin([
    [a, v],
    [b, ''],
  ]);
  return eqDraft({
    tex: `${L.tex} = ${k}(${v} - ${e})`,
    lhs: L.asc,
    rhs: `${k}(${v} - ${e})`,
    v,
    ans: s,
    intro: `Solve for $$${v}$$. Give your answer as an integer, a fraction or a decimal.`,
    hints: ['Expand the bracket first.', `$$${k}(${v} - ${e}) = ${k}${v} - ${k * e}$$. Now get the $$${v}$$ terms on one side.`],
    solve: [
      { text: 'Expand the bracket.', math: `${L.tex} = ${k}${v} - ${k * e}` },
      { text: `Subtract $$${k}${v}$$ from both sides.`, math: `${lin([[a - k, v], [b, '']]).tex} = ${-k * e}` },
      { text: `${b > 0 ? 'Subtract' : 'Add'} ${Math.abs(b)} on both sides.`, math: `${tv(a - k, v).tex} = ${-k * e - b}` },
      { text: `Divide by ${nb(a - k)}.`, math: `${v} = ${nl(s)}` },
    ],
    wrong: [
      [R(-e - b, a - k), 'alg_dist_first_only'],
      [safe(() => R(-k * e - b, a + k)), 'alg_sign_move'],
    ],
  });
}

function eqProportion(rng: Rng): Draft {
  const v = rng.pick(['h', 'x', 'n']);
  const k = rng.int(2, 9);
  const d = rng.pick([4, 5, 8, 10, 12]);
  let n = rng.int(1, 3 * d);
  if (n % d === 0) n++;
  const s = R(k * n, d);
  return eqDraft({
    tex: `\\frac{${v}}{${k}} = \\frac{${n}}{${d}}`,
    lhs: `${v}/${k}`,
    rhs: `${n}/${d}`,
    v,
    ans: s,
    intro: `Solve the proportion for $$${v}$$. Give your answer as a fraction or a decimal.`,
    hints: [`Multiply both sides by ${k}.`, `$$${v} = \\frac{${n} \\times ${k}}{${d}}$$`],
    solve: [{ text: `Multiply both sides by ${k}.`, math: `${v} = \\frac{${n * k}}{${d}}` }, { text: 'Simplify.', math: `${v} = ${nl(s)}` }],
    wrong: [[R(n, d * k), 'alg_inverse_op']],
  });
}

function eqInterest(rng: Rng): Draft {
  const P = rng.pick([200, 400, 500, 800, 1000, 1500]);
  const t = rng.int(2, 5);
  const r = rng.pick([R(2, 100), R(25, 1000), R(3, 100), R(35, 1000), R(4, 100), R(5, 100)]);
  const I = r.mul(P).mul(t);
  return eqDraft({
    intro: `Simple interest is $$I = Prt$$. A savings account earns $$I = ${nl(I)}$$ dollars on $$P = ${P}$$ dollars over $$t = ${t}$$ years. Substitute and solve for the interest rate $$r$$ (as a decimal).`,
    tex: `${nl(I)} = ${P}(r)(${t})`,
    lhs: na(I),
    rhs: `${P}*r*${t}`,
    v: 'r',
    ans: r,
    hints: [`Multiply the known numbers on the right: $$${P} \\times ${t} = ${P * t}$$.`, `$$${nl(I)} = ${P * t}r$$. Divide both sides by ${P * t}.`],
    solve: [{ text: 'Multiply the known values.', math: `${nl(I)} = ${P * t}r` }, { text: `Divide both sides by ${P * t}.`, math: `r = ${nl(r)}` }],
    wrong: [
      [I.div(P), 'alg_collect_missed'],
      [R(P * t).div(I), 'alg_div_order'],
    ],
  });
}

function eqPlans(rng: Rng): Draft {
  const r1 = rng.int(4, 12);
  const r2 = rng.int(1, r1 - 2);
  const s = rng.int(2, 12);
  const f1 = rng.int(1, 6) * 5;
  const f2 = f1 + (r1 - r2) * s;
  return eqDraft({
    intro: `Gym A charges a $${f1} sign-up fee plus $${r1} per month. Gym B charges $${f2} to sign up plus $${r2} per month. Write an equation for when the total costs are equal, and solve it to find the number of months, $$m$$.`,
    tex: `${f1} + ${r1}m = ${f2} + ${mono(r2, 'm')}`,
    lhs: `${f1} + ${r1}m`,
    rhs: `${f2} + ${mono(r2, 'm')}`,
    v: 'm',
    ans: R(s),
    unit: 'months',
    hints: ['Each total is the sign-up fee plus the monthly price times $$m$$. Set the two totals equal.', `$$${f1} + ${r1}m = ${f2} + ${mono(r2, 'm')}$$. Subtract $$${mono(r2, 'm')}$$ and ${f1} from both sides.`],
    solve: [{ text: 'Set the costs equal.', math: `${f1} + ${r1}m = ${f2} + ${mono(r2, 'm')}` }, { text: `Subtract $$${mono(r2, 'm')}$$ and ${f1} from both sides.`, math: `${mono(r1 - r2, 'm')} = ${f2 - f1}` }, { text: `Divide by ${r1 - r2}.`, math: `m = ${s}` }],
    wrong: [
      [R(f2 - f1, r1 + r2), 'alg_sign_move'],
      [R(f2 + f1, r1 - r2), 'alg_sign_move'],
    ],
  });
}

function eqRectangle(rng: Rng): Draft {
  const k = rng.int(2, 3);
  const e = rng.int(1, 6);
  const w = rng.int(3, 12);
  const P = 2 * (k * w + e) + 2 * w;
  return eqDraft({
    intro: `A rectangle’s length is ${e} cm more than ${k === 2 ? 'twice' : 'three times'} its width, $$w$$. Its perimeter is ${P} cm. Solve the equation to find the width.`,
    tex: `2(${k}w + ${e}) + 2w = ${P}`,
    lhs: `2(${k}w + ${e}) + 2w`,
    rhs: `${P}`,
    v: 'w',
    ans: R(w),
    unit: 'cm',
    hints: [`The length is $$${k}w + ${e}$$. Perimeter = 2 × length + 2 × width.`, `Expand and collect: $$${2 * k + 2}w + ${2 * e} = ${P}$$.`],
    solve: [{ text: 'Expand.', math: `${2 * k}w + ${2 * e} + 2w = ${P}` }, { text: 'Collect like terms.', math: `${2 * k + 2}w + ${2 * e} = ${P}` }, { text: `Subtract ${2 * e}, then divide by ${2 * k + 2}.`, math: `w = ${w}` }],
    wrong: [
      [R(P - e, 2 * k + 2), 'alg_dist_first_only'],
      [R(P - 2 * e, 2 * k), 'alg_collect_missed'],
    ],
  });
}

function eqBuildChoice(rng: Rng): Draft {
  const name = nameOf(rng);
  const f = rng.int(2, 10) * 5;
  const r = rng.int(10, 40);
  const mth = rng.int(3, 12);
  const T = f + r * mth;
  return choice(
    rng,
    [p(`${name}’s phone plan has a one-time $${f} activation fee plus $${r} per month. After $$m$$ months ${name} has paid $${T} in total. Which equation represents this situation?`)],
    `$$${r}m + ${f} = ${T}$$`,
    [
      { text: `$$${f}m + ${r} = ${T}$$`, misconception: 'alg_rate_initial_swap' },
      { text: `$$${r}m = ${T} + ${f}$$`, misconception: 'alg_inverse_op' },
      { text: `$$${r + f}m = ${T}$$`, misconception: 'alg_combine_unlike' },
    ],
    {
      hints: ['Which amount is paid every month, and which is paid only once?', `Each month adds $${r}, so the monthly part is $$${r}m$$. The fee is added once.`],
      solution: [p(`Monthly cost × months + one-time fee = total: $$${r}m + ${f} = ${T}$$. Solving gives $$${r}m = ${T - f}$$, so $$m = ${mth}$$ months. Check: $$${r}(${mth}) + ${f} = ${T}$$.`)],
      params: { kind: 'eqChoice', v: 'm', s: mth },
    },
  );
}

export const solveLinear: SkillPack = {
  id: 'solve-linear',
  title: 'Solving equations',
  subject: 'math',
  expectations: [
    { id: `${G6}:C2.3`, note: 'Solves equations with multiple terms and whole numbers (collecting like terms, two-step equations, dividing by a number), including word contexts; every solution shows a substitution check.', levels: [1, 2, 3] },
    { id: `${G7}:C2.3`, note: 'Solves equations with multiple terms, whole numbers and decimal numbers, including a money context and variables on both sides as a stretch; solutions are verified by substitution.', levels: [1, 2, 3, 4] },
    { id: `${G8}:C2.3`, note: 'Solves equations with multiple terms, integers and decimal numbers, including variables on both sides and a temperature context; solutions are verified by substitution.', levels: [2, 3, 4] },
    { id: `${W}:C1.5`, note: 'Creates and solves linear equations: brackets, fractions, proportions, variables on both sides, formulas such as I = Prt, and equations built from contexts (including choosing the equation that models a situation). Degree 2 and 3 equations are not covered.', levels: [2, 3, 4] },
  ],
  prerequisites: ['eval-expr', 'like-terms'],
  goal: 'I can solve an equation by keeping it balanced, and check my answer by substituting it back.',
  explain: (c) => [
    p('An **equation** says two expressions are equal. **Solving** it means finding the value of the variable that makes it true.'),
    p('Think of a balance: whatever you do to one side, do to the other, and it stays balanced. Use **inverse operations** to undo what was done to the variable, in reverse order.'),
    steps(
      { text: 'Simplify each side: collect like terms' + (c.grade >= 9 ? ' and expand brackets.' : '.'), math: '5m + 3m = 10 + 6 \\;\\Rightarrow\\; 8m = 16' },
      { text: 'Undo adding or subtracting first.', math: '3x - 2 = 20 \\;\\Rightarrow\\; 3x = 22' },
      { text: 'Then undo multiplying or dividing.', math: '8m = 16 \\;\\Rightarrow\\; m = 2' },
      { text: 'Check: put the answer back into the original equation. Both sides should match.' },
    ),
    ...(c.grade >= 8 ? [p('If the variable is on both sides, first move all the variable terms to one side by adding or subtracting a term on both sides: $$5x - 10 = -3x + 6 \\Rightarrow 8x - 10 = 6$$.')] : []),
    c.simple ? tip('Do the same thing to both sides. Undo + and − first, then × and ÷.') : tip('Guess-and-check and a reverse flow chart are also good strategies. The check by substitution is what proves an answer is right.'),
  ],
  alternatives: (c) => ({
    simpler: [p('Ask: what number makes this true? For $$3x - 2 = 20$$: add 2 to get $$3x = 22$$… for whole numbers, try $$3x + 1 = 13$$: take away 1, then share 12 into 3 groups, so $$x = 4$$.')],
    analogy: [p('A balance scale with bags of marbles (the variable) and loose marbles. Take the same number of loose marbles off both pans, then share what is left equally among the bags.')],
    steps: [steps({ text: 'Write the equation.', math: '\\frac{m}{4} - 2 = 10' }, { text: 'Reverse flow chart: the last thing done to m was “− 2”, so add 2.', math: '\\frac{m}{4} = 12' }, { text: 'Before that, m was divided by 4, so multiply by 4.', math: 'm = 48' }, { text: 'Check.', math: '48 \\div 4 - 2 = 10 \\;\\checkmark' })],
    visual: [{ kind: 'table', header: ['Step', 'Left side', 'Right side'], rows: [['Start', '$$3x + 4$$', '$$19$$'], ['− 4 on both sides', '$$3x$$', '$$15$$'], ['÷ 3 on both sides', '$$x$$', '$$5$$']] }],
    ...(c.grade >= 9 ? { compare: [p('Solving is evaluating backwards. If you know $$2x + 3$$ gives 11, you are looking for the input that produces that output.')] } : {}),
  }),
  example: (rng, c) => {
    const a = rng.int(2, 6);
    const s = c.grade >= 8 ? rng.signed(2, 8) : rng.int(2, 9);
    const b = rng.int(1, 12);
    const r = a * s + b;
    return [
      p(`Solve $$${a}x + ${b} = ${r}$$.`),
      steps({ text: `Subtract ${b} from both sides.`, math: `${a}x = ${r - b}` }, { text: `Divide both sides by ${a}.`, math: `x = ${s}` }, { text: 'Check.', math: `${a}(${s}) + ${b} = ${r} \\; \\checkmark` }),
    ];
  },
  generate: (rng, d, c) => {
    const g = c.grade;
    if (g <= 6) {
      if (d <= 1) return rng.chance(0.5) ? eqCollect(rng, false) : eqTwoStep(rng, 6);
      if (d === 2) return rng.pick([() => eqCollect(rng, true), () => eqTwoStep(rng, 6), () => eqRightSide(rng)])();
      return rng.chance(0.5) ? eqDivide(rng, 6) : eqContext6(rng);
    }
    if (g === 7) {
      if (d <= 1) return rng.chance(0.5) ? eqCollect(rng, false) : eqTwoStep(rng, 7);
      if (d === 2) return rng.chance(0.5) ? eqDecimalCoef(rng) : eqDecimalRev(rng);
      if (d === 3) return rng.chance(0.5) ? eqDivide(rng, 7) : eqContext7(rng);
      return eqBothSides(rng, 'pos');
    }
    if (g === 8) {
      if (d <= 2) return rng.chance(0.5) ? eqTwoStep(rng, 8) : eqNegCollect(rng);
      if (d === 3) return rng.chance(0.5) ? eqBothSides(rng, 'int') : eqDecimalNeg(rng);
      return rng.chance(0.5) ? eqContext8(rng) : eqDivide(rng, 8);
    }
    if (d <= 2) return rng.pick([() => eqBracket(rng), () => eqFrac(rng), () => eqBothSides(rng, 'int')])();
    if (d === 3) return rng.pick([() => eqBracketBoth(rng), () => eqProportion(rng), () => eqInterest(rng), () => eqBuildChoice(rng)])();
    return rng.pick([() => eqPlans(rng), () => eqRectangle(rng), () => eqBuildChoice(rng)])();
  },
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Record<string, unknown>;
    try {
      if (pr.kind === 'eq') {
        const key = keyNum(q);
        if (!key) return 'unreadable key';
        const v = String(pr.v);
        // Substitute the key back into both sides.
        const ls = evalAt(String(pr.lhs), { [v]: key });
        const rs = evalAt(String(pr.rhs), { [v]: key });
        if (!ls.eq(rs)) return `substituting ${q.type === 'numeric' ? q.answer : ''} gives ${ls.toString()} ≠ ${rs.toString()}`;
        // The equation must be linear with a unique solution.
        const poly = toPoly(parseExpr(`(${String(pr.lhs)}) - (${String(pr.rhs)})`));
        if (!poly || !poly.get(v) || [...poly.keys()].some((k) => k !== '' && k !== v)) return 'equation is not linear with one solution';
        return null;
      }
      if (pr.kind === 'eqChoice') {
        const s = R(Number(pr.s));
        const holds = (t: string) => {
          const [l, r] = strip(t).split('=');
          return evalAt(l!, { [String(pr.v)]: s }).eq(evalAt(r!, { [String(pr.v)]: s }));
        };
        if (!holds(rightText(q))) return 'chosen equation is not satisfied by the context';
        return otherTexts(q).some(holds) ? 'a distractor is also satisfied' : null;
      }
    } catch {
      return 'unreadable equation';
    }
    return 'unknown question kind';
  },
  summary: ['An equation stays balanced when you do the same thing to both sides.', 'Simplify each side, undo addition/subtraction, then undo multiplication/division.', 'Verify by substituting the solution into the original equation: both sides must be equal.'],
  misconceptions: [
    { id: 'alg_inverse_op', label: 'Used the same operation instead of the inverse', explanation: 'To undo “+ 5” you subtract 5; to undo “× 3” you divide by 3. Doing the same operation again moves further from the answer.', fix: 'Ask “what was done to the variable?” and do the opposite to both sides.' },
    { id: 'alg_order_undo', label: 'Undid the steps in the wrong order', explanation: 'The last operation done to the variable must be undone first, like taking off shoes before socks.', fix: 'Undo adding or subtracting first, then multiplying or dividing.' },
    { id: 'alg_collect_missed', label: 'Left out a term', explanation: 'Not every term with the variable was included when collecting, or a known value was left out.', fix: 'Collect all the variable terms first, including any written without a number in front.' },
    { id: 'alg_sign_move', label: 'Moved a term without changing its sign', explanation: 'Moving a term to the other side really means adding or subtracting it on both sides, which changes its sign.', fix: 'Write the operation on both sides, for example “− 3x” under each side.' },
    { id: 'alg_sign_flip', label: 'Sign error when dividing by a negative', explanation: 'A positive divided by a negative is negative, and a negative divided by a negative is positive.', fix: 'Decide the sign of the answer first, then divide the sizes.' },
    { id: 'alg_div_order', label: 'Divided the wrong way round', explanation: 'If $$4x = 12$$, then $$x = 12 \\div 4$$, not $$4 \\div 12$$.', fix: 'Divide the number side by the coefficient of the variable.' },
    { id: 'alg_neg_sub', label: 'Subtracting a negative', explanation: 'Taking away a negative is the same as adding: $$10 - (-6) = 16$$.', fix: 'Rewrite subtraction as adding the opposite.' },
    { id: 'alg_dist_first_only', label: 'Multiplied only part of the bracket', explanation: 'The number outside a bracket multiplies **every** term inside.', fix: 'Expand fully, or divide both sides by the outside number first.' },
    { id: 'alg_ignore_constant', label: 'Forgot the one-time amount', explanation: 'The fixed amount (like an entry fee) is part of the total and has to be removed before dividing.', fix: 'Subtract the fixed amount from the total first.' },
    { id: 'alg_rate_initial_swap', label: 'Swapped the rate and the fixed amount', explanation: 'The amount that repeats (per month, per hour) multiplies the variable; the one-time amount is added once.', fix: 'Ask: which number happens every time? That one goes with the variable.' },
    { id: 'alg_combine_unlike', label: 'Combined unlike terms', explanation: 'A term with a variable and a plain number are not like terms, so they can’t be added together.', fix: 'Keep variable terms and number terms separate.' },
  ],
};

// ═══════════════════════ Pack 4: inequalities ═══════════════════════

type Op = '>' | '<' | '>=' | '<=';
const opTex: Record<Op, string> = { '>': '>', '<': '<', '>=': '\\ge', '<=': '\\le' };
const opWord: Record<Op, string> = { '>': 'greater than', '<': 'less than', '>=': 'greater than or equal to', '<=': 'less than or equal to' };
const flipOp = (o: Op): Op => ({ '>': '<', '<': '>', '>=': '<=', '<=': '>=' })[o] as Op;
const strictToggle = (o: Op): Op => ({ '>': '>=', '>=': '>', '<': '<=', '<=': '<' })[o] as Op;
const holdsOp = (a: Rational, o: Op, b: Rational) => {
  const c = a.cmp(b);
  return o === '>' ? c > 0 : o === '<' ? c < 0 : o === '>=' ? c >= 0 : c <= 0;
};

type IneqT = { v: string; lhs: string; rhs: string; tex: string; op: Op; A: Rational; k: Rational; sol: Op; steps: { text: string; math?: string }[]; varRight?: boolean; hint2: string };

function ineqBuild(rng: Rng, g: number, d: number): IneqT {
  const v = rng.pick(['x', 'm', 'n', 'a', 'k', 'p']);
  const op = rng.pick(['>', '<', '>=', '<='] as const);
  const show = (o: Op) => opTex[o];
  if (g <= 6 || (g === 7 && d <= 1)) {
    const a = rng.int(2, 9);
    const s = rng.int(2, 12);
    const b = rng.int(1, 20) * (rng.chance(0.5) ? 1 : -1);
    const c = a * s + b;
    if (c <= 0 || c > 100) return ineqBuild(rng, g, d);
    const L = lin([
      [a, v],
      [b, ''],
    ]);
    return {
      v,
      lhs: L.asc,
      rhs: `${c}`,
      tex: `${L.tex} ${show(op)} ${c}`,
      op,
      A: R(a),
      k: R(s),
      sol: op,
      hint2: `$$${mono(a, v)} ${show(op)} ${c - b}$$. Now divide both sides by ${a}.`,
      steps: [
        { text: `${b > 0 ? 'Subtract' : 'Add'} ${Math.abs(b)} on both sides.`, math: `${mono(a, v)} ${show(op)} ${c - b}` },
        { text: `Divide both sides by ${a}. Dividing by a positive number keeps the sign the same.`, math: `${v} ${show(op)} ${s}` },
      ],
    };
  }
  if (g === 7) {
    const a = rng.int(3, 9);
    const b = rng.int(1, a - 1);
    const s = rng.int(2, 12);
    const sub = rng.chance(0.5);
    const k = sub ? a - b : a + b;
    const total = k * s;
    const varRight = d >= 3;
    const c = sub ? total + rng.int(1, 15) : rng.int(1, total - 1);
    const e = sub ? c - total : total - c;
    const L = lin([
      [a, v],
      [sub ? -b : b, v],
    ]);
    const nums = `${c} ${sub ? '-' : '+'} ${e}`;
    if (varRight) {
      return {
        v,
        lhs: nums,
        rhs: L.asc,
        tex: `${nums} ${show(op)} ${L.tex}`,
        op,
        A: R(-k),
        k: R(s),
        sol: flipOp(op),
        varRight: true,
        hint2: `$$${total} ${show(op)} ${mono(k, v)}$$, so $$${s} ${show(op)} ${v}$$. Read it from the variable’s side.`,
        steps: [
          { text: 'Simplify both sides.', math: `${total} ${show(op)} ${mono(k, v)}` },
          { text: `Divide both sides by ${k}.`, math: `${s} ${show(op)} ${v}` },
          { text: `Read it starting from $$${v}$$: the sign points the other way.`, math: `${v} ${show(flipOp(op))} ${s}` },
        ],
      };
    }
    return {
      v,
      lhs: L.asc,
      rhs: nums,
      tex: `${L.tex} ${show(op)} ${nums}`,
      op,
      A: R(k),
      k: R(s),
      sol: op,
      hint2: `$$${mono(k, v)} ${show(op)} ${total}$$. Now divide.`,
      steps: [
        { text: 'Simplify both sides.', math: `${mono(k, v)} ${show(op)} ${total}` },
        { text: `Divide both sides by ${k}.`, math: `${v} ${show(op)} ${s}` },
      ],
    };
  }
  // Grade 8: integers, sometimes dividing by a negative.
  const s = rng.signed(1, 9);
  if (d <= 2) {
    const a = rng.chance(0.5) ? rng.int(2, 9) : -rng.int(2, 9);
    const b = rng.signed(1, 15);
    const c = a * s + b;
    const L = lin([
      [a, v],
      [b, ''],
    ]);
    const sol = a < 0 ? flipOp(op) : op;
    return {
      v,
      lhs: L.asc,
      rhs: `${c}`,
      tex: `${L.tex} ${show(op)} ${c}`,
      op,
      A: R(a),
      k: R(s),
      sol,
      hint2: `$$${mono(a, v)} ${show(op)} ${c - b}$$. Now divide by ${nb(a)}.${a < 0 ? ' Dividing by a negative reverses the sign.' : ''}`,
      steps: [
        { text: `${b > 0 ? 'Subtract' : 'Add'} ${Math.abs(b)} on both sides.`, math: `${mono(a, v)} ${show(op)} ${c - b}` },
        { text: `Divide both sides by ${nb(a)}.${a < 0 ? ' Dividing by a negative number **reverses** the inequality sign.' : ''}`, math: `${v} ${show(sol)} ${s}` },
      ],
    };
  }
  const a = rng.signed(1, 9);
  let c = rng.signed(1, 9);
  if (c === a) c = a > 0 ? a - 2 : a + 2;
  if (c === 0) c = 3;
  const b = rng.signed(1, 12);
  const e = (a - c) * s + b;
  const L = lin([
    [a, v],
    [b, ''],
  ]);
  const Rr = lin([
    [c, v],
    [e, ''],
  ]);
  const k = a - c;
  const sol = k < 0 ? flipOp(op) : op;
  return {
    v,
    lhs: L.asc,
    rhs: Rr.asc,
    tex: `${L.tex} ${show(op)} ${Rr.tex}`,
    op,
    A: R(k),
    k: R(s),
    sol,
    hint2: `You should reach $$${mono(k, v)} ${show(op)} ${e - b}$$.${k < 0 ? ' Then divide by a negative: reverse the sign.' : ''}`,
    steps: [
      { text: `${c > 0 ? 'Subtract' : 'Add'} $$${mono(Math.abs(c), v)}$$ on both sides, and ${b > 0 ? 'subtract' : 'add'} ${Math.abs(b)} on both sides.`, math: `${mono(k, v)} ${show(op)} ${e - b}` },
      { text: `Divide both sides by ${nb(k)}.${k < 0 ? ' Dividing by a negative number **reverses** the inequality sign.' : ''}`, math: `${v} ${show(sol)} ${s}` },
    ],
  };
}

function ineqChoice(rng: Rng, t: IneqT): Draft {
  const opt = (o: Op) => `$$${t.v} ${opTex[o]} ${nl(t.k)}$$`;
  const rev = flipOp(t.sol);
  const revMis = t.A.cmp(0) < 0 && !t.varRight ? 'alg_ineq_no_flip' : t.varRight ? 'alg_ineq_side_swap' : 'alg_ineq_flip_wrong';
  return choice(rng, [p('Solve the inequality. Which is the solution?'), m(t.tex)], opt(t.sol), [{ text: opt(rev), misconception: revMis }, { text: opt(strictToggle(t.sol)), misconception: 'alg_ineq_strict' }, { text: opt(strictToggle(rev)) }], {
    hints: ['Solve it like an equation, keeping the inequality sign in place of the equal sign.', t.hint2],
    solution: [steps(...t.steps), p(`**Verify:** try a value that should work, such as $$${t.v} = ${nl(t.sol === '>' || t.sol === '>=' ? t.k.add(1) : t.k.sub(1))}$$: the inequality is true. The solution is $$${t.v} ${opTex[t.sol]} ${nl(t.k)}$$, all numbers ${opWord[t.sol]} ${nt(t.k)}.`)],
    params: { kind: 'ineqChoice', lhs: t.lhs, rhs: t.rhs, op: t.op, v: t.v },
  });
}

function ineqExtreme(t: IneqT, g: number): Draft {
  const up = t.sol === '>' || t.sol === '>=';
  const strict = t.sol === '>' || t.sol === '<';
  const ans = up ? (strict ? t.k.add(1) : t.k) : strict ? t.k.sub(1) : t.k;
  const word = g >= 8 ? 'integer' : 'whole number';
  const which = up ? 'smallest' : 'greatest';
  return numeric([p(`What is the ${which} ${word} that makes this inequality true?`), m(t.tex)], na(ans), {
    hints: ['Solve the inequality first.', `${t.hint2} Then decide whether $$${nl(t.k)}$$ itself is included.`],
    solution: [steps(...t.steps, { text: `${strict ? `$$${nl(t.k)}$$ is not included (strict inequality), so the ${which} ${word} is the next one ${up ? 'up' : 'down'}.` : `$$${nl(t.k)}$$ is included.`}`, math: `${t.v} = ${nl(ans)}` }), p(`**Verify:** $$${t.v} = ${nl(ans)}$$ makes the inequality true, and $$${t.v} = ${nl(up ? ans.sub(1) : ans.add(1))}$$ does not.`)],
    knownWrong: wrongs(ans, [
      [strict ? t.k : up ? t.k.add(1) : t.k.sub(1), 'alg_ineq_strict'],
    ]),
    params: { kind: 'ineqExtreme', lhs: t.lhs, rhs: t.rhs, op: t.op, v: t.v, which: up ? 'min' : 'max', integer: g >= 8 },
  });
}

function ineqVerify(rng: Rng, t: IneqT): Draft {
  const cand = t.k.add(rng.pick([-2, -1, 0, 0, 1, 2]));
  const L = evalAt(t.lhs, { [t.v]: cand });
  const Rv = evalAt(t.rhs, { [t.v]: cand });
  const truth = holdsOp(L, t.op, Rv);
  return trueFalse([p(`True or false: $$${t.v} = ${nl(cand)}$$ is a solution of this inequality.`), m(t.tex)], truth, {
    hints: [`Substitute $$${nl(cand)}$$ for $$${t.v}$$ on both sides.`, `Left side $$= ${nl(L)}$$. Work out the right side and compare.`],
    solution: [p(`Left side: $$${nl(L)}$$. Right side: $$${nl(Rv)}$$. Is $$${nl(L)} ${opTex[t.op]} ${nl(Rv)}$$? ${truth ? 'Yes' : 'No'}, so the statement is **${truth ? 'true' : 'false'}**.`), p(`(The full solution is $$${t.v} ${opTex[t.sol]} ${nl(t.k)}$$.)`)],
    misconception: cand.eq(t.k) && (t.op === '>' || t.op === '<') ? 'alg_ineq_strict' : undefined,
    params: { kind: 'ineqTF', lhs: t.lhs, rhs: t.rhs, op: t.op, v: t.v, t: cand.toString() },
  });
}

function ineqBudget(rng: Rng): Draft {
  const name = nameOf(rng);
  const f = rng.int(2, 6) * 5;
  const r = rng.int(3, 9);
  const B = f + r * rng.int(4, 10) + rng.int(0, r - 1);
  const ans = Math.floor((B - f) / r);
  return numeric([p(`A climbing gym charges a $${f} membership fee plus $${r} per visit. ${name} can spend at most $${B}. The inequality $$${r}v + ${f} \\le ${B}$$ describes this. What is the greatest number of visits ${name} can make?`)], `${ans}`, {
    hints: ['Solve the inequality like an equation: subtract the fee, then divide.', `$$v \\le ${nl(R(B - f, r))}$$. Visits are counted in whole numbers.`],
    solution: [steps({ text: `Subtract ${f} on both sides.`, math: `${r}v \\le ${B - f}` }, { text: `Divide by ${r}.`, math: `v \\le ${nl(R(B - f, r))}` }, { text: 'The greatest whole number that fits:', math: `v = ${ans}` }), p(`**Verify:** $$${r}(${ans}) + ${f} = ${r * ans + f} \\le ${B}$$, but $$${r}(${ans + 1}) + ${f} = ${r * (ans + 1) + f}$$ is too much.`)],
    unit: 'visits',
    knownWrong: wrongs(R(ans), [
      [R(Math.ceil((B - f) / r)), 'alg_ineq_round_up'],
      [R(Math.floor(B / r)), 'alg_ignore_constant'],
    ]),
    params: { kind: 'ineqExtreme', lhs: `${r}v + ${f}`, rhs: `${B}`, op: '<=', v: 'v', which: 'max', integer: false },
  });
}

export const inequalities: SkillPack = {
  id: 'inequalities',
  title: 'Solving inequalities',
  subject: 'math',
  expectations: [
    { id: `${G6}:C2.4`, note: 'Solves two-operation inequalities with whole numbers up to 100, chooses the solution, finds the least or greatest whole number that works, and verifies values by substitution. Graphing on a number line is explained but not assessed.', levels: [1, 2, 3] },
    { id: `${G7}:C2.4`, note: 'Solves inequalities with multiple terms and whole numbers (including the variable on the right side) and verifies solutions by substitution. Graphing on a number line is explained but not assessed.', levels: [1, 2, 3] },
    { id: `${G8}:C2.4`, note: 'Solves inequalities with integers, including variables on both sides and reversing the sign when dividing by a negative, and verifies solutions. Graphing on a number line is explained but not assessed.', levels: [2, 3, 4] },
  ],
  prerequisites: ['solve-linear'],
  goal: 'I can solve an inequality, describe all the values that make it true, and check a value by substituting it.',
  explain: (c) => [
    p('An **inequality** compares two expressions with $$>$$ (greater than), $$<$$ (less than), $$\\ge$$ (greater than or equal to) or $$\\le$$ (less than or equal to). Its solution is usually a whole range of numbers, like $$x > 4$$.'),
    steps({ text: 'Solve it like an equation: do the same thing to both sides.', math: '5x - 20 \\ge 80 \\;\\Rightarrow\\; 5x \\ge 100' }, { text: 'Divide to get the variable alone.', math: 'x \\ge 20' }, { text: 'Verify: test a value in the range (like 21) and one outside it (like 19).' }),
    ...(c.grade >= 8 ? [warn('When you multiply or divide both sides by a **negative** number, reverse the inequality sign: $$-2x < 6$$ becomes $$x > -3$$.')] : []),
    p('On a number line, the solution is shown with a dot at the boundary (open for $$>$$ or $$<$$, closed for $$\\ge$$ or $$\\le$$) and an arrow in the direction of the solutions. Practice here checks the solution itself; drawing the graph is not marked.'),
    c.simple ? tip('Solve like an equation. Then ask: is the boundary number included or not?') : tip('Read the answer starting from the variable: $$8 > 2m$$ means $$m < 4$$.'),
  ],
  alternatives: (c) => ({
    simpler: [p('$$x > 4$$ means “x is any number bigger than 4”. 5 works, 100 works, 4 does not.')],
    analogy: [p('A ride says “you must be at least 120 cm tall”. That is $$h \\ge 120$$: 120 cm is allowed, and so is anything taller.')],
    visual: [{ kind: 'diagram', diagram: { type: 'number_line', min: 0, max: 10, step: 1, points: [{ at: 4, label: 'open dot at 4' }], jumps: [{ from: 4, to: 10, label: 'x > 4' }] }, alt: 'A number line from 0 to 10 with an open dot at 4 and an arrow to the right, showing x > 4.' }],
    steps: [steps({ text: 'Collect like terms on each side.' }, { text: 'Undo adding and subtracting.' }, { text: c.grade >= 8 ? 'Undo multiplying or dividing; reverse the sign if the number is negative.' : 'Undo multiplying or dividing.' }, { text: 'Check one value inside and one outside the solution.' })],
    compare: [p('It is the same as solving $$2x + 3 = 9$$ (which gives $$x = 3$$), except the answer is a range: $$2x + 3 < 9$$ gives $$x < 3$$.')],
  }),
  example: (rng, c) => {
    const a = c.grade >= 8 ? -rng.int(2, 5) : rng.int(2, 5);
    const s = rng.int(2, 8);
    const b = rng.int(1, 10);
    const r = a * s + b;
    return [
      p(`Solve $$${a}x + ${b} < ${r}$$.`),
      steps({ text: `Subtract ${b} from both sides.`, math: `${a}x < ${r - b}` }, { text: `Divide by ${nb(a)}.${a < 0 ? ' It is negative, so reverse the sign.' : ''}`, math: `x ${a < 0 ? '>' : '<'} ${s}` }, { text: `Check $$x = ${a < 0 ? s + 1 : s - 1}$$: $$${a}(${a < 0 ? s + 1 : s - 1}) + ${b} = ${a * (a < 0 ? s + 1 : s - 1) + b} < ${r}$$ ✓` }),
    ];
  },
  generate: (rng, d, c) => {
    const g = c.grade;
    if (g <= 6 && d === 3 && rng.chance(0.4)) return ineqBudget(rng);
    const t = ineqBuild(rng, g, d);
    const r = rng.next();
    if (d >= 3 && r < 0.3) return ineqVerify(rng, t);
    if (d >= 2 && r < 0.6) return ineqExtreme(t, g);
    return ineqChoice(rng, t);
  },
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Record<string, unknown>;
    const v = String(pr.v);
    const op = pr.op as Op;
    const holds = (x: Rational) => holdsOp(evalAt(String(pr.lhs), { [v]: x }), op, evalAt(String(pr.rhs), { [v]: x }));
    try {
      if (pr.kind === 'ineqChoice') {
        const mm = /^\$\$([a-z]) (>|<|\\ge|\\le) (-?[\d.]+)\$\$$/.exec(rightText(q));
        if (!mm) return 'unreadable solution option';
        const claim = ({ '>': '>', '<': '<', '\\ge': '>=', '\\le': '<=' } as Record<string, Op>)[mm[2]!]!;
        const k = rq(mm[3]);
        // Enumerate values around the boundary: the original inequality and the claimed solution must agree.
        for (const off of [-3, -1, R(-1, 2), 0, R(1, 2), 1, 3]) {
          const x = k.add(off);
          if (holds(x) !== holdsOp(x, claim, k)) return `option disagrees with the inequality at ${x.toString()}`;
        }
        return null;
      }
      if (pr.kind === 'ineqExtreme') {
        const key = keyNum(q);
        if (!key || !key.isInteger()) return 'key is not an integer';
        const step = pr.which === 'min' ? 1 : -1;
        if (!holds(key) || holds(key.sub(step))) return 'key is not the boundary whole number';
        if (!holds(key.add(step)) || !holds(key.add(10 * step))) return 'solution set is not on the expected side';
        if (!pr.integer && key.cmp(0) < 0) return 'whole-number answer is negative';
        return null;
      }
      if (pr.kind === 'ineqTF' && q.type === 'true_false') return holds(rq(pr.t)) === q.answer ? null : 'true/false key is wrong';
    } catch {
      return 'unreadable inequality';
    }
    return 'unknown question kind';
  },
  summary: ['Solve an inequality like an equation, keeping the inequality sign.', 'Multiplying or dividing both sides by a negative number reverses the inequality sign.', 'Verify by testing a value inside the solution (true) and one outside it (false).'],
  misconceptions: [
    { id: 'alg_ineq_no_flip', label: 'Did not reverse the sign', explanation: 'Multiplying or dividing both sides by a negative number reverses the order: $$2 < 3$$ but $$-2 > -3$$.', fix: 'Whenever you divide by a negative, flip the inequality sign, then check with a test value.' },
    { id: 'alg_ineq_flip_wrong', label: 'Reversed the sign without a reason', explanation: 'Adding, subtracting, or multiplying and dividing by a **positive** number keeps the inequality sign the same.', fix: 'Only reverse the sign when multiplying or dividing by a negative number.' },
    { id: 'alg_ineq_strict', label: 'Mixed up “greater than” and “greater than or equal to”', explanation: '$$x > 4$$ does not include 4, but $$x \\ge 4$$ does.', fix: 'Test the boundary number itself: does it make the inequality true?' },
    { id: 'alg_ineq_side_swap', label: 'Read the inequality backwards', explanation: '$$8 > 2m$$ says 2m is less than 8, so $$m < 4$$. The sign “points” at the smaller side.', fix: 'Rewrite with the variable on the left; the sign turns around with it.' },
    { id: 'alg_ineq_round_up', label: 'Rounded up past the limit', explanation: 'If at most 7.6 visits fit in the budget, 8 visits cost too much. You need the greatest whole number that still works.', fix: 'Round down for “at most”, and check the answer in the original inequality.' },
    { id: 'alg_ignore_constant', label: 'Forgot the one-time amount', explanation: 'The fixed fee is part of the total and must be taken off before dividing.', fix: 'Subtract the fixed amount first.' },
  ],
};

// ═══════════════════════ Pack 5: pattern rules ═══════════════════════

type Pat = { a: Rational; b: Rational };
const patVal = (pt: Pat, n: number | Rational) => pt.a.mul(rat(n)).add(pt.b);
const ruleText = (pt: Pat) =>
  lin([
    [pt.a, 'n'],
    [pt.b, ''],
  ]);

function patMake(rng: Rng, g: number, d: number): Pat {
  if (g <= 6) return { a: R(rng.int(2, 9)), b: R(rng.int(d <= 1 ? 1 : 0, 12)) };
  if (g === 7) {
    if (d <= 1) return { a: R(rng.int(2, 9)), b: R(rng.int(1, 12)) };
    return rng.chance(0.6) ? { a: dz(rng.pick([5, 15, 25, 12, 35, 4, 8])), b: dz(rng.int(0, 60)) } : { a: R(rng.int(2, 12)), b: dz(rng.int(1, 99)) };
  }
  // Grade 8: growing or shrinking, with integers and decimals.
  const a = rng.chance(0.5) ? -rng.int(2, 9) : rng.int(2, 9);
  if (d >= 3 && rng.chance(0.4)) return { a: dz(a * 5), b: dz(rng.signed(5, 99)) };
  return { a: R(a), b: R(a < 0 ? rng.int(20, 60) : rng.signed(1, 15)) };
}

function patTable(pt: Pat, ns: number[], missing?: number): Block {
  return { kind: 'table', header: ['Position number, $$n$$', 'Term value'], rows: ns.map((n) => [String(n), n === missing ? '?' : nt(patVal(pt, n))]) };
}

function patFar(rng: Rng, pt: Pat, d: number): Draft {
  const N = d <= 1 ? rng.pick([6, 8, 10, 12]) : rng.pick([20, 25, 40, 50, 100]);
  const ans = patVal(pt, N);
  return numeric([p(`Here is a linear pattern. What is the term value at position ${N}?`), patTable(pt, [1, 2, 3, 4])], na(ans), {
    hints: [`How much does the term value change from one position to the next?`, `The rule is “${nt(pt.a)} times the position number, ${pt.b.cmp(0) < 0 ? 'minus' : 'plus'} ${nt(pt.b.abs())}”: $$${ruleText(pt).tex}$$.`],
    solution: [steps({ text: `The term value changes by ${nt(pt.a)} each time, so the rule starts with $$${lin([[pt.a, 'n']]).tex}$$.` }, { text: `At position 1, $$${nl(pt.a)} \\times 1 = ${nl(pt.a)}$$, but the term is $$${nl(patVal(pt, 1))}$$, so ${pt.b.cmp(0) < 0 ? 'subtract' : 'add'} $$${nl(pt.b.abs())}$$.`, math: `\\text{value} = ${ruleText(pt).tex}` }, { text: `Substitute $$n = ${N}$$.`, math: `${nl(pt.a)}(${N}) ${pt.b.cmp(0) < 0 ? '-' : '+'} ${nl(pt.b.abs())} = ${nl(ans)}` })],
    knownWrong: wrongs(ans, [
      [pt.a.mul(N), 'alg_pattern_no_constant'],
      [patVal(pt, N + 1), 'alg_pattern_off_by_one'],
      [N % 4 === 0 ? patVal(pt, 4).mul(N / 4) : null, 'alg_pattern_proportional'],
    ]),
    params: { kind: 'patValue', a: pt.a.toString(), b: pt.b.toString(), n: N },
  });
}

function patMissing(rng: Rng, pt: Pat): Draft {
  const miss = rng.int(2, 4);
  const ans = patVal(pt, miss);
  return numeric([p('One term is missing from this linear pattern. What is it?'), patTable(pt, [1, 2, 3, 4, 5], miss)], na(ans), {
    hints: ['Find the constant change between terms you know next to each other.', `Each term is ${nt(pt.a)} ${pt.a.cmp(0) < 0 ? '(a decrease)' : ''} more than the one before.`],
    solution: [p(`The terms change by $$${nl(pt.a)}$$ each step, so the missing term is $$${nl(patVal(pt, miss - 1))} ${pt.a.cmp(0) < 0 ? '-' : '+'} ${nl(pt.a.abs())} = ${nl(ans)}$$. Check with the rule $$${ruleText(pt).tex}$$: $$n = ${miss}$$ gives $$${nl(ans)}$$.`)],
    params: { kind: 'patValue', a: pt.a.toString(), b: pt.b.toString(), n: miss },
  });
}

function patRule(rng: Rng, pt: Pat): Draft {
  const key = ruleText(pt).asc;
  const t1 = patVal(pt, 1);
  return expression([p('Write a rule for the term value in terms of the position number $$n$$. Type the expression, for example 3n + 2.'), patTable(pt, [1, 2, 3, 4])], key, {
    hints: ['The constant change between terms is the number that multiplies $$n$$.', `Start with $$${lin([[pt.a, 'n']]).tex}$$. What must you add or subtract to get $$${nl(t1)}$$ at position 1?`],
    solution: [steps({ text: `The term value changes by $$${nl(pt.a)}$$ each time.`, math: lin([[pt.a, 'n']]).tex }, { text: `At $$n = 1$$ this gives $$${nl(pt.a)}$$; the term is $$${nl(t1)}$$, so the constant is $$${nl(pt.b)}$$.`, math: ruleText(pt).tex }, { text: `Check at $$n = 3$$: $$${nl(pt.a)}(3) ${pt.b.cmp(0) < 0 ? '-' : '+'} ${nl(pt.b.abs())} = ${nl(patVal(pt, 3))}$$ ✓` })],
    variables: ['n'],
    requireSimplified: true,
    knownWrong: exprWrongs(key, [
      [lin([[1, 'n'], [pt.a, '']]).asc, 'alg_pattern_add_step'],
      [lin([[pt.a, 'n']]).asc, 'alg_pattern_no_constant'],
      [lin([[pt.a, 'n'], [t1, '']]).asc, 'alg_pattern_first_as_constant'],
    ]),
    params: { kind: 'patRule', a: pt.a.toString(), b: pt.b.toString() },
  });
}

function patRuleChoice(rng: Rng, pt: Pat): Draft {
  const t1 = patVal(pt, 1);
  const o = (pp: Pat) => `$$${ruleText(pp).tex}$$`;
  return choice(
    rng,
    [p('Which rule gives the term value for position number $$n$$?'), patTable(pt, [1, 2, 3, 4])],
    o(pt),
    [
      { text: `$$${lin([[1, 'n'], [pt.a, '']]).tex}$$`, misconception: 'alg_pattern_add_step' },
      { text: o({ a: pt.a, b: R(0) }), misconception: 'alg_pattern_no_constant' },
      { text: o({ a: pt.a, b: t1 }), misconception: 'alg_pattern_first_as_constant' },
      { text: o({ a: t1, b: pt.a }), misconception: 'alg_pattern_first_as_constant' },
    ],
    {
      hints: ['Test each rule with $$n = 1$$ and $$n = 2$$.', `The constant change is ${nt(pt.a)}, so the rule multiplies $$n$$ by ${nt(pt.a)}.`],
      solution: [p(`The change is $$${nl(pt.a)}$$ per position and the term at $$n = 1$$ is $$${nl(t1)}$$, so the rule is $$${ruleText(pt).tex}$$. Check $$n = 2$$: $$${nl(patVal(pt, 2))}$$ ✓.`)],
      params: { kind: 'patChoice', a: pt.a.toString(), b: pt.b.toString() },
    },
  );
}

function patPosition(rng: Rng, pt: Pat): Draft {
  const N = rng.int(12, 60);
  const V = patVal(pt, N);
  const rule = ruleText(pt).tex;
  return numeric([p(`A pattern follows the rule $$\\text{value} = ${rule}$$, where $$n$$ is the position number. Which position number has a term value of $$${nl(V)}$$?`)], `${N}`, {
    hints: ['Set the rule equal to the value and solve the equation.', `$$${rule} = ${nl(V)}$$. Undo the ${pt.b.cmp(0) < 0 ? 'subtraction' : 'addition'} first.`],
    solution: [steps({ text: 'Write an equation.', math: `${rule} = ${nl(V)}` }, { text: `${pt.b.cmp(0) < 0 ? 'Add' : 'Subtract'} $$${nl(pt.b.abs())}$$ on both sides.`, math: `${lin([[pt.a, 'n']]).tex} = ${nl(V.sub(pt.b))}` }, { text: `Divide by $$${nl(pt.a)}$$.`, math: `n = ${N}` })],
    knownWrong: wrongs(R(N), [
      [V.div(pt.a), 'alg_pattern_no_constant'],
      [V.add(pt.b).div(pt.a), 'alg_inverse_op'],
    ]),
    params: { kind: 'patPos', a: pt.a.toString(), b: pt.b.toString(), v: V.toString() },
  });
}

function patZero(rng: Rng, pt: Pat, g: number): Draft {
  const back = g >= 8 && rng.chance(0.4) ? -rng.int(1, 5) : 0;
  const ans = patVal(pt, back);
  return numeric([p(`Extend this linear pattern backwards. What is the term value at position ${nt(back)}?`), patTable(pt, [1, 2, 3, 4])], na(ans), {
    hints: ['Going back one position undoes one step of the change.', `Each step back ${pt.a.cmp(0) < 0 ? 'adds' : 'subtracts'} $$${nl(pt.a.abs())}$$. Or use the rule $$${ruleText(pt).tex}$$.`],
    solution: [p(`The rule is $$${ruleText(pt).tex}$$. At $$n = ${back}$$: $$${nl(pt.a)}(${back}) ${pt.b.cmp(0) < 0 ? '-' : '+'} ${nl(pt.b.abs())} = ${nl(ans)}$$.${back === 0 ? ' The value at position 0 is the constant in the rule.' : ''}`)],
    knownWrong: wrongs(ans, [
      [patVal(pt, 1), 'alg_pattern_first_as_constant'],
      [pt.b.add(pt.a.mul(Math.abs(back))), 'alg_pattern_add_step'],
    ]),
    params: { kind: 'patValue', a: pt.a.toString(), b: pt.b.toString(), n: back },
  });
}

/** Iterates a pattern from position 1 (adding the step each time), independent of the closed-form rule. */
function iterate(a: number, b: number, n: number): number {
  let t = a + b;
  if (n >= 1) {
    for (let i = 1; i < n; i++) t += a;
  } else {
    for (let i = 1; i > n; i--) t -= a;
  }
  return t;
}

export const patternRule: SkillPack = {
  id: 'pattern-rule',
  title: 'Pattern rules for linear patterns',
  subject: 'math',
  expectations: [
    { id: `${G6}:C1.3`, note: 'Uses linear growing patterns in tables: near and far predictions, missing terms, writing the rule as an expression and solving for the position of a value. Repeating and shrinking patterns and extending pictures are not covered.', levels: [1, 2, 3] },
    { id: `${G7}:C1.3`, note: 'Uses linear growing patterns with whole numbers and decimal numbers: predictions, missing terms, rules as expressions, solving for unknown positions and extending back to position 0. Repeating patterns are not covered.', levels: [1, 2, 3, 4] },
    { id: `${G8}:C1.3`, note: 'Uses linear growing and shrinking patterns with integers and decimals: predictions, missing terms, rules as expressions, solving for unknowns, and extending to position 0 or negative positions. Graphs of patterns are not assessed.', levels: [2, 3, 4] },
  ],
  prerequisites: ['eval-expr'],
  goal: 'I can find the rule for a linear pattern and use it to predict terms and find unknown values.',
  explain: (c) => [
    p('In a **linear pattern** the term value changes by the **same amount** each time. That constant change, together with a starting amount, gives the **pattern rule**.'),
    patTable({ a: R(3), b: R(2) }, [1, 2, 3, 4]),
    steps(
      { text: 'Find the constant change: 5, 8, 11, 14 go up by 3.', math: '3n' },
      { text: 'Compare $$3n$$ with the actual terms: at $$n = 1$$, $$3n = 3$$ but the term is 5, so add 2.', math: '\\text{value} = 3n + 2' },
      { text: 'Use the rule for far predictions: at position 100.', math: '3(100) + 2 = 302' },
    ),
    ...(c.grade >= 8 ? [p('In a **shrinking** pattern the change is negative: 20, 17, 14, … follows $$-3n + 23$$.')] : []),
    c.simple ? tip('Step size × position, then fix it up with a plus or minus.') : tip('The value at position 0 (one step before position 1) is the constant in the rule.'),
  ],
  alternatives: (c) => ({
    simpler: [p('Pattern 4, 7, 10, 13: it goes up by 3 each time. So it is like the 3 times table (3, 6, 9, 12) plus 1. Rule: $$3n + 1$$.')],
    analogy: [p('A taxi charges a starting fee plus the same price for every kilometre. The price per kilometre is the change; the starting fee is the constant.')],
    visual: [patTable({ a: R(4), b: R(1) }, [0, 1, 2, 3, 4]), p('Going down the table, each value is 4 more: the rule is $$4n + 1$$. Position 0 shows the constant, 1.')],
    steps: [steps({ text: 'Find the difference between consecutive terms.' }, { text: 'Multiply the position number by that difference.' }, { text: 'Work out what to add or subtract to match the first term.' }, { text: 'Test the rule on another term.' })],
    compare: [p(c.grade >= 7 ? 'A linear pattern is like an equation $$y = mx + b$$ you will meet later: the change is the rate, the position-0 value is the starting amount.' : 'You already know the 5 times table: 5, 10, 15, … has rule $$5n$$. The pattern 7, 12, 17, … is the 5 times table plus 2, so its rule is $$5n + 2$$.')],
  }),
  example: (rng, c) => {
    const pt = patMake(rng, c.grade, 2);
    const t1 = patVal(pt, 1);
    return [
      p('Find the rule for this pattern and the term at position 10.'),
      patTable(pt, [1, 2, 3, 4]),
      steps({ text: `The change is $$${nl(pt.a)}$$ each time.`, math: lin([[pt.a, 'n']]).tex }, { text: `At $$n = 1$$: $$${nl(pt.a)}$$; the term is $$${nl(t1)}$$, so the constant is $$${nl(pt.b)}$$.`, math: ruleText(pt).tex }, { text: 'Position 10:', math: `${nl(pt.a)}(10) ${pt.b.cmp(0) < 0 ? '-' : '+'} ${nl(pt.b.abs())} = ${nl(patVal(pt, 10))}` }),
    ];
  },
  generate: (rng, d, c) => {
    const g = c.grade;
    let pt = patMake(rng, g, d);
    if (pt.b.isZero()) pt = { a: pt.a, b: R(1) };
    if (d <= 1) return rng.chance(0.5) ? patFar(rng, pt, 1) : patMissing(rng, pt);
    if (d === 2) return rng.pick([() => patFar(rng, pt, 2), () => patRule(rng, pt), () => patRuleChoice(rng, pt), () => patMissing(rng, pt)])();
    if (d === 3) return rng.pick([() => patRule(rng, pt), () => patPosition(rng, pt), () => patFar(rng, pt, 3)])();
    return rng.pick([() => patZero(rng, pt, g), () => patPosition(rng, pt), () => patRule(rng, pt)])();
  },
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Record<string, unknown>;
    const a = fl(pr.a);
    const b = fl(pr.b);
    const seq = [1, 2, 3, 4, 5].map((n) => iterate(a, b, n));
    try {
      switch (pr.kind) {
        case 'patValue':
          return numIs(q, iterate(a, b, Number(pr.n)), 'pattern term');
        case 'patRule': {
          if (q.type !== 'expression') return 'not an expression';
          const e = parseExpr(q.answer);
          return seq.every((t, i) => close(evaluate(e, { n: R(i + 1) }).toNumber(), t)) && isSimplified(e) ? null : 'rule does not match the iterated pattern';
        }
        case 'patChoice': {
          const ok = (t: string) => {
            const e = parseExpr(strip(t));
            return seq.every((v, i) => close(evaluate(e, { n: R(i + 1) }).toNumber(), v));
          };
          if (!ok(rightText(q))) return 'chosen rule does not fit the table';
          return otherTexts(q).some(ok) ? 'a distractor also fits' : null;
        }
        case 'patPos': {
          const want = fl(pr.v);
          for (let n = 1; n <= 1000; n++) if (close(iterate(a, b, n), want)) return numIs(q, n, 'position');
          return 'value never reached';
        }
      }
    } catch {
      return 'unreadable rule';
    }
    return 'unknown question kind';
  },
  summary: ['In a linear pattern the term value changes by the same amount each step.', 'Rule: (change) × n + (value at position 0), for example $$3n + 2$$.', 'Use the rule for far predictions, and solve an equation to find which position has a given value.'],
  misconceptions: [
    { id: 'alg_pattern_no_constant', label: 'Left out the constant', explanation: 'Multiplying the position by the change gives the right growth, but the pattern also has a starting amount.', fix: 'Check your rule at position 1. If it is off, add or subtract the difference.' },
    { id: 'alg_pattern_add_step', label: 'Used the step as an add-on', explanation: '“Add 3 each time” describes how to get the next term, not the term at position n. The rule multiplies n by 3.', fix: 'The change per step multiplies the position number: $$3n$$, then adjust.' },
    { id: 'alg_pattern_first_as_constant', label: 'Used the first term as the constant', explanation: 'The constant is the value at position 0, one step before the first term, not the first term itself.', fix: 'Go back one step from position 1 to find the constant.' },
    { id: 'alg_pattern_off_by_one', label: 'Off by one position', explanation: 'The answer is the term one position later than the one asked for.', fix: 'Check: put $$n = 1$$ into your rule. It should give the first term.' },
    { id: 'alg_pattern_proportional', label: 'Scaled up a term', explanation: 'Doubling the position does not double the term when the pattern has a constant: position 8 is not twice position 4.', fix: 'Use the rule instead of multiplying a known term.' },
    { id: 'alg_inverse_op', label: 'Used the same operation instead of the inverse', explanation: 'To undo “+ 2” you subtract 2; to undo “× 3” you divide by 3.', fix: 'Undo each operation in reverse order with its opposite.' },
  ],
};

// ═══════════════════════ Pack 6: linear relations ═══════════════════════

type Line = { m: Rational; b: Rational };
const lineTex = (l: Line) =>
  lin([
    [l.m, 'x'],
    [l.b, ''],
  ]);
const yAt = (l: Line, x: number | Rational) => l.m.mul(rat(x)).add(l.b);

function lineMake(rng: Rng, dec: boolean): Line {
  const m = dec && rng.chance(0.4) ? dz(rng.pick([5, 15, 25, -5, -15])) : R(rng.signed(1, 6));
  return { m, b: R(rng.signed(1, 12)) };
}

function relTable(l: Line, x0: number, dx: number): Block {
  return { kind: 'table', header: ['$$x$$', '$$y$$'], rows: [0, 1, 2, 3].map((i) => [nt(x0 + i * dx), nt(yAt(l, x0 + i * dx))]) };
}

function relRate(rng: Rng, l: Line, x0: number, dx: number): Draft {
  const dy = l.m.mul(dx);
  return numeric([p('This table of values represents a linear relation. What is the rate of change (the change in $$y$$ for each increase of 1 in $$x$$)?'), relTable(l, x0, dx)], na(l.m), {
    hints: [`Compare two rows next to each other: how much do $$x$$ and $$y$$ change?`, `$$y$$ changes by $$${nl(dy)}$$ when $$x$$ increases by ${dx}.`],
    solution: [m(`\\text{rate of change} = \\frac{\\text{change in } y}{\\text{change in } x} = \\frac{${nl(dy)}}{${dx}} = ${nl(l.m)}`)],
    knownWrong: wrongs(l.m, [
      [dx !== 1 ? dy : null, 'alg_slope_no_run'],
      [safe(() => R(dx).div(dy)), 'alg_slope_inverted'],
      [l.m.neg(), 'alg_slope_sign'],
    ]),
    params: { kind: 'relRate', rows: [0, 1, 2, 3].map((i) => [x0 + i * dx, yAt(l, x0 + i * dx).toString()]) },
  });
}

function relInitial(rng: Rng, l: Line, x0: number, dx: number): Draft {
  return numeric([p('This table represents a linear relation. What is its initial value (the value of $$y$$ when $$x = 0$$)?'), relTable(l, x0, dx)], na(l.b), {
    hints: [x0 === 0 ? 'Look at the row where $$x = 0$$.' : 'Find the rate of change, then work backwards to $$x = 0$$.', x0 === 0 ? 'The initial value is the starting amount.' : `The rate of change is $$${nl(l.m)}$$. Going back from $$x = ${x0}$$ to $$x = 0$$ is ${x0} step${x0 === 1 ? '' : 's'} back.`],
    solution: [x0 === 0 ? p(`When $$x = 0$$, $$y = ${nl(l.b)}$$. That is the initial value (the y-intercept).`) : m(`y(0) = ${nl(yAt(l, x0))} - ${x0}(${nl(l.m)}) = ${nl(l.b)}`)],
    knownWrong: wrongs(l.b, [
      [yAt(l, x0), 'alg_lin_first_y_as_b'],
      [l.m, 'alg_lin_swap'],
    ]),
    params: { kind: 'relInitial', rows: [0, 1, 2, 3].map((i) => [x0 + i * dx, yAt(l, x0 + i * dx).toString()]) },
  });
}

function relEquation(rng: Rng, l: Line, x0: number, dx: number): Draft {
  const key = lineTex(l).asc;
  const rows = [0, 1, 2, 3].map((i) => [x0 + i * dx, yAt(l, x0 + i * dx).toString()]);
  return expression([p('Write an equation for this linear relation. Type the right side of $$y = \\ldots$$ (for example 2x + 5). Use decimals for any numbers that are not whole.'), relTable(l, x0, dx)], key, {
    hints: ['The rate of change multiplies $$x$$; the initial value (at $$x = 0$$) is the constant.', `Rate of change: $$${nl(l.m)}$$. Now find $$y$$ when $$x = 0$$.`],
    solution: [steps({ text: 'Rate of change (slope).', math: `m = \\frac{${nl(l.m.mul(dx))}}{${dx}} = ${nl(l.m)}` }, { text: 'Initial value (y-intercept).', math: `b = ${nl(yAt(l, x0))} - ${nl(l.m)}(${x0}) = ${nl(l.b)}` }, { text: 'Equation.', math: `y = ${lineTex(l).tex}` })],
    variables: ['x'],
    requireSimplified: true,
    knownWrong: exprWrongs(key, [
      [lin([[l.b, 'x'], [l.m, '']]).asc, 'alg_lin_swap'],
      [lin([[l.m, 'x'], [yAt(l, x0), '']]).asc, 'alg_lin_first_y_as_b'],
      [lin([[l.m.mul(dx), 'x'], [l.b, '']]).asc, 'alg_slope_no_run'],
    ]),
    params: { kind: 'relEq', rows },
  });
}

function relEqChoice(rng: Rng, l: Line, x0: number, dx: number): Draft {
  const rows = [0, 1, 2, 3].map((i) => [x0 + i * dx, yAt(l, x0 + i * dx).toString()]);
  const o = (ll: Line) => `$$y = ${lineTex(ll).tex}$$`;
  return choice(
    rng,
    [p('Which equation represents the relation in the table?'), relTable(l, x0, dx)],
    o(l),
    [
      { text: o({ m: l.b, b: l.m }), misconception: 'alg_lin_swap' },
      { text: o({ m: l.m, b: yAt(l, x0) }), misconception: 'alg_lin_first_y_as_b' },
      { text: o({ m: l.m.neg(), b: l.b }), misconception: 'alg_slope_sign' },
      { text: o({ m: l.m.mul(dx), b: l.b }), misconception: 'alg_slope_no_run' },
    ],
    {
      hints: ['Find the rate of change and the value of $$y$$ at $$x = 0$$.', 'Test each equation with two rows of the table.'],
      solution: [p(`Rate of change $$${nl(l.m)}$$, initial value $$${nl(l.b)}$$: $$y = ${lineTex(l).tex}$$. Check $$x = ${x0 + dx}$$: $$${nl(yAt(l, x0 + dx))}$$ ✓.`)],
      params: { kind: 'relChoice', rows },
    },
  );
}

function relContext(rng: Rng, mode: 'eq' | 'rate' | 'solve'): Draft {
  const ctxs = [
    { what: 'renting a canoe', unit: 'hour', fee: dz(rng.int(2, 8) * 25, 10), rate: dz(rng.int(3, 12) * 5, 10), xName: 'hours', yName: 'cost in dollars' },
    { what: 'a taxi ride', unit: 'kilometre', fee: dz(rng.int(6, 16) * 25, 100), rate: dz(rng.int(6, 12) * 25, 100), xName: 'kilometres', yName: 'cost in dollars' },
    { what: 'a bike-share trip', unit: 'minute', fee: dz(rng.int(2, 6) * 50, 100), rate: dz(rng.int(1, 6) * 5, 100), xName: 'minutes', yName: 'cost in dollars' },
  ];
  const c = rng.pick(ctxs);
  const l: Line = { m: c.rate, b: c.fee };
  const intro = `The cost of ${c.what} is ${money(c.fee)} to start plus ${money(c.rate)} per ${c.unit}.`;
  if (mode === 'rate') {
    const askRate = rng.chance(0.5);
    const ans = askRate ? c.rate : c.fee;
    return numeric([p(`${intro} Let $$x$$ be the number of ${c.xName} and $$y$$ the ${c.yName}. What is the ${askRate ? 'rate of change' : 'initial value'}? Answer in dollars.`)], na(ans), {
      hints: ['The rate of change is the amount added for each unit; the initial value is the amount when $$x = 0$$.', askRate ? `What is added for every ${c.unit}?` : 'What do you pay before going any distance or time?'],
      solution: [p(`The ${askRate ? `rate of change is ${money(c.rate)} per ${c.unit}` : `initial value is ${money(c.fee)}, the cost when $$x = 0$$`}. The equation is $$y = ${lineTex(l).tex}$$.`)],
      knownWrong: wrongs(ans, [[askRate ? c.fee : c.rate, 'alg_lin_swap']]),
      params: { kind: 'relCtx', m: l.m.toString(), b: l.b.toString(), ask: askRate ? 'm' : 'b' },
    });
  }
  if (mode === 'eq') {
    const key = lineTex(l).asc;
    return expression([p(`${intro} Write an equation for the ${c.yName}, $$y$$, after $$x$$ ${c.xName}. Type the right side of $$y = \\ldots$$.`)], key, {
      hints: ['The amount that is added every time multiplies $$x$$.', `The starting amount is the constant: $$y = ${nl(c.rate)}x + \\ldots$$`],
      solution: [p(`Rate of change $$${nl(c.rate)}$$ (per ${c.unit}), initial value $$${nl(c.fee)}$$: $$y = ${lineTex(l).tex}$$.`)],
      variables: ['x'],
      requireSimplified: true,
      knownWrong: exprWrongs(key, [[lin([[c.fee, 'x'], [c.rate, '']]).asc, 'alg_lin_swap']]),
      params: { kind: 'relEq', rows: [0, 1, 2, 3].map((x) => [x, yAt(l, x).toString()]) },
    });
  }
  const n = rng.int(3, 15);
  const total = yAt(l, n);
  return numeric([p(`${intro} The equation is $$y = ${lineTex(l).tex}$$. How many ${c.xName} can you get for exactly ${money(total)}?`)], `${n}`, {
    hints: ['Substitute the total for $$y$$ and solve for $$x$$.', `$$${nl(total)} = ${lineTex(l).tex}$$. Subtract ${nl(c.fee)} first.`],
    solution: [steps({ text: 'Substitute.', math: `${nl(total)} = ${lineTex(l).tex}` }, { text: `Subtract ${nl(c.fee)}.`, math: `${nl(total.sub(c.fee))} = ${nl(c.rate)}x` }, { text: `Divide by ${nl(c.rate)}.`, math: `x = ${n}` })],
    unit: c.xName,
    knownWrong: wrongs(R(n), [
      [safe(() => total.div(c.rate)), 'alg_ignore_constant'],
      [safe(() => total.add(c.fee).div(c.rate)), 'alg_inverse_op'],
    ]),
    params: { kind: 'relSolve', m: l.m.toString(), b: l.b.toString(), y: total.toString() },
  });
}

function relGraph(rng: Rng, ask: 'eq' | 'slope'): Draft {
  const m0 = rng.pick([R(1), R(2), R(3), R(-1), R(-2), R(1, 2), R(-1, 2)]);
  const b = R(rng.signed(1, 5));
  const l: Line = { m: m0, b };
  const run = m0.isInteger() ? rng.int(1, 3) : 2 * rng.int(1, 2);
  const P = { x: 0, y: Number(b.n) };
  const Q = { x: run, y: yAt(l, run).toNumber() };
  const diagram: Block = { kind: 'diagram', diagram: { type: 'coordinate', points: [{ ...P, label: 'A' }, { ...Q, label: 'B' }], line: { m: m0.toNumber(), b: b.toNumber() } }, alt: `A line through A(0, ${nt(b)}) and B(${run}, ${nt(yAt(l, run))}).` };
  const rise = yAt(l, run).sub(b);
  if (ask === 'slope') {
    return numeric([p(`The line passes through $$A(0, ${nl(b)})$$ and $$B(${run}, ${nl(yAt(l, run))})$$. What is its slope? Give a fraction, decimal or integer.`), diagram], na(m0), {
      hints: ['Slope = rise ÷ run, going from A to B.', `Rise: $$${nl(yAt(l, run))} - ${nb(b)} = ${nl(rise)}$$. Run: ${run}.`],
      solution: [m(`m = \\frac{\\text{rise}}{\\text{run}} = \\frac{${nl(yAt(l, run))} - ${nb(b)}}{${run} - 0} = \\frac{${nl(rise)}}{${run}} = ${nl(m0)}`)],
      knownWrong: wrongs(m0, [
        [safe(() => R(run).div(rise)), 'alg_slope_inverted'],
        [m0.neg(), 'alg_slope_sign'],
        [run !== 1 ? rise : null, 'alg_slope_no_run'],
      ]),
      params: { kind: 'relRate', rows: [[0, b.toString()], [run, yAt(l, run).toString()]] },
    });
  }
  const key = lineTex(l).asc;
  return expression([p(`The graph shows a line through $$A(0, ${nl(b)})$$ and $$B(${run}, ${nl(yAt(l, run))})$$. Write its equation: type the right side of $$y = \\ldots$$. Use decimals for any numbers that are not whole.`), diagram], key, {
    hints: ['The y-intercept is where the line crosses the y-axis (point A).', `Slope = rise ÷ run = $$\\frac{${nl(rise)}}{${run}}$$.`],
    solution: [steps({ text: 'Slope.', math: `m = \\frac{${nl(rise)}}{${run}} = ${nl(m0)}` }, { text: 'y-intercept (where the line crosses the y-axis).', math: `b = ${nl(b)}` }, { text: 'Equation.', math: `y = ${lineTex(l).tex}` })],
    variables: ['x'],
    requireSimplified: true,
    knownWrong: exprWrongs(key, [
      [lin([[b, 'x'], [m0, '']]).asc, 'alg_lin_swap'],
      [lin([[R(run).div(rise), 'x'], [b, '']]).asc, 'alg_slope_inverted'],
    ]),
    params: { kind: 'relEq', rows: [[0, b.toString()], [run, yAt(l, run).toString()], [-2, yAt(l, -2).toString()]] },
  });
}

function relTwoPoints(rng: Rng, ask: 'slope' | 'eq'): Draft {
  const l = lineMake(rng, ask === 'eq');
  const x1 = rng.int(-4, 3);
  const x2 = x1 + rng.int(2, 5);
  const y1 = yAt(l, x1);
  const y2 = yAt(l, x2);
  if (ask === 'slope') {
    // Allow a fractional slope by nudging the second point.
    const y2b = rng.chance(0.4) ? y2.add(1) : y2;
    const mm = y2b.sub(y1).div(x2 - x1);
    return numeric([p(`A line passes through $$(${x1}, ${nl(y1)})$$ and $$(${x2}, ${nl(y2b)})$$. What is its slope? Give a fraction, decimal or integer.`)], na(mm), {
      hints: ['Slope = (change in y) ÷ (change in x). Subtract in the same order for both.', `$$\\frac{${nl(y2b)} - ${nb(y1)}}{${x2} - ${nb(x1)}}$$`],
      solution: [m(`m = \\frac{${nl(y2b)} - ${nb(y1)}}{${x2} - ${nb(x1)}} = \\frac{${nl(y2b.sub(y1))}}{${x2 - x1}} = ${nl(mm)}`)],
      knownWrong: wrongs(mm, [
        [safe(() => R(x2 - x1).div(y2b.sub(y1))), 'alg_slope_inverted'],
        [mm.neg(), 'alg_slope_sign'],
      ]),
      params: { kind: 'relRate', rows: [[x1, y1.toString()], [x2, y2b.toString()]] },
    });
  }
  const key = lineTex(l).asc;
  return expression([p(`A line passes through $$(${x1}, ${nl(y1)})$$ and $$(${x2}, ${nl(y2)})$$. Write its equation: type the right side of $$y = \\ldots$$. Use decimals for any numbers that are not whole.`)], key, {
    hints: ['Find the slope first: (change in y) ÷ (change in x).', `Slope $$= ${nl(l.m)}$$. Substitute one point into $$y = ${nl(l.m)}x + b$$ to find $$b$$.`],
    solution: [steps({ text: 'Slope.', math: `m = \\frac{${nl(y2)} - ${nb(y1)}}{${x2} - ${nb(x1)}} = ${nl(l.m)}` }, { text: `Substitute $$(${x1}, ${nl(y1)})$$.`, math: `${nl(y1)} = ${nl(l.m)}(${x1}) + b \\Rightarrow b = ${nl(l.b)}` }, { text: 'Equation.', math: `y = ${lineTex(l).tex}` })],
    variables: ['x'],
    requireSimplified: true,
    knownWrong: exprWrongs(key, [
      [lin([[l.m, 'x'], [y1, '']]).asc, 'alg_lin_first_y_as_b'],
      [lin([[l.b, 'x'], [l.m, '']]).asc, 'alg_lin_swap'],
    ]),
    params: { kind: 'relEq', rows: [[x1, y1.toString()], [x2, y2.toString()]] },
  });
}

export const linearRelations: SkillPack = {
  id: 'linear-relations',
  title: 'Linear relations: rate of change and initial value',
  subject: 'math',
  expectations: [
    { id: `${W}:C3.2`, note: 'Connects tables of values, contexts and equations of linear relations: finds the rate of change and initial value from a table or a context and writes the equation. Concrete materials and drawing graphs are explained but not assessed.', levels: [1, 2, 3] },
    { id: `${W}:C4.4`, note: 'Determines slope and y-intercept from a graph, a table or two points, writes the equation y = mx + b, and uses equations to solve problems. Sketching graphs and concrete representations are not assessed.', levels: [2, 3, 4] },
  ],
  prerequisites: ['pattern-rule', 'solve-linear'],
  goal: 'I can find the rate of change and initial value of a linear relation and write its equation.',
  explain: (c) => [
    p('A **linear relation** changes by the same amount each time $$x$$ goes up by 1. On a graph it is a straight line.'),
    list([
      'The **rate of change** (or **slope**, $$m$$) is $$\\frac{\\text{change in } y}{\\text{change in } x}$$, the “rise over run”.',
      'The **initial value** (or **y-intercept**, $$b$$) is the value of $$y$$ when $$x = 0$$, where the line crosses the y-axis.',
      'Together they give the equation $$y = mx + b$$.',
    ]),
    relTable({ m: R(2), b: R(5) }, 0, 1),
    p('Here $$y$$ goes up by 2 each time, and $$y = 5$$ when $$x = 0$$, so $$y = 2x + 5$$.'),
    warn('If $$x$$ goes up by 2 between rows, divide the change in $$y$$ by 2 to get the rate of change.'),
    c.simple ? tip('Slope = how much it goes up each step. Start = the value at 0.') : tip('In a context, the rate is the amount that repeats (per hour, per km); the initial value is the one-time or starting amount.'),
  ],
  alternatives: () => ({
    simpler: [p('Start amount + the same amount each time. A plan with a $5 start and $2 per hour is $$y = 2x + 5$$.')],
    analogy: [p('Filling a pool that already has 5 cm of water, rising 2 cm per hour: the 5 cm is the initial value and the 2 cm per hour is the rate of change.')],
    visual: [{ kind: 'diagram', diagram: { type: 'coordinate', points: [{ x: 0, y: 1, label: 'y-intercept (0, 1)' }, { x: 2, y: 5, label: '(2, 5)' }], line: { m: 2, b: 1 } }, alt: 'A line crossing the y-axis at 1 and passing through (2, 5); rise 4 over run 2 gives slope 2.' }, p('From (0, 1) to (2, 5): rise 4, run 2, so the slope is 2. The line crosses the y-axis at 1: $$y = 2x + 1$$.')],
    steps: [steps({ text: 'Pick two points or two rows.' }, { text: 'Slope: subtract the y-values, subtract the x-values in the same order, divide.' }, { text: 'Initial value: read y at x = 0, or work backwards with the slope.' }, { text: 'Write $$y = mx + b$$ and check with another point.' })],
    compare: [p('This is a pattern rule like $$3n + 2$$, written with $$x$$ and $$y$$: $$y = 3x + 2$$. The constant change is the slope; position 0 is the y-intercept.')],
  }),
  example: (rng) => {
    const l = lineMake(rng, false);
    return [p('Find the equation of the relation in the table.'), relTable(l, 1, 1), steps({ text: 'Rate of change from one row to the next.', math: `m = ${nl(l.m)}` }, { text: 'Work back from x = 1 to x = 0.', math: `b = ${nl(yAt(l, 1))} - ${nb(l.m)} = ${nl(l.b)}` }, { text: 'Equation.', math: `y = ${lineTex(l).tex}` })];
  },
  generate: (rng, d, c) => {
    const w44 = c.expectationId === `${W}:C4.4`;
    const l = lineMake(rng, true);
    const x0 = d <= 1 ? 0 : rng.pick([0, 1, 2, 3]);
    const dx = d <= 1 ? 1 : rng.pick([1, 1, 2]);
    if (!w44) {
      if (d <= 1) return rng.pick([() => relContext(rng, 'rate'), () => relInitial(rng, l, 0, 1), () => relRate(rng, l, 0, 1)])();
      if (d === 2) return rng.pick([() => relRate(rng, l, x0, dx), () => relEquation(rng, l, 0, dx), () => relContext(rng, 'eq')])();
      return rng.pick([() => relInitial(rng, l, rng.int(1, 3), dx), () => relEquation(rng, l, rng.int(1, 3), dx), () => relEqChoice(rng, l, x0, dx)])();
    }
    if (d <= 2) return rng.pick([() => relGraph(rng, 'slope'), () => relGraph(rng, 'eq'), () => relRate(rng, l, x0, dx)])();
    if (d === 3) return rng.pick([() => relTwoPoints(rng, 'slope'), () => relTwoPoints(rng, 'eq'), () => relEquation(rng, l, x0 || 1, dx)])();
    return rng.pick([() => relContext(rng, 'solve'), () => relTwoPoints(rng, 'eq'), () => relEqChoice(rng, l, rng.int(1, 3), dx)])();
  },
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Record<string, unknown>;
    const rows = ((pr.rows as [number, string][] | undefined) ?? []).map(([x, y]) => [x, fl(y)] as [number, number]);
    const slope = rows.length >= 2 ? (rows[rows.length - 1]![1] - rows[0]![1]) / (rows[rows.length - 1]![0] - rows[0]![0]) : Number.NaN;
    try {
      switch (pr.kind) {
        case 'relRate':
          return numIs(q, slope, 'slope');
        case 'relInitial':
          return numIs(q, rows[0]![1] - slope * rows[0]![0], 'initial value');
        case 'relEq': {
          if (q.type !== 'expression') return 'not an expression';
          const e = parseExpr(q.answer);
          if (!isSimplified(e)) return 'equation key is not simplified';
          return rows.every(([x, y]) => close(evaluate(e, { x: rat(x) }).toNumber(), y)) ? null : 'equation does not fit the points';
        }
        case 'relChoice': {
          const fits = (t: string) => {
            const e = parseExpr(strip(t).replace(/^y =/, ''));
            return rows.every(([x, y]) => close(evaluate(e, { x: rat(x) }).toNumber(), y));
          };
          if (!fits(rightText(q))) return 'chosen equation does not fit the table';
          return otherTexts(q).some(fits) ? 'a distractor also fits' : null;
        }
        case 'relCtx':
          return numIs(q, fl(pr[String(pr.ask)]), 'context value');
        case 'relSolve': {
          const k = keyNum(q);
          return k && close(fl(pr.m) * k.toNumber() + fl(pr.b), fl(pr.y)) ? null : 'solution does not give the total';
        }
      }
    } catch {
      return 'unreadable equation';
    }
    return 'unknown question kind';
  },
  summary: ['Rate of change (slope) = change in y ÷ change in x.', 'Initial value (y-intercept) = the value of y when x = 0.', 'A linear relation can be written y = mx + b and used to predict or solve for unknown values.'],
  misconceptions: [
    { id: 'alg_lin_swap', label: 'Swapped the rate and the initial value', explanation: 'In $$y = mx + b$$ the rate of change multiplies $$x$$ and the initial value is added on its own.', fix: 'Ask which amount happens “per” unit: that is the slope, next to $$x$$.' },
    { id: 'alg_slope_inverted', label: 'Calculated run over rise', explanation: 'Slope is the change in $$y$$ divided by the change in $$x$$, not the other way round.', fix: 'Remember “rise over run”: vertical change on top.' },
    { id: 'alg_slope_no_run', label: 'Forgot to divide by the change in x', explanation: 'When $$x$$ goes up by more than 1 between rows, the change in $$y$$ covers several steps.', fix: 'Always divide the change in $$y$$ by the change in $$x$$.' },
    { id: 'alg_lin_first_y_as_b', label: 'Used the first y-value as the initial value', explanation: 'The initial value is $$y$$ when $$x = 0$$. If the table starts at another $$x$$, work backwards.', fix: 'Check what $$x$$ is in the first row before reading off $$b$$.' },
    { id: 'alg_slope_sign', label: 'Wrong sign on the slope', explanation: 'If $$y$$ decreases as $$x$$ increases, the slope is negative.', fix: 'Subtract in the same order on top and bottom, and check: does the line go up or down to the right?' },
    { id: 'alg_ignore_constant', label: 'Forgot the one-time amount', explanation: 'The starting fee is part of the total and must be subtracted before dividing by the rate.', fix: 'Subtract the initial value first, then divide.' },
    { id: 'alg_inverse_op', label: 'Used the same operation instead of the inverse', explanation: 'To undo adding the fee you subtract it.', fix: 'Undo each operation with its opposite.' },
  ],
};

// ═══════════════════════ Pack 7: reading code ═══════════════════════

const py = (lines: string[]) => lines.join('\n');
/** How Python prints a division result: always with a decimal point. */
const pyFloat = (r: Rational) => {
  const d = r.toDecimal(6) ?? String(r.toNumber());
  return d.includes('.') ? d : `${d}.0`;
};

function codeDraft(code: string, answer: string, o: { hints: string[]; solution: Block[]; wrong?: [string, string][]; multi?: boolean; params: Record<string, unknown> }): Draft {
  const seen = new Set<string>([answer]);
  const knownWrong = (o.wrong ?? []).filter(([v]) => !seen.has(v) && seen.add(v)).map(([value, misconception]) => ({ value, misconception }));
  return {
    type: 'code_trace',
    prompt: [p(o.multi ? 'What does this Python program print? It prints more than one value: type them in order, separated by spaces.' : 'What does this Python program print?'), { kind: 'code', code, language: 'python' }],
    code,
    answer,
    cognitive: 'reasoning',
    hints: o.hints,
    solution: o.solution,
    knownWrong,
    params: o.params,
  } as Draft;
}

function codeArith(rng: Rng): Draft {
  const a = rng.int(2, 12);
  const b = rng.int(2, 9);
  const k = rng.int(2, 9);
  const form = rng.int(0, 2);
  const expr = ['a * b - ' + k, '(a + b) * ' + k, 'a + b * ' + k][form]!;
  const val = [a * b - k, (a + b) * k, a + b * k][form]!;
  const wrong = [a * (b - k), a + b * k, (a + b) * k][form]!;
  const code = py([`a = ${a}`, `b = ${b}`, `c = ${expr}`, 'print(c)']);
  return codeDraft(code, `${val}`, {
    hints: ['Replace each variable with its value.', `Python follows the order of operations: brackets first, then * before + and -. Here $$c = ${expr.replace(/\*/g, '\\times').replace(/a/g, `${a}`).replace(/\bb\b/g, `${b}`)}$$.`],
    solution: [steps({ text: `Line 1 and 2: a is ${a}, b is ${b}.` }, { text: 'Line 3 calculates c with the order of operations.', math: `c = ${expr.replace(/\*/g, '\\times').replace(/a/g, `${a}`).replace(/\bb\b/g, `${b}`)} = ${val}` }, { text: `Line 4 prints ${val}.` })],
    wrong: [[`${wrong}`, 'alg_code_order']],
    params: { kind: 'arith', a, b, k, form },
  });
}

function codeIfElse(rng: Rng): Draft {
  const t = rng.int(5, 20) * 5;
  const s = t + rng.pick([-3, -1, 0, 0, 1, 4]);
  const b1 = rng.int(2, 6) * 5;
  const b2 = rng.int(0, 1) * 5;
  const op = rng.pick(['>=', '>'] as const);
  const yes = op === '>=' ? s >= t : s > t;
  const code = py([`points = ${s}`, `if points ${op} ${t}:`, `    bonus = ${b1}`, 'else:', `    bonus = ${b2}`, 'print(points + bonus)']);
  const ans = s + (yes ? b1 : b2);
  return codeDraft(code, `${ans}`, {
    hints: [`Is ${s} ${op === '>=' ? 'greater than or equal to' : 'greater than'} ${t}?`, `The condition is ${yes ? 'True' : 'False'}, so the ${yes ? 'if' : 'else'} branch runs.`],
    solution: [steps({ text: `points is ${s}.` }, { text: `Check the condition: ${s} ${op} ${t} is ${yes ? 'True' : 'False'}.` }, { text: `So bonus = ${yes ? b1 : b2}.` }, { text: `It prints ${s} + ${yes ? b1 : b2} = ${ans}.` })],
    wrong: [[`${s + (yes ? b2 : b1)}`, 'alg_code_wrong_branch']],
    params: { kind: 'ifelse', s, t, b1, b2, op },
  });
}

function codeForAdd(rng: Rng): Draft {
  const s = rng.int(0, 20);
  const n = rng.int(3, 8);
  const k = rng.int(2, 9);
  const code = py([`total = ${s}`, `for i in range(${n}):`, `    total = total + ${k}`, 'print(total)']);
  const rows: string[][] = [];
  let t = s;
  for (let i = 0; i < n; i++) {
    t += k;
    rows.push([`${i}`, `${t}`]);
  }
  return codeDraft(code, `${t}`, {
    hints: [`range(${n}) gives i = 0, 1, …, ${n - 1}: the loop runs ${n} times.`, `Each time, ${k} is added to total, which starts at ${s}.`],
    solution: [{ kind: 'table', header: ['i', 'total after the line'], rows }, p(`After the loop, total is ${t}, so it prints ${t}.`)],
    wrong: [
      [`${s + (n - 1) * k}`, 'alg_code_loop_count'],
      [`${s + (n + 1) * k}`, 'alg_code_loop_count'],
    ],
    params: { kind: 'forAdd', s, n, k },
  });
}

function codeForIndex(rng: Rng, variant: 'sum' | 'times' | 'odd' | 'square'): Draft {
  const n = rng.int(4, variant === 'square' ? 6 : 9);
  const k = rng.int(2, 5);
  const body = { sum: 'total = total + i', times: `total = total + ${k} * i`, odd: 'total = total + 2 * i - 1', square: 'total = total + i * i' }[variant];
  const f = (i: number) => ({ sum: i, times: k * i, odd: 2 * i - 1, square: i * i })[variant];
  const code = py(['total = 0', `for i in range(1, ${n + 1}):`, `    ${body}`, 'print(total)']);
  let t = 0;
  const rows: string[][] = [];
  for (let i = 1; i <= n; i++) {
    t += f(i);
    rows.push([`${i}`, `${t}`]);
  }
  return codeDraft(code, `${t}`, {
    hints: [`range(1, ${n + 1}) gives i = 1, 2, …, ${n}. It stops before ${n + 1}.`, 'Make a table with columns i and total, and fill it in one row per loop.'],
    solution: [{ kind: 'table', header: ['i', 'total'], rows }, p(`The loop ends after i = ${n}, so it prints ${t}.`)],
    wrong: [
      [`${t + f(n + 1)}`, 'alg_code_range_end'],
      [`${t - f(n)}`, 'alg_code_loop_count'],
    ],
    params: { kind: 'forIndex', variant, n, k },
  });
}

function codeWhile(rng: Rng, printX: boolean): Draft {
  const start = rng.int(0, 10);
  const step = rng.int(3, 9);
  const limit = start + step * rng.int(3, 7) - rng.int(0, step - 1);
  const code = py([`x = ${start}`, 'count = 0', `while x < ${limit}:`, `    x = x + ${step}`, '    count = count + 1', printX ? 'print(x)' : 'print(count)']);
  let x = start;
  let count = 0;
  const rows: string[][] = [];
  while (x < limit) {
    x += step;
    count += 1;
    rows.push([`${count}`, `${x}`, x < limit ? 'yes' : 'no']);
  }
  const ans = printX ? x : count;
  return codeDraft(code, `${ans}`, {
    hints: [`The loop keeps going while x is less than ${limit}. It checks the condition before each pass.`, 'Track x and count in a table until the condition becomes False.'],
    solution: [{ kind: 'table', header: ['count', 'x', `still x < ${limit}?`], rows }, p(`The loop stops when x reaches ${x}. It prints ${ans}.`)],
    wrong: printX
      ? [
          [`${x - step}`, 'alg_code_while_extra'],
          [`${x + step}`, 'alg_code_while_extra'],
        ]
      : [
          [`${count - 1}`, 'alg_code_while_extra'],
          [`${count + 1}`, 'alg_code_while_extra'],
        ],
    params: { kind: 'while', start, step, limit, printX },
  });
}

function codeForPrint(rng: Rng, linear: boolean): Draft {
  const cnt = rng.int(3, 5);
  const a = linear ? rng.signed(1, 5) : rng.int(2, 6);
  const b = linear ? rng.signed(1, 9) : rng.int(1, 9);
  const code = linear ? py([`for x in range(0, ${cnt}):`, `    y = ${a} * x ${b < 0 ? '-' : '+'} ${Math.abs(b)}`, '    print(y)']) : py([`for i in range(1, ${cnt + 1}):`, `    print(${a} * i + ${b})`]);
  const xs = linear ? Array.from({ length: cnt }, (_, i) => i) : Array.from({ length: cnt }, (_, i) => i + 1);
  const vals = xs.map((x) => a * x + b);
  return codeDraft(code, vals.join(' '), {
    hints: [`The loop runs for ${linear ? 'x' : 'i'} = ${xs.join(', ')}. Each pass prints one value.`, `First value: ${a} × ${xs[0]} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${vals[0]}.`],
    solution: [{ kind: 'table', header: [linear ? 'x' : 'i', 'printed'], rows: xs.map((x, i) => [`${x}`, `${vals[i]}`]) }, p(`The output is ${vals.join(', ')}, typed as: ${vals.join(' ')}`)],
    wrong: [
      [`${vals[vals.length - 1]}`, 'alg_code_last_only'],
      [[...vals, a * (xs[xs.length - 1]! + 1) + b].join(' '), 'alg_code_range_end'],
    ],
    multi: true,
    params: { kind: 'forPrint', cnt, a, b, linear },
  });
}

function codeForIf(rng: Rng): Draft {
  const n = rng.int(10, 30);
  const k = rng.int(3, 7);
  const code = py(['count = 0', `for i in range(1, ${n + 1}):`, `    if i % ${k} == 0:`, '        count = count + 1', 'print(count)']);
  let count = 0;
  const hits: number[] = [];
  for (let i = 1; i <= n; i++) {
    if (i % k === 0) {
      count++;
      hits.push(i);
    }
  }
  return codeDraft(code, `${count}`, {
    hints: [`i % ${k} is the remainder when i is divided by ${k}. It is 0 when i is a multiple of ${k}.`, `Count the multiples of ${k} from 1 to ${n}.`],
    solution: [p(`The if runs count = count + 1 only for multiples of ${k}: ${hits.join(', ')}. That is ${count} numbers, so it prints ${count}.`)],
    wrong: [
      [`${n}`, 'alg_code_wrong_branch'],
      [`${Math.floor((n + 1) / k)}`, 'alg_code_range_end'],
    ],
    params: { kind: 'forIf', n, k },
  });
}

function codeFunc(rng: Rng): Draft {
  const r = rng.int(2, 9);
  const f = rng.int(3, 15);
  const x1 = rng.int(1, 6);
  const x2 = rng.int(2, 9);
  const code = py(['def cost(items):', `    return ${r} * items + ${f}`, '', `print(cost(${x1}) + cost(${x2}))`]);
  const c1 = r * x1 + f;
  const c2 = r * x2 + f;
  return codeDraft(code, `${c1 + c2}`, {
    hints: [`cost(${x1}) runs the function with items = ${x1}.`, `cost(${x1}) = ${r} × ${x1} + ${f} = ${c1}. Now find cost(${x2}).`],
    solution: [steps({ text: `cost(${x1}) = ${r} × ${x1} + ${f} = ${c1}` }, { text: `cost(${x2}) = ${r} × ${x2} + ${f} = ${c2}` }, { text: `It prints ${c1} + ${c2} = ${c1 + c2}.` })],
    wrong: [[`${r * (x1 + x2) + f}`, 'alg_code_call_once']],
    params: { kind: 'func', r, f, x1, x2 },
  });
}

function dataList(rng: Rng, len: number, neg: boolean): number[] {
  return Array.from({ length: len }, () => (neg ? rng.int(-15, 20) : rng.int(5, 40)));
}

function codeList(rng: Rng, mode: 'total' | 'avg' | 'max' | 'count' | 'two'): Draft {
  const len = rng.pick([4, 5]);
  const neg = mode === 'max' && rng.chance(0.5);
  const data = dataList(rng, len, neg);
  const name = neg ? 'temps' : rng.pick(['scores', 'steps', 'minutes', 'sales']);
  const head = [`${name} = [${data.join(', ')}]`];
  const total = sum(data);
  if (mode === 'total' || mode === 'avg' || mode === 'two') {
    const big = Math.max(...data);
    const code = py([
      ...head,
      'total = 0',
      ...(mode === 'two' ? [`biggest = ${name}[0]`] : []),
      `for value in ${name}:`,
      '    total = total + value',
      ...(mode === 'two' ? ['    if value > biggest:', '        biggest = value'] : []),
      ...(mode === 'avg' ? [`average = total / len(${name})`, 'print(average)'] : mode === 'two' ? ['print(total)', 'print(biggest)'] : ['print(total)']),
    ]);
    const avg = R(total, len);
    const ans = mode === 'avg' ? pyFloat(avg) : mode === 'two' ? `${total} ${big}` : `${total}`;
    return codeDraft(code, ans, {
      hints: [`The loop visits each value in the list once and adds it to total.`, mode === 'avg' ? `len(${name}) is ${len}, the number of values. In Python, / always gives a decimal answer.` : mode === 'two' ? 'biggest only changes when a value is greater than the biggest so far.' : `Add the ${len} values.`],
      solution: [
        { kind: 'table', header: ['value', 'total', ...(mode === 'two' ? ['biggest'] : [])], rows: data.map((v, i) => [`${v}`, `${sum(data.slice(0, i + 1))}`, ...(mode === 'two' ? [`${Math.max(...data.slice(0, i + 1))}`] : [])]) },
        p(mode === 'avg' ? `total is ${total} and there are ${len} values, so average = ${total} / ${len} = ${pyFloat(avg)}.` : mode === 'two' ? `It prints ${total}, then ${big}: type ${total} ${big}.` : `It prints ${total}.`),
      ],
      wrong: mode === 'avg' ? [[`${total}`, 'alg_code_skip_line']] : mode === 'two' ? [[`${big}`, 'alg_code_last_only']] : [[`${total - data[data.length - 1]!}`, 'alg_code_loop_count']],
      multi: mode === 'two',
      params: { kind: 'list', mode, data },
    });
  }
  if (mode === 'max') {
    const code = py([...head, `biggest = ${name}[0]`, `for value in ${name}:`, '    if value > biggest:', '        biggest = value', 'print(biggest)']);
    let big = data[0]!;
    const rows: string[][] = [];
    for (const v of data) {
      if (v > big) big = v;
      rows.push([`${v}`, `${big}`]);
    }
    return codeDraft(code, `${big}`, {
      hints: ['biggest starts as the first value in the list.', 'It is replaced only when a value is greater than the biggest so far.'],
      solution: [{ kind: 'table', header: ['value', 'biggest'], rows }, p(`It prints ${big}, the greatest value in the list.`)],
      wrong: [
        [`${data[data.length - 1]}`, 'alg_code_last_only'],
        [`${data[0]}`, 'alg_code_wrong_branch'],
      ],
      params: { kind: 'list', mode, data },
    });
  }
  const t = rng.int(12, 30);
  const strictCount = data.filter((v) => v > t).length;
  const code = py([...head, 'count = 0', `for value in ${name}:`, `    if value > ${t}:`, '        count = count + 1', 'print(count)']);
  return codeDraft(code, `${strictCount}`, {
    hints: [`Go through the list and ask for each value: is it greater than ${t}?`, `Values equal to ${t} do not count, because > means strictly greater.`],
    solution: [p(`Values greater than ${t}: ${data.filter((v) => v > t).join(', ') || 'none'}. So it prints ${strictCount}.`)],
    wrong: [
      [`${data.filter((v) => v >= t).length}`, 'alg_code_compare'],
      [`${len - strictCount}`, 'alg_code_wrong_branch'],
    ],
    params: { kind: 'list', mode, data, t },
  });
}

function codeDouble(rng: Rng): Draft {
  const start = rng.int(2, 9) * 5;
  const target = start * rng.int(5, 40);
  const code = py([`value = ${start}`, 'years = 0', `while value < ${target}:`, '    value = value * 2', '    years = years + 1', 'print(years, value)']);
  let v = start;
  let y = 0;
  const rows: string[][] = [];
  while (v < target) {
    v *= 2;
    y++;
    rows.push([`${y}`, `${v}`]);
  }
  return codeDraft(code, `${y} ${v}`, {
    hints: [`value doubles each pass while it is less than ${target}.`, 'print(years, value) prints both numbers on one line with a space between them.'],
    solution: [{ kind: 'table', header: ['years', 'value'], rows }, p(`The loop stops once value is at least ${target}. It prints ${y} ${v}.`)],
    wrong: [
      [`${y - 1} ${v / 2}`, 'alg_code_while_extra'],
      [`${y + 1} ${v * 2}`, 'alg_code_while_extra'],
    ],
    multi: true,
    params: { kind: 'double', start, target },
  });
}

export const codeTrace: SkillPack = {
  id: 'code-trace',
  title: 'Reading code to predict its output',
  subject: 'math',
  expectations: [
    { id: `${G6}:C3.2`, note: 'Reads short Python programs with variables, arithmetic, if/else and loops and predicts their output. Altering code and describing effects on efficiency are not assessed.', levels: [1, 2, 3] },
    { id: `${G7}:C3.2`, note: 'Reads Python programs with loops that run a defined number of times, while loops, conditions and a simple function (subprogram) and predicts their output. Altering code and describing efficiency are not assessed.', levels: [1, 2, 3, 4] },
    { id: `${G8}:C3.2`, note: 'Reads Python programs that analyse a list of data (total, mean, maximum, counting values above a threshold) and predicts their output. Altering code to inform decisions and describing efficiency are not assessed.', levels: [2, 3, 4] },
    { id: `${W}:C2.3`, note: 'Reads code to predict its outcome: loops that build sums and tables of values for linear relations, while loops and conditions. Altering code to adjust constraints, parameters and outcomes is not assessed.', levels: [2, 3, 4] },
  ],
  prerequisites: ['eval-expr'],
  goal: 'I can read a short program, trace what each line does, and predict exactly what it prints.',
  explain: (c) => [
    p('To predict what a program prints, **trace** it: go line by line, keep track of each variable’s value, and write down anything that is printed.'),
    { kind: 'code', language: 'python', code: py(['total = 0', 'for i in range(1, 4):', '    total = total + i', 'print(total)']) },
    { kind: 'table', header: ['i', 'total'], rows: [['1', '1'], ['2', '3'], ['3', '6']] },
    p('The program prints **6**.'),
    list([
      '**range(1, 4)** gives 1, 2, 3: it stops **before** the second number. **range(5)** gives 0, 1, 2, 3, 4 (five values).',
      'A **while** loop checks its condition before every pass and stops as soon as it is False.',
      'An **if** runs its indented lines only when the condition is True; otherwise the **else** lines run.',
      ...(c.grade >= 8 ? ['**len(data)** is how many values are in the list; / always gives a decimal, such as 13.0.'] : []),
      ...(c.grade >= 7 ? ['**i % 3** is the remainder when i is divided by 3.'] : []),
    ]),
    c.simple ? tip('Pretend you are the computer. One line at a time, and write every change down.') : tip('A trace table (one column per variable) keeps loops from getting confusing.'),
  ],
  alternatives: (c) => ({
    simpler: [p('Read one line. Update your notes. Read the next line. When you see print, write that value down.')],
    analogy: [p('A loop is like doing laps: “run 4 laps, adding 2 points each lap” means 4 times through the same instructions. Count the laps carefully.')],
    steps: [steps({ text: 'List the variables and their starting values.' }, { text: 'For a loop, list the values the loop variable takes.' }, { text: 'Go through each pass, updating the table.' }, { text: 'Write down each printed value in order.' })],
    visual: [{ kind: 'table', header: ['Code', 'What it means'], rows: [['for i in range(3):', 'repeat 3 times, i = 0, 1, 2'], ['for i in range(1, 5):', 'i = 1, 2, 3, 4'], ['while x < 10:', 'repeat as long as x is under 10'], ['if x > 5: … else: …', 'choose one branch'], ...(c.grade >= 8 ? [['for value in data:', 'visit each item of the list']] : [])] }],
    compare: [p('A loop that adds 3 each time is a growing pattern: start 2, then 5, 8, 11 is the rule $$3n + 2$$. Code and patterns describe the same idea.')],
  }),
  example: (rng) => {
    const k = rng.int(2, 6);
    const n = rng.int(3, 5);
    const rows = Array.from({ length: n }, (_, i) => [`${i}`, `${(i + 1) * k}`]);
    return [p('What does this program print?'), { kind: 'code', language: 'python', code: py(['total = 0', `for i in range(${n}):`, `    total = total + ${k}`, 'print(total)']) }, { kind: 'table', header: ['i', 'total'], rows }, p(`The loop runs ${n} times, adding ${k} each time. It prints ${n * k}.`)];
  },
  generate: (rng, d, c) => {
    const g = c.grade;
    if (c.expectationId === `${W}:C2.3`) {
      if (d <= 2) return rng.pick([() => codeForIndex(rng, 'odd'), () => codeForIndex(rng, 'square'), () => codeWhile(rng, rng.chance(0.5))])();
      if (d === 3) return rng.pick([() => codeForPrint(rng, true), () => codeForIf(rng), () => codeForIndex(rng, 'times')])();
      return rng.pick([() => codeDouble(rng), () => codeForPrint(rng, true), () => codeWhile(rng, true)])();
    }
    if (g >= 8) {
      if (d <= 2) return rng.pick([() => codeList(rng, 'total'), () => codeList(rng, 'max')])();
      if (d === 3) return rng.pick([() => codeList(rng, 'avg'), () => codeList(rng, 'count'), () => codeList(rng, 'max')])();
      return rng.pick([() => codeList(rng, 'two'), () => codeList(rng, 'avg'), () => codeList(rng, 'count')])();
    }
    if (d <= 1) return rng.chance(0.5) ? codeArith(rng) : codeIfElse(rng);
    if (d === 2) return rng.pick([() => codeForAdd(rng), () => codeIfElse(rng), () => codeForIndex(rng, 'sum')])();
    if (d === 3) return g === 6 ? rng.pick([() => codeForPrint(rng, false), () => codeForIndex(rng, 'times'), () => codeWhile(rng, false)])() : rng.pick([() => codeWhile(rng, rng.chance(0.5)), () => codeForIf(rng), () => codeForPrint(rng, false)])();
    return rng.chance(0.6) ? codeFunc(rng) : codeForIf(rng);
  },
  selfCheck: (q) => {
    if (q.type !== 'code_trace') return 'not a code question';
    const pr = (q.params ?? {}) as Record<string, unknown>;
    const n = (k: string) => Number(pr[k]);
    const got = q.answer.trim();
    const is = (want: string) => (got === want ? null : `expected ${want}, key is ${got}`);
    const tri = (x: number) => (x * (x + 1)) / 2;
    switch (pr.kind) {
      case 'arith': {
        const [a, b, k] = [n('a'), n('b'), n('k')];
        return is(String([a * b - k, a * k + b * k, b * k + a][n('form')]));
      }
      case 'ifelse': {
        const yes = pr.op === '>=' ? !(n('s') < n('t')) : n('s') - n('t') > 0;
        return is(String(n('s') + (yes ? n('b1') : n('b2'))));
      }
      case 'forAdd':
        return is(String(n('s') + n('n') * n('k')));
      case 'forIndex': {
        const N = n('n');
        const closed = { sum: tri(N), times: n('k') * tri(N), odd: N * N, square: (N * (N + 1) * (2 * N + 1)) / 6 }[String(pr.variant) as 'sum'];
        return is(String(closed));
      }
      case 'while': {
        const passes = Math.max(0, Math.ceil((n('limit') - n('start')) / n('step')));
        return is(String(pr.printX ? n('start') + passes * n('step') : passes));
      }
      case 'forPrint': {
        const first = pr.linear ? 0 : 1;
        return is(Array.from({ length: n('cnt') }, (_, i) => n('a') * (first + i) + n('b')).join(' '));
      }
      case 'forIf':
        return is(String(Math.floor(n('n') / n('k'))));
      case 'func':
        return is(String(n('r') * (n('x1') + n('x2')) + 2 * n('f')));
      case 'list': {
        const data = pr.data as number[];
        const total = data.reduce((s, x) => s + x, 0);
        switch (pr.mode) {
          case 'total':
            return is(String(total));
          case 'avg':
            return close(Number(got), total / data.length) && got.includes('.') ? null : 'average does not match';
          case 'max':
            return is(String(Math.max(...data)));
          case 'two':
            return is(`${total} ${Math.max(...data)}`);
          default:
            return is(String(data.filter((x) => x > n('t')).length));
        }
      }
      case 'double': {
        const years = Math.ceil(Math.log2(n('target') / n('start')) - 1e-12);
        return is(`${years} ${n('start') * 2 ** years}`);
      }
    }
    return 'unknown question kind';
  },
  summary: ['Trace code line by line, keeping a table of each variable’s value.', 'range(a, b) starts at a and stops before b; a while loop stops as soon as its condition is False.', 'An if runs its block only when the condition is True; print shows values in the order they happen.'],
  misconceptions: [
    { id: 'alg_code_order', label: 'Ignored the order of operations', explanation: 'Python multiplies before it adds, just like in math, unless brackets say otherwise.', fix: 'Do brackets, then * and /, then + and -.' },
    { id: 'alg_code_wrong_branch', label: 'Followed the wrong branch', explanation: 'Only one branch of an if/else runs, depending on whether the condition is True.', fix: 'Work out the condition with the actual numbers, including the equal case for >= and <=.' },
    { id: 'alg_code_loop_count', label: 'Counted the loop passes wrong', explanation: 'range(5) runs 5 times (0 to 4). Running one pass too few or too many changes the result.', fix: 'Write out the values the loop variable takes before tracing.' },
    { id: 'alg_code_range_end', label: 'Included the end of the range', explanation: 'range(1, 6) gives 1, 2, 3, 4, 5. The second number is where it stops, and it is not included.', fix: 'Stop one before the second number in range.' },
    { id: 'alg_code_while_extra', label: 'One pass too many or too few in a while loop', explanation: 'A while loop checks its condition before each pass; it stops the moment the condition is False.', fix: 'After each pass, check the condition again with the new values.' },
    { id: 'alg_code_last_only', label: 'Wrote only the last printed value', explanation: 'A print inside a loop runs every pass, so the program prints several values.', fix: 'Write down every printed value, in order.' },
    { id: 'alg_code_call_once', label: 'Applied the function once to the combined input', explanation: 'Each call runs the whole function, including the fixed amount, so two calls add it twice.', fix: 'Work out each call separately, then combine the results.' },
    { id: 'alg_code_skip_line', label: 'Skipped a line', explanation: 'Every line runs in order; the division line changes what is printed.', fix: 'Point at each line as you trace it.' },
    { id: 'alg_code_compare', label: 'Mixed up > and >=', explanation: '> means strictly greater, so a value equal to the limit does not count.', fix: 'Check the equal case separately.' },
  ],
};

export const MATH_PACKS_ALGEBRA: SkillPack[] = [evaluateExpressions, likeTerms, solveLinear, inequalities, patternRule, linearRelations, codeTrace];
