import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Recorded {
  method: string;
  path: string;
  headers: http.IncomingHttpHeaders;
  body: unknown;
}

function sse(res: http.ServerResponse, events: { event?: string; data: unknown }[], hang = false) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  for (const e of events) {
    res.write(`${e.event ? `event: ${e.event}\n` : ''}data: ${typeof e.data === 'string' ? e.data : JSON.stringify(e.data)}\n\n`);
  }
  if (!hang) res.end();
}

function claudeStream(model: string, blocks: ({ type: 'text'; text: string } | { type: 'thinking'; signature: string } | { type: 'fallback'; from: string; to: string })[], stop: { reason: string; details?: unknown }) {
  const events: { event: string; data: unknown }[] = [
    { event: 'message_start', data: { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 11, output_tokens: 0 } } } },
  ];
  blocks.forEach((b, index) => {
    if (b.type === 'text') {
      events.push({ event: 'content_block_start', data: { type: 'content_block_start', index, content_block: { type: 'text', text: '' } } });
      for (const piece of b.text.match(/.{1,6}/gs) ?? []) {
        events.push({ event: 'content_block_delta', data: { type: 'content_block_delta', index, delta: { type: 'text_delta', text: piece } } });
      }
    } else if (b.type === 'thinking') {
      events.push({ event: 'content_block_start', data: { type: 'content_block_start', index, content_block: { type: 'thinking', thinking: '', signature: '' } } });
      events.push({ event: 'content_block_delta', data: { type: 'content_block_delta', index, delta: { type: 'signature_delta', signature: b.signature } } });
    } else {
      events.push({
        event: 'content_block_start',
        data: { type: 'content_block_start', index, content_block: { type: 'fallback', from: { model: b.from }, to: { model: b.to }, trigger: { type: 'refusal', category: 'cyber' } } },
      });
    }
    events.push({ event: 'content_block_stop', data: { type: 'content_block_stop', index } });
  });
  events.push({ event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: stop.reason, stop_sequence: null, stop_details: stop.details ?? null }, usage: { output_tokens: 7 } } });
  events.push({ event: 'message_stop', data: { type: 'message_stop' } });
  return events;
}

