import { parseStudentNumber, R, Rational } from '../../../../shared/study/rational';
import type { Block, KnownWrong, Misconception, Question } from '../../../../shared/study/types';
import { choice, dec, m, numeric, p, roundTo, steps, tex, tip, trueFalse, warn, type Draft, type Rng, type SkillPack } from '../kit';

/**
 * Geometry and measurement packs (Grades 6–9). Every answer key is computed with exact rationals. Where π is
 * involved a question either says "use 3.14 for π" (exact key from 314/100) or "use the π key and round to the
 * nearest tenth" (key rounded from a 16-digit rational π, marked with a tolerance of 0.05).
 */

const G6 = 'on-elementary-mathematics-g6-math';
const G7 = 'on-elementary-mathematics-g7-math';
const G8 = 'on-elementary-mathematics-g8-math';
const W = 'on-mth1w';

const NAMES = ['Amira', 'Liam', 'Priya', 'Mateo', 'Aiyana', 'Noah', 'Mei', 'Jaden', 'Zara', 'Owen', 'Fatima', 'Kai', 'Sofia', 'Ethan', 'Nia', 'Arjun', 'Chloé', 'Malik', 'Hana', 'Lucas'] as const;

/** π to 16 digits as an exact rational: keys "to the nearest tenth" are rounded from this, never from a float. */
const PI = R(3141592653589793n, 1000000000000000n);
/** The classroom approximation, used only when a question says "use 3.14 for π". */
const PI_314 = R(314, 100);
const TENTH = R(5, 100);

const rat = (v: number | Rational) => Rational.of(v);

// ─────────── Formatting ───────────

function group(s: string, sep: string, minus: string): string {
  const neg = s.startsWith('-');
  const [i = '', f] = (neg ? s.slice(1) : s).split('.');
  const ii = i.length >= 5 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : i;
  return `${neg ? minus : ''}${ii}${f === undefined ? '' : `.${f}`}`;
}
/** A number for plain text: 12.5, 10 000, −3. */
const nt = (v: Rational | number) => group(dec(v), ' ', '−');
/** A number inside LaTeX: 12.5, 10\,000, -3. */
const nl = (v: Rational | number) => group(dec(v), '\\,', '-');

const UNIT_TEX: Record<string, string> = {
  'mm²': '\\text{ mm}^2',
  'cm²': '\\text{ cm}^2',
  'm²': '\\text{ m}^2',
  'km²': '\\text{ km}^2',
  'mm³': '\\text{ mm}^3',
  'cm³': '\\text{ cm}^3',
  'm³': '\\text{ m}^3',
  '°': '^\\circ',
};
/** A unit written after a number in LaTeX. */
const ul = (u: string) => UNIT_TEX[u] ?? `\\text{ ${u}}`;
const sq = (u: string) => `${u}²`;
const cu = (u: string) => `${u}³`;
const units = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** Signed number for plain text, with a true minus sign. */
const sn = (n: number) => (n < 0 ? `−${-n}` : `${n}`);

// ─────────── Exact square roots ───────────

function isqrt(n: bigint): bigint {
  if (n < 2n) return n < 0n ? 0n : n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) x -= 1n;
  while ((x + 1n) * (x + 1n) <= n) x += 1n;
  return x;
}

/** √s rounded to `places` decimal places (half up), computed exactly. */
function sqrtRound(s: Rational, places = 1): Rational {
  const scale = 10n ** BigInt(places);
  let r = isqrt((s.n * scale * scale) / s.d);
  if (4n * s.n * scale * scale >= (2n * r + 1n) ** 2n * s.d) r += 1n;
  return new Rational(r, scale);
}

function exactSqrt(s: Rational): Rational | null {
  if (s.n < 0n) return null;
  const a = isqrt(s.n);
  const b = isqrt(s.d);
  return a * a === s.n && b * b === s.d ? new Rational(a, b) : null;
}

/** Truncates a positive value to `places` decimals, for showing "12.649…" in a worked solution. */
function trunc(v: Rational, places = 3): Rational {
  const scale = 10n ** BigInt(places);
  return new Rational((v.n * scale) / v.d, scale);
}
/** √s for a worked solution: exact when it is exact, otherwise the first three decimals and "…". */
function sqrtShow(s: Rational): string {
  const e = exactSqrt(s);
  if (e && e.toDecimal(3) !== null) return nl(e);
  const scale = 1000n;
  return `${nl(new Rational(isqrt((s.n * scale * scale) / s.d), scale))}\\ldots`;
}
/** A long decimal for a worked solution: exact if short, otherwise three decimals and "…". */
const longShow = (v: Rational) => (v.toDecimal(3) !== null ? nl(v) : `${nl(trunc(v))}\\ldots`);

// ─────────── Question helpers ───────────

type Wrong = [Rational | null | undefined, string];

/**
 * Known wrong answers, keeping only values a student could type that differ from the key: no duplicates, nothing
 * within the tolerance, no repeating decimals, and no negative value for a positive measurement.
 */
function wrongs(answer: Rational, list: Wrong[], tol?: Rational, signed = false): KnownWrong[] {
  const out: KnownWrong[] = [];
  const seen: Rational[] = [answer];
  for (const [v, misconception] of list) {
    if (!v) continue;
    if (!signed && answer.cmp(0) > 0 && v.cmp(0) <= 0) continue;
    const s = v.toDecimal(6);
    if (s === null || seen.some((x) => x.eq(v)) || (tol && v.sub(answer).abs().cmp(tol) <= 0)) continue;
    seen.push(v);
    out.push({ value: s, misconception });
  }
  return out;
}

/** A measurement answer: a whole number or a decimal, with a unit the student may type or leave out. */
function measure(prompt: Block[], answer: Rational, o: { unit?: string; hints: string[]; solution: Block[]; wrong?: Wrong[]; tol?: boolean; signed?: boolean; params: Record<string, unknown> }): Draft {
  const tol = o.tol ? TENTH : undefined;
  return numeric(prompt, answer, {
    hints: o.hints,
    solution: o.solution,
    unit: o.unit || undefined,
    accept: ['integer', 'decimal'],
    tolerance: tol ? '0.05' : undefined,
    knownWrong: wrongs(answer, o.wrong ?? [], tol, o.signed),
    params: o.params,
  });
}

const keyNumber = (q: Question): number | null => (q.type === 'numeric' ? (parseStudentNumber(q.answer)?.value.toNumber() ?? null) : null);
/** Compares the key with an independent floating-point value. `rounded`: the key is that value to the nearest tenth. */
function near(q: Question, want: number, rounded = false): string | null {
  const got = keyNumber(q);
  if (got === null || !Number.isFinite(want)) return 'key is not a number';
  const slack = (rounded ? 0.05 : 0) + 1e-9 * Math.max(1, Math.abs(want));
  return Math.abs(got - want) <= slack ? null : `key ${got} does not match ${want}`;
}
const rightText = (q: Question) => (q.type === 'multiple_choice' ? (q.choices.find((c) => c.id === q.answer)?.text ?? '') : '');
type Params = Record<string, unknown>;
const num = (pr: Params, k: string) => Number(pr[k]);

// ─────────── Shared misconceptions (same mistake, same id) ───────────

const MIS = {
  radiusDiameter: {
    id: 'geo_radius_diameter',
    label: 'Mixed up the radius and the diameter',
    explanation: 'The diameter goes all the way across a circle through the centre. The radius goes only from the centre to the edge, so it is half as long.',
    fix: 'Before using a formula, write both: r = … and d = …. Area uses r. Circumference can use d (C = πd) or r (C = 2πr).',
  },
  circAreaFormula: {
    id: 'geo_circ_area_formula',
    label: 'Mixed up the circumference and area formulas',
    explanation: 'Circumference is the length around a circle (C = πd = 2πr). Area is the space inside it (A = πr²) and is measured in square units.',
    fix: 'Ask yourself: am I going around (a length) or covering (an area)? Area answers have square units like cm².',
  },
  piApprox: {
    id: 'geo_pi_approx',
    label: 'Used 3.14 when the question asked for the π key',
    explanation: '3.14 is a little less than π, so answers drift away from the exact value, especially with big numbers.',
    fix: 'Follow the instructions: use the π key when the question asks for it, and round only at the very end.',
  },
  areaNoHalf: {
    id: 'geo_area_no_half',
    label: 'Forgot to halve',
    explanation: 'A triangle is exactly half of a rectangle with the same base and height. Trapezoids, kites and rhombuses have a “÷ 2” in their formulas for the same reason.',
    fix: 'After multiplying, ask: does this shape fill the whole rectangle around it? If not, divide by 2.',
  },
  stoppedEarly: {
    id: 'geo_stopped_early',
    label: 'Stopped one step early',
    explanation: 'The number you found is a correct middle step, but the question asks for something more.',
    fix: 'Reread the last sentence of the question. List the steps before you start and tick each one off.',
  },
  unitFactor: {
    id: 'geo_unit_factor',
    label: 'Used the wrong conversion number',
    explanation: 'Each metric change has its own number: 10 mm in 1 cm, 100 cm in 1 m, 1000 m in 1 km, 1000 g in 1 kg, 1000 mL in 1 L.',
    fix: 'Write the fact you are using first (for example, 1 L = 1000 mL), then multiply or divide by that number.',
  },
  unitDirection: {
    id: 'geo_unit_direction',
    label: 'Multiplied when you should divide (or the other way round)',
    explanation: 'Changing to a smaller unit gives a bigger number (more small pieces). Changing to a bigger unit gives a smaller number.',
    fix: 'Before calculating, decide: should my answer be bigger or smaller than the number I started with?',
  },
} satisfies Record<string, Misconception>;

// ═════════════════════════ Pythagorean theorem ═════════════════════════

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
];

const triangle = (a: string, b: string, c: string, alt: string): Block => ({ kind: 'diagram', diagram: { type: 'right_triangle', a, b, c }, alt });

type PyFind = 'hyp' | 'leg';

/** Solution, hints and predictable wrong answers for one right-triangle side. For 'leg', `other` is the hypotenuse. */
function pyParts(find: PyFind, known: Rational, other: Rational, name: string, unit: string, round: boolean) {
  const k2 = known.mul(known);
  const o2 = other.mul(other);
  const s = find === 'hyp' ? k2.add(o2) : o2.sub(k2);
  const exact = exactSqrt(s);
  const ans = round || !exact ? sqrtRound(s) : exact;
  const same = exact !== null && exact.eq(ans);
  const solution = steps(
    find === 'hyp'
      ? { text: `Side $$${name}$$ is across from the right angle, so it is the hypotenuse. Add the squares of the two legs.`, math: `${name}^2 = ${nl(known)}^2 + ${nl(other)}^2` }
      : { text: `Side $$${name}$$ is a leg. The hypotenuse is ${nt(other)} ${unit}, so subtract the square of the known leg from the square of the hypotenuse.`, math: `${name}^2 = ${nl(other)}^2 - ${nl(known)}^2` },
    { text: 'Work out the squares.', math: find === 'hyp' ? `${name}^2 = ${nl(k2)} + ${nl(o2)} = ${nl(s)}` : `${name}^2 = ${nl(o2)} - ${nl(k2)} = ${nl(s)}` },
    { text: same ? 'Take the square root.' : 'Take the square root and round to the nearest tenth.', math: `${name} = \\sqrt{${nl(s)}} ${same ? '=' : '\\approx'} ${nl(ans)}${ul(unit)}` },
  );
  const hints = [
    'Find the right angle. Is the side you want across from it (the hypotenuse) or touching it (a leg)?',
    find === 'hyp' ? `It is the hypotenuse, so add the squares: $$${name}^2 = ${nl(known)}^2 + ${nl(other)}^2$$. Then take the square root.` : `It is a leg, so subtract: $$${name}^2 = ${nl(other)}^2 - ${nl(known)}^2$$. Then take the square root.`,
  ];
  const diff = k2.sub(o2).abs();
  const wrong: Wrong[] = [
    [s, 'geo_pyth_no_root'],
    [find === 'hyp' ? (diff.isZero() ? null : sqrtRound(diff)) : sqrtRound(k2.add(o2)), 'geo_pyth_add_subtract'],
    [find === 'hyp' ? known.add(other) : other.sub(known), 'geo_pyth_add_sides'],
  ];
  return { ans, s, solution, hints, wrong };
}

function pyPlain(rng: Rng, find: PyFind, p1: Rational, p2: Rational, unit: string): Draft {
  const pp = pyParts(find, p1, p2, 'x', unit, false);
  const L = (v: Rational) => `${nt(v)} ${unit}`;
  const labels: [string, string, string] = find === 'hyp' ? [L(p1), L(p2), 'x'] : rng.chance(0.5) ? ['x', L(p1), L(p2)] : [L(p1), 'x', L(p2)];
  const words = find === 'hyp' ? `The legs are ${L(p1)} and ${L(p2)}, and side x is the hypotenuse.` : `One leg is ${L(p1)}, the other leg is x, and the hypotenuse is ${L(p2)}.`;
  return measure([p(`Find the length of side $$x$$ in this right triangle. ${words.replace(/side x|leg is x/, (s) => s.replace('x', '$$x$$'))}`), triangle(...labels, `A right triangle. ${words}`)], pp.ans, {
    unit,
    hints: pp.hints,
    solution: [pp.solution],
    wrong: pp.wrong,
    params: { kind: find, p1: p1.toNumber(), p2: p2.toNumber(), round: false },
  });
}

function pyIdentify(rng: Rng): Draft {
  const verts = rng.pick([['A', 'B', 'C'], ['P', 'Q', 'R'], ['D', 'E', 'F'], ['J', 'K', 'L'], ['X', 'Y', 'Z']] as const);
  const right = rng.pick(verts);
  const [u = '', v = ''] = verts.filter((x) => x !== right);
  const seg = (a: string, b: string) => (a < b ? `${a}${b}` : `${b}${a}`);
  return choice(
    rng,
    [p(`In $$\\triangle ${verts.join('')}$$, $$\\angle ${right} = 90^\\circ$$. Which side is the hypotenuse?`)],
    tex(seg(u, v)),
    [
      { text: tex(seg(u, right)), misconception: 'geo_hyp_location' },
      { text: tex(seg(v, right)), misconception: 'geo_hyp_location' },
    ],
    {
      hints: ['The hypotenuse is across from (opposite) the right angle.', `The right angle is at $$${right}$$. Which side does not touch $$${right}$$?`],
      solution: [p(`Sides $$${seg(u, right)}$$ and $$${seg(v, right)}$$ meet at $$${right}$$, so they make the right angle: they are the legs. The side across from the right angle is $$${seg(u, v)}$$, so it is the hypotenuse, and it is the longest side.`)],
      params: { kind: 'identify', verts: verts.join(''), right },
    },
  );
}

function pySquares(rng: Rng, unit: string): Draft {
  const [a, b, h] = rng.pick([
    [3, 4, 5],
    [6, 8, 10],
    [5, 12, 13],
    [8, 15, 17],
    [9, 12, 15],
  ] as const);
  const [A1, A2, A3] = [a * a, b * b, h * h];
  const u = sq(unit);
  const toHyp = rng.chance(0.6);
  const lead = 'Squares are drawn on all three sides of a right triangle.';
  const text = toHyp
    ? `${lead} The squares on the two legs have areas of ${A1} ${u} and ${A2} ${u}. What is the area of the square on the hypotenuse?`
    : `${lead} The square on the hypotenuse has an area of ${A3} ${u}, and the square on one leg has an area of ${A1} ${u}. What is the area of the square on the other leg?`;
  return measure([p(text)], R(toHyp ? A3 : A2), {
    unit: u,
    hints: ['The squares on the two legs together have exactly the same area as the square on the hypotenuse.', toHyp ? 'Add the two areas.' : 'The big square is the total, so subtract the area you know from it.'],
    solution: [
      p('The Pythagorean relationship: the areas of the two smaller squares add up to the area of the square on the hypotenuse.'),
      m(toHyp ? `${A1} + ${A2} = ${A3}` : `${A3} - ${A1} = ${A2}`),
      p(`So the area is ${toHyp ? A3 : A2} ${u}. The side lengths are the square roots: $$\\sqrt{${A1}} = ${a}$$, $$\\sqrt{${A2}} = ${b}$$ and $$\\sqrt{${A3}} = ${h}$$.`),
    ],
    wrong: [[R(toHyp ? A2 - A1 : A3 + A1), 'geo_pyth_add_subtract']],
    params: { kind: toHyp ? 'sq-hyp' : 'sq-leg', A1, A2, A3 },
  });
}

interface PyContext {
  find: PyFind;
  p1: Rational;
  p2: Rational;
  name: string;
  unit: string;
  text: string;
  labels: [string, string, string];
  alt: string;
}

function pyContext(rng: Rng): PyContext {
  const who = rng.pick(NAMES);
  switch (rng.int(0, 6)) {
    case 0: {
      const L = rng.int(4, 8);
      const f = rat(rng.pick([1, 1.2, 1.5, 1.8, 2]));
      return {
        find: 'leg',
        p1: f,
        p2: R(L),
        name: 'h',
        unit: 'm',
        text: `${who} leans a ${L} m ladder against a vertical wall. The foot of the ladder is ${nt(f)} m from the wall, on level ground. How high up the wall, $$h$$, does the ladder reach? Round to the nearest tenth of a metre.`,
        labels: [`${nt(f)} m`, 'h', `${L} m`],
        alt: `A right triangle made by the ground (${nt(f)} m), the wall (h) and the ladder (${L} m, the hypotenuse).`,
      };
    }
    case 1: {
      const rise = rng.pick([30, 35, 40, 45, 50, 55, 60]);
      const run = rise * 12;
      return {
        find: 'hyp',
        p1: R(run),
        p2: R(rise),
        name: 'L',
        unit: 'cm',
        text: `A community centre is building an accessible ramp. The ramp rises ${rise} cm over a horizontal distance of ${run} cm. How long is the sloped surface of the ramp, $$L$$? Round to the nearest tenth of a centimetre.`,
        labels: [`${run} cm`, `${rise} cm`, 'L'],
        alt: `A right triangle with a horizontal leg of ${run} cm, a vertical leg of ${rise} cm and the sloped ramp L as the hypotenuse.`,
      };
    }
    case 2: {
      const w = rng.pick([64, 80, 96, 112, 128]);
      const h = (w * 9) / 16;
      return {
        find: 'hyp',
        p1: R(w),
        p2: R(h),
        name: 'd',
        unit: 'cm',
        text: `A TV screen is ${w} cm wide and ${h} cm tall. Screen sizes are measured along the diagonal, from one corner to the opposite corner. How long is the diagonal, $$d$$? Round to the nearest tenth of a centimetre.`,
        labels: [`${w} cm`, `${h} cm`, 'd'],
        alt: `Half of the screen: a right triangle with legs ${w} cm and ${h} cm and the diagonal d as the hypotenuse.`,
      };
    }
    case 3: {
      const l = rng.int(40, 120);
      const w = rng.int(25, l - 5);
      return {
        find: 'hyp',
        p1: R(l),
        p2: R(w),
        name: 'd',
        unit: 'm',
        text: `${who} usually walks along two edges of a rectangular park: ${l} m along one side, then ${w} m along the next side. How long is the straight path, $$d$$, across the park from the starting corner to the opposite corner? Round to the nearest tenth of a metre.`,
        labels: [`${l} m`, `${w} m`, 'd'],
        alt: `A right triangle with legs ${l} m and ${w} m (two edges of the park) and the diagonal path d as the hypotenuse.`,
      };
    }
    case 4: {
      const S = rng.int(30, 60);
      const D = rng.int(12, S - 10);
      return {
        find: 'leg',
        p1: R(D),
        p2: R(S),
        name: 'h',
        unit: 'm',
        text: `${who} is flying a kite on a ${S} m string pulled tight. The kite is directly above a spot on the ground ${D} m away from ${who}. Ignoring ${who}’s own height, how high is the kite, $$h$$? Round to the nearest tenth of a metre.`,
        labels: [`${D} m`, 'h', `${S} m`],
        alt: `A right triangle with a ground leg of ${D} m, a vertical leg h and the kite string (${S} m) as the hypotenuse.`,
      };
    }
    case 5: {
      const e = rat(rng.pick([2, 2.5, 3, 3.5, 5, 6]));
      const n = rat(rng.pick([1.5, 4, 4.5, 7, 8]));
      return {
        find: 'hyp',
        p1: e,
        p2: n,
        name: 'd',
        unit: 'km',
        text: `On a canoe trip in Algonquin Park, a group paddles ${nt(e)} km due east, then ${nt(n)} km due north. How far are they from their starting point in a straight line, $$d$$? Round to the nearest tenth of a kilometre.`,
        labels: [`${nt(e)} km`, `${nt(n)} km`, 'd'],
        alt: `A right triangle with an east leg of ${nt(e)} km, a north leg of ${nt(n)} km and the straight-line distance d as the hypotenuse.`,
      };
    }
    default: {
      const ht = rng.int(8, 25);
      const dd = rng.int(4, 12);
      return {
        find: 'hyp',
        p1: R(ht),
        p2: R(dd),
        name: 'w',
        unit: 'm',
        text: `A straight guy wire runs from the top of a ${ht} m antenna to a stake in level ground ${dd} m from the base of the antenna. How long is the guy wire, $$w$$? Round to the nearest tenth of a metre.`,
        labels: [`${ht} m`, `${dd} m`, 'w'],
        alt: `A right triangle with the antenna (${ht} m) and the ground (${dd} m) as legs and the wire w as the hypotenuse.`,
      };
    }
  }
}

function pyContextQ(rng: Rng): Draft {
  const cx = pyContext(rng);
  const pp = pyParts(cx.find, cx.p1, cx.p2, cx.name, cx.unit, true);
  return measure([p(cx.text), triangle(...cx.labels, cx.alt)], pp.ans, {
    unit: cx.unit,
    hints: pp.hints,
    solution: [pp.solution],
    wrong: pp.wrong,
    params: { kind: cx.find, p1: cx.p1.toNumber(), p2: cx.p2.toNumber(), round: true },
  });
}

function pyConverse(rng: Rng): Draft {
  const who = rng.pick(NAMES);
  const [a, b, h] = rng.pick([
    [30, 40, 50],
    [60, 80, 100],
    [50, 120, 130],
    [90, 120, 150],
    [80, 150, 170],
    [120, 160, 200],
  ] as const);
  const square = rng.chance(0.5);
  const diag = square ? h : h + rng.pick([-3, -2, 2, 3]);
  const lhs = a * a + b * b;
  const rhs = diag * diag;
  const thing = rng.pick(['garden bed', 'deck frame', 'bookshelf', 'sandbox']);
  return trueFalse(
    [p(`${who} is building a rectangular ${thing}. To check one corner, ${who} marks a point ${a} cm along one side and ${b} cm along the other side, then measures ${diag} cm straight across between the two marks.`), p('True or false: the corner is square (exactly 90°).')],
    lhs === rhs,
    {
      hints: ['If the corner is 90°, the three measurements make a right triangle with the diagonal as the hypotenuse.', `Compare $$${a}^2 + ${b}^2$$ with $$${diag}^2$$. For a right angle they must be exactly equal.`],
      solution: [
        steps(
          { text: 'Add the squares of the two sides.', math: `${a}^2 + ${b}^2 = ${nl(a * a)} + ${nl(b * b)} = ${nl(lhs)}` },
          { text: 'Square the diagonal.', math: `${diag}^2 = ${nl(rhs)}` },
          lhs === rhs
            ? { text: 'The results are equal, so the triangle has a right angle: the corner is square. The statement is **true**.', math: `${nl(lhs)} = ${nl(rhs)}` }
            : { text: 'The results are not equal, so the corner is not exactly 90°, even though the numbers are close. The statement is **false**.', math: `${nl(lhs)} \\neq ${nl(rhs)}` },
        ),
      ],
      misconception: 'geo_pyth_converse',
      params: { kind: 'converse', a, b, diag },
    },
  );
}

