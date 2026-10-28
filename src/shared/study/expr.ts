import { Rational } from './rational';

/**
 * A small algebra parser for checking students' answers: numbers, single-letter variables, + − × ÷, powers,
 * brackets and implicit multiplication (2x, 3(x + 1), x(x − 2)). Polynomials are expanded exactly, so
 * "2(x + 3)" and "2x + 6" are recognised as the same; whether an answer is simplified is checked separately.
 */

export type Expr =
  | { k: 'num'; v: Rational }
  | { k: 'var'; name: string }
  | { k: 'neg'; a: Expr }
  | { k: 'add' | 'sub' | 'mul' | 'div'; a: Expr; b: Expr; implicit?: boolean }
  | { k: 'pow'; a: Expr; b: Expr }
  | { k: 'paren'; a: Expr };

type Tok = { t: 'num'; v: string } | { t: 'var'; v: string } | { t: 'op'; v: string } | { t: '('; v: '(' } | { t: ')'; v: ')' };

export class ParseError extends Error {}

function tokenize(input: string): Tok[] {
  const s = input
    .replace(/[−–—]/g, '-')
    .replace(/[×·∙⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\*\*/g, '^')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[[{]/g, '(')
    .replace(/[\]}]/g, ')');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j]!)) j++;
      const v = s.slice(i, j);
      if ((v.match(/\./g) ?? []).length > 1 || v === '.') throw new ParseError(`“${v}” is not a number`);
      out.push({ t: 'num', v });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      out.push({ t: 'var', v: c });
      i++;
      continue;
    }
    if ('+-*/^'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      out.push({ t: c, v: c } as Tok);
      i++;
      continue;
    }
    throw new ParseError(`Unexpected “${c}”`);
  }
  return out;
}

export function parseExpr(input: string): Expr {
  if (input.length > 300) throw new ParseError('That answer is too long');
  const toks = tokenize(input);
  let p = 0;
  const peek = () => toks[p];
  const startsFactor = (t: Tok | undefined) => !!t && (t.t === 'num' || t.t === 'var' || t.t === '(');

  function primary(): Expr {
    const t = toks[p];
    if (!t) throw new ParseError('The answer ends too early');
    if (t.t === 'num') {
      p++;
      const v = Rational.parseDecimal(t.v);
      if (!v) throw new ParseError(`“${t.v}” is not a number`);
      return { k: 'num', v };
    }
    if (t.t === 'var') {
      p++;
      return { k: 'var', name: t.v };
    }
    if (t.t === '(') {
      p++;
      const e = sum();
      if (peek()?.t !== ')') throw new ParseError('A bracket is not closed');
      p++;
      return { k: 'paren', a: e };
    }
    throw new ParseError(`Unexpected “${t.v}”`);
  }
  function power(): Expr {
    const base = primary();
    if (peek()?.t === 'op' && peek()!.v === '^') {
      p++;
      // Right-associative; allow a sign on the exponent: x^-2.
      if (peek()?.t === 'op' && (peek()!.v === '-' || peek()!.v === '+')) {
        const neg = peek()!.v === '-';
        p++;
        const e = power();
        return { k: 'pow', a: base, b: neg ? { k: 'neg', a: e } : e };
      }
      return { k: 'pow', a: base, b: power() };
    }
    return base;
  }
  function unary(): Expr {
    const t = peek();
    if (t?.t === 'op' && (t.v === '-' || t.v === '+')) {
      p++;
      const a = unary();
      return t.v === '-' ? { k: 'neg', a } : a;
    }
    return power();
  }
  function product(): Expr {
    let left = unary();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && (t.v === '*' || t.v === '/')) {
        p++;
        left = { k: t.v === '*' ? 'mul' : 'div', a: left, b: unary() };
      } else if (startsFactor(t)) {
        // Implicit multiplication: 2x, 3(x+1), (x+1)(x-1), xy.
        left = { k: 'mul', a: left, b: power(), implicit: true };
      } else return left;
    }
  }
  function sum(): Expr {
    let left = product();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && (t.v === '+' || t.v === '-')) {
        p++;
        left = { k: t.v === '+' ? 'add' : 'sub', a: left, b: product() };
      } else return left;
    }
  }
  if (!toks.length) throw new ParseError('Type an answer first');
  const e = sum();
  if (p < toks.length) throw new ParseError(`Unexpected “${toks[p]!.v}”`);
  return e;
}

