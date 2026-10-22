/**
 * A small, safe arithmetic evaluator (no eval). Supports + - * / % ^,
 * parentheses, unary minus, scientific notation, constants (pi, e) and
 * common functions.
 */
const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) throw new Error(`Unexpected "${c}"`);
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if (/[a-z]/i.test(c)) {
      const m = /^[a-z]+/i.exec(src.slice(i))!;
      out.push({ t: 'id', v: m[0].toLowerCase() });
      i += m[0].length;
    } else if ('+-*/%^()×÷,'.includes(c)) {
      out.push({ t: 'op', v: c === '×' ? '*' : c === '÷' ? '/' : c });
      i++;
    } else {
      throw new Error(`Unexpected "${c}"`);
    }
  }
  return out;
}

export function evaluate(expr: string): number {
  if (expr.length > 500) throw new Error('Expression is too long');
  const toks = tokenize(expr);
  let pos = 0;
  const peek = () => toks[pos];
  const take = () => toks[pos++];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;

  function primary(): number {
    const tok = take();
    if (!tok) throw new Error('Incomplete expression');
    if (tok.t === 'num') return tok.v;
    if (tok.t === 'op' && tok.v === '(') {
      const v = additive();
      if (!isOp(')')) throw new Error('Missing ")"');
      take();
      return v;
    }
    if (tok.t === 'op' && tok.v === '-') return -unary();
    if (tok.t === 'op' && tok.v === '+') return unary();
    if (tok.t === 'id') {
      if (tok.v in CONSTS) return CONSTS[tok.v]!;
      const fn = FUNCS[tok.v];
      if (!fn) throw new Error(`Unknown name "${tok.v}"`);
      if (!isOp('(')) throw new Error(`${tok.v} needs parentheses, e.g. ${tok.v}(2)`);
      take();
      const arg = additive();
      if (!isOp(')')) throw new Error('Missing ")"');
      take();
      return fn(arg);
    }
    throw new Error(`Unexpected "${tok.v}"`);
  }
  function power(): number {
    const base = primary();
    if (isOp('^')) {
      take();
      return base ** unary(); // right-associative
    }
    return base;
  }
  function unary(): number {
    if (isOp('-')) {
      take();
      return -unary();
    }
    if (isOp('+')) {
      take();
      return unary();
    }
    return power();
  }
  function multiplicative(): number {
    let v = unary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = take()!.v;
      const r = unary();
      if (op === '*') v *= r;
      else if (op === '/') {
        if (r === 0) throw new Error('Division by zero');
        v /= r;
      } else v %= r;
    }
    return v;
  }
  function additive(): number {
    let v = multiplicative();
    while (isOp('+') || isOp('-')) {
      const op = take()!.v;
      const r = multiplicative();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const result = additive();
  if (pos < toks.length) throw new Error(`Unexpected "${(toks[pos] as Tok).v}"`);
  if (!Number.isFinite(result)) throw new Error('Result is not a finite number');
  return result;
}

export function formatNumber(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toString();
  const s = Number(n.toPrecision(12)).toString();
  return s;
}