function pyMultiStep(rng: Rng, kind: 'perimeter' | 'iso' | 'roof' | 'box'): Draft {
  if (kind === 'perimeter') {
    const a = rng.int(5, 20);
    let b = rng.int(5, 20);
    if (b === a) b += 1;
    const s = R(a * a + b * b);
    const hyp = sqrtRound(s);
    const ans = hyp.add(a + b);
    return measure([p(`A right triangle has legs of ${a} cm and ${b} cm. What is its perimeter? Round to the nearest tenth of a centimetre.`), triangle(`${a} cm`, `${b} cm`, 'c', `A right triangle with legs ${a} cm and ${b} cm and an unknown hypotenuse c.`)], ans, {
      unit: 'cm',
      hints: ['The perimeter needs all three sides. Which side is missing?', `Find the hypotenuse first: $$c^2 = ${a}^2 + ${b}^2$$. Then add all three sides.`],
      solution: [
        steps(
          { text: 'Find the hypotenuse c.', math: `c^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${nl(s)}` },
          { text: 'Take the square root. Keep all the digits for now.', math: `c = \\sqrt{${nl(s)}} = ${sqrtShow(s)}` },
          { text: 'Add the three sides, then round to the nearest tenth.', math: `P = ${a} + ${b} + ${sqrtShow(s)} \\approx ${nl(ans)}\\text{ cm}` },
        ),
      ],
      wrong: [
        [hyp, MIS.stoppedEarly.id],
        [s.add(a + b), 'geo_pyth_no_root'],
        [R(2 * (a + b)), 'geo_pyth_add_sides'],
      ],
      params: { kind: 'perimeter', a, b },
    });
  }
  if (kind === 'iso') {
    const s = rng.int(8, 25);
    const half = rng.int(3, s - 2);
    const b = 2 * half;
    const h2 = R(s * s - half * half);
    const ans = sqrtRound(h2);
    const exact = exactSqrt(h2);
    return measure(
      [
        p(`An isosceles triangle has two equal sides of ${s} cm and a base of ${b} cm. The height is drawn from the top vertex to the midpoint of the base, which splits the triangle into two matching right triangles. How tall is the triangle? Round to the nearest tenth of a centimetre.`),
        triangle(`${half} cm`, 'h', `${s} cm`, `One of the two right triangles made by the height: one leg is half the base (${half} cm), the other leg is the height h, and the hypotenuse is an equal side (${s} cm).`),
      ],
      ans,
      {
        unit: 'cm',
        hints: ['Look at one of the two right triangles. Which of its sides do you know?', `Its legs are half the base (${half} cm) and the height h. Its hypotenuse is ${s} cm.`],
        solution: [
          steps(
            { text: 'The height meets the base at its midpoint, so each right triangle has a leg of half the base.', math: `${b} \\div 2 = ${half}\\text{ cm}` },
            { text: 'The height is a leg, so subtract the squares.', math: `h^2 = ${s}^2 - ${half}^2 = ${s * s} - ${half * half} = ${nl(h2)}` },
            { text: 'Take the square root and round to the nearest tenth.', math: `h = \\sqrt{${nl(h2)}} ${exact && exact.eq(ans) ? '=' : '\\approx'} ${nl(ans)}\\text{ cm}` },
          ),
        ],
        wrong: [
          [s * s - b * b > 0 ? sqrtRound(R(s * s - b * b)) : null, 'geo_pyth_half_base'],
          [sqrtRound(R(s * s + half * half)), 'geo_pyth_add_subtract'],
          [h2, 'geo_pyth_no_root'],
        ],
        params: { kind: 'iso', s, b },
      },
    );
  }
  if (kind === 'roof') {
    const w = rng.pick([4, 5, 6, 8]);
    const hw = rat(rng.pick([2.4, 2.5, 3]));
    const r = rat(rng.pick([1, 1.2, 1.5, 2]));
    const half = R(w, 2);
    const slant2 = half.mul(half).add(r.mul(r));
    const base = hw.mul(2).add(w);
    const ans = base.add(sqrtRound(slant2.mul(4)));
    return measure(
      [
        p(`The front of a garden shed is a rectangle ${w} m wide and ${nt(hw)} m tall, with a triangle-shaped roof section on top. The peak of the roof is ${nt(r)} m above the top of the walls, directly above the middle of the front. Trim will go around the outside edge of the front: along the bottom, up both walls and along both sloped roof edges. How much trim is needed? Round to the nearest tenth of a metre.`),
        triangle(`${nt(half)} m`, `${nt(r)} m`, 's', `The right triangle under one sloped roof edge: its legs are half the width (${nt(half)} m) and the roof height (${nt(r)} m), and its hypotenuse is the sloped edge s.`),
      ],
      ans,
      {
        unit: 'm',
        hints: ['Each sloped roof edge is the hypotenuse of a right triangle. What are the legs of that triangle?', `The legs are half the width (${nt(half)} m) and the roof height (${nt(r)} m). Find one sloped edge, then add up all the outside edges.`],
        solution: [
          steps(
            { text: 'One sloped edge s is the hypotenuse of a right triangle with legs of half the width and the roof height.', math: `s^2 = ${nl(half)}^2 + ${nl(r)}^2 = ${nl(slant2)}` },
            { text: 'Take the square root. Keep all the digits for now.', math: `s = \\sqrt{${nl(slant2)}} = ${sqrtShow(slant2)}` },
            { text: 'Add the outside edges: the bottom, two walls and two sloped edges. The top edge of the rectangle is inside the shape, so it is not trimmed.', math: `P = ${w} + 2 \\times ${nl(hw)} + 2s \\approx ${nl(ans)}\\text{ m}` },
          ),
        ],
        wrong: [
          [ans.add(w), 'geo_composite_inside_edge'],
          [base.add(sqrtRound(R(w * w).add(r.mul(r)).mul(4))), 'geo_pyth_half_base'],
        ],
        params: { kind: 'roof', w, hw: hw.toNumber(), r: r.toNumber() },
      },
    );
  }
  const l = rng.int(30, 60);
  const wd = rng.int(20, 40);
  const h = rng.int(15, 40);
  const floor2 = R(l * l + wd * wd);
  const tot = floor2.add(h * h);
  const ans = sqrtRound(tot);
  return measure([p(`A closed storage box is ${l} cm long, ${wd} cm wide and ${h} cm tall. What is the longest straight rod that fits inside it, reaching from one bottom corner to the opposite top corner? Round to the nearest tenth of a centimetre.`)], ans, {
    unit: 'cm',
    hints: ['Use two right triangles. Start with the diagonal across the bottom of the box.', 'The rod is the hypotenuse of a second right triangle whose legs are the bottom diagonal and the height of the box.'],
    solution: [
      steps(
        { text: 'The diagonal f across the bottom is the hypotenuse of a right triangle with legs equal to the length and width.', math: `f^2 = ${l}^2 + ${wd}^2 = ${nl(floor2)}` },
        { text: 'The rod d is the hypotenuse of a right triangle with legs f and the height.', math: `d^2 = f^2 + ${h}^2 = ${nl(floor2)} + ${h * h} = ${nl(tot)}` },
        { text: 'Take the square root and round to the nearest tenth.', math: `d = \\sqrt{${nl(tot)}} \\approx ${nl(ans)}\\text{ cm}` },
      ),
    ],
    wrong: [
      [sqrtRound(floor2), MIS.stoppedEarly.id],
      [R(l + wd + h), 'geo_pyth_add_sides'],
      [tot, 'geo_pyth_no_root'],
    ],
    params: { kind: 'box', l, wd, h },
  });
}

export const pythagoras: SkillPack = {
  id: 'pythagoras',
  title: 'The Pythagorean theorem',
  subject: 'math',
  expectations: [
    {
      id: `${G8}:E2.4`,
      note: 'Applies the Pythagorean theorem to find an unknown hypotenuse or leg of a right triangle: Pythagorean triples give exact answers at the lower levels, other lengths are rounded to the nearest tenth, and stretch questions take two steps. Warm-ups use the areas of the squares on the sides; describing the relationship with physical or geometric models is explained in the lesson but not assessed.',
    },
    {
      id: `${W}:E1.5`,
      note: 'Solves right-triangle side-length problems in real-life situations (ladders, ramps, screens, canoe routes, checking that a corner is square) and in composite shapes (a shed front with a triangular roof, the diagonal of a box), rounding to the nearest tenth.',
      levels: [2, 3, 4],
    },
  ],
  prerequisites: [],
  goal: 'I can use the Pythagorean theorem to find a missing side of a right triangle.',
  explain: (c) => [
    p('A **right triangle** has one 90° angle. The two sides that make the right angle are the **legs**. The side across from the right angle is the **hypotenuse**, and it is always the longest side.'),
    p('Draw a square on each side of a right triangle. The areas of the two squares on the legs always add up to the area of the square on the hypotenuse. This is the **Pythagorean relationship**:'),
    m('a^2 + b^2 = c^2'),
    p('Here $$a$$ and $$b$$ are the legs and $$c$$ is the hypotenuse. For a triangle with sides 3, 4 and 5: $$3^2 + 4^2 = 9 + 16 = 25 = 5^2$$.'),
    steps(
      { text: 'Find the right angle, then the hypotenuse across from it.' },
      { text: 'Finding the hypotenuse? Add the squares of the legs.', math: 'c^2 = a^2 + b^2' },
      { text: 'Finding a leg? Subtract the square of the other leg from the square of the hypotenuse.', math: 'a^2 = c^2 - b^2' },
      { text: 'Take the square root. Round only at the very end.' },
    ),
    warn('This only works for right triangles, and $$c$$ must be the hypotenuse.'),
    ...(c.grade >= 9 ? [p('It also works backwards: if the three sides of a triangle fit $$a^2 + b^2 = c^2$$ exactly, the triangle has a right angle. Builders use this to check that a corner is square.')] : []),
    c.simple ? tip('Longest side missing? Add the squares. Shorter side missing? Subtract. Then take the square root.') : tip('Check your answer: the hypotenuse must be longer than each leg but shorter than the two legs added together.'),
  ],
  alternatives: () => ({
    simpler: [p('In a right triangle: (short side)² + (other short side)² = (long side)². To find the long side, add the squares, then take the square root.')],
    visual: [
      triangle('3 cm', '4 cm', '5 cm', 'A right triangle with legs of 3 cm and 4 cm and a hypotenuse of 5 cm.'),
      p('Picture a square on each side. The squares on the legs have areas of 9 cm² and 16 cm². Together that is 25 cm², exactly the area of the square on the 5 cm side, shown below.'),
      { kind: 'diagram', diagram: { type: 'area_model', rows: 5, cols: 5, shadedRows: 5, shadedCols: 5 }, alt: 'A 5 by 5 square made of 25 unit squares: the square on the hypotenuse.' },
    ],
    analogy: [p('Walking corner to corner across a rectangular field is shorter than walking along two edges. The Pythagorean theorem tells you exactly how long that shortcut is.')],
    steps: [
      p('Find leg $$a$$ when the hypotenuse is 13 cm and the other leg is 5 cm.'),
      steps({ text: 'The unknown is a leg, so subtract.', math: 'a^2 = 13^2 - 5^2' }, { text: 'Square the numbers.', math: 'a^2 = 169 - 25 = 144' }, { text: 'Take the square root.', math: 'a = \\sqrt{144} = 12\\text{ cm}' }),
    ],
    compare: [p('You already know how to find the area of a square: a 6 cm square has an area of 36 cm². This theorem is about those squares, so the work is squaring the sides and then “un-squaring” with a square root.')],
  }),
  example: (rng) => {
    const [a, b] = rng.pick(TRIPLES.slice(0, 4));
    const k = rng.pick([1, 2]);
    const pp = pyParts('hyp', R(a * k), R(b * k), 'c', 'cm', false);
    return [p(`A right triangle has legs of ${a * k} cm and ${b * k} cm. How long is the hypotenuse $$c$$?`), triangle(`${a * k} cm`, `${b * k} cm`, 'c', `A right triangle with legs ${a * k} cm and ${b * k} cm and hypotenuse c.`), pp.solution];
  },
  generate: (rng, d, c) => {
    const unit = rng.pick(['cm', 'm']);
    if (d === 1) {
      const mode = rng.pick(['squares', 'identify', 'small'] as const);
      if (mode === 'identify') return pyIdentify(rng);
      if (mode === 'squares') return pySquares(rng, unit);
      const [a, b] = rng.pick([
        [3, 4],
        [6, 8],
        [5, 12],
      ] as const);
      return pyPlain(rng, 'hyp', R(a), R(b), unit);
    }
    if (d === 2) {
      const [a, b, h] = rng.pick(TRIPLES);
      const k = rat(h <= 5 ? rng.pick([1, 2, 3, 4, 6, 0.5]) : h <= 17 ? rng.pick([1, 2, 3, 0.1]) : 1);
      const [l1, l2]: [number, number] = rng.chance(0.5) ? [a, b] : [b, a];
      if (rng.chance(0.45)) return pyPlain(rng, 'hyp', k.mul(l1), k.mul(l2), unit);
      return pyPlain(rng, 'leg', k.mul(l1), k.mul(h), unit);
    }
    if (d === 3) return c.grade >= 9 && rng.chance(0.3) ? pyConverse(rng) : pyContextQ(rng);
    return pyMultiStep(rng, c.grade >= 9 ? rng.pick(['perimeter', 'iso', 'roof', 'box'] as const) : rng.pick(['perimeter', 'iso'] as const));
  },
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Params;
    const n = (k: string) => num(pr, k);
    switch (pr.kind) {
      case 'identify': {
        const t = rightText(q).replace(/\$/g, '');
        const others = String(pr.verts)
          .split('')
          .filter((x) => x !== pr.right);
        return t.length === 2 && others.every((x) => t.includes(x)) ? null : 'hypotenuse choice is wrong';
      }
      case 'converse':
        return q.type === 'true_false' && q.answer === (Math.hypot(n('a'), n('b')) === n('diag')) ? null : 'converse truth value is wrong';
      case 'sq-hyp':
        return near(q, n('A1') + n('A2'));
      case 'sq-leg':
        return near(q, n('A3') - n('A1'));
      case 'hyp':
        return near(q, Math.hypot(n('p1'), n('p2')), pr.round === true);
      case 'leg':
        return near(q, Math.sqrt(n('p2') ** 2 - n('p1') ** 2), pr.round === true);
      case 'perimeter':
        return near(q, n('a') + n('b') + Math.hypot(n('a'), n('b')), true);
      case 'iso':
        return near(q, Math.sqrt(n('s') ** 2 - (n('b') / 2) ** 2), true);
      case 'roof':
        return near(q, n('w') + 2 * n('hw') + 2 * Math.hypot(n('w') / 2, n('r')), true);
      case 'box':
        return near(q, Math.hypot(n('l'), n('wd'), n('h')), true);
      default:
        return 'unknown question kind';
    }
  },
  summary: [
    'The hypotenuse is across from the right angle and is the longest side.',
    'In a right triangle, $$a^2 + b^2 = c^2$$, where $$c$$ is the hypotenuse.',
    'Add the squares to find the hypotenuse; subtract them to find a leg. Then take the square root and round at the end.',
  ],
  misconceptions: [
    { id: 'geo_hyp_location', label: 'Chose a side that touches the right angle', explanation: 'The two sides that make the right angle are the legs. The hypotenuse is across from the right angle, so it never touches the little square mark.', fix: 'Find the right-angle mark, then look straight across from it. That side is the hypotenuse, and it is always the longest.' },
    { id: 'geo_pyth_no_root', label: 'Forgot the square root', explanation: 'Adding (or subtracting) the squares gives the area of a square, like $$c^2$$, not the side length $$c$$.', fix: 'Finish with a square root. Then check that your answer is a sensible length compared with the other sides.' },
    { id: 'geo_pyth_add_subtract', label: 'Added when you should subtract (or the other way round)', explanation: 'To find the hypotenuse, add the squares of the legs. To find a leg, the square of the hypotenuse is the biggest, so you subtract.', fix: 'Ask: is the missing side the longest one? If yes, add. If no, subtract the smaller square from the bigger one.' },
    { id: 'geo_pyth_add_sides', label: 'Added the sides instead of their squares', explanation: 'The relationship is about the squares of the sides. In a 3-4-5 triangle, 3 + 4 = 7, but the hypotenuse is only 5.', fix: 'Square each side first, then add or subtract, then take the square root.' },
    { id: 'geo_pyth_half_base', label: 'Used the whole width instead of half', explanation: 'When a height or a roof peak sits in the middle, each right triangle uses only half of the base.', fix: 'Sketch the right triangle you are using and label its legs. One of them is half the base.' },
    { id: 'geo_pyth_converse', label: 'Judged the corner without comparing exactly', explanation: 'A corner is exactly 90° only when $$a^2 + b^2$$ equals $$c^2$$ exactly. Numbers that are close still mean the corner is slightly off.', fix: 'Work out $$a^2 + b^2$$ and $$c^2$$, then compare them. Equal means square; anything else means not square.' },
    { id: 'geo_composite_inside_edge', label: 'Counted an inside edge in the perimeter', explanation: 'Perimeter is the distance around the outside. An edge where two shapes join is inside the composite shape.', fix: 'Trace the outside of the shape with your finger and add only the edges you trace.' },
    MIS.stoppedEarly,
  ],
};

// ═════════════════════════ Circles ═════════════════════════

type PiMode = '314' | 'key';
const piOf = (mode: PiMode) => (mode === '314' ? PI_314 : PI);
const piRule = (mode: PiMode) => (mode === '314' ? 'Use 3.14 for π and do not round your answer.' : 'Use the π key on your calculator and round your answer to the nearest tenth.');
const circleDiagram = (value: Rational, unit: string, show: 'radius' | 'diameter'): Block => ({ kind: 'diagram', diagram: { type: 'circle', label: `${nt(value)} ${unit}`, show }, alt: `A circle with its ${show} drawn and labelled ${nt(value)} ${unit}.` });

/** Circumference (optionally times a number of turns) or area, from a radius or a diameter. */
function circleMeasure(o: { what: 'C' | 'A'; given: 'r' | 'd'; r: Rational; mode: PiMode; unit: string; text: string; times?: number; diagram?: boolean }): Draft {
  const pi = piOf(o.mode);
  const times = o.times ?? 1;
  const d = o.r.mul(2);
  const key = o.mode === 'key';
  const fix = (v: Rational) => (key ? roundTo(v, 1) : v);
  const value = (piv: Rational, rr: Rational) => (o.what === 'C' ? piv.mul(rr).mul(2).mul(times) : piv.mul(rr).mul(rr));
  const exact = value(pi, o.r);
  const ans = fix(exact);
  const ua = o.what === 'C' ? o.unit : sq(o.unit);
  const piTex = key ? '\\pi' : '3.14';
  const shown = (v: Rational) => (key ? `${longShow(v)} \\approx ${nl(roundTo(v, 1))}` : nl(v));
  const sol: { text: string; math?: string }[] = [];
  if (o.what === 'C') {
    if (o.given === 'r') sol.push({ text: 'Double the radius to get the diameter.', math: `d = 2 \\times ${nl(o.r)} = ${nl(d)}${ul(o.unit)}` });
    const one = pi.mul(d);
    if (times === 1) sol.push({ text: `Circumference is π times the diameter.${key ? ' Round to the nearest tenth.' : ''}`, math: `C = ${piTex} \\times ${nl(d)} = ${shown(one)}${ul(o.unit)}` });
    else {
      sol.push({ text: 'One turn of the wheel covers one circumference.', math: `C = ${piTex} \\times ${nl(d)} = ${key ? `${longShow(one)}` : nl(one)}${ul(o.unit)}` });
      sol.push({ text: `Multiply by the number of turns.${key ? ' Round to the nearest tenth at the end.' : ''}`, math: `${times} \\times ${piTex} \\times ${nl(d)} = ${shown(exact)}${ul(o.unit)}` });
    }
  } else {
    if (o.given === 'd') sol.push({ text: 'Halve the diameter to get the radius.', math: `r = ${nl(d)} \\div 2 = ${nl(o.r)}${ul(o.unit)}` });
    sol.push({ text: `Square the radius, then multiply by π.${key ? ' Round to the nearest tenth.' : ''}`, math: `A = ${piTex} \\times ${nl(o.r)}^2 = ${piTex} \\times ${nl(o.r.mul(o.r))} = ${shown(exact)}${ul(ua)}` });
  }
  const wrong: Wrong[] =
    o.what === 'C'
      ? [
          [fix(value(pi, o.given === 'r' ? o.r.div(2) : d)), MIS.radiusDiameter.id],
          [fix(pi.mul(o.r).mul(o.r)), MIS.circAreaFormula.id],
          [times > 1 ? fix(pi.mul(d)) : null, MIS.stoppedEarly.id],
        ]
      : [
          [o.given === 'd' ? fix(value(pi, d)) : null, MIS.radiusDiameter.id],
          [fix(pi.mul(d)), MIS.circAreaFormula.id],
        ];
  if (key) wrong.push([roundTo(value(PI_314, o.r), 1), MIS.piApprox.id]);
  const shownGiven = o.given === 'r' ? o.r : d;
  return measure([p(`${o.text} ${piRule(o.mode)}`), ...(o.diagram ? [circleDiagram(shownGiven, o.unit, o.given === 'r' ? 'radius' : 'diameter')] : [])], ans, {
    unit: ua,
    tol: key,
    hints:
      o.what === 'C'
        ? ['Circumference is the distance around the circle. How is it related to the diameter?', o.given === 'r' ? `Double the radius to get the diameter, then multiply by π${times > 1 ? ', then by the number of turns' : ''}.` : `Multiply the diameter by π${times > 1 ? ', then by the number of turns' : ''}.`]
        : ['Area is the space inside the circle. Which measurement does the area formula use: the radius or the diameter?', o.given === 'd' ? 'Halve the diameter to get the radius. Square the radius, then multiply by π.' : 'Square the radius (multiply it by itself), then multiply by π.'],
    solution: [steps(...sol)],
    wrong,
    params: { kind: o.what, r: o.r.toNumber(), mode: o.mode, times },
  });
}

function circleRD(rng: Rng): Draft {
  const unit = rng.pick(['cm', 'm', 'mm']);
  const r = rat(rng.pick([3, 4, 5, 6, 7, 8, 9, 11, 12, 15, 20, 25, 2.5, 4.5, 7.5]));
  const toD = rng.chance(0.5);
  const d = r.mul(2);
  const given = toD ? r : d;
  return measure([p(toD ? `A circle has a radius of ${nt(r)} ${unit}. What is its diameter?` : `A circle has a diameter of ${nt(d)} ${unit}. What is its radius?`), circleDiagram(given, unit, toD ? 'radius' : 'diameter')], toD ? d : r, {
    unit,
    hints: ['The diameter goes all the way across through the centre. The radius goes from the centre to the edge.', toD ? 'The diameter is as long as two radii.' : 'The radius is half the diameter.'],
    solution: [m(toD ? `d = 2r = 2 \\times ${nl(r)} = ${nl(d)}${ul(unit)}` : `r = d \\div 2 = ${nl(d)} \\div 2 = ${nl(r)}${ul(unit)}`)],
    wrong: [[toD ? r.div(2) : d.mul(2), MIS.radiusDiameter.id]],
    params: { kind: toD ? 'r2d' : 'd2r', given: given.toNumber() },
  });
}

function circleTF(rng: Rng): Draft {
  const r = rng.int(3, 20);
  const truth = rng.chance(0.5);
  const claimD = truth ? 2 * r : rng.chance(0.5) ? r / 2 : r + 2;
  return trueFalse([p(`True or false: a circle with a radius of ${r} cm has a diameter of ${nt(claimD)} cm.`)], truth, {
    hints: ['How many radii fit across a circle, through its centre?', 'The diameter is twice the radius: $$d = 2r$$.'],
    solution: [m(`d = 2 \\times ${r} = ${2 * r}\\text{ cm}`), p(truth ? 'So the statement is **true**.' : `The diameter is ${2 * r} cm, not ${nt(claimD)} cm, so the statement is **false**.`)],
    misconception: MIS.radiusDiameter.id,
    params: { kind: 'tf-rd', r, claimD },
  });
}

function circleFormulaMC(rng: Rng): Draft {
  const r = rng.int(3, 12);
  return choice(
    rng,
    [p(`Which expression gives the area of a circle with a radius of ${r} cm, in square centimetres?`)],
    tex(`\\pi \\times ${r}^2`),
    [
      { text: tex(`2 \\times \\pi \\times ${r}`), misconception: MIS.circAreaFormula.id },
      { text: tex(`\\pi \\times ${2 * r}^2`), misconception: MIS.radiusDiameter.id },
      { text: tex(`\\pi \\times ${r} \\times 2`), misconception: 'geo_square_vs_double' },
    ],
    {
      hints: ['Area uses the radius, and the radius is squared.', `$$${r}^2$$ means $$${r} \\times ${r}$$, not $$${r} \\times 2$$.`],
      solution: [m(`A = \\pi r^2 = \\pi \\times ${r}^2 = \\pi \\times ${r * r} \\approx ${nl(roundTo(PI.mul(r * r), 1))}\\text{ cm}^2`), p(`$$2 \\times \\pi \\times ${r}$$ is the circumference, and $$\\pi \\times ${2 * r}^2$$ uses the diameter instead of the radius.`)],
      params: { kind: 'formula', r },
    },
  );
}

function circleFromC(rng: Rng): Draft {
  const [thing, unit, lo, hi] = rng.pick([
    ['A circular garden', 'm', 4, 20],
    ['A round tablecloth', 'cm', 80, 160],
    ['A tree trunk', 'cm', 20, 80],
    ['A circular running track', 'm', 30, 80],
  ] as const);
  const d = rng.int(lo, hi);
  const C = PI_314.mul(d);
  const askR = rng.chance(0.5);
  const ans = askR ? R(d, 2) : R(d);
  return measure([p(`${thing} has a circumference of ${nt(C)} ${unit}. Use 3.14 for π. What is its ${askR ? 'radius' : 'diameter'}?`)], ans, {
    unit,
    hints: ['Circumference = π × diameter. Which operation undoes multiplying by 3.14?', askR ? 'Divide the circumference by 3.14 to get the diameter, then halve it.' : 'Divide the circumference by 3.14.'],
    solution: [
      steps(
        { text: 'Start from $$C = \\pi d$$. Divide the circumference by π to find the diameter.', math: `d = ${nl(C)} \\div 3.14 = ${d}${ul(unit)}` },
        ...(askR ? [{ text: 'The radius is half the diameter.', math: `r = ${d} \\div 2 = ${nl(ans)}${ul(unit)}` }] : []),
      ),
    ],
    wrong: [
      [C.mul(PI_314), 'geo_circ_inverse'],
      [askR ? R(d) : R(d, 2), MIS.radiusDiameter.id],
    ],
    params: { kind: 'fromC', C: C.toNumber(), askR },
  });
}

function circleFromA(rng: Rng): Draft {
  const [thing, unit, lo, hi] = rng.pick([
    ['A circular trampoline', 'm', 2, 5],
    ['A round pizza', 'cm', 10, 20],
    ['A circle', 'cm', 2, 12],
  ] as const);
  const r = rng.int(lo, hi);
  const A = PI_314.mul(r * r);
  const askD = rng.chance(0.4);
  const ans = R(askD ? 2 * r : r);
  return measure([p(`${thing} has an area of ${nt(A)} ${sq(unit)}. Use 3.14 for π. What is its ${askD ? 'diameter' : 'radius'}?`)], ans, {
    unit,
    hints: ['Start from $$A = \\pi r^2$$ and undo each step in reverse order.', 'Divide by 3.14 to get $$r^2$$, then take the square root to get $$r$$.'],
    solution: [
      steps(
        { text: 'Divide the area by π to find the radius squared.', math: `r^2 = ${nl(A)} \\div 3.14 = ${r * r}` },
        { text: 'Take the square root to find the radius.', math: `r = \\sqrt{${r * r}} = ${r}${ul(unit)}` },
        ...(askD ? [{ text: 'The diameter is twice the radius.', math: `d = 2 \\times ${r} = ${2 * r}${ul(unit)}` }] : []),
      ),
    ],
    wrong: [
      [R(r * r), 'geo_circ_no_root'],
      [R(r * r, 2), 'geo_square_vs_double'],
      [R(askD ? r : 2 * r), MIS.radiusDiameter.id],
    ],
    params: { kind: 'fromA', A: A.toNumber(), askD },
  });
}