export function evaluate(e: Expr, vars: Record<string, Rational>): Rational {
  switch (e.k) {
    case 'num':
      return e.v;
    case 'var': {
      const v = vars[e.name];
      if (!v) throw new ParseError(`Unknown letter “${e.name}”`);
      return v;
    }
    case 'neg':
      return evaluate(e.a, vars).neg();
    case 'paren':
      return evaluate(e.a, vars);
    case 'add':
      return evaluate(e.a, vars).add(evaluate(e.b, vars));
    case 'sub':
      return evaluate(e.a, vars).sub(evaluate(e.b, vars));
    case 'mul':
      return evaluate(e.a, vars).mul(evaluate(e.b, vars));
    case 'div':
      return evaluate(e.a, vars).div(evaluate(e.b, vars));
    case 'pow': {
      const ex = evaluate(e.b, vars);
      if (!ex.isInteger() || ex.abs().cmp(64) > 0) throw new ParseError('Only whole-number powers up to 64 can be checked');
      return evaluate(e.a, vars).pow(Number(ex.n));
    }
  }
}

/** A polynomial: monomial key ("" for constants, "x^2", "x*y") → coefficient. */
export type Poly = Map<string, Rational>;

function monoKey(m: Map<string, number>): string {
  return [...m.entries()]
    .filter(([, p]) => p !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([v, p]) => (p === 1 ? v : `${v}^${p}`))
    .join('*');
}
function keyToMono(key: string): Map<string, number> {
  const m = new Map<string, number>();
  if (!key) return m;
  for (const part of key.split('*')) {
    const [v, p] = part.split('^');
    m.set(v!, p ? Number(p) : 1);
  }
  return m;
}
function addTo(p: Poly, key: string, c: Rational): void {
  const cur = p.get(key);
  const next = cur ? cur.add(c) : c;
  if (next.isZero()) p.delete(key);
  else p.set(key, next);
}
function polyMul(a: Poly, b: Poly): Poly {
  const out: Poly = new Map();
  for (const [ka, ca] of a) {
    for (const [kb, cb] of b) {
      const m = keyToMono(ka);
      for (const [v, pw] of keyToMono(kb)) m.set(v, (m.get(v) ?? 0) + pw);
      addTo(out, monoKey(m), ca.mul(cb));
    }
  }
  return out;
}

/** Expands to a polynomial (allowing negative powers of single variables), or null if it is not one. */
export function toPoly(e: Expr): Poly | null {
  switch (e.k) {
    case 'num':
      return e.v.isZero() ? new Map() : new Map([['', e.v]]);
    case 'var':
      return new Map([[e.name, new Rational(1n)]]);
    case 'paren':
      return toPoly(e.a);
    case 'neg': {
      const a = toPoly(e.a);
      return a ? new Map([...a].map(([k, c]) => [k, c.neg()])) : null;
    }
    case 'add':
    case 'sub': {
      const a = toPoly(e.a);
      const b = toPoly(e.b);
      if (!a || !b) return null;
      const out: Poly = new Map(a);
      for (const [k, c] of b) addTo(out, k, e.k === 'add' ? c : c.neg());
      return out;
    }
    case 'mul': {
      const a = toPoly(e.a);
      const b = toPoly(e.b);
      return a && b ? polyMul(a, b) : null;
    }
    case 'div': {
      const a = toPoly(e.a);
      const b = toPoly(e.b);
      if (!a || !b || b.size !== 1) return null;
      const [bk, bc] = [...b][0]!;
      const inv = keyToMono(bk!);
      for (const [v, pw] of inv) inv.set(v, -pw);
      return polyMul(a, new Map([[monoKey(inv), new Rational(1n).div(bc!)]]));
    }
    case 'pow': {
      const base = toPoly(e.a);
      let ex: Rational;
      try {
        ex = evaluate(e.b, {});
      } catch {
        return null;
      }
      if (!base || !ex.isInteger() || ex.abs().cmp(12) > 0) return null;
      const n = Number(ex.n);
      if (n < 0) {
        if (base.size !== 1) return null;
        const [k, c] = [...base][0]!;
        const m = keyToMono(k!);
        for (const [v, pw] of m) m.set(v, pw * n);
        return new Map([[monoKey(m), c!.pow(n)]]);
      }
      let out: Poly = new Map([['', new Rational(1n)]]);
      for (let i = 0; i < n; i++) out = polyMul(out, base);
      return out;
    }
  }
}

export function polyEqual(a: Poly, b: Poly): boolean {
  if (a.size !== b.size) return false;
  for (const [k, c] of a) {
    const o = b.get(k);
    if (!o || !o.eq(c)) return false;
  }
  return true;
}

