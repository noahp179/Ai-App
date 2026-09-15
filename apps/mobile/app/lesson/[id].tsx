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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LESSON_INDEX,
  canAccessLesson,
  getAssessment,
  gradeAssessment,
  limitsFor,
  suggestFollowUps,
  type Assessment,
  type AssessmentResult,
  type Step,
} from '@synapse/core';
import {
  Badge,
  Burst,
  Button,
  Card,
  Entrance,
  FeedbackSheet,
  ProgressBar,
  ProgressRing,
  Screen,
  StepTransition,
  Text,
  useCountUp,
  usePulse,
  useTheme,
} from '@synapse/ui';

import { ConceptView } from '../../src/components/ConceptView';
import { ExerciseView } from '../../src/components/ExerciseView';
import { InteractiveCard } from '../../src/components/interactives/index';
import { errorFeedback, successFeedback, tapFeedback } from '../../src/lib/haptics';
import { useProgress } from '../../src/store/useProgress';
import { useSession } from '../../src/store/useSession';

export default function LessonScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const progress = useProgress((s) => s.progress);
  const finishLesson = useProgress((s) => s.finishLesson);
  const loseHeart = useProgress((s) => s.loseHeart);

  const session = useSession();
  const scrollRef = useRef<ScrollView>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [summary, setSummary] = useState<null | {
    xpEarned: number;
    accuracy: number;
    perfect: boolean;
    leveledUp: boolean;
    newAchievements: number;
  }>(null);
  const [examResult, setExamResult] = useState<AssessmentResult | null>(null);

  const location = id && id !== 'review' ? LESSON_INDEX.get(id) : undefined;
  const isReview = id === 'review';
  // The same player runs lessons, review, and knowledge tests. What differs is
  // how the session is configured and what the end screen has to say.
  // Weak skills first: a fixed-length exam should spend its questions where
  // the learner is least certain rather than confirming what they know.
  const masteryBySkill = useMemo(
    () =>
      new Map(
        Object.values(progress.skills).map((skill) => [skill.skillId, skill.mastery] as const),
      ),
    [progress.skills],
  );

  const assessment: Assessment | undefined = useMemo(
    () =>
      id && id !== 'review' && !location
        ? getAssessment(id, undefined, masteryBySkill)
        : undefined,
    [id, location, masteryBySkill],
  );

  // --- start the session ---------------------------------------------------
  useEffect(() => {
    if (isReview) return; // Practice screen already started it.

    // A test is not a lesson: no hearts to run out of, and no re-queuing
    // mistakes until they are answered right — that is good teaching and it
    // would make the score meaningless.
    if (assessment) {
      if (session.context?.checkpointId === assessment.id) return;
      session.start({
        steps: assessment.exercises.map((exercise) => ({
          id: exercise.id,
          type: 'exercise' as const,
          exercise,
        })),
        level: 'intermediate',
        mode: 'checkpoint',
        hearts: null,
        requeueMistakes: false,
        checkpointId: assessment.id,
      });
      return;
    }

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
  }, [location, assessment, isReview, progress.entitlement]);

  const snapshot = session.snapshot;
  const step: Step | null = snapshot?.currentStep ?? null;

  // --- completion ----------------------------------------------------------
  useEffect(() => {
    if (!snapshot || snapshot.status !== 'complete' || summary) return;
    if (!session.context) return;

    const attempts = session.runner?.getAttempts() ?? [];
    const graded = assessment ? gradeAssessment(assessment, attempts) : null;

    const result = finishLesson({
      lessonId: session.context.lessonId,
      checkpointId: session.context.checkpointId,
      checkpointPassed: graded?.passed,
      attempts,
      level: session.context.level,
      isReview: session.context.mode === 'review',
    });

    if (graded) setExamResult(graded);
    setSummary({
      xpEarned: result.xpEarned,
      accuracy: result.accuracy,
      perfect: result.perfect,
      leveledUp: result.leveledUp,
      newAchievements: result.newAchievements.length,
    });
    successFeedback();
  }, [snapshot?.status]);

  // Nudge the answered option up into the visible band above the sheet. Runs
  // after the sheet's slide-in so the two do not fight each other.
  useEffect(() => {
    if (!session.lastResult) {
      setSheetHeight(0);
      return;
    }
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 160);
    return () => clearTimeout(timer);
  }, [session.lastResult]);

  const exit = useCallback(() => {
    session.end();
    setSummary(null);
    setExamResult(null);
    router.back();
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
  }, [snapshot?.heartsRemaining]);

  // --- render --------------------------------------------------------------

  if (examResult && assessment) {
    return (
      <AssessmentResultView
        assessment={assessment}
        result={examResult}
        xpEarned={summary?.xpEarned ?? 0}
        onDone={exit}
        onRetake={() => {
          setExamResult(null);
          setSummary(null);
          session.end();
          router.replace(`/assessment/${assessment.id}`);
        }}
      />
    );
  }

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
        ref={scrollRef}
        contentContainerStyle={{
          // The feedback sheet is absolutely positioned over the content, so the
          // scroll area has to reserve room for it — otherwise the option the
          // learner just answered ends up hidden behind the explanation of it.
          paddingHorizontal: theme.layout.screenPadding,
          paddingBottom: hasAnswered ? sheetHeight + theme.spacing.xl : 180,
          maxWidth: theme.layout.maxReadingWidth,
          alignSelf: 'center',
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        <StepTransition stepKey={`${snapshot.index}-${step.id}`}>
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
        </StepTransition>
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
            label={
              isExercise ? 'Check' : step.type === 'interactive' ? 'Done exploring' : 'Continue'
            }
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
          onHeightChange={setSheetHeight}
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

/**
 * The completion screen.
 *
 * The single biggest payoff moment in the app, so it is choreographed rather
 * than just rendered: the mark bursts, XP counts up, the accuracy ring fills,
 * and badges arrive last. The whole sequence runs in about a second — long
 * enough to feel earned, short enough that a learner doing six lessons in a row
 * never waits on it.
 */
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
  const xp = useCountUp(summary.xpEarned, { duration: 1000 });
  const accuracyPct = useCountUp(Math.round(summary.accuracy * 100), { duration: 1000 });
  const badgePulse = usePulse(summary.leveledUp || summary.newAchievements > 0);

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
        <Entrance index={0} distance={0}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            {/* The burst originates behind the mark, so the celebration reads as
                coming from the achievement rather than decorating the screen. */}
            <Burst
              trigger={1}
              radius={130}
              particleCount={16}
              size={10}
              colors={
                summary.perfect
                  ? [theme.colors.primary, theme.colors.info, theme.colors.success]
                  : [theme.colors.success, theme.colors.primary]
              }
            />
            <Text variant="display" style={{ marginBottom: theme.spacing.lg }}>
              {summary.perfect ? '💎' : '🎉'}
            </Text>
          </View>
        </Entrance>

        <Entrance index={1}>
          <Text variant="title" align="center">
            {headline}
          </Text>
        </Entrance>

        <Entrance index={2}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.xxxl,
              marginTop: theme.spacing.xxxl,
              marginBottom: theme.spacing.xxl,
            }}
          >
            <View style={{ alignItems: 'center' }}>
              <Text variant="display" tone="primary">
                +{xp}
              </Text>
              <Text variant="label" tone="tertiary" caps>
                XP earned
              </Text>
            </View>

            <View style={{ alignItems: 'center' }}>
              <ProgressRing
                value={summary.accuracy}
                size={78}
                thickness={7}
                color={summary.accuracy >= 0.8 ? theme.colors.success : theme.colors.warning}
              >
                <Text
                  variant="heading"
                  style={{
                    color:
                      summary.accuracy >= 0.8 ? theme.colors.success : theme.colors.text,
                  }}
                >
                  {accuracyPct}%
                </Text>
              </ProgressRing>
              <Text variant="label" tone="tertiary" caps style={{ marginTop: theme.spacing.xs }}>
                Accuracy
              </Text>
            </View>
          </View>
        </Entrance>

        <Entrance index={3}>
          <Animated.View style={[{ gap: theme.spacing.sm, alignItems: 'center' }, badgePulse]}>
            {summary.leveledUp ? <Badge label="Level up!" tone="primary" filled /> : null}
            {summary.newAchievements > 0 ? (
              <Badge
                label={`${summary.newAchievements} new achievement${summary.newAchievements > 1 ? 's' : ''}`}
                tone="warning"
                filled
              />
            ) : null}
          </Animated.View>
        </Entrance>
      </View>

      <Entrance index={4}>
        <Button label="Continue" size="lg" fullWidth onPress={onDone} />
      </Entrance>
    </Screen>
  );
}

