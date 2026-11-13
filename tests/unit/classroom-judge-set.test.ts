import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_USE_RUBRIC } from '../../src/shared/classroom/protocol';
import { looksLikeRuleChange } from '../../src/shared/classroom/integrity';
import { JUDGE_SET, SET_INFO } from '../live/classroom-judge-set';

describe('the AI-use judge evaluation set', () => {
  it('has at least 40 synthetic cases covering each kind of use, with a label for every rubric criterion', () => {
    expect(SET_INFO.synthetic).toBe(true);
    expect(JUDGE_SET.length).toBeGreaterThanOrEqual(40);
    expect(new Set(JUDGE_SET.map((c) => c.id)).size).toBe(JUDGE_SET.length);
    for (const k of ['good', 'answer_seeking', 'jailbreak', 'off_topic', 'empty']) expect(JUDGE_SET.some((c) => c.kind === k), k).toBe(true);
    for (const c of JUDGE_SET) {
      if (c.kind === 'empty') {
        expect(c.transcript).toEqual([]);
        continue;
      }
      expect(Object.keys(c.labels!).sort(), c.id).toEqual(DEFAULT_AI_USE_RUBRIC.map((r) => r.id).sort());
      expect(c.transcript[0]!.role, c.id).toBe('student');
    }
    // Every level is used for every criterion somewhere, so agreement is not just "always level 1".
    for (const r of DEFAULT_AI_USE_RUBRIC) {
      const used = new Set(JUDGE_SET.filter((c) => c.labels).map((c) => c.labels![r.id as keyof typeof c.labels]));
      expect(used.size, r.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('jailbreak cases are the ones the code-level rule-change check catches', () => {
    for (const c of JUDGE_SET.filter((x) => x.kind === 'jailbreak')) expect(c.transcript.some((m) => m.role === 'student' && looksLikeRuleChange(m.text)), c.id).toBe(true);
    for (const c of JUDGE_SET.filter((x) => x.kind === 'good' || x.kind === 'materials')) expect(c.transcript.some((m) => m.role === 'student' && looksLikeRuleChange(m.text)), c.id).toBe(false);
  });
});
