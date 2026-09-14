import { describe, expect, it } from 'vitest';

import {
  EXAM_PASSING_SCORE,
  allAssessments,
  buildTrackExam,
  getAssessment,
  getCheckpoint,
  gradeAssessment,
  trackExamId,
  type Assessment,
} from '../src/engine/assessment';
import { TRACKS } from '../src/content/index';
import { SKILLS_BY_ID } from '../src/content/skills';
import type { AttemptRecord } from '../src/domain/types';

const NOW = Date.UTC(2026, 2, 1, 12, 0, 0);

const answerAll = (assessment: Assessment, correct: (index: number) => boolean): AttemptRecord[] =>
  assessment.exercises.map((exercise, index) => ({
    stepId: exercise.id,
    skillIds: exercise.skillIds,
    outcome: correct(index) ? ('correct' as const) : ('incorrect' as const),
    durationMs: 8_000,
    usedHint: false,
    at: NOW,
  }));

describe('checkpoints', () => {
  it('gives every unit a checkpoint', () => {
    const missing: string[] = [];
    for (const track of TRACKS) {
      for (const unit of track.units) {
        if (!unit.checkpoint) missing.push(`${track.id} / ${unit.id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('resolves every checkpoint by id', () => {
    for (const track of TRACKS) {
      for (const unit of track.units) {
        const found = getCheckpoint(unit.checkpoint!.id);
        expect(found, unit.checkpoint!.id).toBeDefined();
        expect(found!.kind).toBe('checkpoint');
        expect(found!.trackId).toBe(track.id);
        expect(found!.unitId).toBe(unit.id);
        expect(found!.exercises.length).toBeGreaterThan(0);
      }
    }
  });

  it('returns undefined for an unknown id', () => {
    expect(getCheckpoint('checkpoint-nope')).toBeUndefined();
    expect(getAssessment('not-an-assessment')).toBeUndefined();
    expect(buildTrackExam('track-nope')).toBeUndefined();
  });
});

describe('track exams', () => {
  it('builds one for every track', () => {
    for (const track of TRACKS) {
      const exam = buildTrackExam(track.id);
      expect(exam, track.id).toBeDefined();
      expect(exam!.kind).toBe('exam');
      expect(exam!.id).toBe(trackExamId(track.id));
      expect(exam!.passingScore).toBe(EXAM_PASSING_SCORE);
      expect(exam!.exercises.length).toBeGreaterThan(5);
    }
  });

  it('never repeats a question within one paper', () => {
    for (const track of TRACKS) {
      const exam = buildTrackExam(track.id)!;
      const ids = exam.exercises.map((e) => e.id);
      expect(new Set(ids).size, track.id).toBe(ids.length);
    }
  });

  it('spreads across skills rather than drilling one', () => {
    for (const track of TRACKS) {
      const exam = buildTrackExam(track.id)!;
      const skills = new Set(exam.exercises.flatMap((e) => e.skillIds));
      // Breadth is the point of an exam: it should touch most of what the
      // track teaches, not sample the same corner repeatedly.
      expect(skills.size, track.id).toBeGreaterThanOrEqual(
        Math.min(6, exam.exercises.length),
      );
      for (const skillId of skills) expect(SKILLS_BY_ID.has(skillId)).toBe(true);
    }
  });

  it('only ever draws questions from its own track', () => {
    const exam = buildTrackExam('track-dsa')!;
    const track = TRACKS.find((t) => t.id === 'track-dsa')!;
    const owned = new Set<string>();
    for (const unit of track.units) {
      for (const lesson of unit.lessons) {
        for (const step of lesson.steps) {
          if (step.type === 'exercise') owned.add(step.exercise.id);
        }
      }
      for (const exercise of unit.checkpoint?.exercises ?? []) owned.add(exercise.id);
    }
    for (const exercise of exam.exercises) expect(owned.has(exercise.id)).toBe(true);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const a = buildTrackExam('track-foundations', { seed: 1 })!;
    const b = buildTrackExam('track-foundations', { seed: 1 })!;
    const c = buildTrackExam('track-foundations', { seed: 99 })!;

    expect(a.exercises.map((e) => e.id)).toEqual(b.exercises.map((e) => e.id));
    expect(a.exercises.map((e) => e.id)).not.toEqual(c.exercises.map((e) => e.id));
  });

  it('honours a smaller question target', () => {
    const short = buildTrackExam('track-foundations', { questions: 5 })!;
    expect(short.exercises).toHaveLength(5);
  });

  it('enumerates every checkpoint and every exam', () => {
    const all = allAssessments();
    const units = TRACKS.reduce((n, t) => n + t.units.length, 0);
    expect(all.filter((a) => a.kind === 'checkpoint')).toHaveLength(units);
    expect(all.filter((a) => a.kind === 'exam')).toHaveLength(TRACKS.length);
  });
});

describe('gradeAssessment', () => {
  const exam = buildTrackExam('track-foundations', { seed: 3, questions: 10 })!;

  it('passes a clean sheet and fails an empty one', () => {
    const perfect = gradeAssessment(exam, answerAll(exam, () => true));
    expect(perfect.score).toBe(1);
    expect(perfect.passed).toBe(true);
    expect(perfect.weakest).toEqual([]);

    const nothing = gradeAssessment(exam, answerAll(exam, () => false));
    expect(nothing.score).toBe(0);
    expect(nothing.passed).toBe(false);
    expect(nothing.weakest.length).toBeGreaterThan(0);
  });

  it('scores an unanswered assessment as zero rather than throwing', () => {
    const result = gradeAssessment(exam, []);
    expect(result.correct).toBe(0);
    expect(result.total).toBe(exam.exercises.length);
    expect(result.passed).toBe(false);
  });

  it('counts only the first answer to each question', () => {
    const first = answerAll(exam, () => false);
    // A second, correct attempt at the same question must not rescue the score
    // — that is the difference between a test and a lesson.
    const retries = answerAll(exam, () => true);
    const result = gradeAssessment(exam, [...first, ...retries]);
    expect(result.correct).toBe(0);
  });

  it('sits the pass mark where the assessment says', () => {
    const half = gradeAssessment(exam, answerAll(exam, (i) => i < exam.exercises.length / 2));
    expect(half.score).toBeCloseTo(0.5, 5);
    expect(half.passed).toBe(false);

    const eight = gradeAssessment(exam, answerAll(exam, (i) => i < 8));
    expect(eight.score).toBeCloseTo(0.8, 5);
    expect(eight.passed).toBe(true);
  });

  it('breaks the score down by skill, worst first', () => {
    const result = gradeAssessment(exam, answerAll(exam, (i) => i % 2 === 0));
    expect(result.bySkill.length).toBeGreaterThan(1);

    for (let i = 1; i < result.bySkill.length; i++) {
      expect(result.bySkill[i]!.fraction).toBeGreaterThanOrEqual(result.bySkill[i - 1]!.fraction);
    }
    for (const skill of result.bySkill) {
      expect(skill.name).not.toBe(skill.skillId); // resolved to a human name
      expect(skill.correct).toBeLessThanOrEqual(skill.total);
    }
    expect(result.weakest.every((s) => s.fraction < 1)).toBe(true);
  });
});
