import { parseStudentNumber, R, Rational } from '../../../../shared/study/rational';
import type { Block, KnownWrong, Misconception, Question } from '../../../../shared/study/types';
import { choice, dec, frac, m, numeric, p, roundTo, steps, tex, tip, trueFalse, warn, type Draft, type Rng, type SkillPack } from '../kit';

/**
 * Ratio, rate, percent, financial and probability packs (Grades 6–9). Every answer key is computed with exact
 * rationals. Money is rounded to the cent with an exact rounded key; exchange rates are always labelled as made-up
 * practice rates; probabilities are checked by listing every equally likely outcome.
 */

const G6 = 'on-elementary-mathematics-g6-math';
const G7 = 'on-elementary-mathematics-g7-math';
const G8 = 'on-elementary-mathematics-g8-math';
const W = 'on-mth1w';

const NAMES = ['Amira', 'Liam', 'Priya', 'Mateo', 'Aiyana', 'Noah', 'Mei', 'Jaden', 'Zara', 'Owen', 'Fatima', 'Kai', 'Sofia', 'Ethan', 'Nia', 'Arjun', 'Chloé', 'Malik', 'Hana', 'Lucas'] as const;

type Step = { text: string; math?: string };
type Params = Record<string, unknown>;
type Wrong = [Rational | null | undefined, string];

const rat = (v: number | Rational) => Rational.of(v);

// ─────────── Formatting ───────────

function group(s: string, sep: string, minus: string): string {
  const neg = s.startsWith('-');
  const [i = '', f] = (neg ? s.slice(1) : s).split('.');
  const ii = i.length >= 5 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : i;
  return `${neg ? minus : ''}${ii}${f === undefined ? '' : `.${f}`}`;
}
/** A number for plain text: 12.5, 10 000. */
const nt = (v: Rational | number) => group(dec(v), ' ', '−');
/** A number inside LaTeX: 12.5, 10\,000. */
const nl = (v: Rational | number) => group(dec(v), '\\,', '-');

/** Rounded to `places` decimals and written with exactly that many: "12.50". */
function fixed(v: Rational, places: number): string {
  const s = dec(roundTo(v, places));
  if (places === 0) return s;
  const neg = s.startsWith('-');
  const [i = '0', f = ''] = (neg ? s.slice(1) : s).split('.');
  return `${neg ? '-' : ''}${i}.${f.padEnd(places, '0')}`;
}
/** Money in plain text: "$45", "$6.90". */
const cash = (v: Rational | number) => {
  const r = rat(v);
  return `$${r.isInteger() ? nt(r) : group(fixed(r, 2), ' ', '−')}`;
};
/** Money inside LaTeX. */
const cashL = (v: Rational | number) => {
  const r = rat(v);
  return `\\$${r.isInteger() ? nl(r) : group(fixed(r, 2), '\\,', '-')}`;
};
/** Truncates (cuts off) a positive value to `places` decimals. */
function trunc(v: Rational, places: number): Rational {
  const scale = 10n ** BigInt(places);
  return new Rational((v.n * scale) / v.d, scale);
}
/** A long exact decimal for a worked solution: exact if short, otherwise four decimals and "…". */
const longShow = (v: Rational) => (v.toDecimal(4) !== null ? nl(v) : `${nl(trunc(v, 4))}\\ldots`);
const pctTex = (v: Rational | number) => `${nl(v)}\\%`;

// ─────────── Answers ───────────

/** Known wrong answers: only values that differ from the key (beyond any tolerance) and that a student could type. */
function wrongs(answer: Rational, list: Wrong[], tol?: Rational, asFraction = false): KnownWrong[] {
  const out: KnownWrong[] = [];
  const seen: Rational[] = [answer];
  for (const [v, misconception] of list) {
    if (!v) continue;
    if (answer.cmp(0) > 0 && v.cmp(0) <= 0) continue;
    const s = asFraction ? v.toString() : v.toDecimal(6);
    if (s === null || seen.some((x) => x.eq(v)) || (tol && v.sub(answer).abs().cmp(tol) <= 0)) continue;
    seen.push(v);
    out.push({ value: s, misconception });
  }
  return out;
}

interface AnsOpts {
  hints: string[];
  solution: Block[];
  wrong?: Wrong[];
  params: Params;
  unit?: string;
  tol?: Rational;
}

/** A whole number or terminating decimal answer. */
function decAns(prompt: Block[], answer: Rational, o: AnsOpts): Draft {
  return numeric(prompt, answer, {
    hints: o.hints,
    solution: o.solution,
    unit: o.unit,
    accept: ['integer', 'decimal'],
    tolerance: o.tol ? dec(o.tol) : undefined,
    knownWrong: wrongs(answer, o.wrong ?? [], o.tol),
    params: o.params,
  });
}

/** Money (or a currency amount): the key is rounded to `places` decimals and stored as "12.50". */
function moneyAns(prompt: Block[], answer: Rational, o: AnsOpts & { places?: number }): Draft {
  const places = o.places ?? 2;
  const key = roundTo(answer, places);
  return numeric(prompt, fixed(key, places), {
    hints: o.hints,
    solution: o.solution,
    unit: o.unit,
    accept: ['integer', 'decimal'],
    tolerance: o.tol ? dec(o.tol) : undefined,
    knownWrong: wrongs(
      key,
      (o.wrong ?? []).map(([v, mis]): Wrong => [v ? roundTo(v, places) : v, mis]),
      o.tol,
    ),
    params: o.params,
  });
}

/** A fraction in simplest form (0 and 1 may be typed as whole numbers). */
function fracAns(prompt: Block[], answer: Rational, o: AnsOpts): Draft {
  return numeric(prompt, answer, {
    hints: o.hints,
    solution: o.solution,
    accept: ['fraction', 'integer'],
    requireSimplest: true,
    knownWrong: wrongs(answer, o.wrong ?? [], undefined, true),
    params: o.params,
  });
}

/** A percent: the key is the number in front of the % sign. */
function pctAns(prompt: Block[], pct: Rational, o: AnsOpts): Draft {
  return numeric(prompt, pct, {
    hints: o.hints,
    solution: o.solution,
    unit: '%',
    accept: ['integer', 'decimal', 'percent'],
    knownWrong: wrongs(pct, o.wrong ?? []),
    params: o.params,
  });
}

// ─────────── Independent checks ───────────

const keyNum = (q: Question): number | null => (q.type === 'numeric' ? (parseStudentNumber(q.answer)?.value.toNumber() ?? null) : null);
function near(q: Question, want: number, slack = 0): string | null {
  const got = keyNum(q);
  if (got === null || !Number.isFinite(want)) return 'key is not a number';
  return Math.abs(got - want) <= slack + 1e-9 * Math.max(1, Math.abs(want)) ? null : `key ${got} does not match ${want}`;
}
const rightText = (q: Question) => (q.type === 'multiple_choice' ? (q.choices.find((c) => c.id === q.answer)?.text ?? '') : '');
const prm = (q: Question) => (q.params ?? {}) as Params;
const num = (pr: Params, k: string) => Number(pr[k]);
const tfIs = (q: Question, truth: boolean) => (q.type === 'true_false' && q.answer === truth ? null : 'true/false key is wrong');

/** Evaluates a plain calculation such as "$$360 \div 10 \div 2$$" or "24 + 12" with ordinary order of operations. */
function evalCalc(src: string): number | null {
  const t = src
    .replace(/\$\$/g, '')
    .replace(/\\div/g, '/')
    .replace(/\\times/g, '*')
    .replace(/\\,/g, '')
    .replace(/\s+/g, '');
  let i = 0;
  const atom = (): number | null => {
    const mm = /^\d+(\.\d+)?/.exec(t.slice(i));
    if (!mm) return null;
    i += mm[0].length;
    return Number(mm[0]);
  };
  const term = (): number | null => {
    let v = atom();
    while (v !== null && (t[i] === '*' || t[i] === '/')) {
      const op = t[i++];
      const w = atom();
      if (w === null) return null;
      v = op === '*' ? v * w : v / w;
    }
    return v;
  };
  let v = term();
  while (v !== null && (t[i] === '+' || t[i] === '-')) {
    const op = t[i++];
    const w = term();
    if (w === null) return null;
    v = op === '+' ? v + w : v - w;
  }
  return i === t.length ? v : null;
}

/** Choice questions whose options are calculations: exactly the right one must equal `want`. */
function checkCalcChoice(q: Question, want: number): string | null {
  if (q.type !== 'multiple_choice') return 'expected a choice question';
  for (const c of q.choices) {
    const v = evalCalc(c.text);
    if (v === null) return `cannot evaluate ${c.text}`;
    const hit = Math.abs(v - want) < 1e-9;
    if (hit !== (c.id === q.answer)) return `option ${c.text} is marked wrongly`;
  }
  return null;
}

// ─────────── Shared misconceptions ───────────

const MIS = {
  tenthHundredth: {
    id: 'ratio_pct_tenth_hundredth',
    label: 'Mixed up 10% and 1%',
    explanation: '10% is one tenth, so you divide by 10. 1% is one hundredth, so you divide by 100. Mixing them up makes the answer 10 times too big or too small.',
    fix: 'Say it to yourself: “10%, divide by 10; 1%, divide by 100.” Then check that 1% is much smaller than 10%.',
  },
  divideByNumber: {
    id: 'ratio_pct_divide_by_number',
    label: 'Divided by the percent number',
    explanation: '25% does not mean “divide by 25”. 25% means 25 out of every 100, which is one quarter, so you divide by 4.',
    fix: 'Change the percent to a fraction first: 50% = one half, 25% = one quarter, 10% = one tenth, 5% = one twentieth.',
  },
  addNumber: {
    id: 'ratio_pct_add_number',
    label: 'Used the percent as a plain number',
    explanation: 'Adding or subtracting 5% is not the same as adding or subtracting 5. 5% of 300 is 15, so the percent has to be worked out from the whole amount first.',
    fix: 'Find the percent of the whole amount first. Then add or subtract that amount.',
  },
  halfOfWhole: {
    id: 'ratio_pct_half_of_whole',
    label: 'Halved the whole instead of 10%',
    explanation: '5% is half of 10%, not half of the whole number. Half of the whole number is 50%.',
    fix: 'Find 10% first (divide by 10), then halve that answer to get 5%.',
  },
  noHundred: {
    id: 'ratio_pct_no_hundred',
    label: 'Forgot that percent means “out of 100”',
    explanation: '15% of 40 is not 15 × 40 = 600. Percent means per hundred, so 15% of something is less than the whole thing.',
    fix: 'A percent under 100% always gives less than the whole. Build it from 10% (divide by 10) and 1% (divide by 100).',
  },
  reverse: {
    id: 'ratio_pct_reverse',
    label: 'Took a percent of the part instead of finding the whole',
    explanation: 'When 10% of a number is 8, the 8 is only a small piece. The whole number must be bigger: ten pieces of 8.',
    fix: 'Ask: how many of these pieces make 100%? Then multiply the part by that number.',
  },
  amountOnly: {
    id: 'ratio_change_amount_only',
    label: 'Gave the change, not the new amount',
    explanation: 'The percent tells you how much the number goes up or down. The question asks for the number after the change.',
    fix: 'After finding the percent, add it (increase) or subtract it (decrease) from the starting number.',
  },
  direction: {
    id: 'ratio_change_direction',
    label: 'Increased instead of decreased (or the other way round)',
    explanation: 'A discount, a drop or a loss makes the number smaller. A rise, growth or gain makes it bigger.',
    fix: 'Before calculating, decide whether the answer should be bigger or smaller than the starting number.',
  },
  sameBase: {
    id: 'ratio_change_same_base',
    label: 'Took both percents of the starting amount',
    explanation: 'In two changes in a row, the second percent is taken of the new amount, not of the starting amount.',
    fix: 'Do one change at a time. The answer to the first change is the starting number for the second change.',
  },
  undo: {
    id: 'ratio_change_undo',
    label: 'Thought the same percent up and down cancels out',
    explanation: 'Going up 50% and then down 50% does not bring you back to the start, because the second 50% is taken of a bigger number.',
    fix: 'Try it with real numbers: 100 up 50% is 150, and 150 down 50% is 75, not 100.',
  },
  additive: {
    id: 'ratio_additive',
    label: 'Added instead of multiplying',
    explanation: 'In a ratio, both quantities grow by the same **factor**, not by the same amount. 3 : 4 is equivalent to 6 : 8 (both doubled), not to 6 : 7 (both plus 3).',
    fix: 'Ask “how many times bigger?”, not “how many more?”. Multiply or divide both quantities by the same number.',
  },
  inverted: {
    id: 'ratio_inverted',
    label: 'Set up the rate or scale the wrong way round',
    explanation: 'Dividing the wrong quantity gives a rate like “hours per kilometre” when the question wants “kilometres per hour”, or multiplies when it should divide.',
    fix: 'Write the units: “dollars per can” means dollars ÷ cans. Then check that your answer is sensible in size.',
  },
  partPart: {
    id: 'ratio_part_part',
    label: 'Compared part to part instead of part to whole',
    explanation: 'The ratio 2 : 3 compares one part with the other part. As a fraction of the whole, the first part is 2 out of 2 + 3 = 5, not 2 out of 3.',
    fix: 'Add the parts to get the whole first. Then write the part you want over that whole.',
  },
  totals: {
    id: 'ratio_compare_totals',
    label: 'Compared totals instead of rates',
    explanation: 'A smaller price or a longer distance does not tell you which is the better deal or the faster speed. The amounts are different, so you have to compare the amount for 1.',
    fix: 'Find a unit rate for each option (price for 100 g, kilometres in 1 hour), then compare those.',
  },
  bigger: {
    id: 'ratio_bigger_is_cheaper',
    label: 'Assumed the bigger package is always the better buy',
    explanation: 'Bigger packages are often a better deal, but not always. Only the unit price can tell you.',
    fix: 'Work out the price per 100 g (or per 100 mL) for each package and compare.',
  },
  constantChange: {
    id: 'ratio_prop_constant_change',
    label: 'Thought steady growth always means proportional',
    explanation: 'A relationship can grow by the same amount each step and still not be proportional, if it does not start at zero (for example, a sign-up fee plus a cost per month).',
    fix: 'Divide y by x for every pair. Proportional means the ratio is the same every time, and 0 of one quantity gives 0 of the other.',
  },
  stoppedEarly: {
    id: 'ratio_stopped_early',
    label: 'Stopped one step early',
    explanation: 'The number you found is a correct middle step, but the question asks for something more.',
    fix: 'Reread the last sentence of the question and list the steps before you start.',
  },
  combinePct: {
    id: 'ratio_pct_combine',
    label: 'Combined two percents into one',
    explanation: 'A 25% discount and then 13% tax is not the same as 12% off. The tax is a percent of the sale price, not of the original price.',
    fix: 'Apply one percent at a time, in order, using the new amount each time.',
  },
} satisfies Record<string, Misconception>;

// ═════════════════════════ Percent of a whole number (Grade 6) ═════════════════════════

const pctOf = (pct: number, n: Rational) => n.mul(pct).div(100);

/** Mental math steps for pct% of n, built from 100%, 50%, 25%, 10%, 5% and 1%. */
function pctSteps(pct: number, n: Rational): Step[] {
  const N = nl(n);
  const v = (k: number) => nl(pctOf(k, n));
  const of = (k: number) => `${k}\\% \\text{ of } ${N}`;
  const ten: Step = { text: '10% is one tenth, so divide by 10.', math: `${of(10)} = ${N} \\div 10 = ${v(10)}` };
  const half: Step = { text: '50% is one half, so divide by 2.', math: `${of(50)} = ${N} \\div 2 = ${v(50)}` };
  const quarter: Step = { text: '25% is half of 50%, so halve again.', math: `${of(25)} = ${v(50)} \\div 2 = ${v(25)}` };
  const five: Step = { text: '5% is half of 10%, so halve the 10% amount.', math: `${of(5)} = ${v(10)} \\div 2 = ${v(5)}` };
  const one: Step = { text: '1% is one hundredth, so divide by 100.', math: `${of(1)} = ${N} \\div 100 = ${v(1)}` };
  switch (pct) {
    case 100:
      return [{ text: '100% is the whole amount.', math: `${of(100)} = ${N}` }];
    case 50:
      return [half];
    case 25:
      return [half, quarter];
    case 10:
      return [ten];
    case 5:
      return [ten, five];
    case 1:
      return [one];
    case 15:
      return [ten, five, { text: '15% = 10% + 5%, so add the two amounts.', math: `${of(15)} = ${v(10)} + ${v(5)} = ${v(15)}` }];
    case 75:
      return [half, quarter, { text: '75% = 50% + 25%.', math: `${of(75)} = ${v(50)} + ${v(25)} = ${v(75)}` }];
    case 35:
      return [half, quarter, ten, { text: '35% = 25% + 10%.', math: `${of(35)} = ${v(25)} + ${v(10)} = ${v(35)}` }];
    case 45:
      return [half, ten, five, { text: '45% = 50% − 5%.', math: `${of(45)} = ${v(50)} - ${v(5)} = ${v(45)}` }];
    case 90:
      return [ten, { text: '90% = 100% − 10%.', math: `${of(90)} = ${N} - ${v(10)} = ${v(90)}` }];
    case 2:
    case 3:
      return [one, { text: `${pct}% = ${pct} × 1%.`, math: `${of(pct)} = ${pct} \\times ${v(1)} = ${v(pct)}` }];
    default: {
      const k = pct / 10;
      return [ten, { text: `${pct}% = ${k} × 10%.`, math: `${of(pct)} = ${k} \\times ${v(10)} = ${v(pct)}` }];
    }
  }
}

const PIECES: Record<number, string> = {
  20: '20% = 2 × 10%.',
  30: '30% = 3 × 10%.',
  40: '40% = 4 × 10%.',
  60: '60% = 6 × 10%.',
  75: '75% = 50% + 25%.',
  35: '35% = 25% + 10%.',
  45: '45% = 50% − 5%.',
  90: '90% = 100% − 10%.',
  2: '2% = 2 × 1%.',
  3: '3% = 3 × 1%.',
};

function pctHints(pct: number, n: Rational): string[] {
  const N = nt(n);
  switch (pct) {
    case 100:
      return ['100% means all of it.', `100% of ${N} is the whole amount.`];
    case 50:
      return ['50% is the same as one half.', `Divide ${N} by 2.`];
    case 25:
      return ['25% is the same as one quarter: half of a half.', `Halve ${N}, then halve the answer again.`];
    case 10:
      return ['10% is the same as one tenth.', `Divide ${N} by 10.`];
    case 5:
      return ['5% is half of 10%.', `Find 10% of ${N} by dividing by 10, then halve it.`];
    case 1:
      return ['1% is one hundredth.', `Divide ${N} by 100.`];
    case 15:
      return ['Split 15% into two percents that are easy to find.', `15% = 10% + 5%. Find 10% of ${N}, halve it to get 5%, then add the two.`];
    default:
      return [`Split ${pct}% into easy pieces such as 50%, 25%, 10%, 5% or 1%.`, `${PIECES[pct] ?? ''} Find each piece of ${N}, then combine them.`];
  }
}

function pctWrongs(pct: number, n: Rational): Wrong[] {
  const w: Wrong[] = [];
  if (pct === 1) w.push([n.div(10), MIS.tenthHundredth.id]);
  if (pct === 10) w.push([n.div(100), MIS.tenthHundredth.id]);
  if (pct === 5) w.push([n.div(2), MIS.halfOfWhole.id]);
  if (pct === 15) w.push([n.div(10).add(5), MIS.addNumber.id], [n.div(10).add(n.div(2)), MIS.halfOfWhole.id]);
  if (![1, 10, 100].includes(pct)) w.push([n.div(pct), MIS.divideByNumber.id]);
  if (pct !== 100) w.push([n.mul(pct), MIS.noHundred.id]);
  return w;
}

function pctOfQ(pct: number, n: Rational, o: { prompt?: Block[]; unit?: string; money?: boolean; end?: (ans: Rational) => string } = {}): Draft {
  const ans = pctOf(pct, n);
  const base: AnsOpts = {
    hints: pctHints(pct, n),
    solution: [steps(...pctSteps(pct, n)), ...(o.end ? [p(o.end(ans))] : [])],
    wrong: pctWrongs(pct, n),
    params: { kind: 'of', pct, n: n.toNumber() },
    unit: o.unit,
  };
  const prompt = o.prompt ?? [p(`Use mental math to find ${pct}% of ${nt(n)}.`)];
  return o.money ? moneyAns(prompt, ans, base) : decAns(prompt, ans, base);
}

function pctContextQ(rng: Rng): Draft {
  const who = rng.pick(NAMES);
  switch (rng.int(0, 6)) {
    case 0: {
      const pct = rng.pick([15, 10, 15]);
      const n = R(rng.int(24, 150));
      return pctOfQ(pct, n, {
        prompt: [p(`${who}’s family has a restaurant bill of ${cash(n)}. They leave a ${pct}% tip. How much is the tip?`)],
        money: true,
        end: (a) => `The tip is ${cash(roundTo(a, 2))}.`,
      });
    }
    case 1: {
      const n = R(4 * rng.int(40, 220));
      return pctOfQ(25, n, { prompt: [p(`${nt(n)} students go to a middle school, and 25% of them take a school bus. How many students take a bus?`)], end: (a) => `${nt(a)} students take a bus.` });
    }
    case 2: {
      const pct = rng.pick([5, 10, 15, 25, 50]);
      const n = R(10 * rng.int(10, 60));
      return pctOfQ(pct, n, {
        prompt: [p(`A bike that usually costs ${cash(n)} is on sale for ${pct}% off. How many dollars do you save?`)],
        money: true,
        end: (a) => `You save ${cash(a)}.`,
      });
    }
    case 3: {
      const pct = rng.pick([5, 15, 25]);
      const n = R(20 * rng.int(10, 50));
      return pctOfQ(pct, n, { prompt: [p(`A ${nt(n)} g bag of trail mix is ${pct}% raisins by mass. What is the mass of the raisins, in grams?`)], unit: 'g', end: (a) => `The bag has ${nt(a)} g of raisins.` });
    }
    case 4: {
      const n = R(100 * rng.int(3, 40));
      return pctOfQ(1, n, { prompt: [p(`${nt(n)} people came to a Canada Day celebration, and 1% of them won a prize in a draw. How many people won a prize?`)], end: (a) => `${nt(a)} people won a prize.` });
    }
    case 5: {
      const pct = rng.pick([10, 50, 25]);
      const n = R(20 * rng.int(5, 15));
      return pctOfQ(pct, n, { prompt: [p(`A rain barrel holds ${nt(n)} L of water. It is ${pct}% full. How many litres of water are in it?`)], unit: 'L', end: (a) => `The barrel has ${nt(a)} L of water in it.` });
    }
    default: {
      const pct = rng.pick([10, 25, 50, 5]);
      const n = R(rng.int(6, 40));
      return pctOfQ(pct, n, { prompt: [p(`${who} is hiking a ${nt(n)} km trail and has finished ${pct}% of it. How many kilometres has ${who} hiked?`)], unit: 'km', end: (a) => `${who} has hiked ${nt(a)} km.` });
    }
  }
}

