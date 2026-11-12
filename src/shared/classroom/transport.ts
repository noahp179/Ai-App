import type { ChatStreamEvent, ServerInfo } from './protocol';

/**
 * How the classroom screens reach the classroom service. The same React screens run in the desktop app (requests go
 * through the main process, which keeps the session token in the app's secret store) and in a browser (fetch with
 * an HttpOnly session cookie). Screens only ever talk to this interface.
 */
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface TransportStatus {
  /** The server this client talks to. In the browser it is always the page's own origin. */
  url: string | null;
  /** Whether a session is stored (it may still have expired on the server). */
  signedIn: boolean;
}

export interface UploadFile {
  name: string;
  type: string;
  bytes: Uint8Array;
}

export interface ClassroomTransport {
  readonly kind: 'desktop' | 'web';
  status(): Promise<TransportStatus>;
  /** Desktop only: chooses the server and checks that it answers. */
  connect?(url: string): Promise<ServerInfo>;
  disconnect?(): Promise<void>;
  request<T>(method: Method, path: string, body?: unknown): Promise<T>;
  /** Raw upload: the file body with name and folder in the query string, rights confirmed in a header. */
  upload<T>(path: string, query: Record<string, string>, file: UploadFile): Promise<T>;
  /** Server-sent events from a POST (the assistant chat). Resolves when the stream ends. */
  stream(path: string, body: unknown, onEvent: (e: ChatStreamEvent) => void): Promise<void>;
  /** Saves text the server produced (CSV, exports) where the user chooses. */
  saveText(filename: string, text: string, mime: string): Promise<boolean>;
  /**
   * Desktop only: while an assessment is open, the app refuses to copy text to the clipboard from anywhere in
   * the app (not just this page). The browser cannot do this; the page's own handlers are all it has.
   */
  setAssessmentLock?(on: boolean): Promise<void>;
}

export class ClassroomError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ClassroomError';
  }
}

/** Paths that create a session; the token in their reply is kept by the transport, never by the page. */
export const SESSION_PATHS = ['/schools', '/teachers', '/sessions', '/join'];

/** Accepts http(s) URLs; plain http only for this computer or a private network, where a school might test. */
export function normaliseServerUrl(input: string): string {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ClassroomError(400, 'bad_url', 'That does not look like a web address.');
  }
  if (u.username || u.password) throw new ClassroomError(400, 'bad_url', 'Leave the user name and password out of the address.');
  const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(u.hostname);
  if (u.protocol === 'http:' && !local) throw new ClassroomError(400, 'insecure_url', 'Use an https:// address. Plain http is only allowed on this computer or a local network.');
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
}

/** Parses a server-sent event stream as it arrives. */
export function sseParser(onEvent: (e: ChatStreamEvent) => void): (chunk: string) => void {
  let buf = '';
  return (chunk) => {
    buf += chunk;
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = block
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (!data) continue;
      try {
        onEvent(JSON.parse(data) as ChatStreamEvent);
      } catch {
        /* a malformed event is skipped */
      }
    }
  };
}
