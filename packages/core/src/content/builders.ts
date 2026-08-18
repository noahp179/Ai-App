/**
 * Terse constructors for curriculum content.
 *
 * Content files are the largest part of this package and are edited far more
 * often than the engine is. These helpers keep them readable — a lesson should
 * look like an outline, not like a JSON dump — while still producing fully
 * typed `Step` objects.
 */

import type {
  CategorizeExercise,
  CodeOutputExercise,
  ConceptStep,
  Exercise,
  ExerciseStep,
  FigureName,
  FillBlankExercise,
  InteractiveStep,
  InteractiveWidget,
  Lesson,
  MatchPairsExercise,
  MultiSelectExercise,
  MultipleChoiceExercise,
  NumericExercise,
  OrderSequenceExercise,
  ShortAnswerExercise,
  TrueFalseExercise,
} from '../domain/types';

/** Auto-incrementing suffix so content authors never hand-write step ids. */
let counter = 0;
const nextId = (prefix: string): string => `${prefix}-${(counter += 1).toString(36)}`;

export function concept(
  title: string,
  body: string,
  extra: { figure?: FigureName; keyTerms?: ConceptStep['keyTerms'] } = {},
): ConceptStep {
  return { id: nextId('c'), type: 'concept', title, body, ...extra };
}

export function interactive(
  title: string,
  widget: InteractiveWidget,
  instructions: string,
): InteractiveStep {
  return { id: nextId('i'), type: 'interactive', title, widget, instructions };
}

/** Wraps a bare exercise into a lesson step. */
export function step(exercise: Exercise): ExerciseStep {
  return { id: exercise.id, type: 'exercise', exercise };
}

// ---------------------------------------------------------------------------
// Exercise constructors
// ---------------------------------------------------------------------------

export function mcq(
  prompt: string,
  choices: string[],
  answer: number,
  skillIds: string[],
  explanation: string,
  hint?: string,
): MultipleChoiceExercise {
  return {
    id: nextId('mcq'),
    kind: 'multiple-choice',
    prompt,
    choices,
    answer,
    skillIds,
    explanation,
    ...(hint ? { hint } : {}),
  };
}

export function multi(
  prompt: string,
  choices: string[],
  answers: number[],
  skillIds: string[],
  explanation: string,
  hint?: string,
): MultiSelectExercise {
  return {
    id: nextId('ms'),
    kind: 'multi-select',
    prompt,
    choices,
    answers,
    skillIds,
    explanation,
    ...(hint ? { hint } : {}),
  };
}

export function trueFalse(
  statement: string,
  answer: boolean,
  skillIds: string[],
  explanation: string,
): TrueFalseExercise {
  return { id: nextId('tf'), kind: 'true-false', statement, answer, skillIds, explanation };
}

export function fill(
  template: string,
  blanks: string[][],
  skillIds: string[],
  explanation: string,
  hint?: string,
): FillBlankExercise {
  return {
    id: nextId('fb'),
    kind: 'fill-blank',
    template,
    blanks,
    skillIds,
    explanation,
    ...(hint ? { hint } : {}),
  };
}

export function order(
  prompt: string,
  items: string[],
  skillIds: string[],
  explanation: string,
): OrderSequenceExercise {
  return { id: nextId('ord'), kind: 'order-sequence', prompt, items, skillIds, explanation };
}

export function match(
  prompt: string,
  pairs: Array<{ left: string; right: string }>,
  skillIds: string[],
  explanation: string,
): MatchPairsExercise {
  return { id: nextId('mp'), kind: 'match-pairs', prompt, pairs, skillIds, explanation };
}

export function numeric(
  prompt: string,
  answer: number,
  skillIds: string[],
  explanation: string,
  opts: { tolerance?: number; unit?: string; hint?: string } = {},
): NumericExercise {
  return {
    id: nextId('num'),
    kind: 'numeric',
    prompt,
    answer,
    skillIds,
    explanation,
    ...(opts.tolerance !== undefined ? { tolerance: opts.tolerance } : {}),
    ...(opts.unit ? { unit: opts.unit } : {}),
    ...(opts.hint ? { hint: opts.hint } : {}),
  };
}

export function codeOutput(
  prompt: string,
  language: CodeOutputExercise['language'],
  code: string,
  choices: string[],
  answer: number,
  skillIds: string[],
  explanation: string,
): CodeOutputExercise {
  return {
    id: nextId('code'),
    kind: 'code-output',
    prompt,
    language,
    code,
    choices,
    answer,
    skillIds,
    explanation,
  };
}

export function categorize(
  prompt: string,
  categories: string[],
  items: Array<{ item: string; category: string }>,
  skillIds: string[],
  explanation: string,
  hint?: string,
): CategorizeExercise {
  return {
    id: nextId('cat'),
    kind: 'categorize',
    prompt,
    categories,
    items,
    skillIds,
    explanation,
    ...(hint ? { hint } : {}),
  };
}

export function shortAnswer(
  prompt: string,
  rubricKeywords: string[],
  sampleAnswer: string,
  skillIds: string[],
  explanation: string,
  passThreshold = 0.5,
): ShortAnswerExercise {
  return {
    id: nextId('sa'),
    kind: 'short-answer',
    prompt,
    rubricKeywords,
    sampleAnswer,
    passThreshold,
    skillIds,
    explanation,
  };
}

// ---------------------------------------------------------------------------
// Lesson constructor
// ---------------------------------------------------------------------------

export function lesson(config: {
  id: string;
  title: string;
  summary: string;
  level: Lesson['level'];
  domain: Lesson['domain'];
  minutes?: number;
  free?: boolean;
  steps: Array<ConceptStep | InteractiveStep | Exercise>;
}): Lesson {
  const steps = config.steps.map((entry) =>
    'type' in entry ? entry : step(entry),
  );

  return {
    id: config.id,
    title: config.title,
    summary: config.summary,
    level: config.level,
    domain: config.domain,
    // A concept screen reads in ~40s; an exercise takes ~30s to answer well.
    estimatedMinutes:
      config.minutes ??
      Math.max(
        3,
        Math.round(
          steps.reduce((m, s) => m + (s.type === 'exercise' ? 0.5 : 0.7), 0),
        ),
      ),
    steps,
    ...(config.free ? { free: true } : {}),
  };
}
