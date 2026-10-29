import { gcdNum, lcmNum, Rational, R } from '../../../../shared/study/rational';
import type { Question } from '../../../../shared/study/types';
import { choice, dec, frac, m, numeric, p, steps, tip, warn, type SkillPack } from '../kit';

const G6 = 'on-elementary-mathematics-g6-math';
const G7 = 'on-elementary-mathematics-g7-math';
const G8 = 'on-elementary-mathematics-g8-math';

const num = (q: Question) => (q.type === 'numeric' ? Rational.parseDecimal(q.answer) ?? parseFrac(q.answer) : null);
function parseFrac(s: string): Rational | null {
  const mm = /^(-?\d+)\/(\d+)$/.exec(s);
  return mm ? new Rational(BigInt(mm[1]!), BigInt(mm[2]!)) : null;
}
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));

export const simplifyFractions: SkillPack = {
  id: 'frac-simplify',
  title: 'Simplifying fractions',
  subject: 'math',
  expectations: [{ id: `${G7}:B1.4`, note: 'Practises using equivalent fractions to write a fraction in simplest form.' }],
  prerequisites: [],
  goal: 'I can write a fraction in simplest form by dividing the numerator and denominator by the same number.',
  explain: (c) => [
    p('Two fractions are **equivalent** when they name the same amount. $$\\frac{6}{8}$$ and $$\\frac{3}{4}$$ are equivalent: if you cut a pizza into 8 slices and eat 6, you have eaten the same amount as 3 slices of a pizza cut into 4.'),
    p('To **simplify** a fraction, divide the numerator (top) and the denominator (bottom) by the same number. The fraction is in **simplest form** when the only number that divides both is 1.'),
    steps({ text: 'Find a number that divides both parts. The greatest common factor (GCF) finishes the job in one step.', math: '\\text{GCF}(6, 8) = 2' }, { text: 'Divide both parts by it.', math: '\\frac{6 \\div 2}{8 \\div 2} = \\frac{3}{4}' }),
    c.simple ? tip('Same number on top and bottom. That is the rule.') : tip('Dividing the top and bottom by the same number is the same as dividing by 1, so the value does not change.'),
  ],
  alternatives: () => ({
    simpler: [p('Keep dividing the top and bottom number by the same small number (2, 3, 5…) until you can’t any more.'), m('\\frac{12}{18} \\to \\frac{6}{9} \\to \\frac{2}{3}')],
    analogy: [p('Think of a chocolate bar. 4 pieces out of 8 is the same amount of chocolate as 1 piece out of 2, if the pieces are twice as big. Simplifying just uses bigger pieces.')],
    visual: [
      { kind: 'diagram', diagram: { type: 'fraction_bar', parts: 8, shaded: 6, label: '6/8' }, alt: 'A bar cut into 8 parts with 6 shaded.' },
      { kind: 'diagram', diagram: { type: 'fraction_bar', parts: 4, shaded: 3, label: '3/4' }, alt: 'A bar of the same length cut into 4 parts with 3 shaded. The shaded lengths match.' },
    ],
    compare: [p('You already know that 50 cents is half of a dollar: $$\\frac{50}{100} = \\frac{1}{2}$$. Simplifying is the same idea.')],
  }),
  example: (rng) => {
    const g = rng.pick([2, 3, 4, 5, 6]);
    const a = rng.int(1, 6);
    let b = rng.int(a + 1, 9);
    while (gcdNum(a, b) !== 1) b++;
    return [
      p(`Simplify $$\\frac{${a * g}}{${b * g}}$$.`),
      steps(
        { text: `Factors of ${a * g} and ${b * g} in common: the greatest is ${g}.`, math: `\\text{GCF}(${a * g}, ${b * g}) = ${g}` },
        { text: `Divide the numerator and denominator by ${g}.`, math: `\\frac{${a * g} \\div ${g}}{${b * g} \\div ${g}} = \\frac{${a}}{${b}}` },
        { text: `${a} and ${b} have no common factor except 1, so $$\\frac{${a}}{${b}}$$ is in simplest form.` },
      ),
    ];
  },
  generate: (rng, d) => {
    const g = d === 1 ? rng.pick([2, 5, 10]) : d === 2 ? rng.pick([2, 3, 4, 5, 6]) : rng.pick([6, 7, 8, 9, 12, 15]);
    const a = rng.int(1, d >= 3 ? 11 : 7);
    let b = rng.int(a + 1, d >= 3 ? 13 : 9);
    while (gcdNum(a, b) !== 1) b++;
    const half = gcdNum(g, 2) === 2 && g > 2 ? g / 2 : null;
    const wrong = half ? [{ value: `${(a * g) / half}/${(b * g) / half}`, misconception: 'not_simplified' }] : [];
    if (d === 4) {
      const n = a * g;
      const dd = b * g;
      return numeric([p(`A class has ${dd} students and ${n} of them walk to school. What fraction of the class walks? Give your answer in simplest form.`)], R(a, b), {
        hints: [`Write it as $$\\frac{${n}}{${dd}}$$ first.`, `What is the greatest number that divides both ${n} and ${dd}?`],
        solution: [m(`\\frac{${n}}{${dd}} = \\frac{${n} \\div ${g}}{${dd} \\div ${g}} = \\frac{${a}}{${b}}`)],
        requireSimplest: true,
        accept: ['fraction'],
        knownWrong: wrong,
        params: { n, d: dd },
      });
    }
    return numeric([p(`Write $$\\frac{${a * g}}{${b * g}}$$ in simplest form.`)], R(a, b), {
      hints: [`Find a number that divides both ${a * g} and ${b * g}.`, `The greatest common factor of ${a * g} and ${b * g} is ${g}.`],
      solution: [m(`\\frac{${a * g}}{${b * g}} = \\frac{${a * g} \\div ${g}}{${b * g} \\div ${g}} = \\frac{${a}}{${b}}`)],
      requireSimplest: true,
      accept: ['fraction'],
      knownWrong: wrong,
      params: { n: a * g, d: b * g },
    });
  },
  selfCheck: (q) => {
    const v = num(q);
    const pr = q.params as { n: number; d: number };
    return v && close(v.toNumber(), pr.n / pr.d) && gcdNum(Number(v.n), Number(v.d)) === 1 ? null : 'simplified value does not match';
  },
  summary: ['Equivalent fractions name the same amount.', 'Divide the numerator and denominator by the same number to simplify.', 'Simplest form: the only common factor left is 1.'],
  misconceptions: [
    { id: 'not_simplified', label: 'Stopped simplifying too early', explanation: 'The fraction is smaller than before, but its numerator and denominator still share a factor.', fix: 'Check again: can both numbers still be divided by 2, 3, 5 or another number? Using the greatest common factor gets there in one step.' },
  ],
};

