import { globalShortcut } from 'electron';
import type { ShortcutStatus } from '../shared/api';
import type { Settings } from '../shared/settings';

export type ShortcutHandlers = Record<ShortcutStatus['name'], () => void>;

/** (Re)registers global shortcuts from settings and reports what actually took effect. */
export function applyShortcuts(settings: Settings, handlers: ShortcutHandlers): ShortcutStatus[] {
  globalShortcut.unregisterAll();
  const names: ShortcutStatus['name'][] = ['toggleCompanion', 'quickCapture', 'showMainWindow'];
  const seen = new Set<string>();
  return names.map((name) => {
    const accelerator = settings.shortcuts[name];
    if (!settings.shortcuts.enabled) return { name, accelerator, registered: false, error: 'Global shortcuts are turned off.' };
    if (!accelerator) return { name, accelerator, registered: false, error: 'No shortcut set.' };
    if (seen.has(accelerator.toLowerCase())) return { name, accelerator, registered: false, error: 'Already used by another FlowCompanion shortcut.' };
    seen.add(accelerator.toLowerCase());
    try {
      const ok = globalShortcut.register(accelerator, handlers[name]);
      return { name, accelerator, registered: ok, error: ok ? null : 'Another application is already using this shortcut.' };
    } catch (err) {
      return { name, accelerator, registered: false, error: err instanceof Error ? err.message : 'Invalid shortcut.' };
    }
  });
}
