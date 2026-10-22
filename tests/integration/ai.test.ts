import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readSse } from '../../src/core/ai/sse';
import { titleFromPrompt } from '../../src/core/ai/service';
import { aiSetup } from '../helpers/ai';
import { startMockProviders } from '../helpers/mockProviders';

let mock: Awaited<ReturnType<typeof startMockProviders>>;
beforeAll(async () => {
  mock = await startMockProviders();
});
afterAll(async () => {
  await mock.close();
});

function lastBody(pathPart: string): Record<string, unknown> {
  const r = [...mock.log].reverse().find((x) => x.path.includes(pathPart));
  return r?.body as Record<string, unknown>;
}

describe('provider setup state', () => {
  it('refuses to send without a provider and never fabricates a reply', () => {
    const { ai } = aiSetup();
    expect(ai.status().configured).toBe(false);
    const c = ai.createConversation();
    expect(() => ai.send({ conversationId: c.id, content: 'hi' })).toThrow(/No AI provider is connected/);
    expect(ai.messages(c.id)).toHaveLength(0);
  });

  it('requires an API key for hosted providers and stores it encrypted', () => {
    const { ai, db } = aiSetup();
    const p = ai.createProvider({ kind: 'openai', baseUrl: `${mock.base}/openai/v1`, defaultModel: 'gpt-test' });
    const c = ai.createConversation({ providerId: p.id });
    expect(() => ai.send({ conversationId: c.id, content: 'hi' })).toThrow(/needs an API key/);
    expect(ai.setApiKey(p.id, 'sk-secret-123')).toBe('secure');
    const row = db.get<{ value: Uint8Array }>('SELECT value FROM secrets')!;
    expect(Buffer.from(row.value).toString()).toBe('enc:sk-secret-123');
    expect(JSON.stringify(ai.providers())).not.toContain('sk-secret-123');
    expect(ai.provider(p.id)).toMatchObject({ hasApiKey: true, keyStorage: 'secure' });
  });

  it('keeps keys in memory only when no OS keychain is available', () => {
    const { ai, db } = aiSetup({ secure: false });
    const p = ai.createProvider({ kind: 'anthropic', apiKey: 'sk-ant-x' });
    expect(ai.provider(p.id).keyStorage).toBe('session');
    expect(db.all('SELECT * FROM secrets')).toHaveLength(0);
  });

  it('rejects plain http for remote hosts but allows local servers', () => {
    const { ai } = aiSetup();
    expect(() => ai.createProvider({ kind: 'openai_compatible', baseUrl: 'http://example.com/v1' })).toThrow(/https/);
    expect(ai.createProvider({ kind: 'openai_compatible', baseUrl: 'http://127.0.0.1:8080/v1' }).baseUrl).toBe('http://127.0.0.1:8080/v1');
    expect(() => ai.createProvider({ kind: 'ollama', baseUrl: 'file:///etc' })).toThrow(/http/);
  });

  it('removes the key when a provider is disconnected', () => {
    const { ai, db } = aiSetup();
    const p = ai.createProvider({ kind: 'openai', apiKey: 'sk-1' });
    ai.deleteProvider(p.id);
    expect(db.all('SELECT * FROM secrets')).toHaveLength(0);
    expect(ai.providers()).toHaveLength(0);
  });
});

