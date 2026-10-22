import type { Evidence, Gap, MasteryRecord, MasteryStatus, Recommendation } from '../../shared/study/types';
import type { CurriculumService } from '../curriculum/service';
import type { Db } from '../db/database';
import { bool, json } from '../db/database';
import type { Clock } from '../util';
import { gradeOf, skill, skillsFor } from './content/registry';
import { computeMastery, detectGaps, nextReview, type MasteryConfig } from './mastery';

interface EvidenceRow {
  at: string;
  correct: number;
  score: number;
  difficulty: number;
  cognitive: Evidence['cognitive'];
  hinted: number;
  weight: number;
  source: Evidence['source'];
  misconception: string | null;
}

const toEvidence = (r: EvidenceRow): Evidence => ({
  at: r.at,
  correct: bool(r.correct),
  score: r.score,
  difficulty: r.difficulty as Evidence['difficulty'],
  cognitive: r.cognitive,
  hinted: bool(r.hinted),
  weight: r.weight,
  source: r.source,
  misconception: r.misconception,
});

/** Per-student learning records: evidence, mastery, spaced review and the gaps they reveal. */
export class ProgressStore {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly curriculum: CurriculumService,
    private readonly config: () => MasteryConfig,
  ) {}

  evidence(studentId: string, expectationId: string): Evidence[] {
    return this.db.all<EvidenceRow>('SELECT * FROM study_evidence WHERE student_id = ? AND expectation_id = ? ORDER BY at, id', [studentId, expectationId]).map(toEvidence);
  }

  private stored(studentId: string, expectationId: string): (MasteryRecord & { ease?: number }) | null {
    const r = this.db.get<{ data: string }>('SELECT data FROM study_mastery WHERE student_id = ? AND expectation_id = ?', [studentId, expectationId]);
    return r ? json<MasteryRecord & { ease?: number }>(r.data, null as never) : null;
  }

  private save(studentId: string, rec: MasteryRecord & { ease?: number }): void {
    this.db.run(
      `INSERT INTO study_mastery (student_id, expectation_id, status, next_review_at, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, expectation_id) DO UPDATE SET status = excluded.status, next_review_at = excluded.next_review_at, data = excluded.data, updated_at = excluded.updated_at`,
      [studentId, rec.expectationId, rec.status, rec.nextReviewAt, JSON.stringify(rec), rec.updatedAt],
    );
  }

  /** Recomputes mastery from all evidence (cheap: a few dozen rows per expectation). */
  recompute(studentId: string, expectationId: string): MasteryRecord {
    const prev = this.stored(studentId, expectationId);
    const rec = computeMastery(expectationId, this.evidence(studentId, expectationId), this.clock.now(), this.config(), {
      nextReviewAt: prev?.nextReviewAt ?? null,
      intervalDays: prev?.reviewIntervalDays ?? 0,
    });
    this.save(studentId, { ...rec, ease: prev?.ease ?? 2.3 });
    return rec;
  }

  add(studentId: string, expectationId: string, e: Evidence & { sourceId?: string | null; questionId?: string | null }): MasteryRecord {
    if (e.weight > 0) {
      this.db.run(
        'INSERT INTO study_evidence (student_id, expectation_id, at, correct, score, difficulty, cognitive, hinted, weight, source, source_id, question_id, misconception) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [studentId, expectationId, e.at, e.correct, e.score, e.difficulty, e.cognitive, e.hinted, e.weight, e.source, e.sourceId ?? null, e.questionId ?? null, e.misconception],
      );
    }
    return this.recompute(studentId, expectationId);
  }

  /** Updates the spaced-review schedule after an activity on an expectation. */
  scheduleReview(studentId: string, expectationId: string, independentShare: number, dueBy: Date | null = null): MasteryRecord {
    const prev = this.stored(studentId, expectationId) ?? { ...this.recompute(studentId, expectationId), ease: 2.3 };
    const r = nextReview({ intervalDays: prev.reviewIntervalDays, ease: prev.ease ?? 2.3 }, independentShare, this.clock.now(), dueBy);
    this.save(studentId, { ...prev, nextReviewAt: r.nextReviewAt, reviewIntervalDays: r.intervalDays, ease: r.ease });
    return this.recompute(studentId, expectationId);
  }

  get(studentId: string, expectationId: string): MasteryRecord {
    const s = this.stored(studentId, expectationId);
    if (!s) return computeMastery(expectationId, [], this.clock.now(), this.config());
    // Review status depends on today's date, so refresh when read.
    return this.recompute(studentId, expectationId);
  }

  status(studentId: string, expectationId: string): MasteryStatus {
    return this.db.get<{ status: MasteryStatus }>('SELECT status FROM study_mastery WHERE student_id = ? AND expectation_id = ?', [studentId, expectationId])?.status ?? 'not_assessed';
  }

  all(studentId: string): MasteryRecord[] {
    const ids = this.db.all<{ expectation_id: string }>('SELECT expectation_id FROM study_mastery WHERE student_id = ?', [studentId]).map((r) => r.expectation_id);
    return ids.map((id) => this.recompute(studentId, id));
  }

  /** Reviews due now (or within `withinHours`), most overdue first. */
  dueReviews(studentId: string, withinHours = 0): MasteryRecord[] {
    const cutoff = new Date(this.clock.now().getTime() + withinHours * 3_600_000).toISOString();
    return this.db
      .all<{ expectation_id: string }>('SELECT expectation_id FROM study_mastery WHERE student_id = ? AND next_review_at IS NOT NULL AND next_review_at <= ? ORDER BY next_review_at', [studentId, cutoff])
      .map((r) => this.recompute(studentId, r.expectation_id));
  }

  /** Expectations of earlier skills that the authored packs say should be secure first. */
  prerequisiteExpectations(expectationId: string): string[] {
    const grade = gradeOf(expectationId);
    const out = new Set<string>();
    for (const pack of skillsFor(expectationId)) {
      for (const pre of pack.prerequisites) {
        const p = skill(pre);
        if (!p) continue;
        const sorted = [...p.expectations].sort((a, b) => gradeOf(b.id) - gradeOf(a.id));
        const fit = sorted.find((e) => gradeOf(e.id) <= grade) ?? sorted.at(-1);
        if (fit && fit.id !== expectationId) out.add(fit.id);
      }
    }
    return [...out];
  }

  gaps(studentId: string): Gap[] {
    const now = this.clock.now();
    const out: Gap[] = [];
    for (const rec of this.all(studentId)) {
      out.push(...detectGaps(rec.expectationId, this.evidence(studentId, rec.expectationId), rec, now));
      if (rec.status === 'not_yet' || rec.status === 'in_progress') {
        for (const pre of this.prerequisiteExpectations(rec.expectationId)) {
          const ps = this.status(studentId, pre);
          if (ps === 'not_yet' || ps === 'in_progress') {
            out.push({ kind: 'prerequisite', expectationId: rec.expectationId, relatedExpectationId: pre, misconception: null, detail: 'An earlier skill this builds on is not secure yet.' });
          }
        }
      }
    }
    // Diagnostic answers on prerequisite questions also count.
    for (const r of this.db.all<{ expectation_id: string; n: number }>(
      "SELECT expectation_id, SUM(correct = 0) AS n FROM study_evidence WHERE student_id = ? AND source = 'diagnostic' GROUP BY expectation_id HAVING n >= 2",
      [studentId],
    )) {
      if (!out.some((g) => g.kind === 'prerequisite' && g.relatedExpectationId === r.expectation_id)) {
        out.push({ kind: 'prerequisite', expectationId: r.expectation_id, relatedExpectationId: r.expectation_id, misconception: null, detail: 'Warm-up questions on this skill were missed more than once.' });
      }
    }
    return out;
  }

  /** What to do next for one expectation, with the reason, from the evidence so far. */
  recommend(studentId: string, expectationId: string): Recommendation {
    const rec = this.get(studentId, expectationId);
    const title = this.curriculum.find(expectationId)?.index ?? expectationId;
    const pre = this.prerequisiteExpectations(expectationId).find((p) => ['not_yet', 'in_progress'].includes(this.status(studentId, p)));
    if (pre && (rec.status === 'not_yet' || rec.status === 'in_progress')) {
      const pt = this.curriculum.find(pre);
      return { kind: 'review_prerequisite', expectationId: pre, title: `Review ${pt ? `${pt.index} (${pt.courseLabel})` : 'an earlier skill'}`, reason: 'This skill builds on an earlier one that isn’t secure yet.' };
    }
    switch (rec.status) {
      case 'not_assessed':
        return { kind: 'start', expectationId, title: `Start ${title}`, reason: 'You haven’t worked on this yet.' };
      case 'not_yet':
      case 'in_progress':
        return { kind: 'retry_lesson', expectationId, title: `Go through ${title} again, explained another way`, reason: rec.reasons.at(-1) ?? 'More practice will help.' };
      case 'developing':
        return { kind: 'more_practice', expectationId, title: `Practise ${title} on your own`, reason: rec.reasons.at(-1) ?? 'A little more independent practice.' };
      case 'review':
        return { kind: 'spaced_review', expectationId, title: `Review ${title}`, reason: 'A short review now helps you remember it.' };
      case 'extension_ready':
        return { kind: 'extension', expectationId, title: `Try a challenge on ${title}`, reason: 'You are ready for harder problems.' };
      case 'proficient': {
        const next = this.nextInCourse(studentId, expectationId);
        return next
          ? { kind: 'move_on', expectationId: next, title: `Move on to ${this.curriculum.find(next)?.index ?? 'the next expectation'}`, reason: 'You’ve shown this one independently.' }
          : { kind: 'spaced_review', expectationId, title: `Review ${title} later`, reason: 'Proficient for now. It will come back for review.' };
      }
    }
  }

  /** The next expectation in the same course that has offline practice and isn't proficient yet. */
  nextInCourse(studentId: string, expectationId: string): string | null {
    const e = this.curriculum.find(expectationId);
    if (!e) return null;
    const list = this.curriculum.expectationsOf(e.courseId).map((x) => x.id);
    const i = list.indexOf(expectationId);
    for (const id of [...list.slice(i + 1), ...list.slice(0, i)]) {
      if (!skillsFor(id).length) continue;
      const s = this.status(studentId, id);
      if (s !== 'proficient' && s !== 'extension_ready') return id;
    }
    return null;
  }

  deleteAll(studentId: string): void {
    this.db.run('DELETE FROM study_evidence WHERE student_id = ?', [studentId]);
    this.db.run('DELETE FROM study_mastery WHERE student_id = ?', [studentId]);
  }
}
