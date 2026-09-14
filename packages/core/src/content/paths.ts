/**
 * Learning paths.
 *
 * Sixteen tracks is a catalog, not a curriculum. A path is a curated ordering
 * of tracks around a goal a learner actually has — "I want to ship an LLM
 * feature", "I want to be an ML engineer", "I need to make decisions about this
 * and I am never going to write a gradient by hand".
 *
 * Paths own no content. They are pure references into `TRACKS`, so a lesson
 * completed anywhere counts toward every path that contains its track, and
 * nothing here can drift out of sync with the curriculum except by naming a
 * track that does not exist — which `validateCatalog` checks.
 */

import type { LearnerGoal, LessonId, Path, PathId, Track, TrackId } from '../domain/types';

import { TRACKS_BY_ID } from './index';

export const PATHS: Path[] = [
  {
    id: 'path-informed',
    title: 'Follow the Conversation',
    tagline: 'Understand what people are actually talking about',
    description:
      'The shortest route to holding an informed opinion. Enough vocabulary to read the news accurately, enough mechanism to tell a real capability from a marketing claim, and enough practice to get useful output from a model yourself.',
    audience: 'Anyone who keeps nodding along and would rather not',
    icon: '🧭',
    gradient: ['#6366F1', '#8B5CF6'],
    trackIds: ['track-foundations', 'track-prompt-engineering', 'track-types-of-ml'],
    outcomes: [
      'Use the vocabulary accurately, and notice when someone else is not',
      'Explain how a model learns, and where that breaks',
      'Get reliably better output from any chat model',
      'Recognise the four learning paradigms behind a product claim',
    ],
    entryLevel: 'intro',
    goals: ['curious'] as LearnerGoal[],
  },

  {
    id: 'path-llm-builder',
    title: 'Build With LLMs',
    tagline: 'Ship a language-model feature that survives real users',
    description:
      'For engineers putting a model into production. How LLMs work at the level that changes your design decisions, how to prompt and evaluate rigorously, how to build agents that do not run away, and the safety and governance work that turns a demo into a product.',
    audience: 'Engineers shipping AI features, not training models',
    icon: '⚡',
    gradient: ['#F59E0B', '#EF4444'],
    trackIds: [
      'track-foundations',
      'track-prompt-engineering',
      'track-llms',
      'track-agents',
      'track-ethics',
    ],
    outcomes: [
      'Explain tokenization, context, and sampling well enough to debug them',
      'Design prompts that are decomposed, tested, and version-controlled',
      'Build an agent with containment, evaluation, and a sane failure path',
      'Meet the documentation and oversight expectations for a deployed system',
    ],
    entryLevel: 'intro',
    goals: ['build-products', 'career-switch'] as LearnerGoal[],
  },

  {
    id: 'path-ml-engineer',
    title: 'Machine Learning Engineer',
    tagline: 'Train it, evaluate it honestly, and keep it alive in production',
    description:
      'The full classical route. The maths you actually need, the algorithms that still win on tabular data, the feature and data work that is most of the job, and the operational discipline that decides whether any of it survives contact with production.',
    audience: 'Engineers and analysts moving into applied ML',
    icon: '⚙️',
    gradient: ['#0EA5E9', '#22D3EE'],
    trackIds: [
      'track-foundations',
      'track-math',
      'track-types-of-ml',
      'track-machine-learning',
      'track-classic-ml',
      'track-data',
      'track-mlops',
    ],
    outcomes: [
      'Choose an algorithm for a problem and defend the choice',
      'Build an evaluation that does not lie to you',
      'Find leakage, imbalance, and drift before they find you',
      'Ship a model with shadow, canary, and rollback in place',
    ],
    entryLevel: 'intro',
    goals: ['career-switch', 'exam-prep'] as LearnerGoal[],
  },

  {
    id: 'path-deep-learning',
    title: 'Deep Learning, Properly',
    tagline: 'From one neuron to the architectures behind modern models',
    description:
      'The research route. Backpropagation from the chain rule up, then the two branches that shaped the field — convolution and vision, recurrence and language — arriving at transformers with a clear view of what problem each piece was solving.',
    audience: 'People who want to read papers and follow the maths',
    icon: '🧠',
    gradient: ['#8B5CF6', '#EC4899'],
    trackIds: [
      'track-math',
      'track-machine-learning',
      'track-deep-learning',
      'track-computer-vision',
      'track-nlp',
      'track-llms',
    ],
    outcomes: [
      'Derive backpropagation and explain why gradients vanish',
      'Read a CNN or transformer architecture and say what each stage does',
      'Explain what attention replaced, and why that mattered more than quality',
      'Diagnose a training run from its loss curve',
    ],
    entryLevel: 'intermediate',
    goals: ['research', 'exam-prep'] as LearnerGoal[],
  },

  {
    id: 'path-generative',
    title: 'Generative AI End to End',
    tagline: 'Text, images, and the models that make both',
    description:
      'Everything that generates rather than classifies. Language models in depth, then diffusion, latent spaces, and multimodal models — plus the prompting and agent skills that turn a generator into something people can use.',
    audience: 'Builders and creators working with generative models',
    icon: '🎨',
    gradient: ['#EC4899', '#F43F5E'],
    trackIds: [
      'track-foundations',
      'track-prompt-engineering',
      'track-llms',
      'track-generative-ai',
      'track-agents',
    ],
    outcomes: [
      'Explain how a diffusion model turns noise into an image',
      'Say what guidance, seeds, and samplers actually control',
      'Understand latent spaces well enough to reason about failure',
      'Compose generation into a product rather than a demo',
    ],
    entryLevel: 'intro',
    goals: ['build-products', 'curious'] as LearnerGoal[],
  },

  {
    id: 'path-decision-maker',
    title: 'AI for Decision Makers',
    tagline: 'Enough depth to ask the right questions — no calculus',
    description:
      'For people who commission, fund, regulate, or are accountable for AI systems. What these systems can and cannot do, how to read an evaluation, what fairness and privacy actually require, and what a responsible deployment involves. No maths track, by design.',
    audience: 'Leaders, PMs, policy and risk people',
    icon: '🧩',
    gradient: ['#14B8A6', '#6366F1'],
    trackIds: [
      'track-foundations',
      'track-types-of-ml',
      'track-prompt-engineering',
      'track-ethics',
      'track-mlops',
    ],
    outcomes: [
      'Tell a plausible AI claim from an implausible one',
      'Read an evaluation and know what it is not telling you',
      'Name the fairness criterion a system is accountable to, and why',
      'Ask for the documentation, oversight, and rollback that should exist',
    ],
    entryLevel: 'intro',
    goals: ['lead-teams', 'curious'] as LearnerGoal[],
  },

  {
    id: 'path-rl',
    title: 'Learning From Consequences',
    tagline: 'Reinforcement learning, from gridworlds to RLHF',
    description:
      'The paradigm where there is no answer key — only reward. Value methods, policy methods, and the reward-design problems that turn out to be the same problems alignment is about.',
    audience: 'People interested in agents, control, and alignment',
    icon: '🎮',
    gradient: ['#14B8A6', '#6366F1'],
    trackIds: [
      'track-foundations',
      'track-types-of-ml',
      'track-math',
      'track-rl',
      'track-ethics',
    ],
    outcomes: [
      'Apply the Q-learning update and explain what each term does',
      'Say when a policy method beats a value method, and why',
      'Recognise specification gaming before it is trained in',
      'Connect RLHF to both the RL and the alignment literature',
    ],
    entryLevel: 'intermediate',
    goals: ['research', 'curious'] as LearnerGoal[],
  },
];

