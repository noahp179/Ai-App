import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { BridgeClient, BridgeStatus, CaptureResult } from '../shared/types';
import type { KvStore } from './kv';
import { randomCode, sha256 } from './passwords';
import { type Clock, UserError, cleanLine, newId, safeHttpUrl } from './util';

const CLIENTS = 'bridge:clients';
const PAIRING_MS = 5 * 60_000;
const MAX_PAIR_ATTEMPTS = 5;
const MAX_BODY = 64 * 1024;
const EXTENSION_ORIGIN = /^(chrome-extension|moz-extension|safari-web-extension):\/\/[A-Za-z0-9._-]+$/;

interface StoredClient extends BridgeClient {
  tokenHash: string;
}

const PairBody = z.object({ code: z.string().max(40), name: z.string().max(80).default('Browser extension') });
const CaptureBody = z.object({
  kind: z.enum(['note', 'task', 'reading']),
  title: z.string().max(500).default(''),
  text: z.string().max(20_000).default(''),
  url: z.string().max(4000).default(''),
});
const AskBody = z.object({ text: z.string().min(1).max(20_000), url: z.string().max(4000).default(''), title: z.string().max(500).default('') });

export interface BridgeDeps {
  kv: KvStore;
  clock: Clock;
  version: string;
  capture: (input: { text: string; kind: 'note' | 'task' | 'reading'; url?: string | null }) => CaptureResult;
  /** Shows FlowCompanion with an AI prompt prefilled. Nothing is sent to a provider until the user presses Send. */
  openAi: (prompt: string) => void;
  /** Returns why an action is not allowed right now (a locked section or a supervised session), or null. */
  blocked: (action: 'capture' | 'ask', kind?: 'note' | 'task' | 'reading') => string | null;
  onChange?: () => void;
}

class BridgeError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Local HTTP bridge for the optional browser extension. Off by default. Listens on 127.0.0.1 only, accepts requests
 * only from browser-extension origins (never from web pages), checks the Host header against DNS rebinding, and
 * requires a token obtained by pairing with a short-lived code shown in FlowCompanion.
 */
export class BrowserBridge {
  private server: http.Server | null = null;
  private port = 0;
  private error: string | null = null;
  private pairing: { code: string; expiresAt: number; attempts: number } | null = null;
  private lastRequestAt: string | null = null;
  private rate = new Map<string, { count: number; reset: number }>();

  constructor(private readonly d: BridgeDeps) {}

  private clients(): StoredClient[] {
    return this.d.kv.get<StoredClient[]>(CLIENTS, []);
  }

  status(enabled: boolean): BridgeStatus {
    const p = this.pairing && this.pairing.expiresAt > this.d.clock.now().getTime() ? this.pairing : null;
    return {
      enabled,
      listening: !!this.server?.listening,
      port: this.port,
      error: this.error,
      clients: this.clients().map(({ tokenHash: _t, ...c }) => c),
      pairingCode: p?.code ?? null,
      pairingExpiresAt: p ? new Date(p.expiresAt).toISOString() : null,
      lastRequestAt: this.lastRequestAt,
    };
  }

  startPairing(): { code: string; expiresAt: string } {
    if (!this.server?.listening) throw new UserError('Turn on the browser bridge first.');
    const code = randomCode(2);
    this.pairing = { code, expiresAt: this.d.clock.now().getTime() + PAIRING_MS, attempts: 0 };
    return { code, expiresAt: new Date(this.pairing.expiresAt).toISOString() };
  }

  cancelPairing(): void {
    this.pairing = null;
  }

  unpair(id: string): void {
    this.d.kv.set(
      CLIENTS,
      this.clients().filter((c) => c.id !== id),
    );
  }

  async start(port: number): Promise<void> {
    await this.stop();
    this.port = port;
    this.error = null;
    const server = http.createServer((req, res) => void this.handle(req, res));
    server.requestTimeout = 10_000;
    server.headersTimeout = 5_000;
    await new Promise<void>((resolve) => {
      server.once('error', (err: NodeJS.ErrnoException) => {
        this.error = err.code === 'EADDRINUSE' ? `Port ${port} is already in use. Choose another port in Settings → Browser.` : `Could not start the bridge: ${err.message}`;
        this.server = null;
        resolve();
      });
      server.listen(port, '127.0.0.1', () => {
        this.server = server;
        resolve();
      });
    });
    if (this.server) this.port = (this.server.address() as { port: number }).port;
    this.d.onChange?.();
  }

  async stop(): Promise<void> {
    const s = this.server;
    this.server = null;
    this.pairing = null;
    if (s) {
      await new Promise<void>((r) => s.close(() => r()));
      s.closeAllConnections?.();
    }
  }

