/**
 * AI tutor client.
 *
 * The app never holds a model provider key. It calls our own gateway, which
 * holds the credential, enforces per-user rate limits against the learner's
 * entitlement, and logs usage for billing. That is a hard architectural rule:
 * a key shipped in a mobile binary is a key that has been published.
 *
 * Everything here degrades gracefully. If the gateway is unreachable, the app
 * falls back to the local explanation already bundled with the exercise, so a
 * learner on a plane still gets taught.
 */

import type { Exercise } from '../domain/types';

export interface TutorConfig {
  baseUrl: string;
  timeoutMs: number;
  /** Short-lived session token issued by our own auth, not a provider key. */
  authToken: string | null;
  fetchImpl?: typeof fetch;
}

export type TutorIntent =
  | 'explain-answer'
  | 'why-wrong'
  | 'simpler'
  | 'deeper'
  | 'real-world-example'
  | 'grade-short-answer'
  | 'free-question';

export interface TutorRequest {
  intent: TutorIntent;
  /** The exercise or lesson the learner is looking at, for grounding. */
  context: {
    lessonId?: string;
    exerciseId?: string;
    exercisePrompt?: string;
    correctAnswer?: string;
    learnerAnswer?: string;
    /** The bundled explanation — the gateway builds on it rather than replacing it. */
    bundledExplanation?: string;
  };
  question?: string;
  /** Tunes register: an intro learner gets different phrasing than an expert. */
  learnerLevel: 'intro' | 'intermediate' | 'expert';
}

export interface TutorResponse {
  text: string;
  /** Follow-up prompts the UI offers as chips. */
  suggestions: string[];
  /** True when this came from the local fallback rather than the gateway. */
  offline: boolean;
  /** Populated for grade-short-answer. */
  grade?: { score: number; passed: boolean; feedback: string };
}

export class TutorUnavailableError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TutorUnavailableError';
  }
}

export class TutorRateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = 'TutorRateLimitError';
  }
}

export class TutorClient {
  constructor(private readonly config: TutorConfig) {}

  /**
   * Asks the tutor. Throws `TutorRateLimitError` when the learner is out of
   * quota (the UI shows the upgrade prompt) and `TutorUnavailableError` for
   * anything else, so the caller can decide between upselling and falling back.
   */
  async ask(request: TutorRequest): Promise<TutorResponse> {
    const fetchImpl = this.config.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) throw new TutorUnavailableError('No fetch implementation available');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetchImpl(`${this.config.baseUrl}/v1/tutor`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.config.authToken ? { authorization: `Bearer ${this.config.authToken}` } : {}),
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        throw new TutorRateLimitError(
          'Daily tutor limit reached',
          retryAfter ? Number.parseInt(retryAfter, 10) : null,
        );
      }
      if (!response.ok) {
        throw new TutorUnavailableError(`Tutor gateway returned ${response.status}`);
      }

      const body = (await response.json()) as Partial<TutorResponse>;
      return {
        text: body.text ?? '',
        suggestions: body.suggestions ?? [],
        offline: false,
        ...(body.grade ? { grade: body.grade } : {}),
      };
    } catch (error) {
      if (error instanceof TutorRateLimitError || error instanceof TutorUnavailableError) {
        throw error;
      }
      throw new TutorUnavailableError('Could not reach the tutor', error);
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Local fallback used when the tutor is unreachable or out of quota.
 *
 * Deliberately honest: it presents the bundled explanation and says it is
 * offline rather than pretending to be the tutor. A learner who thinks they got
 * a personalised answer when they did not is worse off than one who knows.
 */
export function localFallback(exercise: Exercise, intent: TutorIntent): TutorResponse {
  const suggestions =
    intent === 'why-wrong'
      ? ['Show me a simpler version', 'Give me a real-world example']
      : ['Why was my answer wrong?', 'Go deeper'];

  return {
    text: exercise.explanation,
    suggestions,
    offline: true,
  };
}

/** Follow-up chips offered after an exercise, tuned to whether it was correct. */
export function suggestFollowUps(wasCorrect: boolean): Array<{ intent: TutorIntent; label: string }> {
  return wasCorrect
    ? [
        { intent: 'deeper', label: 'Go deeper' },
        { intent: 'real-world-example', label: 'Real-world example' },
      ]
    : [
        { intent: 'why-wrong', label: 'Why was I wrong?' },
        { intent: 'simpler', label: 'Explain more simply' },
      ];
}
