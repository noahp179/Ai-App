import { evaluate, isSimplified, parseExpr } from '../../../../shared/study/expr';
import { gcdNum, lcmNum, parseStudentNumber, R, Rational } from '../../../../shared/study/rational';
import type { Block, KnownWrong, Misconception, Question } from '../../../../shared/study/types';
import { choice, dec, expression, m, money, numeric, p, roundTo, steps, tip, trueFalse, warn, type Draft, type Rng, type SkillPack } from '../kit';

/**
 * Number packs (Grades 6–9): rounding, integers, order of operations, squares and square roots, exponents,
 * exponent laws, scientific notation, divisibility, prime factors, GCF and LCM. Every key is computed exactly
 * (Rational or whole-number arithmetic). Every selfCheck recomputes it another way: floating point, reading
 * digits by long division, enumeration with %, or the expression parser.
 */

const G6 = 'on-elementary-mathematics-g6-math';
const G7 = 'on-elementary-mathematics-g7-math';
const G8 = 'on-elementary-mathematics-g8-math';
const W = 'on-mth1w';

const NAMES = ['Amira', 'Liam', 'Priya', 'Mateo', 'Aiyana', 'Noah', 'Mei', 'Jaden', 'Zara', 'Owen', 'Fatima', 'Kai', 'Sofia', 'Ethan', 'Nia', 'Arjun', 'Chloé', 'Malik', 'Hana', 'Lucas'] as const;

// ─────────── Formatting ───────────

function group(s: string, sep: string, minus: string): string {
  const neg = s.startsWith('-');
  const [i = '', f] = (neg ? s.slice(1) : s).split('.');
  const ii = i.length >= 5 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : i;
  return `${neg ? minus : ''}${ii}${f === undefined ? '' : `.${f}`}`;
}
/** A terminating number for plain text: 12.5, 10 000, −3. */
const nt = (v: Rational | number) => group(dec(v), ' ', '−');
/** A terminating number inside LaTeX: 12.5, 10\,000, -3. */
const nl = (v: Rational | number) => group(dec(v), '\\,', '-');
/** Signed integer for plain text, with a true minus sign. */
const sn = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
/** Integer inside a LaTeX expression: negatives in brackets. */
const il = (n: number) => (n < 0 ? `(${n})` : `${n}`);
const pow10 = (k: number) => 10n ** BigInt(k);

// ─────────── Question helpers ───────────

type Wrong = [Rational | null | undefined, string];

/** Known wrong answers that differ from the key and from each other (by value). */
function wrongs(answer: Rational, list: Wrong[]): KnownWrong[] {
  const out: KnownWrong[] = [];
  const seen: Rational[] = [answer];
  for (const [v, misconception] of list) {
    if (!v || seen.some((x) => x.eq(v))) continue;
    seen.push(v);
    out.push({ value: v.toDecimal(10) ?? v.toString(), misconception });
  }
  return out;
}

type Params = Record<string, unknown>;
const prm = (q: Question) => (q.params ?? {}) as Params;
const keyR = (q: Question): Rational | null => (q.type === 'numeric' ? (parseStudentNumber(q.answer)?.value ?? null) : null);
/** Compares the key with an independently computed floating-point value. */
function near(q: Question, want: number): string | null {
  const got = keyR(q)?.toNumber();
  if (got === undefined || !Number.isFinite(want)) return 'key is not a number';
  return Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want)) ? null : `key ${got} does not match ${want}`;
}
const rightText = (q: Question) => (q.type === 'multiple_choice' ? (q.choices.find((c) => c.id === q.answer)?.text ?? '') : '');
function parseRat(s: string): Rational {
  const [a = '0', b] = s.split('/');
  return b ? new Rational(BigInt(a), BigInt(b)) : (Rational.parseDecimal(a) ?? R(0));
}
const nums = (v: unknown) => (Array.isArray(v) ? v.map(Number) : []);

// ─────────── Misconceptions ───────────

const MIS = {
  roundDirection: {
    id: 'num_round_direction',
    label: 'Rounded the wrong way',
    explanation: 'Only the digit just to the right of the rounding place decides. 5 or more rounds up; 4 or less keeps the digit the same. Cutting off the extra digits, or always rounding up, can give the wrong answer.',
    fix: 'Underline the digit in the rounding place and circle the digit to its right. Circled 5 to 9: add 1 to the underlined digit. Circled 0 to 4: leave it. Then drop the digits after it.',
  },
  roundPlace: {
    id: 'num_round_wrong_place',
    label: 'Rounded to a different place',
    explanation: 'Tenths are the first digit after the decimal point, hundredths the second, and the nearest whole number has no digits after the point.',
    fix: 'Before rounding, point to the place the question names. Then look only at the digit right after it.',
  },
  roundEarly: {
    id: 'num_round_early',
    label: 'Rounded too early',
    explanation: 'Rounding in the middle of a calculation adds a small error, and later steps can make it bigger.',
    fix: 'Keep all the digits (or the calculator value) until the last step, then round once.',
  },
  intSubNeg: {
    id: 'num_int_sub_neg',
    label: 'Subtracting a negative',
    explanation: 'Taking away a negative amount makes a number bigger. $$5 - (-3)$$ is the same as $$5 + 3 = 8$$, not $$5 - 3$$.',
    fix: 'Rewrite subtraction as adding the opposite: $$a - (-b) = a + b$$. Then add.',
  },
  intSign: {
    id: 'num_int_sign',
    label: 'Wrong sign on the answer',
    explanation: 'The size of the answer was right, but the sign was not. When you combine a positive and a negative, the answer has the sign of the one farther from zero.',
    fix: 'Picture the number line: which side of zero do you finish on? Check the sign last.',
  },
  intAddAbs: {
    id: 'num_int_add_abs',
    label: 'Added the sizes when the signs were different',
    explanation: 'A positive and a negative partly cancel (zero pairs), so the answer is the difference of their sizes, not the sum.',
    fix: 'Make zero pairs: in $$7 + (-3)$$, three positives cancel three negatives and 4 positives are left.',
  },
  intSignRule: {
    id: 'num_int_sign_rule',
    label: 'Sign rule for multiplying or dividing',
    explanation: 'Two numbers with the same sign give a positive product or quotient; different signs give a negative one. With more numbers, an even count of negatives gives a positive answer and an odd count gives a negative one.',
    fix: 'Multiply or divide the sizes first, then count the negative signs to decide the sign.',
  },
  orderLtr: {
    id: 'num_order_left_right',
    label: 'Worked straight from left to right',
    explanation: 'Multiplication and division are done before addition and subtraction, even when they come later in the line.',
    fix: 'Use BEDMAS: Brackets, Exponents, then Division and Multiplication from left to right, then Addition and Subtraction from left to right.',
  },
  orderBrackets: {
    id: 'num_order_brackets',
    label: 'Skipped the brackets',
    explanation: 'Brackets group part of a calculation that must be done first. Without them the expression means something else.',
    fix: 'Start inside the brackets and replace them with one number before doing anything else.',
  },
  expMultiply: {
    id: 'num_exp_multiply',
    label: 'Multiplied the base by the exponent',
    explanation: '$$2^3$$ means $$2 \\times 2 \\times 2 = 8$$: three factors of 2. It is not $$2 \\times 3 = 6$$.',
    fix: 'Write the power as repeated multiplication before you calculate.',
  },
  expBaseSwap: {
    id: 'num_exp_base_swap',
    label: 'Swapped the base and the exponent',
    explanation: 'In $$5^4$$, 5 is the base (the factor that repeats) and 4 is the exponent (how many times it repeats). $$4^5$$ is a different number.',
    fix: 'Count the repeated factors: that count is the small raised number.',
  },
  squareDouble: {
    id: 'num_square_double',
    label: 'Doubled instead of squaring',
    explanation: 'Squaring means multiplying a number by itself: $$7^2 = 7 \\times 7 = 49$$, not $$7 \\times 2$$.',
    fix: 'Read the little 2 as “times itself”.',
  },
  rootHalf: {
    id: 'num_root_half',
    label: 'Halved instead of taking the square root',
    explanation: 'The square root asks “what number times itself makes this?” $$\\sqrt{36} = 6$$ because $$6 \\times 6 = 36$$. Half of 36 is 18, and $$18 \\times 18$$ is much bigger.',
    fix: 'Check your answer by multiplying it by itself. You should get back the number under the root sign.',
  },
  squareRectangle: {
    id: 'num_square_rectangle',
    label: 'Picked a product of two different numbers',
    explanation: 'A perfect square is a whole number times itself, so its dots make a square. A number like $$6 \\times 7 = 42$$ only makes a rectangle.',
    fix: 'Try to find a whole number that, multiplied by itself, gives the number exactly.',
  },
  rootZeros: {
    id: 'num_root_zeros',
    label: 'Lost track of the zeros',
    explanation: 'Squaring a multiple of 10 doubles the number of zeros: $$70^2 = 4900$$. So a perfect square ending in zeros has an even number of them, and its square root has half as many.',
    fix: 'Split off the zeros in pairs: $$\\sqrt{4900} = \\sqrt{49} \\times \\sqrt{100} = 7 \\times 10 = 70$$.',
  },
  rootEstimate: {
    id: 'num_root_estimate',
    label: 'Compared without checking the square',
    explanation: 'A decimal is bigger than a square root only if its square is bigger than the number under the root sign.',
    fix: 'Square the decimal (multiply it by itself) and compare that with the number under the root.',
  },
  expandedZero: {
    id: 'num_expanded_skip_zero',
    label: 'Left out a zero place',
    explanation: 'A power of ten that is missing from expanded form means that place holds a 0. The zero still needs to be written in standard form.',
    fix: 'Make a place-value chart from the biggest power of ten down to 1, and write 0 in every empty place.',
  },
  placeExponent: {
    id: 'num_place_exponent_off',
    label: 'Exponent off by one',
    explanation: 'The exponent of a place is the number of zeros after the 1: the hundreds place is $$10^2$$, not $$10^3$$. It is one less than the number of digits.',
    fix: 'Count the digits to the right of the one you are naming. That count is the exponent.',
  },
  lawProductMultiply: {
    id: 'num_law_product_multiply',
    label: 'Multiplied the exponents when multiplying powers',
    explanation: '$$x^3 \\times x^4$$ is three factors of x and then four more: seven factors, so $$x^7$$, not $$x^{12}$$.',
    fix: 'Same base, multiplying: add the exponents.',
  },
  lawQuotientDivide: {
    id: 'num_law_quotient_divide',
    label: 'Divided the exponents when dividing powers',
    explanation: 'Dividing cancels matching factors: $$\\frac{x^8}{x^2}$$ leaves 6 factors of x, so $$x^6$$, not $$x^4$$.',
    fix: 'Same base, dividing: subtract the exponents (top minus bottom).',
  },
  lawQuotientOrder: {
    id: 'num_law_quotient_order',
    label: 'Subtracted the exponents in the wrong order',
    explanation: 'For $$x^3 \\div x^7$$, there are more factors on the bottom, so the result is $$x^{3-7} = x^{-4}$$, a small number, not $$x^4$$.',
    fix: 'Always subtract the bottom exponent from the top exponent, even when the answer is negative.',
  },
  lawPowerAdd: {
    id: 'num_law_power_add',
    label: 'Added the exponents for a power of a power',
    explanation: '$$(x^2)^3$$ means $$x^2 \\times x^2 \\times x^2$$, which is $$x^6$$, not $$x^5$$.',
    fix: 'A power of a power: multiply the exponents.',
  },
  lawCoefficients: {
    id: 'num_law_coefficients',
    label: 'Added the numbers in front',
    explanation: 'The numbers in front (coefficients) are factors too, so they are multiplied: $$(3x)(4x) = 12x^2$$, not $$7x^2$$.',
    fix: 'Multiply the coefficients, then use the exponent laws for each letter.',
  },
  lawPowerCoefficient: {
    id: 'num_law_power_coefficient',
    label: 'Forgot to raise the coefficient to the power',
    explanation: 'Everything inside the brackets is raised to the power: $$(2x^3)^2 = 2^2 x^6 = 4x^6$$.',
    fix: 'Apply the outside exponent to the number in front as well as to each letter.',
  },
  zeroExponent: {
    id: 'num_zero_exponent',
    label: 'Zero exponent',
    explanation: 'Any non-zero base to the exponent 0 equals 1. The pattern $$2^3 = 8$$, $$2^2 = 4$$, $$2^1 = 2$$ divides by 2 each time, so $$2^0 = 1$$.',
    fix: 'Remember the pattern: each step down in the exponent divides by the base. One step below the base itself is 1.',
  },
  negExponent: {
    id: 'num_neg_exp_negative',
    label: 'Thought a negative exponent makes a negative number',
    explanation: 'A negative exponent means a reciprocal: $$2^{-3} = \\frac{1}{2^3} = \\frac{1}{8}$$. It is a small positive number, not $$-8$$.',
    fix: 'Write $$b^{-n}$$ as $$\\frac{1}{b^n}$$, then calculate.',
  },
  sciPlaces: {
    id: 'num_sci_count_places',
    label: 'Moved the decimal point the wrong number of places',
    explanation: 'The exponent counts how many places the decimal point moves. Counting only the zeros, or counting one place too many, changes the value by a factor of 10.',
    fix: 'Put your finger on the decimal point and count each jump, one digit at a time, until one non-zero digit is left in front of the point.',
  },
  sciNegative: {
    id: 'num_sci_negative_exponent',
    label: 'Mixed up the sign of the exponent',
    explanation: 'Large numbers (10 or more) have a positive exponent. Small numbers between 0 and 1 have a negative exponent.',
    fix: 'Ask: is the number bigger than 1 or smaller than 1? Bigger: positive exponent. Smaller: negative exponent.',
  },
  sciCoefficient: {
    id: 'num_sci_coefficient',
    label: 'Number in front is not between 1 and 10',
    explanation: 'In scientific notation the first number must be at least 1 and less than 10, like 4.5. $$45 \\times 10^5$$ has the right value but is not in scientific notation.',
    fix: 'Move the decimal point so exactly one non-zero digit is in front of it, then adjust the exponent.',
  },
  sciCompare: {
    id: 'num_sci_compare_coefficient',
    label: 'Compared only the numbers in front',
    explanation: 'The power of 10 matters most. $$1.2 \\times 10^6$$ is greater than $$9.8 \\times 10^5$$ because a million is ten times $$10^5$$.',
    fix: 'Compare the exponents first. Only when the exponents are equal, compare the numbers in front.',
  },
  divLastDigit: {
    id: 'num_div_last_digit',
    label: 'Used the last digit for 3 or 9',
    explanation: 'The last digit tells you about 2, 5 and 10, but not about 3 or 9. For 3 and 9, add all the digits.',
    fix: 'For 3: is the sum of the digits divisible by 3? For 9: is the sum of the digits divisible by 9?',
  },
  div3vs9: {
    id: 'num_div_3_vs_9',
    label: 'Mixed up the rules for 3 and 9',
    explanation: 'A digit sum divisible by 3 means the number is divisible by 3. For 9, the digit sum itself must be divisible by 9.',
    fix: 'Find the digit sum, then check it against the exact divisor in the question.',
  },
  div6: {
    id: 'num_div_6_both',
    label: 'Checked only one part of the rule for 6',
    explanation: '6 = 2 × 3, so a number is divisible by 6 only when it passes both tests: it is even and its digit sum is divisible by 3.',
    fix: 'Check two things: even? digit sum divisible by 3? Both must be yes.',
  },
  div4and8: {
    id: 'num_div_4_8',
    label: 'Checked only the last digit for 4 or 8',
    explanation: 'An even last digit means divisible by 2, not always by 4 or 8. For 4, look at the last two digits; for 8, the last three.',
    fix: 'For 4: is the number made by the last two digits divisible by 4? For 8: are the last three digits divisible by 8?',
  },
  div2510: {
    id: 'num_div_2_5_10',
    label: 'Mixed up the rules for 2, 5 and 10',
    explanation: 'Divisible by 2: last digit even. By 5: last digit 0 or 5. By 10: last digit 0. A number ending in 5 is divisible by 5 but not by 2 or 10.',
    fix: 'Look at the last digit and check it against the rule for the exact divisor in the question.',
  },
  primeOdd: {
    id: 'num_prime_odd',
    label: 'Thought every odd number is prime',
    explanation: 'Many odd numbers have factors: 51 = 3 × 17 and 91 = 7 × 13.',
    fix: 'Test small primes (3, 5, 7, 11) before deciding a number is prime.',
  },
  primeOne: {
    id: 'num_prime_one',
    label: 'Counted 1 as prime',
    explanation: 'A prime number has exactly two different factors: 1 and itself. The number 1 has only one factor, so it is neither prime nor composite.',
    fix: 'Remember: the smallest prime number is 2.',
  },
  primeNotAll: {
    id: 'num_prime_not_all_prime',
    label: 'Stopped before every factor was prime',
    explanation: 'A product like 2 × 6 × 7 is equal to the number, but 6 is not prime. A prime factorization uses only prime numbers.',
    fix: 'Keep splitting every factor that is not prime (6 = 2 × 3) until all the branches end in primes.',
  },
  primeMissing: {
    id: 'num_prime_missing_repeat',
    label: 'Left out a repeated prime factor',
    explanation: 'A prime can appear more than once: 12 = 2 × 2 × 3. Writing 2 × 3 gives only 6.',
    fix: 'Multiply your factors back together to check that you get the original number.',
  },
  primeLargestFactor: {
    id: 'num_prime_largest_factor',
    label: 'Gave the largest factor, not the largest prime factor',
    explanation: 'Half of an even number is a factor, but it is usually not prime.',
    fix: 'Write the prime factorization first, then choose the biggest prime in it.',
  },
  lcmProduct: {
    id: 'num_lcm_product',
    label: 'Multiplied the numbers to get the LCM',
    explanation: 'The product of two numbers is always a common multiple, but often not the lowest one. For 6 and 8 the product is 48, but 24 is lower.',
    fix: 'List the multiples of the larger number until you reach one the other number also divides.',
  },
  gcfLcmMix: {
    id: 'num_gcf_lcm_mixup',
    label: 'Mixed up GCF and LCM',
    explanation: 'The greatest common factor is never bigger than the smallest number. The lowest common multiple is never smaller than the largest number.',
    fix: 'Ask: am I sharing into equal groups (factor) or waiting for things to line up again (multiple)?',
  },
  gcfNotGreatest: {
    id: 'num_gcf_not_greatest',
    label: 'Found a common factor, but not the greatest',
    explanation: 'Both numbers can share several factors. The question asks for the greatest one.',
    fix: 'List all the factors of each number, or use prime factors and multiply all the primes they share.',
  },
} satisfies Record<string, Misconception>;

// ═════════════════════════ Rounding ═════════════════════════

const PLACE_WORD = ['whole number', 'tenth', 'hundredth'] as const;
const PLACE_COL = ['ones', 'tenths', 'hundredths', 'thousandths'] as const;
const nearest = (k: number) => `the nearest ${PLACE_WORD[k]}`;

/** Digits of a positive rational by long division: the whole part and `k` digits after the point. */
function longDivision(v: Rational, k: number): { whole: bigint; digits: number[] } {
  const whole = v.n / v.d;
  let r = v.n % v.d;
  const digits: number[] = [];
  for (let i = 0; i < k; i++) {
    r *= 10n;
    digits.push(Number(r / v.d));
    r %= v.d;
  }
  return { whole, digits };
}

/** Rounding the way a student does it: keep `places` digits, then look at the next one. */
function roundByDigits(v: Rational, places: number): number {
  const { whole, digits } = longDivision(v, places + 1);
  let scaled = whole;
  for (let i = 0; i < places; i++) scaled = scaled * 10n + BigInt(digits[i]!);
  if (digits[places]! >= 5) scaled += 1n;
  return Number(scaled) / 10 ** places;
}

/** Whole part, non-repeating digits and repeating block of a positive rational. */
function decimalParts(v: Rational): { whole: bigint; pre: string; rep: string } {
  const whole = v.n / v.d;
  let r = v.n % v.d;
  const seen = new Map<bigint, number>();
  let ds = '';
  while (r !== 0n && !seen.has(r) && ds.length < 40) {
    seen.set(r, ds.length);
    r *= 10n;
    ds += (r / v.d).toString();
    r %= v.d;
  }
  if (r === 0n || !seen.has(r)) return { whole, pre: ds, rep: '' };
  const at = seen.get(r)!;
  return { whole, pre: ds.slice(0, at), rep: ds.slice(at) };
}
/** LaTeX for a decimal that may repeat: 0.\overline{6}, 2.1\overline{6}, 35.674. */
function decTex(v: Rational): string {
  const { whole, pre, rep } = decimalParts(v);
  return rep ? `${whole}.${pre}\\overline{${rep}}` : nl(v);
}
/** Plain text with enough digits to see the pattern: 0.666666… */
function decLong(v: Rational): string {
  const { whole, pre, rep } = decimalParts(v);
  if (!rep) return nt(v);
  let s = pre;
  while (s.length < 6) s += rep;
  return `${whole}.${s}…`;
}
/** Cuts a positive value off after `k` decimal places. */
const truncTo = (v: Rational, k: number) => new Rational((v.n * pow10(k)) / v.d, pow10(k));
/** A rounded value with exactly `places` decimals: 10.00, 4.7, 36. */
function fixed(r: Rational, places: number): string {
  const s = dec(r);
  if (!places) return s;
  const [i, f = ''] = s.split('.');
  return `${i}.${f.padEnd(places, '0')}`;
}

/** A terminating decimal with exactly k decimal places (last digit not 0). */
function termValue(rng: Rng, lo: number, hi: number, k: number): Rational {
  let f = rng.int(1, 10 ** k - 1);
  if (f % 10 === 0) f += rng.int(1, 9);
  return R(rng.int(lo, hi) * 10 ** k + f, 10 ** k);
}
/** A value whose rounding carries: 3.496 → 3.50, 39.75 → 40. */
function carryValue(rng: Rng, places: number): Rational {
  const k = places + 2;
  const ds = Array.from({ length: k }, () => rng.int(0, 9));
  if (places > 0) ds[places - 1] = 9;
  ds[places] = rng.int(5, 9);
  ds[k - 1] = rng.int(1, 9);
  let w = rng.int(0, 60);
  if (places === 0) w = w - (w % 10) + 9;
  return R(BigInt(w) * pow10(k) + BigInt(ds.join('')), pow10(k));
}
const REP: [number, number][] = [
  [1, 3],
  [2, 3],
  [1, 6],
  [5, 6],
  [1, 9],
  [4, 9],
  [7, 9],
  [2, 11],
  [5, 11],
  [5, 12],
  [7, 12],
  [1, 7],
  [3, 7],
];
const repValue = (rng: Rng) => {
  const [a, b] = rng.pick(REP);
  return R(a, b).add(rng.int(0, 12));
};

function roundSteps(v: Rational, places: number, ans: Rational): Block {
  const { whole, digits } = longDivision(v, places + 1);
  const keep = places === 0 ? Number(whole % 10n) : digits[places - 1]!;
  const next = digits[places]!;
  const col = PLACE_COL[places]!;
  return steps(
    { text: `Find the digit in the ${col} place: ${keep}.`, math: decTex(v) },
    { text: `Look at the digit just to its right, in the ${PLACE_COL[places + 1]} place: ${next}.` },
    next >= 5
      ? { text: `${next} is 5 or more, so round up: the ${col} digit goes up by 1${keep === 9 ? '. It was a 9, so it becomes 0 and 1 is carried to the place on its left' : ''}.` }
      : { text: `${next} is less than 5, so the ${col} digit stays the same.` },
    { text: 'Drop all the digits after the rounding place.', math: `${decTex(v)} \\approx ${fixed(ans, places)}` },
  );
}