describe('OpenAI-compatible adapter', () => {
  it('streams a response, saves it and records usage and task status', async () => {
    const { ai, events, tasks } = aiSetup();
    const p = ai.createProvider({ kind: 'openai', baseUrl: `${mock.base}/openai/v1`, apiKey: 'sk-1', defaultModel: 'gpt-test' });
    const c = ai.createConversation({ providerId: p.id });
    const { assistantMessage } = ai.send({ conversationId: c.id, content: 'Say hello please' });
    expect(assistantMessage.status).toBe('streaming');
    await ai.idle();
    const msgs = ai.messages(c.id);
    expect(msgs.map((m) => [m.role, m.content, m.status])).toEqual([
      ['user', 'Say hello please', 'complete'],
      ['assistant', 'Hello, world', 'complete'],
    ]);
    expect(msgs[1]!.usage).toEqual({ inputTokens: 9, outputTokens: 3 });
    expect(events.filter((e) => e.kind === 'delta').map((e) => e.delta).join('')).toBe('Hello, world');
    expect(events.at(-1)?.kind).toBe('done');
    expect(ai.conversation(c.id).title).toBe('Say hello please');
    expect(tasks.list()[0]).toMatchObject({ state: 'completed', confidence: 'confirmed', source: 'native' });
    const body = lastBody('chat/completions');
    expect(body.messages).toEqual([{ role: 'user', content: 'Say hello please' }]);
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(mock.log.at(-1)?.headers.authorization).toBe('Bearer sk-1');
  });

  it('sends the system prompt, history and explicit attachments only', async () => {
    const { ai, settings } = aiSetup();
    settings.update({ ai: { systemPrompt: 'Be brief.' } });
    const p = ai.createProvider({ kind: 'openai_compatible', baseUrl: `${mock.base}/openai/v1`, defaultModel: 'gpt-test' });
    const c = ai.createConversation({ providerId: p.id, systemPrompt: 'You plan trips.' });
    ai.send({ conversationId: c.id, content: 'First' });
    await ai.idle();
    ai.send({ conversationId: c.id, content: 'Second', attachments: [{ type: 'note', id: 'note-1' }] });
    await ai.idle();
    const body = lastBody('chat/completions');
    expect(body.messages).toEqual([
      { role: 'system', content: 'Be brief.\n\nYou plan trips.' },
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Hello, world' },
      { role: 'user', content: 'Second\n\n---\n**Attached note: Trip plan**\n\nLisbon in May' },
    ]);
    expect(body.stream_options).toBeUndefined();
    expect(() => ai.send({ conversationId: c.id, content: 'x', attachments: [{ type: 'note', id: 'gone' }] })).toThrow(/no longer exists/);
  });

  it('supports non-streaming mode and sends temperature when set', async () => {
    const { ai, settings } = aiSetup();
    settings.update({ ai: { streaming: false, temperature: 0.3, maxOutputTokens: 500 } });
    const p = ai.createProvider({ kind: 'openai', baseUrl: `${mock.base}/openai/v1`, apiKey: 'k', defaultModel: 'gpt-test' });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'x' });
    await ai.idle();
    expect(ai.messages(c.id)[1]!.content).toBe('Whole answer');
    expect(lastBody('chat/completions')).toMatchObject({ stream: false, temperature: 0.3, max_completion_tokens: 500 });
  });

  it.each([
    ['err401', 'auth', /rejected the API key/],
    ['err429', 'rate_limit', /try again in 7 s/],
    ['missing', 'model_not_found', /could not find that model/],
    ['ctx', 'context_length', /too long for this model/],
  ])('maps %s to %s', async (model, code, msg) => {
    const { ai, tasks } = aiSetup();
    const p = ai.createProvider({ kind: 'openai', baseUrl: `${mock.base}/openai/v1`, apiKey: 'k', defaultModel: model });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'x' });
    await ai.idle();
    const m = ai.messages(c.id)[1]!;
    expect(m.status).toBe('error');
    expect(m.error?.code).toBe(code);
    expect(m.error?.message).toMatch(msg);
    expect(m.error?.message).not.toContain('Bearer');
    expect(tasks.list()[0]!.state).toBe('failed');
  });

  it('reports network failures without hanging', async () => {
    const { ai } = aiSetup();
    const p = ai.createProvider({ kind: 'openai_compatible', baseUrl: 'http://127.0.0.1:9/v1', defaultModel: 'm' });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'x' });
    await ai.idle();
    expect(ai.messages(c.id)[1]!.error?.code).toBe('network');
  });

  it('cancels a running response and keeps the partial text', async () => {
    const { ai, events, tasks } = aiSetup();
    const p = ai.createProvider({ kind: 'openai_compatible', baseUrl: `${mock.base}/openai/v1`, defaultModel: 'slow' });
    const c = ai.createConversation({ providerId: p.id });
    const { assistantMessage } = ai.send({ conversationId: c.id, content: 'x' });
    expect(() => ai.send({ conversationId: c.id, content: 'again' })).toThrow(/still being written/);
    while (!events.some((e) => e.kind === 'delta')) await new Promise((r) => setTimeout(r, 5));
    expect(ai.cancel(assistantMessage.id)).toBe(true);
    await ai.idle();
    const m = ai.messages(c.id)[1]!;
    expect(m).toMatchObject({ status: 'canceled', content: 'partial ', error: null });
    expect(tasks.list()[0]!.state).toBe('canceled');
  });

  it('times out when the provider goes quiet', async () => {
    const { ai, settings } = aiSetup();
    settings.update({ ai: { requestTimeoutSeconds: 15 } });
    const p = ai.createProvider({ kind: 'openai_compatible', baseUrl: `${mock.base}/openai/v1`, defaultModel: 'slow' });
    // Shrink the timeout below the settings minimum for the test.
    (ai as unknown as { d: { settings: () => unknown } }).d.settings = () => ({ ...settings.get(), ai: { ...settings.get().ai, requestTimeoutSeconds: 0.2 } });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'x' });
    await ai.idle();
    expect(ai.messages(c.id)[1]!.error?.code).toBe('timeout');
  });

  it('retries the last response, optionally on another model', async () => {
    const { ai } = aiSetup();
    const p = ai.createProvider({ kind: 'openai', baseUrl: `${mock.base}/openai/v1`, apiKey: 'k', defaultModel: 'err429' });
    const c = ai.createConversation({ providerId: p.id });
    const { assistantMessage } = ai.send({ conversationId: c.id, content: 'x' });
    await ai.idle();
    ai.retry(assistantMessage.id, { model: 'gpt-test' });
    await ai.idle();
    const msgs = ai.messages(c.id);
    expect(msgs).toHaveLength(2);
    expect(msgs[1]).toMatchObject({ status: 'complete', content: 'Hello, world', model: 'gpt-test', error: null });
    // Without an explicit model, retry uses the conversation's current selection.
    ai.updateConversation(c.id, { model: 'err401' });
    ai.retry(assistantMessage.id);
    await ai.idle();
    expect(ai.messages(c.id)[1]).toMatchObject({ model: 'err401', status: 'error' });
  });

  it('lists models, filtering out non-chat models', async () => {
    const { ai } = aiSetup();
    const p = ai.createProvider({ kind: 'openai', baseUrl: `${mock.base}/openai/v1`, apiKey: 'k' });
    const s = await ai.testProvider(p.id);
    expect(s.ok).toBe(true);
    expect(s.models.map((m) => m.id)).toEqual(['gpt-test']);
    expect(ai.models(p.id).map((m) => m.id)).toEqual(['gpt-test']);
  });

  it('notifies on completion only when no window has focus', async () => {
    const { ai, notified } = aiSetup({ focused: false });
    const p = ai.createProvider({ kind: 'openai', baseUrl: `${mock.base}/openai/v1`, apiKey: 'k', defaultModel: 'gpt-test' });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'x' });
    await ai.idle();
    expect(notified).toHaveLength(1);
  });
});

