import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  MessageCreateParamsStreaming,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { ModelInfo } from '../../../shared/types';
import { httpError, networkError, withTimeout } from '../errors';
import { AiError, type ChatRequest, type ChatResult, type ChatTurn, type ProviderAdapter, type ProviderRuntime } from '../types';

type StreamParams = MessageCreateParamsStreaming;

export interface AnthropicOptions {
  /** output_config.effort. Null leaves the model's default (medium on Claude Opus 5.5). */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null;
  /** Server-side refusal fallback on the Claude API ("fallbacks": "default"). */
  refusalFallback?: boolean;
  /** Replay Claude's own content blocks (including thinking) on later turns. */
  preserveThinking?: boolean;
}

/** Current models from Anthropic's model table. The live list comes from GET /v1/models. */
export const CLAUDE_MODELS: ModelInfo[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', contextWindow: 1_000_000 },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', contextWindow: 1_000_000 },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', contextWindow: 1_000_000 },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', contextWindow: 1_000_000 },
];

/** Models that accept the server-side "fallbacks": "default" form on the Claude API. */
const FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const BINDING_BETA = 'thinking-binding-controls-2026-08-01';

function isFirstParty(baseUrl: string): boolean {
  try {
    return /(^|\.)anthropic\.com$/i.test(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
}

function isBlockArray(v: unknown): v is BetaContentBlockParam[] {
  return Array.isArray(v) && v.every((b) => b && typeof b === 'object' && typeof (b as { type?: unknown }).type === 'string');
}

/**
 * Builds the messages array. Claude's own earlier turns are replayed with their
 * original content blocks (thinking included) when they came from the same
 * model, so reasoning and the prompt cache carry over; otherwise as text.
 */
export function toClaudeMessages(turns: ChatTurn[], model: string, replay: boolean): { messages: BetaMessageParam[]; hasThinking: boolean } {
  const out: BetaMessageParam[] = [];
  let hasThinking = false;
  for (const t of turns) {
    if (t.role === 'assistant' && replay && t.payloadKind === 'anthropic' && t.model === model && isBlockArray(t.payload) && t.payload.length > 0) {
      const blocks = t.payload;
      if (blocks.some((b) => b.type === 'thinking' || b.type === 'redacted_thinking')) hasThinking = true;
      out.push({ role: 'assistant', content: blocks });
      continue;
    }
    if (!t.content.trim()) continue;
    out.push({ role: t.role, content: t.content });
  }
  return { messages: out, hasThinking };
}

function stripThinking(messages: BetaMessageParam[]): BetaMessageParam[] {
  return messages.map((m): BetaMessageParam => {
    if (m.role !== 'assistant' || !Array.isArray(m.content)) return m;
    return { role: 'assistant', content: m.content.filter((b) => b.type !== 'thinking' && b.type !== 'redacted_thinking') };
  });
}

function textOf(content: BetaContentBlock[]): string {
  return content
    .filter((b): b is Extract<BetaContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function client(rt: ProviderRuntime): Anthropic {
  return new Anthropic({
    apiKey: rt.apiKey ?? '',
    baseURL: rt.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, ''),
    fetch: rt.fetch,
    maxRetries: 1,
    timeout: 10 * 60_000, // idle timeout is enforced separately
  });
}

function mapError(err: unknown, signal: AbortSignal, timedOut: () => boolean): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.APIUserAbortError) return timedOut() ? networkError('Anthropic', err, signal, timedOut) : new AiError('canceled', 'Canceled.');
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new AiError('timeout', 'Anthropic did not respond in time.');
  if (err instanceof Anthropic.APIConnectionError) return networkError('Anthropic', err, signal, timedOut);
  if (err instanceof Anthropic.APIError) {
    const status = typeof err.status === 'number' ? err.status : 0;
    const body = err.error as { error?: { message?: string } } | undefined;
    const detail = body?.error?.message ?? err.message;
    return httpError('Anthropic', status, detail, err.headers?.get?.('retry-after') ?? null);
  }
  return networkError('Anthropic', err, signal, timedOut);
}

export const anthropicAdapter: ProviderAdapter = {
  kind: 'anthropic',
  label: 'Anthropic (Claude)',
  defaultBaseUrl: 'https://api.anthropic.com',
  capabilities: { streaming: true, systemPrompt: true, listModels: true, local: false, requiresApiKey: true },
  suggestedModels: CLAUDE_MODELS,
  setupHelp:
    'Create an API key in the Claude Console (platform.claude.com → API keys). Requests are billed to that account. Claude does not accept temperature settings, so FlowCompanion never sends one.',

  async listModels(rt, signal): Promise<ModelInfo[]> {
    const t = withTimeout(signal, rt.timeoutMs);
    try {
      const out: ModelInfo[] = [];
      for await (const m of client(rt).models.list({ limit: 100 }, { signal: t.signal })) {
        t.touch();
        const info = m as { id: string; display_name?: string; max_input_tokens?: number };
        out.push({ id: info.id, label: info.display_name ?? info.id, contextWindow: info.max_input_tokens ?? null });
      }
      return out;
    } catch (err) {
      throw mapError(err, signal, t.timedOut);
    } finally {
      t.clear();
    }
  },

  async chat(rt, req: ChatRequest, onDelta, signal): Promise<ChatResult> {
    const opts = rt.options as AnthropicOptions;
    const firstParty = isFirstParty(rt.baseUrl);
    const replay = opts.preserveThinking !== false;
    const built = toClaudeMessages(req.messages, req.model, replay);
    const notices: string[] = [];

    const build = (variant: { messages: BetaMessageParam[]; betas: boolean; binding: boolean }): StreamParams => {
      const betas: string[] = [];
      const p = {
        model: req.model,
        max_tokens: req.maxTokens ?? (req.stream ? 64000 : 16000),
        messages: variant.messages,
        stream: true,
      } as StreamParams;
      if (req.system) p.system = req.system;
      if (opts.effort) p.output_config = { effort: opts.effort };
      if (variant.betas && firstParty && opts.refusalFallback !== false && FALLBACK_MODELS.has(req.model)) {
        betas.push(FALLBACK_BETA);
        p.fallbacks = 'default';
      }
      if (variant.betas && firstParty && variant.binding) {
        // Degrade instead of failing if earlier turns no longer match the reasoning they carried.
        betas.push(BINDING_BETA);
        p.thinking = { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } };
      }
      if (betas.length) p.betas = betas;
      return p;
    };

    const run = async (params: StreamParams): Promise<BetaMessage> => {
      const t = withTimeout(signal, rt.timeoutMs);
      try {
        const c = client(rt);
        if (!req.stream) {
          const { stream: _s, ...rest } = params;
          const msg = await c.beta.messages.create({ ...rest, stream: false }, { signal: t.signal });
          const text = textOf(msg.content);
          if (text) onDelta(text);
          return msg;
        }
        const stream = c.beta.messages.stream(params, { signal: t.signal });
        for await (const ev of stream) {
          t.touch();
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') onDelta(ev.delta.text);
        }
        return await stream.finalMessage();
      } catch (err) {
        throw mapError(err, signal, t.timedOut);
      } finally {
        t.clear();
      }
    };

    let message: BetaMessage;
    try {
      message = await run(build({ messages: built.messages, betas: true, binding: built.hasThinking }));
    } catch (err) {
      if (!(err instanceof AiError) || err.code !== 'bad_request') throw err;
      if (/signature|thinking/i.test(err.message) && built.hasThinking) {
        // Recovery documented by Anthropic: strip thinking blocks and retry once.
        notices.push('Earlier reasoning could not be reused, so Claude answered without it.');
        message = await run(build({ messages: stripThinking(built.messages), betas: true, binding: false }));
      } else if (/anthropic-beta|fallbacks|block_binding/i.test(err.message)) {
        notices.push('This endpoint does not support refusal fallback or reasoning replay; they were turned off for this request.');
        message = await run(build({ messages: stripThinking(built.messages), betas: false, binding: false }));
      } else {
        throw err;
      }
    }

    for (const b of message.content) {
      if (b.type === 'fallback') notices.push(`${b.from.model} declined this request; ${b.to.model} answered instead.`);
    }
    const text = textOf(message.content);
    if (message.stop_reason === 'refusal') {
      const d = message.stop_details as { category?: string | null; explanation?: string | null } | null | undefined;
      throw new AiError(
        'refused',
        `Claude declined this request${d?.category ? ` (category: ${d.category})` : ''}.${d?.explanation ? ` ${d.explanation}` : ''}`,
      );
    }
    if (message.stop_reason === 'max_tokens') notices.push('The response hit the maximum output length and was cut off.');
    return {
      text,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
      finishReason: message.stop_reason ?? 'end_turn',
      payload: message.content,
      servedModel: message.model,
      notices,
    };
  },
};