function pctStrategyQ(rng: Rng, pct: 1 | 5 | 15 | 25, n: Rational): Draft {
  const N = nl(n);
  const a10 = nl(n.div(10));
  const a5 = nl(n.div(20));
  const a50 = nl(n.div(2));
  const T = tex;
  const opts: Record<number, [string, { text: string; misconception?: string }[]]> = {
    1: [`${N} \\div 100`, [{ text: T(`${N} \\div 10`), misconception: MIS.tenthHundredth.id }, { text: T(`${N} - 1`), misconception: MIS.addNumber.id }, { text: T(`${N} \\div 10 \\div 2`) }]],
    5: [`${N} \\div 10 \\div 2`, [{ text: T(`${N} \\div 5`), misconception: MIS.divideByNumber.id }, { text: T(`${N} \\div 2`), misconception: MIS.halfOfWhole.id }, { text: T(`${N} - 5`), misconception: MIS.addNumber.id }]],
    15: [`${a10} + ${a5}`, [{ text: T(`${a10} + 5`), misconception: MIS.addNumber.id }, { text: T(`${N} \\div 15`), misconception: MIS.divideByNumber.id }, { text: T(`${a10} + ${a50}`), misconception: MIS.halfOfWhole.id }]],
    25: [`${N} \\div 2 \\div 2`, [{ text: T(`${N} \\div 25`), misconception: MIS.divideByNumber.id }, { text: T(`${N} - 25`), misconception: MIS.addNumber.id }, { text: T(`${N} \\div 2`) }]],
  };
  const [right, ds] = opts[pct]!;
  return choice(rng, [p(`Which calculation correctly finds ${pct}% of ${nt(n)} using mental math?`)], T(right), ds, {
    hints: pctHints(pct, n),
    solution: [steps(...pctSteps(pct, n)), p(`So $$${right}$$ is the right calculation. It gives ${nt(pctOf(pct, n))}.`)],
    params: { kind: 'strategy', pct, n: n.toNumber() },
  });
}

function pctTrueFalseQ(rng: Rng, pct: number, n: Rational): Draft {
  const ans = pctOf(pct, n);
  const pool = pctWrongs(pct, n).filter(([v]) => v && !v.eq(ans) && v.toDecimal(6) !== null && v.cmp(0) > 0);
  const truth = pool.length === 0 || rng.chance(0.5);
  const [claim, mis] = truth ? [ans, undefined] : rng.pick(pool);
  return trueFalse([p(`True or false: ${pct}% of ${nt(n)} is ${nt(claim!)}.`)], truth, {
    hints: pctHints(pct, n),
    solution: [steps(...pctSteps(pct, n)), p(`${pct}% of ${nt(n)} is ${nt(ans)}, so the statement is **${truth ? 'true' : 'false'}**.`)],
    misconception: mis,
    params: { kind: 'tf', pct, n: n.toNumber(), claim: claim!.toNumber() },
  });
}

function pctReverseQ(rng: Rng): Draft {
  const pct = rng.pick([10, 1, 25, 50, 5]);
  const part = R(rng.int(3, 40));
  const whole = part.mul(100).div(pct);
  const times = 100 / pct;
  const name: Record<number, string> = { 10: 'one tenth', 1: 'one hundredth', 25: 'one quarter', 50: 'one half', 5: 'one twentieth' };
  return decAns([p(`${pct}% of a number is ${nt(part)}. What is the number?`)], whole, {
    hints: [`${pct}% is ${name[pct]} of the number. How many pieces that size make 100%?`, `${times} pieces of ${pct}% make 100%, so multiply ${nt(part)} by ${times}.`],
    solution: [steps({ text: `${pct}% is ${name[pct]}, so ${times} of these pieces make the whole number (100%).` }, { text: `Multiply the part by ${times}.`, math: `${nl(part)} \\times ${times} = ${nl(whole)}` }, { text: 'Check: find the percent of your answer.', math: `${pct}\\% \\text{ of } ${nl(whole)} = ${nl(part)}` })],
    wrong: [
      [pctOf(pct, part), MIS.reverse.id],
      [part.div(pct), MIS.reverse.id],
    ],
    params: { kind: 'reverse', pct, part: part.toNumber() },
  });
}

export const percentOf: SkillPack = {
  id: 'percent-of',
  title: 'Mental math with percents',
  subject: 'math',
  expectations: [
    {
      id: `${G6}:B2.3`,
      note: 'Finds 1%, 5%, 10%, 15%, 25%, 50% (and 100%) of whole numbers with mental math strategies, including choosing a correct strategy (15% = 10% + 5%, 5% = half of 10%) and judging claims. Stretch questions build other percents from these pieces or work back from a percent to the whole. Explaining strategies aloud is modelled in the solutions, not assessed.',
    },
  ],
  prerequisites: [],
  goal: 'I can find percents of whole numbers in my head, starting from 10%, 50% and 1%.',
  explain: (c) => [
    p('**Percent** means “per hundred”. 15% of a number means 15 out of every 100 parts of it. You can find many percents in your head by starting from a few easy ones.'),
    {
      kind: 'table',
      header: ['Percent', 'Mental math strategy', 'Example with 360'],
      rows: [
        ['100%', 'the whole amount', '360'],
        ['50%', 'one half: divide by 2', '180'],
        ['25%', 'one quarter: halve, then halve again', '90'],
        ['10%', 'one tenth: divide by 10', '36'],
        ['5%', 'half of 10%', '18'],
        ['1%', 'one hundredth: divide by 100', '3.6'],
        ['15%', '10% + 5%', '36 + 18 = 54'],
      ],
    },
    tip('Build other percents from these pieces: 20% = 2 × 10%, 75% = 50% + 25%, 3% = 3 × 1%.'),
    c.simple ? p('Find 10% first. Many other percents come from it.') : p('Check with a quick estimate: 25% should be about a quarter of the number, and any percent less than 100% gives less than the whole.'),
  ],
  alternatives: () => ({
    simpler: [p('10% means divide by 10. Half of that is 5%. Add them and you have 15%. 50% means divide by 2. 1% means divide by 100.')],
    analogy: [p('Think of a dollar. It has 100 cents, so 1% of a dollar is 1 cent and 10% is a dime. So 10% of $40 is $4: one dime out of every dollar.')],
    visual: [
      { kind: 'diagram', diagram: { type: 'fraction_bar', parts: 10, shaded: 1, label: '10%' }, alt: 'A bar cut into 10 equal parts with 1 part shaded: 10% is one tenth of the whole.' },
      { kind: 'diagram', diagram: { type: 'fraction_bar', parts: 20, shaded: 3, label: '15% = 10% + 5%' }, alt: 'A bar cut into 20 equal parts with 3 parts shaded: two parts make 10% and one more part makes 5%, for 15% in all.' },
    ],
    steps: [p('Find 15% of 240.'), steps(...pctSteps(15, R(240)))],
    compare: [p('You already know fractions: 50% is $$\\frac{1}{2}$$, 25% is $$\\frac{1}{4}$$, 10% is $$\\frac{1}{10}$$ and 1% is $$\\frac{1}{100}$$. Finding a percent is finding that fraction of the number.')],
  }),
  example: (rng) => {
    const n = R(20 * rng.int(6, 30));
    const pct = rng.pick([5, 15, 25]);
    return [p(`Find ${pct}% of ${nt(n)} using mental math.`), steps(...pctSteps(pct, n))];
  },
  generate: (rng, d) => {
    const n20 = () => {
      const k = 20 * rng.int(2, 40);
      return R(k === 100 ? 120 : k);
    };
    if (d === 1) {
      const pct = rng.pick([10, 50, 10, 50, 25, 100]);
      return pctOfQ(pct, pct === 25 ? n20() : R(10 * rng.int(2, 90)));
    }
    if (d === 2) {
      const r = rng.next();
      if (r < 0.2) return pctStrategyQ(rng, rng.pick([5, 15, 25, 1] as const), n20());
      if (r < 0.35) {
        const pct = rng.pick([5, 15, 25, 50, 10]);
        return pctTrueFalseQ(rng, pct, n20());
      }
      const pct = rng.pick([1, 5, 15, 25, 10, 50, 15, 5]);
      return pctOfQ(pct, pct === 1 ? R(rng.int(101, 999)) : n20());
    }
    if (d === 3) {
      const r = rng.next();
      if (r < 0.2) return pctStrategyQ(rng, rng.pick([5, 15, 25, 1] as const), n20());
      if (r < 0.35) return pctTrueFalseQ(rng, rng.pick([1, 5, 15, 25]), rng.chance(0.5) ? n20() : R(rng.int(101, 999)));
      return pctContextQ(rng);
    }
    if (rng.chance(0.4)) return pctReverseQ(rng);
    const pct = rng.pick([20, 30, 40, 60, 75, 35, 45, 90, 2, 3]);
    return pctOfQ(pct, R(20 * rng.int(3, 45)));
  },
  selfCheck: (q) => {
    const pr = prm(q);
    const want = (num(pr, 'n') * num(pr, 'pct')) / 100;
    switch (pr.kind) {
      case 'of':
        return near(q, want, 0.005);
      case 'strategy':
        return checkCalcChoice(q, want);
      case 'tf':
        return tfIs(q, Math.abs(want - num(pr, 'claim')) < 1e-9);
      case 'reverse':
        return near(q, (num(pr, 'part') * 100) / num(pr, 'pct'));
      default:
        return 'unknown question kind';
    }
  },
  summary: ['Percent means “out of 100”: 50% is a half, 25% a quarter, 10% a tenth, 1% a hundredth.', '5% is half of 10%, and 15% = 10% + 5%.', 'Build harder percents from easy pieces, and check that the answer is a sensible size.'],
  misconceptions: [MIS.tenthHundredth, MIS.divideByNumber, MIS.addNumber, MIS.halfOfWhole, MIS.noHundred, MIS.reverse],
};

// ═════════════════════════ Percent increase and decrease (Grade 7) ═════════════════════════

const CHANGE_PCTS = [1, 5, 10, 25, 50, 100] as const;

function changeParts(pct: number, n: Rational, up: boolean) {
  const amount = pctOf(pct, n);
  const ans = up ? n.add(amount) : n.sub(amount);
  return { amount, ans };
}

function changeSolution(pct: number, n: Rational, up: boolean): Block[] {
  const { amount, ans } = changeParts(pct, n, up);
  return [
    steps(...pctSteps(pct, n), {
      text: up ? 'It is an increase, so add this amount to the starting number.' : 'It is a decrease, so subtract this amount from the starting number.',
      math: `${nl(n)} ${up ? '+' : '-'} ${nl(amount)} = ${nl(ans)}`,
    }),
    p(`Check: the new amount is ${up ? 100 + pct : 100 - pct}% of the starting amount.`),
  ];
}

function changeWrongs(pct: number, n: Rational, up: boolean): Wrong[] {
  const { amount } = changeParts(pct, n, up);
  const w: Wrong[] = [
    [amount, MIS.amountOnly.id],
    [up ? n.sub(amount) : n.add(amount), MIS.direction.id],
    [up ? n.add(pct) : n.sub(pct), MIS.addNumber.id],
  ];
  if (pct === 1) w.push([up ? n.add(n.div(10)) : n.sub(n.div(10)), MIS.tenthHundredth.id]);
  return w;
}

function changeQ(pct: number, n: Rational, up: boolean, o: { prompt?: Block[]; money?: boolean; unit?: string; end?: (a: Rational) => string } = {}): Draft {
  const { amount, ans } = changeParts(pct, n, up);
  const base: AnsOpts = {
    hints: [`First find ${pct}% of ${nt(n)}. Which mental math strategy fits ${pct}%?`, `${pct}% of ${nt(n)} is ${nt(amount)}. Now ${up ? 'add it to' : 'subtract it from'} ${nt(n)}.`],
    solution: [...changeSolution(pct, n, up), ...(o.end ? [p(o.end(ans))] : [])],
    wrong: changeWrongs(pct, n, up),
    params: { kind: 'change', pct, n: n.toNumber(), up },
    unit: o.unit,
  };
  const prompt = o.prompt ?? [p(`Use mental math to ${up ? 'increase' : 'decrease'} ${nt(n)} by ${pct}%. What is the new number?`)];
  return o.money ? moneyAns(prompt, ans, base) : decAns(prompt, ans, base);
}

function changeContextQ(rng: Rng): Draft {
  const who = rng.pick(NAMES);
  switch (rng.int(0, 5)) {
    case 0: {
      const pct = rng.pick([10, 25, 50, 5]);
      const n = R(4 * rng.int(10, 40));
      return changeQ(pct, n, false, { prompt: [p(`A winter jacket costs ${cash(n)}. It goes on sale for ${pct}% off. What is the sale price?`)], money: true, end: (a) => `The sale price is ${cash(a)}.` });
    }
    case 1: {
      const pct = rng.pick([5, 10, 1]);
      const n = R(pct === 1 ? 100 * rng.int(1, 9) : 10 * rng.int(4, 15));
      return changeQ(pct, n, true, { prompt: [p(`A monthly transit pass costs ${cash(n)}. Next year the price will go up by ${pct}%. What will the new price be?`)], money: true, end: (a) => `The new price will be ${cash(a)}.` });
    }
    case 2: {
      const pct = rng.pick([10, 5, 25, 1]);
      const n = R(100 * rng.int(12, 95));
      return changeQ(pct, n, true, { prompt: [p(`A town had ${nt(n)} people. Over five years, its population grew by ${pct}%. What is the new population?`)], end: (a) => `The new population is ${nt(a)}.` });
    }
    case 3: {
      const pct = rng.pick([50, 100, 25]);
      const n = R(4 * rng.int(3, 20));
      return changeQ(pct, n, true, { prompt: [p(`${who}’s sunflower was ${nt(n)} cm tall. Over the next two weeks, its height increased by ${pct}%. How tall is it now, in centimetres?`)], unit: 'cm', end: (a) => `The sunflower is now ${nt(a)} cm tall.` });
    }
    case 4: {
      const pct = rng.pick([1, 5, 10]);
      const n = R(100 * rng.int(20, 90));
      return changeQ(pct, n, false, { prompt: [p(`A school library had ${nt(n)} books. It gave away ${pct}% of them to a book drive. How many books does the library have now?`)], end: (a) => `The library now has ${nt(a)} books.` });
    }
    default: {
      const pct = rng.pick([25, 50, 10, 5]);
      const up = rng.chance(0.5);
      const n = R(4 * rng.int(5, 50));
      const N = nl(n);
      const f = (k: number) => nl(R(k, 100));
      const { ans } = changeParts(pct, n, up);
      const right = `${N} \\times ${f(up ? 100 + pct : 100 - pct)}`;
      return choice(
        rng,
        [p(`The price of a ${cash(n)} video game ${up ? 'goes up' : 'goes down'} by ${pct}%. Which calculation gives the new price?`)],
        tex(right),
        [
          { text: tex(`${N} \\times ${f(pct)}`), misconception: MIS.amountOnly.id },
          { text: tex(`${N} \\times ${f(up ? 100 - pct : 100 + pct)}`), misconception: MIS.direction.id },
          { text: tex(`${N} ${up ? '+' : '-'} ${pct}`), misconception: MIS.addNumber.id },
        ],
        {
          hints: [`After the change, what percent of the old price is the new price?`, `${up ? `100% + ${pct}%` : `100% − ${pct}%`} = ${up ? 100 + pct : 100 - pct}%, which is ${f(up ? 100 + pct : 100 - pct)} as a decimal.`],
          solution: [p(`The new price is ${up ? 100 + pct : 100 - pct}% of the old price, so multiply by ${f(up ? 100 + pct : 100 - pct)}:`), m(`${right} = ${nl(ans)}`), ...changeSolution(pct, n, up)],
          params: { kind: 'mult', pct, n: n.toNumber(), up },
        },
      );
    }
  }
}

function changeTwoQ(rng: Rng): Draft {
  const p1 = rng.pick([10, 25, 50, 5]);
  const p2 = rng.pick([10, 25, 50, 5]);
  const up1 = rng.chance(0.5);
  const up2 = p1 === p2 ? !up1 : rng.chance(0.5);
  const n = R(40 * rng.int(2, 25));
  const s1 = changeParts(p1, n, up1);
  const s2 = changeParts(p2, s1.ans, up2);
  const word = (up: boolean) => (up ? 'increased' : 'decreased');
  const sign = (up: boolean) => (up ? 1 : -1);
  const same = n.mul(R(100 + sign(up1) * p1 + sign(up2) * p2, 100));
  if (p1 === p2 && rng.chance(0.5)) {
    return trueFalse([p(`True or false: if you ${up1 ? 'increase' : 'decrease'} ${nt(n)} by ${p1}% and then ${up2 ? 'increase' : 'decrease'} the result by ${p2}%, you get back to ${nt(n)}.`)], s2.ans.eq(n), {
      hints: ['Do one change at a time. The second percent is taken of the new number.', `After the first change the number is ${nt(s1.ans)}. Now find ${p2}% of ${nt(s1.ans)}.`],
      solution: [
        steps(
          { text: `First change: ${p1}% of ${nt(n)} is ${nt(s1.amount)}.`, math: `${nl(n)} ${up1 ? '+' : '-'} ${nl(s1.amount)} = ${nl(s1.ans)}` },
          { text: `Second change: ${p2}% of ${nt(s1.ans)} is ${nt(s2.amount)}.`, math: `${nl(s1.ans)} ${up2 ? '+' : '-'} ${nl(s2.amount)} = ${nl(s2.ans)}` },
        ),
        p(`The result is ${nt(s2.ans)}, not ${nt(n)}, so the statement is **false**. The two ${p1}% changes are taken of different numbers.`),
      ],
      misconception: MIS.undo.id,
      params: { kind: 'tf2', n: n.toNumber(), p1, up1, p2, up2, claim: n.toNumber() },
    });
  }
  return decAns([p(`A number starts at ${nt(n)}. It is ${word(up1)} by ${p1}%, and then the new number is ${word(up2)} by ${p2}%. What is the final number?`)], s2.ans, {
    hints: ['Do one change at a time.', `After the first change the number is ${nt(s1.ans)}. Now ${up2 ? 'increase' : 'decrease'} ${nt(s1.ans)} by ${p2}%.`],
    solution: [
      steps(
        { text: `First change: ${p1}% of ${nt(n)} is ${nt(s1.amount)}.`, math: `${nl(n)} ${up1 ? '+' : '-'} ${nl(s1.amount)} = ${nl(s1.ans)}` },
        { text: `Second change: ${p2}% of the new number, ${nt(s1.ans)}, is ${nt(s2.amount)}.`, math: `${nl(s1.ans)} ${up2 ? '+' : '-'} ${nl(s2.amount)} = ${nl(s2.ans)}` },
      ),
      p(`The final number is ${nt(s2.ans)}.`),
    ],
    wrong: [
      [same, MIS.sameBase.id],
      [s1.ans, MIS.stoppedEarly.id],
      [p1 === p2 ? n : null, MIS.undo.id],
    ],
    params: { kind: 'two', n: n.toNumber(), p1, up1, p2, up2 },
  });
}

function changeTfQ(rng: Rng): Draft {
  const pct = rng.pick(CHANGE_PCTS);
  const up = rng.chance(0.5);
  const n = R(pct === 1 ? 100 * rng.int(1, 9) : 4 * rng.int(5, 60));
  const { ans } = changeParts(pct, n, up);
  const pool = changeWrongs(pct, n, up).filter(([v]) => v && !v.eq(ans) && v.cmp(0) >= 0);
  const truth = rng.chance(0.5);
  const [claim, mis] = truth ? [ans, undefined] : rng.pick(pool);
  return trueFalse([p(`True or false: ${up ? 'increasing' : 'decreasing'} ${nt(n)} by ${pct}% gives ${nt(claim!)}.`)], truth, {
    hints: [`Find ${pct}% of ${nt(n)} first.`, `Then ${up ? 'add it to' : 'subtract it from'} ${nt(n)} and compare with ${nt(claim!)}.`],
    solution: [...changeSolution(pct, n, up), p(`The new number is ${nt(ans)}, so the statement is **${truth ? 'true' : 'false'}**.`)],
    misconception: mis,
    params: { kind: 'tf', pct, n: n.toNumber(), up, claim: claim!.toNumber() },
  });
}

export const percentChange: SkillPack = {
  id: 'percent-change',
  title: 'Percent increase and decrease',
  subject: 'math',
  expectations: [
    {
      id: `${G7}:B2.3`,
      note: 'Increases and decreases whole numbers by 1%, 5%, 10%, 25%, 50% and 100% with mental math (find the percent, then add or subtract), in plain and everyday contexts (sales, price rises, population growth), including choosing the matching multiplier and judging claims. Stretch questions apply two changes in a row. Explaining the strategy is modelled in solutions, not assessed.',
    },
  ],
  prerequisites: ['percent-of'],
  goal: 'I can increase or decrease a number by a percent using mental math.',
  explain: (c) => [
    p('To **increase** a number by a percent, find that percent of the number and **add** it. To **decrease**, find the percent and **subtract** it.'),
    steps({ text: 'Decrease 72 by 5%. First find 10% of 72.', math: '72 \\div 10 = 7.2' }, { text: '5% is half of 10%.', math: '7.2 \\div 2 = 3.6' }, { text: 'It is a decrease, so subtract.', math: '72 - 3.6 = 68.4' }),
    p('You can also think about the new amount as a percent of the old one: increasing by 50% gives 150% of the number, and decreasing by 5% leaves 95% of it.'),
    tip('Increasing by 100% doubles a number. Decreasing by 100% leaves nothing.'),
    c.simple ? p('Find the percent. Add it if the number goes up. Subtract it if the number goes down.') : warn('Read carefully: “25% off” is a decrease, “25% more” is an increase, and “25% of” is just the part.'),
  ],
  alternatives: () => ({
    simpler: [p('Two steps: (1) find the percent of the number, (2) add it for an increase or take it away for a decrease.')],
    analogy: [p('A store has a $40 hoodie with 25% off. 25% of $40 is $10, so you pay $40 − $10 = $30. A price going up works the same way, but you add.')],
    visual: [
      { kind: 'diagram', diagram: { type: 'fraction_bar', parts: 4, shaded: 3, label: '100% − 25% = 75%' }, alt: 'A bar cut into 4 equal parts. Three parts are shaded: after a 25% decrease, 75% of the amount is left.' },
      { kind: 'diagram', diagram: { type: 'number_line', min: 0, max: 120, step: 20, points: [{ at: 72, label: '72' }, { at: 108, label: '108' }], jumps: [{ from: 72, to: 108, label: '+36 (50% of 72)' }] }, alt: 'A number line from 72 jumping 36 to 108: increasing 72 by 50% adds half of 72.' },
    ],
    steps: [p('Increase 240 by 25%.'), ...changeSolution(25, R(240), true)],
    compare: [p('You already know how to find a percent of a number. Percent change is that, plus one more step: add or subtract.')],
  }),
  example: (rng) => {
    const n = R(20 * rng.int(3, 20));
    const pct = rng.pick([5, 25, 10]);
    const up = rng.chance(0.5);
    return [p(`${up ? 'Increase' : 'Decrease'} ${nt(n)} by ${pct}%.`), ...changeSolution(pct, n, up)];
  },
  generate: (rng, d) => {
    if (d === 1) {
      const pct = rng.pick([10, 50, 100]);
      return changeQ(pct, R(10 * rng.int(2, 50)), pct === 100 ? true : rng.chance(0.5));
    }
    if (d === 2) {
      if (rng.chance(0.2)) return changeTfQ(rng);
      const pct = rng.pick(CHANGE_PCTS);
      const up = pct === 100 ? rng.chance(0.8) : rng.chance(0.5);
      return changeQ(pct, R(pct === 1 ? rng.int(101, 999) : rng.int(20, 400)), up);
    }
    if (d === 3) return changeContextQ(rng);
    return changeTwoQ(rng);
  },
  selfCheck: (q) => {
    const pr = prm(q);
    const f = (pct: number, up: unknown) => 1 + ((up ? 1 : -1) * pct) / 100;
    switch (pr.kind) {
      case 'change':
        return near(q, num(pr, 'n') * f(num(pr, 'pct'), pr.up), 0.005);
      case 'mult':
        return checkCalcChoice(q, num(pr, 'n') * f(num(pr, 'pct'), pr.up));
      case 'tf':
        return tfIs(q, Math.abs(num(pr, 'n') * f(num(pr, 'pct'), pr.up) - num(pr, 'claim')) < 1e-9);
      case 'two':
        return near(q, num(pr, 'n') * f(num(pr, 'p1'), pr.up1) * f(num(pr, 'p2'), pr.up2));
      case 'tf2':
        return tfIs(q, Math.abs(num(pr, 'n') * f(num(pr, 'p1'), pr.up1) * f(num(pr, 'p2'), pr.up2) - num(pr, 'claim')) < 1e-9);
      default:
        return 'unknown question kind';
    }
  },
  summary: ['Increase: find the percent of the number and add it. Decrease: find it and subtract it.', 'The new amount is a percent of the old one: up 25% gives 125%, down 5% gives 95%.', 'In two changes in a row, the second percent is taken of the new number.'],
  misconceptions: [MIS.amountOnly, MIS.direction, MIS.addNumber, MIS.tenthHundredth, MIS.sameBase, MIS.undo, MIS.stoppedEarly],
};

