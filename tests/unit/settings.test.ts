import { describe, expect, it } from 'vitest';
import { KvStore } from '../../src/core/kv';
import { SettingsService, loadSettings } from '../../src/core/settings';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
import { FakeClock, memoryDb } from '../helpers/db';

function service() {
  const db = memoryDb();
  const kv = new KvStore(db, new FakeClock());
  return { db, kv, settings: new SettingsService(kv) };
}

describe('settings', () => {
  it('starts from defaults', () => {
    const { settings } = service();
    expect(settings.get()).toEqual(DEFAULT_SETTINGS);
    expect(settings.get().appearance.theme).toBe('dark');
    expect(settings.get().browser.bridgeEnabled).toBe(false);
  });

  it('persists updates across service instances (restart)', () => {
    const { kv, settings } = service();
    settings.update({ appearance: { theme: 'light', fontScale: 1.2 }, notifications: { quietHours: { enabled: true } } });
    const reloaded = new SettingsService(kv);
    expect(reloaded.get().appearance.theme).toBe('light');
    expect(reloaded.get().appearance.fontScale).toBe(1.2);
    expect(reloaded.get().notifications.quietHours).toEqual({ enabled: true, start: '22:00', end: '07:00' });
    expect(reloaded.get().appearance.accent).toBe('indigo');
  });

  it('rejects invalid values with a readable message and keeps the old value', () => {
    const { settings } = service();
    expect(() => settings.update({ appearance: { fontScale: 9 } })).toThrow(/appearance.fontScale/);
    expect(() => settings.update({ notifications: { quietHours: { start: '25:00' } } })).toThrow(/HH:MM/);
    expect(() => settings.update({ shortcuts: { quickCapture: 'K' } })).toThrow(/modifier/);
    expect(() => settings.update({ marketplace: { serverUrl: 'javascript:alert(1)' } })).toThrow();
    expect(settings.get().appearance.fontScale).toBe(1);
  });

  it('ignores prototype pollution keys', () => {
    const { settings } = service();
    settings.update(JSON.parse('{"__proto__": {"polluted": true}, "appearance": {"theme": "light"}}'));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(settings.get().appearance.theme).toBe('light');
  });

  it('repairs individual invalid stored values instead of discarding everything', () => {
    const { settings, repaired } = loadSettings({
      appearance: { theme: 'neon', fontScale: 1.1 },
      calendar: { weekStartsOn: 3 },
      unknownSection: { x: 1 },
    });
    expect(settings.appearance.theme).toBe('dark');
    expect(settings.appearance.fontScale).toBe(1.1);
    expect(settings.calendar.weekStartsOn).toBe(1);
    expect(repaired).toEqual(expect.arrayContaining(['appearance.theme', 'calendar.weekStartsOn']));
  });

  it('keeps home and settings modules on', () => {
    const { settings } = service();
    const s = settings.update({ layout: { modules: { home: false, settings: false, games: false } } });
    expect(s.layout.modules.home).toBe(true);
    expect(s.layout.modules.settings).toBe(true);
    expect(s.layout.modules.games).toBe(false);
  });

  it('applies mode presets', () => {
    const { settings } = service();
    const s = settings.applyMode('parent');
    expect(s.layout.mode).toBe('parent');
    expect(s.layout.modules.games).toBe(false);
    expect(s.layout.modules.learning).toBe(true);
    expect(settings.applyMode('advanced').layout.modules.games).toBe(true);
  });

  it('emits change events with the previous value', () => {
    const { settings } = service();
    const seen: string[] = [];
    settings.events.on('changed', ({ settings: s, previous }) => seen.push(`${previous.appearance.theme}->${s.appearance.theme}`));
    settings.update({ appearance: { theme: 'system' } });
    expect(seen).toEqual(['dark->system']);
  });

  it('resets a single section', () => {
    const { settings } = service();
    settings.update({ appearance: { theme: 'light' }, notes: { autosaveDelayMs: 2000 } });
    const s = settings.reset('notes');
    expect(s.notes.autosaveDelayMs).toBe(800);
    expect(s.appearance.theme).toBe('light');
  });
});
