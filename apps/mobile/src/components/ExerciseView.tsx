/**
 * Renders any exercise kind and reports the learner's draft response upward.
 *
 * One component per kind, dispatched from a single switch, so adding an
 * exercise type means adding a case here and a case in core's grader — and
 * TypeScript's exhaustiveness check flags the second if you forget.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import {
  hashString,
  seededShuffle,
  type Exercise,
  type GradeResult,
  type Response,
} from '@synapse/core';
import { AnswerOption, Badge, Card, Text, useTheme } from '@synapse/ui';

import { tapFeedback } from '../lib/haptics.js';

export interface ExerciseViewProps {
  exercise: Exercise;
  draft: Response | null;
  onDraftChange: (draft: Response) => void;
  /** Set once submitted — switches the view into its revealed state. */
  result: GradeResult | null;
}

export function ExerciseView(props: ExerciseViewProps): React.JSX.Element {
  const { exercise } = props;

  switch (exercise.kind) {
    case 'multiple-choice':
      return <ChoiceExercise {...props} prompt={exercise.prompt} choices={exercise.choices} answer={exercise.answer} />;
    case 'code-output':
      return (
        <ChoiceExercise
          {...props}
          prompt={exercise.prompt}
          choices={exercise.choices}
          answer={exercise.answer}
          code={exercise.code}
        />
      );
    case 'true-false':
      return <TrueFalseExercise {...props} />;
    case 'multi-select':
      return <MultiSelectExercise {...props} />;
    case 'fill-blank':
      return <FillBlankExercise {...props} />;
    case 'numeric':
      return <NumericExercise {...props} />;
    case 'order-sequence':
      return <OrderExercise {...props} />;
    case 'match-pairs':
      return <MatchExercise {...props} />;
    case 'short-answer':
      return <ShortAnswerExercise {...props} />;
    case 'categorize':
      return <CategorizeExercise {...props} />;
    default: {
      const never: never = exercise;
      void never;
      return <Text>Unsupported exercise</Text>;
    }
  }
}

// ---------------------------------------------------------------------------

function Prompt({ children }: { children: string }): React.JSX.Element {
  const theme = useTheme();
  return (
    <Text variant="heading" style={{ marginBottom: theme.spacing.xl }}>
      {children}
    </Text>
  );
}

function CodeBlock({ code }: { code: string }): React.JSX.Element {
  const theme = useTheme();
  return (
    <Card
      background={theme.colors.surfaceMuted}
      style={{ marginBottom: theme.spacing.xl }}
    >
      <Text variant="mono" mono>
        {code}
      </Text>
    </Card>
  );
}

/**
 * Choice order is shuffled per exercise but stable across re-renders, so the
 * correct answer is not always in the same position while options never move
 * under the learner's finger mid-question.
 */
function useShuffledChoices(
  exerciseId: string,
  choices: string[],
): Array<{ label: string; originalIndex: number }> {
  return useMemo(() => {
    const indexed = choices.map((label, originalIndex) => ({ label, originalIndex }));
    return seededShuffle(indexed, hashString(exerciseId));
  }, [exerciseId, choices]);
}

// ---------------------------------------------------------------------------

