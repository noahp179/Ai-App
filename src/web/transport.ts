import { CLASSROOM_API, type ApiErrorBody } from '../shared/classroom/protocol';
import { ClassroomError, sseParser, type ClassroomTransport, type Method } from '../shared/classroom/transport';

/**
 * The browser build talks to the server that served the page. The session lives in an HttpOnly cookie the page
 * cannot read; every request carries `x-fc-client: web`, which the server requires on cookie-authenticated writes
 * (another site's form cannot set it).
 */
const HEADERS = { 'x-fc-client': 'web' };

async function fail(res: Response): Promise<never> {
  const data = (await res.json().catch(() => null)) as ApiErrorBody | null;
  throw new ClassroomError(res.status, data?.error.code ?? 'http_error', data?.error.message ?? `The server answered ${res.status}.`);
}

export const webTransport: ClassroomTransport = {
  kind: 'web',
  async status() {
    return { url: location.origin, signedIn: true };
  },
  async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    // Writes always carry a JSON body (the server requires one); an empty object when there is nothing to send.
    if (body === undefined && method !== 'GET' && method !== 'DELETE') body = {};
    let res: Response;
    try {
      res = await fetch(`${CLASSROOM_API}${path}`, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? HEADERS : { ...HEADERS, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ClassroomError(0, 'offline', 'The classroom server could not be reached. Check your connection.');
    }
    if (!res.ok) return fail(res);
    return (await res.json()) as T;
  },
  async upload<T>(path: string, query: Record<string, string>, file: { name: string; type: string; bytes: Uint8Array }): Promise<T> {
    const res = await fetch(`${CLASSROOM_API}${path}?${new URLSearchParams({ ...query, name: file.name })}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { ...HEADERS, 'content-type': 'application/octet-stream', 'x-fc-rights': 'confirmed' },
      body: file.bytes as BodyInit,
    }).catch(() => {
      throw new ClassroomError(0, 'offline', 'The classroom server could not be reached. Check your connection.');
    });
    if (!res.ok) return fail(res);
    return (await res.json()) as T;
  },
  async stream(path, body, onEvent) {
    const res = await fetch(`${CLASSROOM_API}${path}`, { method: 'POST', credentials: 'same-origin', headers: { ...HEADERS, 'content-type': 'application/json', accept: 'text/event-stream' }, body: JSON.stringify(body) }).catch(() => {
      throw new ClassroomError(0, 'offline', 'The classroom server could not be reached. Check your connection.');
    });
    if (!res.ok) return fail(res);
    const feed = sseParser(onEvent);
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      feed(value);
    }
  },
  async saveText(filename, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  },
};
