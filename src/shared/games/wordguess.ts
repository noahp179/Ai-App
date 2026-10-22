import { WORDS } from './words';

export type LetterState = 'correct' | 'present' | 'absent';
const WORD_SET = new Set(WORDS);
export const MAX_GUESSES = 6;

export function isWord(w: string): boolean {
  return WORD_SET.has(w.toLowerCase());
}

export function pickAnswer(rng: () => number): string {
  return WORDS[Math.floor(rng() * WORDS.length)]!;
}

/**
 * Scores a guess. Repeated letters are only marked "present" as many times as
 * they still occur in the answer after exact matches.
 */
export function evaluate(guess: string, answer: string): LetterState[] {
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();
  const out: LetterState[] = Array(5).fill('absent');
  const remaining = new Map<string, number>();
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) out[i] = 'correct';
    else remaining.set(a[i]!, (remaining.get(a[i]!) ?? 0) + 1);
  }
  for (let i = 0; i < 5; i++) {
    if (out[i] === 'correct') continue;
    const n = remaining.get(g[i]!) ?? 0;
    if (n > 0) {
      out[i] = 'present';
      remaining.set(g[i]!, n - 1);
    }
  }
  return out;
}

/** Best known state per letter, for the on-screen keyboard. */
export function keyboardStates(guesses: string[], answer: string): Record<string, LetterState> {
  const rank: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 };
  const out: Record<string, LetterState> = {};
  for (const g of guesses) {
    evaluate(g, answer).forEach((s, i) => {
      const ch = g[i]!;
      if (!out[ch] || rank[s] > rank[out[ch]!]) out[ch] = s;
    });
  }
  return out;
}