function ChoiceExercise({
  exercise,
  draft,
  onDraftChange,
  result,
  prompt,
  choices,
  answer,
  code,
}: ExerciseViewProps & {
  prompt: string;
  choices: string[];
  answer: number;
  code?: string;
}): React.JSX.Element {
  const theme = useTheme();
  const shuffled = useShuffledChoices(exercise.id, choices);
  const selected = draft?.kind === 'choice' ? draft.index : null;

  return (
    <View>
      <Prompt>{prompt}</Prompt>
      {code ? <CodeBlock code={code} /> : null}

      <View style={{ gap: theme.spacing.md }}>
        {shuffled.map(({ label, originalIndex }, position) => {
          let state: 'idle' | 'selected' | 'correct' | 'incorrect' | 'revealed' = 'idle';

          if (result) {
            if (originalIndex === answer) state = 'correct';
            else if (originalIndex === selected) state = 'incorrect';
          } else if (originalIndex === selected) {
            state = 'selected';
          }

          return (
            <AnswerOption
              key={`${exercise.id}-${originalIndex}`}
              label={label}
              state={state}
              shortcut={String(position + 1)}
              disabled={result !== null}
              onPress={() => {
                tapFeedback();
                onDraftChange({ kind: 'choice', index: originalIndex });
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function TrueFalseExercise({
  exercise,
  draft,
  onDraftChange,
  result,
}: ExerciseViewProps): React.JSX.Element {
  const theme = useTheme();
  if (exercise.kind !== 'true-false') return <View />;

  const selected = draft?.kind === 'boolean' ? draft.value : null;

  return (
    <View>
      <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.sm }}>
        True or false
      </Text>
      <Prompt>{exercise.statement}</Prompt>

      <View style={{ gap: theme.spacing.md }}>
        {[true, false].map((value) => {
          let state: 'idle' | 'selected' | 'correct' | 'incorrect' = 'idle';
          if (result) {
            if (value === exercise.answer) state = 'correct';
            else if (value === selected) state = 'incorrect';
          } else if (value === selected) {
            state = 'selected';
          }

          return (
            <AnswerOption
              key={String(value)}
              label={value ? 'True' : 'False'}
              state={state}
              disabled={result !== null}
              onPress={() => {
                tapFeedback();
                onDraftChange({ kind: 'boolean', value });
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function MultiSelectExercise({
  exercise,
  draft,
  onDraftChange,
  result,
}: ExerciseViewProps): React.JSX.Element {
  const theme = useTheme();
  const shuffled = useShuffledChoices(
    exercise.id,
    exercise.kind === 'multi-select' ? exercise.choices : [],
  );
  if (exercise.kind !== 'multi-select') return <View />;

  const selected = draft?.kind === 'choices' ? draft.indices : [];

  const toggle = (index: number): void => {
    tapFeedback();
    const next = selected.includes(index)
      ? selected.filter((i) => i !== index)
      : [...selected, index];
    onDraftChange({ kind: 'choices', indices: next });
  };

  return (
    <View>
      <Prompt>{exercise.prompt}</Prompt>
      <Badge label="Select all that apply" tone="info" style={{ marginBottom: theme.spacing.lg }} />

      <View style={{ gap: theme.spacing.md }}>
        {shuffled.map(({ label, originalIndex }) => {
          const isSelected = selected.includes(originalIndex);
          const isAnswer = exercise.answers.includes(originalIndex);

          let state: 'idle' | 'selected' | 'correct' | 'incorrect' | 'revealed' = 'idle';
          if (result) {
            if (isSelected && isAnswer) state = 'correct';
            else if (isSelected && !isAnswer) state = 'incorrect';
            else if (!isSelected && isAnswer) state = 'revealed';
          } else if (isSelected) {
            state = 'selected';
          }

          return (
            <AnswerOption
              key={`${exercise.id}-${originalIndex}`}
              label={label}
              state={state}
              disabled={result !== null}
              onPress={() => toggle(originalIndex)}
            />
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function FillBlankExercise({
  exercise,
  draft,
  onDraftChange,
  result,
}: ExerciseViewProps): React.JSX.Element {
  const theme = useTheme();
  if (exercise.kind !== 'fill-blank') return <View />;

  const values = draft?.kind === 'text' ? draft.values : [];
  const segments = exercise.template.split('___');

  const update = (index: number, value: string): void => {
    const next = [...values];
    while (next.length < exercise.blanks.length) next.push('');
    next[index] = value;
    onDraftChange({ kind: 'text', values: next });
  };

  return (
    <View>
      <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.sm }}>
        Fill in the blanks
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        {segments.map((segment, index) => (
          <React.Fragment key={`${exercise.id}-seg-${index}`}>
            <Text variant="subheading">{segment}</Text>
            {index < segments.length - 1 ? (
              <TextInput
                value={values[index] ?? ''}
                onChangeText={(text) => update(index, text)}
                editable={result === null}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="?"
                placeholderTextColor={theme.colors.textTertiary}
                style={{
                  minWidth: 96,
                  marginHorizontal: theme.spacing.xs,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                  borderRadius: theme.radii.sm,
                  borderBottomWidth: 2,
                  borderColor: result
                    ? result.detail?.[index]
                      ? theme.colors.success
                      : theme.colors.danger
                    : theme.colors.primary,
                  backgroundColor: theme.colors.surfaceMuted,
                  color: theme.colors.text,
                  ...theme.typography.subheading,
                }}
              />
            ) : null}
          </React.Fragment>
        ))}
      </View>

      {result && !result.correct ? (
        <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.lg }}>
          Accepted: {exercise.blanks.map((options) => options[0]).join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

function NumericExercise({
  exercise,
  draft,
  onDraftChange,
  result,
}: ExerciseViewProps): React.JSX.Element {
  const theme = useTheme();
  const [text, setText] = useState('');
  if (exercise.kind !== 'numeric') return <View />;

  return (
    <View>
      <Prompt>{exercise.prompt}</Prompt>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          value={text}
          onChangeText={(value) => {
            setText(value);
            const parsed = Number.parseFloat(value.replace(/,/g, ''));
            onDraftChange({ kind: 'number', value: parsed });
          }}
          editable={result === null}
          keyboardType="numbers-and-punctuation"
          placeholder="0"
          placeholderTextColor={theme.colors.textTertiary}
          style={{
            flex: 1,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.radii.lg,
            borderWidth: 2,
            borderColor: result
              ? result.correct
                ? theme.colors.success
                : theme.colors.danger
              : theme.colors.border,
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            ...theme.typography.title,
          }}
        />
        {exercise.unit ? (
          <Text variant="title" tone="tertiary" style={{ marginLeft: theme.spacing.md }}>
            {exercise.unit}
          </Text>
        ) : null}
      </View>

      {result && !result.correct ? (
        <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.md }}>
          Correct answer: {exercise.answer}
          {exercise.unit ? ` ${exercise.unit}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * Ordering is tap-to-append rather than drag-and-drop. Dragging is fiddly on a
 * phone and inaccessible to screen readers; tapping in sequence is precise,
 * reversible, and works with any input method.
 */
function OrderExercise({
  exercise,
  draft,
  onDraftChange,
  result,
}: ExerciseViewProps): React.JSX.Element {
  const theme = useTheme();
  const shuffled = useMemo(
    () =>
      exercise.kind === 'order-sequence'
        ? seededShuffle(exercise.items, hashString(exercise.id))
        : [],
    [exercise],
  );
  if (exercise.kind !== 'order-sequence') return <View />;

  const ordered = draft?.kind === 'order' ? draft.items : [];
  const remaining = shuffled.filter((item) => !ordered.includes(item));

  return (
    <View>
      <Prompt>{exercise.prompt}</Prompt>

      <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.sm }}>
        Your order
      </Text>
      <View
        style={{
          minHeight: 72,
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.colors.border,
          marginBottom: theme.spacing.xl,
        }}
      >
        {ordered.length === 0 ? (
          <Text variant="caption" tone="tertiary">
            Tap the steps below in the correct order
          </Text>
        ) : (
          ordered.map((item, index) => (
            <Pressable
              key={`ordered-${item}`}
              disabled={result !== null}
              onPress={() => {
                tapFeedback();
                onDraftChange({ kind: 'order', items: ordered.filter((i) => i !== item) });
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: theme.spacing.md,
                borderRadius: theme.radii.md,
                backgroundColor: result
                  ? result.detail?.[index]
                    ? theme.colors.successSubtle
                    : theme.colors.dangerSubtle
                  : theme.colors.primarySubtle,
              }}
            >
              <Text variant="label" tone="primary" style={{ marginRight: theme.spacing.md }}>
                {index + 1}
              </Text>
              <Text variant="body" style={{ flex: 1 }}>
                {item}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {remaining.length > 0 && result === null ? (
        <View style={{ gap: theme.spacing.sm }}>
          {remaining.map((item) => (
            <AnswerOption
              key={`pool-${item}`}
              label={item}
              onPress={() => {
                tapFeedback();
                onDraftChange({ kind: 'order', items: [...ordered, item] });
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * Matching works as: tap a left item to select it, then tap a right item to
 * pair them. Same reasoning as ordering — no dragging.
 */
function MatchExercise({
  exercise,
  draft,
  onDraftChange,
  result,
}: ExerciseViewProps): React.JSX.Element {
  const theme = useTheme();
  const [activeLeft, setActiveLeft] = useState<string | null>(null);

  const rights = useMemo(
    () =>
      exercise.kind === 'match-pairs'
        ? seededShuffle(
            exercise.pairs.map((p) => p.right),
            hashString(exercise.id),
          )
        : [],
    [exercise],
  );
  if (exercise.kind !== 'match-pairs') return <View />;

  const pairs = draft?.kind === 'pairs' ? draft.pairs : [];
  const pairedLefts = new Set(pairs.map((p) => p.left));
  const pairedRights = new Set(pairs.map((p) => p.right));

  const pairUp = (right: string): void => {
    if (!activeLeft) return;
    tapFeedback();
    onDraftChange({ kind: 'pairs', pairs: [...pairs, { left: activeLeft, right }] });
    setActiveLeft(null);
  };

  return (
    <View>
      <Prompt>{exercise.prompt}</Prompt>

      {pairs.length > 0 ? (
        <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
          {pairs.map((pair, index) => (
            <Pressable
              key={`pair-${pair.left}`}
              disabled={result !== null}
              onPress={() =>
                onDraftChange({
                  kind: 'pairs',
                  pairs: pairs.filter((p) => p.left !== pair.left),
                })
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: theme.spacing.md,
                borderRadius: theme.radii.md,
                backgroundColor: result
                  ? result.detail?.[index]
                    ? theme.colors.successSubtle
                    : theme.colors.dangerSubtle
                  : theme.colors.surfaceMuted,
              }}
            >
              <Text variant="caption" style={{ flex: 1 }}>
                {pair.left}
              </Text>
              <Text variant="caption" tone="tertiary" style={{ marginHorizontal: theme.spacing.sm }}>
                →
              </Text>
              <Text variant="caption" style={{ flex: 1 }}>
                {pair.right}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {result === null ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            {exercise.pairs
              .filter((p) => !pairedLefts.has(p.left))
              .map((pair) => (
                <AnswerOption
                  key={`left-${pair.left}`}
                  label={pair.left}
                  state={activeLeft === pair.left ? 'selected' : 'idle'}
                  onPress={() => {
                    tapFeedback();
                    setActiveLeft(activeLeft === pair.left ? null : pair.left);
                  }}
                />
              ))}
          </View>

          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            {rights
              .filter((right) => !pairedRights.has(right))
              .map((right) => (
                <AnswerOption
                  key={`right-${right}`}
                  label={right}
                  disabled={activeLeft === null}
                  onPress={() => pairUp(right)}
                />
              ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

function ShortAnswerExercise({
  exercise,
  draft,
  onDraftChange,
  result,
}: ExerciseViewProps): React.JSX.Element {
  const theme = useTheme();
  if (exercise.kind !== 'short-answer') return <View />;

  const value = draft?.kind === 'text' ? (draft.values[0] ?? '') : '';

  return (
    <View>
      <Prompt>{exercise.prompt}</Prompt>

      <TextInput
        value={value}
        onChangeText={(text) => onDraftChange({ kind: 'text', values: [text] })}
        editable={result === null}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        placeholder="Write your answer in your own words…"
        placeholderTextColor={theme.colors.textTertiary}
        style={{
          minHeight: 140,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.lg,
          borderWidth: 2,
          borderColor: result
            ? result.correct
              ? theme.colors.success
              : theme.colors.warning
            : theme.colors.border,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          ...theme.typography.body,
        }}
      />

      {result ? (
        <Card style={{ marginTop: theme.spacing.lg }} background={theme.colors.surfaceMuted}>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.sm }}>
            A strong answer
          </Text>
          <Text variant="body" tone="secondary">
            {exercise.sampleAnswer}
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * Sort items into buckets.
 *
 * Tap an item to select it, then tap a bucket to place it — the same
 * tap-to-assign pattern used by ordering and matching. Dragging would be
 * fiddly on a phone and unusable with a screen reader; tapping is precise,
 * reversible, and works with any input method.
 */
function CategorizeExercise({
  exercise,
  draft,
  onDraftChange,
  result,
}: ExerciseViewProps): React.JSX.Element {
  const theme = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  const shuffled = useMemo(
    () =>
      exercise.kind === 'categorize'
        ? seededShuffle(
            exercise.items.map((i) => i.item),
            hashString(exercise.id),
          )
        : [],
    [exercise],
  );

  if (exercise.kind !== 'categorize') return <View />;

  const assignments = draft?.kind === 'buckets' ? draft.assignments : [];
  const placed = new Map(assignments.map((a) => [a.item, a.category]));
  const unplaced = shuffled.filter((item) => !placed.has(item));

  const assign = (category: string): void => {
    if (!selected) return;
    tapFeedback();
    onDraftChange({
      kind: 'buckets',
      assignments: [...assignments.filter((a) => a.item !== selected), { item: selected, category }],
    });
    setSelected(null);
  };

  const unassign = (item: string): void => {
    if (result) return;
    tapFeedback();
    onDraftChange({ kind: 'buckets', assignments: assignments.filter((a) => a.item !== item) });
  };

  /** After grading, look up whether a specific item landed in the right bucket. */
  const isCorrect = (item: string): boolean | null => {
    if (!result) return null;
    const index = exercise.items.findIndex((i) => i.item === item);
    return index === -1 ? null : (result.detail?.[index] ?? false);
  };

  return (
    <View>
      <Prompt>{exercise.prompt}</Prompt>

      {/* Unplaced items */}
      {unplaced.length > 0 && !result ? (
        <View style={{ marginBottom: theme.spacing.xl }}>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.sm }}>
            Tap an item, then tap a category
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {unplaced.map((item) => {
              const active = selected === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    tapFeedback();
                    setSelected(active ? null : item);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    borderRadius: theme.radii.md,
                    borderWidth: 2,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    backgroundColor: active ? theme.colors.primarySubtle : theme.colors.surface,
                  }}
                >
                  <Text variant="caption" tone={active ? 'primary' : 'default'}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Buckets */}
      <View style={{ gap: theme.spacing.md }}>
        {exercise.categories.map((category) => {
          const contents = assignments.filter((a) => a.category === category);
          const isTarget = selected !== null && !result;

          return (
            <Pressable
              key={category}
              onPress={() => assign(category)}
              disabled={!isTarget}
              accessibilityRole="button"
              accessibilityLabel={`Category ${category}`}
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radii.lg,
                borderWidth: 2,
                borderStyle: isTarget ? 'solid' : 'dashed',
                borderColor: isTarget ? theme.colors.primary : theme.colors.border,
                backgroundColor: isTarget ? theme.colors.primarySubtle : 'transparent',
                minHeight: 72,
              }}
            >
              <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.sm }}>
                {category}
              </Text>

              {contents.length === 0 ? (
                <Text variant="caption" tone="tertiary">
                  {isTarget ? 'Tap to place here' : 'Empty'}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                  {contents.map((entry) => {
                    const correct = isCorrect(entry.item);
                    return (
                      <Pressable
                        key={entry.item}
                        onPress={() => unassign(entry.item)}
                        disabled={result !== null}
                        style={{
                          paddingHorizontal: theme.spacing.sm,
                          paddingVertical: theme.spacing.xs,
                          borderRadius: theme.radii.sm,
                          backgroundColor:
                            correct === null
                              ? theme.colors.surfaceMuted
                              : correct
                                ? theme.colors.successSubtle
                                : theme.colors.dangerSubtle,
                        }}
                      >
                        <Text
                          variant="caption"
                          tone={correct === null ? 'default' : correct ? 'success' : 'danger'}
                        >
                          {correct === null ? '' : correct ? '✓ ' : '✕ '}
                          {entry.item}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {result && !result.correct ? (
        <Card style={{ marginTop: theme.spacing.lg }} background={theme.colors.surfaceMuted}>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.sm }}>
            Correct placement
          </Text>
          <View style={{ gap: theme.spacing.xs }}>
            {exercise.items
              .filter((entry) => !isCorrect(entry.item))
              .map((entry) => (
                <Text key={entry.item} variant="caption" tone="secondary">
                  {entry.item} → {entry.category}
                </Text>
              ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}