function circleSemi(rng: Rng): Draft {
  const d = rng.pick([4, 5, 6, 8, 10, 12, 14]);
  const r = R(d, 2);
  const full = PI.mul(r).mul(r);
  const ans = roundTo(full.div(2), 1);
  return measure([p(`A garden bed is shaped like a half circle. Its straight edge is ${d} m long, which is a diameter of the full circle. What is the area of the garden bed? ${piRule('key')}`)], ans, {
    unit: 'm²',
    tol: true,
    hints: ['Find the area of the full circle first. What is its radius?', `The radius is ${nt(r)} m. Find $$\\pi r^2$$, then take half of it.`],
    solution: [
      steps(
        { text: 'The radius is half the straight edge.', math: `r = ${d} \\div 2 = ${nl(r)}\\text{ m}` },
        { text: 'Area of the full circle.', math: `\\pi \\times ${nl(r)}^2 = ${longShow(full)}\\text{ m}^2` },
        { text: 'The garden bed is half of it. Round to the nearest tenth.', math: `A = ${longShow(full)} \\div 2 \\approx ${nl(ans)}\\text{ m}^2` },
      ),
    ],
    wrong: [
      [roundTo(full, 1), 'geo_semicircle_half'],
      [roundTo(PI.mul(d * d).div(2), 1), MIS.radiusDiameter.id],
      [roundTo(PI_314.mul(r).mul(r).div(2), 1), MIS.piApprox.id],
    ],
    params: { kind: 'semi', d },
  });
}

const C_CONTEXTS: ((rng: Rng) => { given: 'r' | 'd'; r: Rational; unit: string; text: string; times?: number })[] = [
  (rng) => {
    const d = rng.pick([50, 56, 60, 66, 70]);
    const n = rng.pick([10, 20, 25]);
    return { given: 'd', r: R(d, 2), unit: 'cm', times: n, text: `A bicycle wheel has a diameter of ${d} cm. How far does the bike move forward when the wheel turns ${n} times, in centimetres?` };
  },
  (rng) => {
    const r = rng.pick([45, 50, 55, 60, 75]);
    return { given: 'r', r: R(r), unit: 'cm', text: `A round table has a radius of ${r} cm. How much trim is needed to go once around its edge?` };
  },
  (rng) => {
    const r = rat(rng.pick([2, 2.5, 3, 3.5, 4, 4.5, 6]));
    return { given: 'r', r, unit: 'm', text: `A circular vegetable garden has a radius of ${nt(r)} m. How much fencing is needed to go once around it?` };
  },
  (rng) => {
    const d = rng.pick([70, 76, 80, 90, 100]);
    const who = rng.pick(NAMES);
    return { given: 'd', r: R(d, 2), unit: 'cm', text: `${who} wraps ribbon once around a hula hoop with a diameter of ${d} cm. How long is the ribbon?` };
  },
  (rng) => {
    const d = rng.pick([12, 15, 18, 24, 30]);
    return { given: 'd', r: R(d, 2), unit: 'm', text: `A skating path follows the edge of a frozen circular pond with a diameter of ${d} m. How long is one lap?` };
  },
];

const A_CONTEXTS: ((rng: Rng) => { given: 'r' | 'd'; r: Rational; unit: string; text: string })[] = [
  (rng) => {
    const d = rng.pick([25, 30, 35, 40]);
    return { given: 'd', r: R(d, 2), unit: 'cm', text: `A pizza has a diameter of ${d} cm. What is the area of its top?` };
  },
  (rng) => {
    const r = rat(rng.pick([3, 4, 5, 6, 7.5]));
    return { given: 'r', r, unit: 'm', text: `A lawn sprinkler sprays water in a full circle with a radius of ${nt(r)} m. What area of lawn does it water?` };
  },
  (rng) => {
    const d = rat(rng.pick([1.2, 1.5, 2, 2.5, 3]));
    return { given: 'd', r: d.div(2), unit: 'm', text: `A round rug has a diameter of ${nt(d)} m. What area of floor does it cover?` };
  },
  (rng) => {
    const r = rat(rng.pick([1.5, 2, 2.5, 3, 3.5]));
    return { given: 'r', r, unit: 'm', text: `A circular above-ground pool has a radius of ${nt(r)} m. What is the area of the water’s surface?` };
  },
  (rng) => {
    const d = rng.pick([36, 40, 46, 50]);
    return { given: 'd', r: R(d, 2), unit: 'cm', text: `A hand drum has a circular top with a diameter of ${d} cm. What is the area of the drum’s top?` };
  },
];

export const circles: SkillPack = {
  id: 'circles',
  title: 'Circles: circumference and area',
  subject: 'math',
  expectations: [
    {
      id: `${G7}:E2.3`,
      note: 'Uses d = 2r and C = πd (or C = 2πr) to find a circumference from a radius or diameter, including in word problems, and works backwards from a circumference to the diameter or radius. Measuring real objects with string to discover π is described in the lesson but not assessed.',
    },
    {
      id: `${G7}:E2.5`,
      note: 'Uses A = πr² to find the area of a circle from its radius or diameter, including half circles, and works backwards from an area to the radius or diameter. The cut-and-rearrange argument that explains the formula is shown in the lesson but not assessed.',
    },
  ],
  prerequisites: [],
  goal: 'I can use the radius or diameter of a circle to find its circumference and its area.',
  explain: (c) => {
    const area = c.expectationId.endsWith(':E2.5');
    return [
      p('The **radius** ($$r$$) goes from the centre of a circle to its edge. The **diameter** ($$d$$) goes all the way across through the centre, so it is two radii long: $$d = 2r$$.'),
      ...(area
        ? [
            p('The **area** is the space inside the circle. Cut a circle into many thin slices and line them up, point up, point down. They make a shape that is almost a parallelogram: its base is half the circumference ($$\\pi r$$) and its height is the radius ($$r$$). So the area is $$\\pi r \\times r$$.'),
            m('A = \\pi r^2'),
            steps({ text: 'A circle has a diameter of 10 cm. Find the radius.', math: 'r = 10 \\div 2 = 5\\text{ cm}' }, { text: 'Square the radius.', math: '5^2 = 25' }, { text: 'Multiply by π.', math: 'A = \\pi \\times 25 \\approx 78.5\\text{ cm}^2' }),
            warn('The area formula uses the **radius**. If you are given the diameter, halve it first. Area is in square units, like cm².'),
          ]
        : [
            p('The **circumference** ($$C$$) is the distance around the circle. For every circle, the circumference divided by the diameter is the same number, called **π** (pi). It is about 3.14, and its digits never end.'),
            m('C = \\pi d \\quad \\text{or} \\quad C = 2\\pi r'),
            steps({ text: 'A circle has a radius of 5 cm. Find the diameter.', math: 'd = 2 \\times 5 = 10\\text{ cm}' }, { text: 'Multiply by π.', math: 'C = \\pi \\times 10 \\approx 31.4\\text{ cm}' }),
            tip('Going backwards: if you know the circumference, divide by π to get the diameter.'),
          ]),
      c.simple
        ? p('Some questions say **use 3.14 for π**: multiply by 3.14 and do not round. Others say **use the π key**: use your calculator and round to the nearest tenth at the end.')
        : p('Read what each question says about π. **Use 3.14 for π** means multiply by 3.14 and give the exact result. **Use the π key** means use your calculator’s π button and round to the nearest tenth only at the end.'),
    ];
  },
  alternatives: (c) => ({
    simpler: [p(c.expectationId.endsWith(':E2.5') ? 'Area of a circle: radius × radius × π. Use the radius, not the diameter.' : 'Distance around a circle: diameter × π, which is a bit more than 3 diameters.')],
    visual: [circleDiagram(R(5), 'cm', 'radius'), circleDiagram(R(10), 'cm', 'diameter'), p('These are the same circle: a radius of 5 cm and a diameter of 10 cm.')],
    analogy: [p('Wrap a string around a can, then lay the string next to the can’s diameter. The string is always a little more than 3 diameters long, for any can. That “a little more than 3” is π.')],
    compare: [p('A square with sides as long as the radius has area $$r^2$$. A circle’s area is about 3.14 of those squares: $$\\pi r^2$$.')],
    example: [p('A plate has a diameter of 26 cm. Using 3.14 for π:'), m('C = 3.14 \\times 26 = 81.64\\text{ cm}'), m('r = 13\\text{ cm}, \\quad A = 3.14 \\times 13^2 = 3.14 \\times 169 = 530.66\\text{ cm}^2')],
  }),
  example: (rng, c) => {
    const r = rng.int(3, 15);
    const area = c.expectationId.endsWith(':E2.5');
    const v = area ? PI_314.mul(r * r) : PI_314.mul(2 * r);
    return [
      p(`A circle has a radius of ${r} cm. Find its ${area ? 'area' : 'circumference'}, using 3.14 for π.`),
      circleDiagram(R(r), 'cm', 'radius'),
      area
        ? steps({ text: 'Square the radius.', math: `${r}^2 = ${r * r}` }, { text: 'Multiply by 3.14.', math: `A = 3.14 \\times ${r * r} = ${nl(v)}\\text{ cm}^2` })
        : steps({ text: 'Double the radius to get the diameter.', math: `d = 2 \\times ${r} = ${2 * r}\\text{ cm}` }, { text: 'Multiply by 3.14.', math: `C = 3.14 \\times ${2 * r} = ${nl(v)}\\text{ cm}` }),
    ];
  },
  generate: (rng, d, c) => {
    const area = c.expectationId.endsWith(':E2.5');
    const what = area ? 'A' : 'C';
    if (d === 1) {
      if (rng.chance(0.65)) return circleRD(rng);
      return area ? circleFormulaMC(rng) : circleTF(rng);
    }
    if (d === 2) {
      const unit = rng.pick(['cm', 'm']);
      const r = rat(rng.pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 1.5, 2.5]));
      const given = rng.chance(0.5) ? 'r' : 'd';
      const dd = r.mul(2);
      const name = area ? 'area' : 'circumference';
      return circleMeasure({ what, given, r, mode: '314', unit, text: given === 'r' ? `A circle has a radius of ${nt(r)} ${unit}. What is its ${name}?` : `A circle has a diameter of ${nt(dd)} ${unit}. What is its ${name}?`, diagram: true });
    }
    if (d === 3) {
      const cx = area ? rng.pick(A_CONTEXTS)(rng) : rng.pick(C_CONTEXTS)(rng);
      return circleMeasure({ what, mode: 'key', ...cx });
    }
    if (area) return rng.chance(0.55) ? circleFromA(rng) : circleSemi(rng);
    return circleFromC(rng);
  },
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Params;
    const n = (k: string) => num(pr, k);
    const P = pr.mode === '314' ? 3.14 : Math.PI;
    switch (pr.kind) {
      case 'r2d':
        return near(q, n('given') * 2);
      case 'd2r':
        return near(q, n('given') / 2);
      case 'tf-rd':
        return q.type === 'true_false' && q.answer === (n('claimD') / n('r') === 2) ? null : 'true/false value is wrong';
      case 'formula': {
        const mm = /\\pi \\times (\d+)\^2/.exec(rightText(q));
        return mm && Number(mm[1]) === n('r') ? null : 'formula choice is wrong';
      }
      case 'C':
        return near(q, Math.PI === P ? n('r') * 2 * Math.PI * n('times') : 3.14 * 2 * n('r') * n('times'), pr.mode === 'key');
      case 'A':
        return near(q, P * n('r') ** 2, pr.mode === 'key');
      case 'fromC':
        return near(q, n('C') / 3.14 / (pr.askR ? 2 : 1));
      case 'fromA':
        return near(q, Math.sqrt(n('A') / 3.14) * (pr.askD ? 2 : 1));
      case 'semi':
        return near(q, (Math.PI * (n('d') / 2) ** 2) / 2, true);
      default:
        return 'unknown question kind';
    }
  },
  summary: ['The diameter is twice the radius: $$d = 2r$$.', 'Circumference (distance around): $$C = \\pi d = 2\\pi r$$.', 'Area (space inside): $$A = \\pi r^2$$, in square units. Use the radius, not the diameter.'],
  misconceptions: [
    MIS.radiusDiameter,
    MIS.circAreaFormula,
    MIS.piApprox,
    MIS.stoppedEarly,
    { id: 'geo_square_vs_double', label: 'Doubled instead of squaring', explanation: '$$r^2$$ means $$r \\times r$$, not $$r \\times 2$$. For a radius of 5, $$r^2 = 25$$, but $$5 \\times 2 = 10$$.', fix: 'Read the little 2 as “times itself”. Write the multiplication out before you calculate.' },
    { id: 'geo_circ_inverse', label: 'Multiplied by π instead of dividing', explanation: 'To go backwards from the circumference to the diameter, undo the multiplication by π.', fix: 'Since C = π × d, the diameter is d = C ÷ π. Check: the diameter should be about a third of the circumference.' },
    { id: 'geo_circ_no_root', label: 'Forgot the square root', explanation: 'Dividing the area by π gives r², the radius squared, not the radius.', fix: 'After dividing by π, take the square root to get r.' },
    { id: 'geo_semicircle_half', label: 'Forgot to halve for a half circle', explanation: 'A half circle covers only half the area of the full circle.', fix: 'Find the full circle’s area with $$\\pi r^2$$, then divide by 2.' },
  ],
};

// ═════════════════════════ Volume ═════════════════════════

const prismDiagram = (l: number, w: number, h: number, unit: string): Block => ({ kind: 'diagram', diagram: { type: 'prism', l, w, h, unit }, alt: `A rectangular prism ${nt(l)} ${unit} long, ${nt(w)} ${unit} wide and ${nt(h)} ${unit} high.` });

function volumeRect(l: Rational, w: Rational, h: Rational, unit: string, intro: string): Draft {
  const B = l.mul(w);
  const V = B.mul(h);
  return measure([p(intro), prismDiagram(l.toNumber(), w.toNumber(), h.toNumber(), unit)], V, {
    unit: cu(unit),
    hints: ['Volume = area of the base × height. The base here is a rectangle.', `The base has an area of $$${nl(l)} \\times ${nl(w)}$$. Multiply that by the height.`],
    solution: [steps({ text: 'Find the area of the rectangular base.', math: `B = ${nl(l)} \\times ${nl(w)} = ${nl(B)}${ul(sq(unit))}` }, { text: 'Multiply by the height.', math: `V = B \\times h = ${nl(B)} \\times ${nl(h)} = ${nl(V)}${ul(cu(unit))}` })],
    wrong: [
      [l.add(w).add(h), 'geo_vol_added'],
      [B, 'geo_vol_forgot_height'],
    ],
    params: { kind: 'rect', l: l.toNumber(), w: w.toNumber(), h: h.toNumber() },
  });
}

function volumePrismCyl(rng: Rng, d: number): Draft {
  if (d === 1) {
    if (rng.chance(0.5)) {
      const unit = rng.pick(['cm', 'm']);
      const [l, w, h] = [rng.int(2, 12), rng.int(2, 10), rng.int(2, 12)];
      return volumeRect(R(l), R(w), R(h), unit, `A rectangular prism is ${l} ${unit} long, ${w} ${unit} wide and ${h} ${unit} high. What is its volume?`);
    }
    const B = rng.int(6, 60);
    const h = rng.int(2, 15);
    return measure([p(`A prism has a base with an area of ${B} cm² and a height of ${h} cm. What is its volume?`)], R(B * h), {
      unit: 'cm³',
      hints: ['For any prism, volume = area of the base × height.', `Multiply ${B} by ${h}.`],
      solution: [m(`V = B \\times h = ${B} \\times ${h} = ${B * h}\\text{ cm}^3`)],
      wrong: [[R(B + h), 'geo_vol_added']],
      params: { kind: 'Bh', B, h },
    });
  }
  if (d === 2) {
    const mode = rng.pick(['tri', 'tri', 'dec', 'findH'] as const);
    if (mode === 'tri') {
      const b = rng.int(3, 12);
      const t = rng.int(3, 10);
      const L = rng.int(5, 20);
      const B = R(b * t, 2);
      const V = B.mul(L);
      return measure([p(`A triangular prism has a triangle for its base. The triangle has a base of ${b} cm and a height of ${t} cm. The prism is ${L} cm long (the distance between the two triangles). What is its volume?`)], V, {
        unit: 'cm³',
        hints: ['Volume = area of the base × the prism’s height. Here the base is the triangle and the prism’s height is its length.', `Area of the triangle: $$${b} \\times ${t} \\div 2$$. Then multiply by ${L}.`],
        solution: [steps({ text: 'Area of the triangular base.', math: `B = ${b} \\times ${t} \\div 2 = ${nl(B)}\\text{ cm}^2` }, { text: 'Multiply by the length of the prism.', math: `V = ${nl(B)} \\times ${L} = ${nl(V)}\\text{ cm}^3` })],
        wrong: [
          [R(b * t * L), MIS.areaNoHalf.id],
          [R(b + t + L), 'geo_vol_added'],
        ],
        params: { kind: 'triprism', b, t, L },
      });
    }
    if (mode === 'dec') {
      const l = rat(rng.pick([1.5, 2.5, 3.5, 4.5, 1.2, 0.8]));
      const w = R(rng.int(2, 5));
      const h = rat(rng.pick([1.5, 2, 2.5, 3]));
      return volumeRect(l, w, h, 'm', `A storage container is a rectangular prism ${nt(l)} m long, ${nt(w)} m wide and ${nt(h)} m high. What is its volume?`);
    }
    const B = rng.int(12, 60);
    const h = rng.int(3, 15);
    const V = B * h;
    return measure([p(`A prism has a volume of ${V} cm³. The area of its base is ${B} cm². What is its height?`)], R(h), {
      unit: 'cm',
      hints: ['Volume = area of the base × height. You know the volume and the base area.', `Ask: ${B} times what number gives ${V}?`],
      solution: [steps({ text: 'Start from the volume formula.', math: `${V} = ${B} \\times h` }, { text: 'Divide the volume by the base area.', math: `h = ${V} \\div ${B} = ${h}\\text{ cm}` })],
      wrong: [
        [R(V - B), 'geo_vol_inverse'],
        [R(V * B), 'geo_vol_inverse'],
      ],
      params: { kind: 'findH', V, B },
    });
  }
  if (d === 3) {
    if (rng.chance(0.6)) {
      const [text, given, rv, h, unit] = rng.pick([
        ['A juice can', 'd', rng.pick([6, 7, 8]), rng.pick([10, 11, 12, 15]), 'cm'],
        ['A cylindrical water tank', 'r', rng.pick([1, 1.5, 2]), rng.pick([2, 3, 4]), 'm'],
        ['A hockey puck', 'd', 7.6, 2.5, 'cm'],
        ['A cylindrical candle', 'd', rng.pick([5, 6, 8]), rng.pick([10, 12, 15]), 'cm'],
      ] as const);
      const r = given === 'r' ? rat(rv) : rat(rv).div(2);
      const H = rat(h);
      const base = PI_314.mul(r).mul(r);
      const V = base.mul(H);
      const dd = r.mul(2);
      return measure(
        [p(`${text} is a cylinder with a ${given === 'r' ? `radius of ${nt(r)}` : `diameter of ${nt(dd)}`} ${unit} and a height of ${nt(H)} ${unit}. What is its volume? Use 3.14 for π and do not round your answer.`), circleDiagram(given === 'r' ? r : dd, unit, given === 'r' ? 'radius' : 'diameter')],
        V,
        {
          unit: cu(unit),
          hints: ['A cylinder is like a prism with a circle for its base: volume = area of the base × height.', given === 'd' ? 'Halve the diameter to get the radius. The base area is $$3.14 \\times r^2$$.' : 'The base area is $$3.14 \\times r^2$$. Multiply it by the height.'],
          solution: [
            steps(
              ...(given === 'd' ? [{ text: 'Halve the diameter to get the radius.', math: `r = ${nl(dd)} \\div 2 = ${nl(r)}${ul(unit)}` }] : []),
              { text: 'Area of the circular base.', math: `B = 3.14 \\times ${nl(r)}^2 = 3.14 \\times ${nl(r.mul(r))} = ${nl(base)}${ul(sq(unit))}` },
              { text: 'Multiply by the height.', math: `V = ${nl(base)} \\times ${nl(H)} = ${nl(V)}${ul(cu(unit))}` },
            ),
          ],
          wrong: [
            [given === 'd' ? PI_314.mul(dd).mul(dd).mul(H) : null, MIS.radiusDiameter.id],
            [PI_314.mul(dd).mul(H), MIS.circAreaFormula.id],
          ],
          params: { kind: 'cyl', r: r.toNumber(), h: H.toNumber(), mode: '314' },
        },
      );
    }
    const l = rng.pick([20, 30, 40, 50, 60]);
    const w = rng.pick([15, 20, 25, 30]);
    const h = rng.int(10, 30);
    const V = l * w * h;
    return measure([p(`A rectangular planter box has a base that is ${l} cm by ${w} cm. It holds ${nt(V)} cm³ of soil when it is filled to the top. How deep is the planter?`)], R(h), {
      unit: 'cm',
      hints: ['Volume = area of the base × height. Find the area of the base first.', `The base area is $$${l} \\times ${w}$$. Divide the volume by it.`],
      solution: [steps({ text: 'Area of the base.', math: `B = ${l} \\times ${w} = ${nl(l * w)}\\text{ cm}^2` }, { text: 'Divide the volume by the base area.', math: `h = ${nl(V)} \\div ${nl(l * w)} = ${h}\\text{ cm}` })],
      wrong: [[R(V - l * w), 'geo_vol_inverse']],
      params: { kind: 'findH', V, B: l * w },
    });
  }
  const mode = rng.pick(['cylH', 'cylH', 'triL', 'base'] as const);
  if (mode === 'cylH') {
    const r = rng.int(2, 10);
    const h = rng.int(3, 20);
    const V = PI_314.mul(r * r * h);
    const base = PI_314.mul(r * r);
    return measure([p(`A cylindrical vase has an inside radius of ${r} cm and holds ${nt(V)} cm³ of water when full. Use 3.14 for π. How tall is the inside of the vase?`)], R(h), {
      unit: 'cm',
      hints: ['Volume = area of the base × height. Find the area of the circular base first.', `The base area is $$3.14 \\times ${r}^2$$. Divide the volume by it.`],
      solution: [steps({ text: 'Area of the circular base.', math: `B = 3.14 \\times ${r}^2 = ${nl(base)}\\text{ cm}^2` }, { text: 'Divide the volume by the base area.', math: `h = ${nl(V)} \\div ${nl(base)} = ${h}\\text{ cm}` })],
      wrong: [
        [V.div(PI_314.mul(4 * r * r)), MIS.radiusDiameter.id],
        [V.div(PI_314.mul(2 * r)), MIS.circAreaFormula.id],
      ],
      params: { kind: 'cylH', V: V.toNumber(), r },
    });
  }
  if (mode === 'triL') {
    const b = rng.pick([4, 6, 8, 10, 12]);
    const t = rng.int(3, 9);
    const L = rng.int(5, 25);
    const B = (b * t) / 2;
    const V = B * L;
    return measure([p(`A tent is shaped like a triangular prism. Each triangular end has a base of ${b} dm and a height of ${t} dm. The tent has a volume of ${nt(V)} dm³. How long is the tent (the distance between the two triangular ends)?`)], R(L), {
      unit: 'dm',
      hints: ['Volume = area of the triangular base × length. Find the area of a triangle end first.', `Triangle area: $$${b} \\times ${t} \\div 2$$. Divide the volume by it.`],
      solution: [steps({ text: 'Area of a triangular end.', math: `B = ${b} \\times ${t} \\div 2 = ${B}\\text{ dm}^2` }, { text: 'Divide the volume by the base area.', math: `L = ${nl(V)} \\div ${B} = ${L}\\text{ dm}` })],
      wrong: [[R(V, b * t), MIS.areaNoHalf.id]],
      params: { kind: 'triL', V, b, t },
    });
  }
  const B = rng.int(40, 300);
  const h = rng.int(12, 35);
  const V = B * h;
  return measure([p(`A cereal box is a rectangular prism with a volume of ${nt(V)} cm³ and a height of ${h} cm. What is the area of its base?`)], R(B), {
    unit: 'cm²',
    hints: ['Volume = area of the base × height. You know two of the three.', `Ask: what number times ${h} gives ${nt(V)}?`],
    solution: [m(`B = V \\div h = ${nl(V)} \\div ${h} = ${B}\\text{ cm}^2`)],
    wrong: [
      [R(V - h), 'geo_vol_inverse'],
      [R(V * h), 'geo_vol_inverse'],
    ],
    params: { kind: 'baseArea', V, h },
  });
}

