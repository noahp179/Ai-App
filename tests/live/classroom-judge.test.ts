import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { anthropicProvider } from '../../classroom-server/ai/anthropic';
import { EvaluationOutput, evaluationPrompt } from '../../classroom-server/ai/prompts';
import { DEFAULT_AI_USE_RUBRIC } from '../../src/shared/classroom/protocol';
import { isVerbatim } from '../../src/shared/classroom/overlap';
import { JUDGE_SET, SET_INFO, type CriterionId } from './classroom-judge-set';

/**
 * Runs the AI-use judge on the evaluation set against the real Claude API and measures agreement with the set's
 * labels. Opt-in, because it costs money (about 40 requests):
 *   ANTHROPIC_API_KEY=… npx vitest run tests/live/classroom-judge.test.ts
 * Optional: FC_JUDGE_MODEL (default claude-opus-5-5), FC_JUDGE_EFFORT (default high).
 * Writes test-results/classroom-judge.json. Record the numbers in docs/TEST_REPORT.md only from a real run.
 */
const key = process.env.ANTHROPIC_API_KEY;
const model = process.env.FC_JUDGE_MODEL ?? 'claude-opus-5-5';
const effort = process.env.FC_JUDGE_EFFORT ?? 'high';

describe.skipIf(!key)('live: AI-use judge agreement', () => {
  it('returns a usable evaluation for every case and reports agreement per criterion', async () => {
    const ai = anthropicProvider({ apiKey: key!, baseURL: process.env.ANTHROPIC_BASE_URL });
    const ids = DEFAULT_AI_USE_RUBRIC.map((r) => r.id as CriterionId);
    const per = Object.fromEntries(ids.map((c) => [c, { exact: 0, within1: 0, n: 0 }]));
    const rows: unknown[] = [];
    let invalid = 0;
    let quotes = 0;
    let badQuotes = 0;
    let flagHits = 0;
    let flagExpected = 0;
    let falseFlags = 0;
    let usage = { inputTokens: 0, outputTokens: 0 };
    const cases = JUDGE_SET.filter((c) => c.labels);
    for (const c of cases) {
      const transcript = c.transcript.map((m, i) => ({ id: `m${String(i + 1).padStart(7, '0')}`, role: m.role, kind: 'message', text: m.text }));
      const p = evaluationPrompt({ mode: c.mode, questions: c.questions, rubric: DEFAULT_AI_USE_RUBRIC, transcript });
      let out: ReturnType<typeof EvaluationOutput.safeParse> | null = null;
      for (let attempt = 0; attempt < 2 && !out?.success; attempt++) {
        const r = await ai.judge({ model, effort, system: p.system, user: p.user, schema: EvaluationOutput });
        usage = { inputTokens: usage.inputTokens + r.usage.inputTokens, outputTokens: usage.outputTokens + r.usage.outputTokens };
        try {
          out = r.stop === 'end' && r.text ? EvaluationOutput.safeParse(JSON.parse(r.text)) : null;
        } catch {
          out = null;
        }
        if (out?.success && !ids.every((id) => out!.success && out!.data.criteria.some((x) => x.criterionId === id && x.level >= 1 && x.level <= 4))) out = null;
      }
      if (!out?.success) {
        invalid++;
        rows.push({ id: c.id, invalid: true });
        continue;
      }
      const got: Record<string, number> = {};
      for (const id of ids) {
        const x = out.data.criteria.find((y) => y.criterionId === id)!;
        got[id] = x.level;
        const want = c.labels![id];
        per[id]!.n++;
        if (x.level === want) per[id]!.exact++;
        if (Math.abs(x.level - want) <= 1) per[id]!.within1++;
        for (const q of x.quotes) {
          quotes++;
          if (!transcript.some((m) => isVerbatim(q.text, m.text))) badQuotes++;
        }
      }
      const flagged = out.data.flags.length > 0;
      if (c.expectFlag) {
        flagExpected++;
        if (flagged) flagHits++;
      } else if (flagged) falseFlags++;
      rows.push({ id: c.id, kind: c.kind, labels: c.labels, got, flags: out.data.flags });
    }
    const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : null);
    const report = {
      ranAt: new Date().toISOString(),
      model,
      effort,
      set: { ...SET_INFO, cases: cases.length },
      validOutputs: `${cases.length - invalid} of ${cases.length}`,
      agreement: Object.fromEntries(ids.map((id) => [id, { exactPct: pct(per[id]!.exact, per[id]!.n), within1Pct: pct(per[id]!.within1, per[id]!.n), n: per[id]!.n }])),
      flags: { expectedFlagged: `${flagHits} of ${flagExpected}`, unexpectedFlags: `${falseFlags} of ${cases.length - flagExpected}` },
      quotes: { total: quotes, notVerbatim: badQuotes },
      usage,
      rows,
    };
    fs.mkdirSync(path.join(__dirname, '..', '..', 'test-results'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '..', '..', 'test-results', 'classroom-judge.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
    expect(invalid).toBe(0);
  }, 1_800_000);
});
