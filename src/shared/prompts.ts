import type { PromptVariable, ProviderLabel } from './types';

/** `{{name}}` or `{{name:default value}}`. Names start with a letter; spaces, digits, _ and - are allowed. */
const VAR = /\{\{\s*([A-Za-z][A-Za-z0-9 _-]{0,39}?)\s*(?::([^{}]*))?\}\}/g;

export const PROVIDER_LABELS: { value: ProviderLabel; label: string }[] = [
  { value: 'any', label: 'Any model' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'local', label: 'Local models' },
];

export const PROMPT_CATEGORIES = ['general', 'writing', 'study', 'research', 'coding', 'business', 'productivity', 'creative'] as const;

/** Distinct variables in order of first appearance. The first default given for a name wins. */
export function parseVariables(body: string): PromptVariable[] {
  const out = new Map<string, PromptVariable>();
  for (const m of body.matchAll(VAR)) {
    const name = m[1]!.trim();
    const key = name.toLowerCase();
    const def = m[2] !== undefined ? m[2].trim() : null;
    const cur = out.get(key);
    if (!cur) out.set(key, { name, defaultValue: def, required: def === null });
    else if (cur.defaultValue === null && def !== null) out.set(key, { ...cur, defaultValue: def, required: false });
  }
  return [...out.values()];
}

/** Replaces variables. Missing required values are reported, not silently left in. */
export function fillVariables(body: string, values: Record<string, string>): { text: string; missing: string[] } {
  const lower = new Map(Object.entries(values).map(([k, v]) => [k.trim().toLowerCase(), v]));
  const missing = new Set<string>();
  const text = body.replace(VAR, (_all, rawName: string, def: string | undefined) => {
    const name = rawName.trim();
    const v = lower.get(name.toLowerCase());
    if (v !== undefined && v.trim() !== '') return v;
    if (def !== undefined) return def.trim();
    missing.add(name);
    return `{{${name}}}`;
  });
  return { text, missing: [...missing] };
}