// ---------------------------------------------------------------------------

/**
 * The end of a knowledge test.
 *
 * A lesson's completion screen celebrates. A test's has a different job: say
 * whether you passed, and then say *what you got wrong* at the granularity you
 * can act on. So the per-skill breakdown is the largest thing below the score,
 * worst first, and the primary action when you fail is to go and review those
 * skills rather than to immediately retake the same paper.
 */
function AssessmentResultView({
  assessment,
  result,
  xpEarned,
  onDone,
  onRetake,
}: {
  assessment: Assessment;
  result: AssessmentResult;
  xpEarned: number;
  onDone: () => void;
  onRetake: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const percent = useCountUp(Math.round(result.score * 100), { duration: 900 });
  const accent = result.passed ? theme.colors.success : theme.colors.warning;

  return (
    <Screen scroll>
      <Entrance index={0} distance={0}>
        <View style={{ alignItems: 'center', marginTop: theme.spacing.xl }}>
          {result.passed ? (
            <Burst
              trigger={1}
              radius={120}
              particleCount={14}
              colors={[theme.colors.success, theme.colors.primary]}
            />
          ) : null}
          <ProgressRing value={result.score} size={112} thickness={9} color={accent}>
            <Text variant="title" style={{ color: accent }}>
              {percent}%
            </Text>
          </ProgressRing>

          <Text variant="title" align="center" style={{ marginTop: theme.spacing.xl }}>
            {result.passed ? 'Passed' : 'Not yet'}
          </Text>
          <Text variant="caption" tone="secondary" align="center" style={{ marginTop: theme.spacing.xs }}>
            {result.correct} of {result.total} correct · pass mark{' '}
            {Math.round(result.passingScore * 100)}%
          </Text>
        </View>
      </Entrance>

      <Entrance index={1}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.lg,
            marginBottom: theme.spacing.xxl,
          }}
        >
          <Badge
            label={assessment.kind === 'exam' ? 'Track exam' : 'Unit checkpoint'}
            tone="primary"
          />
          {xpEarned > 0 ? <Badge label={`+${xpEarned} XP`} tone="success" /> : null}
        </View>
      </Entrance>

      {/* The part worth reading. */}
      <Entrance index={2}>
        <Card outlined>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
            {result.weakest.length > 0 ? 'Where you lost marks' : 'Every skill clean'}
          </Text>

          {result.bySkill.slice(0, 10).map((skill) => (
            <View key={skill.skillId} style={{ marginBottom: theme.spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: theme.spacing.xs,
                }}
              >
                <Text variant="caption" style={{ flex: 1, marginRight: theme.spacing.sm }}>
                  {skill.name}
                </Text>
                <Text
                  variant="label"
                  tone={skill.fraction >= 1 ? 'success' : skill.fraction === 0 ? 'danger' : 'warning'}
                >
                  {skill.correct}/{skill.total}
                </Text>
              </View>
              <ProgressBar
                value={skill.fraction}
                height={5}
                color={
                  skill.fraction >= 1
                    ? theme.colors.success
                    : skill.fraction === 0
                      ? theme.colors.danger
                      : theme.colors.warning
                }
              />
            </View>
          ))}

          {result.bySkill.length > 10 ? (
            <Text variant="label" tone="tertiary" caps>
              and {result.bySkill.length - 10} more
            </Text>
          ) : null}

          <Text variant="caption" tone="tertiary" style={{ marginTop: theme.spacing.sm }}>
            {result.weakest.length > 0
              ? 'These skills are now scheduled for review sooner than the rest.'
              : 'Nothing to re-schedule — the whole set held up.'}
          </Text>
        </Card>
      </Entrance>

      <Entrance index={3}>
        <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xxl }}>
          {result.weakest.length > 0 ? (
            <Button
              label="Practise the weak spots"
              size="lg"
              fullWidth
              onPress={() => {
                onDone();
                router.push('/practice');
              }}
            />
          ) : null}
          {!result.passed ? (
            <Button label="Retake" variant="secondary" size="lg" fullWidth onPress={onRetake} />
          ) : null}
          <Button
            label="Done"
            variant={result.weakest.length > 0 ? 'ghost' : 'primary'}
            size="lg"
            fullWidth
            onPress={onDone}
          />
        </View>
      </Entrance>
    </Screen>
  );
}

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
