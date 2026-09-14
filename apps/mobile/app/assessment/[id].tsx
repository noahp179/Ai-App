/**
 * The front door to a knowledge test.
 *
 * Deliberately a separate screen from the questions. A test is a commitment —
 * no hearts, no re-queuing, and a score that goes on the record — so the
 * learner should see what it covers, how long it is, and what the pass mark is
 * before the first question rather than after it.
 */

import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  SKILLS_BY_ID,
  TRACKS_BY_ID,
  getAssessment,
  trackCompletion,
} from '@synapse/core';
import { Badge, Button, Card, Entrance, Screen, Text, useTheme } from '@synapse/ui';

import { useProgress } from '../../src/store/useProgress';

export default function AssessmentScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const progress = useProgress((s) => s.progress);

  const assessment = useMemo(() => (id ? getAssessment(id) : undefined), [id]);

  if (!assessment) {
    return (
      <Screen>
        <Text variant="body" tone="secondary">
          That test could not be found.
        </Text>
      </Screen>
    );
  }

  const track = TRACKS_BY_ID.get(assessment.trackId);
  const isExam = assessment.kind === 'exam';
  const alreadyPassed = progress.completedCheckpointIds.includes(assessment.id);

  // What the paper covers, by name. Unique, in the order the questions ask them.
  const skills = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const exercise of assessment.exercises) {
      for (const skillId of exercise.skillIds) {
        if (seen.has(skillId)) continue;
        seen.add(skillId);
        const name = SKILLS_BY_ID.get(skillId)?.name;
        if (name) names.push(name);
      }
    }
    return names;
  }, [assessment]);

  // Sitting an exam on a track you have barely started is allowed — it is how
  // you test out of one you already know — but it is worth flagging.
  const completion = track ? trackCompletion(progress, track.id) : 0;
  const untouched = isExam && completion < 0.2;

  const accent = track?.gradient[0] ?? theme.colors.primary;

  return (
    <Screen scroll>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        style={{ marginBottom: theme.spacing.lg }}
      >
        <Text variant="caption" tone="primary">
          ← Back
        </Text>
      </Pressable>

      <Entrance index={0}>
        <View
          style={{
            padding: theme.spacing.xl,
            borderRadius: theme.radii.xxl,
            backgroundColor: `${accent}1A`,
            borderWidth: 1,
            borderColor: accent,
            marginBottom: theme.spacing.xl,
          }}
        >
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <Badge label={isExam ? 'Track exam' : 'Unit checkpoint'} tone="primary" filled />
            {alreadyPassed ? <Badge label="Passed" tone="success" /> : null}
          </View>

          <Text variant="title">{assessment.title}</Text>
          {track ? (
            <Text variant="label" tone="tertiary" caps style={{ marginTop: theme.spacing.xs }}>
              {track.title}
            </Text>
          ) : null}
          <Text variant="body" tone="secondary" style={{ marginTop: theme.spacing.md }}>
            {assessment.subtitle}
          </Text>
        </View>
      </Entrance>

      <Entrance index={1}>
        <Card outlined style={{ marginBottom: theme.spacing.xl }}>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
            How this differs from a lesson
          </Text>
          {[
            'No hearts — a wrong answer costs marks, not lives.',
            'Wrong answers are not re-asked until you get them right.',
            'Only your first answer to each question counts.',
            'You will get a breakdown by skill at the end, whatever the score.',
          ].map((line) => (
            <View key={line} style={{ flexDirection: 'row', marginBottom: theme.spacing.sm }}>
              <Text variant="caption" tone="primary" style={{ marginRight: theme.spacing.sm }}>
                ·
              </Text>
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                {line}
              </Text>
            </View>
          ))}
        </Card>
      </Entrance>

      {untouched ? (
        <Entrance index={2}>
          <Card
            outlined
            borderColor={theme.colors.info}
            style={{ marginBottom: theme.spacing.xl }}
          >
            <Text variant="bodyStrong" tone="primary">
              Testing out?
            </Text>
            <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.xs }}>
              You have barely started this track, which is fine — sitting the exam first is a
              reasonable way to find out whether you need it. The breakdown at the end will tell you
              which units are worth your time.
            </Text>
          </Card>
        </Entrance>
      ) : null}

      <Entrance index={3}>
        <Card outlined style={{ marginBottom: theme.spacing.xxl }}>
          <Text variant="label" tone="tertiary" caps style={{ marginBottom: theme.spacing.md }}>
            {skills.length} skills covered
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {skills.slice(0, 14).map((name) => (
              <Badge key={name} label={name} tone="neutral" />
            ))}
            {skills.length > 14 ? (
              <Text variant="label" tone="tertiary" caps>
                +{skills.length - 14} more
              </Text>
            ) : null}
          </View>
        </Card>
      </Entrance>

      <Entrance index={4}>
        <Button
          label={alreadyPassed ? 'Retake' : `Begin · ${assessment.exercises.length} questions`}
          size="lg"
          fullWidth
          onPress={() => router.replace(`/lesson/${assessment.id}`)}
        />
      </Entrance>

      <Text
        variant="caption"
        tone="tertiary"
        align="center"
        style={{ marginTop: theme.spacing.lg }}
      >
        Every answer still feeds spaced repetition, so a test is never wasted time.
      </Text>
    </Screen>
  );
}