function addSubDenominators(rng: { int: (a: number, b: number) => number; pick: <T>(x: readonly T[]) => T }, d: number): [number, number] {
  if (d === 1) {
    const den = rng.pick([4, 5, 6, 8, 10, 12]);
    return [den, den];
  }
  if (d === 2) {
    const a = rng.pick([2, 3, 4, 5]);
    return [a, a * rng.pick([2, 3])];
  }
  const pairs: [number, number][] = [
    [3, 4],
    [2, 5],
    [4, 6],
    [6, 8],
    [3, 5],
    [5, 6],
    [4, 10],
    [8, 12],
    [6, 9],
  ];
  return rng.pick(pairs);
}

export const addSubtractFractions: SkillPack = {
  id: 'frac-addsub',
  title: 'Adding and subtracting fractions',
  subject: 'math',
  expectations: [
    { id: `${G6}:B2.5`, note: 'Adds and subtracts fractions with like and unlike denominators. Tools such as fraction strips appear in explanations; their use is not assessed.', levels: [1, 2, 3] },
    { id: `${G7}:B2.5`, note: 'Adds and subtracts fractions, including by creating equivalent fractions.', levels: [1, 2, 3, 4] },
    { id: `${G8}:B2.5`, note: 'Adds and subtracts fractions, including mixed numbers and negative results.', levels: [2, 3, 4] },
  ],
  prerequisites: ['frac-simplify'],
  goal: 'I can add and subtract fractions, making a common denominator when the denominators are different.',
  explain: (c) => [
    p('You can only add or subtract fractions when the pieces are the **same size**, which means the denominators must match.'),
    steps(
      { text: 'If the denominators are different, find a common denominator. The lowest common multiple (LCM) of the denominators keeps the numbers small.', math: '\\frac{1}{4} + \\frac{2}{3}: \\; \\text{LCM}(4, 3) = 12' },
      { text: 'Rewrite each fraction as an equivalent fraction with that denominator.', math: '\\frac{1}{4} = \\frac{3}{12}, \\quad \\frac{2}{3} = \\frac{8}{12}' },
      { text: 'Add or subtract the numerators. Keep the denominator.', math: '\\frac{3}{12} + \\frac{8}{12} = \\frac{11}{12}' },
      { text: 'Simplify if you can.' },
    ),
    warn('Never add the denominators. Twelfths plus twelfths are still twelfths.'),
    ...(c.grade >= 8 ? [p('With mixed numbers, you can change them to improper fractions first, or work with the whole numbers and the fractions separately.')] : []),
  ],
  alternatives: () => ({
    simpler: [p('Make the bottom numbers the same. Then add the top numbers. The bottom number stays the same.')],
    analogy: [p('You can’t add 1 metre and 30 centimetres as “31” of anything. First change metres to centimetres: 100 cm + 30 cm = 130 cm. A common denominator is like a common unit.')],
    visual: [
      { kind: 'diagram', diagram: { type: 'fraction_bar', parts: 12, shaded: 3, label: '1/4 = 3/12' }, alt: 'A bar cut into 12 parts with 3 shaded, showing one quarter.' },
      { kind: 'diagram', diagram: { type: 'fraction_bar', parts: 12, shaded: 8, label: '2/3 = 8/12' }, alt: 'A bar cut into 12 parts with 8 shaded, showing two thirds.' },
      p('Together that is 11 of the 12 parts: $$\\frac{11}{12}$$.'),
    ],
    compare: [p('Adding $$\\frac{2}{5} + \\frac{1}{5}$$ is like adding 2 apples and 1 apple: 3 apples. Here the “apples” are fifths, so the answer is $$\\frac{3}{5}$$.')],
  }),
  example: (rng) => {
    const [a, b] = [rng.pick([3, 4, 5]), rng.pick([2, 6])];
    const x = R(1, a);
    const y = R(1, b);
    const l = lcmNum(a, b);
    const s = x.add(y);
    return [
      p(`Find $$\\frac{1}{${a}} + \\frac{1}{${b}}$$.`),
      steps(
        { text: `The LCM of ${a} and ${b} is ${l}.` },
        { text: 'Rewrite both fractions.', math: `\\frac{1}{${a}} = \\frac{${l / a}}{${l}}, \\quad \\frac{1}{${b}} = \\frac{${l / b}}{${l}}` },
        { text: 'Add the numerators.', math: `\\frac{${l / a}}{${l}} + \\frac{${l / b}}{${l}} = \\frac{${l / a + l / b}}{${l}}` },
        { text: s.d === BigInt(l) ? 'It is already in simplest form.' : 'Simplify.', math: s.d === BigInt(l) ? undefined : `= ${frac(s)}` },
      ),
    ];
  },
  generate: (rng, d, c) => {
    const [da, db] = addSubDenominators(rng, d);
    let na = rng.int(1, da - 1);
    let nb = rng.int(1, db - 1);
    const subtract = rng.next() < 0.45;
    let x = R(na, da);
    let y = R(nb, db);
    if (d === 4 || (c.grade >= 8 && d >= 3)) {
      // Mixed numbers.
      const wa = rng.int(1, 4);
      const wb = rng.int(1, 3);
      x = x.add(wa);
      y = y.add(wb);
    }
    if (subtract && x.cmp(y) < 0 && !(c.grade >= 8 && d === 4)) [x, y] = [y, x];
    na = Number(x.n);
    nb = Number(y.n);
    const ans = subtract ? x.sub(y) : x.add(y);
    const op = subtract ? '-' : '+';
    const across = subtract ? null : new Rational(x.n * 1n + y.n * 1n, x.d + y.d);
    const knownWrong = [
      ...(across && x.d !== y.d ? [{ value: across.toString(), misconception: 'frac_add_across' }] : []),
      ...(!subtract && x.d !== y.d ? [{ value: new Rational(x.n * y.d + y.n * x.d, x.d).toString(), misconception: 'frac_partial_rename' }] : []),
    ];
    const l = lcmNum(Number(x.d), Number(y.d));
    const disp = (r: Rational) => frac(r, d >= 3);
    const solution = [
      steps(
        { text: `Common denominator: the LCM of ${x.d} and ${y.d} is ${l}.` },
        { text: 'Rewrite the fractions.', math: `${frac(x)} = \\frac{${x.mul(l).toString()}}{${l}}, \\quad ${frac(y)} = \\frac{${y.mul(l).toString()}}{${l}}` },
        { text: subtract ? 'Subtract the numerators.' : 'Add the numerators.', math: `\\frac{${x.mul(l)} ${op} ${y.mul(l)}}{${l}} = \\frac{${ans.mul(l)}}{${l}}` },
        { text: 'Simplify.', math: `= ${frac(ans)}${ans.abs().cmp(1) > 0 && !ans.isInteger() ? ` = ${frac(ans, true)}` : ''}` },
      ),
    ];
    const contextual = d === 3 && rng.next() < 0.6;
    const prompt = contextual
      ? subtract
        ? [p(`A recipe needs $$${disp(x)}$$ cups of flour. You have already added $$${disp(y)}$$ cups. How many more cups do you need? Give your answer as a fraction or mixed number in simplest form.`)]
        : [p(`Maya walked $$${disp(x)}$$ km to the library and then $$${disp(y)}$$ km to the park. How far did she walk altogether? Give your answer as a fraction or mixed number in simplest form.`)]
      : [p(`Calculate. Give your answer in simplest form.`), m(`${disp(x)} ${op} ${disp(y)}`)];
    return numeric(prompt, ans, {
      hints: [x.d === y.d ? 'The denominators already match. Work with the numerators.' : `Find a common denominator for ${x.d} and ${y.d}.`, `Rewrite both fractions with denominator ${l}, then ${subtract ? 'subtract' : 'add'} the numerators.`],
      solution,
      requireSimplest: true,
      accept: ['fraction', 'mixed', 'integer'],
      unit: contextual ? (subtract ? 'cups' : 'km') : undefined,
      knownWrong,
      params: { a: x.toString(), b: y.toString(), op },
    });
  },
  selfCheck: (q) => {
    const pr = q.params as { a: string; b: string; op: string };
    const [a, b] = [pr.a, pr.b].map((s) => (s.includes('/') ? Number(s.split('/')[0]) / Number(s.split('/')[1]) : Number(s)));
    const v = num(q);
    return v && close(v.toNumber(), pr.op === '+' ? a! + b! : a! - b!) ? null : 'sum does not match';
  },
  summary: ['Fractions can be added or subtracted only when the denominators match.', 'Use equivalent fractions with a common denominator (the LCM keeps numbers small).', 'Add or subtract the numerators, keep the denominator, then simplify.'],
  misconceptions: [
    { id: 'frac_add_across', label: 'Added the denominators', explanation: 'Adding top numbers and bottom numbers separately treats the fractions as if their pieces were different sizes that can be mixed. $$\\frac{1}{2} + \\frac{1}{2}$$ would give $$\\frac{2}{4}$$, which is only one half, not one whole.', fix: 'Make the denominators the same first, then add only the numerators.' },
    { id: 'frac_partial_rename', label: 'Renamed only one fraction', explanation: 'The denominator was changed, but the matching numerator wasn’t multiplied by the same number.', fix: 'Whatever you multiply the denominator by, multiply the numerator by the same number.' },
    { id: 'not_simplified', label: 'Stopped simplifying too early', explanation: 'The answer is right but can still be divided by a common factor.', fix: 'Divide the numerator and denominator by their greatest common factor.' },
  ],
};