/** A local server that speaks the OpenAI, Anthropic, Gemini and Ollama wire formats. Behaviour is chosen by model name. */
export async function startMockProviders() {
  const log: Recorded[] = [];
  const hanging = new Set<http.ServerResponse>();
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://x');
      const body = raw ? JSON.parse(raw) : null;
      log.push({ method: req.method ?? '', path: url.pathname + url.search, headers: req.headers, body });
      const json = (status: number, data: unknown, headers: Record<string, string> = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
        res.end(JSON.stringify(data));
      };
      const p = url.pathname;

      // ── OpenAI-compatible ──
      if (p === '/openai/v1/models') return json(200, { data: [{ id: 'gpt-test' }, { id: 'text-embedding-3-small' }] });
      if (p === '/openai/v1/chat/completions') {
        const m = body.model as string;
        if (m === 'err401') return json(401, { error: { message: 'Incorrect API key provided', type: 'invalid_request_error' } });
        if (m === 'err429') return json(429, { error: { message: 'Rate limit reached' } }, { 'retry-after': '7' });
        if (m === 'missing' || m.includes('embedding')) return json(404, { error: { message: 'The model `missing` does not exist', code: 'model_not_found' } });
        if (m === 'ctx') return json(400, { error: { message: "This model's maximum context length is 8192 tokens", code: 'context_length_exceeded' } });
        if (m === 'slow') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'partial ' } }] })}\n\n`);
          hanging.add(res);
          return;
        }
        if (!body.stream) return json(200, { model: m, choices: [{ message: { content: 'Whole answer' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 2 } });
        return sse(res, [
          { data: { model: m, choices: [{ delta: { role: 'assistant' } }] } },
          { data: { model: m, choices: [{ delta: { content: 'Hello' } }] } },
          { data: { model: m, choices: [{ delta: { content: ', world' } }] } },
          { data: { model: m, choices: [{ delta: {}, finish_reason: m === 'cut' ? 'length' : 'stop' }] } },
          { data: { model: m, choices: [], usage: { prompt_tokens: 9, completion_tokens: 3 } } },
          { data: '[DONE]' },
        ]);
      }

      // ── Anthropic ──
      if (p === '/anthropic/v1/models') {
        return json(200, { data: [{ type: 'model', id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z', max_input_tokens: 1000000 }], has_more: false, first_id: 'claude-opus-5-5', last_id: 'claude-opus-5-5' });
      }
      if (p === '/anthropic/v1/messages') {
        const m = body.model as string;
        if (req.headers['x-api-key'] !== 'sk-ant-test' && req.headers.authorization !== 'Bearer sk-ant-test') return json(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
        const msgs = body.messages as { role: string; content: unknown }[];
        const badSig = msgs.some((x) => Array.isArray(x.content) && (x.content as { type: string; signature?: string }[]).some((b) => b.type === 'thinking' && b.signature === 'stale'));
        if (badSig) {
          return json(400, { type: 'error', error: { type: 'invalid_request_error', message: 'messages.1.content.0: Invalid `signature` in `thinking` block. The block is bound to a different conversation.' } });
        }
        if (m === 'refuse') return sse(res, claudeStream(m, [{ type: 'text', text: 'Partial' }], { reason: 'refusal', details: { type: 'refusal', category: 'cyber', explanation: 'Declined by policy.' } }));
        if (m === 'claude-opus-5-5' && body.fallbacks === 'default' && msgs.some((x) => typeof x.content === 'string' && x.content.includes('trigger fallback'))) {
          return sse(res, claudeStream('claude-opus-5', [{ type: 'fallback', from: 'claude-opus-5-5', to: 'claude-opus-5' }, { type: 'text', text: 'Answered by fallback' }], { reason: 'end_turn' }));
        }
        return sse(res, claudeStream(m, [{ type: 'thinking', signature: 'sig-1' }, { type: 'text', text: 'Hello from Claude' }], { reason: 'end_turn' }));
      }

      // ── Gemini ──
      if (p === '/gemini/v1beta/models') {
        if (req.headers['x-goog-api-key'] !== 'g-key') return json(400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } });
        return json(200, { models: [{ name: 'models/gemini-test', displayName: 'Gemini Test', inputTokenLimit: 1000, supportedGenerationMethods: ['generateContent'] }, { name: 'models/embed', supportedGenerationMethods: ['embedContent'] }] });
      }
      const g = /^\/gemini\/v1beta\/models\/([^:]+):(streamGenerateContent|generateContent)$/.exec(p);
      if (g) {
        if (req.headers['x-goog-api-key'] !== 'g-key') return json(400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } });
        if (g[1] === 'blocked') return sse(res, [{ data: { promptFeedback: { blockReason: 'SAFETY' } } }]);
        return sse(res, [
          { data: { candidates: [{ content: { parts: [{ text: 'thinking...', thought: true }] } }] } },
          { data: { candidates: [{ content: { parts: [{ text: 'Gemini ' }] } }] } },
          { data: { candidates: [{ content: { parts: [{ text: 'says hi' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3 }, modelVersion: g[1] } },
        ]);
      }

      // ── Ollama ──
      if (p === '/ollama/api/tags') return json(200, { models: [{ name: 'llama3.2:1b', details: { parameter_size: '1.2B' } }] });
      if (p === '/ollama/api/chat') {
        if (body.model === 'nope') return json(404, { error: "model 'nope' not found, try pulling it first" });
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        res.write(`${JSON.stringify({ model: body.model, message: { role: 'assistant', content: 'Local ' }, done: false })}\n`);
        res.write(`${JSON.stringify({ model: body.model, message: { role: 'assistant', content: 'answer' }, done: false })}\n`);
        res.end(`${JSON.stringify({ model: body.model, message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop', prompt_eval_count: 12, eval_count: 2 })}\n`);
        return;
      }
      json(404, { error: 'not found' });
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  return {
    base,
    log,
    /** Sends api.anthropic.com traffic to the mock, so first-party-only features can be tested. */
    fetchWithAnthropicRedirect: ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return fetch(url.replace('https://api.anthropic.com', `${base}/anthropic`), init);
    }) as typeof fetch,
    close: async () => {
      for (const r of hanging) r.destroy();
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
}