export function variablesOf(e: Expr, out = new Set<string>()): Set<string> {
  if (e.k === 'var') out.add(e.name);
  else if (e.k === 'num') return out;
  else if (e.k === 'neg' || e.k === 'paren') variablesOf(e.a, out);
  else {
    variablesOf(e.a, out);
    variablesOf(e.b, out);
  }
  return out;
}

/** Deterministic pseudo-random rationals for evaluating non-polynomial expressions. */
const SAMPLE_POINTS = [new Rational(3n, 7n), new Rational(-5n, 3n), new Rational(11n, 2n), new Rational(13n, 5n), new Rational(-2n, 9n), new Rational(17n, 4n)];

/** Are two expressions equal for every value of their letters? */
export function equivalent(a: Expr, b: Expr): boolean {
  const pa = toPoly(a);
  const pb = toPoly(b);
  if (pa && pb) return polyEqual(pa, pb);
  const vars = [...new Set([...variablesOf(a), ...variablesOf(b)])].sort();
  for (let i = 0; i < SAMPLE_POINTS.length; i++) {
    const env: Record<string, Rational> = {};
    vars.forEach((v, j) => (env[v] = SAMPLE_POINTS[(i + j * 2) % SAMPLE_POINTS.length]!.add(j)));
    try {
      if (!evaluate(a, env).eq(evaluate(b, env))) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Number of terms written at the top level: "3x + 2x - 1" → 3. */
export function writtenTerms(e: Expr): number {
  if (e.k === 'add' || e.k === 'sub') return writtenTerms(e.a) + writtenTerms(e.b);
  return 1;
}

function hasParens(e: Expr): boolean {
  if (e.k === 'paren') return true;
  if (e.k === 'num' || e.k === 'var') return false;
  if (e.k === 'neg') return hasParens(e.a);
  return hasParens(e.a) || hasParens(e.b);
}
function termsOf(e: Expr): Expr[] {
  return e.k === 'add' || e.k === 'sub' ? [...termsOf(e.a), ...termsOf(e.b)] : [e];
}

/** True when a single term still has work left in it: 2·3x, x·x, (x^2)^3. */
function termNeedsWork(t: Expr): boolean {
  let numbers = 0;
  const letters = new Map<string, number>();
  let nestedPower = false;
  const walk = (x: Expr, inExponent: boolean, inPowerBase: boolean) => {
    if (x.k === 'num') {
      if (!inExponent) numbers++;
    } else if (x.k === 'var') {
      if (!inExponent) letters.set(x.name, (letters.get(x.name) ?? 0) + 1);
    } else if (x.k === 'pow') {
      if (inPowerBase && !inExponent) nestedPower = true;
      walk(x.a, inExponent, true);
      walk(x.b, true, false);
    } else if (x.k === 'neg' || x.k === 'paren') walk(x.a, inExponent, inPowerBase && x.k === 'paren');
    else {
      walk(x.a, inExponent, false);
      walk(x.b, inExponent, false);
    }
  };
  walk(t, false, false);
  return numbers > 1 || nestedPower || [...letters.values()].some((n) => n > 1);
}

/**
 * Whether an expression is written in simplest collected form: no brackets, no like terms left to combine,
 * and no term that still needs multiplying out (2·3x, x·x, (x^2)^3).
 */
export function isSimplified(e: Expr): boolean {
  const p = toPoly(e);
  if (!p) return false;
  if (hasParens(e)) return false;
  if (writtenTerms(e) > Math.max(1, p.size)) return false;
  return !termsOf(e).some(termNeedsWork);
}

/** Pretty LaTeX for a polynomial in one variable, highest power first: 3x^2 - x + 4. */
export function polyToLatex(p: Poly): string {
  const terms = [...p.entries()].sort(([a], [b]) => degree(b) - degree(a) || a.localeCompare(b));
  if (!terms.length) return '0';
  return terms
    .map(([k, c], i) => {
      const neg = c.cmp(0) < 0;
      const abs = c.abs();
      const coef = k && abs.eq(1) ? '' : abs.toLatex();
      const body = k.replace(/\^(-?\d+)/g, '^{$1}').replace(/\*/g, '');
      const t = `${coef}${body}`;
      return i === 0 ? `${neg ? '-' : ''}${t}` : ` ${neg ? '-' : '+'} ${t}`;
    })
    .join('');
}
function degree(k: string): number {
  if (!k) return 0;
  return [...keyToMono(k).values()].reduce((a, b) => a + b, 0);
}