export const multiplyDivideFractions: SkillPack = {
  id: 'frac-muldiv',
  title: 'Multiplying and dividing fractions',
  subject: 'math',
  expectations: [
    { id: `${G6}:B2.9`, note: 'Multiplies whole numbers by proper fractions.', levels: [1, 2] },
    { id: `${G6}:B2.10`, note: 'Divides whole numbers by proper fractions.', levels: [1, 2] },
    { id: `${G7}:B2.8`, note: 'Multiplies and divides fractions by fractions. Tools are shown in explanations, not assessed.', levels: [2, 3] },
    { id: `${G8}:B2.6`, note: 'Multiplies and divides fractions by fractions, whole numbers and mixed numbers.', levels: [2, 3, 4] },
  ],
  prerequisites: ['frac-simplify'],
  goal: 'I can multiply and divide with fractions and explain what the answer means.',
  explain: () => [
    p('**Multiplying:** multiply the numerators together and the denominators together. $$\\frac{2}{3} \\times \\frac{3}{4}$$ means “two thirds **of** three quarters”.'),
    m('\\frac{2}{3} \\times \\frac{3}{4} = \\frac{2 \\times 3}{3 \\times 4} = \\frac{6}{12} = \\frac{1}{2}'),
    p('**Dividing:** dividing by a fraction asks “how many of these fit?”. $$3 \\div \\frac{1}{2}$$ asks how many halves fit in 3 (six). To calculate, multiply by the **reciprocal** (flip the second fraction).'),
    m('\\frac{3}{4} \\div \\frac{1}{8} = \\frac{3}{4} \\times \\frac{8}{1} = \\frac{24}{4} = 6'),
    tip('A whole number is a fraction over 1: $$5 = \\frac{5}{1}$$. Change mixed numbers to improper fractions before multiplying or dividing.'),
  ],
  alternatives: () => ({
    simpler: [p('Times: top × top, bottom × bottom. Divide: flip the second fraction, then times.')],
    analogy: [p('Dividing 3 pizzas into half-pizza servings gives 6 servings. Dividing by a number smaller than 1 gives a bigger answer, because each serving is small.')],
    visual: [{ kind: 'diagram', diagram: { type: 'area_model', rows: 3, cols: 4, shadedRows: 2, shadedCols: 3 }, alt: 'A rectangle split into 3 rows and 4 columns. 2 rows and 3 columns overlap in 6 of the 12 squares, showing 2/3 × 3/4 = 6/12.' }],
    compare: [p('You know that half of 10 is 5. That is $$\\frac{1}{2} \\times 10 = 5$$. Multiplying by a fraction smaller than 1 makes the number smaller.')],
  }),
  example: (rng) => {
    const a = R(rng.int(1, 3), 4);
    const b = R(rng.int(1, 2), 3);
    const prod = a.mul(b);
    return [
      p(`Find $$${frac(a)} \\times ${frac(b)}$$.`),
      steps({ text: 'Multiply the numerators and the denominators.', math: `\\frac{${a.n} \\times ${b.n}}{${a.d} \\times ${b.d}} = \\frac{${a.n * b.n}}{${a.d * b.d}}` }, { text: 'Simplify.', math: `= ${frac(prod)}` }),
    ];
  },
  generate: (rng, d, c) => {
    const divide = rng.next() < 0.5;
    let x: Rational;
    let y: Rational;
    if (c.grade === 6 || d === 1) {
      const w = rng.int(2, 12);
      const den = rng.pick([2, 3, 4, 5, 6, 8]);
      const f = R(rng.int(1, den - 1), den);
      x = R(w);
      y = f;
    } else {
      const da = rng.pick([2, 3, 4, 5, 6, 8]);
      const db = rng.pick([2, 3, 4, 5, 6, 9]);
      x = R(rng.int(1, da - 1), da);
      y = R(rng.int(1, db - 1), db);
      if (d >= 4) x = x.add(rng.int(1, 3));
      if (d >= 3 && rng.next() < 0.4) y = R(rng.int(2, 5));
    }
    const ans = divide ? x.div(y) : x.mul(y);
    const op = divide ? '\\div' : '\\times';
    const knownWrong = divide ? [{ value: x.mul(y).toString(), misconception: 'frac_div_no_flip' }, { value: y.div(x).toString(), misconception: 'frac_div_flip_first' }] : [{ value: new Rational(x.n * y.n, x.d + y.d).toString(), misconception: 'frac_mul_add_denominators' }];
    const recip = new Rational(y.d, y.n);
    return numeric([p('Calculate. Give your answer in simplest form (a mixed number is fine).'), m(`${frac(x, true)} ${op} ${frac(y, true)}`)], ans, {
      hints: divide ? ['Dividing by a fraction is the same as multiplying by its reciprocal.', `The reciprocal of $$${frac(y)}$$ is $$${frac(recip)}$$.`] : ['Write any whole or mixed numbers as fractions first.', 'Multiply the numerators, then the denominators.'],
      solution: [
        steps(
          ...(divide ? [{ text: 'Multiply by the reciprocal of the second number.', math: `${frac(x)} \\div ${frac(y)} = ${frac(x)} \\times ${frac(recip)}` }] : []),
          { text: 'Multiply numerators and denominators.', math: `= ${frac(ans)}` },
          ...(ans.abs().cmp(1) > 0 && !ans.isInteger() ? [{ text: 'As a mixed number:', math: frac(ans, true) }] : []),
        ),
      ],
      requireSimplest: true,
      accept: ['fraction', 'mixed', 'integer'],
      knownWrong,
      params: { a: x.toString(), b: y.toString(), op: divide ? '/' : '*' },
    });
  },
  selfCheck: (q) => {
    const pr = q.params as { a: string; b: string; op: string };
    const f = (s: string) => (s.includes('/') ? Number(s.split('/')[0]) / Number(s.split('/')[1]) : Number(s));
    const v = num(q);
    return v && close(v.toNumber(), pr.op === '/' ? f(pr.a) / f(pr.b) : f(pr.a) * f(pr.b)) ? null : 'product/quotient does not match';
  },
  summary: ['Multiply fractions: numerator × numerator, denominator × denominator.', 'Divide by a fraction by multiplying by its reciprocal.', 'Write whole and mixed numbers as fractions first, and simplify at the end.'],
  misconceptions: [
    { id: 'frac_div_no_flip', label: 'Multiplied instead of dividing', explanation: 'The second fraction was not flipped, so the answer is the product, not the quotient.', fix: 'Keep the first fraction, change ÷ to ×, and flip the second fraction.' },
    { id: 'frac_div_flip_first', label: 'Flipped the wrong fraction', explanation: 'The first fraction was flipped instead of the divisor.', fix: 'Only the number you are dividing **by** (the second one) gets flipped.' },
    { id: 'frac_mul_add_denominators', label: 'Added the denominators when multiplying', explanation: 'In multiplication, the denominators are multiplied too.', fix: 'Multiply straight across: top × top and bottom × bottom.' },
    { id: 'not_simplified', label: 'Stopped simplifying too early', explanation: 'The answer is right but can still be simplified.', fix: 'Divide the numerator and denominator by their greatest common factor.' },
  ],
};