// ═════════════════════════ Ratios, rates and proportions (Grades 6–9) ═════════════════════════

interface MissingCtx {
  colA: string;
  colB: string;
  money?: boolean;
  unit?: string;
  uInt: number[];
  uRate: number[];
  show: (v: Rational) => string;
  text: (a: number, b: string, c: number, who: string) => string;
  end: (c: number, ans: string) => string;
}

const MISSING_CTX: MissingCtx[] = [
  {
    colA: 'Cans',
    colB: 'Cost ($)',
    money: true,
    uInt: [2, 3, 4],
    uRate: [0.75, 1.25, 1.5, 1.75, 2.25],
    show: (v) => cash(v),
    text: (a, b, c) => `${a} cans of soup cost ${b}. At the same price per can, how much do ${c} cans cost?`,
    end: (c, x) => `${c} cans cost ${x}.`,
  },
  {
    colA: 'Pancakes',
    colB: 'Milk (mL)',
    unit: 'mL',
    uInt: [20, 25, 30, 40],
    uRate: [12.5, 15, 22.5, 35],
    show: (v) => `${nt(v)} mL`,
    text: (a, b, c) => `A pancake recipe uses ${b} of milk to make ${a} pancakes. How much milk is needed for ${c} pancakes?`,
    end: (c, x) => `${c} pancakes need ${x} of milk.`,
  },
  {
    colA: 'Laps',
    colB: 'Time (min)',
    unit: 'min',
    uInt: [2, 3, 4],
    uRate: [1.5, 2.5, 3.5],
    show: (v) => `${nt(v)} min`,
    text: (a, b, c, who) => `${who} jogs at a steady pace and runs ${a} laps of the track in ${b}. At the same pace, how many minutes will ${c} laps take?`,
    end: (c, x) => `${c} laps take ${x}.`,
  },
  {
    colA: 'Hours',
    colB: 'Distance (km)',
    unit: 'km',
    uInt: [12, 15, 20],
    uRate: [12.5, 17.5, 22.5],
    show: (v) => `${nt(v)} km`,
    text: (a, b, c, who) => `${who} cycles at a steady speed and covers ${b} in ${a} hours. At the same speed, how far will ${who} ride in ${c} hours?`,
    end: (c, x) => `In ${c} hours the distance is ${x}.`,
  },
];

function missingSolution(a: number, b: Rational, c: number, show: (v: Rational) => string): { solution: Block[]; hints: string[]; ans: Rational } {
  const u = b.div(a);
  const ans = u.mul(c);
  const scale = c % a === 0;
  const k = c / a;
  const st: Step[] = scale
    ? [{ text: `${c} is ${k} times ${a}, so multiply the other quantity by ${k} too.`, math: `${nl(b)} \\times ${k} = ${nl(ans)}` }]
    : [
        { text: 'Find the unit rate: the amount for 1.', math: `${nl(b)} \\div ${a} = ${nl(u)}` },
        { text: `Multiply the unit rate by ${c}.`, math: `${nl(u)} \\times ${c} = ${nl(ans)}` },
      ];
  return {
    ans,
    solution: [steps(...st), { kind: 'table', header: ['Quantity', 'Matching amount'], rows: [[`${a}`, show(b)], ...(scale ? [] : [['1', show(u)]]), [`${c}`, show(ans)]] }],
    hints: ['Both quantities grow by the same factor. Find what you multiply by, or find the amount for 1 first.', scale ? `${c} ÷ ${a} = ${k}. Multiply ${show(b)} by ${k}.` : `Find the amount for 1: divide ${show(b)} by ${a}. Then multiply by ${c}.`],
  };
}

function missingQ(rng: Rng, mode: 'int' | 'rate'): Draft {
  const who = rng.pick(NAMES);
  if (mode === 'int' && rng.chance(0.35)) {
    const a = rng.int(2, 9);
    let b = rng.int(2, 9);
    if (b === a) b += 1;
    const k = rng.int(2, 8);
    const c = a * k;
    const ans = R(b * k);
    return decAns([p('Find the missing number that makes the two ratios equivalent.'), m(`${a} : ${b} = ${c} : x`)], ans, {
      hints: ['Equivalent ratios: both terms are multiplied by the same number.', `${a} was multiplied by ${k} to get ${c}. Do the same to ${b}.`],
      solution: [steps({ text: `${c} ÷ ${a} = ${k}, so the first term was multiplied by ${k}.` }, { text: `Multiply the second term by ${k} too.`, math: `x = ${b} \\times ${k} = ${b * k}` }), m(`${a} : ${b} = ${c} : ${b * k}`)],
      wrong: [
        [R(b + c - a), MIS.additive.id],
        [R(a * c).div(b), MIS.inverted.id],
      ],
      params: { kind: 'missing', a, b, c },
    });
  }
  const cx = rng.pick(MISSING_CTX);
  const a = mode === 'int' ? rng.int(2, 6) : rng.pick([2, 4, 5, 8]);
  const u = rat(mode === 'int' ? rng.pick(cx.uInt) : rng.pick(cx.uRate));
  const b = u.mul(a);
  let c = mode === 'int' ? a * rng.int(2, 6) : rng.int(a + 1, 4 * a);
  if (mode === 'rate' && c % a === 0) c += 1;
  const s = missingSolution(a, b, c, cx.show);
  const prompt = [p(cx.text(a, cx.show(b), c, who))];
  const base: AnsOpts = {
    hints: s.hints,
    solution: [...s.solution, p(cx.end(c, cx.show(s.ans)))],
    wrong: [
      [b.add(c - a), MIS.additive.id],
      [R(a * c).div(b), MIS.inverted.id],
    ],
    params: { kind: 'missing', a, b: b.toNumber(), c },
    unit: cx.unit,
  };
  return cx.money ? moneyAns(prompt, s.ans, base) : decAns(prompt, s.ans, base);
}

function unitRateQ(rng: Rng): Draft {
  const who = rng.pick(NAMES);
  const kind = rng.int(0, 3);
  if (kind === 0) {
    const n = rng.pick([4, 6, 8, 10, 12]);
    const u = R(rng.int(9, 30) * 5, 100);
    const total = u.mul(n);
    return moneyAns([p(`A pack of ${n} juice boxes costs ${cash(total)}. What is the price of one juice box?`)], u, {
      hints: ['A unit price is the cost of 1 item.', `Divide the total cost by the number of juice boxes: ${cash(total)} ÷ ${n}.`],
      solution: [m(`${cashL(total)} \\div ${n} = ${cashL(u)}`), p(`Each juice box costs ${cash(u)}.`)],
      wrong: [[R(n).div(total), MIS.inverted.id]],
      params: { kind: 'unit', total: total.toNumber(), n },
    });
  }
  if (kind === 1) {
    const t = rat(rng.pick([2, 3, 4, 1.5, 2.5]));
    const v = R(5 * rng.int(12, 24));
    const D = v.mul(t);
    return decAns([p(`A train travels ${nt(D)} km in ${nt(t)} hours at a steady speed. What is its speed in kilometres per hour?`)], v, {
      hints: ['Speed in km/h is the number of kilometres travelled in 1 hour.', `Divide the distance by the time: ${nt(D)} ÷ ${nt(t)}.`],
      solution: [m(`\\text{speed} = \\frac{${nl(D)}\\text{ km}}{${nl(t)}\\text{ h}} = ${nl(v)}\\text{ km/h}`)],
      wrong: [
        [t.div(D), MIS.inverted.id],
        [D.mul(t), MIS.inverted.id],
      ],
      unit: 'km/h',
      params: { kind: 'unit', total: D.toNumber(), n: t.toNumber() },
    });
  }
  if (kind === 2) {
    const mins = rng.pick([2, 3, 4, 5]);
    const wpm = R(rng.int(25, 60));
    const words = wpm.mul(mins);
    return decAns([p(`${who} types ${nt(words)} words in ${mins} minutes. At this rate, how many words does ${who} type per minute?`)], wpm, {
      hints: ['“Per minute” means in 1 minute.', `Divide the words by the minutes: ${nt(words)} ÷ ${mins}.`],
      solution: [m(`${nl(words)} \\div ${mins} = ${nl(wpm)}`), p(`${who} types ${nt(wpm)} words per minute.`)],
      wrong: [[R(mins).div(words), MIS.inverted.id]],
      params: { kind: 'unit', total: words.toNumber(), n: mins },
    });
  }
  const mins = rng.pick([4, 5, 8]);
  const rate = rat(rng.pick([6, 7.5, 9, 12, 12.5]));
  const L = rate.mul(mins);
  return decAns([p(`A tap fills a ${nt(L)} L tub in ${mins} minutes. How many litres per minute does the tap pour?`)], rate, {
    hints: ['Litres per minute means litres in 1 minute.', `Divide the litres by the minutes: ${nt(L)} ÷ ${mins}.`],
    solution: [m(`${nl(L)} \\div ${mins} = ${nl(rate)}\\text{ L/min}`)],
    wrong: [[R(mins).div(L), MIS.inverted.id]],
    unit: 'L/min',
    params: { kind: 'unit', total: L.toNumber(), n: mins },
  });
}

function ratioPctQ(rng: Rng): Draft {
  const total = rng.pick([4, 5, 10, 20, 25, 50]);
  const r = rng.int(1, total - 1);
  const b = total - r;
  const [c1, c2] = rng.pick([
    ['red', 'blue'],
    ['green', 'yellow'],
    ['purple', 'orange'],
  ] as const);
  const ans = R(r * 100, total);
  return pctAns([p(`A bag has ${r} ${c1} beads and ${b} ${c2} beads. What percent of the beads are ${c1}?`)], ans, {
    hints: ['A percent compares a part with the whole. How many beads are there altogether?', `There are ${total} beads, so write $$\\frac{${r}}{${total}}$$ as a percent.`],
    solution: [
      steps(
        { text: 'Find the whole: add the parts.', math: `${r} + ${b} = ${total}` },
        { text: `Write the ${c1} beads as a fraction of the whole, then make it out of 100.`, math: `\\frac{${r}}{${total}} = \\frac{${nl(ans)}}{100} = ${pctTex(ans)}` },
      ),
    ],
    wrong: [[R(r * 100, b), MIS.partPart.id]],
    params: { kind: 'ratiopct', r, total },
  });
}

interface CmpOpt {
  text: string;
  num: number;
  den: number;
}

function bestBuyQ(rng: Rng, conv: boolean): Draft {
  const [item, pack, unit] = rng.pick([
    ['rice', 'bag', 'g'],
    ['oats', 'bag', 'g'],
    ['apple juice', 'bottle', 'mL'],
    ['laundry soap', 'jug', 'mL'],
    ['trail mix', 'bag', 'g'],
  ] as const);
  const big = unit === 'g' ? 'kg' : 'L';
  const small = rng.pick([200, 300, 400, 500, 600]);
  const large = conv ? rng.pick([1000, 1200, 1500, 2000]) : small * rng.pick([2, 3]);
  const bigBetter = rng.chance(0.65);
  const uBest = R(rng.int(9, 24) * 5, 100);
  const uOther = uBest.add(R(rng.int(1, 4) * 5, 100));
  const uSmall = bigBetter ? uOther : uBest;
  const uLarge = bigBetter ? uBest : uOther;
  const pSmall = uSmall.mul(small).div(100);
  const pLarge = uLarge.mul(large).div(100);
  const size = (s: number) => (conv && s >= 1000 ? `${nt(R(s, 1000))} ${big}` : `${s} ${unit}`);
  const tSmall = `the ${size(small)} ${pack} for ${cash(pSmall)}`;
  const tLarge = `the ${size(large)} ${pack} for ${cash(pLarge)}`;
  const right = bigBetter ? tLarge : tSmall;
  const wrongText = bigBetter ? tSmall : tLarge;
  const wrongTotal = bigBetter ? pSmall : pLarge;
  const rightTotal = bigBetter ? pLarge : pSmall;
  const wrongMis = wrongTotal.cmp(rightTotal) < 0 ? MIS.totals.id : !bigBetter ? MIS.bigger.id : undefined;
  const per = (pr: Rational, s: number) => pr.div(s).mul(100);
  return choice(
    rng,
    [p(`A store sells ${item} in two sizes: a ${size(small)} ${pack} for ${cash(pSmall)} and a ${size(large)} ${pack} for ${cash(pLarge)}. Which is the better buy?`)],
    right,
    [{ text: wrongText, misconception: wrongMis }, { text: 'They are the same value for money' }],
    {
      hints: [`Compare the price for the same amount of ${item}, such as 100 ${unit}.`, `Divide each price by the number of hundreds of ${unit}${conv ? ` (change ${big} to ${unit} first: 1 ${big} = 1000 ${unit})` : ''}.`],
      solution: [
        steps(
          ...(conv ? [{ text: `Use the same unit for both: ${size(large)} = ${large} ${unit}.` }] : []),
          { text: `Small ${pack}: price for 100 ${unit}.`, math: `${cashL(pSmall)} \\div ${small / 100} = ${cashL(per(pSmall, small))}` },
          { text: `Large ${pack}: price for 100 ${unit}.`, math: `${cashL(pLarge)} \\div ${large / 100} = ${cashL(per(pLarge, large))}` },
        ),
        p(`The ${bigBetter ? 'larger' : 'smaller'} ${pack} costs less for each 100 ${unit}, so ${right} is the better buy.${bigBetter ? '' : ' Bigger is not always cheaper!'}`),
      ],
      params: {
        kind: 'cmp',
        better: 'low',
        opts: [
          { text: tSmall, num: pSmall.toNumber(), den: small },
          { text: tLarge, num: pLarge.toNumber(), den: large },
        ] satisfies CmpOpt[],
      },
    },
  );
}

function speedCompareQ(rng: Rng): Draft {
  const [A, B] = rng.shuffle(NAMES).slice(0, 2) as [string, string];
  const v1 = rng.int(12, 28);
  let v2 = rng.int(12, 28);
  if (v2 === v1) v2 += 2;
  const t1 = rat(rng.pick([1.5, 2, 2.5, 3, 4]));
  const t2 = rat(rng.pick([1.5, 2, 2.5, 3, 4]));
  const D1 = t1.mul(v1);
  const D2 = t2.mul(v2);
  const right = v1 > v2 ? A : B;
  const wrong = v1 > v2 ? B : A;
  const wrongFarther = (v1 > v2 ? D2 : D1).cmp(v1 > v2 ? D1 : D2) > 0;
  return choice(rng, [p(`${A} cycled ${nt(D1)} km in ${nt(t1)} hours. ${B} cycled ${nt(D2)} km in ${nt(t2)} hours. Each rode at a steady speed. Who rode faster?`)], right, [{ text: wrong, misconception: wrongFarther ? MIS.totals.id : undefined }, { text: 'They rode at the same speed' }], {
    hints: ['Compare how far each person rides in 1 hour.', 'Divide each distance by its time to get the speed in km/h.'],
    solution: [steps({ text: `${A}’s speed:`, math: `${nl(D1)} \\div ${nl(t1)} = ${v1}\\text{ km/h}` }, { text: `${B}’s speed:`, math: `${nl(D2)} \\div ${nl(t2)} = ${v2}\\text{ km/h}` }), p(`${right} rode faster.`)],
    params: {
      kind: 'cmp',
      better: 'high',
      opts: [
        { text: A, num: D1.toNumber(), den: t1.toNumber() },
        { text: B, num: D2.toNumber(), den: t2.toNumber() },
      ] satisfies CmpOpt[],
    },
  });
}

function propTableQ(rng: Rng): Draft {
  const [hx, hy] = rng.pick([
    ['Hours worked', 'Pay ($)'],
    ['Tickets bought', 'Total cost ($)'],
    ['Minutes', 'Water in the tank (L)'],
    ['Number of guests', 'Pizza slices needed'],
  ] as const);
  const k = rng.pick([2, 3, 4, 5, 6, 8, 12, 15]);
  const prop = rng.chance(0.5);
  const b = prop ? 0 : rng.pick([2, 3, 4, 5, 10]);
  const xs = rng.pick([
    [1, 2, 3],
    [2, 4, 6],
    [1, 3, 5],
    [2, 5, 8],
    [3, 4, 6],
  ]);
  const ys = xs.map((x) => k * x + b);
  const ratios = xs.map((x, i) => R(ys[i]!, x));
  return trueFalse([p('Here is a table of values.'), { kind: 'table', header: [hx, hy], rows: xs.map((x, i) => [`${x}`, `${ys[i]}`]) }, p('True or false: the relationship in the table is proportional.')], prop, {
    hints: ['In a proportional relationship, y ÷ x is the same for every row.', `Work out ${ys[0]} ÷ ${xs[0]}, ${ys[1]} ÷ ${xs[1]} and ${ys[2]} ÷ ${xs[2]}. Are they all equal?`],
    solution: [
      steps(...xs.map((x, i) => ({ text: `Row ${i + 1}:`, math: `${ys[i]} \\div ${x} = ${ratios[i]!.toDecimal(4) !== null ? nl(ratios[i]!) : frac(ratios[i]!, true)}` }))),
      prop
        ? p(`The ratio is ${k} every time, so the relationship is proportional (**true**). Each y is ${k} times x, and 0 would give 0.`)
        : p(`The ratios are not all equal, so the relationship is **not** proportional (**false**). The values go up by the same amount each step, but they start from ${b} more than a proportional pattern would: 0 would give ${b}, not 0.`),
    ],
    misconception: prop ? undefined : MIS.constantChange.id,
    params: { kind: 'table', xs, ys },
  });
}

function propVerbalQ(rng: Rng): Draft {
  const who = rng.pick(NAMES);
  const props: (() => { text: string; base: number })[] = [
    () => ({ text: `Bulk rice costs ${cash(rng.pick([2, 3, 4]))} per kilogram: the total cost compared with the mass you buy.`, base: 0 }),
    () => ({ text: `A car drives at a steady ${rng.pick([80, 90, 100])} km/h: the distance compared with the time.`, base: 0 }),
    () => ({ text: `${who} earns ${cash(rng.pick([15, 16, 17]))} per hour: the pay compared with the hours worked.`, base: 0 }),
    () => ({ text: 'Lengths in metres and in centimetres: the number of centimetres compared with the number of metres.', base: 0 }),
  ];
  const nons: (() => { text: string; base: number })[] = [
    () => ({ text: `A taxi charges ${cash(4)} to start plus ${cash(2)} per kilometre: the fare compared with the distance.`, base: 4 }),
    () => ({ text: `A gym charges a ${cash(30)} sign-up fee plus ${cash(20)} per month: the total cost compared with the number of months.`, base: 30 }),
    () => ({ text: 'A candle is 20 cm tall and burns down 2 cm each hour: its height compared with the hours it has burned.', base: 20 }),
    () => ({ text: 'A plant is 5 cm tall when planted and grows 3 cm each week: its height compared with the number of weeks.', base: 5 }),
    () => ({ text: `A phone plan costs ${cash(25)} a month plus ${cash(5)} for each gigabyte of data: the monthly bill compared with the gigabytes used.`, base: 25 }),
  ];
  const right = rng.pick(props)();
  const others = rng
    .shuffle(nons)
    .slice(0, 3)
    .map((f) => f());
  return choice(
    rng,
    [p('Which situation is **proportional**?')],
    right.text,
    others.map((o) => ({ text: o.text, misconception: MIS.constantChange.id })),
    {
      hints: ['In a proportional situation, zero of the first quantity gives zero of the second, and doubling one doubles the other.', 'Look for a starting amount, like a fee or a starting height. If there is one, the situation is not proportional.'],
      solution: [p(`“${right.text}” is proportional: there is a constant rate, and 0 of one quantity gives 0 of the other.`), p('Each of the other situations has a starting amount (a fee, a starting height), so doubling one quantity does not double the other. They change at a steady rate, but they are not proportional.')],
      params: { kind: 'verbal', opts: [right, ...others] },
    },
  );
}

function scaleFactorQ(rng: Rng): Draft {
  const who = rng.pick(NAMES);
  if (rng.chance(0.5)) {
    const a = rng.pick([8, 10, 12, 16, 20]);
    const k = rat(rng.pick([1.5, 2, 2.5, 3, 0.5, 0.75]));
    const b = k.mul(a);
    const enl = k.cmp(1) > 0;
    return decAns([p(`A photo that is ${a} cm wide is ${enl ? 'enlarged' : 'reduced'} so that it is ${nt(b)} cm wide, with its shape kept the same. What is the scale factor?`)], k, {
      hints: ['The scale factor is the number you multiply the original length by to get the new length.', `Divide the new width by the original width: ${nt(b)} ÷ ${a}.`],
      solution: [m(`\\text{scale factor} = \\frac{\\text{new}}{\\text{original}} = \\frac{${nl(b)}}{${a}} = ${nl(k)}`), p(enl ? 'The scale factor is greater than 1 because the photo got bigger.' : 'The scale factor is less than 1 because the photo got smaller.')],
      wrong: [
        [b.sub(a).abs(), MIS.additive.id],
        [R(a).div(b), MIS.inverted.id],
      ],
      params: { kind: 'factor', a, b: b.toNumber() },
    });
  }
  const k = rat(rng.pick([1.5, 2, 2.5, 3, 4]));
  const orig = R(rng.pick([120, 150, 200, 250, 300, 180, 240]));
  const nw = orig.mul(k);
  return decAns([p(`${who} multiplied every amount in a soup recipe by a scale factor of ${nt(k)}. The new recipe uses ${nt(nw)} mL of broth. How much broth did the original recipe use?`)], orig, {
    hints: ['The new amount is the original amount times the scale factor. Work backwards.', `Divide the new amount by the scale factor: ${nt(nw)} ÷ ${nt(k)}.`],
    solution: [m(`\\text{original} \\times ${nl(k)} = ${nl(nw)} \\quad\\Rightarrow\\quad \\text{original} = ${nl(nw)} \\div ${nl(k)} = ${nl(orig)}\\text{ mL}`)],
    wrong: [[nw.mul(k), MIS.inverted.id]],
    unit: 'mL',
    params: { kind: 'initial', nw: nw.toNumber(), k: k.toNumber() },
  });
}

