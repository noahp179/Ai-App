/** Small formatting helpers shared by every surface. */

/** `1,240` — thin thousands separators, locale-aware. */
export function formatNumber(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(Math.round(value));
}

/** `12.4k` — compact form for stat tiles where space is tight. */
export function formatCompact(value: number): string {
  if (value < 1000) return String(Math.round(value));
  if (value < 1_000_000) {
    const k = value / 1000;
    return `${k < 10 ? k.toFixed(1) : Math.round(k)}k`;
  }
  const m = value / 1_000_000;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)}M`;
}

/** `$12.99`, or `$89.99` — trailing `.00` kept, since prices read wrong without it. */
export function formatPrice(usd: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(usd);
}

/** `4 min`, `1 hr 20 min`. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** `in 3 days`, `tomorrow`, `now` — for review scheduling. */
export function formatRelativeDue(dueAt: number, now: number = Date.now()): string {
  const deltaMs = dueAt - now;
  if (deltaMs <= 0) return 'now';

  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 60) return `in ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} hr`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'tomorrow';
  if (days < 30) return `in ${days} days`;

  const months = Math.round(days / 30);
  return months === 1 ? 'in a month' : `in ${months} months`;
}

/** `86%` from a 0–1 fraction. */
export function formatPercent(fraction: number, decimals = 0): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Pluralize without a dependency: `1 lesson`, `4 lessons`. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${formatNumber(count)} ${word}`;
}

/**
 * Deterministic shuffle from a seed.
 *
 * Used for exercise choice ordering so the same learner sees a stable order
 * across a re-render or an app restart mid-lesson — a shuffle that moves under
 * their finger is maddening — while different learners see different orders.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = seed >>> 0 || 1;

  const nextRandom = (): number => {
    // xorshift32 — small, fast, and good enough for shuffling four choices.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRandom() * (i + 1));
    const a = result[i]!;
    const b = result[j]!;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/** Stable numeric hash of a string, for seeding the shuffle from an id. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
