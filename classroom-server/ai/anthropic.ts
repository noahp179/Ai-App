import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { BetaContentBlockParam, BetaMessage, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { AiProviderError, type AiProvider, type AiUsage, type BatchEntry, type ChatCitation, type ChatRequest, type ChatResult, type JudgeRequest, type JudgeResult, type StopKind } from './provider';

type BetaBlockParam = BetaContentBlockParam;

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const CHAT_MAX_TOKENS = 16_000;
const JUDGE_MAX_TOKENS = 16_000;

const usageOf = (u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): AiUsage => ({
  inputTokens: u.input_tokens,
  outputTokens: u.output_tokens,
  cacheRead: u.cache_read_input_tokens ?? 0,
  cacheWrite: u.cache_creation_input_tokens ?? 0,
});
const stopOf = (r: string | null | undefined): StopKind => (r === 'refusal' ? 'refusal' : r === 'max_tokens' ? 'max_tokens' : 'end');

/** Most specific first, so retryable and non-retryable failures are told apart. */
export function mapAnthropicError(err: unknown): AiProviderError {
  if (err instanceof AiProviderError) return err;
  if (err instanceof Anthropic.RateLimitError) return new AiProviderError('rate_limited', err.message);
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return new AiProviderError('auth', err.message);
  if (err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError || err instanceof Anthropic.UnprocessableEntityError) return new AiProviderError('invalid', err.message);
  if (err instanceof Anthropic.InternalServerError) return new AiProviderError('overloaded', err.message);
  if (err instanceof Anthropic.APIConnectionError) return new AiProviderError('network', err.message);
  if (err instanceof Anthropic.APIError) return new AiProviderError(typeof err.status === 'number' && err.status >= 500 ? 'overloaded' : 'other', err.message);
  return new AiProviderError('other', err instanceof Error ? err.message : String(err));
}

export interface AnthropicOptions {
  apiKey: string;
  baseURL?: string;
  timeoutMs?: number;
  /** Server-side refusal fallback (first-party API only). On by default. */
  fallbacks?: boolean;
}

/**
 * Claude through the official SDK.
 * - Assistant: streamed; materials as document blocks with citations (PDFs through the Files API, other files as
 *   one text block per page); the system prompt and materials come first and are cached.
 * - Judges: structured outputs (output_config.format). Citations cannot be combined with structured outputs, so
 *   judges quote evidence as text and the service checks every quote.
 * - Class-wide work: the Message Batches API.
 * Adaptive thinking is on (it is the default and cannot be turned off on current models); effort is set per call.
 * No sampling parameters, prefill or forced tool choice are sent.
 */
export function anthropicProvider(opts: AnthropicOptions): AiProvider {
  const client = new Anthropic({ apiKey: opts.apiKey, baseURL: opts.baseURL, timeout: opts.timeoutMs ?? 120_000, maxRetries: 2 });
  let useFallbacks = opts.fallbacks !== false;
  const withFallbacks = <T extends object>(p: T): T => (useFallbacks ? { ...p, betas: [FALLBACK_BETA], fallbacks: 'default' as const } : p);
  /** Runs a request; if the endpoint rejects the fallback beta, turns it off and tries once more. */
  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (useFallbacks && err instanceof Anthropic.BadRequestError && /anthropic-beta|fallbacks|server-side-fallback/i.test(err.message)) {
        useFallbacks = false;
        try {
          return await fn();
        } catch (again) {
          throw mapAnthropicError(again);
        }
      }
      throw mapAnthropicError(err);
    }
  };

  const judgeParams = (req: JudgeRequest) => ({
    model: req.model,
    max_tokens: req.maxTokens ?? JUDGE_MAX_TOKENS,
    system: req.system,
    messages: [{ role: 'user' as const, content: req.user }],
    thinking: { type: 'adaptive' as const },
    output_config: { effort: req.effort as 'low' | 'medium' | 'high' | 'xhigh' | 'max', format: zodOutputFormat(req.schema) },
  });
  const textOf = (m: { content: { type: string; text?: string }[] }) =>
    m.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
  const judgeResult = (m: { content: { type: string; text?: string }[]; usage: Parameters<typeof usageOf>[0]; model: string; stop_reason: string | null }): JudgeResult => ({
    text: textOf(m) || null,
    usage: usageOf(m.usage),
    model: m.model,
    stop: stopOf(m.stop_reason),
  });

  return {
    name: 'Claude (Anthropic API)',
    batchDiscount: 0.5,

    async chat(req: ChatRequest): Promise<ChatResult> {
      // Documents first and identical on every turn, so the cached prefix is reused.
      const docIds: string[] = [];
      const blocks: BetaBlockParam[] = [];
      for (const d of req.documents) {
        if (d.image) {
          blocks.push({ type: 'image', source: { type: 'base64', media_type: d.image.mediaType, data: d.image.base64 } });
          continue;
        }
        docIds.push(d.materialId);
        blocks.push(
          d.fileId
            ? { type: 'document', source: { type: 'file', file_id: d.fileId }, title: d.title, citations: { enabled: true } }
            : { type: 'document', source: { type: 'content', content: d.pages.map((p) => ({ type: 'text' as const, text: p.trim() || '(blank page)' })) }, title: d.title, citations: { enabled: true } },
        );
      }
      const last = blocks.at(-1);
      if (last && last.type !== 'thinking' && last.type !== 'redacted_thinking') (last as { cache_control?: unknown }).cache_control = { type: 'ephemeral' };
      const messages: BetaMessageParam[] = req.turns.map((t, i) =>
        t.role === 'assistant'
          ? { role: 'assistant', content: Array.isArray(t.payload) ? (t.payload as BetaBlockParam[]) : t.text }
          : { role: 'user', content: i === 0 && blocks.length ? [...blocks, { type: 'text', text: t.text }] : t.text },
      );
      const build = (plain: boolean) =>
        withFallbacks({
          model: req.model,
          max_tokens: CHAT_MAX_TOKENS,
          system: [{ type: 'text' as const, text: req.system, cache_control: { type: 'ephemeral' as const } }],
          messages: plain ? messages.map((m) => (m.role === 'assistant' ? { ...m, content: req.turns[messages.indexOf(m)]!.text } : m)) : messages,
          thinking: { type: 'adaptive' as const },
          output_config: { effort: req.effort as 'low' | 'medium' | 'high' | 'xhigh' | 'max' },
        });
      const notices: string[] = [];
      const stream = async (plain: boolean): Promise<BetaMessage> => {
        const s = client.beta.messages.stream(build(plain), { signal: req.signal });
        s.on('text', (t) => req.onDelta(t));
        return s.finalMessage();
      };
      let message: BetaMessage;
      try {
        message = await run(() => stream(false));
      } catch (err) {
        // Earlier assistant turns could not be replayed as recorded: retry once with their plain text.
        if (!(err instanceof AiProviderError) || err.kind !== 'invalid' || !/thinking|signature/i.test(err.message)) throw err;
        notices.push('Earlier reasoning could not be reused.');
        message = await run(() => stream(true));
      }
      const citations: ChatCitation[] = [];
      let text = '';
      for (const b of message.content) {
        if (b.type === 'fallback') notices.push(`${b.from.model} declined; ${b.to.model} answered instead.`);
        if (b.type !== 'text') continue;
        text += b.text;
        for (const c of b.citations ?? []) {
          const materialId = 'document_index' in c ? docIds[c.document_index] : undefined;
          if (!materialId) continue;
          const page = c.type === 'page_location' ? c.start_page_number : c.type === 'content_block_location' ? c.start_block_index + 1 : null;
          citations.push({ materialId, page, quote: c.cited_text });
        }
      }
      return { text, payload: message.content, citations, usage: usageOf(message.usage), model: message.model, stop: stopOf(message.stop_reason), notices };
    },

    async judge(req: JudgeRequest): Promise<JudgeResult> {
      return judgeResult(await run(() => client.beta.messages.create(withFallbacks(judgeParams(req)))));
    },

    async submitBatch(items) {
      // The Batches API does not accept the fallbacks parameter.
      try {
        const b = await client.messages.batches.create({ requests: items.map((i) => ({ custom_id: i.customId, params: judgeParams(i.request) })) });
        return b.id;
      } catch (err) {
        throw mapAnthropicError(err);
      }
    },

    async batch(id) {
      try {
        const b = await client.messages.batches.retrieve(id);
        if (b.processing_status !== 'ended') return { done: false, results: [] };
        const results: BatchEntry[] = [];
        for await (const r of await client.messages.batches.results(id)) {
          if (r.result.type === 'succeeded') results.push({ customId: r.custom_id, result: judgeResult(r.result.message), error: null });
          else results.push({ customId: r.custom_id, result: null, error: r.result.type === 'errored' ? 'The AI service returned an error for this request.' : `The request ${r.result.type}.` });
        }
        return { done: true, results };
      } catch (err) {
        throw mapAnthropicError(err);
      }
    },

    async uploadFile(bytes, name, mime) {
      try {
        return (await client.files.upload({ file: await toFile(bytes, name, { type: mime }) })).id;
      } catch (err) {
        throw mapAnthropicError(err);
      }
    },

    async deleteFile(id) {
      try {
        await client.files.delete(id);
      } catch (err) {
        throw mapAnthropicError(err);
      }
    },
  };
}
