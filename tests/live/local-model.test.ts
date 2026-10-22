import { describe, expect, it } from 'vitest';
import { aiSetup } from '../helpers/ai';

/**
 * Talks to a real inference engine. Skipped unless FC_LIVE_OPENAI_COMPAT_URL
 * points at an OpenAI-compatible server (e.g. llama.cpp's llama-server):
 *   FC_LIVE_OPENAI_COMPAT_URL=http://127.0.0.1:8080/v1 npx vitest run tests/live
 */
const url = process.env.FC_LIVE_OPENAI_COMPAT_URL;

describe.skipIf(!url)('live: OpenAI-compatible local model', () => {
  it('lists the served model and completes a streamed, multi-turn conversation', async () => {
    const { ai, events, tasks } = aiSetup();
    const p = ai.createProvider({ kind: 'openai_compatible', baseUrl: url! });
    const status = await ai.testProvider(p.id);
    expect(status.ok).toBe(true);
    expect(status.models.length).toBeGreaterThan(0);
    const model = status.models[0]!.id;
    ai.updateProvider(p.id, { defaultModel: model });

    const c = ai.createConversation({ providerId: p.id, systemPrompt: 'Answer in one short sentence.' });
    ai.send({ conversationId: c.id, content: 'What is the capital of France?' });
    await ai.idle();
    let msgs = ai.messages(c.id);
    expect(msgs[1]!.status).toBe('complete');
    expect(msgs[1]!.content.toLowerCase()).toContain('paris');
    expect(events.filter((e) => e.kind === 'delta').length).toBeGreaterThan(1);

    ai.send({ conversationId: c.id, content: 'And of Italy?' });
    await ai.idle();
    msgs = ai.messages(c.id);
    expect(msgs[3]!.status).toBe('complete');
    // "And of Italy?" only makes sense with the earlier turn, so a reply about Italy's
    // capital shows the history reached the model. (Small local models sometimes name
    // the wrong city; this test checks the plumbing, not the model's knowledge.)
    expect(msgs[3]!.content.toLowerCase()).toMatch(/italy|rome|roma/);
    expect(tasks.list().every((t) => t.state === 'completed' && t.confidence === 'confirmed')).toBe(true);
    process.stdout.write(`[live] ${model}\n  Q1 → ${msgs[1]!.content}\n  Q2 → ${msgs[3]!.content}\n  usage: ${JSON.stringify(msgs[3]!.usage)}\n`);
  }, 120_000);

  it('can be canceled mid-stream', async () => {
    const { ai, events } = aiSetup();
    const p = ai.createProvider({ kind: 'openai_compatible', baseUrl: url! });
    const st = await ai.testProvider(p.id);
    expect(st, st.message).toMatchObject({ ok: true });
    const model = st.models[0]!.id;
    const c = ai.createConversation({ providerId: p.id, model });
    const { assistantMessage } = ai.send({ conversationId: c.id, content: 'Write a 400-word story about a lighthouse.' });
    while (events.filter((e) => e.kind === 'delta').length < 3) await new Promise((r) => setTimeout(r, 10));
    ai.cancel(assistantMessage.id);
    await ai.idle();
    const m = ai.messages(c.id)[1]!;
    expect(m.status).toBe('canceled');
    expect(m.content.length).toBeGreaterThan(0);
  }, 120_000);
});
