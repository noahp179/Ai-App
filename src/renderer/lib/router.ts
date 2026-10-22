import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  segments: string[];
  params: URLSearchParams;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/home';
  const [p, q = ''] = raw.split('?');
  const path = (p || '/home').replace(/\/+$/, '') || '/home';
  return { path, segments: path.split('/').filter(Boolean), params: new URLSearchParams(q) };
}

type Guard = (to: string) => string | null;
let guard: Guard | null = null;

/** Lets supervised study sessions redirect navigation to an allowed module. */
export function setNavigationGuard(g: Guard | null): void {
  guard = g;
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const target = guard?.(to) ?? to;
  const hash = `#${target.startsWith('/') ? target : `/${target}`}`;
  if (opts.replace) history.replaceState(null, '', hash);
  else if (location.hash !== hash) location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function currentRoute(): Route {
  return parse(location.hash);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