function volumeThird(rng: Rng, d: number): Draft {
  if (d <= 2) {
    if (rng.chance(0.5)) {
      const cone = rng.chance(0.5);
      const [small, big] = cone ? ['cone', 'cylinder'] : ['pyramid', 'prism'];
      const toSmall = rng.chance(0.6);
      const k = rng.int(10, 300);
      const Vbig = 3 * k;
      const unit = cone ? 'mL' : 'cm³';
      if (toSmall) {
        return measure([p(`A ${small} and a ${big} have the same base and the same height. The ${big} holds ${nt(Vbig)} ${unit}. How much does the ${small} hold?`)], R(k), {
          unit,
          hints: [`Picture filling the ${big} using the ${small}. How many fills does it take?`, `It takes 3 fills, so the ${small} holds one third of the ${big}.`],
          solution: [p(`A ${small} has one third of the volume of a ${big} with the same base and height.`), m(`${nl(Vbig)} \\div 3 = ${nl(k)}`)],
          wrong: [
            [R(Vbig, 2), 'geo_vol_third'],
            [R(Vbig), 'geo_vol_third'],
            [R(Vbig * 3), 'geo_vol_third'],
          ],
          params: { kind: 'third', V: Vbig, dir: 'down' },
        });
      }
      return measure([p(`A ${small} and a ${big} have the same base and the same height. The ${small} holds ${nt(k)} ${unit}. How much does the ${big} hold?`)], R(Vbig), {
        unit,
        hints: [`Which holds more, the ${small} or the ${big}?`, `The ${big} holds 3 times as much as the ${small}.`],
        solution: [p(`A ${small} has one third of the volume of a ${big} with the same base and height, so the ${big} holds 3 times as much.`), m(`${nl(k)} \\times 3 = ${nl(Vbig)}`)],
        wrong: [
          [R(k, 3), 'geo_vol_third'],
          [R(k * 2), 'geo_vol_third'],
        ],
        params: { kind: 'third', V: k, dir: 'up' },
      });
    }
    const B = rng.int(4, 40);
    const h = 3 * rng.int(2, 8);
    const V = (B * h) / 3;
    return measure([p(`A pyramid has a base with an area of ${B} cm² and a height of ${h} cm. What is its volume?`)], R(V), {
      unit: 'cm³',
      hints: ['How does a pyramid compare with a prism that has the same base and height?', 'Find base area × height, then take one third of it.'],
      solution: [m(`V = \\tfrac{1}{3} \\times B \\times h = \\tfrac{1}{3} \\times ${B} \\times ${h} = ${V}\\text{ cm}^3`)],
      wrong: [
        [R(B * h), 'geo_vol_third'],
        [R(B * h, 2), 'geo_vol_third'],
      ],
      params: { kind: 'pyrB', B, h },
    });
  }
  if (d === 3) {
    if (rng.chance(0.5)) {
      const [text, unit, sv, hv] = rng.pick([
        ['A glass paperweight is a square-based pyramid. Its base is', 'cm', rng.int(4, 9), 3 * rng.int(2, 4)],
        ['A camping tent is a square-based pyramid. Its base is', 'm', rng.pick([2, 2.4, 3]), rng.pick([1.5, 1.8, 2.1])],
        ['A model of a pyramid is a square-based pyramid. Its base is', 'cm', rng.int(6, 15), 3 * rng.int(3, 6)],
      ] as const);
      const s = rat(sv);
      const h = rat(hv);
      const B = s.mul(s);
      const V = B.mul(h).div(3);
      return measure([p(`${text} ${nt(s)} ${unit} by ${nt(s)} ${unit}, and its height is ${nt(h)} ${unit}. What is its volume?`)], V, {
        unit: cu(unit),
        hints: ['A pyramid holds one third of a prism with the same base and height.', `The base is a square, so its area is $$${nl(s)} \\times ${nl(s)}$$. Multiply by the height, then divide by 3.`],
        solution: [steps({ text: 'Area of the square base.', math: `B = ${nl(s)} \\times ${nl(s)} = ${nl(B)}${ul(sq(unit))}` }, { text: 'One third of base area × height.', math: `V = \\tfrac{1}{3} \\times ${nl(B)} \\times ${nl(h)} = ${nl(V)}${ul(cu(unit))}` })],
        wrong: [
          [B.mul(h), 'geo_vol_third'],
          [s.mul(h).div(3), 'geo_vol_base_area'],
        ],
        params: { kind: 'sqPyr', s: s.toNumber(), h: h.toNumber() },
      });
    }
    const [text, given, rv, hv, unit, asMl] = rng.pick([
      ['A paper cup at a water fountain is a cone with a diameter of', 'd', rng.pick([7, 8]), rng.pick([9, 10]), 'cm', true],
      ['An ice cream cone has a diameter of', 'd', rng.pick([5, 6]), rng.pick([11, 12, 13]), 'cm', true],
      ['A pile of road salt is shaped like a cone with a diameter of', 'd', rng.pick([6, 8, 10]), rng.pick([2, 3]), 'm', false],
      ['A funnel is a cone with a radius of', 'r', rng.pick([4, 5, 6]), rng.pick([9, 12]), 'cm', true],
    ] as const);
    const r = given === 'r' ? rat(rv) : rat(rv).div(2);
    const h = rat(hv);
    const g = given === 'r' ? r : r.mul(2);
    const exact = PI.mul(r).mul(r).mul(h).div(3);
    const ans = roundTo(exact, 1);
    const u = asMl ? 'mL' : cu(unit);
    return measure([p(`${text} ${nt(g)} ${unit} and a height of ${nt(h)} ${unit}. ${asMl ? 'How many millilitres does it hold when full? (1 cm³ holds 1 mL.)' : 'What is its volume?'} ${piRule('key')}`), circleDiagram(g, unit, given === 'r' ? 'radius' : 'diameter')], ans, {
      unit: u,
      tol: true,
      hints: ['A cone holds one third of a cylinder with the same base and height.', `${given === 'd' ? 'Halve the diameter to get the radius. ' : ''}Find $$\\pi r^2 \\times h$$, then divide by 3.`],
      solution: [
        steps(
          ...(given === 'd' ? [{ text: 'Halve the diameter to get the radius.', math: `r = ${nl(g)} \\div 2 = ${nl(r)}${ul(unit)}` }] : []),
          { text: 'A cone is one third of the cylinder with the same base and height.', math: `V = \\tfrac{1}{3} \\times \\pi \\times ${nl(r)}^2 \\times ${nl(h)}` },
          { text: 'Calculate and round to the nearest tenth.', math: `V = ${longShow(exact)} \\approx ${nl(ans)}${asMl ? '\\text{ mL}' : ul(cu(unit))}` },
        ),
      ],
      wrong: [
        [roundTo(PI.mul(r).mul(r).mul(h), 1), 'geo_vol_third'],
        [given === 'd' ? roundTo(PI.mul(g).mul(g).mul(h).div(3), 1) : null, MIS.radiusDiameter.id],
        [roundTo(PI_314.mul(r).mul(r).mul(h).div(3), 1), MIS.piApprox.id],
      ],
      params: { kind: 'cone', r: r.toNumber(), h: h.toNumber() },
    });
  }
  const mode = rng.pick(['coneH', 'pyrH', 'funnel'] as const);
  if (mode === 'coneH') {
    const r = rng.int(2, 9);
    const k = rng.int(2, 8);
    const h = 3 * k;
    const V = PI_314.mul(r * r * k);
    const B = PI_314.mul(r * r);
    return measure([p(`A cone-shaped party hat has a radius of ${r} cm and a volume of ${nt(V)} cm³. Use 3.14 for π. How tall is the hat?`)], R(h), {
      unit: 'cm',
      hints: ['Start from $$V = \\tfrac{1}{3} \\times \\pi r^2 \\times h$$ and undo each step.', `Multiply the volume by 3, then divide by the base area $$3.14 \\times ${r}^2$$.`],
      solution: [steps({ text: 'Area of the circular base.', math: `B = 3.14 \\times ${r}^2 = ${nl(B)}\\text{ cm}^2` }, { text: 'Undo the one third: multiply the volume by 3.', math: `3 \\times ${nl(V)} = ${nl(V.mul(3))}` }, { text: 'Divide by the base area.', math: `h = ${nl(V.mul(3))} \\div ${nl(B)} = ${h}\\text{ cm}` })],
      wrong: [[R(k), 'geo_vol_third']],
      params: { kind: 'coneH', V: V.toNumber(), r },
    });
  }
  if (mode === 'pyrH') {
    const B = 3 * rng.int(4, 20);
    const h = rng.int(4, 20);
    const V = (B / 3) * h;
    return measure([p(`A pyramid has a volume of ${nt(V)} cm³ and a base with an area of ${B} cm². What is its height?`)], R(h), {
      unit: 'cm',
      hints: ['Start from $$V = \\tfrac{1}{3} \\times B \\times h$$.', 'Multiply the volume by 3 to undo the one third, then divide by the base area.'],
      solution: [steps({ text: 'Undo the one third.', math: `3 \\times ${nl(V)} = ${nl(3 * V)}` }, { text: 'Divide by the base area.', math: `h = ${nl(3 * V)} \\div ${B} = ${h}\\text{ cm}` })],
      wrong: [[R(V, B), 'geo_vol_third']],
      params: { kind: 'pyrH', V, B },
    });
  }
  const r = rng.pick([5, 10, 15, 20]);
  const k = rng.int(4, 10);
  const h = 3 * k;
  const Vcm = PI_314.mul(r * r * k);
  const L = Vcm.div(1000);
  return measure([p(`A cone-shaped funnel has a radius of ${r} cm and a height of ${h} cm. How many litres does it hold when full? Use 3.14 for π and do not round your answer.`), circleDiagram(R(r), 'cm', 'radius')], L, {
    unit: 'L',
    hints: ['Find the volume in cm³ first: one third of $$\\pi r^2 h$$.', '1 cm³ holds 1 mL, and 1000 mL make 1 L.'],
    solution: [
      steps(
        { text: 'Volume of the cone in cubic centimetres.', math: `V = \\tfrac{1}{3} \\times 3.14 \\times ${r}^2 \\times ${h} = ${nl(Vcm)}\\text{ cm}^3` },
        { text: '1 cm³ holds 1 mL.', math: `${nl(Vcm)}\\text{ cm}^3 = ${nl(Vcm)}\\text{ mL}` },
        { text: 'Divide by 1000 to change millilitres to litres.', math: `${nl(Vcm)} \\div 1000 = ${nl(L)}\\text{ L}` },
      ),
    ],
    wrong: [
      [Vcm, MIS.unitFactor.id],
      [Vcm.div(100), MIS.unitFactor.id],
      [L.mul(3), 'geo_vol_third'],
    ],
    params: { kind: 'funnel', r, h },
  });
}

export const volume: SkillPack = {
  id: 'volume',
  title: 'Volume of prisms, cylinders, pyramids and cones',
  subject: 'math',
  expectations: [
    {
      id: `${G7}:E2.7`,
      note: 'Finds the volume of rectangular prisms, triangular prisms and cylinders as area of the base × height, and finds the base area or the height when the other two measurements are given. Building prisms from layers of cubes is shown in the lesson but not assessed.',
    },
    {
      id: `${W}:E1.6`,
      note: 'Uses the relationship that a pyramid or cone holds one third of the prism or cylinder with the same base and height to find volumes and missing heights, including answers in mL and L. Surface area is not covered here.',
      levels: [2, 3, 4],
    },
  ],
  prerequisites: ['area-shapes', 'circles'],
  goal: 'I can find the volume of prisms and cylinders, and of pyramids and cones, from the area of the base and the height.',
  explain: (c) => [
    p('**Volume** is the amount of space an object takes up. It is measured in cubic units, like cm³ (the space of a cube 1 cm on each side).'),
    p('A prism or a cylinder has the same shape all the way through, like a stack of identical layers. The bottom layer is the **base**. So:'),
    m('V = (\\text{area of base}) \\times \\text{height}'),
    { kind: 'table', header: ['Base shape', 'Area of the base'], rows: [['Rectangle', '$$l \\times w$$'], ['Triangle', '$$b \\times h \\div 2$$'], ['Circle (cylinder)', '$$\\pi r^2$$']] },
    steps({ text: 'A box is 5 cm long, 4 cm wide and 3 cm high. Area of the base:', math: 'B = 5 \\times 4 = 20\\text{ cm}^2' }, { text: 'Multiply by the height.', math: 'V = 20 \\times 3 = 60\\text{ cm}^3' }),
    tip('The “height” of a prism is the distance between its two bases, even when the prism is lying on its side.'),
    ...(c.grade >= 9
      ? [
          p('A **pyramid** fits exactly 3 times into the prism with the same base and height, and a **cone** fits 3 times into the matching cylinder. So:'),
          m('V_{\\text{pyramid or cone}} = \\tfrac{1}{3} \\times (\\text{area of base}) \\times \\text{height}'),
          p('To work backwards to a height, undo the steps: multiply the volume by 3, then divide by the base area.'),
        ]
      : [p('To work backwards: if you know the volume and the base area, divide to find the height. If you know the volume and the height, divide to find the base area.')]),
  ],
  alternatives: (c) => ({
    simpler: [p(c.grade >= 9 ? 'Prism or cylinder: base area × height. Pyramid or cone: the same, then divide by 3.' : 'Find the area of the bottom. Multiply by how tall it is.')],
    visual: [prismDiagram(5, 4, 3, 'cm'), p('The bottom layer has 5 × 4 = 20 cubes. There are 3 layers, so 60 cubes: 60 cm³.')],
    analogy: [p('A stack of crackers is a prism: the volume is the area of one cracker times the height of the stack. A stack of coins is a cylinder in the same way.')],
    compare: [p('You already know area = length × width for a rectangle. Volume adds one more step: multiply that area by the height.')],
    ...(c.grade >= 9 ? { example: [p('A cylinder and a cone have the same base and height. The cylinder holds 600 mL of water. Pour from the cone three times to fill the cylinder: the cone holds $$600 \\div 3 = 200$$ mL.')] } : {}),
  }),
  example: (rng, c) => {
    if (c.grade >= 9) {
      const s = rng.int(3, 8);
      const h = 3 * rng.int(2, 5);
      return [p(`A square-based pyramid has a base ${s} cm by ${s} cm and a height of ${h} cm. Find its volume.`), steps({ text: 'Area of the base.', math: `B = ${s} \\times ${s} = ${s * s}\\text{ cm}^2` }, { text: 'One third of base area × height.', math: `V = \\tfrac{1}{3} \\times ${s * s} \\times ${h} = ${(s * s * h) / 3}\\text{ cm}^3` })];
    }
    const [l, w, h] = [rng.int(3, 9), rng.int(2, 6), rng.int(2, 8)];
    return [p(`Find the volume of a rectangular prism ${l} cm long, ${w} cm wide and ${h} cm high.`), prismDiagram(l, w, h, 'cm'), steps({ text: 'Area of the base.', math: `B = ${l} \\times ${w} = ${l * w}\\text{ cm}^2` }, { text: 'Multiply by the height.', math: `V = ${l * w} \\times ${h} = ${l * w * h}\\text{ cm}^3` })];
  },
  generate: (rng, d, c) => (c.expectationId.startsWith(`${W}:`) ? volumeThird(rng, d) : volumePrismCyl(rng, d)),
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Params;
    const n = (k: string) => num(pr, k);
    switch (pr.kind) {
      case 'rect':
        return near(q, n('l') * n('w') * n('h'));
      case 'Bh':
        return near(q, n('B') * n('h'));
      case 'triprism':
        return near(q, 0.5 * n('b') * n('t') * n('L'));
      case 'findH':
        return near(q, n('V') / n('B'));
      case 'cyl':
        return near(q, 3.14 * n('r') * n('r') * n('h'));
      case 'cylH':
        return near(q, n('V') / (3.14 * n('r') ** 2));
      case 'triL':
        return near(q, (2 * n('V')) / (n('b') * n('t')));
      case 'baseArea':
        return near(q, n('V') / n('h'));
      case 'third':
        return near(q, pr.dir === 'down' ? n('V') / 3 : n('V') * 3);
      case 'pyrB':
        return near(q, (n('B') * n('h')) / 3);
      case 'sqPyr':
        return near(q, (n('s') ** 2 * n('h')) / 3);
      case 'cone':
        return near(q, (Math.PI * n('r') ** 2 * n('h')) / 3, true);
      case 'coneH':
        return near(q, (3 * n('V')) / (3.14 * n('r') ** 2));
      case 'pyrH':
        return near(q, (3 * n('V')) / n('B'));
      case 'funnel':
        return near(q, (3.14 * n('r') ** 2 * n('h')) / 3 / 1000);
      default:
        return 'unknown question kind';
    }
  },
  summary: ['Prism or cylinder: volume = area of the base × height.', 'Pyramid or cone: one third of the prism or cylinder with the same base and height.', 'Work backwards by dividing: height = volume ÷ base area (multiply by 3 first for a pyramid or cone).'],
  misconceptions: [
    { id: 'geo_vol_added', label: 'Added the measurements', explanation: 'Volume counts cubes in layers, so the measurements are multiplied, not added.', fix: 'Find the area of the base (multiply), then multiply by the height.' },
    { id: 'geo_vol_forgot_height', label: 'Found the base area but not the volume', explanation: 'Length × width gives the area of one layer. The volume needs every layer.', fix: 'After finding the base area, multiply by the height (the number of layers).' },
    { id: 'geo_vol_inverse', label: 'Used the wrong operation to work backwards', explanation: 'Volume = base area × height, so to find a missing height or base area you divide.', fix: 'Write the formula with the numbers you know, then ask “what number times this gives the volume?”' },
    { id: 'geo_vol_third', label: 'Forgot the one third (or used it the wrong way)', explanation: 'A pyramid or cone holds exactly one third of the prism or cylinder with the same base and height, not one half and not the same amount.', fix: 'Small pointed shape: divide the prism or cylinder volume by 3. Going from the cone or pyramid to the cylinder or prism: multiply by 3.' },
    { id: 'geo_vol_base_area', label: 'Used a side length instead of the base area', explanation: 'The formula needs the area of the base. For a square base that is side × side.', fix: 'Find the base area first and write it down, then use it in the formula.' },
    MIS.radiusDiameter,
    MIS.circAreaFormula,
    MIS.piApprox,
    MIS.areaNoHalf,
    MIS.unitFactor,
  ],
};

// ═════════════════════════ Angles ═════════════════════════

const angleDiagram = (kind: 'supplementary' | 'complementary' | 'opposite', known: number): Block => ({
  kind: 'diagram',
  diagram: { type: 'angle_pair', kind, known, unknownLabel: 'x' },
  alt: kind === 'opposite' ? `Two straight lines crossing. One angle is ${known}° and the angle opposite it is labelled x.` : `Two angles side by side making a ${kind === 'complementary' ? 'right angle' : 'straight line'}. One is ${known}° and the other is labelled x.`,
});

function angleQ(prompt: Block[], ans: number, o: { hints: string[]; solution: Block[]; wrong: [number | null, string][]; params: Params; unit?: string }): Draft {
  return measure(prompt, R(ans), { unit: o.unit ?? '°', hints: o.hints, solution: o.solution, wrong: o.wrong.map(([v, mis]): Wrong => [v === null ? null : rat(v), mis]), params: o.params });
}

const deg = (n: number | Rational) => `${nl(n)}^\\circ`;
const POLY_NAME: Record<number, string> = { 3: 'triangle', 4: 'quadrilateral', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 12: 'dodecagon' };
const polyName = (n: number) => (POLY_NAME[n] ? `a ${POLY_NAME[n]}` : `a polygon with ${n} sides`);

function anglePair(rng: Rng, kind: 'supplementary' | 'complementary' | 'opposite'): Draft {
  const a = kind === 'complementary' ? rng.int(12, 78) : rng.int(25, 155);
  const ans = kind === 'complementary' ? 90 - a : kind === 'supplementary' ? 180 - a : a;
  const total = kind === 'complementary' ? 90 : 180;
  const text =
    kind === 'opposite'
      ? `Two straight lines cross. Angle $$x$$ is **opposite** the ${a}° angle. What is the size of angle $$x$$?`
      : `The two angles in the diagram are **${kind}**: together they make ${kind === 'complementary' ? 'a right angle (90°)' : 'a straight angle (180°)'}. One angle is ${a}°. What is the size of angle $$x$$?`;
  return angleQ([p(text), angleDiagram(kind, a)], ans, {
    hints:
      kind === 'opposite'
        ? ['Opposite angles are across from each other where two lines cross. How do their sizes compare?', 'Opposite angles are always equal.']
        : [`${kind === 'complementary' ? 'Complementary' : 'Supplementary'} angles add up to a fixed total. What is it?`, `Subtract: $$${total}^\\circ - ${a}^\\circ$$.`],
    solution:
      kind === 'opposite'
        ? [p('Opposite angles are equal. (Each one makes a straight line with the same neighbouring angle, so they must be the same size.)'), m(`x = ${deg(a)}`)]
        : [p(`${kind === 'complementary' ? 'Complementary' : 'Supplementary'} angles add up to ${total}°.`), m(`x = ${deg(total)} - ${deg(a)} = ${deg(ans)}`)],
    wrong: kind === 'complementary' ? [[180 - a, 'geo_angle_total']] : kind === 'supplementary' ? [[90 - a, 'geo_angle_total'], [360 - a, 'geo_angle_total']] : [[180 - a, 'geo_angle_opposite']],
    params: { kind: `pair-${kind}`, a },
  });
}

function angleTF(rng: Rng): Draft {
  const comp = rng.chance(0.5);
  const total = comp ? 90 : 180;
  const a = rng.int(15, total - 15);
  const mode = rng.pick(['true', 'true', 'other', 'near'] as const);
  let b = total - a;
  if (mode === 'other') b = comp ? 180 - a : a < 75 ? 90 - a : total - a + 10;
  if (mode === 'near') b = total - a + rng.pick([-10, -5, 5, 10]);
  const truth = a + b === total;
  const word = comp ? 'complementary' : 'supplementary';
  return trueFalse([p(`True or false: angles of ${a}° and ${b}° are ${word}.`)], truth, {
    hints: [`What total do ${word} angles make?`, `${comp ? 'Complementary' : 'Supplementary'} angles add up to exactly ${total}°. Add the two angles.`],
    solution: [m(`${deg(a)} + ${deg(b)} = ${deg(a + b)}`), p(`${comp ? 'Complementary' : 'Supplementary'} angles add up to ${total}°, so the statement is **${truth ? 'true' : 'false'}**.`)],
    misconception: 'geo_angle_total',
    params: { kind: 'tf-pair', a, b, total },
  });
}

function anglesG6(rng: Rng, d: number): Draft {
  if (d <= 1) return rng.chance(0.75) ? anglePair(rng, rng.pick(['complementary', 'supplementary', 'opposite'] as const)) : angleTF(rng);
  if (d === 2) {
    if (rng.chance(0.5)) {
      const a = rng.int(25, 100);
      const b = rng.int(20, 155 - a);
      const ans = 180 - a - b;
      return angleQ([p(`In $$\\triangle ABC$$, $$\\angle A = ${deg(a)}$$ and $$\\angle B = ${deg(b)}$$. What is the size of $$\\angle C$$?`)], ans, {
        hints: ['The three interior angles of every triangle add up to the same total. What is it?', 'Subtract both known angles from 180°.'],
        solution: [p('The interior angles of a triangle add up to 180°.'), m(`\\angle C = 180^\\circ - ${deg(a)} - ${deg(b)} = ${deg(ans)}`)],
        wrong: [
          [360 - a - b, 'geo_angle_total'],
          [a + b, 'geo_angle_exterior'],
        ],
        params: { kind: 'tri3', a, b },
      });
    }
    let x = rng.int(30, 150);
    if (x === 90) x = 95;
    return angleQ([p(`In $$\\triangle ABC$$, side $$BC$$ is extended past $$C$$ to a point $$D$$. The interior angle $$\\angle ACB$$ is ${x}°. What is the size of the exterior angle $$\\angle ACD$$?`)], 180 - x, {
      hints: ['The interior angle at C and the exterior angle at C sit side by side on the straight line BD.', 'Angles on a straight line add up to 180°.'],
      solution: [p('$$\\angle ACB$$ and $$\\angle ACD$$ together make the straight angle along BD, so they are supplementary.'), m(`\\angle ACD = 180^\\circ - ${deg(x)} = ${deg(180 - x)}`)],
      wrong: [
        [x, 'geo_angle_exterior'],
        [360 - x, 'geo_angle_total'],
      ],
      params: { kind: 'extAdj', x },
    });
  }
  const mode = rng.pick(['extRemote', 'extRemote', 'iso', 'line'] as const);
  if (mode === 'extRemote') {
    const a = rng.int(25, 80);
    const b = rng.int(25, 80);
    const c = 180 - a - b;
    return angleQ([p(`In $$\\triangle ABC$$, $$\\angle A = ${deg(a)}$$ and $$\\angle B = ${deg(b)}$$. Side $$BC$$ is extended past $$C$$ to a point $$D$$. What is the size of the exterior angle $$\\angle ACD$$?`)], a + b, {
      hints: ['First find the interior angle at C.', 'The exterior angle at C makes a straight line with the interior angle at C.'],
      solution: [
        steps(
          { text: 'Interior angle at C: the angles of a triangle add up to 180°.', math: `\\angle ACB = 180^\\circ - ${deg(a)} - ${deg(b)} = ${deg(c)}` },
          { text: 'The exterior angle is supplementary to it.', math: `\\angle ACD = 180^\\circ - ${deg(c)} = ${deg(a + b)}` },
        ),
        tip('Shortcut: an exterior angle of a triangle equals the sum of the two interior angles that are not next to it.'),
      ],
      wrong: [[c, 'geo_angle_exterior']],
      params: { kind: 'extRemote', a, b },
    });
  }
  if (mode === 'iso') {
    if (rng.chance(0.5)) {
      const apex = 2 * rng.int(10, 70);
      const each = (180 - apex) / 2;
      return angleQ([p(`An isosceles triangle has two equal angles. The third angle is ${apex}°. What is the size of each of the two equal angles?`)], each, {
        hints: ['All three angles add up to 180°. How much is left for the two equal angles together?', `Subtract ${apex}° from 180°, then share what is left equally between the two angles.`],
        solution: [steps({ text: 'What is left for the two equal angles together.', math: `180^\\circ - ${deg(apex)} = ${deg(180 - apex)}` }, { text: 'Split it equally.', math: `${deg(180 - apex)} \\div 2 = ${deg(each)}` })],
        wrong: [[180 - apex, 'geo_angle_isosceles']],
        params: { kind: 'isoBase', apex },
      });
    }
    const b = rng.int(25, 80);
    return angleQ([p(`An isosceles triangle has two equal angles of ${b}° each. What is the size of the third angle?`)], 180 - 2 * b, {
      hints: ['How many angles of the triangle do you know? Remember both equal angles.', `Subtract both ${b}° angles from 180°.`],
      solution: [m(`180^\\circ - ${deg(b)} - ${deg(b)} = ${deg(180 - 2 * b)}`)],
      wrong: [[180 - b, 'geo_angle_isosceles']],
      params: { kind: 'isoApex', b },
    });
  }
  if (rng.chance(0.5)) {
    const a = rng.int(20, 80);
    const b = rng.int(20, 160 - a);
    return angleQ([p(`Three angles sit side by side and together make a straight line. Two of them are ${a}° and ${b}°. What is the size of the third angle, $$x$$?`)], 180 - a - b, {
      hints: ['Angles that together make a straight line add up to what total?', 'Subtract both known angles from 180°.'],
      solution: [m(`x = 180^\\circ - ${deg(a)} - ${deg(b)} = ${deg(180 - a - b)}`)],
      wrong: [
        [360 - a - b, 'geo_angle_total'],
        [90 - a - b, 'geo_angle_total'],
      ],
      params: { kind: 'line', a, b },
    });
  }
  const a = rng.int(40, 120);
  const b = rng.int(40, 120);
  const c = rng.int(30, 300 - a - b);
  const ans = 360 - a - b - c;
  return angleQ([p(`Four angles meet at a point and fill the whole turn around it. Three of them are ${a}°, ${b}° and ${c}°. What is the size of the fourth angle, $$x$$?`)], ans, {
    hints: ['A full turn around a point is how many degrees?', 'Subtract the three known angles from 360°.'],
    solution: [m(`x = 360^\\circ - ${deg(a)} - ${deg(b)} - ${deg(c)} = ${deg(ans)}`)],
    wrong: [[180 - a - b - c, 'geo_angle_total']],
    params: { kind: 'point', a, b, c },
  });
}

