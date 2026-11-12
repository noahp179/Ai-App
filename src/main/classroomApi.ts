import type { ClassroomDesktopApi } from '../shared/api';
import { CLASSROOM_API, type ApiErrorBody, type ChatStreamEvent, type ServerInfo } from '../shared/classroom/protocol';
import { normaliseServerUrl, SESSION_PATHS, sseParser, type Method } from '../shared/classroom/transport';
import { UserError } from '../core/util';
import type { AppContext } from './context';
import { saveFile } from './files';

const URL_KEY = 'classroom.serverUrl';
const TOKEN = 'classroom.sessionToken';
const METHODS = new Set<Method>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/** Classroom errors keep the server's code, prefixed so screens can tell them from app errors. */
class ClassroomUserError extends UserError {
  constructor(status: number, code: string, message: string) {
    super(message, `classroom:${status}:${code}`);
  }
}

function cleanPath(p: unknown): string {
  if (typeof p !== 'string' || !p.startsWith('/') || p.length > 600 || /\s|\.\.|\/\//.test(p)) throw new UserError('Bad classroom path.');
  return p;
}

/**
 * The desktop app's classroom client. The renderer cannot reach other servers (its CSP allows only itself), so
 * classroom requests go through here. The session token is kept in the app's secret store (encrypted by the
 * operating system where available) and never handed to the page.
 */
export function createClassroomApi(ctx: AppContext): ClassroomDesktopApi {
  let lock = false;
  const base = () => ctx.kv.get<string | null>(URL_KEY, null);
  const headers = (extra: Record<string, string> = {}) => {
    const t = ctx.secrets.get(TOKEN);
    return { ...extra, ...(t ? { authorization: `Bearer ${t}` } : {}), 'x-fc-client': 'desktop' };
  };
  const call = async (method: string, path: string, init: { body?: BodyInit; headers?: Record<string, string>; signal?: AbortSignal } = {}) => {
    const b = base();
    if (!b) throw new ClassroomUserError(0, 'not_connected', 'Connect to your school’s classroom server first.');
    let res: Response;
    try {
      res = await fetch(`${b}${CLASSROOM_API}${path}`, { method, headers: headers(init.headers), body: init.body, signal: init.signal ?? AbortSignal.timeout(60_000), redirect: 'error' });
    } catch {
      throw new ClassroomUserError(0, 'offline', 'The classroom server could not be reached. Check your connection.');
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as ApiErrorBody | null;
      if (res.status === 401) ctx.secrets.delete(TOKEN);
      throw new ClassroomUserError(res.status, data?.error.code ?? 'http_error', data?.error.message ?? `The server answered ${res.status}.`);
    }
    return res;
  };

  return {
    status: () => ({ url: base(), signedIn: !!ctx.secrets.get(TOKEN) }),
    async connect(url) {
      const u = normaliseServerUrl(String(url));
      let info: ServerInfo;
      try {
        const res = await fetch(`${u}${CLASSROOM_API}/info`, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
        info = (await res.json()) as ServerInfo;
        if (!res.ok || typeof info?.name !== 'string' || !info.capabilities) throw new Error('not a classroom server');
      } catch {
        throw new ClassroomUserError(0, 'not_classroom', 'No FlowCompanion classroom server answered at that address.');
      }
      if (u !== base()) ctx.secrets.delete(TOKEN);
      ctx.kv.set(URL_KEY, u);
      return info;
    },
    disconnect() {
      ctx.secrets.delete(TOKEN);
      ctx.kv.delete(URL_KEY);
      lock = false;
      ctx.classroomLock = false;
    },
    async request(method, path, body) {
      if (!METHODS.has(method)) throw new UserError('Bad method.');
      const p = cleanPath(path);
      if (method === 'DELETE' && p === '/sessions') {
        await call('DELETE', p).catch(() => undefined);
        ctx.secrets.delete(TOKEN);
        return { ok: true };
      }
      // Writes always carry a JSON body (the server requires one); an empty object when there is nothing to send.
      const payload = method === 'GET' || (method === 'DELETE' && body === undefined) ? null : (body ?? {});
      const res = await call(method, p, payload === null ? {} : { body: JSON.stringify(payload), headers: { 'content-type': 'application/json' } });
      const data = (await res.json()) as Record<string, unknown>;
      if (method === 'POST' && SESSION_PATHS.includes(p)) {
        // /join nests the session; the others return it at the top level.
        const nested = data.session as { token?: unknown } | undefined;
        const token = typeof data.token === 'string' ? data.token : typeof nested?.token === 'string' ? nested.token : '';
        if (token) {
          ctx.secrets.set(TOKEN, token);
          return nested ? { ...data, session: { ...nested, token: '' } } : { ...data, token: '' };
        }
      }
      return data;
    },
    async upload(path, query, name, type, bytes) {
      const p = cleanPath(path);
      if (!(bytes instanceof Uint8Array)) throw new UserError('Bad file.');
      const q = new URLSearchParams(Object.fromEntries(Object.entries(query ?? {}).map(([k, v]) => [k, String(v)])));
      q.set('name', String(name));
      const res = await call('POST', `${p}?${q}`, { body: bytes as BodyInit, headers: { 'content-type': String(type) || 'application/octet-stream', 'x-fc-rights': 'confirmed' }, signal: AbortSignal.timeout(300_000) });
      return res.json();
    },
    async stream(path, body, streamId) {
      const p = cleanPath(path);
      const id = String(streamId).slice(0, 80);
      const send = (event: ChatStreamEvent) => ctx.emit('classroom.stream', { streamId: id, event });
      const res = await call('POST', p, { body: JSON.stringify(body), headers: { 'content-type': 'application/json', accept: 'text/event-stream' }, signal: AbortSignal.timeout(600_000) });
      const feed = sseParser(send);
      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        feed(value);
      }
      return true;
    },
    async saveText(filename, text) {
      const name = String(filename).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120);
      const ext = name.split('.').pop() ?? 'txt';
      return (await saveFile(name, String(text), [{ name: ext.toUpperCase(), extensions: [ext] }])).saved;
    },
    setAssessmentLock(on) {
      lock = !!on;
      ctx.classroomLock = lock;
    },
  };
}