function roundQ(v: Rational, places: number, prompt: Block[], o: { unit?: string; pre?: Block[]; params?: Params } = {}): Draft {
  const ans = roundTo(v, places);
  const down = truncTo(v, places);
  const otherWay = ans.eq(down) ? (down.eq(v) ? null : down.add(new Rational(1n, pow10(places)))) : down;
  const next = longDivision(v, places + 1).digits[places]!;
  return numeric(prompt, ans, {
    hints: [`Find the ${PLACE_COL[places]} digit, then look only at the one digit just to its right.`, `The digit after the ${PLACE_COL[places]} place is ${next}, so ${next >= 5 ? 'round up' : 'keep the rounding digit the same'}.`],
    solution: [...(o.pre ?? []), roundSteps(v, places, ans)],
    unit: o.unit,
    accept: ['integer', 'decimal'],
    knownWrong: wrongs(ans, [[otherWay, MIS.roundDirection.id], ...[0, 1, 2].filter((k) => k !== places).map((k): Wrong => [roundTo(v, k), MIS.roundPlace.id])]),
    params: { kind: 'round', v: v.toString(), places, ...o.params },
  });
}

function pickRoundQ(rng: Rng): Draft {
  const places = rng.pick([1, 2]);
  const u = R(1, 10 ** places);
  const t = termValue(rng, 1, 30, places);
  const tenth = u.div(10);
  const right = t.sub(u.div(2)).add(tenth.mul(rng.pick([0, 1, 2, 3, 4, 6, 7, 8, 9])));
  const up = t.add(u.div(2)).add(tenth.mul(rng.int(0, 4)));
  const down = t.sub(u).add(tenth.mul(rng.int(1, 4)));
  const s = dec(t);
  const misplaced = Rational.parseDecimal(`${s.slice(0, -1)}0${s.slice(-1)}`) ?? t.mul(10);
  const opts = [right, up, down, misplaced];
  return choice(
    rng,
    [p(`Which number rounds to ${fixed(t, places)} when it is rounded to ${nearest(places)}?`)],
    dec(right),
    [
      { text: dec(up), misconception: MIS.roundDirection.id },
      { text: dec(down), misconception: MIS.roundDirection.id },
      { text: dec(misplaced), misconception: MIS.roundPlace.id },
    ],
    {
      hints: [`Round each option to ${nearest(places)}.`, `A number rounds to ${fixed(t, places)} when it is at least ${dec(t.sub(u.div(2)))} and less than ${dec(t.add(u.div(2)))}.`],
      solution: [p(`Round each option to ${nearest(places)}:`), { kind: 'table', header: ['Number', 'Rounded'], rows: opts.map((v) => [dec(v), fixed(roundTo(v, places), places)]) }, p(`Only ${dec(right)} rounds to ${fixed(t, places)}.`)],
      params: { kind: 'pick', target: t.toString(), places },
    },
  );
}

export const rounding: SkillPack = {
  id: 'rounding',
  title: 'Rounding decimal numbers',
  subject: 'math',
  expectations: [
    {
      id: `${G6}:B1.5`,
      note: 'Rounds terminating decimals and repeating decimals (shown with bar notation and written out, e.g. 0.666…) to the nearest whole number, tenth or hundredth, including sharing, measurement and money contexts, and recognising which number rounds to a given value.',
      levels: [1, 2, 3],
    },
    {
      id: `${G7}:B1.6`,
      note: 'Rounds decimal numbers to the nearest whole number, tenth or hundredth in measurement, money and sharing contexts, including cases that carry (9.996 → 10.00) and averages or unit prices that are rounded at the end.',
    },
  ],
  prerequisites: [],
  goal: 'I can round a decimal number to the nearest whole number, tenth or hundredth.',
  explain: (c) => [
    p('Rounding makes a number simpler to work with. You choose a **place** (whole number, tenth or hundredth) and find the closest number that stops at that place.'),
    steps(
      { text: 'Find the digit in the rounding place. For the nearest tenth, that is the first digit after the decimal point.', math: '35.\\underline{6}74' },
      { text: 'Look at the next digit to the right.', math: '35.6\\underline{7}4' },
      { text: 'If it is 5 or more, add 1 to the rounding digit. If it is 4 or less, keep the rounding digit.' },
      { text: 'Drop the digits after the rounding place.', math: '35.674 \\approx 35.7' },
    ),
    { kind: 'table', header: ['Round 35.674 to…', 'Answer'], rows: [['the nearest whole number', '36'], ['the nearest tenth', '35.7'], ['the nearest hundredth', '35.67']] },
    ...(c.grade === 6
      ? [p('Some decimals **repeat** forever, like $$\\frac{2}{3} = 0.666\\ldots$$. A bar shows the repeating part: $$0.\\overline{6}$$. You round them the same way: $$0.\\overline{6} \\approx 0.67$$ to the nearest hundredth.')]
      : [p('Money is usually rounded to the nearest cent, which is the nearest hundredth of a dollar.')]),
    c.simple ? tip('Look at the digit right after your place. 5 or more: go up. 4 or less: stay.') : tip('A 9 that rounds up becomes 0 and carries 1 to the left: 9.96 rounded to the nearest tenth is 10.0.'),
  ],
  alternatives: () => ({
    simpler: [p('Point to the place you are rounding to. Look at the very next digit. 5, 6, 7, 8 or 9: add one. 0, 1, 2, 3 or 4: leave it. Then stop writing digits.')],
    visual: [
      { kind: 'diagram', diagram: { type: 'number_line', min: 4.6, max: 4.7, step: 0.01, points: [{ at: 4.6, label: '4.6' }, { at: 4.65, label: 'halfway 4.65' }, { at: 4.68, label: '4.68' }, { at: 4.7, label: '4.7' }] }, alt: 'A number line from 4.6 to 4.7 marked in hundredths. 4.68 is past the halfway mark 4.65, so it is closer to 4.7.' },
      p('4.68 is past the halfway point, so it is closer to 4.7. To the nearest tenth, 4.68 ≈ 4.7.'),
    ],
    analogy: [p('Think of a price tag of $3.98. People say “about $4” because $3.98 is much closer to $4 than to $3. Rounding is saying “about” in a careful, agreed way.')],
    steps: [p('Round 12.349 to the nearest hundredth.'), steps({ text: 'Hundredths digit: 4.', math: '12.3\\underline{4}9' }, { text: 'Next digit: 9, which is 5 or more.' }, { text: 'Round the 4 up to 5 and drop the rest.', math: '12.349 \\approx 12.35' })],
  }),
  example: (rng) => {
    const v = termValue(rng, 1, 40, 3);
    const places = rng.pick([1, 2]);
    const ans = roundTo(v, places);
    return [p(`Round ${nt(v)} to ${nearest(places)}.`), roundSteps(v, places, ans)];
  },
  generate: (rng, d, c) => {
    const name = rng.pick(NAMES);
    if (d === 1) {
      const places = rng.pick([0, 1]);
      const v = termValue(rng, 0, 50, 2);
      return roundQ(v, places, [p(`Round ${nt(v)} to ${nearest(places)}.`)]);
    }
    if (d === 2) {
      if (rng.chance(c.grade === 6 ? 0.45 : 0.25)) {
        const v = repValue(rng);
        const places = rng.pick([0, 1, 2, 2]);
        return roundQ(v, places, [p(`Round $$${decTex(v)}$$ to ${nearest(places)}.`), p(`The bar means the digits under it repeat forever: $$${decTex(v)}$$ = ${decLong(v)}`)]);
      }
      const places = rng.pick([0, 1, 2]);
      const v = rng.chance(0.25) ? carryValue(rng, places) : termValue(rng, 0, 99, 3);
      return roundQ(v, places, [p(`Round ${nt(v)} to ${nearest(places)}.`)]);
    }
    if (d === 3) {
      const kind = rng.pick(c.grade === 6 ? (['share', 'measure', 'pick'] as const) : (['share', 'money', 'measure', 'pick'] as const));
      if (kind === 'pick') return pickRoundQ(rng);
      if (kind === 'share') {
        const n = rng.pick([3, 6, 7, 9, 11, 12]);
        let T = rng.int(1, 2 * n);
        while (R(T, n).toDecimal(2) !== null) T++;
        const v = R(T, n);
        return roundQ(v, 2, [p(`${name} shares ${T} L of juice equally among ${n} friends. How many litres does each friend get? Round to the nearest hundredth of a litre.`)], { unit: 'L', pre: [p(`Divide: ${T} ÷ ${n} = ${decLong(v)}`)] });
      }
      if (kind === 'money') {
        const n = rng.pick([3, 6, 7, 9]);
        let cents = rng.int(199, 1299);
        while (R(cents, 100 * n).toDecimal(2) !== null) cents++;
        const v = R(cents, 100 * n);
        return roundQ(v, 2, [p(`A pack of ${n} granola bars costs ${money(R(cents, 100))}. What does one bar cost? Give your answer in dollars, rounded to the nearest cent (the nearest hundredth of a dollar).`)], { pre: [p(`Divide: ${money(R(cents, 100))} ÷ ${n} = $${decLong(v)}`)] });
      }
      const ctx = rng.pick([
        { lo: 11, hi: 19, text: (v: string) => `${name}’s time in the 100 m race was ${v} s.`, unit: 's', of: 'second' },
        { lo: 1, hi: 25, text: (v: string) => `A hiking trail in Algonquin Park is ${v} km long.`, unit: 'km', of: 'kilometre' },
        { lo: 1, hi: 9, text: (v: string) => `A bag of apples has a mass of ${v} kg.`, unit: 'kg', of: 'kilogram' },
      ]);
      const v = termValue(rng, ctx.lo, ctx.hi, 3);
      const places = rng.pick([0, 1, 2]);
      return roundQ(v, places, [p(`${ctx.text(nt(v))} Round this to ${places === 0 ? `the nearest whole ${ctx.of}` : `the nearest ${PLACE_WORD[places]} of a ${ctx.of}`}.`)], { unit: ctx.unit });
    }
    const kind = rng.pick(['mean', 'carry', 'unit'] as const);
    if (kind === 'carry') {
      const places = rng.pick([1, 2]);
      const v = carryValue(rng, places);
      return roundQ(v, places, [p(`Round ${nt(v)} to ${nearest(places)}. Watch what happens to the digits on the left.`)]);
    }
    if (kind === 'mean') {
      const vals = [termValue(rng, 10, 30, 1), termValue(rng, 10, 30, 1), termValue(rng, 10, 30, 1)];
      while (vals.reduce((a, b) => a.add(b), R(0)).div(3).toDecimal(2) !== null) vals[2] = vals[2]!.add(R(1, 10));
      const sum = vals.reduce((a, b) => a.add(b), R(0));
      const v = sum.div(3);
      return roundQ(v, 2, [p(`${name} measured the height of a bean plant three times: ${vals.map(nt).join(' cm, ')} cm. What is the mean (average) of the three measurements? Round to the nearest hundredth of a centimetre.`)], {
        unit: 'cm',
        pre: [p(`Mean = (${vals.map(nt).join(' + ')}) ÷ 3 = ${nt(sum)} ÷ 3 = ${decLong(v)}. Round only at the end.`)],
        params: { vals: vals.map((x) => x.toString()) },
      });
    }
    const g = rng.pick([300, 450, 600, 700, 750, 900]);
    let cents = rng.int(199, 899);
    while (R(cents, g).toDecimal(2) !== null) cents++;
    const v = R(cents, g);
    return roundQ(v, 2, [p(`A ${g} g bag of trail mix costs ${money(R(cents, 100))}. What is the price per 100 g? Give your answer in dollars, rounded to the nearest cent.`)], {
      pre: [p(`There are ${nt(R(g, 100))} groups of 100 g in ${g} g, so divide: ${money(R(cents, 100))} ÷ ${nt(R(g, 100))} = $${decLong(v)}`)],
    });
  },
  selfCheck: (q) => {
    const pr = prm(q);
    const places = Number(pr.places);
    if (pr.kind === 'pick') {
      if (q.type !== 'multiple_choice') return 'expected a choice';
      const target = parseRat(String(pr.target)).toNumber();
      for (const c of q.choices) {
        const v = Rational.parseDecimal(c.text);
        if (!v) return `option ${c.text} is not a decimal`;
        const hits = Math.abs(roundByDigits(v, places) - target) < 1e-9;
        if (hits !== (c.id === q.answer)) return `option ${c.text} rounds the wrong way`;
      }
      return null;
    }
    const v = parseRat(String(pr.v));
    if (Array.isArray(pr.vals)) {
      const mean = pr.vals.map((x) => parseRat(String(x)).toNumber()).reduce((a, b) => a + b, 0) / pr.vals.length;
      if (Math.abs(mean - v.toNumber()) > 1e-9) return 'mean does not match';
    }
    return near(q, roundByDigits(v, places));
  },
  summary: ['Find the digit in the rounding place (ones, tenths or hundredths).', 'Look only at the next digit: 5 or more rounds up, 4 or less stays the same.', 'Repeating decimals round the same way, and in a calculation you round once, at the end.'],
  misconceptions: [MIS.roundDirection, MIS.roundPlace],
};

// ═════════════════════════ Adding and subtracting integers ═════════════════════════

type PM = '+' | '-';
const sumTex = (terms: number[], ops: PM[]) => terms.map((t, i) => `${i ? ` ${ops[i - 1]} ` : ''}${il(t)}`).join('');
function sumOf(terms: number[], ops: PM[], fix?: (t: number, op: PM) => number): Rational {
  return terms.slice(1).reduce((acc, t, i) => {
    const op = ops[i]!;
    const tt = fix ? fix(t, op) : t;
    return op === '+' ? acc.add(tt) : acc.sub(tt);
  }, R(terms[0]!));
}

/** A number line: the start point, and optionally the jumps and the end. The range always covers the whole trip. */
function intLine(start: number, moves: number[], showJumps: boolean, alt: string): Block {
  const stops = moves.reduce((s, mv) => [...s, s[s.length - 1]! + mv], [start]);
  const lo = Math.min(0, ...stops);
  const hi = Math.max(0, ...stops);
  const step = hi - lo <= 24 ? 1 : hi - lo <= 60 ? 5 : 10;
  const min = Math.floor(lo / step) * step - step;
  const max = Math.ceil(hi / step) * step + step;
  const end = stops[stops.length - 1]!;
  return {
    kind: 'diagram',
    diagram: {
      type: 'number_line',
      min,
      max,
      step,
      points: showJumps ? [{ at: start, label: `start ${sn(start)}` }, ...(end !== start ? [{ at: end, label: `end ${sn(end)}` }] : [])] : [{ at: start, label: `start ${sn(start)}` }],
      ...(showJumps ? { jumps: moves.map((mv, i) => ({ from: stops[i]!, to: stops[i + 1]!, label: mv < 0 ? `−${-mv}` : `+${mv}` })) } : {}),
    },
    alt,
  };
}

function addSubQ(terms: number[], ops: PM[], prompt: Block[], o: { unit?: string; line?: boolean; pre?: Block[] } = {}): Draft {
  const ans = sumOf(terms, ops);
  const adds = terms.map((t, i) => (i === 0 || ops[i - 1] === '+' ? t : -t));
  const hasSubNeg = terms.some((t, i) => i > 0 && ops[i - 1] === '-' && t < 0);
  const run: { text: string; math?: string }[] = [];
  if (ops.includes('-')) run.push({ text: 'Rewrite each subtraction as adding the opposite.', math: `${sumTex(terms, ops)} = ${sumTex(adds, adds.slice(1).map((): PM => '+'))}` });
  let acc = adds[0]!;
  for (let i = 1; i < adds.length; i++) {
    const nx = acc + adds[i]!;
    const a = adds[i]!;
    const why = Math.sign(acc) === Math.sign(a) || acc === 0 ? 'Same signs: add the sizes and keep the sign.' : 'Different signs: zero pairs cancel, so subtract the sizes and keep the sign of the one farther from zero.';
    run.push({ text: why, math: `${il(acc)} + ${il(a)} = ${nx}` });
    acc = nx;
  }
  const wrong: Wrong[] = [
    [hasSubNeg ? sumOf(terms, ops, (t, op) => (op === '-' ? Math.abs(t) : t)) : null, MIS.intSubNeg.id],
    [ans.isZero() ? null : ans.neg(), MIS.intSign.id],
  ];
  if (adds.length === 2 && Math.sign(adds[0]!) !== Math.sign(adds[1]!) && !ans.isZero()) wrong.push([R(Math.sign(ans.toNumber()) * (Math.abs(adds[0]!) + Math.abs(adds[1]!))), MIS.intAddAbs.id]);
  const line = o.line && adds.length === 2 ? [intLine(adds[0]!, [adds[1]!], true, `A number line. Start at ${sn(adds[0]!)} and move ${adds[1]! < 0 ? 'left' : 'right'} ${Math.abs(adds[1]!)} to end at ${sn(acc)}.`)] : [];
  return numeric(prompt, ans, {
    hints: [ops.includes('-') ? 'Change each subtraction into adding the opposite. Subtracting a negative is the same as adding a positive.' : 'Think of a number line: adding a positive moves right, adding a negative moves left.', 'Combine positives and negatives: zero pairs cancel, and the answer has the sign of whichever side is bigger.'],
    solution: [...(o.pre ?? []), steps(...run), ...line],
    unit: o.unit,
    accept: ['integer'],
    knownWrong: wrongs(ans, wrong),
    params: { kind: 'sum', terms, ops },
  });
}

function subNegTF(rng: Rng): Draft {
  const a = rng.signed(1, 12);
  const b = rng.int(2, 12);
  const claimSub = rng.chance(0.5);
  const claim = claimSub ? `${il(a)} - ${b}` : `${il(a)} + ${b}`;
  return trueFalse([p('True or false?'), m(`${il(a)} - (-${b}) = ${claim}`)], !claimSub, {
    hints: ['Subtracting a number is the same as adding its opposite.', `What is the opposite of $$-${b}$$?`],
    solution: [m(`${il(a)} - (-${b}) = ${il(a)} + ${b} = ${a + b}`), p(claimSub ? `But $$${claim} = ${a - b}$$, so the statement is **false**.` : `That is exactly the right side, so the statement is **true**.`)],
    misconception: MIS.intSubNeg.id,
    params: { kind: 'tf', a, b, claim: claimSub ? 'sub' : 'add' },
  });
}

const COLD = ['Iqaluit', 'Yellowknife', 'Whitehorse', 'Winnipeg', 'Thunder Bay', 'Saskatoon'] as const;
const MILD = ['Vancouver', 'Victoria', 'Halifax', 'Toronto'] as const;

export const integerAddSub: SkillPack = {
  id: 'int-addsub',
  title: 'Adding and subtracting integers',
  subject: 'math',
  expectations: [
    {
      id: `${G7}:B2.4`,
      note: 'Adds and subtracts integers and solves temperature, elevation and game-score situations with them. Number lines and zero pairs are shown in prompts, explanations and solutions; representing with objects or diagrams is not itself assessed, only the calculation.',
      levels: [1, 2, 3],
    },
    { id: `${G8}:B2.4`, note: 'Adds and subtracts integers, including subtracting negatives and expressions with several terms, in temperature, elevation and score contexts.', levels: [2, 3, 4] },
  ],
  prerequisites: [],
  goal: 'I can add and subtract positive and negative integers.',
  explain: (c) => [
    p('**Integers** are the whole numbers and their opposites: …, −3, −2, −1, 0, 1, 2, 3, …. On a number line, positives are to the right of 0 and negatives to the left.'),
    p('**Adding:** adding a positive moves right; adding a negative moves left. A positive and a negative of the same size make a **zero pair**: $$(+3) + (-3) = 0$$.'),
    m('(-7) + 4 = -3'),
    p('**Subtracting:** subtracting is the same as adding the opposite.'),
    m('5 - (-3) = 5 + 3 = 8 \\qquad (-4) - 6 = (-4) + (-6) = -10'),
    steps({ text: 'Rewrite any subtraction as adding the opposite.' }, { text: 'Same signs: add the sizes and keep the sign.' }, { text: 'Different signs: subtract the sizes and keep the sign of the number farther from zero.' }),
    c.simple ? tip('Minus a negative? Change it to plus a positive.') : tip('Check with a number line: does your answer land on the side of zero you expect?'),
  ],
  alternatives: () => ({
    simpler: [p('Plus a positive: go right. Plus a negative: go left. Minus a negative: it turns into plus a positive.')],
    visual: [intLine(-6, [9], true, 'A number line. Start at −6 and move right 9 to end at 3.'), p('$$(-6) + 9$$: start at −6 and move 9 to the right. You land on 3.')],
    analogy: [p('Think of temperature. If it is −6°C and it warms up 9 degrees, it becomes 3°C. If it is 2°C and drops 5 degrees, it becomes −3°C.')],
    compare: [p('Coloured counters: each yellow counter is +1 and each red counter is −1. A yellow and a red together make 0. To work out $$4 + (-6)$$, pair up 4 yellows with 4 reds. Two reds are left, so the answer is −2.')],
  }),
  example: (rng) => {
    const a = rng.signed(2, 9);
    const b = rng.int(2, 9);
    return [p(`Calculate $$${il(a)} - (-${b})$$.`), steps({ text: 'Subtracting a negative is adding the opposite.', math: `${il(a)} - (-${b}) = ${il(a)} + ${b}` }, { text: 'Add.', math: `${il(a)} + ${b} = ${a + b}` }), intLine(a, [b], true, `A number line. Start at ${sn(a)} and move right ${b} to end at ${sn(a + b)}.`)];
  },
  generate: (rng, d, c) => {
    const name = rng.pick(NAMES);
    if (d === 1) {
      const a = rng.signed(1, 9);
      const b = rng.signed(1, 9);
      const op: PM = rng.chance(0.7) ? '+' : '-';
      const move = op === '+' ? b : -b;
      return addSubQ([a, b], [op], [p('Calculate. You can use the number line to help.'), m(sumTex([a, b], [op])), intLine(a, [move], false, `A number line with the starting number ${sn(a)} marked.`)], { line: true });
    }
    if (d === 2) {
      if (rng.chance(0.3)) return subNegTF(rng);
      const a = rng.signed(1, 20);
      const b = rng.signed(1, 20);
      const op: PM = rng.chance(0.6) ? '-' : '+';
      return addSubQ([a, b], [op], [p('Calculate.'), m(sumTex([a, b], [op]))], { line: true });
    }
    if (d === 3) {
      const kind = rng.pick(['change', 'diff', 'sub', 'three'] as const);
      if (kind === 'change') {
        const a = -rng.int(3, 25);
        const k = rng.int(4, 18);
        const rose = rng.chance(0.6);
        const city = rng.pick(COLD);
        return addSubQ([a, k], [rose ? '+' : '-'], [p(`At 6 a.m. in ${city} the temperature was ${sn(a)}°C. By noon it had ${rose ? 'risen' : 'dropped'} ${k} degrees. What was the temperature at noon?`)], { unit: '°C', line: true, pre: [p(`The calculation is $$${sumTex([a, k], [rose ? '+' : '-'])}$$.`)] });
      }
      if (kind === 'diff') {
        const cold = -rng.int(5, 30);
        const warm = rng.int(-3, 9);
        const [cc, wc] = [rng.pick(COLD), rng.pick(MILD)];
        return addSubQ([warm, cold], ['-'], [p(`On a January day it was ${sn(cold)}°C in ${cc} and ${sn(warm)}°C in ${wc}. How many degrees warmer was it in ${wc}?`)], { unit: '°C', pre: [p(`“How much warmer” is a difference: warmer temperature − colder temperature = $$${sumTex([warm, cold], ['-'])}$$.`)] });
      }
      if (kind === 'sub') {
        const start = -rng.int(40, 150);
        const up = rng.int(10, 60);
        const down = rng.int(10, 60);
        return addSubQ([start, up, down], ['+', '-'], [p(`A research submarine is at ${sn(start)} m (below sea level). It rises ${up} m, then dives ${down} m. What is its new position? Use a negative number for below sea level.`)], { unit: 'm', pre: [p(`Rising adds and diving subtracts: $$${sumTex([start, up, down], ['+', '-'])}$$.`)] });
      }
      const terms = [rng.signed(1, 15), rng.signed(1, 15), rng.signed(1, 15)];
      const ops: PM[] = [rng.pick(['+', '-'] as const), rng.pick(['+', '-'] as const)];
      if (c.grade >= 8 || rng.chance(0.5)) return addSubQ(terms, ops, [p('Calculate.'), m(sumTex(terms, ops))]);
      return addSubQ(terms, ops, [p(`In a board game, ${name} has ${sn(terms[0]!)} points. On the next turn the score changes by ${ops[0] === '+' ? '' : 'minus '}$$${il(terms[1]!)}$$, then by ${ops[1] === '+' ? '' : 'minus '}$$${il(terms[2]!)}$$. Work out $$${sumTex(terms, ops)}$$ to find the new score.`)]);
    }
    if (rng.chance(0.5)) {
      const start = -rng.int(2, 15);
      const changes = [rng.signed(2, 9), rng.signed(2, 9), rng.signed(2, 9)];
      const city = rng.pick(COLD);
      return addSubQ([start, ...changes], ['+', '+', '+'], [p(`At midnight in ${city} it was ${sn(start)}°C. Over the next three hours the temperature changed by ${changes.map((x) => `${x > 0 ? '+' : ''}${sn(x)}°C`).join(', ')}. What was the temperature after the three hours?`)], { unit: '°C' });
    }
    const n = rng.int(4, 5);
    const terms = Array.from({ length: n }, () => rng.signed(1, 40));
    const ops = Array.from({ length: n - 1 }, () => rng.pick(['+', '-'] as const));
    if (!terms.some((t, i) => i > 0 && t < 0 && ops[i - 1] === '-')) {
      terms[n - 1] = -Math.abs(terms[n - 1]!);
      ops[n - 2] = '-';
    }
    return addSubQ(terms, ops, [p('Calculate.'), m(sumTex(terms, ops))]);
  },
  selfCheck: (q) => {
    const pr = prm(q);
    if (pr.kind === 'tf') {
      const a = Number(pr.a);
      const b = Number(pr.b);
      const claimed = pr.claim === 'sub' ? a - b : a + b;
      return q.type === 'true_false' && q.answer === (a - -b === claimed) ? null : 'true/false key is wrong';
    }
    const terms = nums(pr.terms);
    const ops = Array.isArray(pr.ops) ? pr.ops.map(String) : [];
    let total = terms[0] ?? NaN;
    ops.forEach((op, i) => (total = op === '+' ? total + terms[i + 1]! : total - terms[i + 1]!));
    return near(q, total);
  },
  summary: ['Adding a positive moves right on the number line; adding a negative moves left.', 'Subtracting is adding the opposite: $$a - (-b) = a + b$$.', 'A positive and a negative of the same size make a zero pair.'],
  misconceptions: [MIS.intSubNeg, MIS.intSign, MIS.intAddAbs],
};