export const PATHS_BY_ID: ReadonlyMap<PathId, Path> = new Map(PATHS.map((p) => [p.id, p]));

export function getPath(id: PathId): Path | undefined {
  return PATHS_BY_ID.get(id);
}

/** The path's tracks, in order, skipping any id that no longer resolves. */
export function pathTracks(path: Path): Track[] {
  return path.trackIds
    .map((id) => TRACKS_BY_ID.get(id))
    .filter((t): t is Track => t !== undefined);
}

/** Every path that contains a given track. Shown on the track screen. */
export function pathsForTrack(trackId: TrackId): Path[] {
  return PATHS.filter((p) => p.trackIds.includes(trackId));
}

export interface PathStats {
  tracks: number;
  lessons: number;
  minutes: number;
}

export function pathStats(path: Path): PathStats {
  const tracks = pathTracks(path);
  let lessons = 0;
  let minutes = 0;
  for (const track of tracks) {
    for (const unit of track.units) {
      for (const lesson of unit.lessons) {
        lessons += 1;
        minutes += lesson.estimatedMinutes;
      }
    }
  }
  return { tracks: tracks.length, lessons, minutes };
}

export interface PathProgress {
  completedLessons: number;
  totalLessons: number;
  /** 0–1. */
  fraction: number;
  /** Per-track completion, in path order. */
  trackProgress: Array<{ trackId: TrackId; completed: number; total: number; fraction: number }>;
  /** The next unfinished lesson in path order, or null when the path is done. */
  next: { trackId: TrackId; lessonId: LessonId } | null;
}

/**
 * Progress along a path.
 *
 * Takes the set of completed lesson ids rather than the whole progress store,
 * so this stays in `content/` and the dependency keeps pointing one way.
 */
export function pathProgress(path: Path, completedLessonIds: ReadonlySet<LessonId>): PathProgress {
  const trackProgress: PathProgress['trackProgress'] = [];
  let completedLessons = 0;
  let totalLessons = 0;
  let next: PathProgress['next'] = null;

  for (const track of pathTracks(path)) {
    let completed = 0;
    let total = 0;
    for (const unit of track.units) {
      for (const lesson of unit.lessons) {
        total += 1;
        if (completedLessonIds.has(lesson.id)) {
          completed += 1;
        } else if (next === null) {
          next = { trackId: track.id, lessonId: lesson.id };
        }
      }
    }
    completedLessons += completed;
    totalLessons += total;
    trackProgress.push({
      trackId: track.id,
      completed,
      total,
      fraction: total === 0 ? 0 : completed / total,
    });
  }

  return {
    completedLessons,
    totalLessons,
    fraction: totalLessons === 0 ? 0 : completedLessons / totalLessons,
    trackProgress,
    next,
  };
}

/**
 * Paths ranked for a learner, best first.
 *
 * Started-but-unfinished paths come first — finishing something beats starting
 * something. Completed paths sink. Among untouched paths, the ones matching the
 * learner's stated interests rise.
 */
export function recommendPaths(
  completedLessonIds: ReadonlySet<LessonId>,
  goals: readonly LearnerGoal[] = [],
): Path[] {
  const wanted = new Set(goals);

  return [...PATHS]
    .map((path) => {
      const { fraction } = pathProgress(path, completedLessonIds);
      let score = 0;
      if (fraction > 0 && fraction < 1) score += 100 + fraction * 50;
      if (fraction >= 1) score -= 100;
      for (const goal of path.goals) {
        if (wanted.has(goal)) score += 20;
      }
      return { path, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.path);
}
