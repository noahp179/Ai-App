import { describe, expect, it } from 'vitest';
import { closeOpen, flip, newMemoryGame } from '../../src/shared/games/memory';
import { mulberry32 } from '../../src/shared/games/rng';
import { conflicts, countSolutions, generate, isSolved } from '../../src/shared/games/sudoku';
import { TRIVIA, newTriviaRound } from '../../src/shared/games/trivia';
import { evaluate, isWord, keyboardStates } from '../../src/shared/games/wordguess';
import { WORDS } from '../../src/shared/games/words';

describe('word guess', () => {
  it('scores exact, present and absent letters with repeats handled', () => {
    expect(evaluate('crane', 'cream')).toEqual(['correct', 'correct', 'present', 'absent', 'present']);
    // "abide" has one "e": the first misplaced "e" is present, the second is absent.
    expect(evaluate('speed', 'abide')).toEqual(['absent', 'absent', 'present', 'absent', 'present']);
    expect(evaluate('geese', 'theme')).toEqual(['absent', 'absent', 'correct', 'absent', 'correct']);
    expect(evaluate('apple', 'apple').every((s) => s === 'correct')).toBe(true);
  });

  it('validates words and summarises keyboard state', () => {
    expect(isWord('Crane')).toBe(true);
    expect(isWord('zzzzz')).toBe(false);
    expect(keyboardStates(['crane', 'cream'], 'cream')).toMatchObject({ c: 'correct', r: 'correct', a: 'correct', n: 'absent', e: 'correct', m: 'correct' });
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });
});

describe('sudoku', () => {
  it.each(['easy', 'medium', 'hard'] as const)('generates a %s puzzle with exactly one solution', (d) => {
    const { puzzle, solution } = generate(d, mulberry32(42));
    expect(countSolutions(puzzle, 2)).toBe(1);
    expect(conflicts(solution).size).toBe(0);
    expect(puzzle.every((v, i) => v === 0 || v === solution[i])).toBe(true);
    const clues = puzzle.filter(Boolean).length;
    expect(clues).toBeGreaterThanOrEqual({ easy: 40, medium: 32, hard: 27 }[d]);
    expect(clues).toBeLessThan(55);
  });

  it('detects conflicts and completion', () => {
    const { puzzle, solution } = generate('easy', mulberry32(7));
    const g = [...puzzle];
    const empty = g.indexOf(0);
    const rowFirst = Math.floor(empty / 9) * 9;
    const clash = g.slice(rowFirst, rowFirst + 9).find((v) => v > 0)!;
    g[empty] = clash;
    expect(conflicts(g).has(empty)).toBe(true);
    expect(isSolved(solution, solution)).toBe(true);
    expect(isSolved(puzzle, solution)).toBe(false);
  });
});

describe('memory', () => {
  it('matches pairs, counts moves and finishes', () => {
    let s = newMemoryGame(2, mulberry32(1));
    const pairsOf = (sym: string) => s.cards.filter((c) => c.symbol === sym).map((c) => c.id);
    const [a1, a2] = pairsOf(s.cards[0]!.symbol) as [number, number];
    const other = s.cards.find((c) => c.symbol !== s.cards[0]!.symbol)!;
    s = flip(s, a1);
    s = flip(s, other.id);
    expect(s.open).toHaveLength(2);
    expect(flip(s, a2)).toBe(s); // must close first
    s = closeOpen(s);
    s = flip(flip(s, a1), a2);
    expect(s.matches).toBe(1);
    const [b1, b2] = pairsOf(other.symbol) as [number, number];
    s = flip(flip(s, b1), b2);
    expect(s).toMatchObject({ done: true, moves: 3, matches: 2 });
  });
});

describe('trivia', () => {
  it('has well-formed questions and shuffles answers', () => {
    expect(TRIVIA.length).toBeGreaterThanOrEqual(40);
    for (const t of TRIVIA) {
      expect(t.options).toHaveLength(4);
      expect(new Set(t.options).size).toBe(4);
    }
    const round = newTriviaRound(10, mulberry32(3));
    expect(round.questions).toHaveLength(10);
    for (const q of round.questions) {
      const src = TRIVIA.find((t) => t.q === q.q)!;
      expect(q.options[q.answer]).toBe(src.options[0]);
    }
  });
});

describe('games service', async () => {
  const { GamesService } = await import('../../src/core/games');
  const { FakeClock, memoryDb } = await import('../helpers/db');
  it('records scores and computes best by direction', () => {
    const g = new GamesService(memoryDb(), new FakeClock());
    g.record('reaction', 310);
    g.record('reaction', 245);
    g.record('trivia', 6, { total: 10 });
    g.record('trivia', 9, { total: 10 });
    g.record('wordguess', 7, { won: false });
    g.record('wordguess', 4, { won: true });
    expect(g.stats('reaction').best?.score).toBe(245);
    expect(g.stats('trivia').best?.score).toBe(9);
    expect(g.stats('wordguess')).toMatchObject({ played: 2, best: { score: 4 } });
    g.saveState('sudoku', { cells: [1, 2] });
    expect(g.loadState('sudoku')).toEqual({ cells: [1, 2] });
    expect(() => g.record('chess' as never, 1)).toThrow(/Unknown game/);
  });
});
