import { shuffle } from './rng';

export type Grid = number[]; // 81 cells, 0 = empty
export type Difficulty = 'easy' | 'medium' | 'hard';
const CLUES: Record<Difficulty, number> = { easy: 40, medium: 32, hard: 27 };

const row = (i: number) => Math.floor(i / 9);
const col = (i: number) => i % 9;
const box = (i: number) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);

/** Candidates for a cell as a bitmask (bit n set = digit n allowed). */
function candidates(g: Grid, i: number): number {
  let used = 0;
  const r = row(i);
  const c = col(i);
  const b = box(i);
  for (let k = 0; k < 81; k++) {
    if (g[k] && (row(k) === r || col(k) === c || box(k) === b)) used |= 1 << g[k]!;
  }
  return ~used & 0b1111111110;
}

/** Counts solutions up to `limit` using most-constrained-cell backtracking. */
export function countSolutions(g: Grid, limit = 2): number {
  const grid = [...g];
  let count = 0;
  const solve = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestBits = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const m = candidates(grid, i);
      const bits = popcount(m);
      if (bits === 0) return false;
      if (bits < bestBits) {
        best = i;
        bestMask = m;
        bestBits = bits;
        if (bits === 1) break;
      }
    }
    if (best < 0) {
      count++;
      return count >= limit;
    }
    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & (1 << d))) continue;
      grid[best] = d;
      if (solve()) return true;
      grid[best] = 0;
    }
    return false;
  };
  solve();
  return count;
}

function popcount(n: number): number {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

function fullGrid(rng: () => number): Grid {
  const g: Grid = new Array(81).fill(0);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    const mask = candidates(g, i);
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
      if (!(mask & (1 << d))) continue;
      g[i] = d;
      if (fill(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  };
  fill(0);
  return g;
}

/** Generates a puzzle with exactly one solution. */
export function generate(difficulty: Difficulty, rng: () => number): { puzzle: Grid; solution: Grid } {
  const solution = fullGrid(rng);
  const puzzle = [...solution];
  let filled = 81;
  for (const i of shuffle([...Array(81).keys()], rng)) {
    if (filled <= CLUES[difficulty]) break;
    const keep = puzzle[i]!;
    puzzle[i] = 0;
    if (countSolutions(puzzle, 2) !== 1) puzzle[i] = keep;
    else filled--;
  }
  return { puzzle, solution };
}

/** Cells whose value clashes with another in the same row, column or box. */
export function conflicts(g: Grid): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < 81; i++) {
    if (!g[i]) continue;
    for (let k = i + 1; k < 81; k++) {
      if (g[k] === g[i] && (row(k) === row(i) || col(k) === col(i) || box(k) === box(i))) {
        out.add(i);
        out.add(k);
      }
    }
  }
  return out;
}

export function isSolved(g: Grid, solution: Grid): boolean {
  return g.every((v, i) => v === solution[i]);
}
