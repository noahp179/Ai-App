import type { Settings } from '../../shared/settings';
import type { CoverageReport } from '../../shared/curriculum/views';
import {
  MASTERY_STATUSES,
  type AltExplanation,
  type ContentReport,
  type Gap,
  type LessonMode,
  type LessonSession,
  type MasteryRecord,
  type MasteryStatus,
  type ProgressReport,
  type QuizAttempt,
  type QuizKind,
  type Recommendation,
  type Response,
  type StudentProfile,
} from '../../shared/study/types';
import type { ChatTurn } from '../ai/types';
import type { EventsService } from '../calendar/events';
import type { CurriculumService } from '../curriculum/service';
import type { Db } from '../db/database';
import { json } from '../db/database';
import type { LinksService } from '../links';
import type { TasksService } from '../tasks';
import { type Clock, NotFoundError, UserError, cleanLine, newId } from '../util';
import { StudyAi } from './ai';
import { AssessmentService } from './assessments';
import { authoredExpectations, skillsFor } from './content/registry';
import { LessonService } from './lessons';
import { DEFAULT_MASTERY } from './mastery';
import { PlannerService } from './planner';
import { ProgressStore } from './progress';
import { QuizService, redact } from './quizzes';
import { StudentsService } from './students';

export interface StudyDeps {
  db: Db;
  clock: Clock;
  curriculum: CurriculumService;
  settings: () => Settings;
  events: EventsService;
  tasks: TasksService;
  links: LinksService;
  zone: () => string;
  /** Null when AI may not be used right now, otherwise a function that sends one request. */
  complete: (() => StudyAiComplete | null) | null;
  /** Why AI cannot be used (parental lock, no provider…), or null. */
  aiBlockedReason: () => string | null;
  verifyParentPin: (pin: unknown) => void;
  parentalEnabled: () => boolean;
  emitTutor: (e: { sessionId: string; messageId: string; kind: 'delta' | 'done' | 'error'; delta?: string; error?: string }) => void;
}
export type StudyAiComplete = (input: { title: string; system: string; messages: ChatTurn[]; maxTokens?: number | null; onDelta?: (d: string) => void; signal?: AbortSignal }) => Promise<{
  text: string;
  providerName: string;
  model: string;
}>;

const REPORT_DISCLAIMER =
  'These are FlowCompanion’s learning indicators, based on answers marked in the app. They are not Ontario achievement levels, report-card marks or a teacher’s evaluation.';

/** Student Learning. Every call that touches a student's records works on the open profile only. */
export class StudyService {
  readonly students: StudentsService;
  readonly progress: ProgressStore;
  readonly lessons: LessonService;
  readonly quizzes: QuizService;
  readonly planner: PlannerService;
  readonly assessments: AssessmentService;
  readonly ai: StudyAi;

  constructor(private readonly d: StudyDeps) {
    this.students = new StudentsService(d.db, d.clock);
    this.progress = new ProgressStore(d.db, d.clock, d.curriculum, () => {
      const s = d.settings().study;
      return { ...DEFAULT_MASTERY, proficientThreshold: s.proficientThreshold, minIndependentCorrect: s.minIndependentCorrect };
    });
    const log = (studentId: string, kind: string, detail: string, refId: string | null, expectationId: string | null, seconds = 0) => this.log(studentId, kind, detail, refId, expectationId, seconds);
    this.ai = new StudyAi({
      db: d.db,
      clock: d.clock,
      curriculum: d.curriculum,
      progress: this.progress,
      complete: (input) => {
        const fn = d.complete?.();
        const why = d.aiBlockedReason();
        if (!fn || why) throw new UserError(why ?? 'AI is not available.', 'not_configured');
        return fn(input);
      },
      emit: d.emitTutor,
    });
    const aiIfAllowed = () => (this.aiBlocked() ? null : this.ai);
    this.lessons = new LessonService({ db: d.db, clock: d.clock, curriculum: d.curriculum, progress: this.progress, ai: aiIfAllowed, log });
    this.quizzes = new QuizService({ db: d.db, clock: d.clock, curriculum: d.curriculum, progress: this.progress, ai: aiIfAllowed, log });
    this.planner = new PlannerService({
      db: d.db,
      clock: d.clock,
      curriculum: d.curriculum,
      progress: this.progress,
      events: d.events,
      tasks: d.tasks,
      links: d.links,
      zone: d.zone,
      reminderMinutes: () => d.settings().learning.studyReminderMinutes,
    });
    this.assessments = new AssessmentService({ db: d.db, clock: d.clock, curriculum: d.curriculum, ai: aiIfAllowed });
    this.ai.housekeeping();
  }