  private authorized(req: http.IncomingMessage): StoredClient | null {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return null;
    const hash = sha256(h.slice(7));
    return this.clients().find((c) => c.tokenHash === hash) ?? null;
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const origin = req.headers.origin;
    const fromExtension = typeof origin === 'string' && EXTENSION_ORIGIN.test(origin);
    const send = (status: number, body: unknown) => {
      const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
      if (fromExtension) {
        headers['access-control-allow-origin'] = origin!;
        headers.vary = 'Origin';
      }
      res.writeHead(status, headers);
      res.end(JSON.stringify(body));
    };
    try {
      const remote = req.socket.remoteAddress ?? '';
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) throw new BridgeError(403, 'Local connections only.');
      // DNS rebinding: a web page that resolves its own domain to 127.0.0.1 still sends its own Host header.
      if (!(req.headers.host === `127.0.0.1:${this.port}` || req.headers.host === `localhost:${this.port}`)) throw new BridgeError(403, 'Unexpected host.');
      // Web pages always send an Origin on cross-site requests; only extensions are allowed.
      if (origin !== undefined && !fromExtension) throw new BridgeError(403, 'Only the FlowCompanion browser extension can use this bridge.');
      const now = this.d.clock.now().getTime();
      const b = this.rate.get(remote);
      if (!b || b.reset < now) this.rate.set(remote, { count: 1, reset: now + 60_000 });
      else if (++b.count > 120) throw new BridgeError(429, 'Too many requests.');

      if (req.method === 'OPTIONS') {
        if (!fromExtension) throw new BridgeError(403, 'Not allowed.');
        res.writeHead(204, {
          'access-control-allow-origin': origin!,
          'access-control-allow-methods': 'GET, POST',
          'access-control-allow-headers': 'authorization, content-type',
          'access-control-allow-private-network': 'true',
          'access-control-max-age': '600',
          vary: 'Origin',
        });
        return void res.end();
      }

      const url = new URL(req.url ?? '/', `http://127.0.0.1:${this.port}`);
      const body = req.method === 'POST' ? await readJson(req) : undefined;
      this.lastRequestAt = new Date(now).toISOString();
      const client = this.authorized(req);

      if (req.method === 'GET' && url.pathname === '/v1/status') return send(200, { app: 'FlowCompanion', version: this.d.version, paired: !!client });

      if (req.method === 'POST' && url.pathname === '/v1/pair') {
        const p = PairBody.parse(body);
        const pairing = this.pairing;
        if (!pairing || pairing.expiresAt < now) throw new BridgeError(400, 'No pairing code is active. In FlowCompanion, open Settings → Browser and choose “Pair a browser”.');
        if (p.code.toUpperCase().replace(/[^A-Z0-9]/g, '') !== pairing.code.replace(/-/g, '')) {
          if (++pairing.attempts >= MAX_PAIR_ATTEMPTS) this.pairing = null;
          throw new BridgeError(403, 'That pairing code is not right.');
        }
        this.pairing = null;
        const token = randomBytes(32).toString('base64url');
        const c: StoredClient = { id: newId(), name: cleanLine(p.name, 80) || 'Browser extension', pairedAt: new Date(now).toISOString(), lastSeenAt: null, tokenHash: sha256(token) };
        this.d.kv.set(CLIENTS, [...this.clients(), c].slice(-10));
        this.d.onChange?.();
        return send(200, { token, clientId: c.id });
      }

      if (!client) throw new BridgeError(401, 'This browser is not paired with FlowCompanion.');
      this.d.kv.set(
        CLIENTS,
        this.clients().map((c) => (c.id === client.id ? { ...c, lastSeenAt: new Date(now).toISOString() } : c)),
      );

      if (req.method === 'POST' && url.pathname === '/v1/capture') {
        const c = CaptureBody.parse(body);
        const why = this.d.blocked('capture', c.kind);
        if (why) throw new BridgeError(403, why);
        const pageUrl = c.url ? safeHttpUrl(c.url) : null;
        if (c.url && !pageUrl) throw new BridgeError(400, 'Only http and https pages can be saved.');
        let text: string;
        if (c.kind === 'reading') {
          if (!pageUrl) throw new BridgeError(400, 'A page address is needed for the reading queue.');
          text = `${cleanLine(c.title, 300)} ${pageUrl}`.trim();
        } else {
          const heading = c.kind === 'note' ? cleanLine(c.title || 'Clipping', 200) : cleanLine(c.text.split('\n')[0] || c.title, 200);
          text = c.kind === 'note' ? `${heading}\n\n${c.text.trim()}${pageUrl ? `\n\nSource: ${pageUrl}` : ''}` : `${heading}${pageUrl ? `\n${pageUrl}` : ''}`;
        }
        const r = this.d.capture({ text, kind: c.kind, url: pageUrl });
        this.d.onChange?.();
        return send(200, { saved: r });
      }

      if (req.method === 'POST' && url.pathname === '/v1/ask') {
        const why = this.d.blocked('ask');
        if (why) throw new BridgeError(403, why);
        const a = AskBody.parse(body);
        const src = safeHttpUrl(a.url);
        this.d.openAi(`${a.text.trim()}${src ? `\n\n(From: ${a.title ? `${cleanLine(a.title, 200)} — ` : ''}${src})` : ''}`);
        return send(200, { opened: true });
      }

      throw new BridgeError(404, 'Not found.');
    } catch (err) {
      if (err instanceof BridgeError) send(err.status, { error: err.message });
      else if (err instanceof z.ZodError) send(400, { error: 'Invalid request.' });
      else if (err instanceof UserError) send(400, { error: err.message });
      else send(500, { error: 'Something went wrong in FlowCompanion.' });
    }
  }
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/.test(req.headers['content-type'] ?? '')) return reject(new BridgeError(415, 'Send JSON.'));
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (d: Buffer) => {
      size += d.length;
      if (size > MAX_BODY * 16) req.destroy();
      else if (size <= MAX_BODY) chunks.push(d);
    });
    req.on('end', () => {
      if (size > MAX_BODY) return reject(new BridgeError(413, 'Too large.'));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new BridgeError(400, 'Invalid JSON.'));
      }
    });
    req.on('error', reject);
  });
}
