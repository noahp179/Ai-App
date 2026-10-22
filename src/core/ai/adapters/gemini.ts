import type { ModelInfo } from '../../../shared/types';
import { errorDetail, httpError, joinUrl, networkError, withTimeout } from '../errors';
import { readSse } from '../sse';
import { AiError, type ChatResult, type ChatTurn, type ProviderAdapter } from '../types';

interface GeminiChunk {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
  error?: { message?: string };
}

const NAME = 'Google Gemini';

/** Gemini expects alternating user/model turns, so consecutive same-role turns are merged. */
export function toGeminiContents(turns: ChatTurn[]): { role: 'user' | 'model'; parts: { text: string }[] }[] {
  const out: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const t of turns) {
    if (!t.content.trim()) continue;
    const role = t.role === 'assistant' ? 'model' : 'user';
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts.push({ text: t.content });
    else out.push({ role, parts: [{ text: t.content }] });
  }
  return out;
}

const modelPath = (model: string) => `v1beta/models/${encodeURIComponent(model.replace(/^models\//, ''))}`;

export const geminiAdapter: ProviderAdapter = {
  kind: 'gemini',
  label: 'Google Gemini',
  defaultBaseUrl: 'https://generativelanguage.googleapis.com',
  capabilities: { streaming: true, systemPrompt: true, listModels: true, local: false, requiresApiKey: true },
  suggestedModels: [],
  setupHelp:
    'Create a Gemini API key in Google AI Studio (aistudio.google.com → Get API key). Free-tier usage may be used by Google to improve its products; check Google’s terms. Load the model list after adding the key.',

  async listModels(rt, signal): Promise<ModelInfo[]> {
    const t = withTimeout(signal, rt.timeoutMs);
    try {
      const res = await rt.fetch(joinUrl(rt.baseUrl, 'v1beta/models?pageSize=200'), {
        headers: rt.apiKey ? { 'x-goog-api-key': rt.apiKey } : {},
        signal: t.signal,
      });
      const body = await res.text();
      if (!res.ok) throw httpError(NAME, res.status, errorDetail(body));
      const json = JSON.parse(body) as { models?: { name: string; displayName?: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }[] };
      return (json.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName ?? m.name, contextWindow: m.inputTokenLimit ?? null }));
    } catch (err) {
      throw networkError(NAME, err, signal, t.timedOut);
    } finally {
      t.clear();
    }
  },

  async chat(rt, req, onDelta, signal): Promise<ChatResult> {
    const body: Record<string, unknown> = { contents: toGeminiContents(req.messages) };
    if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
    const gen: Record<string, number> = {};
    if (req.maxTokens) gen.maxOutputTokens = req.maxTokens;
    if (req.temperature !== null) gen.temperature = req.temperature;
    if (Object.keys(gen).length) body.generationConfig = gen;
    const url = joinUrl(rt.baseUrl, `${modelPath(req.model)}:${req.stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`);
    const t = withTimeout(signal, rt.timeoutMs);
    const notices: string[] = [];
    try {
      const res = await rt.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(rt.apiKey ? { 'x-goog-api-key': rt.apiKey } : {}) },
        body: JSON.stringify(body),
        signal: t.signal,
      });
      if (!res.ok) throw httpError(NAME, res.status, errorDetail(await res.text()), res.headers.get('retry-after'));
      let text = '';
      let finish = 'STOP';
      let usage: ChatResult['usage'] = null;
      let model: string | undefined;
      const handle = (c: GeminiChunk) => {
        if (c.error) throw new AiError('server', `${NAME} reported an error: ${c.error.message ?? 'unknown'}`);
        if (c.promptFeedback?.blockReason) throw new AiError('refused', `Gemini blocked this prompt (${c.promptFeedback.blockReason}).`);
        model ??= c.modelVersion;
        const cand = c.candidates?.[0];
        for (const p of cand?.content?.parts ?? []) {
          if (p.thought || !p.text) continue;
          text += p.text;
          onDelta(p.text);
        }
        if (cand?.finishReason) finish = cand.finishReason;
        if (c.usageMetadata) usage = { inputTokens: c.usageMetadata.promptTokenCount, outputTokens: c.usageMetadata.candidatesTokenCount };
      };
      if (req.stream && res.body) {
        for await (const ev of readSse(res.body)) {
          t.touch();
          handle(JSON.parse(ev.data) as GeminiChunk);
        }
      } else {
        handle(JSON.parse(await res.text()) as GeminiChunk);
      }
      if (finish === 'MAX_TOKENS') notices.push('The response hit the maximum output length and was cut off.');
      if (finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT' || finish === 'BLOCKLIST') {
        if (!text) throw new AiError('refused', `Gemini stopped this response for safety reasons (${finish}).`);
        notices.push(`Gemini stopped this response early for safety reasons (${finish}).`);
      }
      return { text, usage, finishReason: finish, servedModel: model, notices };
    } catch (err) {
      throw networkError(NAME, err, signal, t.timedOut);
    } finally {
      t.clear();
    }
  },
};