const PARALLEL_DESC: Record<'corresponding' | 'alternate' | 'co-interior', string> = {
  corresponding: '**corresponding angles** (in matching positions where the transversal crosses each parallel line: an F-shape)',
  alternate: '**alternate angles** (on opposite sides of the transversal, between the parallel lines: a Z-shape)',
  'co-interior': '**co-interior angles** (on the same side of the transversal, between the parallel lines: a C-shape)',
};

/** Polygon angles that add up to (n − 2) × 180°, the last one unknown. */
function polygonAngles(rng: Rng, n: number): { known: number[]; x: number } {
  const total = (n - 2) * 180;
  const avg = Math.round(total / n);
  for (let i = 0; i < 60; i++) {
    const known = Array.from({ length: n - 1 }, () => rng.int(avg - 30, avg + 30));
    const x = total - known.reduce((s, v) => s + v, 0);
    if (x >= 60 && x <= 170) return { known, x };
  }
  const known = Array.from({ length: n - 1 }, () => avg);
  return { known, x: total - avg * (n - 1) };
}

function anglesG8(rng: Rng, d: number): Draft {
  if (d <= 2) {
    const mode = rng.pick(['parallel', 'parallel', 'parallel', 'tf', 'quad'] as const);
    if (mode === 'parallel') {
      const rel = rng.pick(['corresponding', 'alternate', 'co-interior', 'opposite'] as const);
      let a = rng.int(35, 145);
      if (a === 90) a = 100;
      const ans = rel === 'co-interior' ? 180 - a : a;
      if (rel === 'opposite') return anglePair(rng, 'opposite');
      return angleQ([p(`Two parallel lines are crossed by a transversal. Angle $$x$$ and the ${a}° angle are ${PARALLEL_DESC[rel]}. What is the size of angle $$x$$?`)], ans, {
        hints: [`Are ${rel} angles equal, or do they add up to 180°?`, rel === 'co-interior' ? 'Co-interior angles add up to 180°.' : `${rel === 'alternate' ? 'Alternate' : 'Corresponding'} angles are equal when the lines are parallel.`],
        solution: rel === 'co-interior' ? [p('Co-interior angles between parallel lines add up to 180°.'), m(`x = 180^\\circ - ${deg(a)} = ${deg(ans)}`)] : [p(`${rel === 'alternate' ? 'Alternate' : 'Corresponding'} angles formed with parallel lines are equal.`), m(`x = ${deg(a)}`)],
        wrong: [[rel === 'co-interior' ? a : 180 - a, 'geo_angle_parallel']],
        params: { kind: 'parallel', rel, a },
      });
    }
    if (mode === 'tf') {
      const rel = rng.pick(['corresponding', 'alternate', 'co-interior'] as const);
      const claim = rng.pick(['equal', 'sum'] as const);
      const truth = rel === 'co-interior' ? claim === 'sum' : claim === 'equal';
      return trueFalse([p(`True or false: when a transversal crosses two parallel lines, ${rel} angles ${claim === 'equal' ? 'are always equal' : 'always add up to 180°'}.`)], truth, {
        hints: ['Sketch two parallel lines and a slanted transversal, and mark the two angles.', 'Alternate and corresponding angles are equal. Co-interior angles add up to 180°.'],
        solution: [p(`${PARALLEL_DESC[rel].replace(/^\*\*(.)/, (_s, c: string) => `**${c.toUpperCase()}`)} ${rel === 'co-interior' ? 'always add up to 180°' : 'are always equal'} when the lines are parallel. So the statement is **${truth ? 'true' : 'false'}**.`)],
        misconception: 'geo_angle_parallel',
        params: { kind: 'tf-parallel', rel, claim },
      });
    }
    const { known, x } = polygonAngles(rng, 4);
    const sum = known.reduce((s, v) => s + v, 0);
    return angleQ([p(`A quadrilateral has angles of ${known.map((v) => `${v}°`).join(', ').replace(/, ([^,]*)$/, ' and $1')}. What is the size of its fourth angle?`)], x, {
      hints: ['What do the four angles of any quadrilateral add up to?', 'A quadrilateral can be cut into 2 triangles, so its angles add up to 360°.'],
      solution: [m(`360^\\circ - (${known.join(' + ')})^\\circ = 360^\\circ - ${deg(sum)} = ${deg(x)}`)],
      wrong: [
        [180 - sum, 'geo_angle_total'],
        [720 - sum, 'geo_polygon_sum'],
      ],
      params: { kind: 'polyMissing', n: 4, known: known.join(',') },
    });
  }
  if (d === 3) {
    if (rng.chance(0.4)) {
      const n = rng.pick([5, 6, 7, 8, 9, 10, 12]);
      const ans = (n - 2) * 180;
      return angleQ([p(`What is the sum of the interior angles of ${polyName(n)} (${n} sides)?`)], ans, {
        hints: ['Pick one corner and draw diagonals from it. How many triangles do you get?', `You get ${n - 2} triangles, and each one has angles adding up to 180°.`],
        solution: [p(`Diagonals from one vertex split a polygon with ${n} sides into ${n - 2} triangles.`), m(`(${n} - 2) \\times 180^\\circ = ${n - 2} \\times 180^\\circ = ${deg(ans)}`)],
        wrong: [
          [n * 180, 'geo_polygon_sum'],
          [(n - 1) * 180, 'geo_polygon_sum'],
          [360, 'geo_angle_total'],
        ],
        params: { kind: 'polySum', n },
      });
    }
    const n = rng.pick([5, 6]);
    const { known, x } = polygonAngles(rng, n);
    const sum = known.reduce((s, v) => s + v, 0);
    const total = (n - 2) * 180;
    return angleQ([p(`${polyName(n).replace(/^a/, 'A')} has ${n} interior angles. ${n - 1} of them measure ${known.map((v) => `${v}°`).join(', ').replace(/, ([^,]*)$/, ' and $1')}. What is the size of the last angle?`)], x, {
      hints: [`What do the interior angles of ${polyName(n)} add up to?`, `Use $$(n - 2) \\times 180^\\circ$$ with $$n = ${n}$$, then subtract the angles you know.`],
      solution: [steps({ text: 'Sum of the interior angles.', math: `(${n} - 2) \\times 180^\\circ = ${deg(total)}` }, { text: 'Subtract the known angles.', math: `${deg(total)} - ${deg(sum)} = ${deg(x)}` })],
      wrong: [
        [n * 180 - sum, 'geo_polygon_sum'],
        [360 - sum, 'geo_angle_total'],
      ],
      params: { kind: 'polyMissing', n, known: known.join(',') },
    });
  }
  const n = rng.pick([5, 6, 8, 9, 10, 12, 15, 18, 20]);
  const interior = ((n - 2) * 180) / n;
  const mode = rng.pick(['each', 'each', 'sides', 'ext'] as const);
  if (mode === 'each') {
    return angleQ([p(`What is the size of each interior angle of a regular ${POLY_NAME[n] ?? `polygon with ${n} sides`}${POLY_NAME[n] ? ` (${n} sides)` : ''}?`)], interior, {
      hints: ['A regular polygon has all its angles equal. Start with the sum of all the interior angles.', `The sum is $$(${n} - 2) \\times 180^\\circ$$. Share it equally among the ${n} angles.`],
      solution: [steps({ text: 'Sum of the interior angles.', math: `(${n} - 2) \\times 180^\\circ = ${deg((n - 2) * 180)}` }, { text: 'All the angles are equal, so divide by the number of angles.', math: `${deg((n - 2) * 180)} \\div ${n} = ${deg(interior)}` })],
      wrong: [
        [(n - 2) * 180, 'geo_polygon_each'],
        [360 / n, 'geo_polygon_exterior'],
      ],
      params: { kind: 'regInt', n },
    });
  }
  if (mode === 'sides') {
    const ext = 180 - interior;
    return angleQ([p(`Each interior angle of a regular polygon measures ${interior}°. How many sides does the polygon have?`)], n, {
      unit: 'sides',
      hints: ['Look at the exterior angle at each corner: it makes a straight line with the interior angle.', `Each exterior angle is $$180^\\circ - ${deg(interior)}$$. The exterior angles of any polygon add up to 360°.`],
      solution: [steps({ text: 'Each exterior angle.', math: `180^\\circ - ${deg(interior)} = ${deg(ext)}` }, { text: 'The exterior angles add up to 360°, so count how many fit.', math: `360^\\circ \\div ${deg(ext)} = ${n}` })],
      wrong: [[(360 * 1000) % (interior * 1000) === 0 ? 360 / interior : null, 'geo_polygon_exterior']],
      params: { kind: 'nFromInt', interior },
    });
  }
  return angleQ([p(`What is the size of each exterior angle of a regular ${POLY_NAME[n] ?? `polygon with ${n} sides`}${POLY_NAME[n] ? ` (${n} sides)` : ''}?`)], 360 / n, {
    hints: ['Walk around the polygon: at each corner you turn through the exterior angle. How far do you turn in total?', `One full turn is 360°, shared equally among ${n} corners.`],
    solution: [p('The exterior angles of any polygon add up to 360°. In a regular polygon they are all equal.'), m(`360^\\circ \\div ${n} = ${deg(360 / n)}`)],
    wrong: [
      [interior, 'geo_polygon_exterior'],
      [((n - 2) * 180) / 1, 'geo_polygon_each'],
    ],
    params: { kind: 'regExt', n },
  });
}

export const angles: SkillPack = {
  id: 'angles',
  title: 'Angle properties',
  subject: 'math',
  expectations: [
    {
      id: `${G6}:E2.3`,
      note: 'Finds unknown angles using complementary (90°), supplementary (180°) and opposite angles, the 180° sum of a triangle’s interior angles, angles on a line or around a point, and exterior angles of a triangle. Measuring with a protractor is not assessed.',
      levels: [1, 2, 3],
    },
    {
      id: `${G8}:E2.2`,
      note: 'Solves for unknown angles with intersecting lines and with parallel lines crossed by a transversal (alternate, corresponding and co-interior angles), using the (n − 2) × 180° sum of a polygon’s interior angles, and the interior and exterior angles of regular polygons. Writing formal proofs is not assessed.',
      levels: [2, 3, 4],
    },
  ],
  prerequisites: [],
  goal: 'I can use angle properties to calculate unknown angles without measuring.',
  explain: (c) => [
    p('You can often work out an angle instead of measuring it, by knowing what angles add up to.'),
    {
      kind: 'table',
      header: ['Situation', 'Fact'],
      rows: [
        ['Complementary angles', 'add up to 90°'],
        ['Supplementary angles (on a straight line)', 'add up to 180°'],
        ['Opposite angles (two lines crossing)', 'are equal'],
        ['Interior angles of a triangle', 'add up to 180°'],
        ['Angles around a point', 'add up to 360°'],
        ['Exterior angle of a triangle', 'makes 180° with the interior angle beside it'],
      ],
    },
    steps({ text: 'In a triangle, two angles are 50° and 70°. Add them.', math: '50^\\circ + 70^\\circ = 120^\\circ' }, { text: 'Subtract from 180°.', math: '180^\\circ - 120^\\circ = 60^\\circ' }),
    ...(c.grade >= 8
      ? [
          p('When a **transversal** crosses two **parallel** lines: corresponding angles (F-shape) are equal, alternate angles (Z-shape) are equal, and co-interior angles (C-shape) add up to 180°.'),
          p('A polygon with $$n$$ sides splits into $$n - 2$$ triangles from one corner, so its interior angles add up to $$(n - 2) \\times 180^\\circ$$. In a **regular** polygon all the angles are equal, so divide by $$n$$. Its exterior angles always add up to 360°.'),
        ]
      : []),
    c.simple ? tip('First ask: what should these angles add up to? Then subtract what you know.') : tip('Always ask: what total do these angles make, or are they equal? Then calculate.'),
  ],
  alternatives: (c) => ({
    simpler: [p('Corner of a square: 90°. Straight line: 180°. Triangle: 180°. Full turn: 360°. Subtract the angles you know from the total.')],
    visual: [angleDiagram('supplementary', 130), p('Together the two angles make a straight line, so $$x = 180^\\circ - 130^\\circ = 50^\\circ$$.'), angleDiagram('opposite', 70), p('Opposite angles are equal, so $$x = 70^\\circ$$.')],
    analogy: [p('A pizza cut through the centre: all the slice angles around the middle add up to a full turn, 360°. A straight cut across makes two halves of 180° each.')],
    steps: [steps({ text: 'Name the relationship (straight line? triangle? opposite? parallel lines?).' }, { text: 'Write the total or the equal angle.' }, { text: 'Subtract the known angles or copy the equal angle.' }, { text: 'Check that the answer looks right in a sketch.' })],
    ...(c.grade >= 8 ? { compare: [p('The angles of a triangle add up to 180°. A pentagon can be cut into 3 triangles, so its angles add up to $$3 \\times 180^\\circ = 540^\\circ$$.')] } : {}),
  }),
  example: (rng, c) => {
    if (c.grade >= 8) {
      const n = rng.pick([5, 6, 8, 10]);
      return [p(`Find each interior angle of a regular ${POLY_NAME[n]}.`), steps({ text: 'Sum of interior angles.', math: `(${n} - 2) \\times 180^\\circ = ${deg((n - 2) * 180)}` }, { text: 'Divide equally among the angles.', math: `${deg((n - 2) * 180)} \\div ${n} = ${deg(((n - 2) * 180) / n)}` })];
    }
    const a = rng.int(30, 80);
    const b = rng.int(30, 80);
    return [p(`A triangle has angles of ${a}° and ${b}°. Find the third angle.`), steps({ text: 'Add the known angles.', math: `${deg(a)} + ${deg(b)} = ${deg(a + b)}` }, { text: 'Subtract from 180°.', math: `180^\\circ - ${deg(a + b)} = ${deg(180 - a - b)}` })];
  },
  generate: (rng, d, c) => (c.grade >= 8 ? anglesG8(rng, d) : anglesG6(rng, d)),
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Params;
    const n = (k: string) => num(pr, k);
    const known = () =>
      String(pr.known ?? '')
        .split(',')
        .map(Number)
        .reduce((s, v) => s + v, 0);
    switch (pr.kind) {
      case 'pair-complementary':
        return near(q, 90 - n('a'));
      case 'pair-supplementary':
        return near(q, 180 - n('a'));
      case 'pair-opposite':
        return near(q, n('a'));
      case 'tf-pair':
        return q.type === 'true_false' && q.answer === (n('total') - n('a') === n('b')) ? null : 'true/false value is wrong';
      case 'tri3':
        return near(q, 180 - n('a') - n('b'));
      case 'extAdj':
        return near(q, 180 - n('x'));
      case 'extRemote':
        return near(q, 180 - (180 - n('a') - n('b')));
      case 'isoBase':
        return near(q, 90 - n('apex') / 2);
      case 'isoApex':
        return near(q, 180 - 2 * n('b'));
      case 'line':
        return near(q, 180 - n('a') - n('b'));
      case 'point':
        return near(q, 360 - n('a') - n('b') - n('c'));
      case 'parallel': {
        // A transversal makes two angle sizes, a and 180 − a; only co-interior pairs use both.
        return near(q, pr.rel === 'co-interior' ? 180 - n('a') : n('a'));
      }
      case 'tf-parallel': {
        const partner = pr.rel === 'co-interior' ? 110 : 70;
        const truth = pr.claim === 'equal' ? partner === 70 : 70 + partner === 180;
        return q.type === 'true_false' && q.answer === truth ? null : 'true/false value is wrong';
      }
      case 'polyMissing':
        return near(q, n('n') * 180 - 360 - known());
      case 'polySum':
        return near(q, n('n') * 180 - 360);
      case 'regInt':
        return near(q, 180 - 360 / n('n'));
      case 'nFromInt':
        return near(q, 360 / (180 - n('interior')));
      case 'regExt':
        return near(q, 180 - ((n('n') - 2) * 180) / n('n'));
      default:
        return 'unknown question kind';
    }
  },
  summary: ['Complementary angles make 90°; supplementary angles and angles on a straight line make 180°; angles around a point make 360°.', 'Opposite angles are equal. With parallel lines, alternate and corresponding angles are equal and co-interior angles make 180°.', 'Triangle angles add up to 180°; a polygon with n sides has interior angles adding up to (n − 2) × 180°.'],
  misconceptions: [
    { id: 'geo_angle_total', label: 'Used the wrong total', explanation: 'Each situation has its own total: complementary 90°, straight line or triangle 180°, quadrilateral or full turn 360°.', fix: 'Before calculating, say which situation it is and write its total at the top of your work.' },
    { id: 'geo_angle_opposite', label: 'Treated opposite angles as supplementary', explanation: 'Opposite angles (across from each other where two lines cross) are equal. Angles side by side on a line are the ones that add up to 180°.', fix: 'Across from each other: equal. Side by side on a straight line: add to 180°.' },
    { id: 'geo_angle_exterior', label: 'Mixed up an interior angle and an exterior angle', explanation: 'An exterior angle is outside the triangle, between one side and the extension of the next side. It makes a straight line (180°) with the interior angle beside it.', fix: 'Sketch the extended side and mark which angle is inside and which is outside the triangle.' },
    { id: 'geo_angle_isosceles', label: 'Did not share between the two equal angles', explanation: 'In an isosceles triangle, the two equal angles share what is left of the 180°, so each gets half.', fix: 'Subtract the known angle(s) from 180°. If two angles are still unknown and equal, divide by 2.' },
    { id: 'geo_angle_parallel', label: 'Mixed up equal and supplementary angles with parallel lines', explanation: 'Alternate (Z) and corresponding (F) angles are equal. Co-interior (C) angles, on the same side between the lines, add up to 180°.', fix: 'Trace the letter shape: Z or F means equal, C means add to 180°. Check that an acute angle and an obtuse angle are not called equal.' },
    { id: 'geo_polygon_sum', label: 'Used n × 180° for the angle sum', explanation: 'A polygon with n sides splits into n − 2 triangles from one corner, not n triangles.', fix: 'Use (n − 2) × 180°. Check with a square: (4 − 2) × 180° = 360°.' },
    { id: 'geo_polygon_each', label: 'Gave the total instead of one angle', explanation: 'In a regular polygon, the angle sum is shared equally among all the angles.', fix: 'After finding (n − 2) × 180°, divide by n to get each angle.' },
    { id: 'geo_polygon_exterior', label: 'Mixed up interior and exterior angles', explanation: 'At each corner, the interior angle and the exterior angle together make 180°. The exterior angles of a polygon add up to 360°.', fix: 'Interior = 180° − exterior. Exterior of a regular polygon = 360° ÷ n.' },
  ],
};

// ═════════════════════════ Areas of polygons ═════════════════════════

function areaQ(prompt: Block[], ans: Rational, unit: string, o: { hints: string[]; solution: Block[]; wrong: Wrong[]; params: Params; lengthAnswer?: boolean }): Draft {
  return measure(prompt, ans, { unit: o.lengthAnswer ? unit : sq(unit), hints: o.hints, solution: o.solution, wrong: o.wrong, params: o.params });
}

function areaBasic(rng: Rng): Draft {
  const unit = rng.pick(['cm', 'm']);
  const mode = rng.pick(['tri', 'tri', 'para', 'rect'] as const);
  if (mode === 'tri') {
    const b = rng.int(4, 20);
    const h = rng.int(3, 15);
    const A = R(b * h, 2);
    return areaQ([p(`A triangle has a base of ${b} ${unit} and a height of ${h} ${unit}. What is its area?`)], A, unit, {
      hints: ['A triangle is half of a rectangle with the same base and height.', `Multiply $$${b} \\times ${h}$$, then divide by 2.`],
      solution: [m(`A = b \\times h \\div 2 = ${b} \\times ${h} \\div 2 = ${nl(A)}${ul(sq(unit))}`)],
      wrong: [[R(b * h), MIS.areaNoHalf.id], [R(2 * (b + h)), 'geo_area_perimeter']],
      params: { kind: 'tri', b, h },
    });
  }
  if (mode === 'para') {
    const b = rng.int(5, 18);
    const h = rng.int(3, 12);
    const s = h + rng.int(1, 5);
    return areaQ([p(`A parallelogram has a base of ${b} ${unit}. Its slanted sides are ${s} ${unit} long, and its height (the perpendicular distance between the base and the opposite side) is ${h} ${unit}. What is its area?`)], R(b * h), unit, {
      hints: ['Cut a triangle off one end and slide it to the other end. What shape do you get?', 'You get a rectangle with the same base and the same height, so multiply the base by the height (not the slanted side).'],
      solution: [p('A parallelogram rearranges into a rectangle with the same base and height.'), m(`A = b \\times h = ${b} \\times ${h} = ${b * h}${ul(sq(unit))}`)],
      wrong: [
        [R(b * s), 'geo_area_slant'],
        [R(b * h, 2), MIS.areaNoHalf.id],
      ],
      params: { kind: 'para', b, h },
    });
  }
  const l = rng.int(4, 20);
  let w = rng.int(3, 15);
  if (w === l) w += 1;
  return areaQ([p(`A rectangle is ${l} ${unit} long and ${w} ${unit} wide. What is its area?`)], R(l * w), unit, {
    hints: ['Area counts the unit squares that cover the shape.', `Multiply the length by the width: $$${l} \\times ${w}$$.`],
    solution: [m(`A = l \\times w = ${l} \\times ${w} = ${l * w}${ul(sq(unit))}`)],
    wrong: [[R(2 * (l + w)), 'geo_area_perimeter']],
    params: { kind: 'rect', l, w },
  });
}

function trapezoidQ(a: Rational, b: Rational, h: Rational, unit: string, text: string, slant?: Rational): Draft {
  const sum = a.add(b);
  const A = sum.mul(h).div(2);
  return areaQ([p(text)], A, unit, {
    hints: ['Two copies of this trapezoid fit together to make a parallelogram. How long is its base?', `The parallelogram has base $$${nl(a)} + ${nl(b)}$$ and height ${nt(h)}; the trapezoid is half of it.`],
    solution: [
      steps(
        { text: 'Add the parallel sides.', math: `${nl(a)} + ${nl(b)} = ${nl(sum)}` },
        { text: 'Multiply by the height (the perpendicular distance, not the slanted side).', math: `${nl(sum)} \\times ${nl(h)} = ${nl(sum.mul(h))}` },
        { text: 'Halve it: the trapezoid is half of a parallelogram.', math: `A = ${nl(sum.mul(h))} \\div 2 = ${nl(A)}${ul(sq(unit))}` },
      ),
    ],
    wrong: [
      [sum.mul(h), MIS.areaNoHalf.id],
      [slant ? sum.mul(slant).div(2) : null, 'geo_area_slant'],
    ],
    params: { kind: 'trap', a: a.toNumber(), b: b.toNumber(), h: h.toNumber() },
  });
}

function diagonalsQ(d1: number, d2: number, unit: string, text: string): Draft {
  const A = R(d1 * d2, 2);
  return areaQ([p(text)], A, unit, {
    hints: ['The diagonals cut the shape into triangles. Picture the rectangle that fits around the shape, with sides as long as the diagonals.', `The shape fills exactly half of that ${d1} by ${d2} rectangle.`],
    solution: [p('The shape fills exactly half of the rectangle drawn around it, whose sides are the two diagonals.'), m(`A = d_1 \\times d_2 \\div 2 = ${d1} \\times ${d2} \\div 2 = ${nl(A)}${ul(sq(unit))}`)],
    wrong: [
      [R(d1 * d2), MIS.areaNoHalf.id],
      [R(d1 + d2), 'geo_area_perimeter'],
    ],
    params: { kind: 'kite', d1, d2 },
  });
}

function areaCore(rng: Rng): Draft {
  const unit = rng.pick(['cm', 'm']);
  const mode = rng.pick(['trap', 'trap', 'kite', 'rhombus'] as const);
  if (mode === 'trap') {
    const a = rng.int(3, 12);
    const b = a + rng.int(2, 8);
    const h = rng.int(3, 10);
    const withSlant = rng.chance(0.5);
    const s = h + rng.int(1, 3);
    return trapezoidQ(
      R(a),
      R(b),
      R(h),
      unit,
      `A trapezoid has parallel sides of ${a} ${unit} and ${b} ${unit}. The height (the perpendicular distance between the parallel sides) is ${h} ${unit}.${withSlant ? ` Each slanted side is about ${s} ${unit} long.` : ''} What is its area?`,
      withSlant ? R(s) : undefined,
    );
  }
  if (mode === 'kite') {
    const d1 = rng.int(4, 16);
    const d2 = rng.int(4, 16);
    return diagonalsQ(d1, d2, unit, `A kite has diagonals of ${d1} ${unit} and ${d2} ${unit}. What is its area?`);
  }
  if (rng.chance(0.5)) {
    const d1 = rng.int(4, 16);
    const d2 = rng.int(4, 16);
    return diagonalsQ(d1, d2, unit, `A rhombus has diagonals of ${d1} ${unit} and ${d2} ${unit}. What is its area?`);
  }
  const s = rng.int(5, 15);
  const h = rng.int(3, s - 1);
  return areaQ([p(`A rhombus has sides of ${s} ${unit}. The height (the perpendicular distance between two opposite sides) is ${h} ${unit}. What is its area?`)], R(s * h), unit, {
    hints: ['A rhombus is a parallelogram with all four sides equal. How do you find the area of a parallelogram?', 'Base × height, where the height is the perpendicular distance, not the slanted side.'],
    solution: [p('A rhombus is a parallelogram, so its area is base × height.'), m(`A = ${s} \\times ${h} = ${s * h}${ul(sq(unit))}`)],
    wrong: [
      [R(s * s), 'geo_area_slant'],
      [R(s * h, 2), MIS.areaNoHalf.id],
    ],
    params: { kind: 'rhombusBH', s, h },
  });
}

