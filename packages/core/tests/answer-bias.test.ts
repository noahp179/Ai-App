/**
 * Guards against answers that can be found without knowing anything.
 *
 * Every other content test asks whether an exercise is well-formed. These ask
 * something different: whether the *set* of answers leaks the answer. A bank
 * where four in five true/false statements are false is one a learner can beat
 * by never reading the question, and the score it produces measures nothing.
 *
 * These are catalog-wide statistics, so they cover the unit checkpoint banks as
 * well as the lesson steps — the checkpoints are where a score actually gates
 * something, which makes bias there the more expensive kind.
 */

import { describe, expect, it } from 'vitest';

import { TRACKS } from '../src/content/index';
import type { Exercise } from '../src/domain/types';

/** Every exercise in the catalog: lesson steps and checkpoint banks alike. */
function allExercises(): Exercise[] {
  const out: Exercise[] = [];
  for (const track of TRACKS) {
    for (const unit of track.units) {
      for (const lesson of unit.lessons) {
        for (const step of lesson.steps) {
          if (step.type === 'exercise') out.push(step.exercise);
        }
      }
      for (const exercise of unit.checkpoint?.exercises ?? []) out.push(exercise);
    }
  }
  return out;
}

describe('answer bias', () => {
  const exercises = allExercises();

  it('covers the whole catalog, checkpoints included', () => {
    // A cheap guard on the traversal itself: an earlier version of this sweep
    // walked only lesson steps and silently missed a quarter of the catalog.
    const inLessons = TRACKS.flatMap((t) =>
      t.units.flatMap((u) => u.lessons.flatMap((l) => l.steps.filter((s) => s.type === 'exercise'))),
    ).length;
    expect(exercises.length).toBeGreaterThan(inLessons);
  });

  it('does not let "false" win the true/false bank', () => {
    const statements = exercises.filter((e) => e.kind === 'true-false');
    const trueCount = statements.filter((e) => e.kind === 'true-false' && e.answer).length;
    const share = trueCount / statements.length;

    // Neither answer may be worth guessing. Anything inside 40–60% leaves
    // guessing worse than a coin flip is on a single question.
    expect(statements.length).toBeGreaterThan(100);
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });

  it('never marks every option of a multi-select correct', () => {
    const giveaways = exercises
      .filter((e) => e.kind === 'multi-select')
      .filter((e) => e.kind === 'multi-select' && e.answers.length === e.choices.length)
      .map((e) => e.id);
    expect(giveaways).toEqual([]);
  });

  it('does not let answer length give the answer away', () => {
    // The tell this measures is real and only partly addressed: a correct
    // option is often the carefully-qualified one, and qualification takes
    // words. This threshold is a ratchet set just above where the catalog
    // stands, so the bias can be driven down but not up. Lower it as
    // distractors are rewritten; never raise it.
    const RATCHET = 0.85;

    const withChoices = exercises.filter(
      (e) => e.kind === 'multiple-choice' || e.kind === 'code-output',
    );
    const tell = withChoices.filter((e) => {
      if (e.kind !== 'multiple-choice' && e.kind !== 'code-output') return false;
      const lengths = e.choices.map((c) => c.length);
      const longest = Math.max(...lengths);
      // Only counts when the correct option is the *uniquely* longest one.
      return lengths[e.answer] === longest && lengths.filter((l) => l === longest).length === 1;
    });

    expect(withChoices.length).toBeGreaterThan(500);
    expect(tell.length / withChoices.length).toBeLessThanOrEqual(RATCHET);
  });
});