describe('Anthropic adapter (official SDK)', () => {
  it('streams through the SDK with API version 2026-10-21 and no sampling parameters', async () => {
    const { ai, settings } = aiSetup();
    settings.update({ ai: { temperature: 0.2 } });
    const p = ai.createProvider({ kind: 'anthropic', baseUrl: `${mock.base}/anthropic`, apiKey: 'sk-ant-test' });
    expect(p.defaultModel).toBe('claude-opus-5-5');
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'Hi Claude' });
    await ai.idle();
    const m = ai.messages(c.id)[1]!;
    expect(m).toMatchObject({ status: 'complete', content: 'Hello from Claude', servedModel: 'claude-opus-5-5' });
    const req = mock.log.filter((x) => x.path.startsWith('/anthropic/v1/messages')).at(-1)!;
    expect(req.headers['anthropic-version']).toBe('2026-10-21');
    expect(req.body).not.toHaveProperty('temperature');
    expect(req.body).toMatchObject({ model: 'claude-opus-5-5', max_tokens: 64000, stream: true });
    // Not api.anthropic.com: no first-party betas.
    expect(req.headers['anthropic-beta']).toBeUndefined();
  });

  it('enables refusal fallback on the Claude API and reports the switch', async () => {
    const { ai } = aiSetup({ fetch: mock.fetchWithAnthropicRedirect });
    const p = ai.createProvider({ kind: 'anthropic', apiKey: 'sk-ant-test' });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'please trigger fallback' });
    await ai.idle();
    const req = mock.log.filter((x) => x.path.startsWith('/anthropic/v1/messages')).at(-1)!;
    expect(req.headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01');
    expect(req.body).toMatchObject({ fallbacks: 'default' });
    const m = ai.messages(c.id)[1]!;
    expect(m.content).toBe('Answered by fallback');
    expect(m.servedModel).toBe('claude-opus-5');
    expect(m.notices).toContain('claude-opus-5-5 declined this request; claude-opus-5 answered instead.');
  });

  it('replays Claude content blocks unchanged with drop_block, and recovers from a stale signature', async () => {
    const { ai, db } = aiSetup({ fetch: mock.fetchWithAnthropicRedirect });
    const p = ai.createProvider({ kind: 'anthropic', apiKey: 'sk-ant-test' });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'one' });
    await ai.idle();
    ai.send({ conversationId: c.id, content: 'two' });
    await ai.idle();
    let req = mock.log.filter((x) => x.path.startsWith('/anthropic/v1/messages')).at(-1)!;
    const body = req.body as { messages: { role: string; content: unknown }[]; thinking?: unknown };
    expect(body.messages[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: '', signature: 'sig-1' },
        { type: 'text', text: 'Hello from Claude' },
      ],
    });
    expect(body.thinking).toEqual({ type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } });
    expect(req.headers['anthropic-beta']).toContain('thinking-binding-controls-2026-08-01');

    // Simulate a payload the API rejects: the adapter strips thinking and retries once.
    db.run("UPDATE messages SET provider_payload = replace(provider_payload, 'sig-1', 'stale') WHERE role = 'assistant'");
    ai.send({ conversationId: c.id, content: 'three' });
    await ai.idle();
    const last = ai.messages(c.id).at(-1)!;
    expect(last.status).toBe('complete');
    expect(last.notices).toContain('Earlier reasoning could not be reused, so Claude answered without it.');
    req = mock.log.filter((x) => x.path.startsWith('/anthropic/v1/messages')).at(-1)!;
    expect(JSON.stringify(req.body)).not.toContain('stale');
  });

  it('surfaces a refusal as a declined response, keeping partial text', async () => {
    const { ai } = aiSetup();
    const p = ai.createProvider({ kind: 'anthropic', baseUrl: `${mock.base}/anthropic`, apiKey: 'sk-ant-test', defaultModel: 'refuse' });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'x' });
    await ai.idle();
    const m = ai.messages(c.id)[1]!;
    expect(m.status).toBe('error');
    expect(m.error).toMatchObject({ code: 'refused' });
    expect(m.error?.message).toMatch(/declined this request \(category: cyber\)/);
    expect(m.content).toBe('Partial');
  });

  it('maps an invalid key to an auth error', async () => {
    const { ai } = aiSetup();
    const p = ai.createProvider({ kind: 'anthropic', baseUrl: `${mock.base}/anthropic`, apiKey: 'wrong' });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'x' });
    await ai.idle();
    expect(ai.messages(c.id)[1]!.error).toMatchObject({ code: 'auth', status: 401 });
  });

  it('lists models through the Models API', async () => {
    const { ai } = aiSetup();
    const p = ai.createProvider({ kind: 'anthropic', baseUrl: `${mock.base}/anthropic`, apiKey: 'sk-ant-test' });
    const s = await ai.testProvider(p.id);
    expect(s).toMatchObject({ ok: true, models: [{ id: 'claude-opus-5-5', label: 'Claude Opus 5.5', contextWindow: 1000000 }] });
  });
});

