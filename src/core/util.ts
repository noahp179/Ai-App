import { randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export const nowIso = (clock: Clock): string => clock.now().toISOString();

/** An error whose message is written for the person using the app and is safe to show. */
export class UserError extends Error {
  constructor(
    message: string,
    readonly code: string = 'invalid_input',
  ) {
    super(message);
    this.name = 'UserError';
  }
}

export class NotFoundError extends UserError {
  constructor(what: string) {
    super(`${what} was not found. It may have been deleted.`, 'not_found');
    this.name = 'NotFoundError';
  }
}

type Listener<T> = (value: T) => void;

export class Emitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(event: K, fn: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Listener<never>);
    return () => set.delete(fn as Listener<never>);
  }

  emit<K extends keyof Events>(event: K, value: Events[K]): void {
    for (const fn of this.listeners.get(event) ?? []) {
      try {
        (fn as Listener<Events[K]>)(value);
      } catch (err) {
        console.error(`listener for ${String(event)} failed`, err);
      }
    }
  }
}

/** Trims, collapses whitespace and caps the length of a single-line string. */
export function cleanLine(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function cleanTags(tags: readonly string[]): string[] {
  const out = new Set<string>();
  for (const t of tags) {
    const tag = t
      .toLowerCase()
      .replace(/^#/, '')
      .replace(/[^\p{L}\p{N}_\- /]/gu, '')
      .trim()
      .slice(0, 40);
    if (tag) out.add(tag);
    if (out.size >= 30) break;
  }
  return [...out];
}

/** Accepts only http(s) URLs. Returns the normalized URL or null. */
export function safeHttpUrl(value: string): string | null {
  try {
    const u = new URL(value.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

/** Objects merge recursively; arrays and primitives replace. Ignores prototype keys. */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch) || !isPlainObject(base)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

export function excerpt(text: string, max = 160): string {
  const flat = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~[\]()!-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}