function areaComposite(rng: Rng): Draft {
  const mode = rng.pick(['L', 'house', 'garden', 'frame'] as const);
  if (mode === 'L') {
    const L = rng.int(8, 16);
    const Wd = rng.int(6, 12);
    const l = rng.int(2, L - 3);
    const w = rng.int(2, Wd - 2);
    const A = L * Wd - l * w;
    return areaQ([p(`The floor of a room is shaped like a ${L} m by ${Wd} m rectangle with a ${l} m by ${w} m rectangle cut out of one corner. What is the area of the floor?`)], R(A), 'm', {
      hints: ['Find the area of the big rectangle as if nothing were cut out.', 'Then take away the area of the corner piece that is missing.'],
      solution: [steps({ text: 'Area of the full rectangle.', math: `${L} \\times ${Wd} = ${L * Wd}\\text{ m}^2` }, { text: 'Area of the missing corner.', math: `${l} \\times ${w} = ${l * w}\\text{ m}^2` }, { text: 'Subtract.', math: `${L * Wd} - ${l * w} = ${A}\\text{ m}^2` })],
      wrong: [
        [R(L * Wd + l * w), 'geo_area_composite_add'],
        [R(L * Wd), MIS.stoppedEarly.id],
      ],
      params: { kind: 'Lcut', L, W: Wd, l, w },
    });
  }
  if (mode === 'house') {
    const w = rng.int(4, 12);
    const h = rng.int(3, 8);
    const t = rng.int(2, 6);
    const A = R(w * h).add(R(w * t, 2));
    return areaQ([p(`The front of a birdhouse is a rectangle ${w} cm wide and ${h} cm tall, with a triangle on top. The triangle has the same ${w} cm base and a height of ${t} cm. What is the total area of the front?`)], A, 'cm', {
      hints: ['Split the shape into two parts you know: a rectangle and a triangle.', `Rectangle: $$${w} \\times ${h}$$. Triangle: $$${w} \\times ${t} \\div 2$$. Add them.`],
      solution: [steps({ text: 'Area of the rectangle.', math: `${w} \\times ${h} = ${w * h}\\text{ cm}^2` }, { text: 'Area of the triangle.', math: `${w} \\times ${t} \\div 2 = ${nl(R(w * t, 2))}\\text{ cm}^2` }, { text: 'Add the parts.', math: `${w * h} + ${nl(R(w * t, 2))} = ${nl(A)}\\text{ cm}^2` })],
      wrong: [
        [R(w * h + w * t), MIS.areaNoHalf.id],
        [R(w * h), MIS.stoppedEarly.id],
      ],
      params: { kind: 'house', w, h, t },
    });
  }
  if (mode === 'garden') {
    const a = rat(rng.pick([3, 3.5, 4, 4.5, 5]));
    const b = a.add(rng.pick([1.5, 2, 2.5, 3]));
    const h = rat(rng.pick([2, 2.5, 3, 4]));
    const who = rng.pick(NAMES);
    return trapezoidQ(a, b, h, 'm', `${who}’s school garden is shaped like a trapezoid. Its parallel sides are ${nt(a)} m and ${nt(b)} m long, and they are ${nt(h)} m apart. How much area is there for planting?`);
  }
  const L = rng.int(6, 12);
  const Wd = rng.int(4, 8);
  const pw = rng.pick([1, 2]);
  const outer = (L + 2 * pw) * (Wd + 2 * pw);
  const A = outer - L * Wd;
  return areaQ([p(`A rectangular pool is ${L} m by ${Wd} m. A path ${pw} m wide goes all the way around it. What is the area of the path?`)], R(A), 'm', {
    hints: ['The pool and path together make a bigger rectangle. How long and wide is it? The path adds its width on both sides.', `The big rectangle is ${L + 2 * pw} m by ${Wd + 2 * pw} m. Take away the pool.`],
    solution: [
      steps(
        { text: 'Size of the pool plus path: add the path width on both sides.', math: `(${L} + 2 \\times ${pw}) \\times (${Wd} + 2 \\times ${pw}) = ${L + 2 * pw} \\times ${Wd + 2 * pw} = ${outer}\\text{ m}^2` },
        { text: 'Area of the pool.', math: `${L} \\times ${Wd} = ${L * Wd}\\text{ m}^2` },
        { text: 'Path = big rectangle − pool.', math: `${outer} - ${L * Wd} = ${A}\\text{ m}^2` },
      ),
    ],
    wrong: [
      [R(outer), MIS.stoppedEarly.id],
      [R((L + pw) * (Wd + pw) - L * Wd), 'geo_area_path_once'],
    ],
    params: { kind: 'frame', L, W: Wd, pw },
  });
}

function areaBackwards(rng: Rng): Draft {
  if (rng.chance(0.5)) {
    const a = rng.int(3, 10);
    const b = a + rng.int(2, 8);
    const h = rng.int(2, 12);
    const A = R((a + b) * h, 2);
    return areaQ([p(`A trapezoid has an area of ${nt(A)} cm². Its parallel sides are ${a} cm and ${b} cm. What is its height?`)], R(h), 'cm', {
      lengthAnswer: true,
      hints: ['Start from the formula: area = (sum of parallel sides) × height ÷ 2.', `Undo the steps: double the area, then divide by $$${a} + ${b}$$.`],
      solution: [steps({ text: 'Undo the halving: double the area.', math: `2 \\times ${nl(A)} = ${(a + b) * h}` }, { text: 'Divide by the sum of the parallel sides.', math: `h = ${(a + b) * h} \\div (${a} + ${b}) = ${(a + b) * h} \\div ${a + b} = ${h}\\text{ cm}` })],
      wrong: [[A.div(a + b), MIS.areaNoHalf.id]],
      params: { kind: 'trapH', A: A.toNumber(), a, b },
    });
  }
  const d1 = rng.int(4, 16);
  const d2 = rng.int(4, 16);
  const A = R(d1 * d2, 2);
  return areaQ([p(`A kite has an area of ${nt(A)} cm². One of its diagonals is ${d1} cm long. How long is the other diagonal?`)], R(d2), 'cm', {
    lengthAnswer: true,
    hints: ['Area of a kite = one diagonal × the other diagonal ÷ 2.', 'Double the area to undo the ÷ 2, then divide by the diagonal you know.'],
    solution: [steps({ text: 'Undo the halving.', math: `2 \\times ${nl(A)} = ${d1 * d2}` }, { text: 'Divide by the known diagonal.', math: `${d1 * d2} \\div ${d1} = ${d2}\\text{ cm}` })],
    wrong: [[A.div(d1), MIS.areaNoHalf.id]],
    params: { kind: 'kiteD', A: A.toNumber(), d1 },
  });
}

export const areaShapes: SkillPack = {
  id: 'area-shapes',
  title: 'Areas of trapezoids, rhombuses, kites and composite shapes',
  subject: 'math',
  expectations: [
    {
      id: `${G6}:E2.4`,
      note: 'Finds the areas of trapezoids, rhombuses, kites and composite polygons by decomposing them into rectangles, parallelograms and triangles (or with the formulas those decompositions give), and works backwards to a missing height or diagonal. Drawing the decomposition is modelled in the lesson; only the resulting area is assessed.',
    },
  ],
  prerequisites: [],
  goal: 'I can find the area of trapezoids, rhombuses, kites and composite shapes by breaking them into shapes I know.',
  explain: (c) => [
    p('**Area** is the number of unit squares that cover a shape, measured in square units like cm² or m². You can find the area of a new shape by cutting it into shapes you already know, or by fitting it inside a shape you know.'),
    { kind: 'table', header: ['Shape', 'How to think about it', 'Area'], rows: [
      ['Rectangle', 'rows of unit squares', '$$l \\times w$$'],
      ['Parallelogram', 'slide a triangle across to make a rectangle', '$$b \\times h$$'],
      ['Triangle', 'half of a parallelogram', '$$b \\times h \\div 2$$'],
      ['Trapezoid', 'two copies make a parallelogram', '$$(a + b) \\times h \\div 2$$'],
      ['Kite or rhombus', 'half of the rectangle around its diagonals', '$$d_1 \\times d_2 \\div 2$$'],
    ] },
    p('The **height** is always the perpendicular (square-corner) distance, not a slanted side.'),
    steps({ text: 'Composite shape: split it into rectangles and triangles (or take a piece away from a bigger rectangle).' }, { text: 'Find each part’s area.' }, { text: 'Add the parts (or subtract the missing piece).' }),
    c.simple ? tip('Cut the shape into pieces you know. Add up the pieces.') : tip('Check with an estimate: a trapezoid’s area is between the areas of the rectangles made with its shorter and its longer parallel side.'),
  ],
  alternatives: () => ({
    simpler: [p('Triangles, trapezoids and kites all have “÷ 2” in their area, because each one is half of a rectangle or parallelogram.')],
    visual: [{ kind: 'diagram', diagram: { type: 'area_model', rows: 4, cols: 6, shadedRows: 4, shadedCols: 3 }, alt: 'A 6 by 4 rectangle of 24 unit squares with half (12 squares) shaded. A triangle with base 6 and height 4 covers the same area as the shaded half.' }, p('A triangle with base 6 and height 4 covers half of the 6 by 4 rectangle: $$24 \\div 2 = 12$$ square units.')],
    analogy: [p('Think of tiling a floor. For an L-shaped room, you count the tiles in two rectangular parts and add them, or count a full rectangle and take away the tiles that are missing.')],
    steps: [p('Trapezoid with parallel sides 4 cm and 8 cm, height 3 cm:'), steps({ text: 'Add the parallel sides.', math: '4 + 8 = 12' }, { text: 'Multiply by the height.', math: '12 \\times 3 = 36' }, { text: 'Halve.', math: '36 \\div 2 = 18\\text{ cm}^2' })],
    compare: [p('You already know a rectangle: $$l \\times w$$. A parallelogram is a “pushed-over” rectangle with the same base and height, so it has the same area.')],
  }),
  example: (rng) => {
    const a = rng.int(3, 8);
    const b = a + rng.int(2, 6);
    const h = rng.int(2, 8);
    return [
      p(`Find the area of a trapezoid with parallel sides ${a} cm and ${b} cm and a height of ${h} cm.`),
      steps({ text: 'Add the parallel sides.', math: `${a} + ${b} = ${a + b}` }, { text: 'Multiply by the height.', math: `${a + b} \\times ${h} = ${(a + b) * h}` }, { text: 'Halve: two of these trapezoids make a parallelogram.', math: `${(a + b) * h} \\div 2 = ${nl(R((a + b) * h, 2))}\\text{ cm}^2` }),
    ];
  },
  generate: (rng, d) => (d === 1 ? areaBasic(rng) : d === 2 ? areaCore(rng) : d === 3 ? areaComposite(rng) : rng.chance(0.4) ? areaComposite(rng) : areaBackwards(rng)),
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Params;
    const n = (k: string) => num(pr, k);
    switch (pr.kind) {
      case 'tri':
        return near(q, (n('b') * n('h')) / 2);
      case 'para':
        return near(q, n('b') * n('h'));
      case 'rect':
        return near(q, n('l') * n('w'));
      case 'rhombusBH':
        return near(q, n('s') * n('h'));
      case 'trap': {
        // Decompose into a rectangle on the shorter side plus the leftover triangles.
        const lo = Math.min(n('a'), n('b'));
        const hi = Math.max(n('a'), n('b'));
        return near(q, lo * n('h') + ((hi - lo) * n('h')) / 2);
      }
      case 'kite':
        return near(q, 2 * ((n('d1') * (n('d2') / 2)) / 2));
      case 'Lcut':
        return near(q, (n('L') - n('l')) * n('W') + n('l') * (n('W') - n('w')));
      case 'house':
        return near(q, n('w') * (n('h') + n('t') / 2));
      case 'frame':
        return near(q, 2 * n('pw') * (n('L') + 2 * n('pw')) + 2 * n('pw') * n('W'));
      case 'trapH':
        return near(q, (2 * n('A')) / (n('a') + n('b')));
      case 'kiteD':
        return near(q, (2 * n('A')) / n('d1'));
      default:
        return 'unknown question kind';
    }
  },
  summary: ['Area is measured in square units; the height is always a perpendicular distance.', 'Triangle $$b \\times h \\div 2$$, trapezoid $$(a + b) \\times h \\div 2$$, kite or rhombus $$d_1 \\times d_2 \\div 2$$.', 'For a composite shape, split it into known shapes and add, or subtract a missing piece from a bigger shape.'],
  misconceptions: [
    MIS.areaNoHalf,
    MIS.stoppedEarly,
    { id: 'geo_area_slant', label: 'Used a slanted side as the height', explanation: 'The height is the perpendicular (square-corner) distance between the base and the opposite side. A slanted side is longer than the height.', fix: 'Look for the length that meets the base at a right angle. Ignore slanted side lengths when finding area.' },
    { id: 'geo_area_perimeter', label: 'Found the perimeter instead of the area', explanation: 'Perimeter adds up the lengths around the outside. Area counts the squares inside.', fix: 'Area questions need multiplying and give square units, like cm².' },
    { id: 'geo_area_composite_add', label: 'Added a piece that should be taken away', explanation: 'When part of a rectangle is cut out, that part is no longer in the shape, so its area is subtracted.', fix: 'Ask: is this piece part of the shape or missing from it? Add pieces that are there; subtract pieces that are missing.' },
    { id: 'geo_area_path_once', label: 'Added the path width on only one side', explanation: 'A path that goes all the way around adds its width at both ends of the length and both ends of the width.', fix: 'Sketch the path. The outer length is the pool length plus 2 path widths, and the same for the width.' },
  ],
};

// ═════════════════════════ Metric units ═════════════════════════

const FACTOR: Record<string, number> = { mm: 1, cm: 10, m: 1000, km: 1000000, mg: 1, g: 1000, kg: 1000000, mL: 1, L: 1000 };
const EXP10: Record<string, number> = { mm: -3, cm: -2, m: 0, km: 3, mg: -3, g: 0, kg: 3, mL: -3, L: 0 };
const UNIT_WORD: Record<string, string> = { mm: 'millimetres', cm: 'centimetres', m: 'metres', km: 'kilometres', mg: 'milligrams', g: 'grams', kg: 'kilograms', mL: 'millilitres', L: 'litres' };
const UNIT_ONE: Record<string, string> = { mm: 'millimetre', cm: 'centimetre', m: 'metre', km: 'kilometre', mg: 'milligram', g: 'gram', kg: 'kilogram', mL: 'millilitre', L: 'litre' };

/** Conversion between two units of the same kind, with the fact used and the direction made explicit. */
function convert(v: Rational, from: string, to: string, prompt: Block[]): Draft {
  const ratio = R(FACTOR[from] ?? 1, FACTOR[to] ?? 1);
  const ans = v.mul(ratio);
  const down = ratio.cmp(1) > 0;
  const f = down ? ratio : ratio.pow(-1);
  const fact = down ? `1 ${from} = ${nt(f)} ${to}` : `1 ${to} = ${nt(f)} ${from}`;
  return measure(prompt, ans, {
    unit: to,
    hints: [`Which is bigger: a ${UNIT_ONE[from]} or a ${UNIT_ONE[to]}? So should your answer be a bigger or a smaller number?`, `Use ${fact}, so ${down ? 'multiply' : 'divide'} by ${nt(f)}.`],
    solution: [
      steps(
        { text: `Use the fact ${fact}.` },
        { text: down ? `A ${UNIT_ONE[to]} is smaller, so there will be more of them: multiply by ${nt(f)}.` : `A ${UNIT_ONE[to]} is bigger, so there will be fewer of them: divide by ${nt(f)}.`, math: `${nl(v)} ${down ? '\\times' : '\\div'} ${nl(f)} = ${nl(ans)}${ul(to)}` },
      ),
    ],
    wrong: [
      [v.div(ratio), MIS.unitDirection.id],
      [ans.mul(10), MIS.unitFactor.id],
      [ans.div(10), MIS.unitFactor.id],
    ],
    params: { kind: 'conv', v: v.toNumber(), from, to },
  });
}

const PAIRS: [string, string][] = [
  ['m', 'cm'],
  ['cm', 'mm'],
  ['m', 'mm'],
  ['km', 'm'],
  ['kg', 'g'],
  ['g', 'mg'],
  ['L', 'mL'],
];

function unitsG6(rng: Rng, d: number): Draft {
  if (d <= 2) {
    const [big, small] = rng.pick(PAIRS);
    const ratio = (FACTOR[big] ?? 1) / (FACTOR[small] ?? 1);
    const down = rng.chance(0.5);
    let v: Rational;
    if (d === 1) v = down ? R(rng.int(2, 15)) : R(rng.int(2, 9) * ratio);
    else v = down ? rat(rng.pick([1.25, 2.4, 0.6, 3.75, 0.08, 4.5, 0.35])) : R(rng.pick([450, 75, 1250, 380, 2600, 35, 8]));
    const [from, to] = down ? [big, small] : [small, big];
    return convert(v, from, to, [p(`Convert ${nt(v)} ${from} to ${UNIT_WORD[to]}.`)]);
  }
  const mode = rng.pick(['compare', 'ribbon', 'mass', 'laps'] as const);
  const who = rng.pick(NAMES);
  if (mode === 'compare') {
    const aL = rat(rng.pick([1.2, 1.5, 1.75, 2, 2.25]));
    const bmL = aL.mul(1000).add(rng.pick([-350, -250, -150, 150, 250, 400]));
    const diff = aL.mul(1000).sub(bmL).abs();
    return measure([p(`A water bottle holds ${nt(aL)} L. A thermos holds ${nt(bmL)} mL. How many more millilitres does the larger container hold?`)], diff, {
      unit: 'mL',
      hints: ['The two amounts are in different units. Change them to the same unit first.', `1 L = 1000 mL, so ${nt(aL)} L = $$${nl(aL)} \\times 1000$$ mL.`],
      solution: [steps({ text: 'Change litres to millilitres.', math: `${nl(aL)}\\text{ L} = ${nl(aL)} \\times 1000 = ${nl(aL.mul(1000))}\\text{ mL}` }, { text: 'Subtract the smaller amount from the larger one.', math: `${nl(aL.mul(1000).cmp(bmL) > 0 ? aL.mul(1000) : bmL)} - ${nl(aL.mul(1000).cmp(bmL) > 0 ? bmL : aL.mul(1000))} = ${nl(diff)}\\text{ mL}` })],
      wrong: [
        [bmL.sub(aL).abs(), 'geo_unit_mixed'],
        [aL.mul(100).sub(bmL).abs(), MIS.unitFactor.id],
      ],
      params: { kind: 'compare', aL: aL.toNumber(), bmL: bmL.toNumber() },
    });
  }
  if (mode === 'ribbon') {
    const piece = rng.pick([20, 25, 40, 50]);
    const count = rng.int(4, 15);
    const Lm = R(piece * count, 100);
    return measure([p(`${who} has a ribbon ${nt(Lm)} m long and cuts it into pieces that are each ${piece} cm long. How many pieces does ${who} get?`)], R(count), {
      unit: 'pieces',
      hints: ['The ribbon is in metres and the pieces are in centimetres. Use one unit for both.', `1 m = 100 cm, so the ribbon is $$${nl(Lm)} \\times 100$$ cm long.`],
      solution: [steps({ text: 'Change the ribbon length to centimetres.', math: `${nl(Lm)}\\text{ m} = ${nl(Lm.mul(100))}\\text{ cm}` }, { text: 'Divide by the length of one piece.', math: `${nl(Lm.mul(100))} \\div ${piece} = ${count}` })],
      wrong: [
        [Lm.mul(1000).div(piece), MIS.unitFactor.id],
        [Lm.mul(10).div(piece), MIS.unitFactor.id],
      ],
      params: { kind: 'ribbon', Lm: Lm.toNumber(), piece },
    });
  }
  if (mode === 'mass') {
    const a = rng.pick([250, 450, 600, 750, 900]);
    const b = rat(rng.pick([1.2, 1.5, 2, 0.8]));
    const c = rng.pick([150, 300, 350, 500]);
    const total = R(a + c, 1000).add(b);
    return measure([p(`${who} packs a lunch bag with ${a} g of fruit, a ${nt(b)} kg water jug and a ${c} g sandwich. What is the total mass in kilograms?`)], total, {
      unit: 'kg',
      hints: ['Two masses are in grams and one is in kilograms. Change them to the same unit first.', '1 kg = 1000 g, so divide the gram amounts by 1000.'],
      solution: [steps({ text: 'Change grams to kilograms.', math: `${a}\\text{ g} = ${nl(R(a, 1000))}\\text{ kg}, \\quad ${c}\\text{ g} = ${nl(R(c, 1000))}\\text{ kg}` }, { text: 'Add.', math: `${nl(R(a, 1000))} + ${nl(b)} + ${nl(R(c, 1000))} = ${nl(total)}\\text{ kg}` })],
      wrong: [
        [b.add(a + c), 'geo_unit_mixed'],
        [R(a + c, 100).add(b), MIS.unitFactor.id],
      ],
      params: { kind: 'mass', a, b: b.toNumber(), c },
    });
  }
  const lap = rng.pick([200, 400]);
  const laps = rng.int(3, 12);
  const km = R(lap * laps, 1000);
  return measure([p(`${who} runs ${laps} laps of a ${lap} m track. How many kilometres is that?`)], km, {
    unit: 'km',
    hints: ['Find the total distance in metres first.', '1 km = 1000 m, so divide the metres by 1000.'],
    solution: [steps({ text: 'Total distance in metres.', math: `${laps} \\times ${lap} = ${nl(lap * laps)}\\text{ m}` }, { text: 'Change metres to kilometres.', math: `${nl(lap * laps)} \\div 1000 = ${nl(km)}\\text{ km}` })],
    wrong: [
      [R(lap * laps, 100), MIS.unitFactor.id],
      [R(lap * laps), MIS.unitDirection.id],
    ],
    params: { kind: 'laps', lap, laps },
  });
}

function unitsCapacity(rng: Rng, d: number): Draft {
  if (d <= 1) {
    if (rng.chance(0.5)) {
      const toCm = rng.chance(0.5);
      const v = rng.pick([5, 15, 30, 125, 250, 355, 500]);
      const item = rng.pick(['A medicine cup', 'A juice box', 'A measuring cup', 'A syringe for a science experiment']);
      return measure([p(toCm ? `${item} holds ${v} mL of liquid. What volume does that liquid take up, in cubic centimetres?` : `A container has an inside volume of ${v} cm³. How many millilitres of water can it hold?`)], R(v), {
        unit: toCm ? 'cm³' : 'mL',
        hints: ['How much space does 1 mL of water fill?', '1 mL fills exactly 1 cm³, so the number stays the same.'],
        solution: [p('1 mL of liquid exactly fills a cube 1 cm long, 1 cm wide and 1 cm high, so 1 mL = 1 cm³.'), m(`${v}\\text{ mL} = ${v}\\text{ cm}^3`)],
        wrong: [
          [R(v * 1000), MIS.unitFactor.id],
          [R(v, 1000), MIS.unitFactor.id],
        ],
        params: { kind: 'mlcm', v },
      });
    }
    const s = rng.int(2, 9);
    return choice(rng, [p(`A **solid** wooden cube measures ${s} cm on each side. Which statement is true?`)], `Its volume is ${s ** 3} cm³, but it cannot hold any liquid, so it has no capacity.`, [
      { text: `Its capacity is ${s ** 3} mL, because 1 cm³ = 1 mL.`, misconception: 'geo_volume_capacity' },
      { text: `Its volume is ${3 * s} cm³.`, misconception: 'geo_vol_added' },
      { text: `Its volume is ${s ** 2} cm³.`, misconception: 'geo_vol_forgot_height' },
    ], {
      hints: ['Volume is the space an object takes up. Capacity is how much a container can hold.', 'Can a solid block hold water inside it?'],
      solution: [m(`V = ${s} \\times ${s} \\times ${s} = ${s ** 3}\\text{ cm}^3`), p('The cube takes up that much space, so that is its volume. It is solid, so it cannot hold anything: it has no capacity. A hollow box with the same inside measurements would have a capacity of the same number of millilitres.')],
      params: { kind: 'solid', s },
    });
  }
  if (d === 2) {
    const l = rng.pick([5, 8, 10, 12, 15, 20]);
    const w = rng.pick([4, 5, 8, 10]);
    const h = rng.pick([5, 6, 10, 12, 15]);
    const V = l * w * h;
    const inL = rng.chance(0.5);
    const ans = inL ? R(V, 1000) : R(V);
    return measure([p(`A box-shaped container measures ${l} cm by ${w} cm by ${h} cm on the inside. What is its capacity in ${inL ? 'litres' : 'millilitres'}?`), prismDiagram(l, w, h, 'cm')], ans, {
      unit: inL ? 'L' : 'mL',
      hints: ['Find the inside volume in cm³ first.', inL ? '1 cm³ holds 1 mL, and 1000 mL = 1 L.' : '1 cm³ holds 1 mL.'],
      solution: [
        steps(
          { text: 'Inside volume.', math: `${l} \\times ${w} \\times ${h} = ${nl(V)}\\text{ cm}^3` },
          { text: '1 cm³ holds 1 mL.', math: `${nl(V)}\\text{ cm}^3 \\to ${nl(V)}\\text{ mL}` },
          ...(inL ? [{ text: 'Divide by 1000 to change mL to L.', math: `${nl(V)} \\div 1000 = ${nl(ans)}\\text{ L}` }] : []),
        ),
      ],
      wrong: inL
        ? [
            [R(V), MIS.unitFactor.id],
            [R(V, 100), MIS.unitFactor.id],
          ]
        : [
            [R(V, 1000), MIS.unitFactor.id],
            [R(l + w + h), 'geo_vol_added'],
          ],
      params: { kind: 'boxCap', l, w, h, inL },
    });
  }
  const mode = rng.pick(['tank', 'glasses', 'fit'] as const);
  if (mode === 'tank') {
    const l = rng.pick([40, 50, 60, 80]);
    const w = rng.pick([25, 30, 40]);
    const h = rng.pick([30, 35, 40, 50]);
    const depth = h - rng.pick([5, 10]);
    const V = l * w * depth;
    const L = R(V, 1000);
    return measure([p(`An aquarium is ${l} cm long, ${w} cm wide and ${h} cm tall on the inside. It is filled with water to a depth of ${depth} cm. How many litres of water are in it?`)], L, {
      unit: 'L',
      hints: ['The water is a rectangular prism too. How tall is the water, not the tank?', `Find $$${l} \\times ${w} \\times ${depth}$$ in cm³, then change cm³ to litres.`],
      solution: [steps({ text: 'Volume of the water (use the water depth).', math: `${l} \\times ${w} \\times ${depth} = ${nl(V)}\\text{ cm}^3` }, { text: '1 cm³ = 1 mL, and 1000 mL = 1 L.', math: `${nl(V)}\\text{ mL} \\div 1000 = ${nl(L)}\\text{ L}` })],
      wrong: [
        [R(V), MIS.unitFactor.id],
        [R(V, 100), MIS.unitFactor.id],
        [R(l * w * h, 1000), MIS.stoppedEarly.id],
      ],
      params: { kind: 'tank', l, w, depth },
    });
  }
  if (mode === 'glasses') {
    const l = rng.pick([10, 20]);
    const w = rng.pick([10, 15, 20, 25]);
    const h = rng.pick([10, 20, 30]);
    const V = l * w * h;
    const n = V / 250;
    return measure([p(`A juice jug is shaped like a rectangular prism, ${l} cm by ${w} cm by ${h} cm on the inside. How many 250 mL glasses can be filled from a full jug?`)], R(n), {
      unit: 'glasses',
      hints: ['How many millilitres does the jug hold? Use 1 cm³ = 1 mL.', `The jug holds $$${l} \\times ${w} \\times ${h}$$ mL. Divide by 250.`],
      solution: [steps({ text: 'Capacity of the jug.', math: `${l} \\times ${w} \\times ${h} = ${nl(V)}\\text{ cm}^3 = ${nl(V)}\\text{ mL}` }, { text: 'Divide by the size of one glass.', math: `${nl(V)} \\div 250 = ${n}` })],
      wrong: [[R(V, 250000), MIS.unitFactor.id]],
      params: { kind: 'glasses', l, w, h },
    });
  }
  const l = rng.pick([8, 10, 12, 15]);
  const w = rng.pick([8, 10, 12]);
  const h = rng.pick([10, 12, 15, 20]);
  const cap = l * w * h;
  const juice = roundTo(R(cap, 1000).add(rat(rng.pick([-0.3, -0.2, 0.2, 0.3]))), 1);
  const fits = juice.mul(1000).cmp(cap) <= 0;
  return trueFalse([p(`A container measures ${l} cm by ${w} cm by ${h} cm on the inside. True or false: ${nt(juice)} L of juice will fit in it without spilling.`)], fits, {
    hints: ['Find the container’s capacity in mL, using 1 cm³ = 1 mL.', `Change ${nt(juice)} L to mL (× 1000) and compare.`],
    solution: [steps({ text: 'Capacity of the container.', math: `${l} \\times ${w} \\times ${h} = ${nl(cap)}\\text{ cm}^3 = ${nl(cap)}\\text{ mL}` }, { text: 'Amount of juice in mL.', math: `${nl(juice)}\\text{ L} = ${nl(juice.mul(1000))}\\text{ mL}` }, { text: fits ? 'The juice is no more than the capacity, so it fits. **True.**' : 'There is more juice than the container holds, so it does not fit. **False.**' })],
    misconception: MIS.unitFactor.id,
    params: { kind: 'fit', l, w, h, juice: juice.toNumber() },
  });
}

