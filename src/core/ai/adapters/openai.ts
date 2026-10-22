import type { ModelInfo } from '../../../shared/types';
import { errorDetail, httpError, joinUrl, networkError, withTimeout } from '../errors';
import { readSse } from '../sse';
import { AiError, type ChatResult, type ProviderAdapter } from '../types';

const NON_CHAT = /embedding|whisper|tts|dall-e|davinci|babbage|moderation|audio|transcribe|image|realtime|search|computer-use|sora/i;

/**
 * OpenAI Chat Completions, and any server that implements the same protocol
 * (llama.cpp server, LM Studio, vLLM, LocalAI, OpenRouter, Groq, …).
 */
export function openAiAdapter(kind: 'openai' | 'openai_compatible'): ProviderAdapter {
  const official = kind === 'openai';
  const name = official ? 'OpenAI' : 'The OpenAI-compatible server';
  return {
    kind,
    label: official ? 'OpenAI' : 'OpenAI-compatible (local or hosted)',
    defaultBaseUrl: official ? 'https://api.openai.com/v1' : 'http://127.0.0.1:8080/v1',
    capabilities: { streaming: true, systemPrompt: true, listModels: true, local: !official, requiresApiKey: official },
    suggestedModels: [],
    setupHelp: official
      ? 'Create an API key at platform.openai.com → API keys. Requests are billed to your OpenAI account. Model names come from your account’s model list.'
      : 'Point this at any server that speaks the OpenAI Chat Completions protocol, e.g. llama.cpp’s llama-server (http://127.0.0.1:8080/v1), LM Studio (http://127.0.0.1:1234/v1) or a hosted gateway. An API key is optional.',

    async listModels(rt, signal) {
      const t = withTimeout(signal, rt.timeoutMs);
      try {
        const res = await rt.fetch(joinUrl(rt.baseUrl, 'models'), {
          headers: rt.apiKey ? { Authorization: `Bearer ${rt.apiKey}` } : {},
          signal: t.signal,
        });
        const body = await res.text();
        if (!res.ok) throw httpError(name, res.status, errorDetail(body), res.headers.get('retry-after'));
        const json = JSON.parse(body) as { data?: { id: string; context_length?: number }[] };
        return (json.data ?? [])
          .filter((m) => typeof m.id === 'string' && (!official || !NON_CHAT.test(m.id)))
          .map((m): ModelInfo => ({ id: m.id, label: m.id.split(/[\\/]/).pop() || m.id, contextWindow: m.context_length ?? null }))
          .sort((a, b) => a.id.localeCompare(b.id));
      } catch (err) {
        throw networkError(name, err, signal, t.timedOut);
      } finally {
        t.clear();
      }
    },

    async chat(rt, req, onDelta, signal): Promise<ChatResult> {
      const messages = [
        ...(req.system ? [{ role: 'system', content: req.system }] : []),
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const body: Record<string, unknown> = { model: req.model, messages, stream: req.stream };
      if (req.stream && official) body.stream_options = { include_usage: true };
      if (req.maxTokens) body[official ? 'max_completion_tokens' : 'max_tokens'] = req.maxTokens;
      if (req.temperature !== null) body.temperature = req.temperature;
      const t = withTimeout(signal, rt.timeoutMs);
      const notices: string[] = [];
      try {
        const res = await rt.fetch(joinUrl(rt.baseUrl, 'chat/completions'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: req.stream ? 'text/event-stream' : 'application/json',
            ...(rt.apiKey ? { Authorization: `Bearer ${rt.apiKey}` } : {}),
          },
          body: JSON.stringify(body),
          signal: t.signal,
        });
        if (!res.ok) throw httpError(name, res.status, errorDetail(await res.text()), res.headers.get('retry-after'));
        let text = '';
        let finish = 'stop';
        let usage: ChatResult['usage'] = null;
        let model: string | undefined;
        if (req.stream && res.body) {
          for await (const ev of readSse(res.body)) {
            t.touch();
            if (ev.data === '[DONE]') break;
            const chunk = JSON.parse(ev.data) as {
              model?: string;
              error?: { message?: string };
              choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
              usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
            };
            if (chunk.error) throw new AiError('server', `${name} reported an error mid-stream: ${chunk.error.message ?? 'unknown'}`);
            model ??= chunk.model;
            const choice = chunk.choices?.[0];
            const delta = choice?.delta?.content;
            if (delta) {
              text += delta;
              onDelta(delta);
            }
            if (choice?.finish_reason) finish = choice.finish_reason;
            if (chunk.usage) usage = { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens };
          }
        } else {
          const json = JSON.parse(await res.text()) as {
            model?: string;
            choices?: { message?: { content?: string | null }; finish_reason?: string }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          model = json.model;
          text = json.choices?.[0]?.message?.content ?? '';
          finish = json.choices?.[0]?.finish_reason ?? 'stop';
          if (json.usage) usage = { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens };
          if (text) onDelta(text);
        }
        if (finish === 'length') notices.push('The response hit the maximum output length and was cut off.');
        if (finish === 'content_filter') notices.push(`${name} filtered part of this response.`);
        return { text, usage, finishReason: finish, servedModel: model, notices };
      } catch (err) {
        throw networkError(name, err, signal, t.timedOut);
      } finally {
        t.clear();
      }
    },
  };
}
