import type { z } from 'zod';

/**
 * Everything the classroom service asks of an AI provider. Grading and UI code depend only on this interface, so
 * another provider can be added without touching them.
 */
export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
}
export const NO_USAGE: AiUsage = { inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheWrite: 0 };

/** A teacher's material as the assistant receives it. */
export interface AiDocument {
  materialId: string;
  title: string;
  /** Extracted text, one entry per page or slide. */
  pages: string[];
  /** Provider-side file id (PDFs uploaded once), when there is one. */
  fileId: string | null;
  image: { mediaType: 'image/png' | 'image/jpeg'; base64: string } | null;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  /** The provider's own record of an assistant turn, replayed unchanged when present. */
  payload?: unknown;
}
export interface ChatRequest {
  model: string;
  effort: string;
  system: string;
  documents: AiDocument[];
  turns: ChatTurn[];
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}
export interface ChatCitation {
  /** Index into `documents` (text documents only, in order). */
  materialId: string;
  page: number | null;
  quote: string;
}
export type StopKind = 'end' | 'refusal' | 'max_tokens';
export interface ChatResult {
  text: string;
  payload: unknown;
  citations: ChatCitation[];
  usage: AiUsage;
  model: string;
  stop: StopKind;
  notices: string[];
}

export interface JudgeRequest {
  model: string;
  effort: string;
  system: string;
  user: string;
  /** The exact shape the reply must have. */
  schema: z.ZodType;
  maxTokens?: number;
}
export interface JudgeResult {
  /** The reply's JSON text; null when the provider returned nothing usable. */
  text: string | null;
  usage: AiUsage;
  model: string;
  stop: StopKind;
}
export interface BatchEntry {
  customId: string;
  result: JudgeResult | null;
  error: string | null;
}

export interface AiProvider {
  readonly name: string;
  chat(req: ChatRequest): Promise<ChatResult>;
  judge(req: JudgeRequest): Promise<JudgeResult>;
  /** Submits many judge requests to be processed asynchronously. Returns the batch id. */
  submitBatch(items: { customId: string; request: JudgeRequest }[]): Promise<string>;
  /** Results arrive in any order: always match them by customId. */
  batch(id: string): Promise<{ done: boolean; results: BatchEntry[] }>;
  /** Whether batch results are billed at a discount (used for the cost estimate). */
  readonly batchDiscount: number;
  uploadFile?(bytes: Buffer, name: string, mime: string): Promise<string>;
  deleteFile?(id: string): Promise<void>;
}

export type AiErrorKind = 'rate_limited' | 'overloaded' | 'auth' | 'invalid' | 'network' | 'other';
export class AiProviderError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
  ) {
    super(message);
  }
  get retryable(): boolean {
    return this.kind === 'rate_limited' || this.kind === 'overloaded' || this.kind === 'network';
  }
}

/** What teachers and students are told for each kind of failure. */
export const AI_ERROR_MESSAGE: Record<AiErrorKind, string> = {
  rate_limited: 'The AI service is receiving too many requests right now. Wait a moment and try again.',
  overloaded: 'The AI service is busy right now. Try again in a minute.',
  auth: 'The school’s AI key was not accepted. An administrator needs to check it in the school settings.',
  invalid: 'The AI service did not accept this request.',
  network: 'The AI service could not be reached. Check the server’s connection and try again.',
  other: 'The AI request failed.',
};