// ═════════════════════════ Multiplying and dividing integers ═════════════════════════

type MD = '*' | '/';
const mdTex = (ns: number[], ops: MD[]) => ns.map((t, i) => `${i ? ` ${ops[i - 1] === '*' ? '\\times' : '\\div'} ` : ''}${il(t)}`).join('');
function mdVal(ns: number[], ops: MD[], rightToLeft = false): Rational {
  if (rightToLeft) {
    let v = R(ns[ns.length - 1]!);
    for (let i = ns.length - 2; i >= 0; i--) v = ops[i] === '*' ? R(ns[i]!).mul(v) : R(ns[i]!).div(v);
    return v;
  }
  return ns.slice(1).reduce((acc, t, i) => (ops[i] === '*' ? acc.mul(t) : acc.div(t)), R(ns[0]!));
}
/** A chain of × and ÷ whose every step is a whole number. */
function mdChain(rng: Rng, n: number, first: number): { ns: number[]; ops: MD[] } {
  const ns = [first];
  const ops: MD[] = [];
  let acc = first;
  for (let i = 1; i < n; i++) {
    const divs = [2, 3, 4, 5, 6, 7, 8, 9].filter((k) => acc % k === 0 && Math.abs(acc) > k);
    if (divs.length && rng.chance(0.55)) {
      const k = rng.pick(divs) * (rng.chance(0.5) ? -1 : 1);
      ops.push('/');
      ns.push(k);
      acc /= k;
    } else {
      const k = rng.signed(2, 6);
      ops.push('*');
      ns.push(k);
      acc *= k;
    }
  }
  return { ns, ops };
}

function mulDivQ(ns: number[], ops: MD[], prompt: Block[], o: { unit?: string; pre?: Block[] } = {}): Draft {
  const ans = mdVal(ns, ops);
  const run: { text: string; math?: string }[] = [];
  let acc = R(ns[0]!);
  for (let i = 1; i < ns.length; i++) {
    const b = ns[i]!;
    const nx = ops[i - 1] === '*' ? acc.mul(b) : acc.div(b);
    const same = acc.cmp(0) < 0 === b < 0;
    run.push({ text: `${ops[i - 1] === '*' ? 'Multiply' : 'Divide'}: ${same ? 'same signs, so the result is positive' : 'different signs, so the result is negative'}.`, math: `${il(acc.toNumber())} ${ops[i - 1] === '*' ? '\\times' : '\\div'} ${il(b)} = ${nx.toString()}` });
    acc = nx;
  }
  const negs = ns.filter((x) => x < 0).length;
  if (ns.length > 2) run.push({ text: `Check: there ${negs === 1 ? 'is 1 negative number' : `are ${negs} negative numbers`}, an ${negs % 2 ? 'odd' : 'even'} count, so the answer is ${negs % 2 ? 'negative' : 'positive'}.` });
  const rtl = ops.length > 1 ? mdVal(ns, ops, true) : null;
  return numeric(prompt, ans, {
    hints: ['Work with the sizes first, as if there were no signs.', ns.length > 2 ? 'Work from left to right. Then count the negative numbers: an even count gives a positive answer, an odd count a negative one.' : 'Same signs give a positive answer; different signs give a negative answer.'],
    solution: [...(o.pre ?? []), steps(...run)],
    unit: o.unit,
    accept: ['integer'],
    knownWrong: wrongs(ans, [
      [ans.neg(), MIS.intSignRule.id],
      [rtl && rtl.isInteger() ? rtl : null, MIS.orderLtr.id],
    ]),
    params: { kind: 'md', ns, ops },
  });
}

export const integerMulDiv: SkillPack = {
  id: 'int-muldiv',
  title: 'Multiplying and dividing integers',
  subject: 'math',
  expectations: [{ id: `${G8}:B2.7`, note: 'Multiplies and divides integers: sign rules (recognised and applied), products and quotients, chains of several factors, and temperature, diving and averaging contexts.' }],
  prerequisites: ['int-addsub'],
  goal: 'I can multiply and divide integers and decide the sign of the answer.',
  explain: (c) => [
    p('Multiply or divide the numbers as if they had no signs. Then decide the sign:'),
    { kind: 'table', header: ['Signs', 'Answer', 'Example'], rows: [['same (+ and +, or − and −)', 'positive', '$$(-4) \\times (-5) = 20$$'], ['different (+ and −)', 'negative', '$$(-20) \\div 5 = -4$$']] },
    p('Why? $$3 \\times (-4)$$ is three groups of −4: $$(-4) + (-4) + (-4) = -12$$. Multiplying by a negative reverses the direction, so $$(-3) \\times (-4) = 12$$.'),
    p('With more than two numbers, count the negatives: an **even** number of negatives gives a positive answer, an **odd** number gives a negative answer.'),
    c.simple ? tip('Same signs: plus. Different signs: minus.') : tip('Division follows the same sign rules as multiplication, because they undo each other: $$(-12) \\div (-3) = 4$$ since $$4 \\times (-3) = -12$$.'),
  ],
  alternatives: () => ({
    simpler: [p('Ignore the signs and multiply. Then: two of the same sign make a positive; one of each makes a negative.')],
    steps: [p('Calculate $$(-6) \\times 3 \\div (-2)$$.'), steps({ text: 'Left to right: different signs give a negative.', math: '(-6) \\times 3 = -18' }, { text: 'Same signs give a positive.', math: '(-18) \\div (-2) = 9' })],
    visual: [intLine(0, [-4, -4, -4], true, 'A number line. Three jumps of −4 from 0 land on −12.'), p('$$3 \\times (-4)$$ is three jumps of −4: you land on −12.')],
    analogy: [p('If the temperature falls 2 degrees every hour, then 3 hours from now it will have changed by $$3 \\times (-2) = -6$$ degrees. 3 hours ago it was 6 degrees warmer: $$(-3) \\times (-2) = +6$$.')],
    compare: [p('You already know $$4 \\times 5 = 20$$ and $$20 \\div 5 = 4$$. With integers the numbers are the same; only the sign needs one more decision.')],
  }),
  example: (rng) => {
    const a = -rng.int(2, 9);
    const b = -rng.int(2, 9);
    return [p(`Calculate $$${il(a)} \\times ${il(b)}$$.`), steps({ text: 'Multiply the sizes.', math: `${-a} \\times ${-b} = ${a * b}` }, { text: 'Both numbers are negative (same signs), so the answer is positive.', math: `${il(a)} \\times ${il(b)} = ${a * b}` })];
  },
  generate: (rng, d) => {
    if (d === 1) {
      const a = rng.signed(2, 12);
      const b = rng.signed(2, 12);
      const isDiv = rng.chance(0.4);
      const ns = isDiv ? [a * b, b] : [a, b];
      const ops: MD[] = [isDiv ? '/' : '*'];
      const val = mdVal(ns, ops).toNumber();
      if (rng.chance(0.5)) {
        const right = val > 0 ? 'Positive' : 'Negative';
        return choice(rng, [p(`Without calculating, decide: is the answer to $$${mdTex(ns, ops)}$$ positive or negative?`)], right, [{ text: val > 0 ? 'Negative' : 'Positive', misconception: MIS.intSignRule.id }], {
          hints: ['Look only at the signs of the two numbers.', 'Same signs give a positive answer; different signs give a negative answer.'],
          solution: [p(`The signs are ${ns[0]! < 0 === ns[1]! < 0 ? 'the same' : 'different'}, so the answer is ${right.toLowerCase()}: $$${mdTex(ns, ops)} = ${val}$$.`)],
          params: { kind: 'sign', ns, ops },
        });
      }
      const shown = rng.chance(0.5) ? val : -val;
      return trueFalse([p('True or false?'), m(`${mdTex(ns, ops)} = ${shown}`)], shown === val, {
        hints: ['Work out the size first, then the sign.', 'Same signs give a positive answer; different signs give a negative answer.'],
        solution: [m(`${mdTex(ns, ops)} = ${val}`), p(shown === val ? 'The statement is **true**.' : `The statement says ${sn(shown)}, so it is **false**.`)],
        misconception: MIS.intSignRule.id,
        params: { kind: 'tf', ns, ops, shown },
      });
    }
    if (d === 2) {
      const a = rng.signed(2, 12);
      const b = rng.signed(2, 12);
      if (rng.chance(0.5)) return mulDivQ([a, b], ['*'], [p('Calculate.'), m(mdTex([a, b], ['*']))]);
      return mulDivQ([a * b, b], ['/'], [p('Calculate.'), m(mdTex([a * b, b], ['/']))]);
    }
    if (d === 3) {
      const kind = rng.pick(['cool', 'dive', 'avg', 'chain', 'chain'] as const);
      if (kind === 'cool') {
        const k = rng.int(2, 6);
        const h = rng.int(3, 8);
        return mulDivQ([h, -k], ['*'], [p(`During a cold front the temperature fell ${k}°C every hour for ${h} hours. What was the total change in temperature? (A fall is a negative change.)`)], { unit: '°C', pre: [p(`${h} hours of a change of $$-${k}$$ each: $$${h} \\times (-${k})$$.`)] });
      }
      if (kind === 'dive') {
        const k = rng.int(2, 9);
        const t = rng.int(3, 12);
        return mulDivQ([t, -k], ['*'], [p(`A diver goes down ${k} m every minute. Where is the diver after ${t} minutes, compared with the surface? Use a negative number for below the surface.`)], { unit: 'm', pre: [p(`${t} minutes of $$-${k}$$ m each: $$${t} \\times (-${k})$$.`)] });
      }
      if (kind === 'avg') {
        const per = rng.int(2, 9);
        const n = rng.int(3, 7);
        return mulDivQ([-per * n, n], ['/'], [p(`Over ${n} days the water level in a pond changed by a total of ${sn(-per * n)} mm. It changed by the same amount each day. What was the change per day?`)], { unit: 'mm', pre: [p(`Share the total change equally over ${n} days: $$${il(-per * n)} \\div ${n}$$.`)] });
      }
      const { ns, ops } = mdChain(rng, 3, rng.signed(2, 9) * rng.int(2, 6));
      return mulDivQ(ns, ops, [p('Calculate. Work from left to right.'), m(mdTex(ns, ops))]);
    }
    const { ns, ops } = mdChain(rng, 4, rng.signed(2, 9) * rng.int(2, 9));
    return mulDivQ(ns, ops, [p('Calculate. Work from left to right.'), m(mdTex(ns, ops))]);
  },
  selfCheck: (q) => {
    const pr = prm(q);
    const ns = nums(pr.ns);
    const ops = Array.isArray(pr.ops) ? pr.ops.map(String) : [];
    let v = ns[0] ?? NaN;
    ops.forEach((op, i) => (v = op === '*' ? v * ns[i + 1]! : v / ns[i + 1]!));
    if (pr.kind === 'sign') return rightText(q) === (v > 0 ? 'Positive' : 'Negative') ? null : 'sign choice is wrong';
    if (pr.kind === 'tf') return q.type === 'true_false' && q.answer === (Math.abs(v - Number(pr.shown)) < 1e-9) ? null : 'true/false key is wrong';
    return near(q, v);
  },
  summary: ['Multiply or divide the sizes, then decide the sign.', 'Same signs give a positive answer; different signs give a negative answer.', 'With several numbers, an even count of negatives is positive and an odd count is negative.'],
  misconceptions: [MIS.intSignRule, MIS.orderLtr],
};

// ═════════════════════════ Order of operations ═════════════════════════

type Op = '+' | '-' | '*' | '/';
type Item = { k: 'n'; v: Rational } | { k: 'b'; l: Lv } | { k: 'p'; base: Item; e: number };
interface Lv {
  items: Item[];
  ops: Op[];
}
type Style = 'dec' | 'frac';
const isOp = (x: unknown): x is Op => x === '+' || x === '-' || x === '*' || x === '/';
const asItem = (x: Item | number | Rational): Item => (typeof x === 'number' || x instanceof Rational ? { k: 'n', v: Rational.of(x) } : x);
function X(...parts: (Item | Op | number | Rational)[]): Lv {
  const items: Item[] = [];
  const ops: Op[] = [];
  for (const part of parts) {
    if (isOp(part)) ops.push(part);
    else items.push(asItem(part));
  }
  return { items, ops };
}
const Bk = (...parts: (Item | Op | number | Rational)[]): Item => ({ k: 'b', l: X(...parts) });
const Pw = (base: Item | number | Rational, e: number): Item => ({ k: 'p', base: asItem(base), e });

const apply = (a: Rational, op: Op, b: Rational) => (op === '+' ? a.add(b) : op === '-' ? a.sub(b) : op === '*' ? a.mul(b) : a.div(b));
interface Mode {
  ltr?: boolean;
  powMul?: boolean;
}
function itemVal(it: Item, mode: Mode): Rational {
  if (it.k === 'n') return it.v;
  if (it.k === 'b') return lvVal(it.l, mode);
  const b = itemVal(it.base, mode);
  return mode.powMul ? b.mul(it.e) : b.pow(it.e);
}
function lvVal(l: Lv, mode: Mode = {}): Rational {
  const vals = l.items.map((i) => itemVal(i, mode));
  if (mode.ltr) return vals.slice(1).reduce((acc, v, i) => apply(acc, l.ops[i]!, v), vals[0]!);
  const terms: Rational[] = [vals[0]!];
  const addOps: Op[] = [];
  l.ops.forEach((op, i) => {
    const v = vals[i + 1]!;
    if (op === '*' || op === '/') terms[terms.length - 1] = apply(terms[terms.length - 1]!, op, v);
    else {
      addOps.push(op);
      terms.push(v);
    }
  });
  return terms.slice(1).reduce((acc, v, i) => apply(acc, addOps[i]!, v), terms[0]!);
}
const safe = (f: () => Rational): Rational | null => {
  try {
    return f();
  } catch {
    return null;
  }
};
/** The same expression with its (non-power) brackets removed: the “ignored the brackets” mistake. */
function unbracket(l: Lv): Lv {
  const items: Item[] = [];
  const ops: Op[] = [];
  l.items.forEach((it, i) => {
    if (i > 0) ops.push(l.ops[i - 1]!);
    if (it.k === 'b') {
      const inner = unbracket(it.l);
      items.push(...inner.items);
      ops.push(...inner.ops);
    } else items.push(it);
  });
  return { items, ops };
}
const hasKind = (l: Lv, k: 'b' | 'p'): boolean => l.items.some((it) => it.k === k || (it.k === 'b' && hasKind(it.l, k)) || (it.k === 'p' && it.base.k === 'b' && (k === 'b' || hasKind(it.base.l, k))));

function numTex(v: Rational, style: Style, wrap = true): string {
  const a = v.abs();
  const asDec = a.isInteger() || (style === 'dec' && a.toDecimal(6) !== null);
  const body = asDec ? nl(a) : a.toLatex();
  if (v.cmp(0) >= 0) return body;
  if (!wrap) return `-${body}`;
  return asDec ? `(-${body})` : `\\left(-${body}\\right)`;
}
function itemTex(it: Item, style: Style): string {
  if (it.k === 'n') return numTex(it.v, style);
  if (it.k === 'b') return `\\left(${lvTex(it.l, style)}\\right)`;
  const b = it.base;
  const base = b.k === 'n' && b.v.cmp(0) > 0 && !(style === 'frac' && !b.v.isInteger()) ? numTex(b.v, style) : b.k === 'n' ? `\\left(${numTex(b.v, style, false)}\\right)` : itemTex(b, style);
  return `${base}^{${it.e}}`;
}
const OP_TEX: Record<Op, string> = { '+': '+', '-': '-', '*': '\\times', '/': '\\div' };
function lvTex(l: Lv, style: Style): string {
  if (l.items.length === 1 && l.items[0]!.k === 'n') return numTex(l.items[0]!.v, style, false);
  return l.items.map((it, i) => `${i ? ` ${OP_TEX[l.ops[i - 1]!]} ` : ''}${itemTex(it, style)}`).join('');
}
function itemAscii(it: Item): string {
  if (it.k === 'n') {
    const s = it.v.toDecimal(8) ?? it.v.toString();
    return it.v.cmp(0) < 0 || !it.v.isInteger() ? `(${s})` : s;
  }
  if (it.k === 'b') return `(${lvAscii(it.l)})`;
  return `${itemAscii(it.base)}^${it.e}`;
}
const lvAscii = (l: Lv): string => l.items.map((it, i) => `${i ? ` ${l.ops[i - 1]} ` : ''}${itemAscii(it)}`).join('');

type StepKind = 'E' | 'MD' | 'AS';
const STEP_TEXT: Record<StepKind, string> = { E: 'Evaluate the power.', MD: 'Multiply or divide, from left to right.', AS: 'Add or subtract, from left to right.' };
const single = (l: Lv): Item | null => (l.items.length === 1 && l.items[0]!.k === 'n' ? l.items[0]! : null);
function combine(l: Lv, i: number): Lv {
  const a = l.items[i]!;
  const b = l.items[i + 1]!;
  if (a.k !== 'n' || b.k !== 'n') throw new Error('combine needs numbers');
  const v = apply(a.v, l.ops[i]!, b.v);
  return { items: [...l.items.slice(0, i), { k: 'n', v }, ...l.items.slice(i + 2)], ops: [...l.ops.slice(0, i), ...l.ops.slice(i + 1)] };
}
/** One BEDMAS step: the innermost brackets first, then powers, then × ÷, then + −. */
function stepLv(l: Lv): { l: Lv; kind: StepKind; inBr: boolean } | null {
  if (single(l)) return null;
  for (let i = 0; i < l.items.length; i++) {
    const it = l.items[i]!;
    const inner = it.k === 'b' ? it.l : it.k === 'p' && it.base.k === 'b' ? it.base.l : null;
    if (!inner) continue;
    const s = stepLv(inner);
    const nl2 = s ? s.l : inner;
    const done = single(nl2);
    const wrapped: Item = done ?? { k: 'b', l: nl2 };
    const repl: Item = it.k === 'p' ? { k: 'p', base: wrapped, e: it.e } : wrapped;
    return { l: { items: l.items.map((x, j) => (j === i ? repl : x)), ops: l.ops }, kind: s?.kind ?? 'AS', inBr: true };
  }
  const pi = l.items.findIndex((it) => it.k === 'p' && it.base.k === 'n');
  if (pi >= 0) {
    const it = l.items[pi]! as Extract<Item, { k: 'p' }>;
    const v = (it.base as Extract<Item, { k: 'n' }>).v.pow(it.e);
    return { l: { items: l.items.map((x, j) => (j === pi ? { k: 'n', v } : x)), ops: l.ops }, kind: 'E', inBr: false };
  }
  const mi = l.ops.findIndex((o) => o === '*' || o === '/');
  if (mi >= 0) return { l: combine(l, mi), kind: 'MD', inBr: false };
  return { l: combine(l, 0), kind: 'AS', inBr: false };
}
function bedmasSteps(l0: Lv, style: Style): { text: string; math?: string }[] {
  const out: { text: string; math?: string }[] = [{ text: 'Start with the expression.', math: lvTex(l0, style) }];
  let l = l0;
  for (let guard = 0; guard < 20; guard++) {
    const s = stepLv(l);
    if (!s) break;
    l = s.l;
    out.push({ text: s.inBr ? `Brackets first. Inside them: ${STEP_TEXT[s.kind].toLowerCase()}` : STEP_TEXT[s.kind], math: `= ${lvTex(l, style)}` });
  }
  return out;
}

interface OpsTemplate {
  l: Lv;
  style: Style;
  text?: string;
  unit?: string;
  money?: boolean;
}

function opsQ(t: OpsTemplate): Draft {
  const ans = lvVal(t.l);
  const st = bedmasSteps(t.l, t.style);
  const first = stepLv(t.l);
  const frac = t.style === 'frac';
  const prompt = t.text ? [p(t.text)] : [p(`Calculate.${frac ? ' Give your answer as an integer or a fraction in simplest form (a mixed number is fine).' : ''}`), m(lvTex(t.l, t.style))];
  return numeric(prompt, ans, {
    hints: [t.text ? 'Write one expression for the whole situation first, with brackets around any part that must be done first.' : 'Use BEDMAS: brackets, exponents, then × and ÷ from left to right, then + and − from left to right.', first ? `The first step: ${first.inBr ? 'work inside the brackets' : STEP_TEXT[first.kind].toLowerCase().replace(/\.$/, '')}.` : 'Simplify step by step.'],
    solution: [steps(...st), ...(t.money ? [p(`The answer is ${money(ans)}.`)] : [])],
    unit: t.unit,
    accept: frac ? ['integer', 'fraction', 'mixed', 'decimal'] : ['integer', 'decimal'],
    requireSimplest: frac,
    knownWrong: wrongs(ans, [
      [safe(() => lvVal(t.l, { ltr: true })), MIS.orderLtr.id],
      [hasKind(t.l, 'b') ? safe(() => lvVal(unbracket(t.l))) : null, MIS.orderBrackets.id],
      [hasKind(t.l, 'p') ? safe(() => lvVal(t.l, { powMul: true })) : null, MIS.expMultiply.id],
    ]),
    params: { kind: 'ops', src: lvAscii(t.l), frac },
  });
}