function unitsMeasurement(rng: Rng, d: number): Draft {
  if (d <= 2) {
    const mode = rng.pick(['m2cm', 'cm2m', 'cm2mm', 'mm2cm'] as const);
    const [from, to, ratio, v] =
      mode === 'm2cm'
        ? ['m²', 'cm²', R(10000), rat(rng.pick([0.6, 1.5, 2, 3.25, 0.08, 4]))]
        : mode === 'cm2m'
          ? ['cm²', 'm²', R(1, 10000), R(rng.pick([4500, 12000, 800, 25000, 60000]))]
          : mode === 'cm2mm'
            ? ['cm²', 'mm²', R(100), rat(rng.pick([3, 4.5, 12, 0.5]))]
            : ['mm²', 'cm²', R(1, 100), R(rng.pick([250, 1200, 75, 3000]))];
    const ans = v.mul(ratio);
    const down = ratio.cmp(1) > 0;
    const linear = mode.includes('mm') ? 10 : 100;
    const f = linear * linear;
    const bigU = mode.includes('mm') ? 'cm' : 'm';
    const smallU = mode.includes('mm') ? 'mm' : 'cm';
    const thing = rng.pick(['A poster', 'A garden plot', 'A tablecloth', 'A sheet of plywood']);
    return measure([p(`${thing} has an area of ${nt(v)} ${from}. What is its area in ${to}?`)], ans, {
      unit: to,
      hints: [`How many ${smallU} fit along one side of a square that is 1 ${bigU} long? How many ${smallU}² fit inside it?`, `1 ${bigU} = ${linear} ${smallU}, so 1 ${bigU}² = ${linear} × ${linear} = ${nt(f)} ${smallU}². ${down ? 'Multiply' : 'Divide'} by ${nt(f)}.`],
      solution: [
        steps(
          { text: `A square 1 ${bigU} on each side is ${linear} ${smallU} by ${linear} ${smallU}.`, math: `1${ul(sq(bigU))} = ${linear} \\times ${linear} = ${nl(f)}${ul(sq(smallU))}` },
          { text: down ? 'Changing to a smaller unit: multiply.' : 'Changing to a bigger unit: divide.', math: `${nl(v)} ${down ? '\\times' : '\\div'} ${nl(f)} = ${nl(ans)}${ul(to)}` },
        ),
      ],
      wrong: [
        [down ? v.mul(linear) : v.div(linear), 'geo_area_unit_factor'],
        [v.div(ratio), MIS.unitDirection.id],
      ],
      params: { kind: 'areaConv', v: v.toNumber(), from, to },
    });
  }
  if (d === 3) {
    const mode = rng.pick(['mixedArea', 'mixedPerim', 'poster'] as const);
    if (mode === 'poster') {
      const a = rng.pick([40, 50, 60, 75, 80]);
      const b = rng.pick([60, 90, 100, 120]);
      const cm2 = a * b;
      const ans = R(cm2, 10000);
      return measure([p(`A poster is ${a} cm wide and ${b} cm tall. What is its area in square metres?`)], ans, {
        unit: 'm²',
        hints: ['You can find the area in cm² and convert, or change the sides to metres first.', `In metres the sides are ${nt(R(a, 100))} m and ${nt(R(b, 100))} m.`],
        solution: [steps({ text: 'Change each side to metres.', math: `${a}\\text{ cm} = ${nl(R(a, 100))}\\text{ m}, \\quad ${b}\\text{ cm} = ${nl(R(b, 100))}\\text{ m}` }, { text: 'Multiply.', math: `${nl(R(a, 100))} \\times ${nl(R(b, 100))} = ${nl(ans)}\\text{ m}^2` }), p(`Check: $$${a} \\times ${b} = ${nl(cm2)}$$ cm², and $$${nl(cm2)} \\div 10\\,000 = ${nl(ans)}$$ m².`)],
        wrong: [
          [R(cm2, 100), 'geo_area_unit_factor'],
          [R(cm2), 'geo_unit_mixed'],
        ],
        params: { kind: 'poster', a, b },
      });
    }
    const Lm = rat(rng.pick([3.5, 4.5, 6, 2.8, 5.2]));
    const wcm = rng.pick([240, 275, 320, 180, 350]);
    const wm = R(wcm, 100);
    if (mode === 'mixedArea') {
      const ans = Lm.mul(wm);
      return measure([p(`A rectangular deck is ${nt(Lm)} m long and ${wcm} cm wide. What is its area in square metres?`)], ans, {
        unit: 'm²',
        hints: ['The length and width are in different units. Change the width to metres first.', `${wcm} cm = ${nt(wm)} m.`],
        solution: [steps({ text: 'Change centimetres to metres.', math: `${wcm}\\text{ cm} = ${wcm} \\div 100 = ${nl(wm)}\\text{ m}` }, { text: 'Multiply length by width.', math: `${nl(Lm)} \\times ${nl(wm)} = ${nl(ans)}\\text{ m}^2` })],
        wrong: [
          [Lm.mul(wcm), 'geo_unit_mixed'],
          [Lm.mul(wcm).div(10000), 'geo_area_unit_factor'],
        ],
        params: { kind: 'mixedArea', Lm: Lm.toNumber(), wcm },
      });
    }
    const ans = Lm.add(wm).mul(2);
    return measure([p(`A rectangular room is ${nt(Lm)} m long and ${wcm} cm wide. How many metres of baseboard trim are needed to go all the way around the room?`)], ans, {
      unit: 'm',
      hints: ['Perimeter: add all four sides. But first make the units match.', `${wcm} cm = ${nt(wm)} m. Then the perimeter is 2 × (length + width).`],
      solution: [steps({ text: 'Change centimetres to metres.', math: `${wcm}\\text{ cm} = ${nl(wm)}\\text{ m}` }, { text: 'Perimeter of a rectangle.', math: `2 \\times (${nl(Lm)} + ${nl(wm)}) = ${nl(ans)}\\text{ m}` })],
      wrong: [
        [Lm.add(wcm).mul(2), 'geo_unit_mixed'],
        [Lm.mul(wm), 'geo_area_perimeter'],
      ],
      params: { kind: 'mixedPerim', Lm: Lm.toNumber(), wcm },
    });
  }
  const mode = rng.pick(['tankL', 'crate', 'cups'] as const);
  if (mode === 'tankL') {
    const a = rat(rng.pick([0.8, 1, 1.2, 1.5]));
    const b = rat(rng.pick([0.4, 0.5, 0.6]));
    const c = rat(rng.pick([0.5, 0.6, 0.75]));
    const m3 = a.mul(b).mul(c);
    const L = m3.mul(1000);
    return measure([p(`A rain barrel shaped like a rectangular prism is ${nt(a)} m long, ${nt(b)} m wide and ${nt(c)} m tall on the inside. How many litres of water can it hold?`)], L, {
      unit: 'L',
      hints: ['Find the volume in m³, then think: how many cm³ (and so mL) are in 1 m³?', '1 m³ = 100 cm × 100 cm × 100 cm = 1 000 000 cm³ = 1 000 000 mL = 1000 L.'],
      solution: [steps({ text: 'Volume in cubic metres.', math: `${nl(a)} \\times ${nl(b)} \\times ${nl(c)} = ${nl(m3)}\\text{ m}^3` }, { text: '1 m³ = 1 000 000 cm³ = 1 000 000 mL = 1000 L.', math: `${nl(m3)} \\times 1000 = ${nl(L)}\\text{ L}` })],
      wrong: [
        [m3, 'geo_vol_unit_factor'],
        [m3.mul(100), 'geo_vol_unit_factor'],
        [m3.mul(1000000), MIS.unitFactor.id],
      ],
      params: { kind: 'tankL', a: a.toNumber(), b: b.toNumber(), c: c.toNumber() },
    });
  }
  if (mode === 'crate') {
    const a = rng.pick([120, 100, 80, 150]);
    const b = rng.pick([80, 60, 50]);
    const c = rng.pick([50, 40, 60, 75]);
    const cm3 = a * b * c;
    const ans = R(cm3, 1000000);
    return measure([p(`A shipping crate is ${a} cm long, ${b} cm wide and ${c} cm high. What is its volume in cubic metres?`)], ans, {
      unit: 'm³',
      hints: ['Change each length to metres first, or convert the volume at the end.', `In metres: ${nt(R(a, 100))} m, ${nt(R(b, 100))} m and ${nt(R(c, 100))} m.`],
      solution: [steps({ text: 'Change each length to metres.', math: `${nl(R(a, 100))}\\text{ m}, \\; ${nl(R(b, 100))}\\text{ m}, \\; ${nl(R(c, 100))}\\text{ m}` }, { text: 'Multiply.', math: `${nl(R(a, 100))} \\times ${nl(R(b, 100))} \\times ${nl(R(c, 100))} = ${nl(ans)}\\text{ m}^3` }), p(`Check: $$${nl(cm3)}$$ cm³ ÷ 1 000 000 = $$${nl(ans)}$$ m³.`)],
      wrong: [
        [R(cm3, 1000), 'geo_vol_unit_factor'],
        [R(cm3, 100), 'geo_vol_unit_factor'],
        [R(cm3, 10000), 'geo_area_unit_factor'],
      ],
      params: { kind: 'crate', a, b, c },
    });
  }
  const l = rng.pick([40, 50, 60]);
  const w = rng.pick([25, 30, 40]);
  const h = rng.pick([20, 25, 30]);
  const V = l * w * h;
  const cupsN = V / 250;
  return measure([p(`A fish tank is ${nt(R(l, 100))} m long, ${nt(R(w, 100))} m wide and ${nt(R(h, 100))} m tall on the inside. How many 250 mL cups of water does it take to fill it?`)], R(cupsN), {
    unit: 'cups',
    hints: ['Change the measurements to centimetres, so the volume comes out in cm³ (which is mL).', `The tank is ${l} cm by ${w} cm by ${h} cm.`],
    solution: [
      steps(
        { text: 'Change metres to centimetres.', math: `${l}\\text{ cm} \\times ${w}\\text{ cm} \\times ${h}\\text{ cm}` },
        { text: 'Volume in cm³, which is the same number of mL.', math: `${l} \\times ${w} \\times ${h} = ${nl(V)}\\text{ cm}^3 = ${nl(V)}\\text{ mL}` },
        { text: 'Divide by the size of one cup.', math: `${nl(V)} \\div 250 = ${nl(cupsN)}` },
      ),
    ],
    wrong: [
      [R(V, 250000), 'geo_vol_unit_factor'],
      [R(V, 25000), 'geo_vol_unit_factor'],
    ],
    params: { kind: 'cups', l, w, h },
  });
}

export const unitConvert: SkillPack = {
  id: 'unit-convert',
  title: 'Metric units: converting length, mass, capacity, area and volume',
  subject: 'math',
  expectations: [
    {
      id: `${G6}:E2.1`,
      note: 'Converts lengths, masses and capacities between metric units (mm, cm, m, km; mg, g, kg; mL, L) in both directions, and solves problems that need a conversion first, such as comparing two containers. Choosing tools and measuring physical objects is not assessed.',
      levels: [1, 2, 3],
    },
    {
      id: `${G7}:E2.1`,
      note: 'Applies 1 mL = 1 cm³ (and 1 L = 1000 cm³) to find the capacity of containers from their inside measurements, and distinguishes volume (space taken up) from capacity (what a container holds). Describing the difference in writing is explained in the lesson; it is checked only through multiple-choice and true/false items.',
      levels: [1, 2, 3],
    },
    {
      id: `${G7}:E2.2`,
      note: 'Solves perimeter, area and volume problems that need a unit conversion, including cm² ↔ m² (× 10 000), mm² ↔ cm² (× 100) and cm³ ↔ m³ (× 1 000 000), and measurements given in mixed units.',
      levels: [2, 3, 4],
    },
  ],
  prerequisites: [],
  goal: 'I can convert between metric units and use the right units for length, mass, capacity, area and volume.',
  explain: (c) => {
    const e = c.expectationId;
    const base = [
      p('Metric units use the same prefixes for every kind of measurement: **kilo** means 1000, **centi** means one hundredth and **milli** means one thousandth.'),
      { kind: 'table', header: ['Length', 'Mass', 'Capacity'], rows: [['1 cm = 10 mm', '1 g = 1000 mg', '1 L = 1000 mL'], ['1 m = 100 cm', '1 kg = 1000 g', ''], ['1 km = 1000 m', '', '']] } as Block,
      steps({ text: 'Decide: am I changing to a smaller unit or a bigger unit?' }, { text: 'Smaller unit → more of them → multiply.', math: '2.5\\text{ m} = 2.5 \\times 100 = 250\\text{ cm}' }, { text: 'Bigger unit → fewer of them → divide.', math: '750\\text{ g} = 750 \\div 1000 = 0.75\\text{ kg}' }),
    ];
    if (e.endsWith('g7-math:E2.1'))
      return [
        ...base,
        p('**Volume** is the amount of space something takes up (in cm³ or m³). **Capacity** is how much a container can hold (in mL or L). A solid block has a volume but no capacity.'),
        p('They are linked: **1 mL of liquid exactly fills 1 cm³**. So a box 10 cm × 10 cm × 10 cm has a volume of 1000 cm³ and holds 1000 mL, which is 1 L.'),
        m('1\\text{ mL} = 1\\text{ cm}^3, \\qquad 1\\text{ L} = 1000\\text{ cm}^3'),
      ];
    if (e.endsWith('g7-math:E2.2'))
      return [
        ...base,
        p('Area and volume units grow faster than length units. A square 1 m on each side is 100 cm by 100 cm, so it holds $$100 \\times 100 = 10\\,000$$ squares of 1 cm².'),
        m('1\\text{ m}^2 = 10\\,000\\text{ cm}^2, \\qquad 1\\text{ cm}^2 = 100\\text{ mm}^2, \\qquad 1\\text{ m}^3 = 1\\,000\\,000\\text{ cm}^3'),
        warn('When measurements are in different units, change them to the same unit **before** you multiply or add.'),
      ];
    return [...base, c.simple ? tip('Smaller unit: bigger number. Bigger unit: smaller number.') : tip('Check your answer makes sense: 3 km is a long way, so in metres it must be a big number (3000 m).')];
  },
  alternatives: (c) => ({
    simpler: [p('To a smaller unit: multiply. To a bigger unit: divide. Use 10, 100 or 1000 depending on the units.')],
    analogy: [p('Money works the same way: 1 dollar = 100 cents. Changing 3 dollars to cents gives a bigger number (300), because cents are smaller.')],
    visual: c.expectationId.endsWith('g7-math:E2.2')
      ? [{ kind: 'diagram', diagram: { type: 'area_model', rows: 10, cols: 10, shadedRows: 10, shadedCols: 10 }, alt: 'A square 1 cm on each side divided into a 10 by 10 grid of 100 small squares, each 1 mm². So 1 cm² = 100 mm².' }, p('Along each side 1 cm = 10 mm, but the square holds $$10 \\times 10 = 100$$ little squares: 1 cm² = 100 mm².')]
      : [{ kind: 'diagram', diagram: { type: 'number_line', min: 0, max: 100, step: 10, points: [{ at: 0, label: '0 cm' }, { at: 100, label: '100 cm = 1 m' }] }, alt: 'A metre stick from 0 to 100 cm, marked every 10 cm.' }, p('A metre stick has 100 centimetres, so 1 m = 100 cm.')],
    compare: [p(c.expectationId.endsWith('g7-math:E2.1') ? 'A 1 L milk carton holds 1000 mL. A cube 10 cm on each side has room for 1000 cm³. That is why 1 mL and 1 cm³ match.' : 'You already know 1 m = 100 cm. Every other conversion works the same way, with a different number: 1000 for kilo and milli, 10 for cm and mm.')],
  }),
  example: (rng, c) => {
    if (c.expectationId.endsWith('g7-math:E2.2')) {
      const v = rng.pick([2, 3, 1.5, 0.4]);
      return [p(`Convert ${nt(v)} m² to cm².`), steps({ text: '1 m = 100 cm, so 1 m² = 100 cm × 100 cm.', math: '1\\text{ m}^2 = 10\\,000\\text{ cm}^2' }, { text: 'Multiply.', math: `${nl(v)} \\times 10\\,000 = ${nl(rat(v).mul(10000))}\\text{ cm}^2` })];
    }
    if (c.expectationId.endsWith('g7-math:E2.1')) {
      const [l, w, h] = [rng.pick([10, 20]), rng.pick([5, 10]), rng.pick([10, 15])];
      return [p(`How many litres does a box ${l} cm × ${w} cm × ${h} cm hold?`), steps({ text: 'Volume.', math: `${l} \\times ${w} \\times ${h} = ${nl(l * w * h)}\\text{ cm}^3` }, { text: '1 cm³ = 1 mL.', math: `${nl(l * w * h)}\\text{ mL}` }, { text: 'Divide by 1000.', math: `${nl(l * w * h)} \\div 1000 = ${nl(R(l * w * h, 1000))}\\text{ L}` })];
    }
    const v = rng.pick([1.5, 2.25, 0.8, 3]);
    return [p(`Convert ${nt(v)} kg to grams.`), steps({ text: '1 kg = 1000 g. Grams are smaller, so multiply.', math: `${nl(v)} \\times 1000 = ${nl(rat(v).mul(1000))}\\text{ g}` })];
  },
  generate: (rng, d, c) => (c.expectationId.endsWith('g7-math:E2.1') ? unitsCapacity(rng, d) : c.expectationId.endsWith('g7-math:E2.2') ? unitsMeasurement(rng, d) : unitsG6(rng, d)),
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Params;
    const n = (k: string) => num(pr, k);
    const e = (u: unknown) => EXP10[String(u)] ?? NaN;
    switch (pr.kind) {
      case 'conv':
        return near(q, n('v') * 10 ** (e(pr.from) - e(pr.to)));
      case 'compare':
        return near(q, Math.abs(n('aL') - n('bmL') / 1000) * 1000);
      case 'ribbon':
        return near(q, (n('Lm') * 100) / n('piece'));
      case 'mass':
        return near(q, (n('a') + n('c') + n('b') * 1000) / 1000);
      case 'laps':
        return near(q, (n('lap') / 1000) * n('laps'));
      case 'mlcm':
        return near(q, n('v'));
      case 'solid':
        return rightText(q).includes(`${n('s') ** 3} cm³`) && rightText(q).includes('no capacity') ? null : 'solid cube choice is wrong';
      case 'boxCap':
        return near(q, (n('l') * n('w') * n('h')) / (pr.inL ? 1000 : 1));
      case 'tank':
        return near(q, (n('l') / 10) * (n('w') / 10) * (n('depth') / 10));
      case 'glasses':
        return near(q, (n('l') * n('w') * n('h')) / 250);
      case 'fit':
        return q.type === 'true_false' && q.answer === (n('juice') * 1000 <= n('l') * n('w') * n('h') + 1e-9) ? null : 'true/false value is wrong';
      case 'areaConv':
        return near(q, n('v') * 10 ** (2 * (e(String(pr.from).replace('²', '')) - e(String(pr.to).replace('²', '')))));
      case 'poster':
        return near(q, (n('a') / 100) * (n('b') / 100));
      case 'mixedArea':
        return near(q, (n('Lm') * n('wcm')) / 100);
      case 'mixedPerim':
        return near(q, 2 * n('Lm') + (2 * n('wcm')) / 100);
      case 'tankL':
        return near(q, n('a') * 10 * n('b') * 10 * n('c') * 10);
      case 'crate':
        return near(q, (n('a') / 100) * (n('b') / 100) * (n('c') / 100));
      case 'cups':
        return near(q, (n('l') * n('w') * n('h')) / 250);
      default:
        return 'unknown question kind';
    }
  },
  summary: ['To a smaller unit, multiply; to a bigger unit, divide (by 10, 100 or 1000).', '1 mL of liquid fills 1 cm³, so 1 L = 1000 cm³. Volume is space taken up; capacity is what a container holds.', 'Area and volume units: 1 m² = 10 000 cm² and 1 m³ = 1 000 000 cm³. Make units match before calculating.'],
  misconceptions: [
    MIS.unitDirection,
    MIS.unitFactor,
    MIS.stoppedEarly,
    { id: 'geo_unit_mixed', label: 'Calculated with mixed units', explanation: 'Numbers in different units can’t be added, subtracted or multiplied directly. 2 m + 30 cm is not 32 of anything.', fix: 'Change every measurement to the same unit first, then calculate.' },
    { id: 'geo_area_unit_factor', label: 'Used the length factor for area', explanation: 'A square metre is 100 cm by 100 cm, so it contains 100 × 100 = 10 000 cm², not 100 cm².', fix: 'For area, square the length factor: 1 m² = 10 000 cm², 1 cm² = 100 mm².' },
    { id: 'geo_vol_unit_factor', label: 'Used the wrong factor for volume', explanation: 'A cubic metre is 100 cm by 100 cm by 100 cm, so it contains 1 000 000 cm³ (and holds 1000 L).', fix: 'For volume, cube the length factor: 1 m³ = 100 × 100 × 100 = 1 000 000 cm³.' },
    { id: 'geo_volume_capacity', label: 'Mixed up volume and capacity', explanation: 'Every object has a volume (the space it takes up), but only a container has a capacity (what it can hold). A solid block holds nothing.', fix: 'Ask: can this object hold something inside it? If not, it has volume but no capacity.' },
    { id: 'geo_vol_added', label: 'Added the measurements', explanation: 'Volume counts cubes in layers, so the measurements are multiplied, not added.', fix: 'Multiply length × width × height.' },
    { id: 'geo_vol_forgot_height', label: 'Found the base area but not the volume', explanation: 'Length × width gives the area of one layer. The volume needs every layer.', fix: 'After finding the base area, multiply by the height.' },
    { id: 'geo_area_perimeter', label: 'Found the area instead of the perimeter (or the other way round)', explanation: 'Perimeter adds up the lengths around the outside. Area counts the squares inside.', fix: 'Perimeter: add the sides, answer in units like m. Area: multiply, answer in square units like m².' },
  ],
};

// ═════════════════════════ Coordinates and transformations ═════════════════════════

type Pt = [number, number];
const pt = ([x, y]: Pt) => tex(`(${x}, ${y})`);
const named = (label: string, [x, y]: Pt) => tex(`${label}(${x}, ${y})`);
const plane = (points: { x: number; y: number; label: string }[], alt: string): Block => ({ kind: 'diagram', diagram: { type: 'coordinate', points }, alt });
const QUAD = ['', 'I', 'II', 'III', 'IV'];
const quadrantOf = ([x, y]: Pt) => (x > 0 ? (y > 0 ? 1 : 4) : y > 0 ? 2 : 3);
const moveWords = (dx: number, dy: number) => `${units(Math.abs(dx), 'unit')} ${dx > 0 ? 'right' : 'left'} and ${units(Math.abs(dy), 'unit')} ${dy > 0 ? 'up' : 'down'}`;

/** A point with non-zero coordinates whose sizes differ, so swapped and sign-flipped distractors are all different. */
function point(rng: Rng, max = 8): Pt {
  const x = rng.signed(1, max);
  let y = rng.signed(1, max);
  if (Math.abs(y) === Math.abs(x)) y = y > 0 ? (y === max ? y - 1 : y + 1) : y === -max ? y + 1 : y - 1;
  return [x, y];
}

function pointChoice(rng: Rng, prompt: Block[], correct: Pt, distractors: [Pt, string][], o: { hints: string[]; solution: Block[]; params: Params }): Draft {
  return choice(
    rng,
    prompt,
    pt(correct),
    distractors.map(([q, misconception]) => ({ text: pt(q), misconception })),
    o,
  );
}