  private now() {
    return this.d.clock.now().toISOString();
  }

  /** Why AI cannot be used in Student Learning right now (before the student's own choice), or null. */
  aiBlocked(): string | null {
    if (!this.d.settings().study.aiTutor) return 'AI tutoring is turned off in Settings → Student Learning.';
    return this.d.aiBlockedReason();
  }

  aiStatus(): { available: boolean; reason: string | null; studentAllows: boolean | null } {
    const p = this.students.activeOrNull();
    const blocked = this.aiBlocked();
    return { available: !blocked && !!p?.aiTutoring, reason: blocked ?? (p && !p.aiTutoring ? 'AI tutoring is off in your profile. Turn it on in Learning Settings after reading what is sent.' : null), studentAllows: p ? p.aiTutoring : null };
  }

  me(): StudentProfile {
    return this.students.active();
  }

  log(studentId: string, kind: string, detail: string, refId: string | null, expectationId: string | null, seconds = 0): void {
    this.d.db.run('INSERT INTO study_activity (student_id, at, kind, ref_id, expectation_id, detail, seconds) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      studentId,
      this.now(),
      kind,
      refId,
      expectationId,
      cleanLine(detail, 300),
      Math.max(0, Math.round(seconds)),
    ]);
  }

  // ─────────── Views with keys hidden ───────────

  /** Lessons are practice, but unanswered questions still don't ship their answers to the screen. */
  lessonView(s: LessonSession): LessonSession {
    return { ...s, content: { ...s.content, questions: s.content.questions.map((q) => (s.answers[q.id] || s.status === 'completed' ? q : redact(q))) } };
  }

  quizView(a: QuizAttempt): QuizAttempt {
    return this.quizzes.view(a);
  }

  // ─────────── Lessons, quizzes ───────────

  async startLesson(input: { expectationId: string; mode: LessonMode; minutes?: number | null; source?: 'auto' | 'authored' | 'ministry' | 'ai' }): Promise<LessonSession> {
    return this.lessonView(await this.lessons.start(this.me(), input));
  }

  async answerLesson(id: string, questionId: string, response: Response, opts: { seconds?: number | null; aiFeedback?: boolean }) {
    const r = await this.lessons.answer(this.me(), id, questionId, response, opts);
    return { ...r, session: this.lessonView(r.session) };
  }

  async explainAgain(id: string, kind: AltExplanation) {
    return this.lessons.explainAgain(this.me(), id, kind);
  }

  async createQuiz(input: { kind: QuizKind; expectationIds: string[]; length?: number; timed?: boolean; minutes?: number | null; useAi?: boolean }): Promise<QuizAttempt> {
    const me = this.me();
    const s = this.d.settings().study;
    const kind = input.kind;
    const length = input.length ?? (kind === 'diagnostic' ? Math.max(3, Math.min(9, input.expectationIds.length * 2)) : s.quizLength);
    const timed = kind === 'summative_practice' ? (input.timed ?? s.timedPracticeTests) : false;
    return this.quizView(await this.quizzes.create(me, { ...input, length, timed }));
  }

  /** A spaced-review quiz over everything due (or the expectations given). */
  async startReview(expectationIds?: string[]): Promise<QuizAttempt> {
    const me = this.me();
    const due = expectationIds?.length ? expectationIds : this.progress.dueReviews(me.id).map((r) => r.expectationId);
    const offline = due.filter((id) => skillsFor(id).length);
    if (!offline.length) throw new UserError(due.length ? 'The reviews due are for expectations without offline questions. Use the AI tutor or a lesson to review them.' : 'Nothing is due for review right now.');
    return this.quizView(await this.quizzes.create(me, { kind: 'practice', expectationIds: offline.slice(0, 8), length: Math.min(10, Math.max(3, offline.length * 2)), title: 'Spaced review' }));
  }

  async takeAssessment(id: string): Promise<QuizAttempt> {
    const me = this.me();
    const a = this.assessments.get(me.id, id);
    const kind: QuizKind = a.format === 'test' ? 'summative_practice' : 'unit_review';
    return this.quizView(
      await this.quizzes.create(me, {
        kind,
        expectationIds: a.expectationIds,
        questions: a.items.map((i) => i.question),
        title: a.title,
        assessmentId: a.id,
        timed: !!a.timeLimitMinutes,
        minutes: a.timeLimitMinutes,
      }),
    );
  }

  // ─────────── Progress views ───────────

  /** Every expectation of a course with this student's status and what can be studied offline. */
  courseProgress(courseId: string) {
    const me = this.me();
    const detail = this.d.curriculum.course(courseId);
    const authored = authoredExpectations();
    const showEstimates = this.d.settings().study.showEstimates;
    const statusOf = new Map(
      this.d.db.all<{ expectation_id: string; status: MasteryStatus; data: string }>('SELECT expectation_id, status, data FROM study_mastery WHERE student_id = ?', [me.id]).map((r) => [
        r.expectation_id,
        { status: r.status, estimate: showEstimates ? json<MasteryRecord>(r.data, null as never).estimate : null },
      ]),
    );
    return {
      detail,
      rows: detail.strands.flatMap((s) =>
        s.overall.flatMap((o) =>
          o.specifics.map((e) => ({ expectationId: e.id, index: e.index, strand: s.index, status: statusOf.get(e.id)?.status ?? ('not_assessed' as MasteryStatus), estimate: statusOf.get(e.id)?.estimate ?? null, offline: authored.has(e.id), supports: e.supportCount > 0 })),
        ),
      ),
    };
  }

  expectationProgress(expectationId: string): { record: MasteryRecord; recommendation: Recommendation; sources: ReturnType<LessonService['sources']>; gaps: Gap[]; showEstimates: boolean; prerequisites: string[] } {
    const me = this.me();
    if (!this.d.curriculum.find(expectationId)) throw new NotFoundError('That curriculum expectation');
    const record = this.progress.get(me.id, expectationId);
    const gaps = this.progress.gaps(me.id).filter((g) => g.expectationId === expectationId);
    return { record, recommendation: this.progress.recommend(me.id, expectationId), sources: this.lessons.sources(me, expectationId), gaps, showEstimates: this.d.settings().study.showEstimates, prerequisites: this.progress.prerequisiteExpectations(expectationId) };
  }

  dashboard() {
    const me = this.me();
    const nowIso = this.now();
    const weekAhead = new Date(this.d.clock.now().getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
    const plans = this.planner.plans(me.id);
    const upcoming = plans
      .filter((p) => p.status === 'approved')
      .flatMap((p) => p.sessions.filter((s) => s.status === 'planned' && s.date <= weekAhead).map((s) => ({ planId: p.id, planTitle: p.title, ...s })))
      .sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`))
      .slice(0, 8);
    const missed = plans.filter((p) => p.status === 'approved' && p.sessions.some((s) => s.status === 'planned' && `${s.date}T${s.start}` < nowIso.slice(0, 16))).map((p) => p.id);
    const records = this.progress.all(me.id);
    const byStatus = Object.fromEntries(MASTERY_STATUSES.map((s) => [s, records.filter((r) => r.status === s).length])) as Record<MasteryStatus, number>;
    const recs: Recommendation[] = [];
    const seen = new Set<string>();
    const add = (r: Recommendation) => {
      if (recs.length < 6 && !seen.has(`${r.kind}:${r.expectationId}`)) {
        seen.add(`${r.kind}:${r.expectationId}`);
        recs.push(r);
      }
    };
    for (const r of this.progress.dueReviews(me.id).slice(0, 2)) add(this.progress.recommend(me.id, r.expectationId));
    for (const g of this.progress.gaps(me.id).slice(0, 3)) add(this.progress.recommend(me.id, g.expectationId));
    for (const a of this.planner.assignments(me.id).slice(0, 2)) for (const e of a.expectationIds.slice(0, 1)) add({ ...this.progress.recommend(me.id, e), reason: `${a.title}${a.dueAt ? ` is due ${a.dueAt.slice(0, 10)}` : ''}. ${this.progress.recommend(me.id, e).reason}` });
    for (const e of this.planner.nextNew(me, 3)) add(this.progress.recommend(me.id, e));
    return {
      profile: me,
      continueLessons: this.lessons.list(me.id, { status: 'open', limit: 5 }),
      recentLessons: this.lessons.list(me.id, { status: 'completed', limit: 5 }),
      upcoming,
      plansWithMissed: missed,
      reviewsDue: this.progress.dueReviews(me.id).length,
      gaps: this.progress.gaps(me.id).slice(0, 5),
      recommendations: recs,
      mastered: records.filter((r) => r.status === 'proficient' || r.status === 'extension_ready').map((r) => r.expectationId).slice(0, 12),
      needsPractice: records.filter((r) => ['not_yet', 'in_progress', 'developing', 'review'].includes(r.status)).map((r) => r.expectationId).slice(0, 12),
      byStatus,
      recentQuizzes: this.quizzes.list(me.id, 5),
      assignments: this.planner.assignments(me.id).slice(0, 5),
      ai: this.aiStatus(),
    };
  }

  // ─────────── Reflections and activity ───────────

  reflect(input: { expectationId?: string | null; courseId?: string | null; confidence: number; note?: string }): void {
    const me = this.me();
    const c = Math.trunc(Number(input.confidence));
    if (!(c >= 1 && c <= 5)) throw new UserError('Choose how confident you feel, from 1 to 5.');
    if (input.courseId) this.students.update({ confidence: { ...me.confidence, [input.courseId]: c } });
    this.log(me.id, 'reflection', JSON.stringify({ confidence: c, note: cleanLine(input.note ?? '', 280), courseId: input.courseId ?? null }), null, input.expectationId ?? null);
  }

  activity(limit = 50): { at: string; kind: string; detail: string; expectationId: string | null; seconds: number }[] {
    const me = this.me();
    return this.d.db.all<{ at: string; kind: string; detail: string; expectation_id: string | null; seconds: number }>('SELECT at, kind, detail, expectation_id, seconds FROM study_activity WHERE student_id = ? ORDER BY at DESC, id DESC LIMIT ?', [me.id, Math.min(limit, 500)]).map((r) => ({
      at: r.at,
      kind: r.kind,
      detail: r.detail,
      expectationId: r.expectation_id,
      seconds: r.seconds,
    }));
  }

  // ─────────── Reports ───────────

  private report(student: StudentProfile, audience: 'student' | 'parent'): ProgressReport {
    const share = audience === 'student' ? { goals: true, activities: true, progress: true } : student.parentSharing;
    const records = this.progress.all(student.id);
    const acts = this.d.db.all<{ at: string; kind: string; detail: string; seconds: number }>('SELECT at, kind, detail, seconds FROM study_activity WHERE student_id = ? ORDER BY at DESC', [student.id]);
    const courses = [...new Set([...student.courseIds, ...records.map((r) => this.d.curriculum.find(r.expectationId)?.courseId).filter((x): x is string => !!x)])];
    const label = (id: string) => this.d.curriculum.find(id)?.index ?? id;
    return {
      generatedAt: this.now(),
      student: { displayName: student.displayName, grade: student.grade },
      audience,
      privacyNote:
        audience === 'parent'
          ? 'Shared because the student turned on parent sharing for these sections. Tutoring conversations, answers, written work, notes and self-reflections are never included.'
          : 'Only on this computer. You can export or delete it in Learning Settings.',
      goals: share.goals ? [...student.goals] : null,
      activities: share.activities
        ? {
            lessonsCompleted: acts.filter((a) => a.kind === 'lesson_completed').length,
            quizzesCompleted: acts.filter((a) => a.kind === 'quiz_completed').length,
            questionsAnswered: this.d.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM study_evidence WHERE student_id = ?', [student.id])!.n,
            minutesStudied: Math.round(acts.reduce((s, a) => s + a.seconds, 0) / 60),
            recent: acts
              .filter((a) => a.kind === 'lesson_completed' || a.kind === 'quiz_completed')
              .slice(0, 10)
              .map((a) => ({ at: a.at, what: a.detail })),
          }
        : null,
      progress: share.progress
        ? courses
            .map((cid) => {
              const c = this.d.curriculum.courseOf(cid);
              const recs = records.filter((r) => this.d.curriculum.find(r.expectationId)?.courseId === cid);
              const byStatus = Object.fromEntries(MASTERY_STATUSES.map((s) => [s, recs.filter((r) => r.status === s).length])) as Record<MasteryStatus, number>;
              return {
                courseId: cid,
                course: c?.label ?? cid,
                expectations: c?.specificCount ?? 0,
                byStatus,
                strengths: recs.filter((r) => r.status === 'proficient' || r.status === 'extension_ready').map((r) => label(r.expectationId)),
                needsPractice: recs.filter((r) => ['not_yet', 'in_progress', 'developing', 'review'].includes(r.status)).map((r) => label(r.expectationId)),
              };
            })
            .filter((c) => c.courseId)
        : null,
      disclaimer: REPORT_DISCLAIMER,
    };
  }

  myReport(): ProgressReport {
    return this.report(this.me(), 'student');
  }

  /** For a parent: needs the Parental Learning Controls PIN and only shows what the student chose to share. */
  parentReport(studentId: string, parentPin: string): ProgressReport {
    if (!this.d.parentalEnabled()) throw new UserError('Parent reports need Parental Learning Controls to be set up (Settings → Parental Learning Controls).');
    this.d.verifyParentPin(parentPin);
    const s = this.students.get(studentId);
    if (!s.parentSharing.enabled) throw new UserError(`${s.displayName} has not turned on sharing with a parent. Nothing is shown without their agreement.`, 'not_shared');
    return this.report(s, 'parent');
  }

  parentResetPin(studentId: string, parentPin: string): void {
    if (!this.d.parentalEnabled()) throw new UserError('Resetting a profile PIN needs Parental Learning Controls to be set up.');
    this.d.verifyParentPin(parentPin);
    this.students.resetPinByParent(studentId);
  }

  reportMarkdown(r: ProgressReport): string {
    const lines = [`# Learning report: ${r.student.displayName}, Grade ${r.student.grade}`, '', `_Generated ${r.generatedAt.slice(0, 10)} by FlowCompanion. ${r.privacyNote}_`, ''];
    if (r.goals) lines.push('## Goals', '', ...(r.goals.length ? r.goals.map((g) => `- ${g}`) : ['- (none set)']), '');
    if (r.activities)
      lines.push(
        '## Activity',
        '',
        `- Lessons completed: ${r.activities.lessonsCompleted}`,
        `- Quizzes completed: ${r.activities.quizzesCompleted}`,
        `- Questions answered: ${r.activities.questionsAnswered}`,
        `- Time studied (recorded): about ${r.activities.minutesStudied} minutes`,
        '',
        ...r.activities.recent.map((a) => `- ${a.at.slice(0, 10)}: ${a.what}`),
        '',
      );
    if (r.progress)
      for (const c of r.progress) {
        lines.push(`## ${c.course}`, '', `Expectations worked on: ${Object.values(c.byStatus).reduce((a, b) => a + b, 0)} of ${c.expectations}.`, '');
        if (c.strengths.length) lines.push(`Shown independently: ${c.strengths.join(', ')}`, '');
        if (c.needsPractice.length) lines.push(`Needs more practice: ${c.needsPractice.join(', ')}`, '');
      }
    lines.push('---', '', r.disclaimer);
    return lines.join('\n');
  }

  // ─────────── Privacy: export and delete ───────────

  exportMyData(): Record<string, unknown> {
    const me = this.me();
    const all = <T>(sql: string) => this.d.db.all<Record<string, unknown>>(sql, [me.id]).map((r) => ('data' in r ? { ...r, data: json<T>(r.data, null as never) } : r));
    return {
      format: 'flowcompanion.student-learning',
      version: 1,
      exportedAt: this.now(),
      profile: me,
      lessons: all('SELECT id, expectation_id, mode, status, data, created_at, updated_at, completed_at FROM study_lessons WHERE student_id = ?'),
      quizzes: all('SELECT id, kind, status, data, started_at, finished_at FROM study_quizzes WHERE student_id = ?'),
      evidence: this.d.db.all('SELECT expectation_id, at, correct, score, difficulty, cognitive, hinted, weight, source, misconception FROM study_evidence WHERE student_id = ? ORDER BY at', [me.id]),
      mastery: this.progress.all(me.id),
      plans: this.planner.plans(me.id, true),
      assignments: this.planner.assignments(me.id, true),
      assessments: all('SELECT id, data, created_at, updated_at FROM study_assessments WHERE owner_student_id = ?'),
      tutor: this.ai.sessions(me.id).map((s) => ({ ...s, messages: this.ai.messages(me.id, s.id) })),
      activity: this.d.db.all('SELECT at, kind, detail, expectation_id, seconds FROM study_activity WHERE student_id = ? ORDER BY at', [me.id]),
      contentReports: this.d.db.all('SELECT id, kind, target, detail, status, created_at FROM study_content_reports WHERE student_id = ?', [me.id]),
    };
  }

  /** Deletes the open profile's learning records but keeps the profile. Returns how many records went. */
  deleteMyLearningData(confirm: string): number {
    const me = this.me();
    if (confirm !== 'DELETE') throw new UserError('Type DELETE to confirm.');
    return this.d.db.tx(() => {
      const count = (t: string) => this.d.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t} WHERE student_id = ?`, [me.id])!.n;
      const n = ['study_lessons', 'study_quizzes', 'study_evidence', 'study_mastery', 'study_plans', 'study_assignments', 'study_tutor_sessions', 'study_ai_cache', 'study_activity'].reduce((a, t) => a + count(t), 0);
      this.lessons.deleteAll(me.id);
      this.quizzes.deleteAll(me.id);
      this.progress.deleteAll(me.id);
      this.planner.deleteAll(me.id);
      this.assessments.deleteOwned(me.id);
      this.ai.deleteAll(me.id);
      this.d.db.run('DELETE FROM study_activity WHERE student_id = ?', [me.id]);
      this.d.db.run('UPDATE study_content_reports SET student_id = NULL WHERE student_id = ?', [me.id]);
      return n;
    });
  }

  // ─────────── Content reports ───────────

  reportContent(input: { kind: ContentReport['kind']; target: string; detail: string }): ContentReport {
    const kinds: ContentReport['kind'][] = ['inaccurate', 'inappropriate', 'unclear', 'curriculum_mismatch', 'other'];
    if (!kinds.includes(input.kind)) throw new UserError('Choose what is wrong.');
    const me = this.students.activeOrNull();
    const r: ContentReport = { id: newId(), kind: input.kind, target: cleanLine(String(input.target ?? ''), 300), detail: String(input.detail ?? '').slice(0, 2000), status: 'open', createdAt: this.now() };
    if (!r.target) throw new UserError('Say what the report is about.');
    this.d.db.run('INSERT INTO study_content_reports (id, student_id, kind, target, detail, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [r.id, me?.id ?? null, r.kind, r.target, r.detail, r.status, r.createdAt]);
    return r;
  }

  /** All reports on this computer, without saying which student sent them. */
  contentReports(): ContentReport[] {
    return this.d.db.all<ContentReport & { created_at: string }>('SELECT id, kind, target, detail, status, created_at FROM study_content_reports ORDER BY created_at DESC LIMIT 200').map((r) => ({
      id: r.id,
      kind: r.kind,
      target: r.target,
      detail: r.detail,
      status: r.status,
      createdAt: r.created_at,
    }));
  }

  resolveContentReport(id: string): void {
    if (!this.d.db.run("UPDATE study_content_reports SET status = 'resolved' WHERE id = ?", [id]).changes) throw new NotFoundError('That report');
  }

  // ─────────── Coverage ───────────

  coverage(): CoverageReport {
    const lessons = authoredExpectations();
    const assessmentIds = new Set(this.d.db.all<{ data: string }>('SELECT data FROM study_assessments').flatMap((r) => json<{ expectationIds: string[] }>(r.data, { expectationIds: [] }).expectationIds));
    const ai = new Set(this.d.db.all<{ expectation_id: string }>('SELECT DISTINCT expectation_id FROM study_ai_cache').map((r) => r.expectation_id));
    return this.d.curriculum.coverage({
      lessons: () => lessons,
      practice: () => lessons,
      // Generated practice tests can be built for every expectation with an authored pack.
      assessments: () => new Set([...lessons, ...assessmentIds]),
      aiOnly: () => ai,
    });
  }

  /** Students with spaced reviews due now (for the daily reminder). Names are not included in the notification. */
  studentsWithReviewsDue(): number {
    return this.d.db.get<{ n: number }>('SELECT COUNT(DISTINCT student_id) AS n FROM study_mastery WHERE next_review_at IS NOT NULL AND next_review_at <= ?', [this.now()])!.n;
  }
}