const cents = (c: number) => R(c, 100);

function opsTemplate(rng: Rng, d: number, grade: number): OpsTemplate {
  const r = rng;
  const name = r.pick(NAMES);
  if (grade >= 8 && d >= 2) {
    if (d === 2) {
      return r.pick([
        () => ({ l: X(-r.int(2, 15), '+', r.int(2, 9), '*', -r.int(2, 9)), style: 'dec' as Style }),
        () => {
          const b = r.signed(1, 9);
          let c = r.signed(1, 9);
          if (b === c) c = b === 9 ? -9 : b + 1;
          const k = r.signed(1, 6);
          return { l: X((b - c) * k, '/', Bk(b, '-', c), '+', r.signed(1, 12)), style: 'dec' as Style };
        },
        () => ({ l: X(r.signed(2, 15), '-', -r.int(2, 9), '*', r.int(2, 6)), style: 'dec' as Style }),
      ])();
    }
    if (d === 3) {
      return r.pick([
        () => ({ l: X(Pw(-r.int(2, 3), r.pick([2, 3])), '+', r.int(2, 9), '*', -r.int(2, 6)), style: 'dec' as Style }),
        () => {
          const a = r.int(2, 12);
          let b = r.int(1, 12);
          if (b === a) b++;
          const s = (b - a) ** 2;
          const divs = [2, 3, 4, 5, 6, 8, 9, 10, 12].filter((k) => s % k === 0);
          const c = divs.length ? r.pick(divs) : Math.abs(b - a);
          return { l: X(Pw(Bk(-a, '+', b), 2), '/', -c), style: 'dec' as Style };
        },
        () => {
          const ts = [r.int(-15, 5), r.int(-15, 5), r.int(-15, 5), r.int(-15, 5)];
          const s = ts.reduce((a, b) => a + b, 0);
          ts[3] = ts[3]! - (((s % 4) + 4) % 4);
          const city = r.pick(COLD);
          return {
            l: X(Bk(ts[0]!, '+', ts[1]!, '+', ts[2]!, '+', ts[3]!), '/', 4),
            style: 'dec' as Style,
            text: `The noon temperatures in ${city} on four days were ${ts.map((x) => `${sn(x)}°C`).join(', ')}. What was the mean (average) noon temperature?`,
            unit: '°C',
          };
        },
      ])();
    }
    return r.pick([
      () => ({ l: X(R(-r.int(1, 3), r.pick([2, 4])), '+', R(r.pick([1, 3]), 4), '*', -r.int(2, 4)), style: 'frac' as Style }),
      () => ({ l: X(R(-(r.int(1, 4) * 10 + 5), 10), '*', r.int(2, 6), '-', Pw(R(r.int(1, 3) * 10 + 5, 10), 2)), style: 'dec' as Style }),
      () => {
        const [a, b] = r.pick([
          [2, 3],
          [1, 2],
          [3, 4],
          [1, 3],
        ] as const);
        const [c, dd] = r.pick([
          [5, 6],
          [7, 8],
          [5, 12],
        ] as const);
        return { l: X(Bk(R(a, b), '-', R(c, dd)), '/', R(-1, r.pick([2, 3, 4]))), style: 'frac' as Style };
      },
    ])();
  }
  if (d <= 1) {
    return r.pick([
      () => ({ l: X(r.int(2, 20), '+', r.int(2, 9), '*', r.int(2, 9)), style: 'dec' as Style }),
      () => {
        const c = r.int(2, 9);
        const k = r.int(2, 9);
        return { l: X(r.int(k + 1, 30), '-', c * k, '/', c), style: 'dec' as Style };
      },
      () => ({ l: X(r.int(2, 9), '*', r.int(2, 9), '+', r.int(2, 9), '*', r.int(2, 9)), style: 'dec' as Style }),
    ])();
  }
  if (d === 2) {
    return r.pick([
      () => {
        const a = r.int(2, 9);
        const b = r.int(2, 9);
        const c = r.int(2, 6);
        return { l: X(Bk(a, '+', b), '*', c, '-', r.int(1, (a + b) * c - 1)), style: 'dec' as Style };
      },
      () => ({ l: X(r.int(2, 20), '+', Pw(r.int(2, 5), 2), '*', r.int(2, 6)), style: 'dec' as Style }),
      () => {
        const c = r.int(1, 5);
        return { l: X(r.int(2, 6), '*', Pw(Bk(c + r.int(1, 5), '-', c), 2)), style: 'dec' as Style };
      },
      () => ({ l: X(R(r.int(11, 49), 10), '+', R(r.int(11, 29), 10), '*', r.int(2, 6)), style: 'dec' as Style }),
    ])();
  }
  if (d === 3) {
    return r.pick([
      () => {
        const n1 = r.int(2, 5);
        const p1 = r.int(25, 79) * 5;
        const n2 = r.int(2, 4);
        const p2 = r.int(15, 50) * 5;
        const total = n1 * p1 + n2 * p2;
        const pay = total < 2000 ? 20 : 50;
        return {
          l: X(pay, '-', Bk(n1, '*', cents(p1), '+', n2, '*', cents(p2))),
          style: 'dec' as Style,
          money: true,
          text: `${name} buys ${n1} notebooks at ${money(cents(p1))} each and ${n2} pens at ${money(cents(p2))} each, and pays with a $${pay} bill. How much change should ${name} get? Give your answer in dollars.`,
        };
      },
      () => {
        const f = r.int(3, 6);
        const pizza = r.int(24, 40);
        const k = r.int(Math.ceil((pizza * 100 + 400) / f), Math.floor((pizza * 100 + 1200) / f));
        const drinks = f * k - pizza * 100;
        return {
          l: X(Bk(pizza, '+', cents(drinks)), '/', f),
          style: 'dec' as Style,
          money: true,
          text: `${f} friends order a pizza for ${money(R(pizza))} and drinks for ${money(cents(drinks))}. They share the total cost equally. How much does each person pay? Give your answer in dollars.`,
        };
      },
      () => {
        const rate = r.pick([1250, 1325, 1450, 1575, 1600, 1725]);
        const h1 = r.int(2, 5);
        const h2 = r.int(2, 5);
        const gift = r.int(1000, 3500) + r.pick([0, 25, 50, 75]);
        return {
          l: X(cents(rate), '*', Bk(h1, '+', h2), '-', cents(gift)),
          style: 'dec' as Style,
          money: true,
          text: `${name} earns ${money(cents(rate))} an hour. ${name} works ${h1} hours on Saturday and ${h2} hours on Sunday, then spends ${money(cents(gift))} on a gift. How much of the money earned is left? Give your answer in dollars.`,
        };
      },
    ])();
  }
  return r.pick([
    () => ({ l: X(R(1, r.pick([2, 3, 4])), '+', R(r.int(1, 3), 4), '*', R(r.int(1, 2), 3)), style: 'frac' as Style }),
    () => {
      const [a, b] = r.pick([
        [2, 3],
        [3, 4],
        [5, 6],
      ] as const);
      return { l: X(Bk(R(a, b), '-', R(1, 2)), '/', R(1, r.pick([3, 4, 6]))), style: 'frac' as Style };
    },
    () => ({ l: X(Pw(R(r.int(1, 2), 3), 2), '+', R(r.pick([1, 5]), 6), '*', r.int(2, 4)), style: 'frac' as Style }),
    () => ({ l: X(Pw(R(5, 10), 2), '*', r.pick([4, 8, 12]), '+', R(r.int(2, 8) * 4, 10), '/', 4), style: 'dec' as Style }),
  ])();
}

export const orderOfOperations: SkillPack = {
  id: 'order-ops',
  title: 'Order of operations',
  subject: 'math',
  expectations: [
    {
      id: `${G7}:B2.1`,
      note: 'Uses the order of operations (BEDMAS) in multi-step calculations with whole numbers, decimal numbers and fractions, including money problems that need brackets. The ratio, rate and percent parts of this expectation are practised in the ratio packs, and naming the properties of operations is explained but not assessed.',
    },
    {
      id: `${G8}:B2.1`,
      note: 'Uses the order of operations in multi-step calculations with integers and other rational numbers (negative fractions and decimals, powers of negative numbers, a mean temperature). Ratio, rate and percent problems are covered by the ratio packs.',
      levels: [2, 3, 4],
    },
  ],
  prerequisites: [],
  goal: 'I can follow the order of operations to calculate an expression with several operations.',
  explain: (c) => [
    p('When an expression has more than one operation, everyone follows the same order so they get the same answer. **BEDMAS** helps you remember it:'),
    { kind: 'table', header: ['Letter', 'Step'], rows: [['B', 'Brackets'], ['E', 'Exponents (powers)'], ['D M', 'Division and Multiplication, from left to right'], ['A S', 'Addition and Subtraction, from left to right']] },
    steps({ text: 'Brackets first.', math: '2 + 3 \\times (4 + 1)^2 = 2 + 3 \\times 5^2' }, { text: 'Then the exponent.', math: '= 2 + 3 \\times 25' }, { text: 'Then multiply.', math: '= 2 + 75' }, { text: 'Then add.', math: '= 77' }),
    warn('Multiplication does not always come before division, and addition does not always come before subtraction. Each pair is done from left to right: $$12 \\div 3 \\times 2 = 4 \\times 2 = 8$$.'),
    ...(c.grade >= 8 ? [p('The same order works for integers and fractions. Keep track of signs at each step: $$(-2)^3 = -8$$ but $$(-2)^2 = 4$$.')] : []),
    c.simple ? tip('Brackets, then powers, then × and ÷, then + and −.') : tip('Write each step on a new line and change only one operation at a time. It makes mistakes easy to find.'),
  ],
  alternatives: () => ({
    simpler: [p('Do brackets first. Then powers. Then times and divide, left to right. Then plus and minus, left to right.')],
    steps: [p('Calculate $$20 - 4 \\times 3$$.'), steps({ text: 'Multiply first.', math: '4 \\times 3 = 12' }, { text: 'Then subtract.', math: '20 - 12 = 8' }), p('Working left to right would give $$16 \\times 3 = 48$$, which is wrong.')],
    analogy: [p('Buying 3 juice boxes at $2 each with $20: you work out the cost first (3 × 2 = 6), then subtract it from 20. That is why $$20 - 3 \\times 2 = 14$$, not $$17 \\times 2$$.')],
    compare: [p('Getting dressed has an order too: socks before shoes. In maths, the agreed order is brackets, exponents, × and ÷, then + and −.')],
  }),
  example: (rng, c) => {
    const t = opsTemplate(rng, 2, c.grade);
    return [p('Calculate.'), m(lvTex(t.l, t.style)), steps(...bedmasSteps(t.l, t.style))];
  },
  generate: (rng, d, c) => {
    for (let i = 0; i < 20; i++) {
      const t = opsTemplate(rng, d, c.grade);
      const v = safe(() => lvVal(t.l));
      if (!v) continue;
      if (c.grade < 8 && v.cmp(0) < 0) continue;
      if (t.style === 'dec' && v.toDecimal(6) === null) continue;
      return opsQ(t);
    }
    return opsQ({ l: X(12, '+', 3, '*', 4), style: 'dec' });
  },
  selfCheck: (q) => {
    const pr = prm(q);
    const key = keyR(q);
    if (!key) return 'key is not a number';
    if (q.type === 'numeric' && !pr.frac && q.answer.includes('/')) return 'decimal question has a fraction key';
    try {
      const v = evaluate(parseExpr(String(pr.src)), {});
      return v.eq(key) ? null : `parser gives ${v.toString()}, key is ${key.toString()}`;
    } catch {
      return 'expression does not parse';
    }
  },
  summary: ['BEDMAS: Brackets, Exponents, Division and Multiplication, Addition and Subtraction.', '× and ÷ are done together from left to right; so are + and −.', 'Change one operation at a time and write each step on a new line.'],
  misconceptions: [MIS.orderLtr, MIS.orderBrackets, MIS.expMultiply],
};

// ═════════════════════════ Squares and square roots ═════════════════════════

function isqrt(n: bigint): bigint {
  if (n < 2n) return n < 0n ? 0n : n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) x -= 1n;
  while ((x + 1n) * (x + 1n) <= n) x += 1n;
  return x;
}
/** √s rounded to `places` decimal places (half up), computed exactly. */
function sqrtRound(s: Rational, places = 1): Rational {
  const scale = pow10(places);
  let r = isqrt((s.n * scale * scale) / s.d);
  if (4n * s.n * scale * scale >= (2n * r + 1n) ** 2n * s.d) r += 1n;
  return new Rational(r, scale);
}
/** √n cut off after `places` decimals, for showing "7.0710…" in a worked solution. */
const sqrtTrunc = (n: number, places: number) => new Rational(isqrt(BigInt(n) * pow10(2 * places)), pow10(places));
const NON_SQUARES = Array.from({ length: 199 }, (_, i) => i + 2).filter((n) => Math.sqrt(n) % 1 !== 0);
const sqArea = (k: number): Block => ({ kind: 'diagram', diagram: { type: 'area_model', rows: k, cols: k, shadedRows: k, shadedCols: k }, alt: `A ${k} by ${k} square made of ${k * k} unit squares.` });

function squareRootQ(n: number, prompt: Block[], o: { unit?: string; zeros?: boolean } = {}): Draft {
  const k = Math.round(Math.sqrt(n));
  const ans = R(Number(isqrt(BigInt(n))));
  return numeric(prompt, ans, {
    hints: ['Which number, multiplied by itself, gives this number?', o.zeros ? 'Split off the zeros in pairs: each pair of zeros under the root gives one zero in the answer.' : `Try numbers close to ${Math.max(1, k - 2)} and multiply each by itself.`],
    solution: [m(`${k} \\times ${k} = ${nl(n)} \\quad \\text{so} \\quad \\sqrt{${nl(n)}} = ${k}`)],
    unit: o.unit,
    accept: ['integer'],
    knownWrong: wrongs(ans, [[n % 2 === 0 ? R(n / 2) : null, MIS.rootHalf.id], ...(o.zeros ? ([[R(k * 10), MIS.rootZeros.id], [R(k / 10), MIS.rootZeros.id]] as Wrong[]) : [])]),
    params: { kind: 'root', n },
  });
}
function squareQ(k: number, prompt: Block[], o: { unit?: string } = {}): Draft {
  return numeric(prompt, R(k * k), {
    hints: ['Squaring means multiplying a number by itself.', `Work out $$${k} \\times ${k}$$.`],
    solution: [m(`${k}^2 = ${k} \\times ${k} = ${nl(k * k)}`)],
    unit: o.unit,
    accept: ['integer'],
    knownWrong: wrongs(R(k * k), [
      [R(2 * k), MIS.squareDouble.id],
      [k % 10 === 0 ? R((k * k) / 10) : null, MIS.rootZeros.id],
    ]),
    params: { kind: 'square', k },
  });
}

export const squaresRoots: SkillPack = {
  id: 'squares-roots',
  title: 'Perfect squares and square roots',
  subject: 'math',
  expectations: [
    { id: `${G7}:B1.2`, note: 'Identifies perfect squares, squares whole numbers and finds square roots of perfect squares, including the side length of a square from its area. Square arrays appear in explanations.', levels: [1, 2, 3] },
    { id: `${G8}:B2.2`, note: 'Recalls common square numbers and their square roots, including perfect squares ending in pairs of zeros (900, 4900, 90 000).', levels: [1, 2] },
    { id: `${G8}:B1.3`, note: 'Estimates square roots of non-perfect squares between two consecutive whole numbers, calculates them to the nearest tenth with a calculator (as instructed in the question), and compares a square root with a decimal by squaring.', levels: [2, 3, 4] },
  ],
  prerequisites: [],
  goal: 'I can find squares and square roots, and estimate the square root of a number that is not a perfect square.',
  explain: (c) => [
    p('A **perfect square** is a whole number multiplied by itself. 9 is a perfect square because $$3 \\times 3 = 9$$, written $$3^2 = 9$$. Its dots make a square: 3 rows of 3.'),
    p('The **square root** undoes squaring. $$\\sqrt{9} = 3$$ because $$3^2 = 9$$. If a square has an area of 9 cm², each side is $$\\sqrt{9} = 3$$ cm.'),
    { kind: 'table', header: ['n', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], rows: [['n²', '1', '4', '9', '16', '25', '36', '49', '64', '81', '100', '121', '144']] },
    ...(c.grade >= 8
      ? [
          p('Pairs of zeros: $$30^2 = 900$$ and $$300^2 = 90\\,000$$, so $$\\sqrt{900} = 30$$ and $$\\sqrt{90\\,000} = 300$$.'),
          p('For a number that is not a perfect square, find the perfect squares on either side. $$\\sqrt{8}$$ is between $$\\sqrt{4} = 2$$ and $$\\sqrt{9} = 3$$, and closer to 3 because 8 is closer to 9. A calculator gives $$\\sqrt{8} \\approx 2.83$$.'),
        ]
      : []),
    c.simple ? tip('Square: times itself. Square root: what times itself makes this?') : tip('Check a square root by squaring your answer: you should get back the number under the root sign.'),
  ],
  alternatives: () => ({
    simpler: [p('$$5^2$$ means 5 × 5 = 25. $$\\sqrt{25}$$ asks “what times itself is 25?” The answer is 5.')],
    visual: [sqArea(4), p('16 unit squares fit in a 4 by 4 square, so $$4^2 = 16$$ and $$\\sqrt{16} = 4$$.')],
    analogy: [p('A square patio uses 36 square paving stones. To know how many stones go along each edge, you need the number that times itself makes 36: 6.')],
    steps: [p('Estimate $$\\sqrt{50}$$.'), steps({ text: 'Find the perfect squares on either side.', math: '49 < 50 < 64' }, { text: 'Take their square roots.', math: '7 < \\sqrt{50} < 8' }, { text: '50 is very close to 49, so the root is just over 7.', math: '\\sqrt{50} \\approx 7.1' })],
  }),
  example: (rng, c) => {
    if (c.expectationId.endsWith('B1.3')) {
      const n = rng.pick(NON_SQUARES.filter((x) => x < 100));
      const lo = Number(isqrt(BigInt(n)));
      return [p(`Between which two whole numbers is $$\\sqrt{${n}}$$?`), steps({ text: 'Find the perfect squares on either side.', math: `${lo * lo} < ${n} < ${(lo + 1) ** 2}` }, { text: 'Take square roots.', math: `${lo} < \\sqrt{${n}} < ${lo + 1}` })];
    }
    const k = rng.int(4, 12);
    return [p(`A square has an area of ${k * k} cm². How long is each side?`), sqArea(k), steps({ text: 'The side length is the square root of the area.', math: `\\sqrt{${k * k}}` }, { text: `${k} × ${k} = ${k * k}.`, math: `\\sqrt{${k * k}} = ${k}\\text{ cm}` })];
  },
  generate: (rng, d, c) => {
    const id = c.expectationId;
    if (id.endsWith('B1.3')) {
      if (d <= 2) {
        const n = rng.pick(NON_SQUARES.filter((x) => x > 10));
        const lo = Number(isqrt(BigInt(n)));
        const half = Math.floor(n / 2);
        return choice(rng, [p(`Between which two consecutive whole numbers is $$\\sqrt{${n}}$$?`)], `${lo} and ${lo + 1}`, [{ text: `${half} and ${half + 1}`, misconception: MIS.rootHalf.id }, { text: `${lo + 1} and ${lo + 2}` }, { text: `${lo - 1} and ${lo}` }], {
          hints: [`Which perfect squares are just below and just above ${n}?`, `$$${lo}^2 = ${lo * lo}$$ and $$${lo + 1}^2 = ${(lo + 1) ** 2}$$.`],
          solution: [m(`${lo * lo} < ${n} < ${(lo + 1) ** 2} \\quad \\Rightarrow \\quad ${lo} < \\sqrt{${n}} < ${lo + 1}`)],
          params: { kind: 'between', n },
        });
      }
      if (d === 3) {
        const n = rng.pick(NON_SQUARES.filter((x) => x > 10));
        const ans = sqrtRound(R(n), 1);
        const garden = rng.chance(0.5);
        const lo = Number(isqrt(BigInt(n)));
        return numeric(
          [p(garden ? `A square garden has an area of ${n} m². Use a calculator to find the length of each side, rounded to the nearest tenth of a metre.` : `Use a calculator to find $$\\sqrt{${n}}$$. Round to the nearest tenth.`)],
          ans,
          {
            hints: [`First estimate: $$\\sqrt{${n}}$$ is between ${lo} and ${lo + 1}.`, 'Press the square root key, then round to one decimal place.'],
            solution: [steps({ text: 'Estimate first.', math: `${lo} < \\sqrt{${n}} < ${lo + 1}` }, { text: 'Calculator, then round to the nearest tenth.', math: `\\sqrt{${n}} = ${nl(sqrtTrunc(n, 4))}\\ldots \\approx ${nl(ans)}` })],
            unit: garden ? 'm' : undefined,
            accept: ['integer', 'decimal'],
            knownWrong: wrongs(ans, [
              [R(n, 2), MIS.rootHalf.id],
              [new Rational(isqrt(BigInt(n) * 100n), 10n), MIS.roundDirection.id],
            ]),
            params: { kind: 'tenth', n },
          },
        );
      }
      if (rng.chance(0.5)) {
        const n = rng.pick(NON_SQUARES.filter((x) => x > 10));
        const est = sqrtRound(R(n), 1).add(R(rng.pick([-1, 1]), 10));
        const bigger = est.mul(est).cmp(n) > 0;
        return trueFalse([p('True or false? Decide without using the square root key.'), m(`\\sqrt{${n}} > ${nl(est)}`)], !bigger, {
          hints: ['Square the decimal and compare it with the number under the root.', `Work out $$${nl(est)} \\times ${nl(est)}$$.`],
          solution: [m(`${nl(est)}^2 = ${nl(est.mul(est))}`), p(bigger ? `${nl(est.mul(est))} is greater than ${n}, so $$${nl(est)} > \\sqrt{${n}}$$. The statement is **false**.` : `${nl(est.mul(est))} is less than ${n}, so $$\\sqrt{${n}} > ${nl(est)}$$. The statement is **true**.`)],
          misconception: MIS.rootEstimate.id,
          params: { kind: 'compare', n, est: est.toString() },
        });
      }
      const n = rng.pick(NON_SQUARES.filter((x) => x > 20));
      const exact = sqrtRound(R(n), 6);
      const ans = sqrtRound(R(16 * n), 1);
      const early = sqrtRound(R(n), 1).mul(4);
      return numeric([p(`A square play area has an area of ${n} m². What is its perimeter? Use a calculator and round your final answer to the nearest tenth of a metre.`)], ans, {
        hints: ['Find the side length first: it is the square root of the area.', 'The perimeter is 4 times the side length. Round only at the end.'],
        solution: [steps({ text: 'Side length.', math: `s = \\sqrt{${n}} = ${nl(sqrtTrunc(n, 4))}\\ldots\\text{ m}` }, { text: 'Perimeter: four equal sides. Round at the end.', math: `P = 4 \\times ${nl(sqrtTrunc(n, 4))}\\ldots = ${nl(truncTo(exact.mul(4), 3))}\\ldots \\approx ${nl(ans)}\\text{ m}` })],
        unit: 'm',
        accept: ['integer', 'decimal'],
        knownWrong: wrongs(ans, [
          [early, MIS.roundEarly.id],
        ]),
        params: { kind: 'perimeter', n },
      });
    }
    if (id.endsWith('B2.2') && d >= 2) {
      const k = rng.int(2, 9);
      const z = rng.pick([1, 2]);
      const sq = k * k * 100 ** z;
      const mode = rng.pick(['root', 'square', 'which'] as const);
      if (mode === 'root') return squareRootQ(sq, [p('Calculate.'), m(`\\sqrt{${nl(sq)}}`)], { zeros: true });
      if (mode === 'square') return squareQ(k * 10 ** z, [p('Calculate.'), m(`${k * 10 ** z}^2`)]);
      return choice(rng, [p('Which number is a perfect square?')], nt(k * k * 100), [{ text: nt(k * k * 10), misconception: MIS.rootZeros.id }, { text: nt(k * k * 1000), misconception: MIS.rootZeros.id }, { text: nt((k * k + 1) * 100) }], {
        hints: ['A perfect square that ends in zeros has them in pairs.', `Try $$${k * 10}^2$$.`],
        solution: [m(`${k * 10}^2 = ${k * 10} \\times ${k * 10} = ${nl(k * k * 100)}`), p(`${nt(k * k * 10)} and ${nt(k * k * 1000)} have an odd number of zeros after ${k * k}, so they are not perfect squares.`)],
        params: { kind: 'which', right: k * k * 100 },
      });
    }
    if (d === 1) {
      const k = rng.int(2, id.endsWith('B2.2') ? 15 : 12);
      return rng.chance(0.5) ? squareQ(k, [p('Calculate.'), m(`${k}^2`)]) : squareRootQ(k * k, [p('Calculate.'), m(`\\sqrt{${k * k}}`)]);
    }
    if (d === 2) {
      const k = rng.int(4, 15);
      if (rng.chance(0.4)) {
        return choice(rng, [p('Which number is a perfect square?')], String(k * k), [{ text: String(k * (k + 1)), misconception: MIS.squareRectangle.id }, { text: String((k - 1) * (k + 1)), misconception: MIS.squareRectangle.id }, { text: String(k * (k + 2)), misconception: MIS.squareRectangle.id }], {
          hints: ['A perfect square is a whole number multiplied by itself.', `Try $$${k - 1}^2$$, $$${k}^2$$ and $$${k + 1}^2$$.`],
          solution: [m(`${k} \\times ${k} = ${k * k}`), p(`The others are products of two different numbers, like $$${k} \\times ${k + 1} = ${k * (k + 1)}$$, which make rectangles, not squares.`)],
          params: { kind: 'which', right: k * k },
        });
      }
      return rng.chance(0.5) ? squareQ(k, [p('Calculate.'), m(`${k}^2`)]) : squareRootQ(k * k, [p('Calculate.'), m(`\\sqrt{${k * k}}`)]);
    }
    const k = rng.int(5, 20);
    const ctx = rng.pick(['garden', 'quilt', 'tiles'] as const);
    if (ctx === 'tiles') return squareQ(k, [p(`A square floor is ${k} tiles long and ${k} tiles wide. How many tiles cover the floor?`)], { unit: 'tiles' });
    if (ctx === 'quilt') return squareRootQ(k * k, [p(`A square quilt is made of ${k * k} square patches. How many patches are along each side?`), sqArea(Math.min(k, 12))], { unit: 'patches' });
    return squareRootQ(k * k, [p(`A square garden has an area of ${k * k} m². How long is each side?`)], { unit: 'm' });
  },
  selfCheck: (q) => {
    const pr = prm(q);
    const n = Number(pr.n);
    switch (pr.kind) {
      case 'root':
        return near(q, Math.sqrt(n));
      case 'square':
        return near(q, Number(pr.k) ** 2);
      case 'tenth':
        return near(q, Math.round(Math.sqrt(n) * 10) / 10);
      case 'perimeter':
        return near(q, Math.round(4 * Math.sqrt(n) * 10) / 10);
      case 'between': {
        const lo = Math.floor(Math.sqrt(n));
        return rightText(q) === `${lo} and ${lo + 1}` ? null : 'between choice is wrong';
      }
      case 'which': {
        const v = Number(rightText(q).replace(/\s/g, ''));
        return Number.isInteger(Math.sqrt(v)) && v === Number(pr.right) ? null : 'perfect square choice is wrong';
      }
      case 'compare':
        return q.type === 'true_false' && q.answer === Math.sqrt(n) > parseRat(String(pr.est)).toNumber() ? null : 'comparison key is wrong';
      default:
        return 'unknown question kind';
    }
  },
  summary: ['A perfect square is a whole number times itself: $$7^2 = 49$$.', 'The square root undoes squaring: $$\\sqrt{49} = 7$$, the side of a square with area 49.', 'To estimate $$\\sqrt{n}$$, find the perfect squares on either side; round a calculator value only at the end.'],
  misconceptions: [MIS.squareDouble, MIS.rootHalf, MIS.squareRectangle, MIS.rootZeros, MIS.rootEstimate, MIS.roundDirection, MIS.roundEarly],
};