function coordRead(rng: Rng): Draft {
  const P = point(rng);
  const [x, y] = P;
  return pointChoice(rng, [p('What are the coordinates of point $$P$$?'), plane([{ x, y, label: 'P' }], `A coordinate grid with point P plotted ${Math.abs(x)} units ${x > 0 ? 'right' : 'left'} of the origin and ${Math.abs(y)} units ${y > 0 ? 'up' : 'down'}.`)], P, [
    [[y, x], 'geo_coord_swap'],
    [[-x, y], 'geo_coord_sign'],
    [[x, -y], 'geo_coord_sign'],
  ], {
    hints: ['Start at the origin (0, 0). Go across first, then up or down.', `P is ${Math.abs(x)} ${x > 0 ? 'right' : 'left'} and ${Math.abs(y)} ${y > 0 ? 'up' : 'down'}. Left and down are negative.`],
    solution: [p(`From the origin, $$P$$ is ${units(Math.abs(x), 'unit')} ${x > 0 ? 'right' : 'left'}, so $$x = ${x}$$, and ${units(Math.abs(y), 'unit')} ${y > 0 ? 'up' : 'down'}, so $$y = ${y}$$. The x-coordinate is always written first: ${named('P', P)}.`)],
    params: { kind: 'read', x, y },
  });
}

function coordQuadrant(rng: Rng): Draft {
  const P = point(rng, 9);
  const q = quadrantOf(P);
  const swapQ = quadrantOf([P[1], P[0]]);
  const cwQ = [0, 1, 4, 3, 2][q] ?? q;
  const others = [1, 2, 3, 4].filter((k) => k !== q);
  return choice(
    rng,
    [p(`In which quadrant is the point ${pt(P)}?`)],
    `Quadrant ${QUAD[q]}`,
    others.map((k) => ({ text: `Quadrant ${QUAD[k]}`, misconception: k === swapQ ? 'geo_coord_swap' : k === cwQ ? 'geo_quadrant_order' : 'geo_coord_sign' })),
    {
      hints: ['Look at the signs: is x positive (right) or negative (left)? Is y positive (up) or negative (down)?', 'The quadrants are numbered counterclockwise from the top right: I (+, +), II (−, +), III (−, −), IV (+, −).'],
      solution: [p(`x is ${P[0] > 0 ? 'positive (right)' : 'negative (left)'} and y is ${P[1] > 0 ? 'positive (up)' : 'negative (down)'}, so the point is in **Quadrant ${QUAD[q]}**. Quadrants are numbered counterclockwise, starting at the top right.`)],
      params: { kind: 'quadrant', x: P[0], y: P[1] },
    },
  );
}

function coordTranslate(rng: Rng, asNumber: boolean): Draft {
  const A = point(rng, 6);
  const dx = rng.signed(1, 6);
  let dy = rng.signed(1, 6);
  if (Math.abs(dy) === Math.abs(dx)) dy = dy > 0 ? dy + 1 : dy - 1;
  const img: Pt = [A[0] + dx, A[1] + dy];
  const prompt = [p(`Point ${named('A', A)} is translated ${moveWords(dx, dy)}. ${asNumber ? 'What is the ' : 'What are the coordinates of its image '}${asNumber ? '' : '$$A\'$$?'}`), plane([{ x: A[0], y: A[1], label: 'A' }], `A coordinate grid with point A at (${sn(A[0])}, ${sn(A[1])}).`)];
  const hints = ['A move right or left changes only the x-coordinate. A move up or down changes only the y-coordinate.', `Right is +, left is −, up is +, down is −. Add ${sn(dx)} to x and ${sn(dy)} to y.`];
  const solution = [steps({ text: `Horizontal move: ${units(Math.abs(dx), 'unit')} ${dx > 0 ? 'right' : 'left'}, so add ${sn(dx)} to x.`, math: `${A[0]} + (${dx}) = ${img[0]}` }, { text: `Vertical move: ${units(Math.abs(dy), 'unit')} ${dy > 0 ? 'up' : 'down'}, so add ${sn(dy)} to y.`, math: `${A[1]} + (${dy}) = ${img[1]}` }, { text: 'The image is:', math: `A'(${img[0]}, ${img[1]})` })];
  if (asNumber) {
    const askX = rng.chance(0.5);
    const coordinate = askX ? 'x' : 'y';
    const ans = askX ? img[0] : img[1];
    const base = askX ? A[0] : A[1];
    const own = askX ? dx : dy;
    const other = askX ? dy : dx;
    prompt[0] = p(`Point ${named('A', A)} is translated ${moveWords(dx, dy)} to $$A'$$. What is the **${coordinate}-coordinate** of $$A'$$?`);
    return measure(prompt, R(ans), {
      hints,
      solution,
      signed: true,
      wrong: [
        [R(base - own), 'geo_translate_direction'],
        [R(base + other), 'geo_coord_swap'],
      ],
      params: { kind: 'translateNum', x: A[0], y: A[1], dx, dy, axis: coordinate },
    });
  }
  return pointChoice(rng, prompt, img, [
    [[A[0] - dx, A[1] - dy], 'geo_translate_direction'],
    [[A[0] + dy, A[1] + dx], 'geo_coord_swap'],
    [[A[0] + dx, A[1] - dy], 'geo_translate_direction'],
  ], { hints, solution, params: { kind: 'translate', x: A[0], y: A[1], dx, dy } });
}

function coordDescribe(rng: Rng): Draft {
  const A = point(rng, 6);
  const dx = rng.signed(1, 7);
  let dy = rng.signed(1, 7);
  if (Math.abs(dy) === Math.abs(dx)) dy = dy > 0 ? dy + 1 : dy - 1;
  const B: Pt = [A[0] + dx, A[1] + dy];
  return choice(
    rng,
    [p(`Which translation moves ${named('A', A)} to ${named('B', B)}?`), plane([{ x: A[0], y: A[1], label: 'A' }, { x: B[0], y: B[1], label: 'B' }], `A coordinate grid with A at (${sn(A[0])}, ${sn(A[1])}) and B at (${sn(B[0])}, ${sn(B[1])}).`)],
    moveWords(dx, dy),
    [
      { text: moveWords(-dx, -dy), misconception: 'geo_translate_direction' },
      { text: `${units(Math.abs(dy), 'unit')} ${dy > 0 ? 'right' : 'left'} and ${units(Math.abs(dx), 'unit')} ${dx > 0 ? 'up' : 'down'}`, misconception: 'geo_coord_swap' },
      { text: moveWords(dx, -dy), misconception: 'geo_translate_direction' },
    ],
    {
      hints: ['Compare the x-coordinates to find the move left or right, then the y-coordinates for up or down.', `Subtract: new minus old. $$${B[0]} - (${A[0]})$$ and $$${B[1]} - (${A[1]})$$.`],
      solution: [steps({ text: 'Change in x (new minus old).', math: `${B[0]} - (${A[0]}) = ${dx}` }, { text: 'Change in y (new minus old).', math: `${B[1]} - (${A[1]}) = ${dy}` }, { text: `So the translation is ${moveWords(dx, dy)}.` })],
      params: { kind: 'describe', ax: A[0], ay: A[1], bx: B[0], by: B[1] },
    },
  );
}

function coordReverse(rng: Rng): Draft {
  const A = point(rng, 6);
  const dx = rng.signed(1, 5);
  let dy = rng.signed(1, 5);
  if (Math.abs(dy) === Math.abs(dx)) dy = dy > 0 ? dy + 1 : dy - 1;
  const B: Pt = [A[0] + dx, A[1] + dy];
  return pointChoice(rng, [p(`A point was translated ${moveWords(dx, dy)}. It ended up at ${named('B', B)}. Where did it start?`)], A, [
    [[B[0] + dx, B[1] + dy], 'geo_translate_direction'],
    [[B[0] - dy, B[1] - dx], 'geo_coord_swap'],
    [[B[0] - dx, B[1] + dy], 'geo_translate_direction'],
  ], {
    hints: ['Work backwards: undo the translation.', `To undo ${moveWords(dx, dy)}, move ${moveWords(-dx, -dy)}.`],
    solution: [steps({ text: 'Undo the horizontal move.', math: `${B[0]} - (${dx}) = ${A[0]}` }, { text: 'Undo the vertical move.', math: `${B[1]} - (${dy}) = ${A[1]}` }, { text: 'The starting point is:', math: `(${A[0]}, ${A[1]})` })],
    params: { kind: 'reverse', bx: B[0], by: B[1], dx, dy },
  });
}

function coordReflect(rng: Rng): Draft {
  const A = point(rng);
  const axis = rng.pick(['x', 'y'] as const);
  const img: Pt = axis === 'x' ? [A[0], -A[1]] : [-A[0], A[1]];
  return pointChoice(rng, [p(`Point ${named('A', A)} is reflected in the **${axis}-axis**. What are the coordinates of its image $$A'$$?`), plane([{ x: A[0], y: A[1], label: 'A' }], `A coordinate grid with point A at (${sn(A[0])}, ${sn(A[1])}).`)], img, [
    [axis === 'x' ? [-A[0], A[1]] : [A[0], -A[1]], 'geo_reflect_axis'],
    [[-A[0], -A[1]], 'geo_reflect_axis'],
    [[A[1], A[0]], 'geo_coord_swap'],
  ], {
    hints: [`The ${axis}-axis is the mirror. Does the point move up and down, or left and right, to cross it?`, axis === 'x' ? 'Reflecting in the x-axis keeps x the same and changes the sign of y.' : 'Reflecting in the y-axis keeps y the same and changes the sign of x.'],
    solution: [p(axis === 'x' ? `The x-axis is horizontal, so the point flips up or down: it stays the same distance from the axis on the other side. x stays ${A[0]}; y changes from ${sn(A[1])} to ${sn(-A[1])}.` : `The y-axis is vertical, so the point flips left or right: it stays the same distance from the axis on the other side. y stays ${A[1]}; x changes from ${sn(A[0])} to ${sn(-A[0])}.`), m(`A'(${img[0]}, ${img[1]})`)],
    params: { kind: 'reflect', x: A[0], y: A[1], axis },
  });
}

type Turn = 'ccw' | 'cw' | 'half';
const rotate = ([x, y]: Pt, t: Turn): Pt => (t === 'ccw' ? [-y, x] : t === 'cw' ? [y, -x] : [-x, -y]);
const turnWords = (t: Turn) => (t === 'half' ? '180°' : `90° ${t === 'ccw' ? 'counterclockwise' : 'clockwise'}`);

function coordRotate(rng: Rng): Draft {
  const A = point(rng, 7);
  const t = rng.pick(['ccw', 'cw', 'half'] as const);
  const img = rotate(A, t);
  const distractors: [Pt, string][] =
    t === 'half'
      ? [
          [[A[0], -A[1]], 'geo_rotate_rule'],
          [[-A[0], A[1]], 'geo_rotate_rule'],
          [[A[1], A[0]], 'geo_coord_swap'],
        ]
      : [
          [rotate(A, t === 'ccw' ? 'cw' : 'ccw'), 'geo_rotate_direction'],
          [[A[1], A[0]], 'geo_coord_swap'],
          [[-A[0], -A[1]], 'geo_rotate_rule'],
        ];
  return pointChoice(rng, [p(`Point ${named('A', A)} is rotated ${turnWords(t)} about the origin. What are the coordinates of its image $$A'$$?`), plane([{ x: A[0], y: A[1], label: 'A' }], `A coordinate grid with point A at (${sn(A[0])}, ${sn(A[1])}) and the origin marked.`)], img, distractors, {
    hints: [t === 'half' ? 'A half turn about the origin sends the point to the opposite side of the origin.' : `Picture the line from the origin to A turning a quarter turn ${t === 'ccw' ? 'counterclockwise' : 'clockwise'}. Which quadrant does it land in?`, t === 'half' ? 'Rule for 180°: (x, y) → (−x, −y).' : t === 'ccw' ? 'Rule for 90° counterclockwise: (x, y) → (−y, x).' : 'Rule for 90° clockwise: (x, y) → (y, −x).'],
    solution: [m(t === 'half' ? `(x, y) \\to (-x, -y): \\quad (${A[0]}, ${A[1]}) \\to (${img[0]}, ${img[1]})` : t === 'ccw' ? `(x, y) \\to (-y, x): \\quad (${A[0]}, ${A[1]}) \\to (${img[0]}, ${img[1]})` : `(x, y) \\to (y, -x): \\quad (${A[0]}, ${A[1]}) \\to (${img[0]}, ${img[1]})`), p(`Check: A is in Quadrant ${QUAD[quadrantOf(A)]} and $$A'$$ is in Quadrant ${QUAD[quadrantOf(img)]}${t === 'half' ? ', the opposite quadrant.' : `, one quarter turn ${t === 'ccw' ? 'counterclockwise' : 'clockwise'}.`}`)],
    params: { kind: 'rotate', x: A[0], y: A[1], turn: t },
  });
}

function coordTwoStep(rng: Rng): Draft {
  const A = point(rng, 6);
  const shift = rng.signed(2, 6);
  const mode = rng.pick(['reflectY', 'reflectX', 'half'] as const);
  let img: Pt;
  let reversed: Pt;
  let first: string;
  let second: string;
  let move: string;
  if (mode === 'reflectY') {
    img = [-A[0] + shift, A[1]];
    reversed = [-(A[0] + shift), A[1]];
    first = 'reflected in the y-axis';
    move = `${units(Math.abs(shift), 'unit')} ${shift > 0 ? 'right' : 'left'}`;
    second = `translated ${move}`;
  } else if (mode === 'reflectX') {
    img = [A[0], -A[1] + shift];
    reversed = [A[0], -(A[1] + shift)];
    first = 'reflected in the x-axis';
    move = `${units(Math.abs(shift), 'unit')} ${shift > 0 ? 'up' : 'down'}`;
    second = `translated ${move}`;
  } else {
    img = [-A[0] + shift, -A[1]];
    reversed = [-(A[0] + shift), -A[1]];
    first = 'rotated 180° about the origin';
    move = `${units(Math.abs(shift), 'unit')} ${shift > 0 ? 'right' : 'left'}`;
    second = `translated ${move}`;
  }
  const mid: Pt = mode === 'reflectY' ? [-A[0], A[1]] : mode === 'reflectX' ? [A[0], -A[1]] : [-A[0], -A[1]];
  const wrongAxis: Pt = mode === 'reflectY' ? [A[0] + shift, -A[1]] : mode === 'reflectX' ? [-A[0], A[1] + shift] : [A[0] + shift, -A[1]];
  return pointChoice(rng, [p(`Point ${named('A', A)} is first ${first}, then ${second}. Where does it end up?`), plane([{ x: A[0], y: A[1], label: 'A' }], `A coordinate grid with point A at (${sn(A[0])}, ${sn(A[1])}).`)], img, [
    [reversed, 'geo_transform_order'],
    [mid, MIS.stoppedEarly.id],
    [wrongAxis, mode === 'half' ? 'geo_rotate_rule' : 'geo_reflect_axis'],
  ], {
    hints: ['Do the two steps in the order given, writing down the point after each step.', `After the first step the point is at ${pt(mid)}. Now apply the second step.`],
    solution: [steps({ text: `Step 1: ${first}.`, math: `(${A[0]}, ${A[1]}) \\to (${mid[0]}, ${mid[1]})` }, { text: `Step 2: ${second}.`, math: `(${mid[0]}, ${mid[1]}) \\to (${img[0]}, ${img[1]})` }), tip('Order matters: doing the translation first would give a different point.')],
    params: { kind: 'twoStep', x: A[0], y: A[1], mode, shift },
  });
}

export const coordinates: SkillPack = {
  id: 'coordinates',
  title: 'The coordinate plane and transformations',
  subject: 'math',
  expectations: [
    {
      id: `${G6}:E1.3`,
      note: 'Reads the coordinates of points in all four quadrants, names quadrants, finds the image of a point after a translation, describes the translation that moves one point to another, and works backwards from an image. Plotting points by hand is shown in diagrams but not assessed.',
      levels: [1, 2, 3],
    },
    {
      id: `${G7}:E1.4`,
      note: 'Predicts the coordinates of the image of a point after a translation, a reflection in the x- or y-axis, a rotation of 90° or 180° about the origin, or two of these in a row. Drawing the transformed shapes is not assessed, and rotations about centres other than the origin are not covered.',
      levels: [2, 3, 4],
    },
  ],
  prerequisites: [],
  goal: 'I can locate points on a coordinate plane and predict where a point goes after a translation, reflection or rotation.',
  explain: (c) => [
    p('The **coordinate plane** has a horizontal **x-axis** and a vertical **y-axis** that cross at the **origin**, (0, 0). A point is written as an ordered pair $$(x, y)$$: first how far across (right is +, left is −), then how far up or down (up is +, down is −).'),
    { kind: 'table', header: ['Quadrant', 'x', 'y', 'Example'], rows: [['I (top right)', '+', '+', '(3, 2)'], ['II (top left)', '−', '+', '(−3, 2)'], ['III (bottom left)', '−', '−', '(−3, −2)'], ['IV (bottom right)', '+', '−', '(3, −2)']] },
    p('A **translation** slides a point. Moving right or left changes x; moving up or down changes y. $$A(-2, 3)$$ moved 5 right and 4 down goes to $$(-2 + 5, 3 - 4) = (3, -1)$$.'),
    ...(c.grade >= 7
      ? [
          p('A **reflection** flips a point over a mirror line. In the x-axis: $$(x, y) \\to (x, -y)$$. In the y-axis: $$(x, y) \\to (-x, y)$$.'),
          p('A **rotation** turns a point about the origin. 180°: $$(x, y) \\to (-x, -y)$$. 90° counterclockwise: $$(x, y) \\to (-y, x)$$. 90° clockwise: $$(x, y) \\to (y, -x)$$.'),
          tip('Transformations do not change a shape’s size or angles: the image is congruent to the original.'),
        ]
      : []),
    c.simple ? tip('x first (across), then y (up or down). Like walking along the hallway before taking the stairs.') : tip('Check with a quick sketch: the image should land in the quadrant you expect.'),
  ],
  alternatives: (c) => ({
    simpler: [p('(x, y): x tells you left or right, y tells you up or down. Start at the middle (0, 0).')],
    visual: [plane([{ x: 3, y: 2, label: 'A' }, { x: -3, y: 2, label: 'B' }, { x: -3, y: -2, label: 'C' }, { x: 3, y: -2, label: 'D' }], 'Points A(3, 2), B(−3, 2), C(−3, −2) and D(3, −2), one in each quadrant.'), p('A(3, 2) is in Quadrant I. B is its reflection in the y-axis, D is its reflection in the x-axis, and C is its 180° rotation about the origin.')],
    analogy: [p('Coordinates are like finding a seat in a theatre: first the seat number across the row, then the row number. Swap them and you sit in the wrong seat.')],
    steps: [steps({ text: 'Start at the origin.' }, { text: 'Move across by the x-coordinate (right if positive, left if negative).' }, { text: 'Move up or down by the y-coordinate.' }, { text: 'For a translation, add the moves: right/up add, left/down subtract.' })],
    ...(c.grade >= 7 ? { compare: [p('A reflection in a mirror keeps you the same distance from the mirror, on the other side. Reflecting in the y-axis keeps the height (y) and flips left and right (the sign of x).')] } : {}),
  }),
  example: (rng, c) => {
    const A = point(rng, 6);
    if (c.grade >= 7) {
      const img: Pt = [A[0], -A[1]];
      return [p(`Reflect ${named('A', A)} in the x-axis.`), steps({ text: 'The x-axis is the mirror, so the point flips up or down. x stays the same.', math: `x = ${A[0]}` }, { text: 'y changes sign.', math: `y = ${-A[1]}` }, { text: 'Image:', math: `A'(${img[0]}, ${img[1]})` })];
    }
    const dx = rng.signed(1, 5);
    let dy = rng.signed(1, 5);
    if (Math.abs(dy) === Math.abs(dx)) dy = dy > 0 ? dy + 1 : dy - 1;
    return [p(`Translate ${named('A', A)} ${moveWords(dx, dy)}.`), steps({ text: 'Add the horizontal move to x.', math: `${A[0]} + (${dx}) = ${A[0] + dx}` }, { text: 'Add the vertical move to y.', math: `${A[1]} + (${dy}) = ${A[1] + dy}` }, { text: 'Image:', math: `A'(${A[0] + dx}, ${A[1] + dy})` })];
  },
  generate: (rng, d, c) => {
    if (c.grade <= 6) {
      if (d <= 1) return rng.chance(0.6) ? coordRead(rng) : coordQuadrant(rng);
      if (d === 2) return coordTranslate(rng, rng.chance(0.4));
      return rng.chance(0.55) ? coordDescribe(rng) : coordReverse(rng);
    }
    if (d <= 2) return rng.chance(0.4) ? coordTranslate(rng, rng.chance(0.3)) : coordReflect(rng);
    if (d === 3) return coordRotate(rng);
    return rng.chance(0.7) ? coordTwoStep(rng) : coordRotate(rng);
  },
  selfCheck: (q) => {
    const pr = (q.params ?? {}) as Params;
    const n = (k: string) => num(pr, k);
    const parsed = (): Pt | null => {
      const mm = /\((-?\d+), (-?\d+)\)/.exec(rightText(q));
      return mm ? [Number(mm[1]), Number(mm[2])] : null;
    };
    const is = (want: Pt) => {
      const got = parsed();
      return got && got[0] === want[0] && got[1] === want[1] ? null : `choice ${rightText(q)} is not (${want[0]}, ${want[1]})`;
    };
    // Rotations are recomputed with trigonometry, reflections with a sign vector.
    const turn = ([x, y]: Pt, deg: number): Pt => {
      const t = (deg * Math.PI) / 180;
      return [Math.round(x * Math.cos(t) - y * Math.sin(t)), Math.round(x * Math.sin(t) + y * Math.cos(t))];
    };
    const flip = ([x, y]: Pt, axis: string): Pt => (axis === 'x' ? [x * 1, y * -1] : [x * -1, y * 1]);
    switch (pr.kind) {
      case 'read':
        return is([n('x'), n('y')]);
      case 'quadrant': {
        const ang = (Math.atan2(n('y'), n('x')) * 180) / Math.PI;
        const want = ang > 0 && ang < 90 ? 'I' : ang > 90 ? 'II' : ang < -90 ? 'III' : 'IV';
        return rightText(q) === `Quadrant ${want}` ? null : 'quadrant choice is wrong';
      }
      case 'translate':
        return is([n('x') + n('dx'), n('y') + n('dy')]);
      case 'translateNum':
        return near(q, pr.axis === 'x' ? n('x') + n('dx') : n('y') + n('dy'));
      case 'describe': {
        const mm = /^(\d+) units? (right|left) and (\d+) units? (up|down)$/.exec(rightText(q));
        if (!mm) return 'description is unreadable';
        const dx = Number(mm[1]) * (mm[2] === 'right' ? 1 : -1);
        const dy = Number(mm[3]) * (mm[4] === 'up' ? 1 : -1);
        return dx === n('bx') - n('ax') && dy === n('by') - n('ay') ? null : 'description does not match';
      }
      case 'reverse':
        return is([n('bx') - n('dx'), n('by') - n('dy')]);
      case 'reflect':
        return is(flip([n('x'), n('y')], String(pr.axis)));
      case 'rotate':
        return is(turn([n('x'), n('y')], pr.turn === 'ccw' ? 90 : pr.turn === 'cw' ? -90 : 180));
      case 'twoStep': {
        const A: Pt = [n('x'), n('y')];
        const s = n('shift');
        const mid = pr.mode === 'reflectY' ? flip(A, 'y') : pr.mode === 'reflectX' ? flip(A, 'x') : turn(A, 180);
        return is(pr.mode === 'reflectX' ? [mid[0], mid[1] + s] : [mid[0] + s, mid[1]]);
      }
      default:
        return 'unknown question kind';
    }
  },
  summary: ['A point is (x, y): x is across (right +, left −), y is up (+) or down (−). Quadrants go I to IV counterclockwise from the top right.', 'A translation adds the moves: right/left change x, up/down change y.', 'Reflect in the x-axis: (x, −y); in the y-axis: (−x, y). Rotate about the origin 180°: (−x, −y); 90° counterclockwise: (−y, x); 90° clockwise: (y, −x).'],
  misconceptions: [
    { id: 'geo_coord_swap', label: 'Swapped x and y', explanation: 'In an ordered pair the x-coordinate (across) always comes first and the y-coordinate (up or down) second. Swapping them names a different point.', fix: 'Say it as you go: “across, then up or down”. Horizontal moves change x; vertical moves change y.' },
    { id: 'geo_coord_sign', label: 'Sign mistake', explanation: 'Left of the y-axis, x is negative. Below the x-axis, y is negative.', fix: 'Check each sign: right +, left −, up +, down −.' },
    { id: 'geo_quadrant_order', label: 'Numbered the quadrants the wrong way', explanation: 'Quadrants are numbered counterclockwise starting at the top right: I, II, III, IV.', fix: 'Start at the top right (both positive) and go counterclockwise, the way the hands of a clock do not turn.' },
    { id: 'geo_translate_direction', label: 'Moved the wrong way', explanation: 'Right and up add to a coordinate; left and down subtract.', fix: 'Write each move with a sign first (for example, 3 left = −3), then add it.' },
    { id: 'geo_reflect_axis', label: 'Reflected in the wrong axis', explanation: 'Reflecting in the x-axis (the horizontal line) flips a point up or down, so only y changes sign. Reflecting in the y-axis flips left or right, so only x changes sign.', fix: 'Picture the mirror line. The coordinate that measures distance across the mirror is the one that changes sign.' },
    { id: 'geo_rotate_direction', label: 'Turned the wrong way', explanation: 'Clockwise is the way clock hands turn; counterclockwise is the other way. They send a point to different quadrants.', fix: 'Trace a quarter turn with your finger from the origin through the point, in the direction given.' },
    { id: 'geo_rotate_rule', label: 'Used a reflection instead of a rotation', explanation: 'A 90° rotation swaps the coordinates and changes one sign. A 180° rotation changes both signs. Changing just one sign is a reflection.', fix: 'Use the rules: 180° (−x, −y), 90° counterclockwise (−y, x), 90° clockwise (y, −x). Check the quadrant with a sketch.' },
    { id: 'geo_transform_order', label: 'Did the steps in the wrong order', explanation: 'With two transformations, doing them in a different order can land in a different place.', fix: 'Do step 1 first and write down the new point, then apply step 2 to that point.' },
    MIS.stoppedEarly,
  ],
};

export const MATH_PACKS_GEOMETRY: SkillPack[] = [pythagoras, circles, volume, angles, areaShapes, unitConvert, coordinates];
