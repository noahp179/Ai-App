import { MODULE_IDS, type ModuleId } from './settings';
import type { ParentalConfig, SearchHit, StudySession } from './types';

/** Always reachable, even when locked down: Home, and Settings (so a parent can enter the PIN). */
export const ALWAYS_ALLOWED_MODULES: readonly ModuleId[] = ['home', 'settings'];

/** Sections a parent can lock. Optional extras are listed first. */
export const LOCKABLE_MODULES: readonly ModuleId[] = (['news', 'games', 'marketplace', 'creator', 'prompts', 'ai', 'learning', 'study', 'notes', 'productivity', 'calendar'] as ModuleId[]).filter((m) =>
  MODULE_IDS.includes(m),
);

/**
 * Whether a section may open. During a study session only the session's sections (plus Home and Settings) open,
 * including ones that are otherwise locked. Outside sessions, locked sections stay closed.
 */
export function isModuleOpen(enabled: boolean, config: Pick<ParentalConfig, 'lockedModules'>, session: Pick<StudySession, 'allowedModules'> | null, id: ModuleId): boolean {
  if (!enabled) return true;
  if (ALWAYS_ALLOWED_MODULES.includes(id)) return true;
  if (session) return session.allowedModules.includes(id);
  return !config.lockedModules.includes(id);
}

/** Which section a search result belongs to, so results from locked sections can be left out. */
export const SEARCH_HIT_MODULE: Record<SearchHit['type'], ModuleId> = {
  note: 'notes',
  task: 'productivity',
  bookmark: 'productivity',
  prompt: 'prompts',
  conversation: 'ai',
  event: 'calendar',
  resource: 'learning',
  article: 'news',
};
