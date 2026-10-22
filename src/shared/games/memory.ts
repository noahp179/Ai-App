import { shuffle } from './rng';

export const MEMORY_SYMBOLS = ['star', 'heart', 'moon', 'sun', 'cloud', 'leaf', 'flame', 'zap', 'anchor', 'bell', 'camera', 'gift', 'key', 'music', 'feather', 'umbrella', 'coffee', 'rocket'] as const;
export type MemorySymbol = (typeof MEMORY_SYMBOLS)[number];

export interface MemoryCard {
  id: number;
  symbol: MemorySymbol;
  matched: boolean;
}

export interface MemoryState {
  cards: MemoryCard[];
  open: number[];
  moves: number;
  matches: number;
  done: boolean;
}

export function newMemoryGame(pairs: number, rng: () => number): MemoryState {
  const symbols = shuffle(MEMORY_SYMBOLS, rng).slice(0, pairs);
  const cards = shuffle([...symbols, ...symbols], rng).map((symbol, id) => ({ id, symbol, matched: false }));
  return { cards, open: [], moves: 0, matches: 0, done: false };
}

/** Flips a card. Two non-matching open cards must be closed with `closeOpen` before the next flip. */
export function flip(s: MemoryState, id: number): MemoryState {
  const card = s.cards[id];
  if (!card || card.matched || s.open.includes(id) || s.open.length >= 2 || s.done) return s;
  const open = [...s.open, id];
  if (open.length < 2) return { ...s, open };
  const [a, b] = open as [number, number];
  const moves = s.moves + 1;
  if (s.cards[a]!.symbol === s.cards[b]!.symbol) {
    const cards = s.cards.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c));
    const matches = s.matches + 1;
    return { cards, open: [], moves, matches, done: matches === cards.length / 2 };
  }
  return { ...s, open, moves };
}

export function closeOpen(s: MemoryState): MemoryState {
  return s.open.length === 2 ? { ...s, open: [] } : s;
}