// ═════════════════════════ Exponents ═════════════════════════

/** A whole number written in expanded form with powers of ten. */
function expandedTex(n: bigint, hide?: number): { tex: string; parts: { digit: number; exp: number }[] } {
  const s = n.toString();
  const parts = [...s].map((ch, i) => ({ digit: Number(ch), exp: s.length - 1 - i })).filter((x) => x.digit !== 0);
  const tex = parts.map((x) => `(${x.digit} \\times ${x.exp === 0 ? '1' : `10^{${x.exp === hide ? '\\square' : x.exp}}`})`).join(' + ');
  return { tex, parts };
}
function powerQ(b: number, e: number, prompt: Block[], o: { unit?: string; pre?: Block[] } = {}): Draft {
  const ans = R(b).pow(e);
  return numeric(prompt, ans, {
    hints: [`$$${b}^{${e}}$$ means ${e} factors of ${b} multiplied together.`, `Multiply step by step: $$${b} \\times ${b} = ${b * b}$$, then keep going.`],
    solution: [...(o.pre ?? []), m(`${b}^{${e}} = ${Array(e).fill(b).join(' \\times ')} = ${nl(ans)}`)],
    unit: o.unit,
    accept: ['integer'],
    knownWrong: wrongs(ans, [
      [R(b * e), MIS.expMultiply.id],
      [e ** b <= 1e7 ? R(e).pow(b) : null, MIS.expBaseSwap.id],
    ]),
    params: { kind: 'power', b, e },
  });
}

export const exponents: SkillPack = {
  id: 'exponents',
  title: 'Powers and exponents',
  subject: 'math',
  expectations: [
    { id: `${G7}:B2.7`, note: 'Writes repeated multiplication as a power and evaluates powers of whole numbers, including doubling, chain-message and volume contexts, sums and products of powers, and finding an unknown exponent.' },
    { id: `${G7}:B1.1`, note: 'Covers only the expanded-form-with-powers-of-ten part: converting between standard form and expanded form using powers of ten for whole numbers up to one billion. Comparing numbers and describing everyday uses are not assessed here.', levels: [2, 3] },
  ],
  prerequisites: [],
  goal: 'I can write repeated multiplication as a power and work out its value.',
  explain: (c) => [
    p('A **power** is a short way to write repeated multiplication. The **base** is the factor that repeats and the **exponent** says how many times.'),
    m('2 \\times 2 \\times 2 \\times 2 \\times 2 = 2^5 = 32'),
    p('In $$2^5$$ the base is 2 and the exponent is 5. Read it as “2 to the power of 5”. $$5^2$$ is read “5 squared” and $$4^3$$ “4 cubed”.'),
    warn('$$2^5$$ is not $$2 \\times 5$$. It is five 2s multiplied together.'),
    ...(c.expectationId.endsWith('B1.1') ? [p('Powers of ten name place values: $$10^1 = 10$$, $$10^2 = 100$$, $$10^3 = 1000$$. So $$345 = (3 \\times 10^2) + (4 \\times 10^1) + (5 \\times 1)$$.')] : []),
    c.simple ? tip('The small number tells you how many times to write the big number and multiply.') : tip('Powers grow fast: $$2^{10}$$ is already 1024.'),
  ],
  alternatives: () => ({
    simpler: [p('$$3^4$$ means write 3 four times and multiply: 3 × 3 × 3 × 3 = 81.')],
    visual: [{ kind: 'table', header: ['Power', 'Repeated multiplication', 'Value'], rows: [['$$2^1$$', '2', '2'], ['$$2^2$$', '2 × 2', '4'], ['$$2^3$$', '2 × 2 × 2', '8'], ['$$2^4$$', '2 × 2 × 2 × 2', '16'], ['$$2^5$$', '2 × 2 × 2 × 2 × 2', '32']] }],
    analogy: [p('Folding a sheet of paper in half doubles the layers each time. After 5 folds there are $$2^5 = 32$$ layers.')],
    compare: [p('Multiplication is repeated addition: $$4 \\times 3 = 4 + 4 + 4$$. A power is repeated multiplication: $$4^3 = 4 \\times 4 \\times 4 = 64$$.')],
  }),
  example: (rng) => {
    const b = rng.int(2, 5);
    const e = rng.int(3, 4);
    return [p(`Evaluate $$${b}^{${e}}$$.`), steps({ text: `Write ${e} factors of ${b}.`, math: `${b}^{${e}} = ${Array(e).fill(b).join(' \\times ')}` }, { text: 'Multiply.', math: `= ${R(b).pow(e).toString()}` })];
  },
  generate: (rng, d, c) => {
    if (c.expectationId.endsWith('B1.1')) {
      const len = rng.int(5, 10);
      let s = String(rng.int(1, 9));
      for (let i = 1; i < len; i++) s += rng.chance(0.45) ? '0' : String(rng.int(1, 9));
      const n = BigInt(s);
      if (d <= 2) {
        const { tex, parts } = expandedTex(n);
        const squashed = R(BigInt(parts.map((x) => x.digit).join('')));
        return numeric([p('Write this number in standard form.'), m(tex)], R(n), {
          hints: ['Each power of ten tells you the place: $$10^2$$ is hundreds, $$10^3$$ is thousands, $$10^6$$ is millions.', 'Make a place-value chart and write 0 in any place that is not listed.'],
          solution: [m(`${tex} = ${nl(R(n))}`), p('Places that are not listed hold a 0.')],
          accept: ['integer'],
          knownWrong: wrongs(R(n), [[squashed, MIS.expandedZero.id]]),
          params: { kind: 'expanded', n: s },
        });
      }
      const { parts } = expandedTex(n);
      const hide = rng.pick(parts.filter((x) => x.exp >= 1)).exp;
      const { tex } = expandedTex(n, hide);
      return numeric([p(`What exponent goes in the box?`), m(`${nl(R(n))} = ${tex}`)], R(hide), {
        hints: ['The exponent of a place value is the number of digits to its right.', 'Count the digits after the one in the box’s term.'],
        solution: [p(`The digit in that term has ${hide} digit${hide === 1 ? '' : 's'} to its right in ${nt(R(n))}, so its place value is $$10^{${hide}}$$.`)],
        accept: ['integer'],
        knownWrong: wrongs(R(hide), [[R(hide + 1), MIS.placeExponent.id]]),
        params: { kind: 'missingExp', n: s, hide },
      });
    }
    if (d === 1) {
      const b = rng.int(2, 9);
      const e = rng.int(3, 5);
      if (rng.chance(0.5)) {
        return choice(rng, [p('Which power is the same as this product?'), m(Array(e).fill(b).join(' \\times '))], `$$${b}^{${e}}$$`, [{ text: `$$${e}^{${b}}$$`, misconception: MIS.expBaseSwap.id }, { text: `$$${b} \\times ${e}$$`, misconception: MIS.expMultiply.id }, { text: `$$${b}^{${e + 1}}$$` }], {
          hints: ['Which number repeats? That is the base.', 'Count how many times it repeats. That is the exponent.'],
          solution: [p(`${b} is multiplied ${e} times, so the base is ${b} and the exponent is ${e}: $$${b}^{${e}}$$.`)],
          params: { kind: 'write', b, e },
        });
      }
      const bb = rng.int(2, 5);
      const ee = rng.int(2, 3);
      return powerQ(bb, ee, [p('Evaluate.'), m(`${bb}^{${ee}}`)]);
    }
    if (d === 2) {
      const b = rng.int(2, 10);
      const e = b <= 4 ? rng.int(3, 6) : b <= 6 ? rng.int(2, 4) : rng.int(2, 3);
      return powerQ(b, e, [p('Evaluate.'), m(`${b}^{${e}}`)]);
    }
    if (d === 3) {
      const kind = rng.pick(['double', 'chain', 'cube', 'sum'] as const);
      if (kind === 'double') {
        const h = rng.int(5, 10);
        return powerQ(2, h, [p(`A bacteria culture starts with 1 cell. The number of cells doubles every hour. How many cells are there after ${h} hours?`)], { unit: 'cells', pre: [p(`After each hour, multiply by 2. After ${h} hours that is $$2^{${h}}$$.`)] });
      }
      if (kind === 'chain') {
        const r = rng.int(3, 6);
        return powerQ(3, r, [p(`A school sends a message to 3 families in round 1. In every new round, each family that just got it passes it to 3 new families. How many families get the message in round ${r}?`)], { unit: 'families', pre: [p(`Round 1: 3. Round 2: $$3 \\times 3 = 3^2$$. Each round multiplies by 3, so round ${r} is $$3^{${r}}$$.`)] });
      }
      if (kind === 'cube') {
        const k = rng.int(3, 12);
        return powerQ(k, 3, [p(`A cube-shaped box has edges ${k} cm long. Its volume is $$${k}^3$$ cm³. What is the volume?`)], { unit: 'cm³' });
      }
      const [b1, e1, b2, e2] = [rng.int(2, 5), rng.int(2, 4), rng.int(2, 5), rng.int(2, 3)];
      const ans = R(b1).pow(e1).add(R(b2).pow(e2));
      return numeric([p('Evaluate.'), m(`${b1}^{${e1}} + ${b2}^{${e2}}`)], ans, {
        hints: ['Evaluate each power first, then add.', `$$${b1}^{${e1}} = ${R(b1).pow(e1).toString()}$$`],
        solution: [m(`${b1}^{${e1}} + ${b2}^{${e2}} = ${R(b1).pow(e1).toString()} + ${R(b2).pow(e2).toString()} = ${ans.toString()}`)],
        accept: ['integer'],
        knownWrong: wrongs(ans, [[R(b1 * e1 + b2 * e2), MIS.expMultiply.id]]),
        params: { kind: 'sum', b1, e1, b2, e2 },
      });
    }
    if (rng.chance(0.5)) {
      const b = rng.pick([2, 3, 4, 5, 10]);
      const e = b === 2 ? rng.int(4, 9) : b === 10 ? rng.int(3, 7) : rng.int(3, 5);
      const v = R(b).pow(e);
      return numeric([p('What number goes in the box?'), m(`${b}^{\\square} = ${nl(v)}`)], R(e), {
        hints: [`Keep multiplying by ${b} and count the factors.`, `$$${b}^{2} = ${b * b}$$, $$${b}^{3} = ${b ** 3}$$, …`],
        solution: [m(`${Array(e).fill(b).join(' \\times ')} = ${nl(v)}`), p(`That is ${e} factors of ${b}, so the exponent is ${e}.`)],
        accept: ['integer'],
        knownWrong: wrongs(R(e), [[v.div(b).isInteger() && !v.div(b).eq(e) ? v.div(b) : null, MIS.expMultiply.id]]),
        params: { kind: 'unknownExp', b, v: v.toString() },
      });
    }
    const [b1, e1, b2, e2] = [rng.int(2, 4), rng.int(2, 4), rng.int(2, 5), 2];
    const ans = R(b1).pow(e1).mul(R(b2).pow(e2));
    return numeric([p('Evaluate.'), m(`${b1}^{${e1}} \\times ${b2}^{${e2}}`)], ans, {
      hints: ['Evaluate each power first, then multiply.', `$$${b1}^{${e1}} = ${R(b1).pow(e1).toString()}$$ and $$${b2}^{${e2}} = ${b2 * b2}$$.`],
      solution: [m(`${b1}^{${e1}} \\times ${b2}^{${e2}} = ${R(b1).pow(e1).toString()} \\times ${b2 * b2} = ${ans.toString()}`)],
      accept: ['integer'],
      knownWrong: wrongs(ans, [[R(b1 * e1 * b2 * e2), MIS.expMultiply.id]]),
      params: { kind: 'product', b1, e1, b2, e2 },
    });
  },
  selfCheck: (q) => {
    const pr = prm(q);
    const n = (k: string) => Number(pr[k]);
    switch (pr.kind) {
      case 'power':
        return near(q, Math.pow(n('b'), n('e')));
      case 'write':
        return rightText(q) === `$$${n('b')}^{${n('e')}}$$` ? null : 'power choice is wrong';
      case 'sum':
        return near(q, Math.pow(n('b1'), n('e1')) + Math.pow(n('b2'), n('e2')));
      case 'product':
        return near(q, Math.pow(n('b1'), n('e1')) * Math.pow(n('b2'), n('e2')));
      case 'unknownExp':
        return near(q, Math.round(Math.log(Number(pr.v)) / Math.log(n('b'))));
      case 'expanded':
        return q.type === 'numeric' && q.answer === String(pr.n) ? null : 'standard form does not match';
      case 'missingExp': {
        const s = String(pr.n);
        const k = keyR(q)?.toNumber() ?? -1;
        const digit = Number(s[s.length - 1 - k] ?? '0');
        return digit !== 0 && k === n('hide') ? null : 'missing exponent does not match';
      }
      default:
        return 'unknown question kind';
    }
  },
  summary: ['A power is repeated multiplication: the base repeats, the exponent counts.', '$$b^n$$ is not $$b \\times n$$: $$2^5 = 32$$, not 10.', 'Powers of ten name place values: $$10^3 = 1000$$.'],
  misconceptions: [MIS.expMultiply, MIS.expBaseSwap, MIS.expandedZero, MIS.placeExponent],
};

// ═════════════════════════ Exponent laws ═════════════════════════

/** A monomial: integer coefficient times letters to integer powers. */
interface Mono {
  c: number;
  v: Record<string, number>;
}
const monoVars = (mo: Mono) => Object.entries(mo.v).filter(([, e]) => e !== 0).sort(([a], [b]) => a.localeCompare(b));
function monoTex(mo: Mono): string {
  const vars = monoVars(mo);
  const coef = vars.length ? (mo.c === 1 ? '' : mo.c === -1 ? '-' : String(mo.c)) : String(mo.c);
  return coef + vars.map(([x, e]) => (e === 1 ? x : `${x}^{${e}}`)).join('');
}
function monoAscii(mo: Mono): string {
  const vars = monoVars(mo);
  const coef = vars.length ? (mo.c === 1 ? '' : mo.c === -1 ? '-' : String(mo.c)) : String(mo.c);
  return coef + vars.map(([x, e]) => (e === 1 ? x : `${x}^${e}`)).join('');
}
const LAW_ENV: Record<string, Rational> = { x: R(3, 2), y: R(5, 3), m: R(4, 3), n: R(7, 5), a: R(6, 5), b: R(-2, 3) };

function lawQ(prompt: Block[], ans: Mono, src: string, o: { hints: string[]; solution: Block[]; wrong: [Mono | null, string][] }): Draft {
  const key = monoAscii(ans);
  const seen = new Set([key]);
  const knownWrong: KnownWrong[] = [];
  for (const [w, mis] of o.wrong) {
    if (!w) continue;
    const s = monoAscii(w);
    if (seen.has(s)) continue;
    seen.add(s);
    knownWrong.push({ value: s, misconception: mis });
  }
  const variables = [...new Set(src.match(/[a-z]/g) ?? [])].sort();
  return expression(prompt, key, { hints: o.hints, solution: o.solution, variables, requireSimplified: true, knownWrong, params: { kind: 'law', src } });
}
const VARS = ['x', 'y', 'm', 'n', 'a'] as const;

function lawBox(rng: Rng): Draft {
  const b = rng.int(2, 9);
  const kind = rng.pick(['product', 'quotient', 'power'] as const);
  let e1: number;
  let e2: number;
  let key: number;
  let wrong: Wrong[] = [];
  let lhs: string;
  if (kind === 'product') {
    e1 = rng.int(2, 7);
    e2 = rng.int(2, 6);
    key = e1 + e2;
    lhs = `${b}^{${e1}} \\times ${b}^{${e2}}`;
    wrong = [[R(e1 * e2), MIS.lawProductMultiply.id]];
  } else if (kind === 'quotient') {
    e1 = rng.int(5, 12);
    e2 = rng.int(2, e1 - 1);
    key = e1 - e2;
    lhs = `${b}^{${e1}} \\div ${b}^{${e2}}`;
    wrong = [[e1 % e2 === 0 ? R(e1 / e2) : null, MIS.lawQuotientDivide.id]];
  } else {
    e1 = rng.int(2, 5);
    e2 = rng.int(2, 4);
    key = e1 * e2;
    lhs = `\\left(${b}^{${e1}}\\right)^{${e2}}`;
    wrong = [[R(e1 + e2), MIS.lawPowerAdd.id]];
  }
  const rule = kind === 'product' ? 'add the exponents' : kind === 'quotient' ? 'subtract the exponents' : 'multiply the exponents';
  return numeric([p('Write as a single power. What exponent goes in the box?'), m(`${lhs} = ${b}^{\\square}`)], R(key), {
    hints: [kind === 'power' ? `$$\\left(${b}^{${e1}}\\right)^{${e2}}$$ means ${e2} copies of $$${b}^{${e1}}$$ multiplied together.` : 'Write each power as repeated multiplication and count the factors that are left.', `Same base: ${rule}.`],
    solution: [m(`${lhs} = ${b}^{${kind === 'product' ? `${e1} + ${e2}` : kind === 'quotient' ? `${e1} - ${e2}` : `${e1} \\times ${e2}`}} = ${b}^{${key}}`)],
    accept: ['integer'],
    knownWrong: wrongs(R(key), wrong),
    params: { kind: 'box', law: kind, b, e1, e2 },
  });
}

