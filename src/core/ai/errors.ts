import type { AiErrorCode } from '../../shared/types';
import { AiError } from './types';

/** Maps an HTTP failure to a normalized error with a message a person can act on. */
export function httpError(provider: string, status: number, detail: string, retryAfter?: string | null): AiError {
  const d = detail.trim().slice(0, 400);
  const retryAfterSeconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : undefined;
  const lower = d.toLowerCase();
  let code: AiErrorCode;
  let message: string;
  if (status === 401 || (status === 403 && /api key|unauthori|authenticat|permission_denied|invalid.*key/.test(lower)) || /api key not valid|invalid api key|incorrect api key/.test(lower)) {
    code = 'auth';
    message = `${provider} rejected the API key. Check it in Settings → AI providers.`;
  } else if (status === 403) {
    code = 'auth';
    message = `${provider} refused the request for this key (permission denied).`;
  } else if (status === 429 || /rate.?limit|resource_exhausted|quota/.test(lower)) {
    code = 'rate_limit';
    message = `${provider} is rate limiting requests${retryAfterSeconds ? `; try again in ${retryAfterSeconds} s` : ''}. This can also mean the account is out of quota.`;
  } else if (status === 404 || /model.*(not found|does not exist|not_found)|unknown model|no such model|try pulling it/.test(lower)) {
    code = 'model_not_found';
    message = `${provider} could not find that model. Pick another model or reload the model list.`;
  } else if (/context.?length|too many tokens|maximum context|prompt is too long|context window/.test(lower)) {
    code = 'context_length';
    message = `The conversation is too long for this model's context window. Start a new conversation or pick a model with a larger window.`;
  } else if (status === 400 || status === 413 || status === 422) {
    code = 'bad_request';
    message = `${provider} rejected the request.`;
  } else if (status === 529 || status === 503) {
    code = 'server';
    message = `${provider} is overloaded or temporarily unavailable. Try again shortly.`;
  } else if (status >= 500) {
    code = 'server';
    message = `${provider} had a server error (${status}). Try again shortly.`;
  } else {
    code = 'unknown';
    message = `${provider} returned an unexpected response (${status}).`;
  }
  return new AiError(code, d ? `${message} Details: ${d}` : message, status, retryAfterSeconds);
}

/** Extracts the most useful message from a provider error body. */
export function errorDetail(body: string): string {
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    const e = j.error as Record<string, unknown> | string | undefined;
    if (typeof e === 'string') return e;
    if (e && typeof e.message === 'string') return e.message;
    if (typeof j.message === 'string') return j.message;
  } catch {
    // not JSON
  }
  return body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

export function networkError(provider: string, err: unknown, signal: AbortSignal, timedOut: () => boolean): AiError {
  if (err instanceof AiError) return err;
  if (timedOut()) return new AiError('timeout', `${provider} did not respond in time. Check your connection or raise the timeout in Settings → AI.`);
  if (signal.aborted) return new AiError('canceled', 'Canceled.');
  const msg = err instanceof Error ? `${err.message}${err.cause instanceof Error ? ` (${err.cause.message})` : ''}` : String(err);
  return new AiError('network', `Could not reach ${provider}. ${/ECONNREFUSED|connect/i.test(msg) ? 'Nothing is listening at that address — is the server running?' : 'Check your internet connection and the provider address.'} (${msg.slice(0, 200)})`);
}

/**
 * Combines the caller's signal with an idle timeout: the request is aborted if
 * nothing arrives for `ms`. Call touch() whenever data arrives.
 */
export function withTimeout(
  signal: AbortSignal,
  ms: number,
): { signal: AbortSignal; timedOut: () => boolean; touch: () => void; clear: () => void } {
  const ctrl = new AbortController();
  let timed = false;
  let t: ReturnType<typeof setTimeout> | null = null;
  const arm = () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      timed = true;
      ctrl.abort();
    }, ms);
  };
  arm();
  const onAbort = () => ctrl.abort();
  if (signal.aborted) ctrl.abort();
  else signal.addEventListener('abort', onAbort, { once: true });
  return {
    signal: ctrl.signal,
    timedOut: () => timed,
    touch: arm,
    clear: () => {
      if (t) clearTimeout(t);
      signal.removeEventListener('abort', onAbort);
    },
  };
}

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

const STALE_SOCKET = /other side closed|ECONNRESET|socket hang up|UND_ERR_SOCKET|EPIPE/i;

function describeCause(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause as { message?: string; code?: string } | undefined;
  return `${err.message} ${cause?.message ?? ''} ${cause?.code ?? ''}`;
}

/**
 * Retries once when a request fails because a pooled keep-alive connection was
 * already closed by the server. That failure happens before any response, so
 * the server never received the request and repeating it is safe.
 */
export function resilientFetch(inner: typeof fetch): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    try {
      return await inner(input, init);
    } catch (err) {
      if (init?.signal?.aborted || !STALE_SOCKET.test(describeCause(err))) throw err;
      return inner(input, init);
    }
  }) as typeof fetch;
}