function shareQ(rng: Rng): Draft {
  const [a, b] = rng.pick([
    [2, 3],
    [3, 2],
    [1, 4],
    [3, 5],
    [2, 5],
    [4, 1],
    [1, 3],
  ] as const);
  const [mix, first, second] = rng.pick([
    ['paint', 'blue paint', 'white paint'],
    ['punch', 'juice concentrate', 'water'],
    ['potting soil', 'compost', 'sand'],
  ] as const);
  const k = rng.int(2, 12);
  const total = R((a + b) * k);
  const ans = R(a * k);
  return decAns([p(`A ${mix} mixture uses ${first} and ${second} in the ratio ${a} : ${b}. How many litres of ${first} are in ${nt(total)} L of the mixture?`)], ans, {
    hints: [`The ratio ${a} : ${b} means ${a + b} equal parts in all. How big is one part?`, `One part is ${nt(total)} ÷ ${a + b} = ${k} L. ${first[0]!.toUpperCase()}${first.slice(1)} is ${a} part${a === 1 ? '' : 's'}.`],
    solution: [steps({ text: 'Count the parts in the whole mixture.', math: `${a} + ${b} = ${a + b}` }, { text: 'Find the size of one part.', math: `${nl(total)} \\div ${a + b} = ${k}\\text{ L}` }, { text: `${first[0]!.toUpperCase()}${first.slice(1)} is ${a} part${a === 1 ? '' : 's'}.`, math: `${a} \\times ${k} = ${a * k}\\text{ L}` })],
    wrong: [
      [total.mul(a).div(b), MIS.partPart.id],
      [R(k), MIS.stoppedEarly.id],
    ],
    unit: 'L',
    params: { kind: 'share', a, b, total: total.toNumber() },
  });
}

function fuelQ(rng: Rng): Draft {
  const r = rat(rng.pick([6.5, 7, 7.5, 8, 8.5, 9]));
  const D = rng.pick([150, 250, 340, 420, 560, 480]);
  const ans = r.mul(D).div(100);
  return decAns([p(`A car uses ${nt(r)} L of gasoline for every 100 km. How many litres does it use on a ${D} km trip?`)], ans, {
    hints: [`The rate is for 100 km. How many hundreds of kilometres are in ${D} km?`, `${D} km is ${nt(R(D, 100))} hundreds of kilometres. Multiply ${nt(r)} by ${nt(R(D, 100))}.`],
    solution: [steps({ text: 'Find the fuel for 1 km, or count the hundreds of kilometres.', math: `${D} \\div 100 = ${nl(R(D, 100))}` }, { text: 'Multiply by the fuel used per 100 km.', math: `${nl(R(D, 100))} \\times ${nl(r)} = ${nl(ans)}\\text{ L}` })],
    wrong: [
      [r.mul(D), MIS.inverted.id],
      [R(D).div(r), MIS.inverted.id],
    ],
    unit: 'L',
    params: { kind: 'fuel', r: r.toNumber(), D },
  });
}

function mapQ(rng: Rng): Draft {
  const s = rat(rng.pick([2, 2.5, 5, 0.5, 4]));
  const d = rat(rng.pick([3.5, 4.2, 6, 7.4, 12.5, 8.6]));
  const ans = s.mul(d);
  return decAns([p(`On a map of Ontario cottage country, 1 cm represents ${nt(s)} km. Two lakes are ${nt(d)} cm apart on the map. How far apart are they in real life, in kilometres?`)], ans, {
    hints: ['Each centimetre on the map stands for the same real distance.', `Multiply the map distance by ${nt(s)}.`],
    solution: [m(`${nl(d)}\\text{ cm} \\times ${nl(s)}\\text{ km per cm} = ${nl(ans)}\\text{ km}`)],
    wrong: [[d.div(s), MIS.inverted.id]],
    unit: 'km',
    params: { kind: 'map', s: s.toNumber(), d: d.toNumber() },
  });
}

function flowQ(rng: Rng): Draft {
  const r = R(rng.int(2, 6), 100);
  const days = rng.int(8, 30);
  const end = R(rng.int(10, 30) * 2, 100);
  const start = end.add(r.mul(days));
  return decAns([p(`The water level of a river is ${nt(start)} m. It is going down at a steady rate of ${nt(r)} m per day. How many days will it take for the level to reach ${nt(end)} m?`)], R(days), {
    hints: ['First find how much the level has to drop.', `It has to drop ${nt(start)} − ${nt(end)} = ${nt(start.sub(end))} m. How many drops of ${nt(r)} m is that?`],
    solution: [steps({ text: 'Find the total drop.', math: `${nl(start)} - ${nl(end)} = ${nl(start.sub(end))}\\text{ m}` }, { text: 'Divide by the drop per day.', math: `${nl(start.sub(end))} \\div ${nl(r)} = ${days}\\text{ days}` })],
    wrong: [
      [start.div(r), MIS.stoppedEarly.id],
      [end.div(r), MIS.stoppedEarly.id],
    ],
    unit: 'days',
    params: { kind: 'flow', start: start.toNumber(), end: end.toNumber(), r: r.toNumber() },
  });
}

function taxQ(rng: Rng): Draft {
  const P = R(20 * rng.int(3, 15));
  const disc = rng.pick([10, 15, 20, 25, 30]);
  const sale = P.mul(100 - disc).div(100);
  const total = sale.mul(113).div(100);
  return moneyAns([p(`A pair of running shoes costs ${cash(P)}. They are on sale for ${disc}% off, and then 13% HST is added to the sale price. What is the final price? Round to the nearest cent.`)], total, {
    hints: ['Do the discount first, then add the tax to the sale price.', `The sale price is ${100 - disc}% of ${cash(P)}. Then the final price is 113% of the sale price.`],
    solution: [
      steps(
        { text: `Discount: ${disc}% off leaves ${100 - disc}% of the price.`, math: `${nl(P)} \\times ${nl(R(100 - disc, 100))} = ${cashL(sale)}` },
        { text: 'Tax: adding 13% gives 113% of the sale price.', math: `${nl(sale)} \\times 1.13 = ${longShow(total)}` },
        { text: 'Round to the nearest cent.', math: `\\approx ${cashL(roundTo(total, 2))}` },
      ),
    ],
    wrong: [
      [P.mul(100 - disc + 13).div(100), MIS.combinePct.id],
      [sale, MIS.stoppedEarly.id],
    ],
    params: { kind: 'tax', P: P.toNumber(), disc },
  });
}

export const proportion: SkillPack = {
  id: 'proportion',
  title: 'Ratios, rates and proportions',
  subject: 'math',
  expectations: [
    { id: `${G6}:B2.12`, note: 'Solves ratio problems: equivalent ratios and missing values (with ratio tables in the solutions), unit rates, writing a part-to-whole ratio as a percent, and comparing unit prices to find the better buy. Choosing tools is shown in the lesson, not assessed.', levels: [1, 2, 3] },
    { id: `${G7}:B2.10`, note: 'Identifies proportional and non-proportional situations from tables (true/false: is y ÷ x constant?) and from descriptions (choice: a fee or starting amount means not proportional), and applies proportional reasoning: missing values, unit rates, speed, and sharing in a ratio.', levels: [1, 2, 3, 4] },
    { id: `${G8}:B2.8`, note: 'Compares proportional situations with unit rates (better buy, faster speed), determines unknown values, finds and uses scale factors (including working back to the initial amount), and solves rate problems such as fuel consumption.', levels: [2, 3, 4] },
    { id: `${W}:B3.5`, note: 'Solves problems with rates, percentages and proportions in real-life contexts: unit rates, map scales, flow rates, comparison shopping, sharing in a ratio, and a discount followed by 13% HST. Posing problems is not assessed.', levels: [2, 3, 4] },
  ],
  prerequisites: [],
  goal: 'I can use ratios and rates to find missing amounts and compare deals.',
  explain: (c) => [
    p('A **ratio** compares quantities by multiplication. If a recipe uses 3 cups of flour for every 2 cups of milk, the ratio of flour to milk is 3 : 2. **Equivalent ratios** come from multiplying or dividing both terms by the same number: 3 : 2 = 6 : 4 = 9 : 6.'),
    p('A **rate** compares quantities with different units, like 240 km in 3 h. A **unit rate** is the amount for 1: 240 ÷ 3 = 80 km/h.'),
    steps({ text: '4 notebooks cost $6. How much do 10 notebooks cost? Find the unit rate first.', math: '6 \\div 4 = 1.5 \\text{ dollars per notebook}' }, { text: 'Multiply by the number you need.', math: '1.5 \\times 10 = 15' }, { text: '10 notebooks cost $15.' }),
    ...(c.grade === 6 ? [p('A ratio can also be written as a percent of the whole: 10 red beads out of 25 beads is $$\\frac{10}{25} = \\frac{40}{100} = 40\\%$$.')] : []),
    ...(c.grade === 7
      ? [
          p('Two quantities are **proportional** when their ratio is always the same: y ÷ x gives the same number for every pair, and 0 of one means 0 of the other. Earning $15 per hour is proportional. A gym that charges a $30 fee plus $20 per month is **not** proportional: 1 month costs $50 but 2 months cost $70, not $100.'),
        ]
      : []),
    ...(c.grade >= 8 ? [p('To **compare** proportional situations, turn each into a unit rate (price per 100 g, kilometres per hour) and compare those. A **scale factor** tells you what to multiply by: new amount = scale factor × original amount, so original amount = new amount ÷ scale factor.')] : []),
    c.simple ? tip('Find the amount for 1, then multiply.') : warn('Ratios grow by multiplying, not adding. 2 : 3 is not equivalent to 4 : 5.'),
  ],
  alternatives: () => ({
    simpler: [p('Find how much for 1 thing. Then multiply by how many you want.')],
    analogy: [p('If 1 movie ticket costs $12, then 3 tickets cost 3 × $12 = $36. Every rate works like ticket prices: work out the price of one, then scale up.')],
    visual: [
      { kind: 'table', header: ['Cans', 'Cost ($)'], rows: [['3', '4'], ['6', '8'], ['9', '12'], ['15', '20']] },
      p('In a ratio table, both columns are multiplied by the same number each time. 3 cans cost $4, so 15 cans (5 times as many) cost 5 × $4 = $20.'),
    ],
    steps: [
      p('A 500 g box of cereal costs $4.50 and a 750 g box costs $6.00. Which is the better buy?'),
      steps({ text: 'Price for 100 g of the small box.', math: '4.50 \\div 5 = 0.90' }, { text: 'Price for 100 g of the large box.', math: '6.00 \\div 7.5 = 0.80' }, { text: 'The large box costs less per 100 g, so it is the better buy.' }),
    ],
    compare: [p('Equivalent ratios work exactly like equivalent fractions: $$\\frac{3}{4} = \\frac{15}{20}$$ because both parts were multiplied by 5.')],
  }),
  example: (rng) => {
    const cx = MISSING_CTX[0]!;
    const a = rng.pick([4, 5]);
    const u = rat(rng.pick(cx.uRate));
    const c = a + rng.int(1, a - 1) + a;
    const s = missingSolution(a, u.mul(a), c, cx.show);
    return [p(cx.text(a, cx.show(u.mul(a)), c, '')), ...s.solution];
  },
  generate: (rng, d, c) => {
    const g = c.grade;
    if (d === 1) return missingQ(rng, 'int');
    if (g === 6) {
      if (d === 2) return rng.pick([() => unitRateQ(rng), () => missingQ(rng, 'rate'), () => ratioPctQ(rng)])();
      return rng.pick([() => bestBuyQ(rng, false), () => missingQ(rng, 'rate'), () => ratioPctQ(rng)])();
    }
    if (g === 7) {
      if (d === 2) return rng.pick([() => propTableQ(rng), () => unitRateQ(rng), () => missingQ(rng, 'rate')])();
      if (d === 3) return rng.pick([() => propVerbalQ(rng), () => propTableQ(rng), () => missingQ(rng, 'rate'), () => speedCompareQ(rng)])();
      return rng.pick([() => shareQ(rng), () => fuelQ(rng), () => propVerbalQ(rng)])();
    }
    if (g === 8) {
      if (d === 2) return rng.pick([() => unitRateQ(rng), () => missingQ(rng, 'rate'), () => scaleFactorQ(rng)])();
      if (d === 3) return rng.pick([() => bestBuyQ(rng, false), () => speedCompareQ(rng), () => scaleFactorQ(rng)])();
      return rng.pick([() => bestBuyQ(rng, true), () => shareQ(rng), () => fuelQ(rng)])();
    }
    if (d === 2) return rng.pick([() => unitRateQ(rng), () => mapQ(rng), () => missingQ(rng, 'rate')])();
    if (d === 3) return rng.pick([() => bestBuyQ(rng, false), () => flowQ(rng), () => shareQ(rng)])();
    return rng.pick([() => taxQ(rng), () => bestBuyQ(rng, true), () => fuelQ(rng)])();
  },
  selfCheck: (q) => {
    const pr = prm(q);
    switch (pr.kind) {
      case 'missing':
        return near(q, (num(pr, 'b') * num(pr, 'c')) / num(pr, 'a'));
      case 'unit':
        return near(q, num(pr, 'total') / num(pr, 'n'));
      case 'ratiopct':
        return near(q, (num(pr, 'r') / num(pr, 'total')) * 100);
      case 'cmp': {
        const opts = pr.opts as CmpOpt[];
        const rates = opts.map((o) => o.num / o.den);
        const best = pr.better === 'low' ? Math.min(...rates) : Math.max(...rates);
        const winners = opts.filter((_, i) => Math.abs(rates[i]! - best) < 1e-12);
        return winners.length === 1 && winners[0]!.text === rightText(q) ? null : 'comparison answer is wrong';
      }
      case 'table': {
        const xs = pr.xs as number[];
        const ys = pr.ys as number[];
        const prop = xs.every((x, i) => Math.abs(ys[i]! / x - ys[0]! / xs[0]!) < 1e-12);
        return tfIs(q, prop);
      }
      case 'verbal': {
        const opts = pr.opts as { text: string; base: number }[];
        const props = opts.filter((o) => o.base === 0);
        return props.length === 1 && props[0]!.text === rightText(q) ? null : 'proportional choice is wrong';
      }
      case 'factor':
        return near(q, num(pr, 'b') / num(pr, 'a'));
      case 'initial':
        return near(q, num(pr, 'nw') / num(pr, 'k'));
      case 'share':
        return near(q, (num(pr, 'total') * num(pr, 'a')) / (num(pr, 'a') + num(pr, 'b')));
      case 'fuel':
        return near(q, (num(pr, 'r') * num(pr, 'D')) / 100);
      case 'map':
        return near(q, num(pr, 's') * num(pr, 'd'));
      case 'flow':
        return near(q, (num(pr, 'start') - num(pr, 'end')) / num(pr, 'r'), 1e-6);
      case 'tax':
        return near(q, num(pr, 'P') * (1 - num(pr, 'disc') / 100) * 1.13, 0.005);
      default:
        return 'unknown question kind';
    }
  },
  summary: ['A ratio compares quantities by multiplication; equivalent ratios multiply both terms by the same number.', 'A unit rate is the amount for 1. Find it, then multiply to get any other amount.', 'Proportional means the ratio stays the same and 0 gives 0; compare deals and speeds with unit rates.'],
  misconceptions: [MIS.additive, MIS.inverted, MIS.partPart, MIS.totals, MIS.bigger, MIS.constantChange, MIS.stoppedEarly, MIS.combinePct],
};

// ═════════════════════════ Exchange rates (Grade 7) ═════════════════════════

interface Currency {
  code: string;
  name: string;
  base: number;
  step: number;
  places: 0 | 2;
  /** Usual practice form "1 CODE = s CAD" for currencies worth more than about half a dollar. */
  reverse?: number;
}

const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US dollars', base: 0.73, step: 0.01, places: 2, reverse: 1.37 },
  { code: 'EUR', name: 'euros', base: 0.66, step: 0.01, places: 2, reverse: 1.52 },
  { code: 'GBP', name: 'British pounds', base: 0.56, step: 0.01, places: 2, reverse: 1.79 },
  { code: 'MXN', name: 'Mexican pesos', base: 13.4, step: 0.1, places: 2 },
  { code: 'INR', name: 'Indian rupees', base: 61.5, step: 0.1, places: 2 },
  { code: 'PHP', name: 'Philippine pesos', base: 41.6, step: 0.1, places: 2 },
  { code: 'CNY', name: 'Chinese yuan', base: 5.24, step: 0.01, places: 2 },
  { code: 'JPY', name: 'Japanese yen', base: 108, step: 1, places: 0 },
];

const FX = {
  op: { id: 'ratio_fx_wrong_operation', label: 'Multiplied when you should divide (or the other way round)', explanation: 'With 1 CAD = 0.73 USD, each Canadian dollar is worth fewer US dollars, so going from CAD to USD makes the number smaller (multiply), and going back makes it bigger (divide).', fix: 'Write the rate as a sentence (“1 Canadian dollar buys 0.73 US dollars”), then decide whether the answer should be bigger or smaller before you calculate.' },
  truncate: { id: 'ratio_fx_truncate', label: 'Cut off the extra digits instead of rounding', explanation: 'Dropping digits always rounds down. If the next digit is 5 or more, the last digit you keep goes up by one.', fix: 'Look at the digit just after the place you are rounding to. 5 or more: round up. 4 or less: keep the digit.' },
  smaller: { id: 'ratio_fx_smaller_better', label: 'Picked the smaller rate when changing money', explanation: 'When a rate says 1 CAD = some amount of another currency, a bigger number means you get more of that currency for each Canadian dollar.', fix: 'Ask: for 1 Canadian dollar, which booth gives me the most?' },
  direction: { id: 'ratio_fx_direction', label: 'Compared rates written in different directions', explanation: '“1 CAD = 0.66 EUR” and “1 EUR = 1.50 CAD” are written the opposite way round, so their numbers cannot be compared directly.', fix: 'Change every rate to the same form, such as “1 CAD = ? EUR”, by dividing 1 by the rate. Then compare.' },
  numbers: { id: 'ratio_fx_compare_numbers', label: 'Compared prices in different currencies without converting', explanation: '95 US dollars and 120 Canadian dollars are not in the same unit, so the smaller number is not always the smaller price.', fix: 'Convert one price into the other currency first. Then compare.' },
  fee: { id: 'ratio_fx_fee', label: 'Forgot the fee', explanation: 'The fee is taken off before the money is converted, so less money gets changed.', fix: 'Subtract the fee from the Canadian dollars first, then convert what is left.' },
  sameBack: { id: 'ratio_fx_same_back', label: 'Expected to get the same money back', explanation: 'Exchange booths buy a currency for less than they sell it. Changing money and changing it back usually loses a little.', fix: 'Do each conversion with its own rate, one step at a time.' },
} satisfies Record<string, Misconception>;

function practiceRate(rng: Rng, cur: Currency): Rational {
  return rat(cur.base).add(rat(cur.step).mul(rng.int(-4, 4)));
}
const roundWord = (places: number, cur?: Currency) => (places === 0 ? `the nearest whole ${cur?.code === 'JPY' ? 'yen' : 'unit'}` : 'the nearest cent (hundredth)');
const rateLine = (text: string) => p(`**Practice exchange rate:** ${text}. (This rate is made up for practice. Real rates change every day.)`);
const fxAmount = (v: Rational, places: number) => group(fixed(v, places), ' ', '−');
const fxAmountL = (v: Rational, places: number) => group(fixed(v, places), '\\,', '-');

function toForeignQ(rng: Rng, d: number): Draft {
  const cur = rng.pick(CURRENCIES);
  const r = practiceRate(rng, cur);
  const who = rng.pick(NAMES);
  const amt = d <= 1 ? R(5 * rng.int(4, 60)) : R(rng.int(2000, 40000), 100);
  const exact = amt.mul(r);
  const key = roundTo(exact, cur.places);
  const needsRound = !exact.eq(key);
  return moneyAns([rateLine(`1 CAD = ${nt(r)} ${cur.code}`), p(`${who} is changing ${cash(amt)} (Canadian) into ${cur.name} (${cur.code}) for a trip. How many ${cur.name} will ${who} get?${needsRound || d > 1 ? ` Round to ${roundWord(cur.places, cur)}.` : ''}`)], exact, {
    hints: [`Each Canadian dollar buys ${nt(r)} ${cur.code}. Should you multiply or divide?`, `Multiply: ${nt(amt)} × ${nt(r)}${needsRound ? `, then round to ${roundWord(cur.places, cur)}` : ''}.`],
    solution: [
      steps({ text: `Each Canadian dollar is worth ${nt(r)} ${cur.code}, so multiply.`, math: `${nl(amt)} \\times ${nl(r)} = ${longShow(exact)}` }, ...(needsRound ? [{ text: `Round to ${roundWord(cur.places, cur)}.`, math: `\\approx ${fxAmountL(key, cur.places)}` }] : [])),
      p(`${who} gets ${fxAmount(key, cur.places)} ${cur.code}.`),
    ],
    wrong: [
      [amt.div(r), FX.op.id],
      [needsRound ? trunc(exact, cur.places) : null, FX.truncate.id],
    ],
    unit: cur.code,
    places: cur.places,
    params: { kind: 'toForeign', amt: amt.toNumber(), r: r.toNumber(), places: cur.places },
  });
}

function toCadQ(rng: Rng, d: number): Draft {
  const cur = rng.pick(CURRENCIES);
  const who = rng.pick(NAMES);
  const useReverse = !!cur.reverse && rng.chance(0.5);
  const F = cur.places === 0 ? R(500 * rng.int(2, 40)) : d <= 2 ? R(rng.int(10, 400)) : R(rng.int(1000, 40000), 100);
  const amount = cur.places === 2 && cur.base > 10 ? F.mul(10) : F;
  let exact: Rational;
  let line: string;
  let how: Step;
  let wrongOp: Rational;
  let rateVal: Rational;
  if (useReverse) {
    const s = rat(cur.reverse!).add(R(rng.int(-4, 4), 100));
    rateVal = s;
    exact = amount.mul(s);
    line = `1 ${cur.code} = ${nt(s)} CAD`;
    how = { text: `Each ${cur.code} is worth ${nt(s)} Canadian dollars, so multiply.`, math: `${nl(amount)} \\times ${nl(s)} = ${longShow(exact)}` };
    wrongOp = amount.div(s);
  } else {
    const r = practiceRate(rng, cur);
    rateVal = r;
    exact = amount.div(r);
    line = `1 CAD = ${nt(r)} ${cur.code}`;
    how = { text: `It takes ${nt(r)} ${cur.code} to make 1 Canadian dollar, so divide.`, math: `${nl(amount)} \\div ${nl(r)} = ${longShow(exact)}` };
    wrongOp = amount.mul(r);
  }
  const key = roundTo(exact, 2);
  const needsRound = !exact.eq(key);
  const amountText = `${fxAmount(amount, cur.places)} ${cur.name} (${cur.code})`;
  return moneyAns([rateLine(line), p(`${who} has ${amountText} left over after a trip. How many Canadian dollars is that worth? Round to the nearest cent.`)], exact, {
    hints: [useReverse ? `The rate tells you how many Canadian dollars 1 ${cur.code} is worth.` : `The rate tells you how many ${cur.code} you get for 1 Canadian dollar. To go back to Canadian dollars, should you multiply or divide?`, `${useReverse ? 'Multiply' : 'Divide'} ${nt(amount)} by ${nt(rateVal)}, then round to the nearest cent.`],
    solution: [steps(how, ...(needsRound ? [{ text: 'Round to the nearest cent.', math: `\\approx ${cashL(key)}` }] : [])), p(`${amountText} is worth about ${cash(key)} Canadian.`)],
    wrong: [
      [wrongOp, FX.op.id],
      [needsRound ? trunc(exact, 2) : null, FX.truncate.id],
    ],
    unit: 'CAD',
    params: { kind: 'toCad', amount: amount.toNumber(), rate: rateVal.toNumber(), reverse: useReverse },
  });
}

