import type { ProviderKind } from '../../shared/types';
import { anthropicAdapter } from './adapters/anthropic';
import { geminiAdapter } from './adapters/gemini';
import { ollamaAdapter } from './adapters/ollama';
import { openAiAdapter } from './adapters/openai';
import type { ProviderAdapter } from './types';

export const ADAPTERS: Record<ProviderKind, ProviderAdapter> = {
  openai: openAiAdapter('openai'),
  openai_compatible: openAiAdapter('openai_compatible'),
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
  ollama: ollamaAdapter,
};

export function adapterFor(kind: ProviderKind): ProviderAdapter {
  const a = ADAPTERS[kind];
  if (!a) throw new Error(`Unknown provider kind: ${kind}`);
  return a;
}
