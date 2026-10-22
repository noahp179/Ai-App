import { useCallback, useEffect, useRef, useState } from 'react';
import { onAppEvent } from './api';

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

/** Reloads every query whose key starts with one of the prefixes. */
export function invalidate(...prefixes: string[]): void {
  for (const [key, set] of listeners) {
    if (prefixes.some((p) => key === p || key.startsWith(`${p}:`) || key.startsWith(`${p}.`))) {
      for (const fn of set) fn();
    }
  }
}

let wired = false;
function wireDataEvents() {
  if (wired) return;
  wired = true;
  onAppEvent('data.changed', ({ entity }) => invalidate(entity));
}

export interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reload: () => void;
  setData: (fn: (prev: T | undefined) => T | undefined) => void;
}

/**
 * Loads data and reloads it when the key changes or when something invalidates
 * the key (a mutation here, or a data.changed event from the main process).
 */
export function useQuery<T>(key: string | null, fetcher: () => Promise<T>): QueryState<T> {
  wireDataEvents();
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(key !== null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const seq = useRef(0);

  const load = useCallback(() => {
    if (key === null) return;
    const mine = ++seq.current;
    setLoading(true);
    fetcherRef
      .current()
      .then((v) => {
        if (mine !== seq.current) return;
        setDataState(v);
        setError(null);
      })
      .catch((e: unknown) => {
        if (mine !== seq.current) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (mine === seq.current) setLoading(false);
      });
  }, [key]);

  useEffect(() => {
    if (key === null) {
      setDataState(undefined);
      setLoading(false);
      return;
    }
    load();
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(load);
    return () => {
      set.delete(load);
      if (set.size === 0) listeners.delete(key);
    };
  }, [key, load]);

  const setData = useCallback((fn: (prev: T | undefined) => T | undefined) => setDataState(fn), []);
  return { data, error, loading, reload: load, setData };
}