export const exponentLaws: SkillPack = {
  id: 'exponent-laws',
  title: 'Exponent laws',
  subject: 'math',
  expectations: [
    {
      id: `${W}:B2.2`,
      note: 'Uses the product, quotient and power-of-a-power relationships to simplify numeric powers and algebraic monomials (one or two variables, with coefficients), including zero and negative exponents at the stretch level. The patterns behind the laws are shown in explanations; answers are checked as simplified expressions.',
    },
  ],
  prerequisites: ['exponents'],
  goal: 'I can use the exponent laws to simplify products, quotients and powers of powers.',
  explain: (c) => [
    p('When powers have the **same base**, you can combine them by working with the exponents. Each law comes from writing the powers out:'),
    { kind: 'table', header: ['Law', 'Example', 'Why'], rows: [['Product: add', '$$x^3 \\times x^4 = x^7$$', '3 factors of x, then 4 more'], ['Quotient: subtract', '$$x^8 \\div x^2 = x^6$$', '2 factors cancel, 6 are left'], ['Power of a power: multiply', '$$(x^2)^3 = x^6$$', 'three groups of 2 factors']] },
    p('Numbers in front (coefficients) are multiplied or divided as usual: $$(3a^2)(4a^5) = 12a^7$$ and $$(2x^3)^2 = 4x^6$$.'),
    p('Two more facts come from the quotient law: $$x^0 = 1$$ (because $$\\frac{x^3}{x^3} = 1$$) and $$x^{-n} = \\frac{1}{x^n}$$ (because $$\\frac{x^2}{x^5} = \\frac{1}{x^3} = x^{-3}$$).'),
    warn('The laws only work for the same base. $$2^3 \\times 5^2$$ cannot be written as one power.'),
    c.simple ? tip('Times: add. Divide: subtract. Brackets with a power outside: multiply.') : tip('If you are unsure, write a small example out in full and count the factors.'),
  ],
  alternatives: () => ({
    simpler: [p('Same base, multiplying: add the little numbers. Dividing: subtract them. Power of a power: multiply them.')],
    steps: [p('Simplify $$\\frac{12x^7}{4x^3}$$.'), steps({ text: 'Divide the coefficients.', math: '12 \\div 4 = 3' }, { text: 'Subtract the exponents of x.', math: 'x^{7-3} = x^4' }, { text: 'Put them together.', math: '\\frac{12x^7}{4x^3} = 3x^4' })],
    visual: [{ kind: 'table', header: ['Power', '$$2^3$$', '$$2^2$$', '$$2^1$$', '$$2^0$$', '$$2^{-1}$$', '$$2^{-2}$$'], rows: [['Value', '8', '4', '2', '1', '$$\\frac{1}{2}$$', '$$\\frac{1}{4}$$']] }, p('Each step to the right divides by 2. That pattern explains $$2^0 = 1$$ and negative exponents.')],
    example: [p('$$a^5 \\times a^{-2} = a^{5 + (-2)} = a^3$$ and $$\\left(y^{-1}\\right)^4 = y^{-4}$$.')],
  }),
  example: (rng) => {
    const a = rng.int(2, 6);
    const b = rng.int(2, 5);
    return [p(`Simplify $$x^{${a}} \\times x^{${b}}$$.`), steps({ text: 'Write it out.', math: `${'x \\cdot '.repeat(a).slice(0, -7)} \\times ${'x \\cdot '.repeat(b).slice(0, -7)}` }, { text: `That is ${a + b} factors of x: add the exponents.`, math: `x^{${a} + ${b}} = x^{${a + b}}` })];
  },
  generate: (rng, d) => {
    const x = rng.pick(VARS);
    const pw = (e: number): Mono => ({ c: 1, v: { [x]: e } });
    if (d === 1) return lawBox(rng);
    if (d === 2) {
      const kind = rng.pick(['product', 'quotient', 'power'] as const);
      if (kind === 'product') {
        const e1 = rng.int(2, 8);
        const e2 = rng.int(2, Math.max(2, 12 - e1));
        return lawQ([p('Simplify. Write your answer as a single power.'), m(`${x}^{${e1}} \\times ${x}^{${e2}}`)], pw(e1 + e2), `${x}^${e1}*${x}^${e2}`, {
          hints: ['Same base, multiplying: what happens to the exponents?', `Add the exponents: $$${e1} + ${e2}$$.`],
          solution: [m(`${x}^{${e1}} \\times ${x}^{${e2}} = ${x}^{${e1} + ${e2}} = ${x}^{${e1 + e2}}`)],
          wrong: [[pw(e1 * e2), MIS.lawProductMultiply.id]],
        });
      }
      if (kind === 'quotient') {
        const e1 = rng.int(5, 12);
        const e2 = rng.int(2, e1 - 1);
        return lawQ([p('Simplify. Write your answer as a single power.'), m(`\\frac{${x}^{${e1}}}{${x}^{${e2}}}`)], pw(e1 - e2), `${x}^${e1}/${x}^${e2}`, {
          hints: ['Same base, dividing: what happens to the exponents?', `Subtract the exponents: $$${e1} - ${e2}$$.`],
          solution: [m(`\\frac{${x}^{${e1}}}{${x}^{${e2}}} = ${x}^{${e1} - ${e2}} = ${x}^{${e1 - e2}}`)],
          wrong: [[e1 % e2 === 0 ? pw(e1 / e2) : null, MIS.lawQuotientDivide.id]],
        });
      }
      const e1 = rng.int(2, 6);
      const e2 = rng.int(2, Math.max(2, Math.floor(12 / e1)));
      return lawQ([p('Simplify. Write your answer as a single power.'), m(`\\left(${x}^{${e1}}\\right)^{${e2}}`)], pw(e1 * e2), `(${x}^${e1})^${e2}`, {
        hints: [`This is ${e2} copies of $$${x}^{${e1}}$$ multiplied together.`, 'A power of a power: multiply the exponents.'],
        solution: [m(`\\left(${x}^{${e1}}\\right)^{${e2}} = ${x}^{${e1} \\times ${e2}} = ${x}^{${e1 * e2}}`)],
        wrong: [[pw(e1 + e2), MIS.lawPowerAdd.id]],
      });
    }
    if (d === 3) {
      const kind = rng.pick(['mul', 'div', 'pow', 'mixed'] as const);
      if (kind === 'mul') {
        const [c1, c2] = [rng.int(2, 6), rng.int(2, 6)];
        const [p1, q1, p2, q2] = [rng.int(1, 5), rng.int(1, 5), rng.int(1, 5), rng.int(1, 5)];
        const A: Mono = { c: c1, v: { a: p1, b: q1 } };
        const B: Mono = { c: c2, v: { a: p2, b: q2 } };
        return lawQ([p('Simplify.'), m(`\\left(${monoTex(A)}\\right)\\left(${monoTex(B)}\\right)`)], { c: c1 * c2, v: { a: p1 + p2, b: q1 + q2 } }, `(${monoAscii(A)})*(${monoAscii(B)})`, {
          hints: ['Multiply the coefficients, then deal with each letter separately.', 'For each letter, the bases match, so add its exponents.'],
          solution: [steps({ text: 'Multiply the coefficients.', math: `${c1} \\times ${c2} = ${c1 * c2}` }, { text: 'Add the exponents of a.', math: `a^{${p1} + ${p2}} = a^{${p1 + p2}}` }, { text: 'Add the exponents of b.', math: `b^{${q1} + ${q2}} = b^{${q1 + q2}}` }, { text: 'Put it together.', math: monoTex({ c: c1 * c2, v: { a: p1 + p2, b: q1 + q2 } }) })],
          wrong: [
            [{ c: c1 + c2, v: { a: p1 + p2, b: q1 + q2 } }, MIS.lawCoefficients.id],
            [{ c: c1 * c2, v: { a: p1 * p2, b: q1 * q2 } }, MIS.lawProductMultiply.id],
          ],
        });
      }
      if (kind === 'div') {
        const [c2, k] = [rng.int(2, 6), rng.int(2, 6)];
        const e1 = rng.int(5, 12);
        const e2 = rng.int(2, e1 - 1);
        const top: Mono = { c: c2 * k, v: { [x]: e1 } };
        const bot: Mono = { c: c2, v: { [x]: e2 } };
        return lawQ([p('Simplify.'), m(`\\frac{${monoTex(top)}}{${monoTex(bot)}}`)], { c: k, v: { [x]: e1 - e2 } }, `(${monoAscii(top)})/(${monoAscii(bot)})`, {
          hints: ['Divide the coefficients, then use the quotient law for the letter.', `Subtract the exponents: $$${e1} - ${e2}$$.`],
          solution: [steps({ text: 'Divide the coefficients.', math: `${c2 * k} \\div ${c2} = ${k}` }, { text: 'Subtract the exponents.', math: `${x}^{${e1} - ${e2}} = ${x}^{${e1 - e2}}` }, { text: 'Put it together.', math: monoTex({ c: k, v: { [x]: e1 - e2 } }) })],
          wrong: [
            [e1 % e2 === 0 ? { c: k, v: { [x]: e1 / e2 } } : null, MIS.lawQuotientDivide.id],
            [{ c: c2 * k - c2, v: { [x]: e1 - e2 } }, MIS.lawCoefficients.id],
          ],
        });
      }
      if (kind === 'pow') {
        const c = rng.pick([2, 3]);
        const n = c === 2 ? rng.int(2, 4) : rng.int(2, 3);
        const e = rng.int(1, Math.floor(12 / n));
        const inner: Mono = { c, v: { [x]: e } };
        const ans: Mono = { c: c ** n, v: { [x]: e * n } };
        return lawQ([p('Simplify.'), m(`\\left(${monoTex(inner)}\\right)^{${n}}`)], ans, `(${monoAscii(inner)})^${n}`, {
          hints: ['The exponent outside the brackets applies to the coefficient and to the letter.', `Work out $$${c}^{${n}}$$, then multiply the exponents of ${x}.`],
          solution: [m(`\\left(${monoTex(inner)}\\right)^{${n}} = ${c}^{${n}} \\, ${x}^{${e} \\times ${n}} = ${monoTex(ans)}`)],
          wrong: [
            [{ c, v: { [x]: e * n } }, MIS.lawPowerCoefficient.id],
            [{ c: c * n, v: { [x]: e * n } }, MIS.expMultiply.id],
            [{ c: c ** n, v: { [x]: e + n } }, MIS.lawPowerAdd.id],
          ],
        });
      }
      const e1 = rng.int(2, 7);
      const e2 = rng.int(2, 7);
      const e3 = rng.int(2, e1 + e2 - 1);
      return lawQ([p('Simplify. Write your answer as a single power.'), m(`\\frac{${x}^{${e1}} \\times ${x}^{${e2}}}{${x}^{${e3}}}`)], pw(e1 + e2 - e3), `${x}^${e1}*${x}^${e2}/${x}^${e3}`, {
        hints: ['Simplify the top first using the product law.', 'Then use the quotient law to divide by the bottom.'],
        solution: [m(`\\frac{${x}^{${e1}} \\times ${x}^{${e2}}}{${x}^{${e3}}} = \\frac{${x}^{${e1 + e2}}}{${x}^{${e3}}} = ${x}^{${e1 + e2 - e3}}`)],
        wrong: [[pw(e1 * e2 - e3), MIS.lawProductMultiply.id]],
      });
    }
    const kind = rng.pick(['negQuot', 'negPow', 'negProd', 'zero', 'value'] as const);
    if (kind === 'negQuot') {
      const e1 = rng.int(2, 6);
      const e2 = rng.int(e1 + 1, 12);
      return lawQ([p('Simplify. Write your answer as a single power (it may have a negative exponent).'), m(`${x}^{${e1}} \\div ${x}^{${e2}}`)], pw(e1 - e2), `${x}^${e1}/${x}^${e2}`, {
        hints: ['Subtract the exponents: top (first) minus bottom (second).', `$$${e1} - ${e2}$$ is negative, and that is fine.`],
        solution: [m(`${x}^{${e1}} \\div ${x}^{${e2}} = ${x}^{${e1} - ${e2}} = ${x}^{${e1 - e2}} = \\frac{1}{${x}^{${e2 - e1}}}`)],
        wrong: [[pw(e2 - e1), MIS.lawQuotientOrder.id]],
      });
    }
    if (kind === 'negPow') {
      const e = rng.int(1, 3);
      const n = rng.int(2, 4);
      return lawQ([p('Simplify. Write your answer as a single power (it may have a negative exponent).'), m(`\\left(${x}^{-${e}}\\right)^{${n}}`)], pw(-e * n), `(${x}^(-${e}))^${n}`, {
        hints: ['A power of a power: multiply the exponents.', `Multiply $$-${e} \\times ${n}$$.`],
        solution: [m(`\\left(${x}^{-${e}}\\right)^{${n}} = ${x}^{(-${e}) \\times ${n}} = ${x}^{${-e * n}}`)],
        wrong: [
          [pw(-e + n), MIS.lawPowerAdd.id],
          [pw(e * n), MIS.negExponent.id],
        ],
      });
    }
    if (kind === 'negProd') {
      const e1 = rng.int(2, 9);
      let e2 = rng.int(2, 9);
      if (e2 === e1) e2 = e1 === 9 ? 8 : e1 + 1;
      return lawQ([p('Simplify. Write your answer as a single power (it may have a negative exponent).'), m(`${x}^{${e1}} \\times ${x}^{-${e2}}`)], pw(e1 - e2), `${x}^${e1}*${x}^(-${e2})`, {
        hints: ['Same base, multiplying: add the exponents.', `Add $$${e1} + (-${e2})$$.`],
        solution: [m(`${x}^{${e1}} \\times ${x}^{-${e2}} = ${x}^{${e1} + (-${e2})} = ${x}^{${e1 - e2}}`)],
        wrong: [
          [pw(-e1 * e2), MIS.lawProductMultiply.id],
          [pw(e1 + e2), MIS.negExponent.id],
        ],
      });
    }
    if (kind === 'zero') {
      const c = rng.int(2, 9);
      const e = rng.int(2, 8);
      return lawQ([p('Simplify.'), m(`\\left(${c}${x}^{${e}}\\right)^{0}`)], { c: 1, v: {} }, `(${c}${x}^${e})^0`, {
        hints: ['What is any non-zero number to the exponent 0?', 'Everything inside the brackets is raised to the power 0.'],
        solution: [m(`\\left(${c}${x}^{${e}}\\right)^{0} = 1`), p('Any non-zero base to the exponent 0 equals 1. You can also see it with the power law: $$' + `${c}^{0}${x}^{0} = 1 \\times 1 = 1` + '$$.')],
        wrong: [
          [{ c: 0, v: {} }, MIS.zeroExponent.id],
          [{ c, v: {} }, MIS.zeroExponent.id],
        ],
      });
    }
    const b = rng.pick([2, 3, 5, 10]);
    const e1 = rng.int(2, 6);
    const e2 = rng.int(2, 8);
    const ans = R(b).pow(e1 - e2);
    return numeric([p('Evaluate. Give an integer or a fraction.'), m(`${b}^{${e1}} \\times ${b}^{-${e2}}`)], ans, {
      hints: ['Use the product law first: add the exponents.', `You get $$${b}^{${e1 - e2}}$$. ${e1 - e2 < 0 ? 'A negative exponent means a reciprocal.' : e1 - e2 === 0 ? 'Any non-zero base to the exponent 0 is 1.' : 'Now evaluate it.'}`],
      solution: [m(`${b}^{${e1}} \\times ${b}^{-${e2}} = ${b}^{${e1 - e2}} = ${ans.toLatex()}`)],
      accept: ['integer', 'fraction', 'decimal'],
      requireSimplest: true,
      knownWrong: wrongs(ans, [
        [e1 - e2 < 0 ? ans.neg().pow(-1) : null, MIS.negExponent.id],
        [R(b).pow(e1 + e2), MIS.negExponent.id],
      ]),
      params: { kind: 'value', b, e1, e2: -e2 },
    });
  },
  selfCheck: (q) => {
    const pr = prm(q);
    if (pr.kind === 'box') {
      const b = BigInt(Number(pr.b));
      const [e1, e2] = [BigInt(Number(pr.e1)), BigInt(Number(pr.e2))];
      const k = keyR(q);
      if (!k || !k.isInteger() || k.n < 0n) return 'exponent key is not a whole number';
      const lhs = pr.law === 'product' ? b ** e1 * b ** e2 : pr.law === 'quotient' ? b ** e1 / b ** e2 : (b ** e1) ** e2;
      return lhs === b ** k.n ? null : 'exponent does not match';
    }
    if (pr.kind === 'value') return near(q, Math.pow(Number(pr.b), Number(pr.e1)) * Math.pow(Number(pr.b), Number(pr.e2)));
    if (q.type !== 'expression') return 'expected an expression';
    try {
      const key = parseExpr(q.answer);
      if (!isSimplified(key)) return 'key is not simplified';
      const want = evaluate(parseExpr(String(pr.src)), LAW_ENV);
      const got = evaluate(key, LAW_ENV);
      return want.eq(got) ? null : `key ${q.answer} does not match ${String(pr.src)}`;
    } catch {
      return 'expression does not evaluate';
    }
  },
  summary: ['Same base: multiply → add exponents, divide → subtract exponents, power of a power → multiply exponents.', 'Coefficients are multiplied or divided, and an outside exponent applies to them too.', '$$x^0 = 1$$ and $$x^{-n} = \\frac{1}{x^n}$$.'],
  misconceptions: [MIS.lawProductMultiply, MIS.lawQuotientDivide, MIS.lawQuotientOrder, MIS.lawPowerAdd, MIS.lawCoefficients, MIS.lawPowerCoefficient, MIS.expMultiply, MIS.zeroExponent, MIS.negExponent],
};

// ═════════════════════════ Scientific notation ═════════════════════════

const sciTex = (c: Rational, n: number) => `${nl(c)} \\times 10^{${n}}`;
const sciVal = (c: Rational, n: number) => c.mul(R(10).pow(n));
/** A coefficient from 1 to 9.9 (or 9.99) whose last digit is not 0. */
function sciCoef(rng: Rng, digits: 1 | 2 | 3): Rational {
  if (digits === 1) return R(rng.int(1, 9));
  const top = 10 ** digits - 1;
  let k = rng.int(10 ** (digits - 1) + 1, top);
  if (k % 10 === 0) k += 1;
  return R(k, 10 ** (digits - 1));
}
/** Standard form for text: 4 500 000 or 0.000045. */
const stdText = (v: Rational) => nt(v);

function sciToStd(c: Rational, n: number, prompt?: Block[]): Draft {
  const v = sciVal(c, n);
  return numeric(prompt ?? [p('Write this number in standard form.'), m(sciTex(c, n))], v, {
    hints: [n > 0 ? 'A positive exponent makes the number bigger: move the decimal point to the right.' : 'A negative exponent makes the number smaller: move the decimal point to the left.', `Move the decimal point ${Math.abs(n)} place${Math.abs(n) === 1 ? '' : 's'}, filling empty places with zeros.`],
    solution: [m(`${sciTex(c, n)} = ${nl(v)}`), p(`The decimal point moves ${Math.abs(n)} place${Math.abs(n) === 1 ? '' : 's'} to the ${n > 0 ? 'right' : 'left'}.`)],
    accept: ['integer', 'decimal'],
    knownWrong: wrongs(v, [
      [sciVal(c, n - 1), MIS.sciPlaces.id],
      [sciVal(c, n + 1), MIS.sciPlaces.id],
      [sciVal(c, -n), MIS.sciNegative.id],
    ]),
    params: { kind: 'toStd', c: c.toString(), n },
  });
}
function sciExp(c: Rational, n: number, intro?: string): Draft {
  const v = sciVal(c, n);
  return numeric([p(`${intro ? `${intro} ` : ''}Write ${stdText(v)} in scientific notation. What exponent goes in the box?`), m(`${nl(v)} = ${nl(c)} \\times 10^{\\square}`)], R(n), {
    hints: [`Count how many places the decimal point moves to get from ${stdText(v)} to ${nt(c)}.`, n > 0 ? 'The number is bigger than 10, so the exponent is positive.' : 'The number is less than 1, so the exponent is negative.'],
    solution: [p(`To turn ${stdText(v)} into ${nt(c)}, the decimal point moves ${Math.abs(n)} places to the ${n > 0 ? 'left' : 'right'}. ${n > 0 ? 'The original number is large, so the exponent is positive' : 'The original number is small, so the exponent is negative'}.`), m(`${nl(v)} = ${sciTex(c, n)}`)],
    accept: ['integer'],
    knownWrong: wrongs(R(n), [
      [R(n - 1), MIS.sciPlaces.id],
      [R(n + 1), MIS.sciPlaces.id],
      [R(-n), MIS.sciNegative.id],
    ]),
    params: { kind: 'toExp', c: c.toString(), n },
  });
}
function sciChoice(rng: Rng, c: Rational, n: number): Draft {
  const v = sciVal(c, n);
  return choice(
    rng,
    [p(`Which shows ${stdText(v)} in scientific notation?`)],
    `$$${sciTex(c, n)}$$`,
    [
      { text: `$$${sciTex(c.mul(10), n - 1)}$$`, misconception: MIS.sciCoefficient.id },
      { text: `$$${sciTex(c, n - 1)}$$`, misconception: MIS.sciPlaces.id },
      { text: `$$${sciTex(c, -n)}$$`, misconception: MIS.sciNegative.id },
    ],
    {
      hints: ['The first number must be at least 1 and less than 10.', 'Count how many places the decimal point moves. Is the number bigger or smaller than 1?'],
      solution: [m(`${nl(v)} = ${sciTex(c, n)}`), p(`${nt(c)} is between 1 and 10, and the point moves ${Math.abs(n)} places, so the exponent is ${sn(n)}.`)],
      params: { kind: 'choice', c: c.toString(), n },
    },
  );
}
function sciCompare(rng: Rng, small: boolean): Draft {
  const pickC = (lo: number, hi: number) => R(rng.int(lo, hi), 10);
  let entries: { c: Rational; n: number; trap?: boolean }[];
  if (!small) {
    const E = rng.int(4, 9);
    const c0 = pickC(21, 39);
    entries = [{ c: c0, n: E }, { c: pickC(81, 99), n: E - 1, trap: true }, { c: pickC(11, 99), n: E - 2 }, { c: pickC(11, Number(c0.mul(10).n) - 1), n: E }];
  } else {
    const E = -rng.int(3, 8);
    const c0 = pickC(61, 90);
    entries = [{ c: c0, n: E }, { c: pickC(11, 29), n: E + 1, trap: true }, { c: pickC(11, 99), n: E + 2 }, { c: pickC(Number(c0.mul(10).n) + 1, 99), n: E }];
  }
  const [right, ...rest] = entries.map((e) => ({ ...e, text: `$$${sciTex(e.c, e.n)}$$` }));
  return choice(
    rng,
    [p(`Which number is the ${small ? 'smallest' : 'greatest'}?`)],
    right!.text,
    rest.map((e) => ({ text: e.text, misconception: e.trap ? MIS.sciCompare.id : undefined })),
    {
      hints: ['Compare the exponents first.', small ? 'The most negative exponent gives the smallest number. If two exponents are equal, compare the numbers in front.' : 'The largest exponent gives the greatest number. If two exponents are equal, compare the numbers in front.'],
      solution: [p(`The ${small ? 'smallest' : 'largest'} exponent is ${sn(right!.n)}. Two numbers have it, and ${nt(right!.c)} is the ${small ? 'smaller' : 'larger'} number in front, so ${right!.text} is the ${small ? 'smallest' : 'greatest'}.`), p(`Watch out: ${rest[0]!.text} has the ${small ? 'smallest' : 'largest'} number in front, but its exponent is ${sn(rest[0]!.n)}.`)],
      params: { kind: 'compare', small },
    },
  );
}
function powerValueQ(rng: Rng, pattern: boolean): Draft {
  const b = rng.pick([R(2), R(3), R(4), R(5), R(10), R(1, 2), R(2, 3)]);
  const e = pattern ? rng.pick([0, -1, -2]) : rng.pick([0, -1, -2, -3]);
  const ans = b.pow(e);
  const bt = b.isInteger() ? b.toString() : `\\left(${b.toLatex()}\\right)`;
  const table: Block[] = pattern && b.isInteger() ? [p('Use the pattern.'), { kind: 'table', header: ['Power', `$$${bt}^{3}$$`, `$$${bt}^{2}$$`, `$$${bt}^{1}$$`, `$$${bt}^{${e}}$$`], rows: [['Value', b.pow(3).toString(), b.pow(2).toString(), b.toString(), '?']] }] : [];
  return numeric([...table, p('Evaluate. Give an integer or a fraction.'), m(`${bt}^{${e}}`)], ans, {
    hints: [e === 0 ? 'Look at the pattern: each time the exponent goes down by 1, the value is divided by the base.' : 'A negative exponent means “one over” the power with a positive exponent.', e === 0 ? `What do you get when you divide $$${bt}^{1}$$ by ${b.isInteger() ? b.toString() : `$$${b.toLatex()}$$`}?` : `$$${bt}^{${e}} = \\frac{1}{${bt}^{${-e}}}$$`],
    solution: [m(e === 0 ? `${bt}^{0} = 1` : `${bt}^{${e}} = \\frac{1}{${bt}^{${-e}}} = \\frac{1}{${b.pow(-e).toLatex()}} = ${ans.toLatex()}`)],
    accept: ['integer', 'fraction', 'decimal'],
    requireSimplest: true,
    knownWrong: wrongs(ans, [
      [e < 0 ? b.pow(-e).neg() : null, MIS.negExponent.id],
      [e !== 0 && b.isInteger() ? b.mul(e) : null, MIS.expMultiply.id],
      [e === 0 ? R(0) : null, MIS.zeroExponent.id],
      [e === 0 ? b : null, MIS.zeroExponent.id],
    ]),
    params: { kind: 'powValue', b: b.toString(), e },
  });
}
const SCI_FACTS: { text: string; c: Rational; n: number }[] = [
  { text: 'The average distance from Earth to the Sun is about 150 000 000 km.', c: R(15, 10), n: 8 },
  { text: 'Light travels about 300 000 000 m every second.', c: R(3), n: 8 },
  { text: 'A sheet of paper is about 0.0001 m thick.', c: R(1), n: -4 },
  { text: 'A red blood cell is about 0.000008 m wide.', c: R(8), n: -6 },
  { text: 'Lake Superior holds about 12 000 km³ of water.', c: R(12, 10), n: 4 },
  { text: 'A water molecule is about 0.0000000003 m across.', c: R(3), n: -10 },
];

