/**
 * Core domain vocabulary for Synapse.
 *
 * The content hierarchy is deliberately shallow so that the UI can render any
 * level of it without special cases:
 *
 *   Track  →  Unit  →  Lesson  →  Step
 *
 * A `Track` is a multi-week subject (e.g. "Neural Networks & Deep Learning").
 * A `Unit` is a themed cluster inside it (e.g. "Backpropagation").
 * A `Lesson` is one sitting, 4–8 minutes.
 * A `Step` is a single screen: a concept card, an exercise, or an interactive.
 */

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export type TrackId = string;
export type UnitId = string;
export type LessonId = string;
export type StepId = string;
export type SkillId = string;
export type AchievementId = string;

// ---------------------------------------------------------------------------
// Levels & taxonomy
// ---------------------------------------------------------------------------

/** Difficulty bands. Everything in the catalog is tagged with exactly one. */
export const LEVELS = ['intro', 'intermediate', 'expert'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_ORDER: Record<Level, number> = {
  intro: 0,
  intermediate: 1,
  expert: 2,
};

/**
 * Top-level subject domains. Used for catalog filtering, the placement test
 * blueprint, and the skill-radar on the profile screen.
 */
export const DOMAINS = [
  'foundations',
  'machine-learning',
  'deep-learning',
  'nlp',
  'llms',
  'generative-ai',
  'prompt-engineering',
  'agents',
  'computer-vision',
  'reinforcement-learning',
  'mlops',
  'ethics-safety',
  'math',
  'data',
] as const;
export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABELS: Record<Domain, string> = {
  foundations: 'AI Foundations',
  'machine-learning': 'Machine Learning',
  'deep-learning': 'Deep Learning',
  nlp: 'Natural Language Processing',
  llms: 'Large Language Models',
  'generative-ai': 'Generative AI',
  'prompt-engineering': 'Prompt Engineering',
  agents: 'AI Agents',
  'computer-vision': 'Computer Vision',
  'reinforcement-learning': 'Reinforcement Learning',
  mlops: 'MLOps & Production',
  'ethics-safety': 'Ethics & Safety',
  math: 'Math for AI',
  data: 'Data & Features',
};

// ---------------------------------------------------------------------------
// Skills — the unit of mastery tracking
// ---------------------------------------------------------------------------

/**
 * A skill is a single atomic idea ("a perceptron computes a weighted sum").
 * Exercises reference skills; mastery is tracked per skill, not per lesson, so
 * review can be scheduled at the right granularity.
 */
export interface Skill {
  id: SkillId;
  name: string;
  domain: Domain;
  level: Level;
  /** Skills that should be understood first. Used to order the review queue. */
  prerequisites: SkillId[];
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export type ExerciseKind =
  | 'multiple-choice'
  | 'multi-select'
  | 'true-false'
  | 'fill-blank'
  | 'order-sequence'
  | 'match-pairs'
  | 'numeric'
  | 'code-output'
  | 'short-answer'
  | 'categorize';

interface ExerciseBase {
  id: StepId;
  kind: ExerciseKind;
  skillIds: SkillId[];
  /** Shown after the learner answers, right or wrong. This is where the teaching happens. */
  explanation: string;
  /** Optional nudge available before answering, at the cost of a small XP penalty. */
  hint?: string;
  /** Relative weight when scoring an assessment. Defaults to 1. */
  weight?: number;
}

export interface MultipleChoiceExercise extends ExerciseBase {
  kind: 'multiple-choice';
  prompt: string;
  choices: string[];
  /** Index into `choices`. */
  answer: number;
}

export interface MultiSelectExercise extends ExerciseBase {
  kind: 'multi-select';
  prompt: string;
  choices: string[];
  /** Indices into `choices`. Order-insensitive. */
  answers: number[];
}

export interface TrueFalseExercise extends ExerciseBase {
  kind: 'true-false';
  statement: string;
  answer: boolean;
}

export interface FillBlankExercise extends ExerciseBase {
  kind: 'fill-blank';
  /** Use `___` to mark each blank. */
  template: string;
  /** One entry per blank; each entry lists accepted answers (case-insensitive). */
  blanks: string[][];
}

export interface OrderSequenceExercise extends ExerciseBase {
  kind: 'order-sequence';
  prompt: string;
  /** Presented shuffled; the array order here is the correct order. */
  items: string[];
}

export interface MatchPairsExercise extends ExerciseBase {
  kind: 'match-pairs';
  prompt: string;
  pairs: Array<{ left: string; right: string }>;
}

export interface NumericExercise extends ExerciseBase {
  kind: 'numeric';
  prompt: string;
  answer: number;
  /** Absolute tolerance. Defaults to 0. */
  tolerance?: number;
  unit?: string;
}

export interface CodeOutputExercise extends ExerciseBase {
  kind: 'code-output';
  prompt: string;
  language: 'python' | 'javascript' | 'pseudocode';
  code: string;
  choices: string[];
  answer: number;
}

/**
 * Sort items into named buckets.
 *
 * The natural shape for taxonomy questions — "is this supervised, unsupervised,
 * or reinforcement learning?" — where a multiple-choice per item would be
 * tedious and a matching exercise implies a one-to-one pairing that does not
 * exist here.
 */
export interface CategorizeExercise extends ExerciseBase {
  kind: 'categorize';
  prompt: string;
  /** Bucket names, rendered as drop targets in the order given. */
  categories: string[];
  /** Each item plus the bucket it belongs in. Presented shuffled. */
  items: Array<{ item: string; category: string }>;
}

/**
 * Free-response. Graded locally against `rubricKeywords` when offline or when
 * the learner has no AI-tutor entitlement; graded by the tutor gateway
 * otherwise, which returns qualitative feedback as well as a score.
 */
export interface ShortAnswerExercise extends ExerciseBase {
  kind: 'short-answer';
  prompt: string;
  rubricKeywords: string[];
  /** Fraction of keywords needed to pass local grading. 0–1. Defaults to 0.5. */
  passThreshold?: number;
  sampleAnswer: string;
}

export type Exercise =
  | MultipleChoiceExercise
  | MultiSelectExercise
  | TrueFalseExercise
  | FillBlankExercise
  | OrderSequenceExercise
  | MatchPairsExercise
  | NumericExercise
  | CodeOutputExercise
  | ShortAnswerExercise
  | CategorizeExercise;

// ---------------------------------------------------------------------------
// Steps — what a lesson is made of
// ---------------------------------------------------------------------------

/** A teaching screen: prose, an optional visual, and optional key terms. */
export interface ConceptStep {
  id: StepId;
  type: 'concept';
  title: string;
  /** Markdown-ish: supports **bold**, `code`, and blank-line paragraphs. */
  body: string;
  /** Named visual rendered by the app's Figure registry. */
  figure?: FigureName;
  keyTerms?: Array<{ term: string; definition: string }>;
}

/** An exercise screen. */
export interface ExerciseStep {
  id: StepId;
  type: 'exercise';
  exercise: Exercise;
}

/** A hands-on screen backed by a native interactive widget. */
export interface InteractiveStep {
  id: StepId;
  type: 'interactive';
  title: string;
  widget: InteractiveWidget;
  instructions: string;
}

/**
 * Interactive widgets are implemented in the app layer and referenced by name
 * from content, so curriculum stays pure data.
 */
export type InteractiveWidget =
  // --- Foundations & data ---
  | 'ml-type-sorter'
  | 'train-test-split'
  | 'data-bias'
  | 'bayes-calculator'
  | 'entropy-explorer'
  | 'feature-scaling'
  | 'cross-validation'
  // --- Classic ML ---
  | 'linear-regression'
  | 'knn'
  | 'kmeans'
  | 'decision-tree'
  | 'ensemble-vote'
  | 'pca-projection'
  | 'anomaly-detection'
  | 'roc-curve'
  | 'confusion-matrix'
  | 'regularization'
  | 'bias-variance'
  // --- Deep learning ---
  | 'perceptron'
  | 'neural-net-trainer'
  | 'activation-explorer'
  | 'convolution'
  | 'gradient-descent'
  | 'learning-rate-schedule'
  // --- Language models ---
  | 'tokenizer'
  | 'temperature-sampler'
  | 'attention-matrix'
  | 'embedding-space'
  | 'beam-search'
  | 'moe-router'
  | 'quantization'
  | 'rag-retrieval'
  | 'prompt-lab'
  // --- Applied ---
  | 'q-learning'
  | 'agent-loop-sim'
  | 'diffusion-denoise'
  | 'drift-monitor';

export type FigureName =
  | 'ai-ml-dl-venn'
  | 'supervised-flow'
  | 'neuron-anatomy'
  | 'mlp-layers'
  | 'loss-landscape'
  | 'train-val-test-split'
  | 'transformer-block'
  | 'attention-heads'
  | 'rag-pipeline'
  | 'diffusion-steps'
  | 'agent-loop'
  | 'rlhf-pipeline'
  | 'cnn-filters'
  | 'overfitting-curves'
  | 'confusion-matrix'
  | 'ml-paradigms'
  | 'algorithm-map'
  | 'knn-boundary'
  | 'svm-margin'
  | 'ensemble-tree'
  | 'feature-pipeline'
  | 'mlops-lifecycle';

export type Step = ConceptStep | ExerciseStep | InteractiveStep;

// ---------------------------------------------------------------------------
// Lessons, units, tracks
// ---------------------------------------------------------------------------

export interface Lesson {
  id: LessonId;
  title: string;
  /** One-line hook shown on the lesson card. */
  summary: string;
  level: Level;
  domain: Domain;
  estimatedMinutes: number;
  steps: Step[];
  /** Free lessons are playable without a subscription. See entitlements.ts. */
  free?: boolean;
}

export interface Unit {
  id: UnitId;
  title: string;
  description: string;
  lessons: Lesson[];
  /** Optional end-of-unit checkpoint. Passing it awards a badge. */
  checkpoint?: {
    id: StepId;
    title: string;
    passingScore: number;
    exercises: Exercise[];
  };
}

export interface Track {
  id: TrackId;
  title: string;
  tagline: string;
  description: string;
  domain: Domain;
  level: Level;
  /** Emoji or icon key used on the track card. */
  icon: string;
  /** Two hex colors for the card's gradient. */
  gradient: [string, string];
  units: Unit[];
  /** Tracks the learner should finish first. Soft gate — shown, not enforced. */
  prerequisites: TrackId[];
  /** Skills a learner will hold after completing the track. */
  outcomes: string[];
}

// ---------------------------------------------------------------------------
// Progress & mastery
// ---------------------------------------------------------------------------

/** Per-skill scheduling state, driven by the spaced-repetition scheduler. */
export interface SkillState {
  skillId: SkillId;
  /** 0–1. Exponential moving average of recent correctness. */
  mastery: number;
  /** SM-2 style ease factor, clamped to [1.3, 2.8]. */
  ease: number;
  /** Days until the next review. */
  intervalDays: number;
  /** Consecutive correct reviews. Resets to 0 on a lapse. */
  streak: number;
  /** Epoch ms. */
  lastReviewedAt: number;
  dueAt: number;
  totalReviews: number;
  lapses: number;
}

export interface LessonProgress {
  lessonId: LessonId;
  completedAt: number;
  /** 0–1. */
  accuracy: number;
  xpEarned: number;
  /** How many times the learner has replayed it. */
  attempts: number;
}

export type AnswerOutcome = 'correct' | 'incorrect' | 'skipped';

export interface AttemptRecord {
  stepId: StepId;
  skillIds: SkillId[];
  outcome: AnswerOutcome;
  /** Milliseconds spent on the step. */
  durationMs: number;
  usedHint: boolean;
  at: number;
}

// ---------------------------------------------------------------------------
// Gamification
// ---------------------------------------------------------------------------

export interface StreakState {
  current: number;
  longest: number;
  /** Local date key `YYYY-MM-DD` of the last day a goal was met. */
  lastActiveDay: string | null;
  /** Streak freezes protect a missed day. Free users hold 1, Plus holds 3. */
  freezesAvailable: number;
  freezesUsed: number;
}

export interface DailyGoal {
  /** XP the learner is aiming for each day. */
  targetXp: number;
  xpToday: number;
  day: string;
}

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
  /** Tiered achievements unlock repeatedly at rising thresholds. */
  tiers: number[];
}

export interface UnlockedAchievement {
  id: AchievementId;
  tier: number;
  unlockedAt: number;
}

// ---------------------------------------------------------------------------
// Learner profile
// ---------------------------------------------------------------------------

export type LearnerGoal =
  | 'curious'
  | 'career-switch'
  | 'build-products'
  | 'research'
  | 'lead-teams'
  | 'exam-prep';

export interface LearnerProfile {
  id: string;
  displayName: string;
  /** Set by onboarding, refined by the placement test. */
  selfReportedLevel: Level;
  placementLevel: Level | null;
  goals: LearnerGoal[];
  /** Minutes per day the learner committed to. */
  dailyMinutes: number;
  createdAt: number;
  timezoneOffsetMinutes: number;
}