describe('Gemini adapter', () => {
  it('streams text, skips thought parts and merges consecutive turns', async () => {
    const { ai } = aiSetup();
    const p = ai.createProvider({ kind: 'gemini', baseUrl: `${mock.base}/gemini`, apiKey: 'g-key', defaultModel: 'gemini-test' });
    const c = ai.createConversation({ providerId: p.id, systemPrompt: 'Sys' });
    ai.send({ conversationId: c.id, content: 'hello' });
    await ai.idle();
    expect(ai.messages(c.id)[1]).toMatchObject({ content: 'Gemini says hi', usage: { inputTokens: 4, outputTokens: 3 } });
    const req = mock.log.filter((x) => x.path.includes('streamGenerateContent')).at(-1)!;
    expect(req.path).toBe('/gemini/v1beta/models/gemini-test:streamGenerateContent?alt=sse');
    expect(req.body).toMatchObject({ contents: [{ role: 'user', parts: [{ text: 'hello' }] }], systemInstruction: { parts: [{ text: 'Sys' }] } });
  });

  it('reports blocked prompts and bad keys', async () => {
    const { ai } = aiSetup();
    const p = ai.createProvider({ kind: 'gemini', baseUrl: `${mock.base}/gemini`, apiKey: 'g-key', defaultModel: 'blocked' });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'x' });
    await ai.idle();
    expect(ai.messages(c.id)[1]!.error?.code).toBe('refused');
    ai.setApiKey(p.id, 'bad');
    const s = await ai.testProvider(p.id);
    expect(s.ok).toBe(false);
    expect(s.message).toMatch(/rejected the API key/);
  });
});

