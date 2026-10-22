import type { ModelInfo } from '../../../shared/types';
import { errorDetail, httpError, joinUrl, networkError, withTimeout } from '../errors';
import { readNdjson } from '../sse';
import { AiError, type ChatResult, type ProviderAdapter } from '../types';

interface OllamaChunk {
  model?: string;
  message?: { role?: string; content?: string };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

const NAME = 'Ollama';

/** Local models through Ollama's native API. Nothing leaves this computer. */
export const ollamaAdapter: ProviderAdapter = {
  kind: 'ollama',
  label: 'Ollama (local models)',
  defaultBaseUrl: 'http://127.0.0.1:11434',
  capabilities: { streaming: true, systemPrompt: true, listModels: true, local: true, requiresApiKey: false },
  suggestedModels: [],
  setupHelp:
    'Install Ollama from ollama.com, then pull a model (for example: ollama pull llama3.2). FlowCompanion talks to it at http://127.0.0.1:11434 and your prompts stay on this computer.',

  async listModels(rt, signal): Promise<ModelInfo[]> {
    const t = withTimeout(signal, rt.timeoutMs);
    try {
      const res = await rt.fetch(joinUrl(rt.baseUrl, 'api/tags'), { signal: t.signal });
      const body = await res.text();
      if (!res.ok) throw httpError(NAME, res.status, errorDetail(body));
      const json = JSON.parse(body) as { models?: { name: string; details?: { parameter_size?: string } }[] };
      return (json.models ?? []).map((m) => ({ id: m.name, label: m.details?.parameter_size ? `${m.name} (${m.details.parameter_size})` : m.name, contextWindow: null }));
    } catch (err) {
      throw networkError(NAME, err, signal, t.timedOut);
    } finally {
      t.clear();
    }
  },

  async chat(rt, req, onDelta, signal): Promise<ChatResult> {
    const options: Record<string, number> = {};
    if (req.temperature !== null) options.temperature = req.temperature;
    if (req.maxTokens) options.num_predict = req.maxTokens;
    const body = {
      model: req.model,
      messages: [...(req.system ? [{ role: 'system', content: req.system }] : []), ...req.messages.filter((m) => m.content.trim()).map((m) => ({ role: m.role, content: m.content }))],
      stream: req.stream,
      ...(Object.keys(options).length ? { options } : {}),
    };
    const t = withTimeout(signal, rt.timeoutMs);
    try {
      const res = await rt.fetch(joinUrl(rt.baseUrl, 'api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: t.signal,
      });
      if (!res.ok) throw httpError(NAME, res.status, errorDetail(await res.text()));
      let text = '';
      let finish = 'stop';
      let usage: ChatResult['usage'] = null;
      let model: string | undefined;
      const handle = (c: OllamaChunk) => {
        if (c.error) throw new AiError(/not found/i.test(c.error) ? 'model_not_found' : 'server', `${NAME}: ${c.error}`);
        model ??= c.model;
        const piece = c.message?.content;
        if (piece) {
          text += piece;
          onDelta(piece);
        }
        if (c.done) {
          finish = c.done_reason ?? 'stop';
          usage = { inputTokens: c.prompt_eval_count, outputTokens: c.eval_count };
        }
      };
      if (req.stream && res.body) {
        for await (const chunk of readNdjson(res.body)) {
          t.touch();
          handle(chunk as OllamaChunk);
        }
      } else {
        handle(JSON.parse(await res.text()) as OllamaChunk);
      }
      return { text, usage, finishReason: finish, servedModel: model, notices: finish === 'length' ? ['The response hit the maximum output length and was cut off.'] : [] };
    } catch (err) {
      throw networkError(NAME, err, signal, t.timedOut);
    } finally {
      t.clear();
    }
  },
};
