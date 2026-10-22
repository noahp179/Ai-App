/**
 * Exact rational arithmetic (BigInt numerator/denominator), so answer checking never suffers from
 * floating-point error: 0.1 + 0.2 is exactly 3/10 here.
 */

const babs = (a: bigint) => (a < 0n ? -a : a);
function gcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export class Rational {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint | number, d: bigint | number = 1n) {
    let nn = typeof n === 'number' ? BigInt(n) : n;
    let dd = typeof d === 'number' ? BigInt(d) : d;
    if (dd === 0n) throw new RangeError('Division by zero');
    if (dd < 0n) {
      nn = -nn;
      dd = -dd;
    }
    const g = gcd(nn, dd) || 1n;
    this.n = nn / g;
    this.d = dd / g;
  }

  static of(v: number | bigint | Rational): Rational {
    if (v instanceof Rational) return v;
    if (typeof v === 'bigint') return new Rational(v);
    if (!Number.isFinite(v)) throw new RangeError('Not a finite number');
    if (Number.isInteger(v)) return new Rational(BigInt(v));
    // Exact for the decimals we generate (they are written with few digits).
    const s = v.toString();
    const parsed = Rational.parseDecimal(s);
    if (!parsed) throw new RangeError(`Cannot represent ${s} exactly`);
    return parsed;
  }

  /** "12", "-3.75", ".5", "1e3", "2.5e-2" → exact rational. */
  static parseDecimal(s: string): Rational | null {
    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s.trim());
    if (!m || (!m[2] && !m[3])) return null;
    const sign = m[1] === '-' ? -1n : 1n;
    const intPart = m[2] || '0';
    const frac = m[3] ?? '';
    let n = BigInt(intPart + frac) * sign;
    let d = 10n ** BigInt(frac.length);
    const e = m[4] ? Number(m[4]) : 0;
    if (Math.abs(e) > 400) return null;
    if (e > 0) n *= 10n ** BigInt(e);
    else if (e < 0) d *= 10n ** BigInt(-e);
    return new Rational(n, d);
  }

  add(o: Rational | number): Rational {
    const b = Rational.of(o);
    return new Rational(this.n * b.d + b.n * this.d, this.d * b.d);
  }
  sub(o: Rational | number): Rational {
    const b = Rational.of(o);
    return new Rational(this.n * b.d - b.n * this.d, this.d * b.d);
  }
  mul(o: Rational | number): Rational {
    const b = Rational.of(o);
    return new Rational(this.n * b.n, this.d * b.d);
  }
  div(o: Rational | number): Rational {
    const b = Rational.of(o);
    if (b.n === 0n) throw new RangeError('Division by zero');
    return new Rational(this.n * b.d, this.d * b.n);
  }
  neg(): Rational {
    return new Rational(-this.n, this.d);
  }
  abs(): Rational {
    return new Rational(babs(this.n), this.d);
  }
  /** Integer powers only. */
  pow(e: number): Rational {
    if (!Number.isInteger(e)) throw new RangeError('Only integer exponents are exact');
    if (e === 0) return new Rational(1n);
    if (e < 0) return new Rational(this.d, this.n).pow(-e);
    return new Rational(this.n ** BigInt(e), this.d ** BigInt(e));
  }
  cmp(o: Rational | number): number {
    const b = Rational.of(o);
    const l = this.n * b.d;
    const r = b.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  eq(o: Rational | number): boolean {
    return this.cmp(o) === 0;
  }
  isZero(): boolean {
    return this.n === 0n;
  }
  isInteger(): boolean {
    return this.d === 1n;
  }
  toNumber(): number {
    return Number(this.n) / Number(this.d);
  }
  /** "3/4", "-7", "-1/2". */
  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
  /** Terminating decimal string, or null if it repeats. */
  toDecimal(maxDigits = 12): string | null {
    let d = this.d;
    let twos = 0;
    let fives = 0;
    while (d % 2n === 0n) {
      d /= 2n;
      twos++;
    }
    while (d % 5n === 0n) {
      d /= 5n;
      fives++;
    }
    if (d !== 1n) return null;
    const digits = Math.max(twos, fives);
    if (digits > maxDigits) return null;
    const scaled = (babs(this.n) * 10n ** BigInt(digits)) / this.d;
    let s = scaled.toString().padStart(digits + 1, '0');
    if (digits) s = `${s.slice(0, -digits)}.${s.slice(-digits)}`;
    return (this.n < 0n ? '-' : '') + s;
  }
  /** Mixed number parts for positive or negative values: 7/2 → {whole: 3, num: 1, den: 2}. */
  mixed(): { sign: 1 | -1; whole: bigint; num: bigint; den: bigint } {
    const sign = this.n < 0n ? -1 : 1;
    const a = babs(this.n);
    return { sign, whole: a / this.d, num: a % this.d, den: this.d };
  }
  /** LaTeX for display: \frac{3}{4}, -\frac{1}{2}, 5. */
  toLatex(opts: { mixed?: boolean } = {}): string {
    if (this.d === 1n) return this.n.toString();
    const m = this.mixed();
    const sign = m.sign < 0 ? '-' : '';
    if (opts.mixed && m.whole > 0n) return `${sign}${m.whole}\\tfrac{${m.num}}{${m.den}}`;
    return `${sign}\\frac{${babs(this.n)}}{${this.d}}`;
  }
}

export const R = (n: number | bigint, d: number | bigint = 1) => new Rational(typeof n === 'number' ? BigInt(n) : n, typeof d === 'number' ? BigInt(d) : d);

export function gcdNum(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export const lcmNum = (a: number, b: number) => Math.abs(a * b) / gcdNum(a, b);

/**
 * Reads a number the way a student might type it: "3/4", "-1 1/2", "0.75", "75%", "2,500", "−3", "3 ⁄ 4".
 * Returns null when it is not a single number.
 */
export function parseStudentNumber(raw: string): { value: Rational; form: 'integer' | 'fraction' | 'mixed' | 'decimal' | 'percent' } | null {
  let s = raw
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/[⁄∕÷]/g, '/')
    .replace(/\s+/g, ' ');
  if (!s) return null;
  // Thousands separators: "2,500" or "2 500" (but not "1 1/2").
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?%?$/.test(s)) s = s.replace(/,/g, '');
  if (/^-?\d{1,3}( \d{3})+(\.\d+)?$/.test(s)) s = s.replace(/ /g, '');
  let m = /^([+-]?\d+(?:\.\d+)?|[+-]?\.\d+)\s*%$/.exec(s);
  if (m) {
    const v = Rational.parseDecimal(m[1]!);
    return v ? { value: v.div(100), form: 'percent' } : null;
  }
  m = /^([+-]?)(\d+) (\d+) ?\/ ?(\d+)$/.exec(s);
  if (m) {
    const den = BigInt(m[4]!);
    if (den === 0n) return null;
    const v = new Rational(BigInt(m[2]!) * den + BigInt(m[3]!), den);
    return { value: m[1] === '-' ? v.neg() : v, form: 'mixed' };
  }
  m = /^([+-]?\d+) ?\/ ?([+-]?\d+)$/.exec(s);
  if (m) {
    const den = BigInt(m[2]!);
    if (den === 0n) return null;
    return { value: new Rational(BigInt(m[1]!), den), form: 'fraction' };
  }
  const dec = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s) ? Rational.parseDecimal(s) : null;
  if (dec) return { value: dec, form: /[.eE]/.test(s) ? 'decimal' : 'integer' };
  return null;
}
