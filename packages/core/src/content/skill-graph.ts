/**
 * The skill prerequisite graph, as something you can look at.
 *
 * Every skill already declares its prerequisites, and until now that data only
 * drove scheduling. It is also a map of the subject: 400-odd nodes with the
 * dependencies between them, which is the clearest single answer to "what is
 * actually in here, and what rests on what".
 *
 * Layout is by **depth** — the longest prerequisite chain ending at a skill —
 * because that is the only ordering that is true regardless of how someone
 * chose to study. Depth 0 skills need nothing; depth 4 skills sit on four
 * layers of assumed knowledge.
 */

import type { Domain, Skill, SkillId } from '../domain/types';

import { SKILLS, SKILLS_BY_ID } from './skills';

export interface GraphNode {
  skill: Skill;
  /** Longest prerequisite chain ending here. 0 means it assumes nothing. */
  depth: number;
  /** Direct prerequisites that actually resolve to a skill. */
  prerequisites: SkillId[];
  /** Skills that name this one as a prerequisite. */
  unlocks: SkillId[];
}

export interface DomainColumn {
  domain: Domain;
  /** Nodes grouped by depth, shallowest first. */
  layers: GraphNode[][];
  total: number;
}

/**
 * Depth for every skill.
 *
 * Memoised depth-first with a visiting set, so a cycle in the data degrades to
 * a finite depth rather than hanging. Cycles should not exist — the catalog
 * validator would be a better place to reject one — but a rendering function
 * is the wrong place to discover that.
 */
function computeDepths(): Map<SkillId, number> {
  const depths = new Map<SkillId, number>();
  const visiting = new Set<SkillId>();

  const depthOf = (id: SkillId): number => {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // Cycle guard.

    const skill = SKILLS_BY_ID.get(id);
    if (!skill) return 0;

    visiting.add(id);
    const prereqs = skill.prerequisites ?? [];
    const depth = prereqs.length === 0 ? 0 : 1 + Math.max(...prereqs.map(depthOf));
    visiting.delete(id);

    depths.set(id, depth);
    return depth;
  };

  for (const skill of SKILLS) depthOf(skill.id);
  return depths;
}

let cachedNodes: Map<SkillId, GraphNode> | null = null;

/** Every skill as a graph node, with depth and both edge directions resolved. */
export function skillGraph(): ReadonlyMap<SkillId, GraphNode> {
  if (cachedNodes) return cachedNodes;

  const depths = computeDepths();
  const nodes = new Map<SkillId, GraphNode>();

  for (const skill of SKILLS) {
    nodes.set(skill.id, {
      skill,
      depth: depths.get(skill.id) ?? 0,
      prerequisites: (skill.prerequisites ?? []).filter((id) => SKILLS_BY_ID.has(id)),
      unlocks: [],
    });
  }

  // Reverse edges, so a node can say what depends on it.
  for (const node of nodes.values()) {
    for (const prereqId of node.prerequisites) {
      nodes.get(prereqId)?.unlocks.push(node.skill.id);
    }
  }

  cachedNodes = nodes;
  return nodes;
}

/**
 * The graph grouped by domain and then by depth.
 *
 * Domains are ordered by size, largest first, because a screen showing all of
 * them is more legible when the substantial ones come before the small ones.
 */
export function skillGraphByDomain(): DomainColumn[] {
  const nodes = [...skillGraph().values()];
  const byDomain = new Map<Domain, GraphNode[]>();

  for (const node of nodes) {
    const list = byDomain.get(node.skill.domain) ?? [];
    list.push(node);
    byDomain.set(node.skill.domain, list);
  }

  const columns: DomainColumn[] = [];
  for (const [domain, list] of byDomain) {
    const maxDepth = Math.max(...list.map((n) => n.depth));
    const layers: GraphNode[][] = Array.from({ length: maxDepth + 1 }, () => []);
    for (const node of list) layers[node.depth]?.push(node);
    for (const layer of layers) layer.sort((a, b) => a.skill.name.localeCompare(b.skill.name));
    columns.push({ domain, layers, total: list.length });
  }

  return columns.sort((a, b) => b.total - a.total);
}

export interface GraphStats {
  skills: number;
  edges: number;
  /** The deepest prerequisite chain anywhere in the catalog. */
  maxDepth: number;
  /** Skills nothing depends on — the ends of chains. */
  leaves: number;
  /** Skills with no prerequisites — valid entry points. */
  roots: number;
}

export function skillGraphStats(): GraphStats {
  const nodes = [...skillGraph().values()];
  return {
    skills: nodes.length,
    edges: nodes.reduce((sum, n) => sum + n.prerequisites.length, 0),
    maxDepth: Math.max(...nodes.map((n) => n.depth)),
    leaves: nodes.filter((n) => n.unlocks.length === 0).length,
    roots: nodes.filter((n) => n.prerequisites.length === 0).length,
  };
}

/**
 * The full prerequisite closure of a skill, shallowest first.
 *
 * This is the honest answer to "what do I need before this?" — not the direct
 * prerequisites, which are usually two or three, but everything underneath
 * them, which is frequently a dozen.
 */
export function prerequisiteChain(skillId: SkillId): Skill[] {
  const graph = skillGraph();
  const seen = new Set<SkillId>();
  const out: Skill[] = [];

  const walk = (id: SkillId): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = graph.get(id);
    if (!node) return;
    for (const prereq of node.prerequisites) walk(prereq);
    if (id !== skillId) out.push(node.skill);
  };

  walk(skillId);
  return out.sort((a, b) => (graph.get(a.id)?.depth ?? 0) - (graph.get(b.id)?.depth ?? 0));
}

/**
 * The skills a learner is ready for: every prerequisite mastered, this one not.
 *
 * This is the useful query the graph enables. Rather than "what have you not
 * done", which is most of the catalog, it answers "what is immediately
 * available to you now" — which is a far shorter and more actionable list.
 */
export function readySkills(
  masteryBySkill: ReadonlyMap<SkillId, number>,
  threshold = 0.6,
  limit = 12,
): Skill[] {
  const graph = skillGraph();
  const mastered = (id: SkillId): boolean => (masteryBySkill.get(id) ?? 0) >= threshold;

  const ready: GraphNode[] = [];
  for (const node of graph.values()) {
    if (mastered(node.skill.id)) continue;
    if (!node.prerequisites.every(mastered)) continue;
    ready.push(node);
  }

  // Shallowest first, then by how much they unlock — a skill that opens five
  // others is a better next step than one that opens none.
  return ready
    .sort((a, b) => a.depth - b.depth || b.unlocks.length - a.unlocks.length)
    .slice(0, limit)
    .map((n) => n.skill);
}
