import { describe, expect, it } from 'vitest';
import { evaluate, formatNumber } from '../../src/shared/calc';
import { convert } from '../../src/shared/units';

describe('calculator', () => {
  it.each([
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['2 ^ 3 ^ 2', 512],
    ['-2 ^ 2', -4],
    ['10 % 4', 2],
    ['sqrt(16) + abs(-3)', 7],
    ['2 * pi', 2 * Math.PI],
    ['1.5e3 / 3', 500],
    ['6 × 7 ÷ 2', 21],
    ['log(1000)', 3],
  ])('%s = %s', (expr, v) => {
    expect(evaluate(expr)).toBeCloseTo(v as number, 10);
  });

  it('rejects unsafe or invalid input', () => {
    expect(() => evaluate('process.exit()')).toThrow();
    expect(() => evaluate('alert(1)')).toThrow(/Unknown name/);
    expect(() => evaluate('1 / 0')).toThrow(/Division by zero/);
    expect(() => evaluate('(1 + 2')).toThrow(/Missing/);
    expect(() => evaluate('1 +')).toThrow(/Incomplete/);
    expect(() => evaluate('2 3')).toThrow(/Unexpected/);
  });

  it('formats floating point noise away', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(42)).toBe('42');
  });
});

describe('unit conversion', () => {
  it('converts across systems', () => {
    expect(convert(1, 'length', 'mi', 'km')).toBeCloseTo(1.609344, 9);
    expect(convert(100, 'temperature', 'C', 'F')).toBeCloseTo(212, 9);
    expect(convert(32, 'temperature', 'F', 'K')).toBeCloseTo(273.15, 9);
    expect(convert(1, 'data', 'GiB', 'MB')).toBeCloseTo(1073.741824, 6);
    expect(convert(1, 'mass', 'lb', 'g')).toBeCloseTo(453.59237, 6);
    expect(() => convert(-500, 'temperature', 'C', 'K')).toThrow(/absolute zero/);
  });
});