function compareRatesQ(rng: Rng, mixed: boolean): Draft {
  const cur = rng.pick(CURRENCIES.filter((c) => !mixed || c.reverse));
  const picks = rng.shuffle([-4, -3, -2, -1, 0, 1, 2, 3, 4]).slice(0, 3);
  const rates = picks.map((k) => rat(cur.base).add(rat(cur.step).mul(k)));
  const booths = ['Booth A', 'Booth B', 'Booth C'];
  const reverseIdx = mixed ? rng.int(0, 2) : -1;
  const values = rates.map((r) => r.toNumber());
  const opts = rates.map((r, i) => {
    if (i === reverseIdx) {
      // Same rate, quoted the other way round and rounded to the hundredth.
      const s = roundTo(R(1).div(r), 2);
      values[i] = 1 / s.toNumber();
      return { text: `${booths[i]}: 1 ${cur.code} = ${nt(s)} CAD`, value: R(1).div(s) };
    }
    return { text: `${booths[i]}: 1 CAD = ${nt(r)} ${cur.code}`, value: r };
  });
  const sorted = [...opts].sort((a, b) => b.value.cmp(a.value));
  const best = sorted[0]!;
  const worst = sorted[sorted.length - 1]!;
  if (best.value.eq(sorted[1]!.value)) return compareRatesQ(rng, false);
  const ds = opts
    .filter((o) => o !== best)
    .map((o) => ({ text: o.text, misconception: opts.indexOf(o) === reverseIdx ? FX.direction.id : o === worst ? FX.smaller.id : undefined }));
  return choice(rng, [p(`${rng.pick(NAMES)} wants to change Canadian dollars into ${cur.name}. Three exchange booths offer these practice rates (made up for practice, not today’s real rates). Which booth gives the most ${cur.name} for each Canadian dollar?`)], best.text, ds, {
    hints: [mixed ? 'Write every rate in the same form: 1 CAD = ? ' + cur.code + '.' : `Each rate tells you how many ${cur.code} you get for 1 Canadian dollar.`, mixed ? `For a rate like 1 ${cur.code} = s CAD, 1 CAD buys 1 ÷ s ${cur.code}. Then pick the biggest.` : 'More of the other currency for each dollar is better, so pick the biggest number.'],
    solution: [
      steps(...opts.map((o, i) => (i === reverseIdx ? { text: `${o.text.split(':')[0]}: change the rate to the same form.`, math: `1 \\div ${o.text.split('= ')[1]!.split(' ')[0]} \\approx ${longShow(o.value)}\\text{ ${cur.code} per CAD}` } : { text: `${o.text}.` }))),
      p(`${best.text.split(':')[0]} gives the most ${cur.code} for each Canadian dollar.`),
    ],
    params: { kind: 'rates', opts: opts.map((o, i) => ({ text: o.text, v: values[i]! })) },
  });
}

function wherePriceQ(rng: Rng): Draft {
  const cur = rng.pick(CURRENCIES.filter((c) => c.reverse));
  const s = rat(cur.reverse!).add(R(rng.int(-4, 4), 100));
  const F = R(5 * rng.int(8, 40));
  const conv = F.mul(s);
  const delta = R(rng.int(3, 15)).mul(rng.chance(0.5) ? 1 : -1);
  const C = roundTo(conv.add(delta), 0);
  const item = rng.pick(['pair of hockey skates', 'backpack', 'video game', 'winter coat', 'pair of headphones']);
  const foreignCheaper = conv.cmp(C) < 0;
  const tF = 'The store abroad';
  const tC = 'The store in Canada';
  return choice(rng, [rateLine(`1 ${cur.code} = ${nt(s)} CAD`), p(`A ${item} costs ${nt(F)} ${cur.code} at a store abroad and ${cash(C)} at a store in Canada. Ignoring taxes and shipping, which store is cheaper?`)], foreignCheaper ? tF : tC, [{ text: foreignCheaper ? tC : tF, misconception: foreignCheaper ? undefined : FX.numbers.id }, { text: 'They cost the same' }], {
    hints: ['The two prices are in different currencies. Convert one so you compare the same kind of dollars.', `Convert the ${cur.code} price: ${nt(F)} × ${nt(s)}.`],
    solution: [steps({ text: `Convert the ${cur.code} price into Canadian dollars.`, math: `${nl(F)} \\times ${nl(s)} = ${cashL(conv)}` }, { text: `Compare with ${cash(C)}.` }), p(`${cash(roundTo(conv, 2))} is ${foreignCheaper ? 'less' : 'more'} than ${cash(C)}, so the store ${foreignCheaper ? 'abroad' : 'in Canada'} is cheaper.`)],
    params: { kind: 'where', F: F.toNumber(), s: s.toNumber(), C: C.toNumber(), foreign: tF, home: tC },
  });
}

function feeQ(rng: Rng): Draft {
  const cur = rng.pick(CURRENCIES.filter((c) => c.places === 2));
  const r = practiceRate(rng, cur);
  const fee = rng.pick([3, 4, 5, 7.5]);
  const A = R(10 * rng.int(10, 50));
  const left = A.sub(fee);
  const exact = left.mul(r);
  return moneyAns([rateLine(`1 CAD = ${nt(r)} ${cur.code}`), p(`An exchange booth charges a flat fee of ${cash(fee)}, then converts the rest of your Canadian dollars at the practice rate. You hand over ${cash(A)}. How many ${cur.name} do you get? Round to the nearest cent.`)], exact, {
    hints: ['The fee comes off first. How many Canadian dollars are left to convert?', `${cash(A)} − ${cash(fee)} = ${cash(left)}. Multiply that by ${nt(r)}.`],
    solution: [steps({ text: 'Take off the fee.', math: `${nl(A)} - ${nl(fee)} = ${cashL(left)}` }, { text: 'Convert what is left.', math: `${nl(left)} \\times ${nl(r)} = ${longShow(exact)}` }, { text: 'Round to the nearest cent.', math: `\\approx ${fxAmountL(exact, 2)}\\text{ ${cur.code}}` })],
    wrong: [
      [A.mul(r), FX.fee.id],
      [A.mul(r).sub(fee), FX.fee.id],
      [left.div(r), FX.op.id],
    ],
    unit: cur.code,
    params: { kind: 'fee', A: A.toNumber(), fee, r: r.toNumber() },
  });
}

function roundTripQ(rng: Rng): Draft {
  const cur = rng.pick(CURRENCIES.filter((c) => c.reverse));
  const r = practiceRate(rng, cur);
  // The booth buys the currency back for a little less than it sold it.
  const s = roundTo(R(1).div(r), 2).sub(R(rng.int(3, 6), 100));
  const A = R(50 * rng.int(2, 12));
  const step1 = roundTo(A.mul(r), 2);
  const back = step1.mul(s);
  const who = rng.pick(NAMES);
  return moneyAns(
    [p(`Before a trip, ${who} changes ${cash(A)} into ${cur.name} at the practice rate 1 CAD = ${nt(r)} ${cur.code}. The trip is cancelled, so ${who} changes all of it back at the practice rate 1 ${cur.code} = ${nt(s)} CAD. How many Canadian dollars does ${who} get back? Round to the nearest cent at each step. (These rates are made up for practice.)`)],
    back,
    {
      hints: ['Do two conversions, one at a time, each with its own rate.', `First: ${nt(A)} × ${nt(r)} = ${fxAmount(step1, 2)} ${cur.code}. Then multiply that by ${nt(s)}.`],
      solution: [
        steps({ text: `Change CAD to ${cur.code}.`, math: `${nl(A)} \\times ${nl(r)} = ${fxAmountL(step1, 2)}\\text{ ${cur.code}}` }, { text: 'Change it back to CAD.', math: `${nl(step1)} \\times ${nl(s)} = ${longShow(back)} \\approx ${cashL(roundTo(back, 2))}` }),
        p(`${who} gets back ${cash(roundTo(back, 2))}, a little less than ${cash(A)}, because the two rates are not exactly opposite.`),
      ],
      wrong: [
        [A, FX.sameBack.id],
        [step1.div(s), FX.op.id],
      ],
      unit: 'CAD',
      params: { kind: 'round', A: A.toNumber(), r: r.toNumber(), s: s.toNumber() },
    },
  );
}

export const exchangeRate: SkillPack = {
  id: 'exchange-rate',
  title: 'Exchange rates',
  subject: 'math',
  expectations: [
    {
      id: `${G7}:F1.1`,
      note: 'Converts Canadian dollars to foreign currencies and back using a given, clearly labelled practice rate (written either way round), rounding to the cent; compares exchange rates and prices in different currencies, and handles a flat fee and a round trip. Rates are made up for practice; finding current rates is discussed but not assessed.',
    },
  ],
  prerequisites: ['proportion'],
  goal: 'I can use an exchange rate to change money between Canadian dollars and other currencies, and compare rates.',
  explain: (c) => [
    p('An **exchange rate** tells you how much of one currency you get for another. Rates change every day, so a bank or website shows the current one. In these lessons we use **practice rates**: made-up numbers that are close to real ones.'),
    p('A rate like **1 CAD = 0.73 USD** means one Canadian dollar buys 0.73 US dollars. It is a unit rate, so you can multiply or divide by it.'),
    steps({ text: 'Canadian dollars → the other currency: multiply by the rate.', math: '200 \\times 0.73 = 146\\text{ USD}' }, { text: 'The other currency → Canadian dollars: divide by the rate.', math: '146 \\div 0.73 = 200\\text{ CAD}' }, { text: 'Round money to the nearest cent at the end.' }),
    tip('Check the size: if 1 CAD buys less than 1 of the other currency, the amount in that currency is a smaller number than the Canadian amount.'),
    ...(c.simple ? [] : [p('A rate can also be written the other way round, like **1 USD = 1.37 CAD**. Then you multiply to get Canadian dollars. To compare rates, write them all in the same form.')]),
  ],
  alternatives: () => ({
    simpler: [p('Going from Canadian money to other money: times the rate. Coming back to Canadian money: divide by the rate.')],
    analogy: [p('An exchange rate is like a price. If 1 Canadian dollar “buys” 108 yen, then 5 dollars buy 5 × 108 = 540 yen. To find how many dollars 540 yen is, ask how many groups of 108 fit: 540 ÷ 108 = 5.')],
    steps: [p('Change 87.50 euros to Canadian dollars at the practice rate 1 CAD = 0.66 EUR.'), steps({ text: 'Going back to CAD, so divide.', math: '87.50 \\div 0.66 = 132.5757\\ldots' }, { text: 'Round to the nearest cent.', math: '\\approx \\$132.58' })],
    visual: [{ kind: 'table', header: ['Canadian dollars (CAD)', 'US dollars (USD) at 1 CAD = 0.73 USD'], rows: [['1', '0.73'], ['10', '7.30'], ['100', '73.00'], ['250', '182.50']] }, p('Each row multiplies both columns by the same number, just like a ratio table.')],
    compare: [p('You already use unit rates: if apples cost $3 per kg, 4 kg cost $12. An exchange rate is a unit rate where both quantities are money.')],
  }),
  example: (rng) => {
    const r = practiceRate(rng, CURRENCIES[0]!);
    const A = R(10 * rng.int(5, 30));
    return [rateLine(`1 CAD = ${nt(r)} USD`), p(`Change ${cash(A)} into US dollars.`), steps({ text: 'Canadian to US: multiply by the rate.', math: `${nl(A)} \\times ${nl(r)} = ${nl(A.mul(r))}` }, { text: `You get ${fixed(A.mul(r), 2)} USD.` })];
  },
  generate: (rng, d) => {
    if (d === 1) return toForeignQ(rng, 1);
    if (d === 2) return rng.chance(0.5) ? toForeignQ(rng, 2) : toCadQ(rng, 2);
    if (d === 3) return rng.pick([() => toCadQ(rng, 3), () => compareRatesQ(rng, false), () => wherePriceQ(rng), () => toForeignQ(rng, 3)])();
    return rng.pick([() => feeQ(rng), () => roundTripQ(rng), () => compareRatesQ(rng, true)])();
  },
  selfCheck: (q) => {
    const pr = prm(q);
    const places = num(pr, 'places');
    const half = (k: number) => 0.5 * 10 ** -k;
    switch (pr.kind) {
      case 'toForeign':
        return near(q, num(pr, 'amt') * num(pr, 'r'), half(Number.isFinite(places) ? places : 2));
      case 'toCad':
        return near(q, pr.reverse ? num(pr, 'amount') * num(pr, 'rate') : num(pr, 'amount') / num(pr, 'rate'), half(2));
      case 'rates': {
        const opts = pr.opts as { text: string; v: number }[];
        const best = Math.max(...opts.map((o) => o.v));
        const top = opts.filter((o) => Math.abs(o.v - best) < 1e-12);
        return top.length === 1 && top[0]!.text === rightText(q) ? null : 'best rate is wrong';
      }
      case 'where': {
        const conv = num(pr, 'F') * num(pr, 's');
        const want = conv < num(pr, 'C') ? pr.foreign : conv > num(pr, 'C') ? pr.home : 'They cost the same';
        return rightText(q) === want ? null : 'cheaper store is wrong';
      }
      case 'fee':
        return near(q, (num(pr, 'A') - num(pr, 'fee')) * num(pr, 'r'), half(2));
      case 'round': {
        const first = Math.round(num(pr, 'A') * num(pr, 'r') * 100) / 100;
        return near(q, first * num(pr, 's'), half(2));
      }
      default:
        return 'unknown question kind';
    }
  },
  summary: ['An exchange rate is a unit rate between two currencies, and real rates change daily.', 'From Canadian dollars with a rate “1 CAD = r”: multiply by r. Back to Canadian dollars: divide by r.', 'Round money to the nearest cent at the end, and compare rates only when they are written the same way.'],
  misconceptions: [FX.op, FX.truncate, FX.smaller, FX.direction, FX.numbers, FX.fee, FX.sameBack],
};

// ═════════════════════════ Simple and compound interest (Grade 8, MTH1W) ═════════════════════════

const INT = {
  rateWhole: { id: 'ratio_int_rate_whole', label: 'Used the percent as a whole number', explanation: 'An interest rate of 4% means 4 hundredths, or 0.04. Multiplying by 4 instead gives an answer 100 times too big.', fix: 'Change the percent to a decimal first: divide by 100 (4% = 0.04).' },
  interestVsTotal: { id: 'ratio_int_interest_vs_total', label: 'Mixed up the interest and the total amount', explanation: 'The interest is only the extra money. The total amount (or amount repaid) is the principal plus the interest.', fix: 'Reread the question: does it ask for the interest, or for the total? Add the principal only when it asks for the total.' },
  oneYear: { id: 'ratio_int_one_year', label: 'Found the interest for only one year', explanation: 'Simple interest is earned every year, so for several years you multiply by the number of years.', fix: 'Use I = P × r × t, and check that t is the number of years in the question.' },
  simpleForCompound: { id: 'ratio_int_simple_for_compound', label: 'Used simple interest when it was compounded', explanation: 'With compound interest, each year’s interest is added to the balance, and the next year’s interest is calculated on that bigger balance.', fix: 'Multiply by (1 + rate) once for each year: A = P(1 + r)^t.' },
  compoundLinear: { id: 'ratio_int_compound_linear', label: 'Thought compound interest grows like simple interest', explanation: 'Compound interest earns interest on interest, so it grows faster and faster. After the first year it is always more than simple interest at the same rate.', fix: 'Make a year-by-year table. The interest gets bigger every year because the balance gets bigger.' },
  forgotDown: { id: 'ratio_int_forgot_down', label: 'Left out the down payment', explanation: 'The total cost is what you pay up front (the down payment) plus everything you repay on the loan.', fix: 'Total cost = down payment + amount borrowed + interest.' },
  wholePrice: { id: 'ratio_int_whole_price', label: 'Charged interest on the full price', explanation: 'Interest is only charged on the money you borrow, which is the price minus the down payment.', fix: 'Subtract the down payment first. That is the principal for the interest.' },
  rateOnly: { id: 'ratio_int_rate_only', label: 'Looked only at the rate', explanation: 'The highest rate does not always give the most money: compound interest at a slightly lower rate can beat simple interest at a higher rate.', fix: 'Work out the final amount for each option, then compare.' },
} satisfies Record<string, Misconception>;

const RATES = [2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8];
const growth = (r: Rational) => R(1).add(r.div(100));
const simpleI = (P: Rational, r: Rational, t: number) => P.mul(r).mul(t).div(100);
const compoundA = (P: Rational, r: Rational, t: number) => P.mul(growth(r).pow(t));
/** Balance rounded to the cent at the end of every year, as a bank statement would show it. */
function yearlyRounded(P: Rational, r: Rational, t: number): Rational {
  let v = P;
  for (let i = 0; i < t; i++) v = roundTo(v.mul(growth(r)), 2);
  return v;
}
/** Allow a cent or two for students who round each year instead of only at the end. */
function compoundTol(P: Rational, r: Rational, t: number): Rational {
  const diff = roundTo(compoundA(P, r, t), 2).sub(yearlyRounded(P, r, t)).abs();
  return diff.cmp(R(1, 100)) > 0 ? diff : R(1, 100);
}
const yrs = (t: number) => `${t} year${t === 1 ? '' : 's'}`;

function simpleSolution(P: Rational, r: Rational, t: number, total: boolean): Block[] {
  const I = simpleI(P, r, t);
  return [
    steps(
      { text: 'Write the rate as a decimal.', math: `${pctTex(r)} = ${nl(r.div(100))}` },
      { text: 'Simple interest: I = P × r × t.', math: `I = ${nl(P)} \\times ${nl(r.div(100))} \\times ${t} = ${cashL(I)}` },
      ...(total ? [{ text: 'Add the interest to the principal.', math: `A = ${nl(P)} + ${nl(I)} = ${cashL(P.add(I))}` }] : []),
    ),
  ];
}

function compoundSolution(P: Rational, r: Rational, t: number): Block[] {
  const g = growth(r);
  const A = compoundA(P, r, t);
  const rows: string[][] = [];
  let v = P;
  for (let i = 1; i <= t; i++) {
    const next = v.mul(g);
    rows.push([`${i}`, cash(roundTo(v, 2)), cash(roundTo(next.sub(v), 2)), cash(roundTo(next, 2))]);
    v = next;
  }
  return [
    steps(
      { text: `Each year the balance is multiplied by 1 + ${nl(r.div(100))}.`, math: `1 + ${nl(r.div(100))} = ${nl(g)}` },
      { text: `Do that ${t} times, once for each year.`, math: `A = ${nl(P)} \\times ${nl(g)}^{${t}} = ${longShow(A)}` },
      { text: 'Round to the nearest cent.', math: `A \\approx ${cashL(roundTo(A, 2))}` },
    ),
    { kind: 'table', header: ['Year', 'Balance at start', 'Interest that year', 'Balance at end'], rows },
    p('Each year’s interest is bigger than the year before, because interest is earned on the interest too. (Amounts in the table are rounded to the cent.)'),
  ];
}

function simpleQ(rng: Rng, o: { t: number; total: boolean; loan?: boolean }): Draft {
  const P = R(o.loan ? 100 * rng.int(5, 40) : 100 * rng.int(1, 30));
  const r = rat(rng.pick(o.t === 1 ? [2, 3, 4, 5, 6] : RATES));
  const t = o.t;
  const I = simpleI(P, r, t);
  const A = P.add(I);
  const who = rng.pick(NAMES);
  const text = o.loan
    ? `${who} borrows ${cash(P)} to buy a used car. The loan charges ${nt(r)}% simple interest per year for ${yrs(t)}. ${o.total ? 'What is the total amount repaid (the amount borrowed plus interest)?' : 'How much interest is charged?'}`
    : `${who} puts ${cash(P)} in a savings account that pays ${nt(r)}% simple interest per year. ${o.total ? `What is the total in the account after ${yrs(t)}?` : `How much interest does the money earn in ${yrs(t)}?`}`;
  return moneyAns([p(text)], o.total ? A : I, {
    hints: ['Simple interest: I = P × r × t, with the rate written as a decimal.', `I = ${nt(P)} × ${nt(r.div(100))} × ${t}.${o.total ? ' Then add the principal.' : ''}`],
    solution: simpleSolution(P, r, t, o.total),
    wrong: [
      [P.mul(r).mul(t).add(o.total ? P : 0), INT.rateWhole.id],
      [o.total ? I : A, INT.interestVsTotal.id],
      [t > 1 ? simpleI(P, r, 1).add(o.total ? P : 0) : null, INT.oneYear.id],
    ],
    params: { kind: 'simple', P: P.toNumber(), r: r.toNumber(), t, total: o.total },
  });
}

function compoundQ(rng: Rng, o: { t: number; total: boolean; loan?: boolean }): Draft {
  const P = R(o.loan ? 100 * rng.int(5, 40) : 50 * rng.int(4, 60));
  const r = rat(rng.pick(RATES));
  const t = o.t;
  const A = compoundA(P, r, t);
  const who = rng.pick(NAMES);
  const want = o.total ? A : A.sub(P);
  const text = o.loan
    ? `${who} borrows ${cash(P)} for ${yrs(t)} at ${nt(r)}% interest per year, compounded annually (once a year). Nothing is paid back until the end. ${o.total ? 'How much is owed at the end?' : 'How much interest is charged?'} Round to the nearest cent at the end.`
    : `${who} invests ${cash(P)} at ${nt(r)}% per year, compounded annually (once a year). ${o.total ? `How much is in the account after ${yrs(t)}?` : `How much interest is earned in ${yrs(t)}?`} Round to the nearest cent at the end.`;
  const simpleA = P.add(simpleI(P, r, t));
  const tol = compoundTol(P, r, t);
  return moneyAns([p(text)], want, {
    hints: ['With compound interest, each year’s interest is added to the balance before the next year’s interest is worked out.', `Multiply ${cash(P)} by ${nl(growth(r))} once for each year: ${t} times.${o.total ? '' : ' Then subtract the principal to get the interest.'}`],
    solution: [...compoundSolution(P, r, t), ...(o.total ? [] : [p(`Interest = ${cash(roundTo(A, 2))} − ${cash(P)} = ${cash(roundTo(A, 2).sub(P))}.`)])],
    wrong: [
      [o.total ? simpleA : simpleA.sub(P), INT.simpleForCompound.id],
      [o.total ? A.sub(P) : A, INT.interestVsTotal.id],
    ],
    tol,
    params: { kind: 'compound', P: P.toNumber(), r: r.toNumber(), t, total: o.total },
  });
}