describe('Ollama adapter', () => {
  it('streams NDJSON from a local runtime without an API key', async () => {
    const { ai } = aiSetup();
    const p = ai.createProvider({ kind: 'ollama', baseUrl: `${mock.base}/ollama` });
    expect((await ai.testProvider(p.id)).models.map((m) => m.id)).toEqual(['llama3.2:1b']);
    const c = ai.createConversation({ providerId: p.id, model: 'llama3.2:1b' });
    ai.send({ conversationId: c.id, content: 'x' });
    await ai.idle();
    expect(ai.messages(c.id)[1]).toMatchObject({ content: 'Local answer', usage: { inputTokens: 12, outputTokens: 2 } });
  });

  it('explains a missing model', async () => {
    const { ai } = aiSetup();
    const p = ai.createProvider({ kind: 'ollama', baseUrl: `${mock.base}/ollama`, defaultModel: 'nope' });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'x' });
    await ai.idle();
    expect(ai.messages(c.id)[1]!.error?.code).toBe('model_not_found');
  });
});

describe('conversations', () => {
  it('renames, archives, searches, exports and deletes', async () => {
    const { ai } = aiSetup();
    const p = ai.createProvider({ kind: 'openai_compatible', baseUrl: `${mock.base}/openai/v1`, defaultModel: 'gpt-test' });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'Tell me about photosynthesis' });
    await ai.idle();
    ai.updateConversation(c.id, { title: 'Biology' });
    expect(ai.listConversations({ search: 'photosynth' }).map((x) => x.title)).toEqual(['Biology']);
    expect(ai.listConversations({ search: 'biolog' })).toHaveLength(1);
    expect(ai.listConversations({ search: 'world' })).toHaveLength(1); // matches the reply
    ai.archiveConversation(c.id, true);
    expect(ai.listConversations()).toHaveLength(0);
    expect(ai.listConversations({ archived: true })).toHaveLength(1);
    const md = ai.exportConversation(c.id, 'markdown');
    expect(md.filename).toBe('Biology.md');
    expect(md.content).toContain('## You\n\nTell me about photosynthesis');
    expect(md.content).toContain('## Assistant (gpt-test)\n\nHello, world');
    expect(JSON.parse(ai.exportConversation(c.id, 'json').content).messages).toHaveLength(2);
    ai.deleteConversation(c.id);
    expect(ai.listConversations({ archived: true })).toHaveLength(0);
    expect(ai.listConversations({ search: 'photosynth' })).toHaveLength(0);
  });

  it('marks interrupted responses, removes temporary chats and applies retention on startup', () => {
    const { ai, db, settings, clock, tasks } = aiSetup();
    const keep = ai.createConversation();
    settings.update({ ai: { storeConversations: false } });
    ai.createConversation();
    db.run("INSERT INTO messages (id, conversation_id, role, content, status, created_at) VALUES ('m1', ?, 'assistant', 'half', 'streaming', 'x')", [keep.id]);
    tasks.create({ title: 't', source: 'native', confidence: 'confirmed' });
    const r = ai.housekeeping();
    expect(r).toMatchObject({ interrupted: 1, ephemeralRemoved: 1, expired: 0 });
    expect(ai.messages(keep.id)[0]).toMatchObject({ status: 'error', content: 'half' });
    expect(ai.messages(keep.id)[0]!.error?.message).toMatch(/Interrupted/);
    expect(tasks.list()[0]).toMatchObject({ state: 'unknown', confidence: 'estimated' });
    settings.update({ ai: { retentionDays: 30 } });
    clock.advance(31 * 86_400_000);
    expect(ai.housekeeping().expired).toBe(1);
  });

  it('adds tutor-mode instructions when parental controls request it', async () => {
    const { ai, setTutor } = aiSetup();
    setTutor('Guide the student; do not just give answers.');
    const p = ai.createProvider({ kind: 'openai_compatible', baseUrl: `${mock.base}/openai/v1`, defaultModel: 'gpt-test' });
    const c = ai.createConversation({ providerId: p.id });
    ai.send({ conversationId: c.id, content: 'x' });
    await ai.idle();
    expect((lastBody('chat/completions').messages as { content: string }[])[0]).toEqual({ role: 'system', content: 'Guide the student; do not just give answers.' });
  });

  it('builds short titles from the first prompt', () => {
    expect(titleFromPrompt('# Plan a three day trip to Lisbon with kids, museums and good food please')).toBe('Plan a three day trip to Lisbon with kids, museums and good…');
    expect(titleFromPrompt('   ')).toBe('New conversation');
  });
});

describe('SSE parser', () => {
  it('handles CRLF, multi-line data and chunk boundaries', async () => {
    const text = 'event: a\r\ndata: one\r\ndata: two\r\n\r\n: comment\n\ndata: {"x":1}\n\n';
    const bytes = new TextEncoder().encode(text);
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        for (let i = 0; i < bytes.length; i += 3) ctrl.enqueue(bytes.slice(i, i + 3));
        ctrl.close();
      },
    });
    const out = [];
    for await (const e of readSse(stream)) out.push(e);
    expect(out).toEqual([
      { event: 'a', data: 'one\ntwo' },
      { event: 'message', data: '{"x":1}' },
    ]);
  });
});
