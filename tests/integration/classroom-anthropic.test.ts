import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { anthropicProvider } from '../../classroom-server/ai/anthropic';
import { AiProviderError } from '../../classroom-server/ai/provider';

/**
 * A local stand-in for the Anthropic API. It records each request exactly as the SDK sent it and answers in the
 * API's wire format, so the provider's request shapes are checked without a key. It does not check that a real
 * model accepts them: that needs a live run.
 */
interface Seen {
  method: string;
  path: string;
  headers: http.IncomingHttpHeaders;
  body: string;
  json: Record<string, unknown> | null;
}
type Handler = (req: Seen, res: http.ServerResponse) => void;

let server: http.Server;
let base: string;
let seen: Seen[];
let handler: Handler;

beforeEach(async () => {
  seen = [];
  handler = (_r, res) => res.writeHead(500).end();
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      let json: Record<string, unknown> | null = null;
      try {
        json = JSON.parse(body) as Record<string, unknown>;
      } catch {
        /* multipart or empty */
      }
      const s = { method: req.method!, path: req.url!, headers: req.headers, body, json };
      seen.push(s);
      handler(s, res);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(() => new Promise<void>((r) => server.close(() => r())));

const usage = { input_tokens: 1200, output_tokens: 80, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 };
const provider = (fallbacks = true) => anthropicProvider({ apiKey: 'sk-ant-test', baseURL: base, fallbacks, timeoutMs: 5000 });
const json = (res: http.ServerResponse, status: number, body: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
const apiError = (res: http.ServerResponse, status: number, type: string, message: string) => json(res, status, { type: 'error', error: { type, message } });

/** Streams a message the way the API does: text in pieces, then one citation, then the stop. */
function streamMessage(res: http.ServerResponse, opts: { text: string[]; citation?: Record<string, unknown>; stop?: string; model?: string }) {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const model = opts.model ?? 'claude-opus-5-5';
  send('message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { ...usage, output_tokens: 1 } } });
  send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: null } });
  for (const t of opts.text) send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } });
  if (opts.citation) send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'citations_delta', citation: opts.citation } });
  send('content_block_stop', { type: 'content_block_stop', index: 0 });
  send('message_delta', { type: 'message_delta', delta: { stop_reason: opts.stop ?? 'end_turn', stop_sequence: null }, usage: { output_tokens: usage.output_tokens } });
  send('message_stop', { type: 'message_stop' });
  res.end();
}

const docs = [
  { materialId: 'mat-a', title: 'Unit 3 notes.pdf', pages: ['Page one', 'Page two'], fileId: 'file_abc', image: null },
  { materialId: 'mat-b', title: 'Glossary.docx', pages: ['Cell: the basic unit of life.', ''], fileId: null, image: null },
  { materialId: 'mat-c', title: 'Diagram.png', pages: [], fileId: null, image: { mediaType: 'image/png' as const, base64: 'iVBORw0KGgo=' } },
];