function diffQ(rng: Rng): Draft {
  const P = R(500 * rng.int(1, 10));
  const r = rat(rng.pick([3, 4, 5, 6, 8]));
  const t = rng.int(2, 4);
  const Ac = roundTo(compoundA(P, r, t), 2);
  const As = P.add(simpleI(P, r, t));
  const diff = Ac.sub(As);
  return moneyAns([p(`${cash(P)} is invested for ${yrs(t)} at ${nt(r)}% per year. How much more is in the account if the interest is compounded annually than if it is simple interest? Round to the nearest cent.`)], diff, {
    hints: ['Find the final amount both ways, then subtract.', `Simple: ${nt(P)} + ${nt(P)} × ${nt(r.div(100))} × ${t}. Compound: ${nt(P)} × ${nl(growth(r))}^${t}.`],
    solution: [
      steps(
        { text: 'Simple interest total.', math: `${nl(P)} + ${nl(P)} \\times ${nl(r.div(100))} \\times ${t} = ${cashL(As)}` },
        { text: 'Compound interest total.', math: `${nl(P)} \\times ${nl(growth(r))}^{${t}} = ${longShow(compoundA(P, r, t))} \\approx ${cashL(Ac)}` },
        { text: 'Subtract.', math: `${nl(Ac)} - ${nl(As)} = ${cashL(diff)}` },
      ),
      p('Compound interest earns more because the interest itself earns interest.'),
    ],
    wrong: [
      [Ac.sub(P), INT.interestVsTotal.id],
      [simpleI(P, r, t), INT.interestVsTotal.id],
    ],
    tol: compoundTol(P, r, t),
    params: { kind: 'diff', P: P.toNumber(), r: r.toNumber(), t },
  });
}

function interestTfQ(rng: Rng): Draft {
  const P = R(100 * rng.int(5, 50));
  const r = rat(rng.pick([3, 4, 5, 6]));
  const t = rng.int(2, 3);
  const stmt = rng.int(0, 4);
  const Ic = (yrs: number) => compoundA(P, r, yrs).sub(P);
  const Is = (yrs: number) => simpleI(P, r, yrs);
  let text = '';
  let truth = false;
  let solution: Block[] = [];
  let mis: string | undefined;
  switch (stmt) {
    case 0:
      text = `After 1 year, ${cash(P)} at ${nt(r)}% earns the same interest whether it is simple interest or compounded annually.`;
      truth = Ic(1).eq(Is(1));
      solution = [m(`\\text{simple: } ${nl(P)} \\times ${nl(r.div(100))} = ${cashL(Is(1))}, \\quad \\text{compound: } ${nl(P)} \\times ${nl(growth(r))} - ${nl(P)} = ${cashL(Ic(1))}`), p('In the first year both earn interest only on the starting amount, so they are equal: **true**.')];
      break;
    case 1:
      text = `${cash(P)} at ${nt(r)}% simple interest earns exactly twice as much interest in ${yrs(2 * t)} as in ${yrs(t)}.`;
      truth = Is(2 * t).eq(Is(t).mul(2));
      solution = [m(`${nl(P)} \\times ${nl(r.div(100))} \\times ${t} = ${cashL(Is(t))}, \\quad ${nl(P)} \\times ${nl(r.div(100))} \\times ${2 * t} = ${cashL(Is(2 * t))}`), p('Simple interest is the same every year, so doubling the time doubles the interest: **true**.')];
      break;
    case 2:
      text = `${cash(P)} at ${nt(r)}% compounded annually earns exactly twice as much interest in ${yrs(2 * t)} as in ${yrs(t)}.`;
      truth = Ic(2 * t).eq(Ic(t).mul(2));
      mis = INT.compoundLinear.id;
      solution = [m(`${t}\\text{ years: } ${longShow(Ic(t))}, \\quad ${2 * t}\\text{ years: } ${longShow(Ic(2 * t))}`), p(`Twice the first amount would be about ${cash(roundTo(Ic(t).mul(2), 2))}, but compound interest earns interest on interest, so it is more than double: **false**.`)];
      break;
    case 3:
      text = `After ${yrs(t)}, ${cash(P)} earns more interest at ${nt(r)}% compounded annually than at ${nt(r)}% simple interest.`;
      truth = Ic(t).cmp(Is(t)) > 0;
      solution = [m(`\\text{compound: } ${longShow(Ic(t))}, \\quad \\text{simple: } ${cashL(Is(t))}`), p('After the first year, compound interest earns interest on the interest too, so it earns more: **true**.')];
      break;
    default:
      text = `After ${yrs(t)}, ${cash(P)} earns more interest at ${nt(r)}% simple interest than at ${nt(r)}% compounded annually.`;
      truth = Is(t).cmp(Ic(t)) > 0;
      mis = INT.compoundLinear.id;
      solution = [m(`\\text{simple: } ${cashL(Is(t))}, \\quad \\text{compound: } ${longShow(Ic(t))}`), p('Compound interest earns more after the first year, so the statement is **false**.')];
  }
  return trueFalse([p(`True or false: ${text}`)], truth, {
    hints: ['Work out both amounts with numbers rather than guessing.', 'Simple interest is the same every year. Compound interest grows each year because interest is added to the balance.'],
    solution,
    misconception: truth ? undefined : mis,
    params: { kind: 'tf', stmt, P: P.toNumber(), r: r.toNumber(), t },
  });
}

interface IntOption {
  text: string;
  r: number;
  t: number;
  compound: boolean;
}

function optionsQ(rng: Rng, loan: boolean): Draft {
  const P = R(1000 * rng.int(1, 8));
  const t = 4;
  const rc = rat(rng.pick([4, 4.5, 5, 5.5, 6]));
  const rs = rc.add(R(rng.int(1, 5), 10));
  const rs2 = loan ? rc.add(R(rng.int(6, 10), 10)) : rc.sub(R(rng.pick([5, 10]), 10));
  const optsRaw: IntOption[] = [
    { text: `${nt(rc)}% compounded annually`, r: rc.toNumber(), t, compound: true },
    { text: `${nt(rs)}% simple interest`, r: rs.toNumber(), t, compound: false },
    { text: `${nt(rs2)}% simple interest`, r: rs2.toNumber(), t, compound: false },
  ];
  const final = (o: IntOption) => (o.compound ? compoundA(P, rat(o.r), t) : P.add(simpleI(P, rat(o.r), t)));
  const vals = optsRaw.map(final);
  const order = [...optsRaw.keys()].sort((a, b) => vals[b]!.cmp(vals[a]!));
  const targetIdx = loan ? order[order.length - 1]! : order[0]!;
  const close = loan ? [order[order.length - 1]!, order[order.length - 2]!] : [order[0]!, order[1]!];
  if (roundTo(vals[close[0]!]!, 2).eq(roundTo(vals[close[1]!]!, 2))) return optionsQ(rng, loan);
  const right = optsRaw[targetIdx]!;
  const tempting = optsRaw.reduce((a, b) => (loan ? (b.r < a.r ? b : a) : b.r > a.r ? b : a));
  const ds = optsRaw.filter((o) => o !== right).map((o) => ({ text: o.text, misconception: o === tempting ? INT.rateOnly.id : undefined }));
  const verb = loan ? `You need to borrow ${cash(P)} for ${yrs(t)}, paying it all back at the end. Which loan costs the least in total?` : `You want to invest ${cash(P)} for ${yrs(t)}. Which option gives the most money at the end?`;
  return choice(rng, [p(verb)], right.text, ds, {
    hints: ['Work out the final amount for each option. The rate alone does not tell you.', `Simple: P + P × r × ${t}. Compound: P × (1 + r)^${t}.`],
    solution: [steps(...optsRaw.map((o, i) => ({ text: `${o.text}:`, math: o.compound ? `${nl(P)} \\times ${nl(growth(rat(o.r)))}^{${t}} \\approx ${cashL(roundTo(vals[i]!, 2))}` : `${nl(P)} + ${nl(P)} \\times ${nl(rat(o.r).div(100))} \\times ${t} = ${cashL(vals[i]!)}` }))), p(`So “${right.text}” ${loan ? 'costs the least' : 'gives the most'}.`)],
    params: { kind: 'options', P: P.toNumber(), loan, opts: optsRaw },
  });
}

function downPaymentQ(rng: Rng, asChoice: boolean): Draft {
  const [item, lo, hi] = rng.pick([
    ['laptop', 12, 25],
    ['e-bike', 20, 40],
    ['used car', 80, 150],
    ['set of furniture', 15, 30],
  ] as const);
  const C = R(100 * rng.int(lo, hi));
  const mk = (downPct: number, r: number, t: number) => {
    const D = C.mul(downPct).div(100);
    const B = C.sub(D);
    const I = simpleI(B, rat(r), t);
    return { D, B, I, r, t, total: D.add(B).add(I), downPct };
  };
  const a = mk(rng.pick([10, 20]), rng.pick([6, 7, 8, 9]), rng.pick([2, 3]));
  let b = mk(rng.pick([25, 30, 40]), rng.pick([8, 9, 10, 11]), rng.pick([1, 2, 3]));
  if (b.total.eq(a.total)) b = mk(b.downPct, b.r + 1, b.t);
  const plan = (x: typeof a) => `${cash(x.D)} down, then borrow the rest at ${x.r}% simple interest per year for ${yrs(x.t)}`;
  const intro = [p(`A ${item} costs ${cash(C)}. There are two ways to pay:`), { kind: 'list', items: [`**Plan A:** ${plan(a)}.`, `**Plan B:** ${plan(b)}.`], ordered: false } as Block];
  const work = (x: typeof a, name: string): Step[] => [
    { text: `${name}: amount borrowed.`, math: `${nl(C)} - ${nl(x.D)} = ${cashL(x.B)}` },
    { text: `${name}: interest.`, math: `${nl(x.B)} \\times ${nl(R(x.r, 100))} \\times ${x.t} = ${cashL(x.I)}` },
    { text: `${name}: total cost = down payment + amount borrowed + interest.`, math: `${nl(x.D)} + ${nl(x.B)} + ${nl(x.I)} = ${cashL(x.total)}` },
  ];
  if (asChoice) {
    const cheaper = a.total.cmp(b.total) < 0 ? 'Plan A' : 'Plan B';
    const other = cheaper === 'Plan A' ? 'Plan B' : 'Plan A';
    const lowerRate = a.r < b.r ? 'Plan A' : 'Plan B';
    return choice(rng, [...intro, p('Which plan costs less in total?')], cheaper, [{ text: other, misconception: other === lowerRate ? INT.rateOnly.id : undefined }, { text: 'Both plans cost the same' }], {
      hints: ['The interest is charged only on the amount borrowed. Work out the total cost of each plan.', 'Total cost = down payment + amount borrowed + interest, where interest = amount borrowed × rate × years.'],
      solution: [steps(...work(a, 'Plan A'), ...work(b, 'Plan B')), p(`${cheaper} costs ${cash(a.total.sub(b.total).abs())} less in total.`)],
      params: { kind: 'downChoice', C: C.toNumber(), a: [a.downPct, a.r, a.t], b: [b.downPct, b.r, b.t] },
    });
  }
  const which = rng.chance(0.5) ? b : a;
  const name = which === a ? 'Plan A' : 'Plan B';
  return moneyAns([...intro, p(`What is the total cost of ${name}, including the down payment and all interest?`)], which.total, {
    hints: ['Interest is charged only on the amount borrowed: the price minus the down payment.', `Borrowed: ${cash(C)} − ${cash(which.D)} = ${cash(which.B)}. Find its interest, then add everything you pay.`],
    solution: [steps(...work(which, name))],
    wrong: [
      [which.B.add(which.I), INT.forgotDown.id],
      [C.add(simpleI(C, rat(which.r), which.t)), INT.wholePrice.id],
      [which.I, INT.interestVsTotal.id],
    ],
    params: { kind: 'down', C: C.toNumber(), downPct: which.downPct, r: which.r, t: which.t },
  });
}

export const interest: SkillPack = {
  id: 'interest',
  title: 'Simple and compound interest',
  subject: 'math',
  expectations: [
    {
      id: `${G8}:F1.4`,
      note: 'Calculates simple interest (I = Prt) and compound interest compounded annually over 1–4 years, rounded to the cent at the end, compares the two, and judges statements about how each grows over time. The expectation mentions digital tools: a spreadsheet-style calculation is shown in the lesson, but the calculation is practised directly. Explaining long-term planning is discussed, not assessed.',
      levels: [1, 2, 3, 4],
    },
    {
      id: `${W}:F1.3`,
      note: 'Compares total costs of borrowing: simple and annually compounded loans, plans with different down payments, rates and times (total cost = down payment + amount borrowed + interest), and options at different rates. Other compounding periods and tools are mentioned, not assessed.',
      levels: [2, 3, 4],
    },
  ],
  prerequisites: ['percent-of'],
  goal: 'I can calculate simple and compound interest and compare how much money grows or how much a loan costs.',
  explain: (c) => [
    p('**Interest** is money paid for using money. When you save, the bank pays you interest. When you borrow, you pay interest. The starting amount is the **principal** (P), and the **rate** (r) is a percent per year.'),
    p('**Simple interest** is calculated only on the principal, so it is the same every year:'),
    m('I = P \\times r \\times t \\qquad A = P + I'),
    p('**Compound interest** (compounded annually) is added to the balance each year, and next year’s interest is calculated on the bigger balance:'),
    m('A = P(1 + r)^t'),
    steps({ text: '$500 at 4% compounded annually for 3 years. Write 4% as 0.04.', math: '1 + 0.04 = 1.04' }, { text: 'Multiply by 1.04 three times.', math: '500 \\times 1.04^3 = 562.432' }, { text: 'Round to the nearest cent.', math: 'A \\approx \\$562.43' }),
    ...(c.simple ? [] : [p('Spreadsheets and online calculators do this year after year. A spreadsheet might put 500 in cell B1 and =B1*1.04 in B2, then fill down. The steps a computer follows look like this:'), { kind: 'code', language: 'pseudocode', code: 'balance ← 500\nrepeat 3 times\n    balance ← balance × 1.04\nprint balance rounded to the cent' } as Block]),
    ...(c.grade >= 9 ? [p('When you buy something on credit, the **total cost** = down payment + amount borrowed + interest. A bigger down payment means you borrow less, so you pay less interest.')] : []),
    tip('Over a long time, compound interest grows much faster than simple interest. That is great for savings and expensive for debts.'),
  ],
  alternatives: (c) => ({
    simpler: [p('Simple interest: the same amount every year. Compound interest: you also earn interest on your interest, so it grows a bit more each year.')],
    analogy: [p('Compound interest is like a snowball rolling downhill: the bigger it gets, the more snow it picks up each turn. Simple interest is like adding one scoop of snow each turn.')],
    steps: [p('$1000 at 5% for 2 years.'), steps({ text: 'Simple interest: same every year.', math: '1000 \\times 0.05 \\times 2 = 100 \\Rightarrow A = \\$1100' }, { text: 'Compound interest: multiply by 1.05 twice.', math: '1000 \\times 1.05^2 = 1102.50 \\Rightarrow A = \\$1102.50' })],
    visual: [{ kind: 'table', header: ['Year', 'Simple (5% of $1000)', 'Compound (5% each year)'], rows: [['0', '$1000.00', '$1000.00'], ['1', '$1050.00', '$1050.00'], ['2', '$1100.00', '$1102.50'], ['3', '$1150.00', '$1157.63'], ['10', '$1500.00', '$1628.89']] }],
    ...(c.grade >= 9 ? { compare: [p('A $1500 e-bike: putting $500 down and borrowing $1000 at 8% simple for 2 years costs $500 + $1000 + $160 = $1660. Putting nothing down costs $1500 + $240 = $1740.')] } : {}),
  }),
  example: (rng) => {
    const P = R(100 * rng.int(3, 20));
    const r = rat(rng.pick([3, 4, 5]));
    return [p(`${cash(P)} is invested at ${nt(r)}% per year compounded annually for 3 years. How much is in the account at the end?`), ...compoundSolution(P, r, 3)];
  },
  generate: (rng, d, c) => {
    if (c.grade >= 9) {
      if (d <= 2) return rng.chance(0.6) ? simpleQ(rng, { t: rng.int(2, 5), total: true, loan: true }) : compoundQ(rng, { t: 2, total: true, loan: true });
      if (d === 3) return downPaymentQ(rng, rng.chance(0.4));
      return rng.chance(0.5) ? optionsQ(rng, true) : compoundQ(rng, { t: rng.int(3, 4), total: false, loan: true });
    }
    if (d === 1) return simpleQ(rng, { t: rng.int(1, 3), total: false });
    if (d === 2) return rng.chance(0.5) ? simpleQ(rng, { t: rng.int(2, 5), total: rng.chance(0.6) }) : compoundQ(rng, { t: 2, total: true });
    if (d === 3) return rng.pick([() => compoundQ(rng, { t: rng.int(3, 4), total: rng.chance(0.6) }), () => diffQ(rng)])();
    return rng.chance(0.5) ? interestTfQ(rng) : optionsQ(rng, false);
  },
  selfCheck: (q) => {
    const pr = prm(q);
    const P = num(pr, 'P');
    const r = num(pr, 'r') / 100;
    const t = num(pr, 't');
    const comp = (rr: number, tt: number) => P * (1 + rr) ** tt;
    const simp = (rr: number, tt: number) => P * (1 + rr * tt);
    switch (pr.kind) {
      case 'simple':
        return near(q, pr.total ? simp(r, t) : P * r * t, 0.005);
      case 'compound':
        return near(q, pr.total ? comp(r, t) : comp(r, t) - P, 0.03);
      case 'diff':
        return near(q, comp(r, t) - simp(r, t), 0.03);
      case 'tf': {
        const Ic = (tt: number) => comp(r, tt) - P;
        const Is = (tt: number) => P * r * tt;
        const eq = (a: number, b: number) => Math.abs(a - b) < 1e-6;
        const truth = [eq(Ic(1), Is(1)), eq(Is(2 * t), 2 * Is(t)), eq(Ic(2 * t), 2 * Ic(t)), Ic(t) > Is(t) + 1e-6, Is(t) > Ic(t) + 1e-6][num(pr, 'stmt')]!;
        return tfIs(q, truth);
      }
      case 'options': {
        const opts = pr.opts as IntOption[];
        const vals = opts.map((o) => (o.compound ? comp(o.r / 100, o.t) : simp(o.r / 100, o.t)));
        const target = pr.loan ? Math.min(...vals) : Math.max(...vals);
        const hits = opts.filter((_, i) => Math.abs(vals[i]! - target) < 1e-9);
        return hits.length === 1 && hits[0]!.text === rightText(q) ? null : 'best option is wrong';
      }
      case 'down': {
        const C = num(pr, 'C');
        const D = (C * num(pr, 'downPct')) / 100;
        return near(q, D + (C - D) * (1 + (num(pr, 'r') / 100) * t), 0.005);
      }
      case 'downChoice': {
        const C = num(pr, 'C');
        const cost = ([dp, rr, tt]: number[]) => {
          const D = (C * dp!) / 100;
          return D + (C - D) * (1 + (rr! / 100) * tt!);
        };
        const ca = cost(pr.a as number[]);
        const cb = cost(pr.b as number[]);
        const want = Math.abs(ca - cb) < 1e-9 ? 'Both plans cost the same' : ca < cb ? 'Plan A' : 'Plan B';
        return rightText(q) === want ? null : 'cheaper plan is wrong';
      }
      default:
        return 'unknown question kind';
    }
  },
  summary: ['Simple interest: I = P × r × t, the same amount every year.', 'Compound interest (annually): A = P(1 + r)^t; interest earns interest, so it grows faster over time.', 'Total cost of buying on credit = down payment + amount borrowed + interest.'],
  misconceptions: [INT.rateWhole, INT.interestVsTotal, INT.oneYear, INT.simpleForCompound, INT.compoundLinear, INT.forgotDown, INT.wholePrice, INT.rateOnly],
};

// ═════════════════════════ Probability (Grades 6–8) ═════════════════════════

type Space = { kind: 'product'; dims: string[][] } | { kind: 'draw'; bag: string[]; n: number; replace: boolean };
type Ev = { type: 'each'; wants: string[][] } | { type: 'sum'; op: 'eq' | 'ge'; target: number } | { type: 'count'; value: string; op: 'eq' | 'ge'; k: number } | { type: 'same' };

/** Every equally likely outcome, listed one by one. */
function outcomes(space: Space): string[][] {
  if (space.kind === 'product') return space.dims.reduce<string[][]>((acc, dim) => acc.flatMap((t) => dim.map((x) => [...t, x])), [[]]);
  const out: string[][] = [];
  const rec = (used: number[]) => {
    if (used.length === space.n) {
      out.push(used.map((i) => space.bag[i]!));
      return;
    }
    for (let i = 0; i < space.bag.length; i++) if (space.replace || !used.includes(i)) rec([...used, i]);
  };
  rec([]);
  return out;
}
function holds(ev: Ev, t: string[]): boolean {
  switch (ev.type) {
    case 'each':
      return t.every((x, i) => ev.wants[i]!.includes(x));
    case 'sum': {
      const s = t.reduce((a, x) => a + Number(x), 0);
      return ev.op === 'eq' ? s === ev.target : s >= ev.target;
    }
    case 'count': {
      const k = t.filter((x) => x === ev.value).length;
      return ev.op === 'eq' ? k === ev.k : k >= ev.k;
    }
    case 'same':
      return t.every((x) => x === t[0]);
  }
}
function enumerateP(space: Space, ev: Ev): number {
  const all = outcomes(space);
  return all.filter((t) => holds(ev, t)).length / all.length;
}

const PROB = {
  partPart: { id: 'ratio_prob_part_part', label: 'Compared favourable with unfavourable outcomes', explanation: 'Probability compares the outcomes you want with **all** the outcomes. 2 red and 3 blue gives a probability of $$\\frac{2}{5}$$ for red, not $$\\frac{2}{3}$$.', fix: 'Count every possible outcome for the denominator, including the ones you want.' },
  add: { id: 'ratio_prob_add_instead', label: 'Added the probabilities instead of multiplying', explanation: 'For “this **and** that” with independent events, the chance of both happening is smaller than either one alone, so you multiply.', fix: 'Use P(A and B) = P(A) × P(B). Check: your answer should be smaller than each probability.' },
  notEqual: { id: 'ratio_prob_not_equally_likely', label: 'Treated outcomes as equally likely when they are not', explanation: 'With two dice there are 11 possible sums, but they are not equally likely: a sum of 7 can happen 6 ways, a sum of 2 only 1 way.', fix: 'List the outcomes that are equally likely (like the 36 pairs for two dice) and count the ones that work.' },
  missed: { id: 'ratio_prob_missed_case', label: 'Missed some of the ways the event can happen', explanation: '“One head and one tail” can happen as HT or TH. “Both the same colour” can be both red or both blue.', fix: 'List every outcome (a tree diagram or table helps) and mark each one that fits.' },
  replaced: { id: 'ratio_prob_replaced', label: 'Forgot the first item is not put back', explanation: 'Without replacement, the first draw changes the bag: there is one fewer item, and maybe one fewer of that colour.', fix: 'For the second draw, subtract 1 from the total, and from the colour that was drawn first.' },
  notReplaced: { id: 'ratio_prob_not_replaced', label: 'Changed the bag even though the item was put back', explanation: 'With replacement, the bag is the same for every draw, so each draw has the same probability.', fix: 'If the item goes back in, use the same fraction for each draw.' },
  complement: { id: 'ratio_prob_complement', label: 'Found the probability of the opposite event', explanation: 'P(at least one) and P(none) are opposites: they add up to 1.', fix: 'Find P(none), then subtract it from 1.' },
  expTheory: { id: 'ratio_prob_exp_vs_theory', label: 'Mixed up experimental and theoretical probability', explanation: 'Theoretical probability comes from counting outcomes. Experimental probability comes from what actually happened in the trials.', fix: 'Experimental probability = times it happened ÷ number of trials. Theoretical = favourable outcomes ÷ all outcomes.' },
  words: { id: 'ratio_prob_extreme_words', label: 'Used “impossible” or “certain” for something that only might happen', explanation: 'Impossible means a probability of exactly 0, and certain means exactly 1. An event that can happen but probably won’t is unlikely.', fix: 'Place the probability on a line from 0 to 1. Only the very ends are impossible and certain.' },
  more: { id: 'ratio_prob_more_is_better', label: 'Chose the bag with more winning items, not the bigger chance', explanation: 'A bag with more red marbles can still give a smaller chance if it has many more marbles in total.', fix: 'Write each chance as a fraction (or percent) of the whole bag and compare those.' },
  forgot100: { id: 'percent_forgot_100', label: 'Forgot to multiply by 100', explanation: 'A decimal like 0.4 is 40 hundredths, so it is 40%, not 0.4%.', fix: 'Decimal to percent: multiply by 100.' },
  notSimplified: { id: 'not_simplified', label: 'Stopped simplifying too early', explanation: 'The answer is right but can still be simplified.', fix: 'Divide the numerator and denominator by their greatest common factor.' },
} satisfies Record<string, Misconception>;

