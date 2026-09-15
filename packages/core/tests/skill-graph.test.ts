/**
 * The skill graph.
 *
 * Two things matter here and neither is cosmetic: that the depth calculation
 * terminates and is correct, and that `readySkills` actually answers "what can
 * I do next" rather than returning everything unmastered.
 */

import { describe, expect, it } from 'vitest';

import { SKILLS, SKILLS_BY_ID } from '../src/content/skills';
import {
  prerequisiteChain,
  readySkills,
  skillGraph,
  skillGraphByDomain,
  skillGraphStats,
} from '../src/content/skill-graph';

describe('skill graph', () => {
  const graph = skillGraph();

  it('includes every skill', () => {
    expect(graph.size).toBe(SKILLS.length);
  });

  it('gives depth 0 to skills with no prerequisites', () => {
    for (const node of graph.values()) {
      if (node.prerequisites.length === 0) expect(node.depth).toBe(0);
    }
  });

  it('gives every skill a depth greater than all its prerequisites', () => {
    for (const node of graph.values()) {
      for (const prereqId of node.prerequisites) {
        const prereq = graph.get(prereqId);
        expect(prereq).toBeDefined();
        expect(node.depth).toBeGreaterThan(prereq?.depth ?? -1);
      }
    }
  });

  it('resolves reverse edges consistently', () => {
    for (const node of graph.values()) {
      for (const unlockedId of node.unlocks) {
        expect(graph.get(unlockedId)?.prerequisites).toContain(node.skill.id);
      }
    }
  });

  it('references only skills that exist', () => {
    for (const node of graph.values()) {
      for (const prereqId of node.prerequisites) {
        expect(SKILLS_BY_ID.has(prereqId)).toBe(true);
      }
    }
  });
});

describe('graph statistics', () => {
  const stats = skillGraphStats();

  it('reports a sane shape', () => {
    expect(stats.skills).toBe(SKILLS.length);
    expect(stats.edges).toBeGreaterThan(0);
    expect(stats.maxDepth).toBeGreaterThan(1);
    expect(stats.roots).toBeGreaterThan(0);
    expect(stats.roots).toBeLessThan(stats.skills);
  });

  it('groups every skill into exactly one domain column', () => {
    const columns = skillGraphByDomain();
    const counted = columns.reduce((sum, c) => sum + c.total, 0);
    expect(counted).toBe(SKILLS.length);
  });

  it('orders domain columns largest first', () => {
    const columns = skillGraphByDomain();
    for (let i = 1; i < columns.length; i++) {
      expect(columns[i - 1]?.total ?? 0).toBeGreaterThanOrEqual(columns[i]?.total ?? 0);
    }
  });
});

describe('prerequisite chains', () => {
  it('returns the full closure, not just direct prerequisites', () => {
    // Find a skill at depth 2 or more, which must have an indirect prerequisite.
    const deep = [...skillGraph().values()].find((n) => n.depth >= 2);
    expect(deep).toBeDefined();
    const chain = prerequisiteChain(deep?.skill.id ?? '');
    expect(chain.length).toBeGreaterThan(deep?.prerequisites.length ?? 0);
  });

  it('orders the chain shallowest first', () => {
    const graph = skillGraph();
    const deep = [...graph.values()].find((n) => n.depth >= 3);
    const chain = prerequisiteChain(deep?.skill.id ?? '');
    const depths = chain.map((s) => graph.get(s.id)?.depth ?? 0);
    expect([...depths].sort((a, b) => a - b)).toEqual(depths);
  });

  it('excludes the skill itself', () => {
    const chain = prerequisiteChain('sk-big-o');
    expect(chain.some((s) => s.id === 'sk-big-o')).toBe(false);
  });

  it('is empty for a root skill', () => {
    const root = [...skillGraph().values()].find((n) => n.prerequisites.length === 0);
    expect(prerequisiteChain(root?.skill.id ?? '')).toEqual([]);
  });
});

describe('ready skills', () => {
  it('returns only root skills when nothing is mastered', () => {
    const graph = skillGraph();
    const ready = readySkills(new Map(), 0.6, 50);
    expect(ready.length).toBeGreaterThan(0);
    for (const skill of ready) {
      expect(graph.get(skill.id)?.prerequisites).toEqual([]);
    }
  });

  it('unlocks a deeper skill once its prerequisites are mastered', () => {
    const graph = skillGraph();
    const target = [...graph.values()].find((n) => n.depth === 1 && n.prerequisites.length === 1);
    expect(target).toBeDefined();

    const mastery = new Map((target?.prerequisites ?? []).map((id) => [id, 1] as const));
    const ready = readySkills(mastery, 0.6, 500);
    expect(ready.some((s) => s.id === target?.skill.id)).toBe(true);
  });

  it('excludes skills already mastered', () => {
    const graph = skillGraph();
    const root = [...graph.values()].find((n) => n.prerequisites.length === 0);
    const mastery = new Map([[root?.skill.id ?? '', 1]]);
    const ready = readySkills(mastery, 0.6, 500);
    expect(ready.some((s) => s.id === root?.skill.id)).toBe(false);
  });

  it('respects the limit', () => {
    expect(readySkills(new Map(), 0.6, 5).length).toBe(5);
  });
});