describe('Claude provider: assistant chat', () => {
  it('sends materials as cited documents with the cached prefix first, streams text, and maps citations back to materials', async () => {
    handler = (_r, res) => streamMessage(res, { text: ['The cell ', 'membrane controls entry.'], citation: { type: 'content_block_location', cited_text: 'Cell: the basic unit of life.', document_index: 1, document_title: 'Glossary.docx', start_block_index: 0, end_block_index: 1 } });
    const deltas: string[] = [];
    const r = await provider().chat({
      model: 'claude-opus-5-5',
      effort: 'medium',
      system: 'RULES',
      documents: docs,
      turns: [
        { role: 'user', text: '<student_message>\nfirst\n</student_message>' },
        { role: 'assistant', text: 'Earlier answer', payload: [{ type: 'text', text: 'Earlier answer' }] },
        { role: 'user', text: '<student_message>\nsecond\n</student_message>' },
      ],
      onDelta: (t) => deltas.push(t),
    });
    expect(deltas.join('')).toBe('The cell membrane controls entry.');
    expect(r).toMatchObject({ text: 'The cell membrane controls entry.', model: 'claude-opus-5-5', stop: 'end', notices: [] });
    expect(r.usage).toEqual({ inputTokens: 1200, outputTokens: 80, cacheRead: 1000, cacheWrite: 0 });
    // document_index counts text documents only, so index 1 is the glossary; block 0 is its page 1.
    expect(r.citations).toEqual([{ materialId: 'mat-b', page: 1, quote: 'Cell: the basic unit of life.' }]);

    const req = seen[0]!;
    expect(req.method).toBe('POST');
    expect(req.path).toBe('/v1/messages?beta=true');
    expect(req.headers.authorization).toBe('Bearer sk-ant-test');
    expect(req.headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
    const b = req.json!;
    expect(b).toMatchObject({ model: 'claude-opus-5-5', max_tokens: 16000, stream: true, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, fallbacks: 'default' });
    expect(b).not.toHaveProperty('temperature');
    expect(b).not.toHaveProperty('betas');
    expect(b.system).toEqual([{ type: 'text', text: 'RULES', cache_control: { type: 'ephemeral' } }]);
    const msgs = b.messages as { role: string; content: unknown }[];
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    const first = msgs[0]!.content as Record<string, unknown>[];
    expect(first[0]).toEqual({ type: 'document', source: { type: 'file', file_id: 'file_abc' }, title: 'Unit 3 notes.pdf', citations: { enabled: true } });
    expect(first[1]).toEqual({ type: 'document', source: { type: 'content', content: [{ type: 'text', text: 'Cell: the basic unit of life.' }, { type: 'text', text: '(blank page)' }] }, title: 'Glossary.docx', citations: { enabled: true } });
    expect(first[2]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' }, cache_control: { type: 'ephemeral' } });
    expect(first[3]).toEqual({ type: 'text', text: '<student_message>\nfirst\n</student_message>' });
    // The earlier assistant turn is replayed exactly as recorded; later user turns carry no documents.
    expect(msgs[1]!.content).toEqual([{ type: 'text', text: 'Earlier answer' }]);
    expect(msgs[2]!.content).toBe('<student_message>\nsecond\n</student_message>');
  });

  it('maps page citations from PDFs, reports refusals, and turns off the fallback beta when an endpoint rejects it', async () => {
    let n = 0;
    handler = (r, res) => {
      n++;
      if (n === 1) return apiError(res, 400, 'invalid_request_error', 'Unexpected value(s) `server-side-fallback-2026-07-01` for the `anthropic-beta` header.');
      expect(r.headers['anthropic-beta']).toBeUndefined();
      streamMessage(res, { text: ['Yes.'], citation: { type: 'page_location', cited_text: 'Page two', document_index: 0, document_title: 'Unit 3 notes.pdf', start_page_number: 2, end_page_number: 3 }, stop: 'refusal' });
    };
    const p = provider();
    const r = await p.chat({ model: 'claude-opus-5-5', effort: 'low', system: 'S', documents: docs.slice(0, 1), turns: [{ role: 'user', text: 'q' }], onDelta: () => {} });
    expect(r.stop).toBe('refusal');
    expect(r.citations).toEqual([{ materialId: 'mat-a', page: 2, quote: 'Page two' }]);
    expect(seen).toHaveLength(2);
    expect(seen[1]!.json).not.toHaveProperty('fallbacks');
    // It stays off for later calls.
    await p.chat({ model: 'claude-opus-5-5', effort: 'low', system: 'S', documents: [], turns: [{ role: 'user', text: 'q' }], onDelta: () => {} });
    expect(seen[2]!.headers['anthropic-beta']).toBeUndefined();
  });

  it('retries once with plain text when earlier recorded turns cannot be replayed', async () => {
    let n = 0;
    handler = (_r, res) => (++n === 1 ? apiError(res, 400, 'invalid_request_error', 'messages.1.content.0: Invalid `signature` in `thinking` block') : streamMessage(res, { text: ['ok'] }));
    const r = await provider(false).chat({
      model: 'claude-opus-5-5',
      effort: 'low',
      system: 'S',
      documents: [],
      turns: [
        { role: 'user', text: 'a' },
        { role: 'assistant', text: 'plain earlier', payload: [{ type: 'thinking', thinking: 'x', signature: 'bad' }, { type: 'text', text: 'plain earlier' }] },
        { role: 'user', text: 'b' },
      ],
      onDelta: () => {},
    });
    expect(r.notices).toEqual(['Earlier reasoning could not be reused.']);
    expect((seen[1]!.json!.messages as { content: unknown }[])[1]!.content).toBe('plain earlier');
  });

  it('maps API failures to kinds the service can explain', async () => {
    const cases: [number, string, string][] = [
      [429, 'rate_limit_error', 'rate_limited'],
      [401, 'authentication_error', 'auth'],
      [403, 'permission_error', 'auth'],
      [400, 'invalid_request_error', 'invalid'],
      [529, 'overloaded_error', 'overloaded'],
    ];
    for (const [status, type, kind] of cases) {
      handler = (_r, res) => res.writeHead(status, { 'content-type': 'application/json', 'retry-after-ms': '1', 'x-should-retry': 'false' }).end(JSON.stringify({ type: 'error', error: { type, message: `boom ${status}` } }));
      const err = await provider(false)
        .judge({ model: 'm', effort: 'high', system: 's', user: 'u', schema: z.object({ a: z.number() }) })
        .catch((e: unknown) => e);
      expect(err, `${status}`).toBeInstanceOf(AiProviderError);
      expect((err as AiProviderError).kind, `${status}`).toBe(kind);
    }
    server.closeAllConnections();
    const down = anthropicProvider({ apiKey: 'k', baseURL: 'http://127.0.0.1:1', timeoutMs: 2000 });
    const err = await down.judge({ model: 'm', effort: 'high', system: 's', user: 'u', schema: z.object({}) }).catch((e: unknown) => e);
    expect((err as AiProviderError).kind).toBe('network');
  }, 30_000);
});

describe('Claude provider: judges, batches and files', () => {
  const schema = z.object({ level: z.number().int().min(1).max(4), quote: z.string() });

  it('asks for structured output with adaptive thinking and the grading effort', async () => {
    handler = (_r, res) => json(res, 200, { id: 'msg_2', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: '{"level":3,"quote":"x"}' }], stop_reason: 'end_turn', stop_sequence: null, usage });
    const r = await provider().judge({ model: 'claude-opus-5-5', effort: 'high', system: 'JUDGE', user: 'TRANSCRIPT', schema });
    expect(r).toEqual({ text: '{"level":3,"quote":"x"}', usage: { inputTokens: 1200, outputTokens: 80, cacheRead: 1000, cacheWrite: 0 }, model: 'claude-opus-5-5', stop: 'end' });
    const b = seen[0]!.json!;
    expect(b).toMatchObject({ model: 'claude-opus-5-5', max_tokens: 16000, system: 'JUDGE', messages: [{ role: 'user', content: 'TRANSCRIPT' }], thinking: { type: 'adaptive' }, output_config: { effort: 'high', format: { type: 'json_schema' } } });
    const s = (b.output_config as { format: { schema: Record<string, unknown> } }).format.schema;
    expect(s).toMatchObject({ type: 'object', properties: { level: { type: 'integer' }, quote: { type: 'string' } }, additionalProperties: false });
    expect(b).not.toHaveProperty('stream');
  });

  it('submits a batch without the fallback parameter, and matches results by custom_id whatever their order', async () => {
    handler = (r, res) => {
      if (r.method === 'POST' && r.path.startsWith('/v1/messages/batches')) return json(res, 200, { id: 'msgbatch_1', type: 'message_batch', processing_status: 'in_progress', request_counts: { processing: 2, succeeded: 0, errored: 0, canceled: 0, expired: 0 }, created_at: '2026-11-12T14:00:00Z', expires_at: '2026-11-13T14:00:00Z', ended_at: null, archived_at: null, cancel_initiated_at: null, results_url: null });
      if (r.path.includes('/results')) {
        res.writeHead(200, { 'content-type': 'application/binary' });
        res.write(JSON.stringify({ custom_id: 'eval:b', result: { type: 'errored', error: { type: 'error', error: { type: 'overloaded_error', message: 'x' } } } }) + '\n');
        res.end(JSON.stringify({ custom_id: 'eval:a', result: { type: 'succeeded', message: { id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: '{"level":2,"quote":""}' }], stop_reason: 'end_turn', stop_sequence: null, usage } } }) + '\n');
        return;
      }
      const ended = seen.filter((x) => x.method === 'GET').length > 1;
      json(res, 200, { id: 'msgbatch_1', type: 'message_batch', processing_status: ended ? 'ended' : 'in_progress', request_counts: { processing: 0, succeeded: 1, errored: 1, canceled: 0, expired: 0 }, created_at: '2026-11-12T14:00:00Z', expires_at: '2026-11-13T14:00:00Z', ended_at: null, archived_at: null, cancel_initiated_at: null, results_url: ended ? `${base}/v1/messages/batches/msgbatch_1/results` : null });
    };
    const p = provider();
    const id = await p.submitBatch([
      { customId: 'eval:a', request: { model: 'claude-opus-5-5', effort: 'high', system: 'S', user: 'A', schema } },
      { customId: 'eval:b', request: { model: 'claude-opus-5-5', effort: 'high', system: 'S', user: 'B', schema } },
    ]);
    expect(id).toBe('msgbatch_1');
    const sub = seen[0]!;
    expect(sub.path).toBe('/v1/messages/batches');
    expect(sub.headers['anthropic-beta']).toBeUndefined();
    const reqs = sub.json!.requests as { custom_id: string; params: Record<string, unknown> }[];
    expect(reqs.map((r) => r.custom_id)).toEqual(['eval:a', 'eval:b']);
    expect(reqs[0]!.params).toMatchObject({ model: 'claude-opus-5-5', thinking: { type: 'adaptive' }, output_config: { effort: 'high', format: { type: 'json_schema' } } });
    expect(reqs[0]!.params).not.toHaveProperty('fallbacks');
    expect(await p.batch(id)).toEqual({ done: false, results: [] });
    const done = await p.batch(id);
    expect(done.done).toBe(true);
    expect(done.results).toEqual([
      { customId: 'eval:b', result: null, error: 'The AI service returned an error for this request.' },
      { customId: 'eval:a', result: { text: '{"level":2,"quote":""}', usage: expect.any(Object), model: 'claude-opus-5-5', stop: 'end' }, error: null },
    ]);
  });

  it('uploads PDFs to the Files API and deletes them', async () => {
    handler = (r, res) => (r.method === 'POST' ? json(res, 200, { id: 'file_xyz', type: 'file', filename: 'Unit 3 notes.pdf', mime_type: 'application/pdf', size_bytes: 12, created_at: '2026-11-12T14:00:00Z', downloadable: false }) : json(res, 200, { id: 'file_xyz', type: 'file_deleted' }));
    const p = provider();
    expect(await p.uploadFile!(Buffer.from('%PDF-1.4 test'), 'Unit 3 notes.pdf', 'application/pdf')).toBe('file_xyz');
    expect(seen[0]!.path).toMatch(/^\/v1\/files/);
    expect(seen[0]!.headers['content-type']).toMatch(/^multipart\/form-data/);
    expect(seen[0]!.body).toContain('filename="Unit 3 notes.pdf"');
    expect(seen[0]!.body).toContain('%PDF-1.4 test');
    await p.deleteFile!('file_xyz');
    expect(seen[1]).toMatchObject({ method: 'DELETE', path: expect.stringMatching(/^\/v1\/files\/file_xyz/) });
  });
});
