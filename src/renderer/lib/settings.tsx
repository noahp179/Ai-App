import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Settings, SettingsPatch } from '../../shared/settings';
import { api, onAppEvent } from './api';

interface SettingsCtx {
  settings: Settings;
  update: (patch: SettingsPatch) => Promise<Settings>;
}

const Ctx = createContext<SettingsCtx | null>(null);

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Applies appearance settings to the document root. */
export function applyAppearance(s: Settings): void {
  const root = document.documentElement;
  const theme = s.appearance.theme === 'system' ? (prefersDark() ? 'dark' : 'light') : s.appearance.theme;
  root.dataset.theme = theme;
  root.dataset.accent = s.appearance.accent;
  root.dataset.density = s.appearance.density;
  root.dataset.contrast = s.appearance.highContrast ? 'high' : 'normal';
  const reduce = s.appearance.reducedMotion === 'reduce' || (s.appearance.reducedMotion === 'system' && prefersReducedMotion());
  root.dataset.motion = reduce ? 'reduce' : 'allow';
  root.style.setProperty('--font-scale', String(s.appearance.fontScale));
}

export function reducedMotion(s: Settings): boolean {
  return s.appearance.reducedMotion === 'reduce' || (s.appearance.reducedMotion === 'system' && prefersReducedMotion());
}

export function SettingsProvider({ initial, children }: { initial: Settings; children: ReactNode }) {
  const [settings, setSettings] = useState(initial);

  useEffect(() => onAppEvent('settings.changed', setSettings), []);
  useEffect(() => {
    applyAppearance(settings);
    const mq = [window.matchMedia('(prefers-color-scheme: dark)'), window.matchMedia('(prefers-reduced-motion: reduce)')];
    const on = () => applyAppearance(settings);
    mq.forEach((m) => m.addEventListener('change', on));
    return () => mq.forEach((m) => m.removeEventListener('change', on));
  }, [settings]);

  const update = useCallback(async (patch: SettingsPatch) => {
    const next = await api.settings.update(patch);
    setSettings(next);
    return next;
  }, []);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings outside SettingsProvider');
  return v;
}