const D6 = ['1', '2', '3', '4', '5', '6'];
const COIN = ['H', 'T'];
const DIE_EVENTS: { text: string; set: string[] }[] = [
  { text: 'an even number', set: ['2', '4', '6'] },
  { text: 'an odd number', set: ['1', '3', '5'] },
  { text: 'a number greater than 4', set: ['5', '6'] },
  { text: 'a number less than 3', set: ['1', '2'] },
  { text: 'a 6', set: ['6'] },
  { text: 'a 1', set: ['1'] },
  { text: 'a multiple of 3', set: ['3', '6'] },
  { text: 'a number less than 5', set: ['1', '2', '3', '4'] },
];

interface Comp {
  setup: string;
  outcome: string;
  dim: string[];
  want: string[];
  p: Rational;
  short: string;
}

function dieComp(rng: Rng): Comp {
  const ev = rng.pick(DIE_EVENTS);
  return { setup: 'roll a fair six-sided die', outcome: `rolling ${ev.text}`, dim: D6, want: ev.set, p: R(ev.set.length, 6), short: `P(${ev.text})` };
}
function coinComp(rng: Rng): Comp {
  const h = rng.chance(0.5);
  return { setup: 'flip a fair coin', outcome: `getting ${h ? 'heads' : 'tails'}`, dim: COIN, want: [h ? 'H' : 'T'], p: R(1, 2), short: `P(${h ? 'heads' : 'tails'})` };
}
function spinnerComp(rng: Rng): Comp {
  const n = rng.pick([3, 4, 5, 8]);
  const cols = rng.shuffle(['red', 'blue', 'green', 'yellow']).slice(0, n === 3 ? 3 : rng.pick([2, 3]));
  const counts = splitCounts(rng, n, cols.length);
  const dim = cols.flatMap((c, i) => Array<string>(counts[i]!).fill(c));
  const c0 = cols[0]!;
  return { setup: `spin a spinner with ${n} equal sections (${cols.map((c, i) => `${counts[i]} ${c}`).join(', ')})`, outcome: `landing on ${c0}`, dim, want: [c0], p: R(counts[0]!, n), short: `P(${c0})` };
}
/** Splits n into k positive whole numbers. */
function splitCounts(rng: Rng, n: number, k: number): number[] {
  const out = Array<number>(k).fill(1);
  for (let i = k; i < n; i++) out[rng.int(0, k - 1)]! += 1;
  return out;
}
const listText = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

function indepQ(rng: Rng, n: 2 | 3): Draft {
  const makers = [dieComp, coinComp, spinnerComp];
  const comps = Array.from({ length: n }, (_, i) => (n === 3 ? makers[i]! : rng.pick(makers))(rng));
  const key = comps.reduce((a, c) => a.mul(c.p), R(1));
  const sum = comps.reduce((a, c) => a.add(c.p), R(0));
  const totalOutcomes = comps.reduce((a, c) => a * c.dim.length, 1);
  const favourable = comps.reduce((a, c) => a * c.dim.filter((x) => c.want.includes(x)).length, 1);
  const space: Space = { kind: 'product', dims: comps.map((c) => c.dim) };
  const ev: Ev = { type: 'each', wants: comps.map((c) => c.want) };
  const sameKind = comps.length === 2 && comps[0]!.setup === comps[1]!.setup;
  const setupText = sameKind ? `${comps[0]!.setup} twice` : listText(comps.map((c) => c.setup));
  const outcomeText = sameKind ? `${comps[0]!.outcome} on the first ${comps[0]!.setup.includes('die') ? 'roll' : comps[0]!.setup.includes('coin') ? 'flip' : 'spin'} and ${comps[1]!.outcome} on the second` : listText(comps.map((c) => c.outcome));
  return fracAns([p(`You ${setupText}. What is the probability of ${outcomeText}? Give your answer as a fraction in simplest form.`)], key, {
    hints: ['The events are independent: one result does not change the other. Find the probability of each event first.', `Multiply: ${comps.map((c) => tex(frac(c.p))).join(' × ')}.`],
    solution: [
      steps(
        ...comps.map((c) => ({ text: `Probability of ${c.outcome}:`, math: `${frac(c.p)}` })),
        { text: 'The events are independent, so multiply.', math: `${comps.map((c) => frac(c.p)).join(' \\times ')} = ${frac(key)}` },
      ),
      p(`Check by counting: there are ${totalOutcomes} equally likely outcomes altogether, and ${favourable} of them fit, so the probability is $$\\frac{${favourable}}{${totalOutcomes}} = ${frac(key)}$$.`),
    ],
    wrong: [[sum.cmp(1) < 0 ? sum : null, PROB.add.id]],
    params: { kind: 'theory', space, ev },
  });
}

function coinsCountQ(rng: Rng, n: 2 | 3): Draft {
  const total = 2 ** n;
  const opts = n === 2 ? [{ k: 1, op: 'eq' as const }, { k: 2, op: 'eq' as const }] : [{ k: 2, op: 'eq' as const }, { k: 1, op: 'ge' as const }, { k: 3, op: 'eq' as const }];
  const { k, op } = rng.pick(opts);
  const choose = (a: number, b: number) => (b === 0 || b === a ? 1 : a === 3 ? 3 : 2);
  const fav = op === 'eq' ? choose(n, k) : total - 1;
  const key = R(fav, total);
  const desc = op === 'ge' ? 'at least one head' : k === n ? `${n === 2 ? 'two' : 'three'} heads` : n === 2 ? 'one head and one tail' : 'exactly two heads';
  const all = outcomes({ kind: 'product', dims: Array.from({ length: n }, () => COIN) }).map((t) => t.join(''));
  const space: Space = { kind: 'product', dims: Array.from({ length: n }, () => COIN) };
  const ev: Ev = { type: 'count', value: 'H', op, k };
  const fits = all.filter((s) => holds(ev, s.split('')));
  return fracAns([p(`You flip ${n === 2 ? 'two' : 'three'} fair coins. What is the probability of getting ${desc}? Give your answer as a fraction in simplest form.`)], key, {
    hints: [`List every outcome (H for heads, T for tails). There are ${total} equally likely ones.`, `The outcomes are ${all.join(', ')}. Which ones show ${desc}?`],
    solution: [
      steps({ text: `List all ${total} equally likely outcomes.`, math: `\\text{${all.join(', ')}}` }, { text: `Mark the ones with ${desc}.`, math: `\\text{${fits.join(', ')}}` }, { text: 'Write favourable over total.', math: `\\frac{${fav}}{${total}}${R(fav, total).d !== BigInt(total) ? ` = ${frac(key)}` : ''}` }),
      ...(op === 'ge' ? [p(`Shortcut: the only outcome with no heads is ${'T'.repeat(n)}, so P(at least one head) = $$1 - \\frac{1}{${total}} = ${frac(key)}$$.`)] : []),
    ],
    wrong: [
      [op === 'ge' ? R(1, total) : null, PROB.complement.id],
      [op === 'eq' && fav > 1 ? R(1, total) : null, PROB.missed.id],
      [op === 'ge' ? R(n, total) : null, PROB.missed.id],
      [op === 'eq' ? R(1, n + 1) : null, PROB.notEqual.id],
    ],
    params: { kind: 'theory', space, ev },
  });
}

function diceSumQ(rng: Rng): Draft {
  const ge = rng.chance(0.3);
  const target = ge ? rng.int(9, 11) : rng.int(3, 11);
  const ways = (s: number) => 6 - Math.abs(s - 7);
  let fav = 0;
  for (let s = target; s <= (ge ? 12 : target); s++) fav += ways(s);
  const key = R(fav, 36);
  const pairs = outcomes({ kind: 'product', dims: [D6, D6] })
    .filter((t) => (ge ? Number(t[0]) + Number(t[1]) >= target : Number(t[0]) + Number(t[1]) === target))
    .map((t) => `(${t[0]}, ${t[1]})`);
  const desc = ge ? `a sum of ${target} or more` : `a sum of ${target}`;
  return fracAns([p(`You roll two fair six-sided dice and add the numbers. What is the probability of ${desc}? Give your answer as a fraction in simplest form.`)], key, {
    hints: ['There are 6 × 6 = 36 equally likely pairs (first die, second die). The sums are not all equally likely.', `Count the pairs that give ${desc}, for example ${pairs[0]}.`],
    solution: [steps({ text: 'Two dice give 36 equally likely ordered pairs.' }, { text: `Pairs that give ${desc}:`, math: `\\text{${pairs.join(', ')}}` }, { text: 'Favourable over total.', math: `\\frac{${fav}}{36}${key.d !== 36n ? ` = ${frac(key)}` : ''}` })],
    wrong: [[ge ? null : R(1, 11), PROB.notEqual.id]],
    params: { kind: 'theory', space: { kind: 'product', dims: [D6, D6] } satisfies Space, ev: { type: 'sum', op: ge ? 'ge' : 'eq', target } satisfies Ev },
  });
}

interface Bag {
  noun: string;
  plural: string;
  counts: [string, number][];
}
function makeBag(rng: Rng, kinds: 2 | 3, max = 12): Bag {
  const [noun, plural, cols] = rng.pick([
    ['marble', 'marbles', ['red', 'blue', 'green']],
    ['counter', 'counters', ['yellow', 'red', 'blue']],
    ['sock', 'socks', ['black', 'white', 'grey']],
    ['tile', 'tiles', ['green', 'purple', 'orange']],
  ] as const);
  const total = rng.int(kinds + 3, max);
  const counts = splitCounts(rng, total, kinds).map((c, i): [string, number] => [cols[i]!, c]);
  return { noun, plural, counts };
}
const bagItems = (b: Bag) => b.counts.flatMap(([c, k]) => Array<string>(k).fill(c));
const bagTotal = (b: Bag) => b.counts.reduce((a, [, k]) => a + k, 0);
const bagText = (b: Bag) => `a bag with ${listText(b.counts.map(([c, k]) => `${k} ${c}`))} ${b.plural}`;
const countOf = (b: Bag, col: string) => b.counts.find(([c]) => c === col)?.[1] ?? 0;

/** P(drawing the colours in `seq`, in order), exactly, by multiplying the probability of each draw. */
function seqProb(b: Bag, seq: string[], replace: boolean): { p: Rational; factors: Rational[] } {
  const left = new Map(b.counts);
  let T = bagTotal(b);
  const factors: Rational[] = [];
  for (const c of seq) {
    const k = left.get(c) ?? 0;
    factors.push(R(k, T));
    if (!replace) {
      left.set(c, k - 1);
      T -= 1;
    }
  }
  return { p: factors.reduce((a, f) => a.mul(f), R(1)), factors };
}
const facTex = (fs: Rational[]) => fs.map((f) => `\\frac{${f.n}}{${f.d}}`).join(' \\times ');

function drawSeqQ(rng: Rng, n: 2 | 3, replace: boolean): Draft {
  const b = makeBag(rng, n === 3 && !replace ? 2 : rng.pick([2, 3]), n === 3 ? 10 : 12);
  const usable = b.counts.filter(([, k]) => k >= (replace ? 1 : n)).map(([c]) => c);
  const fixedSeq = Array.from({ length: n }, () => rng.pick(usable));
  const { p: key, factors } = seqProb(b, fixedSeq, replace);
  const other = seqProb(b, fixedSeq, !replace);
  const desc = fixedSeq.every((c) => c === fixedSeq[0]) ? `${n === 2 ? 'both' : 'all three'} ${fixedSeq[0]}` : fixedSeq.map((c, i) => `${['first', 'second', 'third'][i]} ${c}`).join(', then ');
  const how = replace ? `one at a time, putting each ${b.noun} back before the next draw` : `one at a time, without putting any back`;
  return fracAns([p(`You have ${bagText(b)}. Without looking, you take ${n === 2 ? 'two' : 'three'} ${b.plural} ${how}. What is the probability of ${desc}? Give your answer as a fraction in simplest form.`)], key, {
    hints: [replace ? 'The draws are independent: the bag is the same every time.' : 'The draws are dependent: after each draw there is one fewer item in the bag.', replace ? `Each draw has the same probabilities. Multiply: $$${facTex(factors)}$$.` : `Change the numbers after each draw. Multiply: $$${facTex(factors)}$$.`],
    solution: [
      steps(
        ...fixedSeq.map((c, i) => ({ text: `Draw ${i + 1} (${c}): ${replace || i === 0 ? `${countOf(b, c)} of the ${bagTotal(b)} ${b.plural} are ${c}` : 'count what is left in the bag'}.`, math: `\\frac{${factors[i]!.n}}{${factors[i]!.d}}` })),
        { text: 'Multiply the probabilities.', math: `${facTex(factors)} = ${frac(key)}` },
      ),
    ],
    wrong: [
      [other.p, replace ? PROB.notReplaced.id : PROB.replaced.id],
      [factors.reduce((a, f) => a.add(f), R(0)).cmp(1) < 0 ? factors.reduce((a, f) => a.add(f), R(0)) : null, PROB.add.id],
    ],
    params: { kind: 'theory', space: { kind: 'draw', bag: bagItems(b), n, replace } satisfies Space, ev: { type: 'each', wants: fixedSeq.map((c) => [c]) } satisfies Ev },
  });
}

function drawSameQ(rng: Rng): Draft {
  const b = makeBag(rng, 2, 12);
  const [[c1, k1], [c2, k2]] = b.counts as [[string, number], [string, number]];
  const T = k1 + k2;
  const same = rng.chance(0.5);
  const pSame = R(k1 * (k1 - 1) + k2 * (k2 - 1), T * (T - 1));
  const key = same ? pSame : R(1).sub(pSame);
  const a = R(k1 * (k1 - 1), T * (T - 1));
  const bb = R(k2 * (k2 - 1), T * (T - 1));
  const one = R(k1 * k2, T * (T - 1));
  const desc = same ? 'two of the same colour' : `one ${c1} and one ${c2}`;
  return fracAns([p(`A drawer has ${k1} ${c1} and ${k2} ${c2} ${b.plural}. Without looking, you pull out two ${b.plural}, one after the other, without putting the first one back. What is the probability of getting ${desc}? Give your answer as a fraction in simplest form.`)], key, {
    hints: [same ? `“Same colour” can happen two ways: both ${c1} or both ${c2}.` : `“One of each” can happen two ways: ${c1} then ${c2}, or ${c2} then ${c1}.`, 'Find the probability of each way (the second draw has one fewer item), then add them.'],
    solution: same
      ? [steps({ text: `Both ${c1}:`, math: `\\frac{${k1}}{${T}} \\times \\frac{${k1 - 1}}{${T - 1}} = ${frac(a)}` }, { text: `Both ${c2}:`, math: `\\frac{${k2}}{${T}} \\times \\frac{${k2 - 1}}{${T - 1}} = ${frac(bb)}` }, { text: 'Add the two ways.', math: `${frac(a)} + ${frac(bb)} = ${frac(key)}` })]
      : [steps({ text: `${c1} then ${c2}:`, math: `\\frac{${k1}}{${T}} \\times \\frac{${k2}}{${T - 1}} = ${frac(one)}` }, { text: `${c2} then ${c1}:`, math: `\\frac{${k2}}{${T}} \\times \\frac{${k1}}{${T - 1}} = ${frac(one)}` }, { text: 'Add the two ways.', math: `${frac(one)} + ${frac(one)} = ${frac(key)}` })],
    wrong: [
      [same ? (a.cmp(bb) >= 0 ? a : bb) : one, PROB.missed.id],
      [same ? R(k1 * k1 + k2 * k2, T * T) : R(2 * k1 * k2, T * T), PROB.replaced.id],
    ],
    params: { kind: 'theory', space: { kind: 'draw', bag: bagItems(b), n: 2, replace: false } satisfies Space, ev: same ? ({ type: 'same' } satisfies Ev) : ({ type: 'count', value: c1, op: 'eq', k: 1 } satisfies Ev) },
  });
}

function atLeastQ(rng: Rng): Draft {
  if (rng.chance(0.5)) {
    const n = rng.pick([2, 3]);
    const key = R(1).sub(R(5, 6).pow(n));
    return fracAns([p(`You roll ${n === 2 ? 'two' : 'three'} fair six-sided dice. What is the probability that at least one of them shows a 6? Give your answer as a fraction in simplest form.`)], key, {
      hints: ['“At least one 6” is the opposite of “no 6 at all”. Find P(no 6) first.', `P(no 6 on one die) = $$\\frac{5}{6}$$. For ${n} dice, multiply it ${n} times, then subtract from 1.`],
      solution: [steps({ text: 'Probability of no 6 on every die (independent, so multiply).', math: `\\left(\\frac{5}{6}\\right)^{${n}} = ${frac(R(5, 6).pow(n))}` }, { text: 'At least one 6 is everything else.', math: `1 - ${frac(R(5, 6).pow(n))} = ${frac(key)}` })],
      wrong: [
        [R(n, 6), PROB.add.id],
        [R(5, 6).pow(n), PROB.complement.id],
        [R(1, 6).pow(n), PROB.missed.id],
      ],
      params: { kind: 'theory', space: { kind: 'product', dims: Array.from({ length: n }, () => D6) } satisfies Space, ev: { type: 'count', value: '6', op: 'ge', k: 1 } satisfies Ev },
    });
  }
  const b = makeBag(rng, 2, 10);
  const [[c1, k1], [, k2]] = b.counts as [[string, number], [string, number]];
  const n = 2;
  const T = k1 + k2;
  const none = R(k2 * (k2 - 1), T * (T - 1));
  const key = R(1).sub(none);
  return fracAns([p(`You have ${bagText(b)}. Without looking, you take two ${b.plural}, one after the other, without putting the first one back. What is the probability that at least one of them is ${c1}? Give your answer as a fraction in simplest form.`)], key, {
    hints: [`“At least one ${c1}” is the opposite of “no ${c1} at all”.`, `P(no ${c1}) = $$\\frac{${k2}}{${T}} \\times \\frac{${k2 - 1}}{${T - 1}}$$. Subtract it from 1.`],
    solution: [steps({ text: `Probability that neither is ${c1}.`, math: `\\frac{${k2}}{${T}} \\times \\frac{${k2 - 1}}{${T - 1}} = ${frac(none)}` }, { text: `At least one ${c1} is everything else.`, math: `1 - ${frac(none)} = ${frac(key)}` })],
    wrong: [
      [none, PROB.complement.id],
      [R(1).sub(R(k2 * k2, T * T)), PROB.replaced.id],
    ],
    params: { kind: 'theory', space: { kind: 'draw', bag: bagItems(b), n, replace: false } satisfies Space, ev: { type: 'count', value: c1, op: 'ge', k: 1 } satisfies Ev },
  });
}

function singleQ(rng: Rng, allowEdge: boolean): Draft {
  const mode = rng.int(0, 2);
  if (mode === 0) {
    const b = makeBag(rng, rng.pick([2, 3]), 12);
    const [c, k] = rng.pick(b.counts);
    const T = bagTotal(b);
    const key = R(k, T);
    return fracAns([p(`You have ${bagText(b)}. You pick one ${b.noun} without looking. What is the probability that it is ${c}? Give your answer as a fraction in simplest form.`)], key, {
      hints: ['Probability = number of favourable outcomes ÷ number of possible outcomes.', `There are ${k} ${c} ${b.plural} out of ${T} ${b.plural} in all.`],
      solution: [m(`P(\\text{${c}}) = \\frac{${k}}{${T}}${key.d !== BigInt(T) ? ` = ${frac(key)}` : ''}`)],
      wrong: [[T - k > 0 ? R(k, T - k) : null, PROB.partPart.id]],
      params: { kind: 'theory', space: { kind: 'draw', bag: bagItems(b), n: 1, replace: true } satisfies Space, ev: { type: 'each', wants: [[c]] } satisfies Ev },
    });
  }
  const evs = allowEdge ? [...DIE_EVENTS, { text: 'a 7', set: [] as string[] }, { text: 'a number from 1 to 6', set: D6 }] : DIE_EVENTS;
  const ev = rng.pick(evs);
  const key = R(ev.set.length, 6);
  const others = 6 - ev.set.length;
  return fracAns([p(`You roll a fair six-sided die. What is the probability of rolling ${ev.text}? Give your answer as a fraction in simplest form (use 0 or 1 if it fits).`)], key, {
    hints: ['A fair die has 6 equally likely outcomes: 1, 2, 3, 4, 5, 6.', `Which of them are ${ev.text}? Count them.`],
    solution: [steps({ text: `Outcomes that are ${ev.text}:`, math: ev.set.length ? ev.set.join(', ') : '\\text{none}' }, { text: 'Favourable over total.', math: `\\frac{${ev.set.length}}{6}${key.d !== 6n ? ` = ${frac(key)}` : ''}` })],
    wrong: [[others > 0 && ev.set.length > 0 ? R(ev.set.length, others) : null, PROB.partPart.id]],
    params: { kind: 'theory', space: { kind: 'product', dims: [D6] } satisfies Space, ev: { type: 'each', wants: [ev.set] } satisfies Ev },
  });
}

function formsQ(rng: Rng): Draft {
  const T = rng.pick([4, 5, 8, 10, 20, 25]);
  const cols = rng.shuffle(['red', 'blue', 'green', 'yellow']).slice(0, 2) as [string, string];
  const k = rng.int(1, T - 1);
  const spinner = T <= 10 && rng.chance(0.5);
  const desc = spinner ? `A spinner has ${T} equal sections: ${k} are ${cols[0]} and ${T - k} are ${cols[1]}.` : `A bag has ${k} ${cols[0]} and ${T - k} ${cols[1]} marbles.`;
  const act = spinner ? `landing on ${cols[0]}` : `picking a ${cols[0]} marble without looking`;
  const v = R(k, T);
  const space: Space = { kind: 'product', dims: [[...Array<string>(k).fill(cols[0]), ...Array<string>(T - k).fill(cols[1])]] };
  const ev: Ev = { type: 'each', wants: [[cols[0]]] };
  if (rng.chance(0.5)) {
    return decAns([p(`${desc} What is the probability of ${act}? Write it as a decimal.`)], v, {
      hints: ['Write the probability as a fraction first: favourable over total.', `$$\\frac{${k}}{${T}}$$ means ${k} ÷ ${T}.`],
      solution: [m(`\\frac{${k}}{${T}} = ${k} \\div ${T} = ${nl(v)}`)],
      wrong: [[R(k, T - k), PROB.partPart.id]],
      params: { kind: 'theory', space, ev },
    });
  }
  return pctAns([p(`${desc} What is the probability of ${act}? Write it as a percent.`)], v.mul(100), {
    hints: ['Write the probability as a fraction, then change it to a decimal by dividing.', `$$\\frac{${k}}{${T}} = ${nl(v)}$$. Multiply by 100 for the percent.`],
    solution: [m(`\\frac{${k}}{${T}} = ${nl(v)} = ${pctTex(v.mul(100))}`)],
    wrong: [
      [v, PROB.forgot100.id],
      [R(k * 100, T - k), PROB.partPart.id],
    ],
    params: { kind: 'theoryPct', space, ev },
  });
}

