import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Method } from '../../../shared/classroom/transport';
import { ClassroomError, type ClassroomTransport } from '../../../shared/classroom/transport';
import type { UserDto } from '../../../shared/classroom/protocol';

/** Where the user is inside the classroom section. Kept in memory; the section has its own back button. */
export type View =
  | { v: 'home' }
  | { v: 'class'; id: string; tab?: string }
  | { v: 'assessment'; id: string; tab?: string }
  | { v: 'review'; attemptId: string; assessmentId: string }
  | { v: 'intro'; id: string }
  | { v: 'work'; attemptId: string }
  | { v: 'result'; attemptId: string }
  | { v: 'admin'; tab?: string }
  | { v: 'account' };

interface Ctx {
  t: ClassroomTransport;
  me: UserDto;
  view: View;
  go: (v: View) => void;
  back: () => void;
  /** Records which tab is open on the current page, so Back returns to it. */
  rememberTab: (tab: string) => void;
  canGoBack: boolean;
  signOut: () => Promise<void>;
  /** Reloads every query whose key starts with one of the prefixes. */
  refresh: (...prefixes: string[]) => void;
}
const C = createContext<Ctx | null>(null);
export const TransportContext = createContext<ClassroomTransport | null>(null);

export function useTransport(): ClassroomTransport {
  const t = useContext(TransportContext);
  if (!t) throw new Error('No classroom transport');
  return t;
}
export function useClassroom(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error('Outside the classroom section');
  return c;
}

const listeners = new Map<string, Set<() => void>>();
function refresh(...prefixes: string[]) {
  for (const [key, set] of listeners) if (prefixes.some((p) => key === p || key.startsWith(p))) for (const fn of set) fn();
}

export function ClassroomProvider({ t, me, onSignedOut, children }: { t: ClassroomTransport; me: UserDto; onSignedOut: () => void; children: ReactNode }) {
  const [stack, setStack] = useState<View[]>([{ v: 'home' }]);
  const go = useCallback((v: View) => {
    setStack((s) => (JSON.stringify(s.at(-1)) === JSON.stringify(v) ? s : [...s.slice(-30), v]));
    window.scrollTo?.({ top: 0 });
  }, []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const rememberTab = useCallback((tab: string) => setStack((s) => [...s.slice(0, -1), { ...s.at(-1)!, tab } as View]), []);
  const signOut = useCallback(async () => {
    await t.request('DELETE', '/sessions').catch(() => undefined);
    onSignedOut();
  }, [t, onSignedOut]);
  return <C.Provider value={{ t, me, view: stack.at(-1)!, go, back, rememberTab, canGoBack: stack.length > 1, signOut, refresh }}>{children}</C.Provider>;
}

export interface Q<T> {
  data: T | undefined;
  error: ClassroomError | null;
  loading: boolean;
  reload: () => void;
  set: (fn: (prev: T | undefined) => T | undefined) => void;
}

/** GETs a path and keeps the result; `key` defaults to the path, so refresh('/classes') reloads every class query. */
export function useGet<T>(path: string | null, opts: { key?: string; pollMs?: number } = {}): Q<T> {
  const t = useTransport();
  const key = path === null ? null : (opts.key ?? path);
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ClassroomError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const seq = useRef(0);
  const load = useCallback(() => {
    if (path === null) return;
    const mine = ++seq.current;
    setLoading(true);
    t.request<T>('GET', path)
      .then((v) => {
        if (mine !== seq.current) return;
        setData(v);
        setError(null);
      })
      .catch((e: unknown) => {
        if (mine !== seq.current) return;
        setError(e instanceof ClassroomError ? e : new ClassroomError(0, 'error', String(e)));
      })
      .finally(() => mine === seq.current && setLoading(false));
  }, [t, path]);
  useEffect(() => {
    setData(undefined);
    load();
    if (key === null) return;
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(load);
    const timer = opts.pollMs ? setInterval(load, opts.pollMs) : null;
    return () => {
      set.delete(load);
      if (timer) clearInterval(timer);
    };
  }, [key, load, opts.pollMs]);
  return { data, error, loading, reload: load, set: setData };
}

/** Runs a write and reports failures as a message; returns undefined when it failed. */
export function useAction() {
  const t = useTransport();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(label: string, method: Method, path: string, body?: unknown): Promise<T | undefined> => {
      setBusy(label);
      setError(null);
      try {
        return await t.request<T>(method, path, body);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [t],
  );
  return { run, busy, error, setError };
}
