/**
 * The lesson player.
 *
 * The screen the learner spends nearly all their time in, so a few things are
 * deliberate:
 *
 *  - The progress bar is at the top and always advancing. It is the reward.
 *  - The primary button never moves. Check and Continue occupy the same place,
 *    so the thumb never hunts.
 *  - Explanations appear right or wrong. Getting it right is the best moment to
 *    explain *why* it was right.
 *  - Hearts are visible but never surprise you — running out opens a sheet with
 *    real options, not a dead end.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LESSON_INDEX,
  canAccessLesson,
  limitsFor,
  suggestFollowUps,
  type Step,
} from '@synapse/core';
import {
  Badge,
  Button,
  Card,
  FeedbackSheet,
  ProgressBar,
  Screen,
  Text,
  useTheme,
} from '@synapse/ui';

import { ConceptView } from '../../src/components/ConceptView.js';
import { ExerciseView } from '../../src/components/ExerciseView.js';
import { InteractiveCard } from '../../src/components/Interactive.js';
import { errorFeedback, successFeedback, tapFeedback } from '../../src/lib/haptics.js';
import { useProgress } from '../../src/store/useProgress.js';
import { useSession } from '../../src/store/useSession.js';

export default function LessonScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const progress = useProgress((s) => s.progress);
  const finishLesson = useProgress((s) => s.finishLesson);
  const loseHeart = useProgress((s) => s.loseHeart);

  const session = useSession();
  const [summary, setSummary] = useState<null | {
    xpEarned: number;
    accuracy: number;
    perfect: boolean;
    leveledUp: boolean;
    newAchievements: number;
  }>(null);

  const location = id && id !== 'review' ? LESSON_INDEX.get(id) : undefined;
  const isReview = id === 'review';

  // --- start the session ---------------------------------------------------
  useEffect(() => {
    if (isReview) return; // Practice screen already started it.
    if (!location) return;
    if (session.context?.lessonId === location.lesson.id) return;

    const access = canAccessLesson(
      progress.entitlement,
      location.lesson,
      location.track.id,
      location.unitIndex,
    );
    if (!access.allowed) {
      router.replace(`/paywall?trigger=locked-lesson&plan=${access.upsellPlan}`);
      return;
    }

    session.start({
      steps: location.lesson.steps,
      level: location.lesson.level,
      mode: 'lesson',
      hearts: limitsFor(progress.entitlement).heartsPerSession,
      lessonId: location.lesson.id,
    });
    // `session` is a store object whose identity changes every update; depending
    // on it here would restart the session on every answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, isReview, progress.entitlement]);

  const snapshot = session.snapshot;
  const step: Step | null = snapshot?.currentStep ?? null;

  // --- completion ----------------------------------------------------------
  useEffect(() => {
    if (!snapshot || snapshot.status !== 'complete' || summary) return;
    if (!session.context) return;

    const result = finishLesson({
      lessonId: session.context.lessonId,
      checkpointId: session.context.checkpointId,
      attempts: session.runner?.getAttempts() ?? [],
      level: session.context.level,
      isReview: session.context.mode === 'review',
    });

    setSummary({
      xpEarned: result.xpEarned,
      accuracy: result.accuracy,
      perfect: result.perfect,
      leveledUp: result.leveledUp,
      newAchievements: result.newAchievements.length,
    });
    successFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.status]);

  const exit = useCallback(() => {
    session.end();
    setSummary(null);
    router.back();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const onCheck = useCallback(() => {
    const result = session.submit();
    if (!result) return;

    if (result.correct) {
      successFeedback();
    } else {
      errorFeedback();
      // Hearts are a store concern, not a session concern — the runner tracks
      // its own count for the session, the store persists it across sessions.
      if (snapshot?.heartsRemaining !== null) loseHeart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.heartsRemaining]);

  // --- render --------------------------------------------------------------

  if (summary) {
    return <CompletionView summary={summary} onDone={exit} />;
  }

  if (!snapshot || !step) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" tone="secondary">
            Preparing your session…
          </Text>
        </View>
      </Screen>
    );
  }

  if (snapshot.status === 'failed') {
    return <OutOfHeartsView onExit={exit} />;
  }

  const isExercise = step.type === 'exercise';
  const hasAnswered = session.lastResult !== null;
  const canCheck = session.draft !== null;
  const hint = isExercise ? step.exercise.hint : undefined;

  return (
    <Screen padded={false} scroll={false}>
      {/* Top bar: exit, progress, hearts */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.layout.screenPadding,
          paddingBottom: theme.spacing.lg,
        }}
      >
        <Pressable onPress={exit} accessibilityRole="button" accessibilityLabel="Exit lesson" hitSlop={12}>
          <Text variant="heading" tone="tertiary">
            ✕
          </Text>
        </Pressable>

        <ProgressBar
          value={snapshot.progress}
          style={{ flex: 1 }}
          accessibilityLabel={`Step ${snapshot.index + 1} of ${snapshot.total}`}
        />

        {snapshot.heartsRemaining === null ? (
          <Text variant="caption" tone="secondary">
            ❤️ ∞
          </Text>
        ) : (
          <Text variant="caption" tone="secondary">
            ❤️ {snapshot.heartsRemaining}
          </Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.layout.screenPadding,
          paddingBottom: 260,
          maxWidth: theme.layout.maxReadingWidth,
          alignSelf: 'center',
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        {step.type === 'concept' ? <ConceptView step={step} /> : null}

        {step.type === 'interactive' ? (
          <InteractiveCard
            widget={step.widget}
            title={step.title}
            instructions={step.instructions}
          />
        ) : null}

        {step.type === 'exercise' ? (
          <>
            <ExerciseView
              exercise={step.exercise}
              draft={session.draft}
              onDraftChange={session.setDraft}
              result={session.lastResult}
            />

            {hint && !hasAnswered ? (
              <View style={{ marginTop: theme.spacing.xl }}>
                {session.hintRevealed ? (
                  <Card background={theme.colors.infoSubtle}>
                    <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.xs }}>
                      Hint
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {hint}
                    </Text>
                  </Card>
                ) : (
                  <Pressable
                    onPress={() => {
                      tapFeedback();
                      session.revealHint();
                    }}
                    accessibilityRole="button"
                  >
                    <Badge label="Show a hint · costs some XP" tone="info" />
                  </Pressable>
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {/* Primary action — fixed position, never moves */}
      {!hasAnswered ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: theme.layout.screenPadding,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.lg + insets.bottom,
            backgroundColor: theme.colors.background,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <Button
            label={isExercise ? 'Check' : 'Continue'}
            size="lg"
            fullWidth
            disabled={isExercise && !canCheck}
            onPress={isExercise ? onCheck : session.advance}
          />
        </View>
      ) : null}

      {/* Feedback */}
      {isExercise && session.lastResult ? (
        <FeedbackSheet
          visible
          correct={session.lastResult.correct}
          explanation={
            session.lastResult.feedback && !session.lastResult.correct
              ? `${session.lastResult.feedback}\n\n${step.exercise.explanation}`
              : step.exercise.explanation
          }
          bottomInset={insets.bottom}
          onContinue={session.advance}
          actions={
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              {suggestFollowUps(session.lastResult.correct).map((followUp) => (
                <Badge key={followUp.intent} label={followUp.label} tone="neutral" />
              ))}
            </View>
          }
        />
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function CompletionView({
  summary,
  onDone,
}: {
  summary: {
    xpEarned: number;
    accuracy: number;
    perfect: boolean;
    leveledUp: boolean;
    newAchievements: number;
  };
  onDone: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  const headline = summary.perfect
    ? 'Flawless'
    : summary.accuracy >= 0.8
      ? 'Well done'
      : summary.accuracy >= 0.5
        ? 'Lesson complete'
        : 'Finished — worth another pass';

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="display" style={{ marginBottom: theme.spacing.lg }}>
          {summary.perfect ? '💎' : '🎉'}
        </Text>

        <Text variant="title" align="center">
          {headline}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.xxl,
            marginTop: theme.spacing.xxxl,
            marginBottom: theme.spacing.xxl,
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <Text variant="display" tone="primary">
              +{summary.xpEarned}
            </Text>
            <Text variant="label" tone="tertiary" caps>
              XP earned
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text variant="display" tone={summary.accuracy >= 0.8 ? 'success' : 'default'}>
              {Math.round(summary.accuracy * 100)}%
            </Text>
            <Text variant="label" tone="tertiary" caps>
              Accuracy
            </Text>
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
          {summary.leveledUp ? <Badge label="Level up!" tone="primary" filled /> : null}
          {summary.newAchievements > 0 ? (
            <Badge
              label={`${summary.newAchievements} new achievement${summary.newAchievements > 1 ? 's' : ''}`}
              tone="warning"
              filled
            />
          ) : null}
        </View>
      </View>

      <Button label="Continue" size="lg" fullWidth onPress={onDone} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

/**
 * Out of hearts.
 *
 * Deliberately not a wall. Three real ways forward — wait, spend gems, or
 * upgrade — and a plain statement of when hearts come back on their own. A
 * paywall that pretends there is only one option is the thing people uninstall
 * over.
 */
function OutOfHeartsView({ onExit }: { onExit: () => void }): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const progress = useProgress((s) => s.progress);
  const refillHearts = useProgress((s) => s.refillHearts);
  const sessionRefill = useSession((s) => s.refillHearts);

  const GEM_COST = 100;
  const canAffordGems = progress.gems >= GEM_COST;

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="display" style={{ marginBottom: theme.spacing.lg }}>
          💔
        </Text>
        <Text variant="title" align="center">
          Out of hearts
        </Text>
        <Text
          variant="body"
          tone="secondary"
          align="center"
          style={{ marginTop: theme.spacing.md, maxWidth: 320 }}
        >
          Hearts refill on their own — one every 30 minutes. Or carry on now.
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Button
          label="Unlimited hearts with Plus"
          variant="premium"
          size="lg"
          fullWidth
          onPress={() => router.push('/paywall?trigger=hearts-depleted&plan=plus')}
        />

        <Button
          label={`Refill for ${GEM_COST} gems (you have ${progress.gems})`}
          variant="secondary"
          fullWidth
          disabled={!canAffordGems}
          onPress={() => {
            if (refillHearts('gems')) sessionRefill(progress.hearts.max);
          }}
        />

        <Button label="Come back later" variant="ghost" fullWidth onPress={onExit} />
      </View>
    </Screen>
  );
}