const FDP: [string, Rational][] = [
  ['1/2', R(1, 2)],
  ['1/4', R(1, 4)],
  ['3/4', R(3, 4)],
  ['1/5', R(1, 5)],
  ['2/5', R(2, 5)],
  ['3/5', R(3, 5)],
  ['1/10', R(1, 10)],
  ['3/10', R(3, 10)],
  ['7/10', R(7, 10)],
  ['1/20', R(1, 20)],
  ['1/100', R(1, 100)],
  ['3/8', R(3, 8)],
  ['1/8', R(1, 8)],
  ['5/8', R(5, 8)],
  ['9/20', R(9, 20)],
  ['13/25', R(13, 25)],
];

export const fractionDecimalPercent: SkillPack = {
  id: 'fdp-convert',
  title: 'Fractions, decimals and percents',
  subject: 'math',
  expectations: [
    { id: `${G7}:B1.7`, note: 'Converts between fractions, decimal numbers and percents.' },
    { id: `${G7}:B2.2`, note: 'Practises recall of commonly used percent, fraction and decimal equivalents.', levels: [1, 2] },
    { id: `${G8}:B1.4`, note: 'Uses fractions, decimals and percents interchangeably, including percents over 100% and under 1%.', levels: [2, 3, 4] },
  ],
  prerequisites: ['frac-simplify'],
  goal: 'I can change a number between fraction, decimal and percent form.',
  explain: () => [
    p('Fractions, decimals and percents are three ways to write the same amount. **Percent** means “out of 100”.'),
    { kind: 'table', header: ['Fraction', 'Decimal', 'Percent'], rows: [['$$\\frac{1}{2}$$', '0.5', '50%'], ['$$\\frac{1}{4}$$', '0.25', '25%'], ['$$\\frac{1}{10}$$', '0.1', '10%'], ['$$\\frac{3}{4}$$', '0.75', '75%']] },
    steps({ text: 'Fraction → decimal: divide the numerator by the denominator.', math: '\\frac{3}{8} = 3 \\div 8 = 0.375' }, { text: 'Decimal → percent: multiply by 100.', math: '0.375 \\times 100 = 37.5\\%' }, { text: 'Percent → fraction: write it over 100 and simplify.', math: '35\\% = \\frac{35}{100} = \\frac{7}{20}' }),
  ],
  alternatives: () => ({
    simpler: [p('Percent is “out of 100”. 25% is 25 out of 100, which is the same as 0.25 or one quarter.')],
    analogy: [p('Money helps: a quarter is 25 cents, which is $0.25, which is 25% of a dollar.')],
    visual: [{ kind: 'diagram', diagram: { type: 'area_model', rows: 10, cols: 10, shadedRows: 10, shadedCols: 3 }, alt: 'A 10 by 10 grid with 30 of the 100 squares shaded: 30/100 = 0.3 = 30%.' }],
  }),
  example: (rng) => {
    const [f, v] = rng.pick(FDP.slice(10));
    return [p(`Write $$\\frac{${f.split('/')[0]}}{${f.split('/')[1]}}$$ as a decimal and as a percent.`), steps({ text: 'Divide.', math: `${f.replace('/', ' \\div ')} = ${dec(v)}` }, { text: 'Multiply by 100 for the percent.', math: `${dec(v)} \\times 100 = ${dec(v.mul(100))}\\%` })];
  },
  generate: (rng, d, c) => {
    const pool = d === 1 ? FDP.slice(0, 11) : FDP;
    const [f, v] = rng.pick(pool);
    const [fn, fd] = f.split('/');
    const mode = rng.pick(['f2p', 'p2f', 'd2p', 'p2d', 'f2d'] as const);
    if (c.grade >= 8 && d >= 3 && rng.next() < 0.5) {
      // Percents above 100% or below 1%.
      const big = rng.next() < 0.5;
      const val = big ? R(rng.int(101, 350)).div(100) : R(rng.pick([1, 2, 5]), 1000);
      return numeric([p(`Write ${dec(val)} as a percent.`)], val.mul(100), {
        hints: ['Multiply by 100 to change a decimal to a percent.', big ? 'More than 1 whole means more than 100%.' : 'Less than one hundredth means less than 1%.'],
        solution: [m(`${dec(val)} \\times 100 = ${dec(val.mul(100))}\\%`)],
        accept: ['decimal', 'integer', 'percent'],
        unit: '%',
        knownWrong: [{ value: dec(val.mul(10)), misconception: 'percent_place_value' }, { value: dec(val), misconception: 'percent_forgot_100' }],
        params: { value: val.toString(), mode: 'd2p' },
      });
    }
    const pct = v.mul(100);
    switch (mode) {
      case 'f2p':
        return numeric([p(`Write $$\\frac{${fn}}{${fd}}$$ as a percent.`)], pct, {
          hints: ['Change the fraction to a decimal first by dividing.', 'Then multiply the decimal by 100.'],
          solution: [m(`\\frac{${fn}}{${fd}} = ${dec(v)} = ${dec(pct)}\\%`)],
          unit: '%',
          accept: ['decimal', 'integer', 'percent'],
          knownWrong: [{ value: dec(v), misconception: 'percent_forgot_100' }],
          params: { value: v.toString(), mode },
        });
      case 'p2f':
        return numeric([p(`Write ${dec(pct)}% as a fraction in simplest form.`)], v, {
          hints: ['Percent means “out of 100”.', `Write $$\\frac{${dec(pct)}}{100}$$ and simplify.`],
          solution: [m(`${dec(pct)}\\% = \\frac{${dec(pct)}}{100} = ${frac(v)}`)],
          requireSimplest: true,
          accept: ['fraction'],
          params: { value: v.toString(), mode },
        });
      case 'd2p':
        return numeric([p(`Write ${dec(v)} as a percent.`)], pct, {
          hints: ['Multiply by 100.', 'Move the decimal point two places to the right.'],
          solution: [m(`${dec(v)} \\times 100 = ${dec(pct)}\\%`)],
          unit: '%',
          accept: ['decimal', 'integer', 'percent'],
          knownWrong: [{ value: dec(v.mul(10)), misconception: 'percent_place_value' }],
          params: { value: v.toString(), mode },
        });
      case 'p2d':
        return numeric([p(`Write ${dec(pct)}% as a decimal.`)], v, {
          hints: ['Divide by 100.', 'Move the decimal point two places to the left.'],
          solution: [m(`${dec(pct)}\\% = ${dec(pct)} \\div 100 = ${dec(v)}`)],
          accept: ['decimal'],
          knownWrong: [{ value: dec(pct.div(10)), misconception: 'percent_place_value' }],
          params: { value: v.toString(), mode },
        });
      default:
        return choice(rng, [p(`Which decimal is equal to $$\\frac{${fn}}{${fd}}$$?`)], dec(v), [{ text: dec(v.mul(10)), misconception: 'percent_place_value' }, { text: `0.${fn}${fd}`, misconception: 'frac_digits_as_decimal' }, { text: dec(v.div(10)) }], {
          hints: ['Divide the numerator by the denominator.'],
          solution: [m(`${fn} \\div ${fd} = ${dec(v)}`)],
          params: { value: v.toString(), mode },
        });
    }
  },
  selfCheck: (q) => {
    const pr = q.params as { value: string; mode: string };
    const [a, b] = pr.value.includes('/') ? pr.value.split('/').map(Number) : [Number(pr.value), 1];
    const v = a! / b!;
    if (q.type === 'numeric') {
      const got = num(q)!.toNumber();
      const want = pr.mode === 'f2p' || pr.mode === 'd2p' ? v * 100 : v;
      return close(got, want) ? null : 'conversion does not match';
    }
    if (q.type === 'multiple_choice') return close(Number(q.choices.find((x) => x.id === q.answer)!.text), v) ? null : 'decimal choice does not match';
    return null;
  },
  summary: ['Fractions, decimals and percents can name the same amount.', 'Fraction → decimal: divide. Decimal → percent: × 100.', 'Percent → fraction: write it over 100 and simplify.'],
  misconceptions: [
    { id: 'percent_forgot_100', label: 'Forgot to multiply by 100', explanation: 'A decimal like 0.4 is 40 hundredths, so it is 40%, not 0.4%.', fix: 'Decimal to percent: multiply by 100.' },
    { id: 'percent_place_value', label: 'Moved the decimal point the wrong number of places', explanation: 'Converting between decimals and percents moves the point exactly two places.', fix: 'Count two places: × 100 to get a percent, ÷ 100 to get a decimal.' },
    { id: 'frac_digits_as_decimal', label: 'Wrote the digits of the fraction after a decimal point', explanation: '$$\\frac{1}{4}$$ is not 0.14. A fraction is a division.', fix: 'Divide the numerator by the denominator.' },
  ],
};
