/**
 * How much of a student's written answer also appears in the AI assistant's messages. Computed by code, not by AI:
 * shared word sequences and an n-gram score. A high score shows that text matches; it does not show why.
 */
export interface OverlapPassage {
  text: string;
  /** Character range in the answer. */
  answerStart: number;
  answerEnd: number;
  messageId: string;
}
export interface OverlapResult {
  similarity: number;
  passages: OverlapPassage[];
}

interface Tok {
  w: string;
  start: number;
  end: number;
}
const tokens = (s: string): Tok[] => [...s.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu)].map((m) => ({ w: m[0].toLowerCase().replace(/’/g, "'"), start: m.index, end: m.index + m[0].length }));

const N = 4;
/** Shared runs shorter than this many words are ordinary language, not copying. */
export const MIN_PASSAGE_WORDS = 6;

export function computeOverlap(answer: string, messages: { id: string; text: string }[]): OverlapResult {
  const a = tokens(answer);
  if (a.length < N || !messages.length) return { similarity: 0, passages: [] };
  const grams = new Map<string, string>();
  const sources = messages.map((m) => ({ id: m.id, toks: tokens(m.text) }));
  for (const s of sources) for (let i = 0; i + N <= s.toks.length; i++) grams.set(s.toks.slice(i, i + N).map((t) => t.w).join(' '), s.id);
  let shared = 0;
  const covered: (string | null)[] = a.map(() => null);
  for (let i = 0; i + N <= a.length; i++) {
    const id = grams.get(a.slice(i, i + N).map((t) => t.w).join(' '));
    if (!id) continue;
    shared++;
    for (let k = i; k < i + N; k++) covered[k] = covered[k] ?? id;
  }
  const passages: OverlapPassage[] = [];
  for (let i = 0; i < a.length; ) {
    if (!covered[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < a.length && covered[j + 1]) j++;
    if (j - i + 1 >= MIN_PASSAGE_WORDS) passages.push({ text: answer.slice(a[i]!.start, a[j]!.end), answerStart: a[i]!.start, answerEnd: a[j]!.end, messageId: covered[i]! });
    i = j + 1;
  }
  return { similarity: Math.round((shared / (a.length - N + 1)) * 100) / 100, passages };
}

/** True when `quote` appears word for word in `text` (ignoring case, extra spaces and curly quotes). */
export function isVerbatim(quote: string, text: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  const q = norm(quote);
  return q.length >= 3 && norm(text).includes(q);
}
