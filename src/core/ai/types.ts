import type { AiErrorCode, ModelInfo, ProviderCapabilities, ProviderKind } from '../../shared/types';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  /** Provider-native assistant content (e.g. Claude content blocks) to replay unchanged. */
  payload?: unknown;
  /** Which provider kind produced `payload`. Payloads are only replayed to the same kind. */
  payloadKind?: ProviderKind | null;
  /** The model that produced this assistant turn. */
  model?: string | null;
}

export interface ChatRequest {
  model: string;
  system: string;
  messages: ChatTurn[];
  /** Null means "provider default". */
  maxTokens: number | null;
  /** Null means "provider default". Never sent to providers that reject sampling parameters. */
  temperature: number | null;
  stream: boolean;
}

export interface ChatResult {
  text: string;
  usage: { inputTokens?: number; outputTokens?: number } | null;
  finishReason: string;
  /** Raw assistant content to store for faithful replay on the next turn. */
  payload?: unknown;
  /** The model that actually produced the answer (may differ after a server-side fallback). */
  servedModel?: string;
  /** Human-readable notes about what happened (fallbacks, truncation). Shown in the UI. */
  notices: string[];
}

export interface ProviderRuntime {
  baseUrl: string;
  apiKey: string | null;
  options: Record<string, unknown>;
  fetch: typeof fetch;
  timeoutMs: number;
}

export interface ProviderAdapter {
  kind: ProviderKind;
  label: string;
  defaultBaseUrl: string;
  capabilities: ProviderCapabilities;
  /** Models we can suggest before the model list is loaded. Empty when the provider's catalogue changes too often to hardcode. */
  suggestedModels: ModelInfo[];
  /** Short explanation shown on the setup screen. */
  setupHelp: string;
  listModels(rt: ProviderRuntime, signal: AbortSignal): Promise<ModelInfo[]>;
  chat(rt: ProviderRuntime, req: ChatRequest, onDelta: (text: string) => void, signal: AbortSignal): Promise<ChatResult>;
}

/** A normalized provider error. `message` is written for the person using the app. */
export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly status?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }
}