export const scientificNotation: SkillPack = {
  id: 'sci-notation',
  title: 'Scientific notation',
  subject: 'math',
  expectations: [
    { id: `${G8}:B1.1`, note: 'Writes very large and very small numbers in scientific notation and in standard form, and compares numbers written in scientific notation. Describing everyday uses appears in explanations and contexts but is not assessed.', levels: [1, 2, 3] },
    { id: `${W}:B2.1`, note: 'Evaluates powers with zero and negative exponents (using the pattern of dividing by the base), and expresses and compares numbers in scientific notation, including products and quotients of numbers in scientific notation at the stretch level.', levels: [2, 3, 4] },
  ],
  prerequisites: ['exponents'],
  goal: 'I can write very large and very small numbers in scientific notation and change them back.',
  explain: (c) => [
    p('**Scientific notation** writes a number as a number from 1 up to (but not including) 10, multiplied by a power of 10.'),
    m('4\\,500\\,000 = 4.5 \\times 10^{6} \\qquad 0.000\\,032 = 3.2 \\times 10^{-5}'),
    steps({ text: 'Move the decimal point until exactly one non-zero digit is in front of it.', math: '4\\,500\\,000 \\to 4.5' }, { text: 'Count the places it moved: that is the size of the exponent.', math: '6 \\text{ places}' }, { text: 'Large number (10 or more): positive exponent. Small number (less than 1): negative exponent.', math: '4.5 \\times 10^{6}' }),
    { kind: 'table', header: ['Power', '$$10^3$$', '$$10^2$$', '$$10^1$$', '$$10^0$$', '$$10^{-1}$$', '$$10^{-2}$$'], rows: [['Value', '1000', '100', '10', '1', '0.1', '0.01']] },
    ...(c.grade >= 9 ? [p('The table shows the pattern: each time the exponent goes down by 1, the value is divided by 10. That is why $$10^0 = 1$$ and $$10^{-n} = \\frac{1}{10^n}$$, and the same works for any non-zero base: $$2^{-3} = \\frac{1}{8}$$.')] : []),
    c.simple ? tip('Big number: positive exponent. Tiny number: negative exponent. The front number is always between 1 and 10.') : tip('Scientists use this to write distances in space and the sizes of cells without long strings of zeros.'),
  ],
  alternatives: () => ({
    simpler: [p('$$3 \\times 10^4$$ means 3 with the decimal point moved 4 places right: 30 000. $$3 \\times 10^{-4}$$ moves it 4 places left: 0.0003.')],
    visual: [{ kind: 'table', header: ['Standard form', 'Scientific notation'], rows: [['150 000 000', '$$1.5 \\times 10^{8}$$'], ['2 400', '$$2.4 \\times 10^{3}$$'], ['0.06', '$$6 \\times 10^{-2}$$'], ['0.000 008', '$$8 \\times 10^{-6}$$']] }],
    analogy: [p('A store sign saying “2.4 billion” is a short way to write 2 400 000 000. Scientific notation is the same idea: $$2.4 \\times 10^{9}$$.')],
    compare: [p('You already know that multiplying by 10 moves the digits one place left (the number gets bigger). Multiplying by $$10^6$$ just does that six times.')],
  }),
  example: (rng) => {
    const c = sciCoef(rng, 2);
    const n = rng.int(4, 8);
    return [p(`Write ${stdText(sciVal(c, n))} in scientific notation.`), steps({ text: 'Put the decimal point after the first digit.', math: nl(c) }, { text: `It moved ${n} places to the left, and the number is large.`, math: `${nl(sciVal(c, n))} = ${sciTex(c, n)}` })];
  },
  generate: (rng, d, c) => {
    const nine = c.grade >= 9;
    if (nine && d === 2) return powerValueQ(rng, rng.chance(0.5));
    if (d === 1) return sciToStd(sciCoef(rng, rng.pick([1, 2])), rng.int(3, 6));
    if (d === 2 || (nine && d === 3)) {
      const n = rng.chance(0.5) ? rng.int(4, 9) : -rng.int(2, 7);
      const co = sciCoef(rng, rng.pick([1, 2, 3]));
      const mode = rng.pick(['std', 'exp', 'choice'] as const);
      if (mode === 'std') return sciToStd(co, n);
      if (mode === 'exp') return sciExp(co, n);
      return sciChoice(rng, co.isInteger() ? sciCoef(rng, 2) : co, n);
    }
    if (d === 3) {
      if (rng.chance(0.5)) return sciCompare(rng, rng.chance(0.5));
      const f = rng.pick(SCI_FACTS);
      return sciExp(f.c, f.n, f.text);
    }
    const a = rng.int(2, 9);
    const m1 = rng.signed(2, 8);
    const m2 = rng.signed(2, 8);
    if (rng.chance(0.5)) {
      const b = rng.int(2, 9);
      const prod = a * b;
      const k = m1 + m2 + (prod >= 10 ? 1 : 0);
      const cc = prod >= 10 ? R(prod, 10) : R(prod);
      return numeric([p('Multiply. Write the answer in scientific notation. What is the exponent of 10?'), m(`\\left(${a} \\times 10^{${m1}}\\right) \\times \\left(${b} \\times 10^{${m2}}\\right)`)], R(k), {
        hints: ['Multiply the numbers in front, and add the exponents of 10.', prod >= 10 ? `$$${a} \\times ${b} = ${prod}$$ is not less than 10, so adjust: $$${prod} = ${nl(cc)} \\times 10^{1}$$.` : `$$${a} \\times ${b} = ${prod}$$, which is already between 1 and 10.`],
        solution: [m(`(${a} \\times ${b}) \\times 10^{${m1} + ${il(m2)}} = ${prod} \\times 10^{${m1 + m2}}${prod >= 10 ? ` = ${sciTex(cc, k)}` : ''}`)],
        accept: ['integer'],
        knownWrong: wrongs(R(k), [
          [prod >= 10 ? R(m1 + m2) : null, MIS.sciCoefficient.id],
          [R(m1 * m2), MIS.lawProductMultiply.id],
        ]),
        params: { kind: 'prodExp', a, b, m1, m2 },
      });
    }
    const q = rng.int(2, 9);
    const b = rng.int(2, Math.max(2, Math.floor(9 / q)));
    const top = q * b;
    return numeric([p('Divide. Write the answer in scientific notation. What is the exponent of 10?'), m(`\\frac{${top} \\times 10^{${m1}}}{${b} \\times 10^{${m2}}}`)], R(m1 - m2 + (q >= 10 ? 1 : 0)), {
      hints: ['Divide the numbers in front, and subtract the exponents of 10 (top minus bottom).', `$$${top} \\div ${b} = ${q}$$.`],
      solution: [m(`\\frac{${top}}{${b}} \\times 10^{${m1} - ${il(m2)}} = ${q} \\times 10^{${m1 - m2}}`)],
      accept: ['integer'],
      knownWrong: wrongs(R(m1 - m2), [
        [R(m2 - m1), MIS.sciNegative.id],
        [R(m1 + m2), MIS.lawQuotientDivide.id],
      ]),
      params: { kind: 'quotExp', top, b, m1, m2 },
    });
  },
  selfCheck: (q) => {
    const pr = prm(q);
    const parseSci = (t: string) => {
      const mm = /^\$\$([\d.]+) \\times 10\^\{(-?\d+)\}\$\$$/.exec(t);
      return mm ? Number(mm[1]) * Math.pow(10, Number(mm[2])) : NaN;
    };
    switch (pr.kind) {
      case 'toStd':
        return near(q, parseRat(String(pr.c)).toNumber() * Math.pow(10, Number(pr.n)));
      case 'toExp': {
        const v = parseRat(String(pr.c)).toNumber() * Math.pow(10, Number(pr.n));
        return near(q, Math.floor(Math.log10(v) + 1e-9));
      }
      case 'choice': {
        const v = parseSci(rightText(q));
        const want = parseRat(String(pr.c)).toNumber() * Math.pow(10, Number(pr.n));
        const coef = Number(/\$\$([\d.]+)/.exec(rightText(q))?.[1]);
        return Math.abs(v - want) <= 1e-9 * want && coef >= 1 && coef < 10 ? null : 'scientific notation choice is wrong';
      }
      case 'compare': {
        if (q.type !== 'multiple_choice') return 'expected a choice';
        const vals = q.choices.map((c) => ({ id: c.id, v: parseSci(c.text) }));
        const best = vals.reduce((a, b) => (pr.small ? (b.v < a.v ? b : a) : b.v > a.v ? b : a));
        return best.id === q.answer && vals.every((x) => Number.isFinite(x.v)) ? null : 'comparison key is wrong';
      }
      case 'powValue':
        return near(q, Math.pow(parseRat(String(pr.b)).toNumber(), Number(pr.e)));
      case 'prodExp': {
        const v = Number(pr.a) * Math.pow(10, Number(pr.m1)) * Number(pr.b) * Math.pow(10, Number(pr.m2));
        return near(q, Math.floor(Math.log10(v) + 1e-9));
      }
      case 'quotExp': {
        const v = (Number(pr.top) * Math.pow(10, Number(pr.m1))) / (Number(pr.b) * Math.pow(10, Number(pr.m2)));
        return near(q, Math.floor(Math.log10(v) + 1e-9));
      }
      default:
        return 'unknown question kind';
    }
  },
  summary: ['Scientific notation: a number from 1 to less than 10, times a power of 10.', 'Large numbers have positive exponents; numbers between 0 and 1 have negative exponents.', 'Compare exponents first; $$b^0 = 1$$ and $$b^{-n} = \\frac{1}{b^n}$$.'],
  misconceptions: [MIS.sciPlaces, MIS.sciNegative, MIS.sciCoefficient, MIS.sciCompare, MIS.negExponent, MIS.expMultiply, MIS.zeroExponent, MIS.lawProductMultiply, MIS.lawQuotientDivide],
};

// ═════════════════════════ Divisibility rules ═════════════════════════

const DIVS = [2, 3, 4, 5, 6, 8, 9, 10] as const;
const digitSum = (n: number) => [...String(n)].reduce((a, ch) => a + Number(ch), 0);
/** Divisibility decided by the rules (digits only). The selfCheck uses % instead. */
function byRule(n: number, k: number): boolean {
  const s = String(n);
  const last = Number(s.slice(-1));
  switch (k) {
    case 2:
      return last % 2 === 0;
    case 3:
      return digitSum(n) % 3 === 0;
    case 4:
      return Number(s.slice(-2)) % 4 === 0;
    case 5:
      return last === 0 || last === 5;
    case 6:
      return last % 2 === 0 && digitSum(n) % 3 === 0;
    case 8:
      return Number(s.slice(-3)) % 8 === 0;
    case 9:
      return digitSum(n) % 9 === 0;
    default:
      return last === 0;
  }
}
const RULE: Record<number, string> = {
  2: 'its last digit is even (0, 2, 4, 6 or 8)',
  3: 'the sum of its digits is divisible by 3',
  4: 'the number made by its last two digits is divisible by 4',
  5: 'its last digit is 0 or 5',
  6: 'it is divisible by both 2 and 3',
  8: 'the number made by its last three digits is divisible by 8',
  9: 'the sum of its digits is divisible by 9',
  10: 'its last digit is 0',
};
function ruleCheck(n: number, k: number): string {
  const s = String(n);
  const ok = byRule(n, k);
  const sum = `${[...s].join(' + ')} = ${digitSum(n)}`;
  switch (k) {
    case 3:
    case 9:
      return `Digit sum: ${sum}. ${digitSum(n)} ${ok ? 'is' : 'is not'} divisible by ${k}.`;
    case 4:
      return `Last two digits: ${Number(s.slice(-2))}, which ${ok ? 'is' : 'is not'} divisible by 4.`;
    case 8:
      return `Last three digits: ${Number(s.slice(-3))}, which ${ok ? 'is' : 'is not'} divisible by 8.`;
    case 6:
      return `Even? ${Number(s.slice(-1)) % 2 === 0 ? 'Yes' : 'No'}. Digit sum ${sum}, divisible by 3? ${digitSum(n) % 3 === 0 ? 'Yes' : 'No'}.`;
    default:
      return `The last digit is ${s.slice(-1)}.`;
  }
}
/** The next number from `start` that satisfies `test`. */
function findFrom(start: number, test: (n: number) => boolean): number {
  let n = start;
  while (!test(n)) n++;
  return n;
}
/** A number for a true/false question about divisor k, sometimes built to catch a common mix-up. */
function divCase(rng: Rng, k: number, lo: number, hi: number): { n: number; mis: string } {
  const start = rng.int(lo, hi);
  const trap = rng.chance(0.55);
  switch (k) {
    case 9:
      return { n: findFrom(start, trap ? (n) => n % 3 === 0 && n % 9 !== 0 : (n) => n % 9 === 0), mis: MIS.div3vs9.id };
    case 3:
      return { n: findFrom(start, trap ? (n) => [3, 9].includes(n % 10) && n % 3 !== 0 : (n) => n % 3 === 0 && n % 10 !== 3 && n % 10 !== 9), mis: MIS.divLastDigit.id };
    case 4:
      return { n: findFrom(start, trap ? (n) => n % 4 === 2 : (n) => n % 4 === 0 && Math.floor(n / 10) % 2 === 1), mis: MIS.div4and8.id };
    case 8:
      return { n: findFrom(start, trap ? (n) => n % 8 === 4 : (n) => n % 8 === 0), mis: MIS.div4and8.id };
    case 6:
      return { n: findFrom(start, trap ? (rng.chance(0.5) ? (n) => n % 6 === 3 : (n) => n % 2 === 0 && n % 3 !== 0) : (n) => n % 6 === 0), mis: MIS.div6.id };
    default:
      return { n: findFrom(start, trap ? (n) => n % 10 === 5 : (n) => n % 10 === (k === 5 ? rng.pick([0, 5]) : 0) || (k === 2 && n % 2 === 0)), mis: MIS.div2510.id };
  }
}
function divTF(n: number, k: number, mis: string, text?: string): Draft {
  const ok = byRule(n, k);
  return trueFalse([p(text ?? `True or false? ${nt(n)} is divisible by ${k}.`)], ok, {
    hints: [`A number is divisible by ${k} when ${RULE[k]}.`, ruleCheck(n, k).split('.')[0] + '.'],
    solution: [p(ruleCheck(n, k)), p(`So ${nt(n)} ${ok ? 'is' : 'is not'} divisible by ${k}.`)],
    misconception: mis,
    params: { kind: 'tf', n, k },
  });
}

export const divisibility: SkillPack = {
  id: 'divisibility',
  title: 'Divisibility rules',
  subject: 'math',
  expectations: [{ id: `${G6}:B2.2`, note: 'Applies the divisibility rules for 2, 3, 4, 5, 6, 8, 9 and 10 to decide whether a number is divisible, to pick a divisible number, to find a missing digit, and to count which of these divisors a number has.' }],
  prerequisites: [],
  goal: 'I can use divisibility rules to tell whether a number can be divided evenly by 2, 3, 4, 5, 6, 8, 9 or 10.',
  explain: (c) => [
    p('A number is **divisible** by another when it divides with no remainder. Divisibility rules let you check quickly without dividing.'),
    { kind: 'table', header: ['Divisible by', 'Rule', 'Example'], rows: DIVS.map((k) => [String(k), RULE[k]!.replace(/^its /, 'the ').replace(/^it /, ''), { 2: '94 024', 3: '93 018 (sum 21)', 4: '94 024 (24)', 5: '94 025', 6: '93 018', 8: '5 128 (128)', 9: '4 518 (sum 18)', 10: '7 350' }[k]!]) },
    warn('For 3 and 9 the last digit tells you nothing: 23 ends in 3 but is not divisible by 3. Add the digits instead.'),
    c.simple ? tip('2, 5 and 10: look at the last digit. 3 and 9: add the digits. 4: last two digits. 8: last three. 6: check 2 and 3.') : tip('The rules work because 10, 100 and 1000 are multiples of 2, 4 and 8, and because 10 is 1 more than 9.'),
  ],
  alternatives: () => ({
    simpler: [p('Even numbers can be split by 2. Numbers ending in 0 or 5 can be split by 5. Add up the digits: if the total splits by 3, so does the number.')],
    steps: [p('Is 7 236 divisible by 6?'), steps({ text: 'Divisible by 2? The last digit, 6, is even. Yes.' }, { text: 'Divisible by 3? 7 + 2 + 3 + 6 = 18, and 18 is divisible by 3. Yes.' }, { text: 'Both are yes, so 7 236 is divisible by 6.' })],
    analogy: [p('Sharing 312 hockey cards among 3 friends: 3 + 1 + 2 = 6, which is divisible by 3, so everyone gets the same number with none left over.')],
    visual: [{ kind: 'table', header: ['Number', '÷2', '÷3', '÷5', '÷9', '÷10'], rows: [['270', 'yes', 'yes', 'yes', 'yes', 'yes'], ['135', 'no', 'yes', 'yes', 'yes', 'no'], ['104', 'yes', 'no', 'no', 'no', 'no']] }],
  }),
  example: (rng) => {
    const n = findFrom(rng.int(1000, 9000), (x) => x % 9 === 0);
    return [p(`Is ${nt(n)} divisible by 9?`), steps({ text: 'Add the digits.', math: `${[...String(n)].join(' + ')} = ${digitSum(n)}` }, { text: `${digitSum(n)} is divisible by 9, so ${nt(n)} is divisible by 9.` })];
  },
  generate: (rng, d) => {
    if (d === 1) {
      const k = rng.pick([2, 5, 10]);
      const { n, mis } = divCase(rng, k, 20, 999);
      return divTF(n, k, mis);
    }
    if (d === 2) {
      const k = rng.pick([3, 4, 6, 9]);
      if (rng.chance(0.4)) {
        const yes = (n: number) => n % k === 0;
        const right = findFrom(rng.int(100, 9000), yes);
        const trap = divCase(rng, k, 100, 9000);
        const trapN = trap.n % k === 0 ? findFrom(trap.n + 1, (n) => !yes(n) && (k === 9 ? n % 3 === 0 : k === 3 ? n % 10 === 3 : n % 2 === 0)) : trap.n;
        const others = [findFrom(rng.int(100, 9000), (n) => !yes(n)), findFrom(rng.int(100, 9000), (n) => !yes(n))];
        return choice(rng, [p(`Which number is divisible by ${k}?`)], nt(right), [{ text: nt(trapN), misconception: trap.mis }, ...others.map((n) => ({ text: nt(n) }))], {
          hints: [`A number is divisible by ${k} when ${RULE[k]}.`, 'Check each option with the rule.'],
          solution: [p(ruleCheck(right, k)), p(`For each other option the rule fails. For example, ${nt(trapN)}: ${ruleCheck(trapN, k)}`)],
          params: { kind: 'pick', k },
        });
      }
      const { n, mis } = divCase(rng, k, 100, 9999);
      return divTF(n, k, mis);
    }
    if (d === 3) {
      if (rng.chance(0.35)) {
        const k = rng.pick([3, 4, 6, 9]);
        const { n, mis } = divCase(rng, k, 200, 1500);
        const things = rng.pick(['students into teams', 'chairs into rows', 'muffins onto plates']);
        const [what, into] = things.split(' into ').length === 2 ? things.split(' into ') : things.split(' onto ');
        return divTF(n, k, mis, `True or false? ${nt(n)} ${what} can be put ${things.includes('onto') ? 'onto' : 'into'} ${into} of exactly ${k} with none left over.`);
      }
      const k = rng.pick([3, 9, 6, 4]);
      const len = 4;
      let digits = Array.from({ length: len }, (_, i) => (i === 0 ? rng.int(1, 9) : rng.int(0, 9)));
      let pos: number;
      if (k === 4) {
        digits[len - 1] = rng.pick([0, 2, 4, 6, 8]);
        pos = len - 2;
      } else {
        if (k === 6) digits[len - 1] = rng.pick([0, 2, 4, 6, 8]);
        pos = rng.int(1, k === 6 ? len - 2 : len - 1);
      }
      digits = digits.map((x, i) => (i === pos ? 0 : x));
      let ans: number;
      if (k === 4) ans = [0, 4, 8].includes(digits[len - 1]!) ? 0 : 1;
      else {
        const m3 = k === 9 ? 9 : 3;
        ans = (m3 - (digits.reduce((a, b) => a + b, 0) % m3)) % m3;
      }
      const wrong3 = k === 9 ? (3 - (digits.reduce((a, b) => a + b, 0) % 3)) % 3 : null;
      const shown = digits.map((x, i) => (i === pos ? '\\square' : String(x))).join('');
      const full = Number(digits.map((x, i) => (i === pos ? ans : x)).join(''));
      return numeric([p(`The number below is divisible by ${k}. What is the smallest digit that can go in the box?`), m(shown)], R(ans), {
        hints: [`A number is divisible by ${k} when ${RULE[k]}.`, k === 4 ? 'Try the digits 0, 1, 2, … in the tens place and test the last two digits.' : 'Add the digits you can see, then find the smallest digit that makes the total work.'],
        solution: [p(k === 4 ? `The last two digits must make a multiple of 4. With ${ans} in the box they make ${Number(String(full).slice(-2))}, which works, and no smaller digit does.` : `The digits you can see add up to ${digits.reduce((a, b) => a + b, 0)}. Adding ${ans} gives ${digits.reduce((a, b) => a + b, 0) + ans}, which is divisible by ${k === 9 ? 9 : 3}${k === 6 ? ', and the number is even' : ''}.`), p(`The number is ${nt(full)}.`)],
        accept: ['integer'],
        knownWrong: wrongs(R(ans), [[wrong3 !== null ? R(wrong3) : null, MIS.div3vs9.id]]),
        params: { kind: 'digit', digits, pos, k },
      });
    }
    if (rng.chance(0.4)) {
      const { n, mis } = divCase(rng, 8, 1000, 99999);
      return divTF(n, 8, mis);
    }
    const n = rng.int(2, 9) * rng.pick([12, 18, 20, 24, 30, 36, 40, 45, 60, 72]) * rng.int(3, 31);
    const yes = DIVS.filter((k) => byRule(n, k));
    return numeric([p(`How many of the numbers 2, 3, 4, 5, 6, 8, 9 and 10 divide ${nt(n)} evenly?`)], R(yes.length), {
      hints: ['Test each divisor with its rule and keep a tally.', 'Do 2, 5 and 10 first (last digit), then 3 and 9 (digit sum), then 4 and 8, then 6.'],
      solution: [{ kind: 'table', header: ['Divisor', 'Check', 'Divisible?'], rows: DIVS.map((k) => [String(k), ruleCheck(n, k), byRule(n, k) ? 'yes' : 'no']) }, p(`${yes.length} of them: ${yes.join(', ')}.`)],
      accept: ['integer'],
      params: { kind: 'count', n },
    });
  },
  selfCheck: (q) => {
    const pr = prm(q);
    switch (pr.kind) {
      case 'tf':
        return q.type === 'true_false' && q.answer === (Number(pr.n) % Number(pr.k) === 0) ? null : 'true/false key is wrong';
      case 'pick': {
        if (q.type !== 'multiple_choice') return 'expected a choice';
        const k = Number(pr.k);
        const ok = q.choices.every((c) => (Number(c.text.replace(/\s/g, '')) % k === 0) === (c.id === q.answer));
        return ok ? null : 'divisible choice is wrong';
      }
      case 'digit': {
        const digits = nums(pr.digits);
        const pos = Number(pr.pos);
        const k = Number(pr.k);
        const works = Array.from({ length: 10 }, (_, dgt) => Number(digits.map((x, i) => (i === pos ? dgt : x)).join('')) % k === 0);
        return near(q, works.indexOf(true));
      }
      case 'count':
        return near(q, DIVS.filter((k) => Number(pr.n) % k === 0).length);
      default:
        return 'unknown question kind';
    }
  },
  summary: ['2, 5 and 10: look at the last digit. 4: the last two digits. 8: the last three digits.', '3 and 9: add the digits and check the sum.', '6: the number must pass the tests for both 2 and 3.'],
  misconceptions: [MIS.divLastDigit, MIS.div3vs9, MIS.div6, MIS.div4and8, MIS.div2510],
};

