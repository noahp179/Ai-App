import type { z } from 'zod';
import {
  ALWAYS_ON_MODULES,
  DEFAULT_SETTINGS,
  MODE_PRESETS,
  type AppMode,
  type Settings,
  SettingsSchema,
} from '../shared/settings';
import type { KvStore } from './kv';
import { Emitter, UserError, deepMerge, isPlainObject } from './util';

const KEY = 'settings';

function deletePath(obj: unknown, pathParts: readonly PropertyKey[]): boolean {
  if (pathParts.length === 0 || !isPlainObject(obj)) return false;
  const [head, ...rest] = pathParts;
  const key = String(head);
  if (rest.length === 0) {
    if (!(key in obj)) return false;
    delete obj[key];
    return true;
  }
  return deletePath(obj[key], rest);
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || 'settings'}: ${i.message}`)
    .join('; ');
}

/**
 * Loads stored settings, dropping any individual value that no longer
 * validates so it falls back to its default instead of failing startup.
 */
export function loadSettings(stored: unknown): { settings: Settings; repaired: string[] } {
  const raw: unknown = isPlainObject(stored) ? structuredClone(stored) : {};
  const repaired: string[] = [];
  for (let attempt = 0; attempt < 50; attempt++) {
    const parsed = SettingsSchema.safeParse(raw);
    if (parsed.success) return { settings: enforceInvariants(parsed.data), repaired };
    let removedAny = false;
    for (const issue of parsed.error.issues) {
      if (deletePath(raw, issue.path)) {
        repaired.push(issue.path.join('.'));
        removedAny = true;
      }
    }
    if (!removedAny) break;
  }
  return { settings: structuredClone(DEFAULT_SETTINGS), repaired: ['*'] };
}

function enforceInvariants(s: Settings): Settings {
  for (const m of ALWAYS_ON_MODULES) s.layout.modules[m] = true;
  return s;
}

export interface SettingsEvents extends Record<string, unknown> {
  changed: { settings: Settings; previous: Settings };
}

export class SettingsService {
  private current: Settings;
  readonly events = new Emitter<SettingsEvents>();
  readonly repairedOnLoad: string[];

  constructor(private readonly kv: KvStore) {
    const { settings, repaired } = loadSettings(kv.get<unknown>(KEY, {}));
    this.current = settings;
    this.repairedOnLoad = repaired;
    if (repaired.length > 0) this.kv.set(KEY, settings);
  }

  get(): Settings {
    return structuredClone(this.current);
  }

  update(patch: unknown): Settings {
    if (!isPlainObject(patch)) throw new UserError('Settings update must be an object.');
    const merged = deepMerge(structuredClone(this.current), patch);
    const parsed = SettingsSchema.safeParse(merged);
    if (!parsed.success) throw new UserError(`Invalid setting — ${describeIssues(parsed.error)}`);
    return this.commit(enforceInvariants(parsed.data));
  }

  /** Switches mode and applies that mode's module preset. */
  applyMode(mode: AppMode): Settings {
    const preset = MODE_PRESETS[mode];
    if (!preset) throw new UserError(`Unknown mode: ${mode}`);
    const modules = { ...DEFAULT_SETTINGS.layout.modules, ...preset.modules };
    return this.update({ layout: { mode, modules } });
  }

  reset(section?: keyof Settings): Settings {
    if (section === undefined) return this.commit(structuredClone(DEFAULT_SETTINGS));
    if (!(section in DEFAULT_SETTINGS)) throw new UserError(`Unknown settings section: ${String(section)}`);
    const next = structuredClone(this.current);
    (next as Record<string, unknown>)[section] = structuredClone(DEFAULT_SETTINGS[section]);
    return this.commit(next);
  }

  private commit(next: Settings): Settings {
    const previous = this.current;
    this.current = next;
    this.kv.set(KEY, next);
    this.events.emit('changed', { settings: this.get(), previous });
    return this.get();
  }
}