const WORDS = ['impossible', 'unlikely', 'equally likely as not', 'likely', 'certain'] as const;
function wordFor(v: number): (typeof WORDS)[number] {
  if (v === 0) return 'impossible';
  if (v === 1) return 'certain';
  if (Math.abs(v - 0.5) < 1e-12) return 'equally likely as not';
  return v < 0.5 ? 'unlikely' : 'likely';
}

function wordQ(rng: Rng): Draft {
  const target = rng.pick(WORDS);
  const T = rng.pick([6, 8, 10, 12]);
  const k = target === 'impossible' ? 0 : target === 'certain' ? T : target === 'equally likely as not' ? T / 2 : target === 'unlikely' ? rng.int(1, T / 2 - 1) : rng.int(T / 2 + 1, T - 1);
  const [c1, c2] = rng.shuffle(['red', 'blue', 'green', 'yellow']) as [string, string];
  const desc = k === 0 ? `A bag has ${T} ${c2} marbles and nothing else.` : k === T ? `A bag has ${T} ${c1} marbles and nothing else.` : `A bag has ${k} ${c1} marbles and ${T - k} ${c2} marbles.`;
  const v = R(k, T);
  const ds = WORDS.filter((w) => w !== target).map((w) => ({ text: w, misconception: (target === 'unlikely' && w === 'impossible') || (target === 'likely' && w === 'certain') ? PROB.words.id : undefined }));
  const prioritized = [...ds.filter((d) => d.misconception), ...rng.shuffle(ds.filter((d) => !d.misconception))];
  return choice(rng, [p(`${desc} You pick one marble without looking. Which word best describes the chance of picking a ${c1} marble?`)], target, prioritized, {
    hints: ['Write the probability as a fraction, then place it on a line from 0 (impossible) to 1 (certain).', `The probability is $$\\frac{${k}}{${T}}$$. Is it 0, less than one half, exactly one half, more than one half, or 1?`],
    solution: [m(`P(\\text{${c1}}) = \\frac{${k}}{${T}}${k > 0 && k < T && v.d !== BigInt(T) ? ` = ${frac(v)}` : ''} ${v.toDecimal(2) === null ? '\\approx' : '='} ${nl(roundTo(v, 2))}`), { kind: 'diagram', diagram: { type: 'number_line', min: 0, max: 1, step: 0.25, points: [{ at: 0, label: 'impossible' }, { at: 0.5, label: 'equally likely' }, { at: 1, label: 'certain' }, { at: Number(roundTo(v, 2).toDecimal() ?? 0), label: c1 }] }, alt: `A probability line from 0 to 1 with ${c1} marked at ${nt(roundTo(v, 2))}.` }, p(`On the probability line this is **${target}**.`)],
    params: { kind: 'word', space: { kind: 'product', dims: [[...Array<string>(k).fill(c1), ...Array<string>(T - k).fill(c2)]] } satisfies Space, ev: { type: 'each', wants: [[c1]] } satisfies Ev },
  });
}

function predictQ(rng: Rng): Draft {
  const T = rng.pick([4, 5, 6, 8, 10]);
  const k = rng.int(1, T - 1);
  const trials = T * rng.int(5, 20);
  const c = rng.pick(['red', 'blue', 'green']);
  const key = R(k * trials, T);
  return decAns([p(`A spinner has ${T} equal sections, and ${k} of them are ${c}. If you spin it ${trials} times, how many times would you predict it lands on ${c}?`)], key, {
    hints: ['Find the probability of landing on ' + c + ' first.', `The probability is $$\\frac{${k}}{${T}}$$. Multiply it by the number of spins, ${trials}.`],
    solution: [steps({ text: `Probability of ${c}:`, math: `\\frac{${k}}{${T}}` }, { text: 'Multiply by the number of spins.', math: `\\frac{${k}}{${T}} \\times ${trials} = ${nl(key)}` }), p(`We predict about ${nt(key)} times. The real number will probably be close to this, but not always exactly equal.`)],
    wrong: [
      [R(k * trials, T - k).isInteger() ? R(k * trials, T - k) : null, PROB.partPart.id],
    ],
    params: { kind: 'predict', k, T, trials },
  });
}

function decisionQ(rng: Rng): Draft {
  const mk = () => {
    const r = rng.int(2, 8);
    const o = rng.int(2, 12);
    return { r, o, p: R(r, r + o) };
  };
  const A = mk();
  let B = mk();
  let guard = 0;
  while (A.r === B.r && guard++ < 5) B = mk();
  const cmp = A.p.cmp(B.p);
  const right = cmp > 0 ? 'Bag A' : cmp < 0 ? 'Bag B' : 'Either bag: the chances are equal';
  const moreRed = A.r > B.r ? 'Bag A' : B.r > A.r ? 'Bag B' : null;
  const ds = ['Bag A', 'Bag B', 'Either bag: the chances are equal'].filter((t) => t !== right).map((t) => ({ text: t, misconception: t === moreRed ? PROB.more.id : undefined }));
  return choice(rng, [p(`In a game, you win if you pick a red marble without looking. **Bag A** has ${A.r} red and ${A.o} blue marbles. **Bag B** has ${B.r} red and ${B.o} blue marbles. Which bag gives you the better chance of winning?`)], right, ds, {
    hints: ['Compare the probability of red for each bag, not just the number of red marbles.', `Bag A: $$\\frac{${A.r}}{${A.r + A.o}}$$. Bag B: $$\\frac{${B.r}}{${B.r + B.o}}$$. Change them to decimals or a common denominator to compare.`],
    solution: [steps({ text: 'Bag A:', math: `\\frac{${A.r}}{${A.r + A.o}} \\approx ${nl(roundTo(A.p, 3))}` }, { text: 'Bag B:', math: `\\frac{${B.r}}{${B.r + B.o}} \\approx ${nl(roundTo(B.p, 3))}` }), p(cmp === 0 ? 'The probabilities are equal, so either bag is fine.' : `${right} has the larger probability of red, so it is the better choice.`)],
    params: { kind: 'decide', A: [A.r, A.o], B: [B.r, B.o] },
  });
}

interface Experiment {
  setup: string;
  event: string;
  space: Space;
  ev: Ev;
}
function experiment(rng: Rng, grade: number): Experiment {
  const opts: (() => Experiment)[] = [
    () => ({ setup: 'rolled two dice and added the numbers', event: 'a sum of 7', space: { kind: 'product', dims: [D6, D6] }, ev: { type: 'sum', op: 'eq', target: 7 } }),
    () => ({ setup: 'flipped two coins', event: 'two heads', space: { kind: 'product', dims: [COIN, COIN] }, ev: { type: 'count', value: 'H', op: 'eq', k: 2 } }),
    () => ({ setup: 'rolled a die and flipped a coin', event: 'an even number and heads', space: { kind: 'product', dims: [D6, COIN] }, ev: { type: 'each', wants: [['2', '4', '6'], ['H']] } }),
  ];
  if (grade >= 7) {
    opts.push(() => ({
      setup: 'took two marbles, without putting the first back, from a bag with 3 red and 2 blue marbles',
      event: 'two red marbles',
      space: { kind: 'draw', bag: ['red', 'red', 'red', 'blue', 'blue'], n: 2, replace: false },
      ev: { type: 'each', wants: [['red'], ['red']] },
    }));
  }
  if (grade >= 8) opts.push(() => ({ setup: 'flipped three coins', event: 'exactly two heads', space: { kind: 'product', dims: [COIN, COIN, COIN] }, ev: { type: 'count', value: 'H', op: 'eq', k: 2 } }));
  return rng.pick(opts)();
}
/** Theoretical probability, worked out exactly with fractions (not by listing) for the experiment's event. */
function theoryOf(e: Experiment): Rational {
  const all = outcomes(e.space);
  return R(all.filter((t) => holds(e.ev, t)).length, all.length);
}

function experimentalQ(rng: Rng, grade: number): Draft {
  const e = experiment(rng, grade);
  const who = rng.pick(NAMES);
  const trials = rng.pick([20, 25, 40, 50, 100]);
  const th = theoryOf(e);
  const expected = th.mul(trials).toNumber();
  const hits = Math.max(1, Math.min(trials - 1, Math.round(expected) + rng.int(-4, 4)));
  const v = R(hits, trials);
  const form = rng.pick(['decimal', 'percent', 'fraction'] as const);
  const prompt = [p(`${who} ${e.setup}, ${trials} times. The result was ${e.event} on ${hits} of the trials. What is the experimental probability of ${e.event}? Write it as ${form === 'decimal' ? 'a decimal' : form === 'percent' ? 'a percent' : 'a fraction in simplest form'}.`)];
  const base: AnsOpts = {
    hints: ['Experimental probability = number of times it happened ÷ number of trials.', `It happened ${hits} times in ${trials} trials: $$\\frac{${hits}}{${trials}}$$.`],
    solution: [m(`\\frac{${hits}}{${trials}}${form === 'fraction' && v.d !== BigInt(trials) ? ` = ${frac(v)}` : ''}${form !== 'fraction' ? ` = ${nl(v)}` : ''}${form === 'percent' ? ` = ${pctTex(v.mul(100))}` : ''}`), p(`The theoretical probability is $$${frac(th)}$$. The experimental result is ${v.cmp(th) === 0 ? 'exactly the same' : v.cmp(th) > 0 ? 'a little higher' : 'a little lower'}; with more trials, it usually gets closer to the theoretical value.`)],
    params: { kind: 'exp', hits, trials, form },
  };
  const pp = R(hits, trials - hits);
  if (form === 'percent') return pctAns(prompt, v.mul(100), { ...base, wrong: [[v, PROB.forgot100.id], [th.toDecimal(6) !== null ? th.mul(100) : null, PROB.expTheory.id], [pp.toDecimal(6) !== null ? pp.mul(100) : null, PROB.partPart.id]] });
  if (form === 'decimal') return decAns(prompt, v, { ...base, wrong: [[th.toDecimal(6) !== null ? th : null, PROB.expTheory.id], [pp.toDecimal(6) !== null ? pp : null, PROB.partPart.id]] });
  return fracAns(prompt, v, { ...base, wrong: [[th, PROB.expTheory.id], [pp, PROB.partPart.id]] });
}

function compareExpQ(rng: Rng, grade: number): Draft {
  const e = experiment(rng, grade);
  const who = rng.pick(NAMES);
  const trials = rng.pick([20, 30, 40, 50, 60]);
  const th = theoryOf(e);
  let hits = Math.max(1, Math.min(trials - 1, Math.round(th.mul(trials).toNumber()) + rng.pick([-5, -4, -3, 3, 4, 5])));
  if (R(hits, trials).eq(th)) hits += 1;
  const v = R(hits, trials);
  const claimHigher = rng.chance(0.5);
  const truth = claimHigher ? v.cmp(th) > 0 : v.cmp(th) < 0;
  return trueFalse([p(`${who} ${e.setup}, ${trials} times, and got ${e.event} ${hits} times.`), p(`True or false: ${who}’s experimental probability of ${e.event} is ${claimHigher ? 'greater' : 'less'} than the theoretical probability.`)], truth, {
    hints: [`Experimental: $$\\frac{${hits}}{${trials}}$$. Theoretical: list all the equally likely outcomes and count the ones that give ${e.event}.`, `The theoretical probability is $$${frac(th)}$$. Change both to decimals to compare.`],
    solution: [steps({ text: 'Experimental probability:', math: `\\frac{${hits}}{${trials}} = ${longShow(v)}` }, { text: 'Theoretical probability:', math: `${frac(th)} = ${longShow(th)}` }), p(`The experimental probability is ${v.cmp(th) > 0 ? 'greater' : 'less'} than the theoretical one, so the statement is **${truth ? 'true' : 'false'}**.`)],
    misconception: PROB.expTheory.id,
    params: { kind: 'expcmp', hits, trials, space: e.space, ev: e.ev, higher: claimHigher },
  });
}

export const probability: SkillPack = {
  id: 'probability',
  title: 'Probability',
  subject: 'math',
  expectations: [
    { id: `${G6}:D2.1`, note: 'Expresses the probability of an event as a fraction, decimal and percent, places it on the probability line (impossible to certain), predicts results over many trials, and chooses the better option in a game. Drawing a probability line is shown, not assessed.', levels: [1, 2, 3] },
    { id: `${G6}:D2.2`, note: 'Finds theoretical probabilities of two independent events (die, coin, spinner, two dice sums, draws with replacement) by multiplying and by listing outcomes, finds experimental probability from given trial counts, and compares the two. Running the experiment is described, not assessed.', levels: [1, 2, 3, 4] },
    { id: `${G7}:D2.2`, note: 'Finds theoretical probabilities of two independent events and two dependent events (drawing without replacement, including “same colour” and “one of each”), finds experimental probability from given counts, and compares experimental with theoretical results.', levels: [2, 3, 4] },
    { id: `${G8}:D2.2`, note: 'Finds theoretical probabilities of multiple (three) independent events and multiple dependent events (up to three draws without replacement), uses “at least one” with the complement, and compares experimental with theoretical probability from given counts.', levels: [2, 3, 4] },
  ],
  prerequisites: [],
  goal: 'I can find the probability of events, including two or more events together, and compare it with experiment results.',
  explain: (c) => [
    p('**Probability** measures how likely something is, from 0 (impossible) to 1 (certain). When all outcomes are equally likely:'),
    m('P(\\text{event}) = \\frac{\\text{number of favourable outcomes}}{\\text{number of possible outcomes}}'),
    p('You can write a probability as a fraction, a decimal or a percent: $$\\frac{1}{4} = 0.25 = 25\\%$$.'),
    { kind: 'diagram', diagram: { type: 'number_line', min: 0, max: 1, step: 0.25, points: [{ at: 0, label: 'impossible' }, { at: 0.25, label: 'unlikely' }, { at: 0.5, label: 'equally likely' }, { at: 0.75, label: 'likely' }, { at: 1, label: 'certain' }] }, alt: 'A probability line from 0 (impossible) through 0.5 (equally likely) to 1 (certain).' },
    ...(c.expectationId.endsWith('D2.2')
      ? [
          p('For two **independent** events (one does not affect the other, like a die and a coin), multiply: $$P(A \\text{ and } B) = P(A) \\times P(B)$$. Rolling a 6 and flipping heads: $$\\frac{1}{6} \\times \\frac{1}{2} = \\frac{1}{12}$$. You can check by listing all 12 outcomes in a table or tree diagram.'),
          p('**Experimental probability** comes from trials: $$\\frac{\\text{times it happened}}{\\text{number of trials}}$$. With more trials, it usually gets closer to the theoretical probability.'),
        ]
      : [p('To **predict**, multiply the probability by the number of trials: a probability of $$\\frac{1}{4}$$ over 40 spins predicts about 10 results.')]),
    ...(c.grade >= 7
      ? [p('Events are **dependent** when the first changes the second. Drawing without putting the item back is dependent: with 3 red and 2 blue marbles, $$P(\\text{red, then red}) = \\frac{3}{5} \\times \\frac{2}{4} = \\frac{3}{10}$$.')]
      : []),
    ...(c.grade >= 8 ? [p('For three or more events, keep multiplying along the path of the tree diagram. For “at least one”, it is often easier to find P(none) and subtract it from 1.')] : []),
    c.simple ? tip('Count what you want. Count everything. Divide.') : warn('Make sure the outcomes you count are equally likely. The 11 sums of two dice are not equally likely, but the 36 pairs are.'),
  ],
  alternatives: (c) => ({
    simpler: [p('Probability = how many ways you win ÷ how many ways it could go. For two independent things, multiply their probabilities.')],
    analogy: [p('A weather forecast of 30% rain means that on days like this, it rains about 3 days out of 10. Probability tells you what to expect over many tries, not exactly what happens next.')],
    visual: [
      {
        kind: 'table',
        header: ['+', '1', '2', '3', '4', '5', '6'],
        rows: D6.map((a) => [a, ...D6.map((b) => `${Number(a) + Number(b)}`)]),
      },
      p('All 36 pairs for two dice are equally likely. A sum of 7 appears 6 times, so $$P(7) = \\frac{6}{36} = \\frac{1}{6}$$. A sum of 2 appears only once.'),
    ],
    steps: [
      p(c.grade >= 7 ? 'A bag has 4 red and 6 blue marbles. Two are drawn without replacement. Find P(both red).' : 'Roll a die and flip a coin. Find P(even number and heads).'),
      c.grade >= 7
        ? steps({ text: 'First draw: 4 red out of 10.', math: '\\frac{4}{10}' }, { text: 'Second draw: 3 red left out of 9.', math: '\\frac{3}{9}' }, { text: 'Multiply.', math: '\\frac{4}{10} \\times \\frac{3}{9} = \\frac{12}{90} = \\frac{2}{15}' })
        : steps({ text: 'P(even) = 3 out of 6.', math: '\\frac{3}{6} = \\frac{1}{2}' }, { text: 'P(heads):', math: '\\frac{1}{2}' }, { text: 'Independent, so multiply.', math: '\\frac{1}{2} \\times \\frac{1}{2} = \\frac{1}{4}' }),
    ],
    compare: [p('You already know fractions of a group: if 3 of 12 students walk to school, $$\\frac{3}{12} = \\frac{1}{4}$$ of the class walks. A probability is the same kind of fraction: the part of all outcomes that you want.')],
  }),
  example: (rng, c) => {
    if (c.expectationId.endsWith('D2.1')) {
      const T = rng.pick([4, 5, 10]);
      const k = rng.int(1, T - 1);
      const v = R(k, T);
      return [p(`A spinner has ${T} equal sections and ${k} are blue. Find the probability of blue as a fraction, a decimal and a percent.`), steps({ text: 'Fraction: favourable over total.', math: `\\frac{${k}}{${T}}${v.d !== BigInt(T) ? ` = ${frac(v)}` : ''}` }, { text: 'Decimal: divide.', math: `${k} \\div ${T} = ${nl(v)}` }, { text: 'Percent: multiply by 100.', math: `${nl(v)} \\times 100 = ${pctTex(v.mul(100))}` })];
    }
    const ev = rng.pick(DIE_EVENTS);
    const pd = R(ev.set.length, 6);
    return [p(`Roll a fair die and flip a fair coin. Find the probability of rolling ${ev.text} and getting heads.`), steps({ text: `P(${ev.text}):`, math: `\\frac{${ev.set.length}}{6}${pd.d !== 6n ? ` = ${frac(pd)}` : ''}` }, { text: 'P(heads):', math: '\\frac{1}{2}' }, { text: 'Independent events, so multiply.', math: `${frac(pd)} \\times \\frac{1}{2} = ${frac(pd.div(2))}` })];
  },
  generate: (rng, d, c) => {
    const e = c.expectationId;
    const g = c.grade;
    if (e.endsWith('D2.1')) {
      if (d === 1) return singleQ(rng, true);
      if (d === 2) return rng.chance(0.65) ? formsQ(rng) : wordQ(rng);
      return rng.chance(0.55) ? predictQ(rng) : decisionQ(rng);
    }
    if (g === 6) {
      if (d === 1) return singleQ(rng, false);
      if (d === 2) return rng.chance(0.7) ? indepQ(rng, 2) : coinsCountQ(rng, 2);
      if (d === 3) return rng.pick([() => diceSumQ(rng), () => experimentalQ(rng, 6), () => drawSeqQ(rng, 2, true)])();
      return rng.chance(0.6) ? compareExpQ(rng, 6) : rng.chance(0.5) ? diceSumQ(rng) : drawSeqQ(rng, 2, true);
    }
    if (g === 7) {
      if (d === 2) return rng.pick([() => indepQ(rng, 2), () => drawSeqQ(rng, 2, true), () => coinsCountQ(rng, 2)])();
      if (d === 3) return rng.pick([() => drawSeqQ(rng, 2, false), () => drawSeqQ(rng, 2, false), () => experimentalQ(rng, 7)])();
      return rng.pick([() => drawSameQ(rng), () => compareExpQ(rng, 7), () => diceSumQ(rng)])();
    }
    if (d === 2) return rng.pick([() => indepQ(rng, 3), () => coinsCountQ(rng, 3), () => drawSeqQ(rng, 3, true)])();
    if (d === 3) return rng.pick([() => drawSeqQ(rng, 3, false), () => drawSeqQ(rng, 2, false), () => experimentalQ(rng, 8)])();
    return rng.pick([() => atLeastQ(rng), () => drawSameQ(rng), () => compareExpQ(rng, 8)])();
  },
  selfCheck: (q) => {
    const pr = prm(q);
    switch (pr.kind) {
      case 'theory':
        return near(q, enumerateP(pr.space as Space, pr.ev as Ev));
      case 'theoryPct':
        return near(q, enumerateP(pr.space as Space, pr.ev as Ev) * 100);
      case 'word':
        return rightText(q) === wordFor(enumerateP(pr.space as Space, pr.ev as Ev)) ? null : 'likelihood word is wrong';
      case 'predict':
        return near(q, (num(pr, 'k') / num(pr, 'T')) * num(pr, 'trials'));
      case 'decide': {
        const [ar, ao] = pr.A as number[];
        const [br, bo] = pr.B as number[];
        const pa = ar! / (ar! + ao!);
        const pb = br! / (br! + bo!);
        const want = Math.abs(pa - pb) < 1e-12 ? 'Either bag: the chances are equal' : pa > pb ? 'Bag A' : 'Bag B';
        return rightText(q) === want ? null : 'better bag is wrong';
      }
      case 'exp': {
        const v = num(pr, 'hits') / num(pr, 'trials');
        return near(q, pr.form === 'percent' ? v * 100 : v);
      }
      case 'expcmp': {
        const th = enumerateP(pr.space as Space, pr.ev as Ev);
        const v = num(pr, 'hits') / num(pr, 'trials');
        return tfIs(q, pr.higher ? v > th + 1e-12 : v < th - 1e-12);
      }
      default:
        return 'unknown question kind';
    }
  },
  summary: ['Probability = favourable outcomes ÷ possible outcomes, from 0 (impossible) to 1 (certain), as a fraction, decimal or percent.', 'Independent events: multiply the probabilities. Dependent events (no replacement): change the numbers after each draw, then multiply.', 'Experimental probability = times it happened ÷ trials; more trials usually bring it closer to the theoretical probability.'],
  misconceptions: [PROB.partPart, PROB.add, PROB.notEqual, PROB.missed, PROB.replaced, PROB.notReplaced, PROB.complement, PROB.expTheory, PROB.words, PROB.more, PROB.forgot100, PROB.notSimplified],
};

export const MATH_PACKS_RATIO: SkillPack[] = [percentOf, percentChange, proportion, exchangeRate, interest, probability];