// ═════════════════════════ Prime factorization ═════════════════════════

const isPrime = (n: number) => {
  if (n < 2) return false;
  for (let k = 2; k * k <= n; k++) if (n % k === 0) return false;
  return true;
};
/** Trial division: prime factors in increasing order. */
function trialFactors(n: number): number[] {
  const out: number[] = [];
  let x = n;
  for (let k = 2; k * k <= x; k++)
    while (x % k === 0) {
      out.push(k);
      x /= k;
    }
  if (x > 1) out.push(x);
  return out;
}
const PRIME_BAG = [2, 2, 2, 3, 3, 5, 7, 11, 13];
/** A composite number from randomly chosen primes, with its factors sorted. */
function composite(rng: Rng, lo: number, hi: number, minFactors: number): { n: number; fs: number[] } {
  for (;;) {
    const fs: number[] = [];
    let n = 1;
    while (n < lo || fs.length < minFactors) {
      const options = PRIME_BAG.filter((q) => n * q <= hi);
      if (!options.length) break;
      const q = rng.pick(options);
      fs.push(q);
      n *= q;
    }
    if (n >= lo && n <= hi && fs.length >= minFactors) return { n, fs: fs.sort((a, b) => a - b) };
  }
}
const timesTex = (fs: number[]) => fs.join(' \\times ');
const ODD_COMPOSITES = [9, 15, 21, 25, 27, 33, 35, 39, 45, 49, 51, 55, 57, 63, 65, 69, 77, 81, 85, 87, 91, 93, 95, 99];
const PRIMES_TO_100 = Array.from({ length: 99 }, (_, i) => i + 2).filter(isPrime);

function treeSteps(n: number, fs: number[]): Block {
  const out: { text: string; math?: string }[] = [];
  let rest = n;
  for (const q of fs.slice(0, -1)) {
    out.push({ text: `${rest} is divisible by ${q}.`, math: `${rest} = ${q} \\times ${rest / q}` });
    rest /= q;
  }
  out.push({ text: `${rest} is prime, so stop. Collect every prime from the branches.`, math: `${n} = ${timesTex(fs)}` });
  return steps(...out);
}

export const primeFactors: SkillPack = {
  id: 'prime-factor',
  title: 'Prime factorization',
  subject: 'math',
  expectations: [{ id: `${G6}:B2.6`, note: 'Writes composite numbers as a product of prime factors (factor trees are shown in the worked solutions), recognises prime numbers, finds a missing prime factor, picks the correct prime factorization and reasons about the largest prime factor and the number of prime factors.' }],
  prerequisites: ['divisibility'],
  goal: 'I can write a composite number as a product of prime numbers, using a factor tree.',
  explain: (c) => [
    p('A **prime number** has exactly two factors: 1 and itself (2, 3, 5, 7, 11, 13, …). A **composite number** has more than two factors. The number 1 is neither.'),
    p('Every composite number can be written as a product of primes. A **factor tree** finds them: split the number into two factors, then keep splitting until every branch ends in a prime.'),
    steps({ text: 'Split 56.', math: '56 = 2 \\times 28' }, { text: 'Split 28.', math: '28 = 2 \\times 14' }, { text: 'Split 14.', math: '14 = 2 \\times 7' }, { text: 'All the branches end in primes.', math: '56 = 2 \\times 2 \\times 2 \\times 7' }),
    tip('It does not matter how you start the tree: 56 = 7 × 8 gives the same primes in the end.'),
    ...(c.simple ? [] : [p('Use the divisibility rules to find a prime that divides the number: try 2, then 3, then 5, then 7.')]),
  ],
  alternatives: () => ({
    simpler: [p('Keep breaking the number into smaller factors until you cannot break them any more. The numbers left are the prime factors.')],
    steps: [p('Prime factors of 60.'), steps({ math: '60 = 2 \\times 30', text: 'Divide by 2.' }, { math: '30 = 2 \\times 15', text: 'Divide by 2 again.' }, { math: '15 = 3 \\times 5', text: '15 is odd; divide by 3.' }, { math: '60 = 2 \\times 2 \\times 3 \\times 5', text: 'Collect the primes.' })],
    analogy: [p('Primes are like LEGO bricks that cannot be split. Every composite number is built from them, and each number has its own unique set of bricks.')],
    visual: [{ kind: 'table', header: ['Branch', 'Splits into'], rows: [['56', '2 and 28'], ['28', '2 and 14'], ['14', '2 and 7'], ['Primes at the ends', '2, 2, 2, 7']] }],
  }),
  example: (rng) => {
    const { n, fs } = composite(rng, 24, 120, 3);
    return [p(`Write ${n} as a product of prime factors.`), treeSteps(n, fs)];
  },
  generate: (rng, d) => {
    if (d === 1) {
      if (rng.chance(0.5)) {
        const pr = rng.pick(PRIMES_TO_100.filter((x) => x > 10));
        const odd = rng.shuffle(ODD_COMPOSITES).slice(0, 2);
        return choice(rng, [p('Which of these numbers is prime?')], String(pr), [{ text: String(odd[0]), misconception: MIS.primeOdd.id }, { text: String(odd[1]), misconception: MIS.primeOdd.id }, { text: '1', misconception: MIS.primeOne.id }], {
          hints: ['A prime number has exactly two factors: 1 and itself.', 'Test each number with 3, 5 and 7.'],
          solution: [p(`${pr} has no factors except 1 and ${pr}, so it is prime.`), p(`${odd[0]} = ${timesTex(trialFactors(odd[0]!))} and ${odd[1]} = ${timesTex(trialFactors(odd[1]!))}, so they are composite. 1 has only one factor, so it is not prime.`)],
          params: { kind: 'isPrime' },
        });
      }
      const n = rng.chance(0.5) ? rng.pick(ODD_COMPOSITES) : rng.pick(PRIMES_TO_100.filter((x) => x > 10));
      const prime = isPrime(n);
      return trueFalse([p(`True or false? ${n} is a prime number.`)], prime, {
        hints: ['A prime number has exactly two factors: 1 and itself.', 'Try dividing by 3, 5 and 7.'],
        solution: [p(prime ? `${n} cannot be divided evenly by 2, 3, 5 or 7, so its only factors are 1 and ${n}. It is prime: **true**.` : `${n} = ${timesTex(trialFactors(n))}, so it has more than two factors. It is composite: **false**.`)],
        misconception: MIS.primeOdd.id,
        params: { kind: 'tf', n },
      });
    }
    if (d === 2) {
      const { n, fs } = composite(rng, 24, 200, 3);
      const hide = rng.int(0, fs.length - 1);
      const shown = fs.map((x, i) => (i === hide ? '\\square' : String(x))).join(' \\times ');
      return numeric([p('The missing number is prime. What is it?'), m(`${shown} = ${n}`)], R(fs[hide]!), {
        hints: ['Multiply the primes you can see.', `Divide ${n} by that product.`],
        solution: [m(`${timesTex(fs.filter((_, i) => i !== hide))} = ${n / fs[hide]!}`), m(`${n} \\div ${n / fs[hide]!} = ${fs[hide]}`)],
        accept: ['integer'],
        params: { kind: 'missing', n, shown: fs.filter((_, i) => i !== hide) },
      });
    }
    if (d === 3) {
      const { n, fs } = composite(rng, 36, 300, 4);
      const merged = [fs[0]! * fs[1]!, ...fs.slice(2)].sort((a, b) => a - b);
      const repeatIdx = fs.findIndex((x, i) => i > 0 && x === fs[i - 1]);
      const dropped = fs.filter((_, i) => i !== (repeatIdx >= 0 ? repeatIdx : 0));
      const swapped = [...fs.slice(0, -1), PRIMES_TO_100[PRIMES_TO_100.indexOf(fs[fs.length - 1]!) + 1]!];
      return choice(rng, [p(`Which is the prime factorization of ${n}?`)], `$$${timesTex(fs)}$$`, [{ text: `$$${timesTex(merged)}$$`, misconception: MIS.primeNotAll.id }, { text: `$$${timesTex(dropped)}$$`, misconception: MIS.primeMissing.id }, { text: `$$${timesTex(swapped)}$$` }], {
        hints: ['Every factor must be prime, and they must multiply to the number.', 'Multiply each option back together to check.'],
        solution: [treeSteps(n, fs), p(`$$${timesTex(merged)}$$ contains ${fs[0]! * fs[1]!}, which is not prime. $$${timesTex(dropped)}$$ only makes ${dropped.reduce((a, b) => a * b, 1)}.`)],
        params: { kind: 'which', n },
      });
    }
    if (rng.chance(0.5)) {
      const { n, fs } = composite(rng, 60, 600, 3);
      const big = fs[fs.length - 1]!;
      return numeric([p(`What is the largest prime factor of ${n}?`)], R(big), {
        hints: ['Make a factor tree first.', 'Then look for the biggest prime at the ends of the branches.'],
        solution: [treeSteps(n, fs), p(`The largest prime factor is ${big}.`)],
        accept: ['integer'],
        knownWrong: wrongs(R(big), [[R(n / fs[0]!), MIS.primeLargestFactor.id]]),
        params: { kind: 'largest', n },
      });
    }
    const { n, fs } = composite(rng, 48, 500, 4);
    return numeric([p(`${n} is written as a product of prime factors. How many prime factors are there, counting repeated ones? (For example, 12 = 2 × 2 × 3 has 3.)`)], R(fs.length), {
      hints: ['Make a factor tree.', 'Count every prime at the ends of the branches, including repeats.'],
      solution: [treeSteps(n, fs), p(`There are ${fs.length} prime factors.`)],
      accept: ['integer'],
      knownWrong: wrongs(R(fs.length), [[R(new Set(fs).size), MIS.primeMissing.id]]),
      params: { kind: 'count', n },
    });
  },
  selfCheck: (q) => {
    const pr = prm(q);
    const n = Number(pr.n);
    switch (pr.kind) {
      case 'isPrime':
        return q.type === 'multiple_choice' && q.choices.every((c) => isPrime(Number(c.text)) === (c.id === q.answer)) ? null : 'prime choice is wrong';
      case 'tf':
        return q.type === 'true_false' && q.answer === (trialFactors(n).length === 1) ? null : 'true/false key is wrong';
      case 'missing': {
        const k = keyR(q)?.toNumber() ?? 0;
        return isPrime(k) && nums(pr.shown).reduce((a, b) => a * b, k) === n ? null : 'missing factor is wrong';
      }
      case 'which': {
        const fs = rightText(q).replace(/\$/g, '').split('\\times').map((x) => Number(x.trim()));
        return fs.every(isPrime) && fs.reduce((a, b) => a * b, 1) === n ? null : 'factorization choice is wrong';
      }
      case 'largest':
        return near(q, Math.max(...trialFactors(n)));
      case 'count':
        return near(q, trialFactors(n).length);
      default:
        return 'unknown question kind';
    }
  },
  summary: ['A prime has exactly two factors; 1 is not prime.', 'A factor tree splits a number until every branch ends in a prime.', 'Check a prime factorization by multiplying the primes back together.'],
  misconceptions: [MIS.primeOdd, MIS.primeOne, MIS.primeNotAll, MIS.primeMissing, MIS.primeLargestFactor],
};

// ═════════════════════════ GCF and LCM ═════════════════════════

const gcfAll = (xs: number[]) => xs.reduce((a, b) => gcdNum(a, b));
const lcmAll = (xs: number[]) => xs.reduce((a, b) => lcmNum(a, b));
const factorsOf = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((k) => n % k === 0);
function gcfNumbers(rng: Rng, count: number, max: number): number[] {
  for (;;) {
    const g = rng.int(2, Math.min(24, Math.floor(max / 3)));
    const ks = Array.from({ length: count }, () => rng.int(1, Math.floor(max / g)));
    const xs = ks.map((k) => k * g);
    if (new Set(xs).size === count && gcfAll(ks) === 1 && Math.min(...xs) !== gcfAll(xs)) return xs;
  }
}
function lcmNumbers(rng: Rng, count: number, max: number): number[] {
  for (;;) {
    const xs = Array.from({ length: count }, () => rng.int(2, max));
    if (new Set(xs).size === count && !xs.some((x) => xs.some((y) => y !== x && y % x === 0)) && lcmAll(xs) <= 360) return xs;
  }
}

function gcfQ(xs: number[], prompt: Block[], o: { unit?: string } = {}): Draft {
  const g = gcfAll(xs);
  const common = factorsOf(Math.min(...xs)).filter((k) => xs.every((x) => x % k === 0));
  const second = common.length >= 2 ? common[common.length - 2]! : null;
  return numeric(prompt, R(g), {
    hints: ['List the factors of each number, or write each one as a product of primes.', 'Find the factors they all share, and pick the greatest.'],
    solution: [{ kind: 'table', header: ['Number', 'Factors'], rows: xs.map((x) => [String(x), factorsOf(x).join(', ')]) }, p(`Common factors: ${common.join(', ')}. The greatest is ${g}.`)],
    unit: o.unit,
    accept: ['integer'],
    knownWrong: wrongs(R(g), [
      [R(lcmAll(xs)), MIS.gcfLcmMix.id],
      [second && second > 1 ? R(second) : null, MIS.gcfNotGreatest.id],
    ]),
    params: { kind: 'gcf', xs },
  });
}
function lcmQ(xs: number[], prompt: Block[], o: { unit?: string } = {}): Draft {
  const l = lcmAll(xs);
  const big = Math.max(...xs);
  const multiples = Array.from({ length: l / big }, (_, i) => big * (i + 1));
  return numeric(prompt, R(l), {
    hints: [`List the multiples of the largest number, ${big}.`, `Stop at the first one that ${xs.length === 2 ? `${Math.min(...xs)} also divides` : 'all the other numbers divide'}.`],
    solution: [p(`Multiples of ${big}: ${multiples.join(', ')}.`), p(`${l} is the first one that ${xs.filter((x) => x !== big).join(' and ')} ${xs.length === 2 ? 'divides' : 'both divide'} evenly, so the LCM is ${l}.`)],
    unit: o.unit,
    accept: ['integer'],
    knownWrong: wrongs(R(l), [
      [R(xs.reduce((a, b) => a * b, 1)), MIS.lcmProduct.id],
      [R(gcfAll(xs)), MIS.gcfLcmMix.id],
    ]),
    params: { kind: 'lcm', xs },
  });
}

export const gcfLcm: SkillPack = {
  id: 'gcf-lcm',
  title: 'Greatest common factor and lowest common multiple',
  subject: 'math',
  expectations: [{ id: `${G7}:B2.6`, note: 'Finds the greatest common factor of two or three whole numbers up to 144 and the lowest common multiple of two and three whole numbers, including sharing (kits, rows) and lining-up (packages, bus schedules) problems.' }],
  prerequisites: ['prime-factor'],
  goal: 'I can find the greatest common factor and the lowest common multiple of whole numbers.',
  explain: (c) => [
    p('The **greatest common factor (GCF)** is the biggest number that divides all the numbers. The **lowest common multiple (LCM)** is the smallest number that all the numbers divide into.'),
    steps({ text: 'GCF of 24 and 56: list the factors.', math: '24: 1, 2, 3, 4, 6, 8, 12, 24 \\qquad 56: 1, 2, 4, 7, 8, 14, 28, 56' }, { text: 'The common factors are 1, 2, 4 and 8. The greatest is 8.', math: '\\text{GCF} = 8' }),
    steps({ text: 'LCM of 6 and 8: list multiples of the larger number.', math: '8, 16, 24, \\ldots' }, { text: '24 is the first one that 6 also divides.', math: '\\text{LCM} = 24' }),
    p('Prime factors work too: $$24 = 2 \\times 2 \\times 2 \\times 3$$ and $$56 = 2 \\times 2 \\times 2 \\times 7$$ share $$2 \\times 2 \\times 2 = 8$$.'),
    c.simple ? tip('Sharing into equal groups? GCF. Waiting for things to line up again? LCM.') : tip('Check: the GCF can never be bigger than the smallest number, and the LCM can never be smaller than the largest number.'),
  ],
  alternatives: () => ({
    simpler: [p('GCF: the biggest number that goes into all of them. LCM: the smallest number they all go into.')],
    visual: [{ kind: 'diagram', diagram: { type: 'number_line', min: 0, max: 24, step: 2, points: [{ at: 6, label: '6' }, { at: 8, label: '8' }, { at: 12, label: '12' }, { at: 16, label: '16' }, { at: 18, label: '18' }, { at: 24, label: '24 (both)' }] }, alt: 'A number line from 0 to 24. Multiples of 6 (6, 12, 18, 24) and of 8 (8, 16, 24) are marked. The first point they share is 24.' }],
    analogy: [p('Hot dogs come in packs of 10 and buns in packs of 8. To have exactly one bun per hot dog, you need a number of each that is a multiple of both: the LCM, 40.')],
    steps: [p('GCF of 36 and 60 with prime factors.'), steps({ text: 'Factor each number.', math: '36 = 2 \\times 2 \\times 3 \\times 3, \\quad 60 = 2 \\times 2 \\times 3 \\times 5' }, { text: 'Multiply the primes they share.', math: '2 \\times 2 \\times 3 = 12' })],
  }),
  example: (rng) => {
    const xs = gcfNumbers(rng, 2, 60);
    const g = gcfAll(xs);
    return [p(`Find the GCF of ${xs[0]} and ${xs[1]}.`), { kind: 'table', header: ['Number', 'Factors'], rows: xs.map((x) => [String(x), factorsOf(x).join(', ')]) }, p(`The greatest factor they share is ${g}.`)];
  },
  generate: (rng, d) => {
    const name = rng.pick(NAMES);
    if (d === 1) {
      if (rng.chance(0.5)) {
        const xs = gcfNumbers(rng, 2, 36);
        return gcfQ(xs, [p(`What is the greatest common factor (GCF) of ${xs[0]} and ${xs[1]}?`)]);
      }
      const xs = lcmNumbers(rng, 2, 10);
      return lcmQ(xs, [p(`What is the lowest common multiple (LCM) of ${xs[0]} and ${xs[1]}?`)]);
    }
    if (d === 2) {
      if (rng.chance(0.5)) {
        const xs = gcfNumbers(rng, 2, 144);
        return gcfQ(xs, [p(`What is the greatest common factor (GCF) of ${xs[0]} and ${xs[1]}?`)]);
      }
      const xs = lcmNumbers(rng, 2, 20);
      return lcmQ(xs, [p(`What is the lowest common multiple (LCM) of ${xs[0]} and ${xs[1]}?`)]);
    }
    if (d === 3) {
      const kind = rng.pick(['kits', 'rows', 'buns', 'bus'] as const);
      if (kind === 'kits') {
        const xs = gcfNumbers(rng, 2, 120);
        return gcfQ(xs, [p(`${name} has ${xs[0]} pencils and ${xs[1]} erasers to make identical school kits. Every pencil and eraser must be used, and each kit must be the same. What is the greatest number of kits ${name} can make?`)], { unit: 'kits' });
      }
      if (kind === 'rows') {
        const xs = gcfNumbers(rng, 2, 96);
        return gcfQ(xs, [p(`A community garden has ${xs[0]} tomato plants and ${xs[1]} pepper plants. Each row must have the same number of plants, and a row holds only one kind of plant. What is the greatest number of plants that can go in each row?`)], { unit: 'plants' });
      }
      if (kind === 'buns') {
        const xs = rng.pick([
          [10, 8],
          [12, 8],
          [6, 8],
          [10, 12],
          [6, 10],
        ]);
        return lcmQ(xs, [p(`Veggie dogs come in packs of ${xs[0]} and buns come in packs of ${xs[1]}. What is the smallest number of veggie dogs you can buy so that you have exactly the same number of buns, with none left over?`)]);
      }
      const xs = lcmNumbers(rng, 2, 30).map((x) => x);
      return lcmQ(xs, [p(`Two buses leave the same stop at 8:00 a.m. One leaves every ${xs[0]} minutes and the other every ${xs[1]} minutes. After how many minutes will they next leave the stop at the same time?`)], { unit: 'minutes' });
    }
    if (rng.chance(0.5)) {
      const xs = lcmNumbers(rng, 3, 15);
      return lcmQ(xs, [p(`What is the lowest common multiple (LCM) of ${xs[0]}, ${xs[1]} and ${xs[2]}?`)]);
    }
    const xs = gcfNumbers(rng, 3, 144);
    return gcfQ(xs, [p(`What is the greatest common factor (GCF) of ${xs[0]}, ${xs[1]} and ${xs[2]}?`)]);
  },
  selfCheck: (q) => {
    const pr = prm(q);
    const xs = nums(pr.xs);
    if (!xs.length) return 'no numbers';
    if (pr.kind === 'gcf') {
      let best = 1;
      for (let k = 1; k <= Math.min(...xs); k++) if (xs.every((x) => x % k === 0)) best = k;
      return near(q, best);
    }
    const big = Math.max(...xs);
    let mlt = big;
    while (!xs.every((x) => mlt % x === 0)) mlt += big;
    return near(q, mlt);
  },
  summary: ['GCF: the greatest number that divides all the numbers.', 'LCM: the lowest number that all the numbers divide into.', 'Sharing into equal groups uses the GCF; waiting for things to line up again uses the LCM.'],
  misconceptions: [MIS.lcmProduct, MIS.gcfLcmMix, MIS.gcfNotGreatest],
};

export const MATH_PACKS_NUMBER: SkillPack[] = [rounding, integerAddSub, integerMulDiv, orderOfOperations, squaresRoots, exponents, exponentLaws, scientificNotation, divisibility, primeFactors, gcfLcm];
