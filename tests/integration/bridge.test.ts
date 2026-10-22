import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { BrowserBridge } from '../../src/core/bridge';
import { KvStore } from '../../src/core/kv';
import type { CaptureResult } from '../../src/shared/types';
import { FakeClock, memoryDb } from '../helpers/db';

const EXT = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

/** Raw HTTP so tests can set Host and Origin exactly like a browser would (fetch forbids setting Host). */
function req(port: number, method: string, path: string, opts: { body?: unknown; origin?: string; host?: string; token?: string; type?: string } = {}) {
  return new Promise<{ status: number; json: Record<string, unknown>; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
    const data = opts.body === undefined ? undefined : JSON.stringify(opts.body);
    const r = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          host: opts.host ?? `127.0.0.1:${port}`,
          ...(opts.origin ? { origin: opts.origin } : {}),
          ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
          ...(data ? { 'content-type': opts.type ?? 'application/json', 'content-length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let s = '';
        res.on('data', (c) => (s += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, json: s ? JSON.parse(s) : {}, headers: res.headers }));
      },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let bridge: BrowserBridge | null = null;
afterEach(async () => {
  await bridge?.stop();
  bridge = null;
});

async function setup(blocked: (a: 'capture' | 'ask') => string | null = () => null) {
  const db = memoryDb();
  const clock = new FakeClock('2026-10-20T10:00:00Z');
  const captured: { text: string; kind: string; url?: string | null }[] = [];
  const asked: string[] = [];
  bridge = new BrowserBridge({
    kv: new KvStore(db, clock),
    clock,
    version: '1.0.0',
    capture: (i) => (captured.push(i), { kind: i.kind, id: 'x1', title: i.text.split('\n')[0]! } as CaptureResult),
    openAi: (p) => asked.push(p),
    blocked,
  });
  await bridge.start(0);
  const port = bridge.status(true).port;
  return { bridge, port, clock, captured, asked };
}

async function pair(b: BrowserBridge, port: number) {
  const { code } = b.startPairing();
  const r = await req(port, 'POST', '/v1/pair', { body: { code, name: 'Chrome on laptop' }, origin: EXT });
  return r.json.token as string;
}

describe('browser bridge', () => {
  it('listens on loopback only and reports status', async () => {
    const { bridge: b, port } = await setup();
    expect(b.status(true)).toMatchObject({ listening: true, clients: [], pairingCode: null });
    const r = await req(port, 'GET', '/v1/status', { origin: EXT });
    expect(r.json).toEqual({ app: 'FlowCompanion', version: '1.0.0', paired: false });
    expect(r.headers['access-control-allow-origin']).toBe(EXT);
  });

  it('rejects web pages and DNS-rebinding hosts', async () => {
    const { port } = await setup();
    expect((await req(port, 'GET', '/v1/status', { origin: 'https://evil.example' })).status).toBe(403);
    expect((await req(port, 'GET', '/v1/status', { origin: 'null' })).status).toBe(403);
    expect((await req(port, 'GET', '/v1/status', { host: `evil.example:${port}` })).status).toBe(403);
    expect((await req(port, 'OPTIONS', '/v1/capture', { origin: 'https://evil.example' })).status).toBe(403);
    const pre = await req(port, 'OPTIONS', '/v1/capture', { origin: EXT });
    expect(pre.status).toBe(204);
    expect(pre.headers['access-control-allow-origin']).toBe(EXT);
  });

  it('pairs with a short-lived code and refuses unpaired or guessed requests', async () => {
    const { bridge: b, port, clock } = await setup();
    expect((await req(port, 'POST', '/v1/capture', { body: { kind: 'note', text: 'hi' }, origin: EXT })).status).toBe(401);
    expect((await req(port, 'POST', '/v1/pair', { body: { code: 'AAAA-BBBB' }, origin: EXT })).json.error).toMatch(/No pairing code/);

    const { code } = b.startPairing();
    for (let i = 0; i < 5; i++) expect((await req(port, 'POST', '/v1/pair', { body: { code: 'ZZZZ-ZZZZ' }, origin: EXT })).status).toBe(403);
    expect((await req(port, 'POST', '/v1/pair', { body: { code }, origin: EXT })).json.error).toMatch(/No pairing code/);

    const second = b.startPairing();
    clock.advanceMinutes(6);
    expect((await req(port, 'POST', '/v1/pair', { body: { code: second.code }, origin: EXT })).status).toBe(400);

    const token = await pair(b, port);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(b.status(true).clients).toEqual([expect.objectContaining({ name: 'Chrome on laptop' })]);
    expect(JSON.stringify(b.status(true))).not.toContain(token);
    expect((await req(port, 'GET', '/v1/status', { origin: EXT, token })).json.paired).toBe(true);
    expect((await req(port, 'POST', '/v1/capture', { body: { kind: 'note', text: 'x' }, origin: EXT, token: 'wrong' })).status).toBe(401);
  });

  it('saves pages and selections, and opens AI prompts without sending them', async () => {
    const { bridge: b, port, captured, asked } = await setup();
    const token = await pair(b, port);
    const page = await req(port, 'POST', '/v1/capture', { body: { kind: 'reading', title: 'Tides explained', url: 'https://example.org/tides' }, origin: EXT, token });
    expect(page.status).toBe(200);
    expect(captured[0]).toEqual({ kind: 'reading', text: 'Tides explained https://example.org/tides', url: 'https://example.org/tides' });
    await req(port, 'POST', '/v1/capture', { body: { kind: 'note', title: 'Moon', text: 'The moon pulls the sea.', url: 'https://example.org/moon' }, origin: EXT, token });
    expect(captured[1]!.text).toBe('Moon\n\nThe moon pulls the sea.\n\nSource: https://example.org/moon');
    expect((await req(port, 'POST', '/v1/capture', { body: { kind: 'reading', url: 'javascript:alert(1)' }, origin: EXT, token })).status).toBe(400);
    expect((await req(port, 'POST', '/v1/capture', { body: { kind: 'event', text: 'x' }, origin: EXT, token })).status).toBe(400);
    expect((await req(port, 'POST', '/v1/ask', { body: { text: 'Explain this', url: 'https://example.org/a', title: 'A' }, origin: EXT, token })).json).toEqual({ opened: true });
    expect(asked).toEqual(['Explain this\n\n(From: A — https://example.org/a)']);
    expect((await req(port, 'POST', '/v1/capture', { body: { kind: 'note', text: 'x' }, origin: EXT, token, type: 'text/plain' })).status).toBe(415);
    expect((await req(port, 'POST', '/v1/capture', { body: { kind: 'note', text: 'x'.repeat(70_000) }, origin: EXT, token })).status).toBe(413);
  });

  it('honours parental session limits and can unpair', async () => {
    const { bridge: b, port } = await setup((a) => (a === 'ask' ? 'The AI workspace is not part of this study session.' : null));
    const token = await pair(b, port);
    expect((await req(port, 'POST', '/v1/ask', { body: { text: 'hi' }, origin: EXT, token })).json.error).toMatch(/study session/);
    b.unpair(b.status(true).clients[0]!.id);
    expect((await req(port, 'GET', '/v1/status', { origin: EXT, token })).json.paired).toBe(false);
  });

  it('reports a port conflict instead of failing silently', async () => {
    const { port } = await setup();
    const other = new BrowserBridge({ kv: new KvStore(memoryDb(), new FakeClock()), clock: new FakeClock(), version: '1', capture: () => ({ kind: 'note', id: '', title: '' }), openAi: () => {}, blocked: () => null });
    await other.start(port);
    expect(other.status(true)).toMatchObject({ listening: false, error: expect.stringMatching(/already in use/) });
    await other.stop();
  });
});
