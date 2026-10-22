import { z } from 'zod';
import type { LearningPath, LearningResource } from '../types';
import rawCatalog from './catalog.json';
import rawCheck from './link-check.json';

export const LEARNING_TOPICS = [
  { id: 'fundamentals', label: 'AI fundamentals' },
  { id: 'prompting', label: 'Prompting' },
  { id: 'generative-ai', label: 'Generative AI' },
  { id: 'machine-learning', label: 'Machine learning' },
  { id: 'deep-learning', label: 'Deep learning' },
  { id: 'responsible-ai', label: 'Responsible AI' },
  { id: 'programming', label: 'Programming' },
  { id: 'math', label: 'Maths for ML' },
  { id: 'writing-research', label: 'Writing & research' },
  { id: 'education', label: 'Students & teachers' },
  { id: 'business', label: 'Business' },
] as const;
export type LearningTopic = (typeof LEARNING_TOPICS)[number]['id'];
const TOPIC_IDS = LEARNING_TOPICS.map((t) => t.id) as [LearningTopic, ...LearningTopic[]];

const Resource = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().regex(/^https:\/\//),
  check: z.string().min(1),
  type: z.enum(['article', 'guide', 'video', 'course', 'exercise', 'documentation', 'project', 'book']),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  topics: z.array(z.enum(TOPIC_IDS)).min(1),
  summary: z.string().min(1),
  registration: z.enum(['none', 'optional', 'required']),
  paidExtras: z.string().nullable(),
  prerequisites: z.array(z.string()),
  accessibility: z.string().nullable(),
});
const Path = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  audience: z.string().min(1),
  description: z.string().min(1),
  steps: z.array(z.object({ resourceId: z.string(), why: z.string().min(1) })).min(3),
});
const Catalog = z.object({ resources: z.array(Resource), paths: z.array(Path) });
const LinkCheck = z.object({
  checkedOn: z.string(),
  results: z.record(z.string(), z.object({ status: z.number().nullable(), ok: z.boolean(), finalUrl: z.string().nullable(), note: z.string().nullable() })),
});

/** Parses and cross-checks the bundled catalog. Throws if a path or prerequisite points at an unknown resource. */
export function loadCatalog(raw: unknown = rawCatalog, rawLinkCheck: unknown = rawCheck): { resources: LearningResource[]; paths: LearningPath[]; checkedOn: string | null } {
  const c = Catalog.parse(raw);
  const check = LinkCheck.safeParse(rawLinkCheck);
  const ids = new Set(c.resources.map((r) => r.id));
  if (ids.size !== c.resources.length) throw new Error('Duplicate learning resource id');
  for (const p of c.paths) for (const s of p.steps) if (!ids.has(s.resourceId)) throw new Error(`Path ${p.id} refers to unknown resource ${s.resourceId}`);
  const checkedOn = check.success ? check.data.checkedOn : null;
  const resources: LearningResource[] = c.resources.map((r) => {
    const res = check.success ? check.data.results[r.id] : undefined;
    return {
      id: r.id,
      title: r.title,
      publisher: r.publisher,
      url: r.url,
      type: r.type,
      level: r.level,
      topics: r.topics,
      summary: r.summary,
      registration: r.registration,
      free: true,
      paidExtras: r.paidExtras,
      prerequisites: r.prerequisites,
      accessibility: r.accessibility,
      linkCheck: res && checkedOn ? { checkedOn, status: res.status, ok: res.ok } : null,
    };
  });
  return { resources, paths: c.paths, checkedOn };
}

export function topicLabel(id: string): string {
  return LEARNING_TOPICS.find((t) => t.id === id)?.label ?? id;
}
