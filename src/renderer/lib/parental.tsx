import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ModuleId } from '../../shared/settings';
import type { ParentalStatus } from '../../shared/types';
import { useToast } from '../components/ui';
import { api } from './api';
import { useQuery } from './query';

export interface ParentalView extends ParentalStatus {
  isModuleAllowed: (id: ModuleId) => boolean;
}

const Ctx = createContext<ParentalView | null>(null);

const ALWAYS: ModuleId[] = ['home', 'settings'];

function view(s: ParentalStatus, now: number): ParentalView {
  const session = s.session && new Date(s.session.endsAt).getTime() > now ? s.session : null;
  return {
    ...s,
    session,
    isModuleAllowed: (id) => {
      if (!s.enabled) return true;
      if (session) return ALWAYS.includes(id) || session.allowedModules.includes(id);
      return !(id === 'games' && s.config.hideGamesOutsideSessions);
    },
  };
}

/**
 * Parental learning controls state for the UI. The main process is the authority (it blocks copies and adds the tutor
 * instructions); this provider mirrors the state and adds an in-page guard so keyboard copy of AI answers is blocked too.
 */
export function ParentalProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const q = useQuery('parental:status', () => api.parental.status());
  const [now, setNow] = useState(() => Date.now());
  const s = q.data;
  const restrictCopy = !!s?.enabled && s.config.copyRestriction;

  // Re-evaluate once per second while a session runs, so the countdown and module locks update on time.
  useEffect(() => {
    if (!s?.session) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [s?.session]);

  useEffect(() => {
    if (!restrictCopy) return;
    const inAi = (n: Node | null) => !!(n && (n instanceof Element ? n : n.parentElement)?.closest('[data-copy-context="ai"]'));
    const guard = (e: ClipboardEvent) => {
      const sel = document.getSelection();
      if (sel && !sel.isCollapsed && (inAi(sel.anchorNode) || inAi(sel.focusNode))) {
        e.preventDefault();
        toast('Copying AI answers is turned off by Parental Learning Controls.', 'error');
      }
    };
    const noDrag = (e: DragEvent) => {
      if (inAi(e.target as Node)) e.preventDefault();
    };
    document.addEventListener('copy', guard, true);
    document.addEventListener('cut', guard, true);
    document.addEventListener('dragstart', noDrag, true);
    return () => {
      document.removeEventListener('copy', guard, true);
      document.removeEventListener('cut', guard, true);
      document.removeEventListener('dragstart', noDrag, true);
    };
  }, [restrictCopy, toast]);

  const value = useMemo(() => (s ? view(s, now) : null), [s, now]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useParental(): ParentalView | null {
  return useContext(Ctx);
}
