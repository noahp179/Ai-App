import type { CurriculumApi, StudyApi } from '../shared/study/api';
import { UserError } from '../core/util';
import type { AppContext } from './context';
import { openTextFiles, parseJsonFile, saveFile } from './files';

const str = (v: unknown, name: string, max = 10_000): string => {
  if (typeof v !== 'string') throw new UserError(`${name} must be text.`);
  if (v.length > max) throw new UserError(`${name} is too long.`);
  return v;
};
const id = (v: unknown) => str(v, 'id', 200);
const today = () => new Date().toISOString().slice(0, 10);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'student';

export function createCurriculumApi(ctx: AppContext): CurriculumApi {
  return {
    overview: () => ctx.curriculum.overview(),
    courses: (q) => ctx.curriculum.courses(q ?? {}),
    course: (cid) => ctx.curriculum.course(id(cid)),
    expectation: (eid) => ctx.curriculum.expectation(id(eid)),
    search: (q, opts) => ctx.curriculum.search(str(q, 'Search', 300), opts ?? {}),
    imports: () => ctx.curriculum.imports(),
    revisions: () => ctx.curriculum.recentRevisions(),
    checkForUpdates: async () => {
      const r = await ctx.curriculum.checkForUpdates((message) => ctx.emit('curriculum.progress', { message }));
      ctx.changed('curriculum');
      return r;
    },
    pendingUpdate: () => ctx.curriculum.pendingUpdate(),
    applyUpdate: () => {
      const r = ctx.curriculum.applyUpdate();
      ctx.changed('curriculum');
      return r;
    },
    importFile: async () => {
      const files = await openTextFiles([{ name: 'Curriculum file', extensions: ['json'] }], false);
      if (!files?.[0]) return null;
      const r = ctx.curriculum.importFile(parseJsonFile(files[0].name, files[0].content));
      ctx.changed('curriculum');
      return r;
    },
    coverage: () => ctx.study.coverage(),
    exportCoverage: async () => {
      const c = ctx.study.coverage();
      const lines = [
        '# FlowCompanion curriculum coverage',
        '',
        `Generated ${c.generatedAt.slice(0, 10)}. Curriculum fetched from the Ontario Ministry of Education on ${c.fetchedAt.slice(0, 10)}.`,
        '',
        c.statement,
        '',
        '| Course | Grades | Specific expectations | Offline lessons | Checked practice | Status |',
        '|---|---|---|---|---|---|',
        ...c.rows.map((r) => `| ${r.label} | ${r.grades.join(', ')} | ${r.specific} | ${r.withLessons} | ${r.withPractice} | ${r.expectationsSource === 'pdf' ? 'PDF only (not imported)' : r.verification} |`),
      ];
      return saveFile(`flowcompanion-coverage-${today()}.md`, lines.join('\n'), [{ name: 'Markdown', extensions: ['md'] }]);
    },
  };
}

export function createStudyApi(ctx: AppContext): StudyApi {
  const s = ctx.study;
  /** Parental locks apply in the main process too, not only by hiding the UI. */
  const open = () => {
    const why = ctx.parental.lockReason('study');
    if (why) throw new UserError(why, 'locked');
  };
  const changed = <T>(v: T): T => {
    ctx.changed('study');
    return v;
  };
  const calendarChanged = <T>(v: T): T => {
    ctx.changed('study');
    ctx.changed('calendar');
    ctx.changed('tasks');
    ctx.changed('reminders');
    ctx.scheduler.wake();
    return v;
  };
  const me = () => {
    open();
    return s.me();
  };

  return {
    profiles: () => s.students.list(),
    createProfile: (input, pin) => {
      open();
      return changed(s.students.create(input ?? {}, pin ?? null));
    },
    openProfile: (sid, pin) => {
      open();
      return changed(s.students.open(id(sid), pin ?? null));
    },
    closeProfile: () => {
      s.students.close();
      ctx.changed('study');
    },
    me: () => s.students.activeOrNull(),
    updateProfile: (patch) => {
      open();
      return changed(s.students.update(patch ?? {}));
    },
    setPin: (cur, next) => {
      open();
      s.students.setPin(cur ?? null, next ?? null);
      ctx.changed('study');
    },
    deleteProfile: (confirm) => {
      open();
      s.students.deleteActive(str(confirm, 'Name', 100));
      ctx.changed('study');
    },
    parentResetPin: (sid, pin) => {
      s.parentResetPin(id(sid), str(pin, 'PIN', 64));
      ctx.changed('study');
    },
    parentReport: (sid, pin) => s.parentReport(id(sid), str(pin, 'PIN', 64)),
    exportParentReport: async (sid, pin) => {
      const r = s.parentReport(id(sid), str(pin, 'PIN', 64));
      return saveFile(`learning-report-${slug(r.student.displayName)}-${today()}.md`, s.reportMarkdown(r), [{ name: 'Markdown', extensions: ['md'] }]);
    },

    dashboard: () => {
      open();
      return s.dashboard();
    },
    aiStatus: () => s.aiStatus(),
    courseProgress: (cid) => {
      open();
      return s.courseProgress(id(cid));
    },
    expectationProgress: (eid) => {
      open();
      return s.expectationProgress(id(eid));
    },

    startLesson: async (input) => {
      open();
      return changed(await s.startLesson(input));
    },
    lesson: (lid) => s.lessonView(s.lessons.get(me().id, id(lid))),
    lessons: (status) => s.lessons.list(me().id, { status: status ?? 'all' }),
    goToStep: (lid, step) => changed(s.lessonView(s.lessons.goTo(me(), id(lid), Number(step)))),
    pauseLesson: (lid) => changed(s.lessonView(s.lessons.pause(me().id, id(lid)))),
    resumeLesson: (lid) => changed(s.lessonView(s.lessons.resume(me(), id(lid)))),
    repeatLesson: async (lid) => changed(s.lessonView(await s.lessons.repeat(me(), id(lid)))),
    abandonLesson: (lid) => {
      s.lessons.abandon(me().id, id(lid));
      ctx.changed('study');
    },
    lessonHint: (lid, qid) => s.lessons.hint(me().id, id(lid), id(qid)),
    answerLesson: async (lid, qid, response, opts) => {
      open();
      return changed(await s.answerLesson(id(lid), id(qid), response, opts ?? {}));
    },
    similarQuestion: (lid, qid) => changed(s.lessonView(s.lessons.similar(me(), id(lid), id(qid)))),
    explainAgain: async (lid, kind) => {
      open();
      return s.explainAgain(id(lid), kind);
    },
    completeLesson: (lid) => changed(s.lessonView(s.lessons.complete(me(), id(lid)))),

    createQuiz: async (input) => {
      open();
      return changed(await s.createQuiz(input));
    },
    quiz: (qid) => s.quizView(s.quizzes.get(me().id, id(qid))),
    quizzes: () => s.quizzes.list(me().id),
    quizHint: (qid, itemId) => s.quizzes.hint(me().id, id(qid), id(itemId)),
    answerQuiz: async (qid, itemId, response, opts) => changed(await s.quizzes.answer(me(), id(qid), id(itemId), response, opts ?? {})),
    finishQuiz: (qid) => changed(s.quizzes.finish(me().id, id(qid))),
    abandonQuiz: (qid) => {
      s.quizzes.abandon(me().id, id(qid));
      ctx.changed('study');
    },

    reviewQueue: () => s.progress.dueReviews(me().id, 24),
    startReview: async (ids) => {
      open();
      return changed(await s.startReview(Array.isArray(ids) ? ids.map(id) : undefined));
    },
    gaps: () => s.progress.gaps(me().id),
    mastery: () => s.progress.all(me().id),
    reflect: (input) => {
      open();
      s.reflect(input);
      ctx.changed('study');
    },
    activity: (limit) => {
      open();
      return s.activity(typeof limit === 'number' ? limit : 50);
    },

    plans: () => s.planner.plans(me().id),
    proposePlan: (input) => changed(s.planner.propose(me(), input)),
    approvePlan: (pid) => calendarChanged(s.planner.approve(me(), id(pid))),
    discardPlan: (pid) => {
      s.planner.deleteProposed(me().id, id(pid));
      ctx.changed('study');
    },
    reschedulePlan: (pid) => calendarChanged(s.planner.rescheduleMissed(me(), id(pid))),
    markPlanSession: (pid, sid, status) => calendarChanged(s.planner.markSession(me(), id(pid), id(sid), status)),
    archivePlan: (pid, removeFuture) => calendarChanged(s.planner.archive(me(), id(pid), removeFuture === true)),

    assignments: (includeDone) => s.planner.assignments(me().id, includeDone === true),
    createAssignment: (input) => changed(s.planner.createAssignment(me().id, input)),
    updateAssignment: (aid, patch) => changed(s.planner.updateAssignment(me().id, id(aid), patch)),
    toggleAssignmentStep: (aid, stepId, done) => changed(s.planner.toggleStep(me().id, id(aid), id(stepId), done === true)),
    deleteAssignment: (aid) => {
      s.planner.deleteAssignment(me().id, id(aid));
      ctx.changed('study');
    },
    draftFeedback: async (aid, draft) => {
      const student = me();
      const a = s.planner.assignment(student.id, id(aid));
      if (!s.aiStatus().available) throw new UserError(s.aiStatus().reason ?? 'AI feedback is not available.', 'not_configured');
      return s.ai.draftFeedback(student, { expectationId: a.expectationIds[0] ?? null, task: a.prompt || a.title, draft: str(draft, 'Draft', 40_000) });
    },

    assessments: () => s.assessments.list(me().id),
    assessment: (aid) => s.assessments.get(me().id, id(aid)),
    buildAssessment: async (input, shared) => {
      const student = me();
      return changed(await s.assessments.build(shared ? null : student.id, student, input));
    },
    reviewAssessmentItem: (aid, itemId, reviewed) => changed(s.assessments.review(ownerOf(aid), id(aid), id(itemId), reviewed === true)),
    markAssessmentReviewed: (aid) => changed(s.assessments.markReviewed(ownerOf(aid), id(aid))),
    removeAssessmentItem: (aid, itemId) => changed(s.assessments.removeItem(ownerOf(aid), id(aid), id(itemId))),
    regenerateAssessmentItem: (aid, itemId) => changed(s.assessments.regenerateItem(ownerOf(aid), id(aid), id(itemId))),
    updateAssessment: (aid, patch) => changed(s.assessments.update(ownerOf(aid), id(aid), patch ?? {})),
    duplicateAssessment: (aid) => changed(s.assessments.duplicate(ownerOf(aid), id(aid))),
    deleteAssessment: (aid) => {
      s.assessments.delete(ownerOf(aid), id(aid));
      ctx.changed('study');
    },
    exportAssessment: async (aid, format) => {
      const f = format === 'json' ? s.assessments.toJson(ownerOf(aid), id(aid)) : s.assessments.toMarkdown(ownerOf(aid), id(aid));
      return saveFile(f.filename, f.content, [format === 'json' ? { name: 'JSON', extensions: ['json'] } : { name: 'Markdown', extensions: ['md'] }]);
    },
    takeAssessment: async (aid) => {
      open();
      return changed(await s.takeAssessment(id(aid)));
    },

    tutorSessions: () => s.ai.sessions(me().id),
    createTutorSession: (input) => changed(s.ai.createSession(me(), input ?? {})),
    updateTutorSession: (tid, patch) => changed(s.ai.updateSession(me().id, id(tid), patch ?? {})),
    tutorMessages: (tid) => s.ai.messages(me().id, id(tid)),
    sendTutor: (tid, text) => {
      const student = me();
      const st = s.aiStatus();
      if (!st.available) throw new UserError(st.reason ?? 'The AI tutor is not available.', 'not_configured');
      return s.ai.send(student, id(tid), str(text, 'Message', 8000));
    },
    stopTutor: (tid) => s.ai.stop(me().id, id(tid)),
    resetTutor: (tid) => {
      s.ai.resetSession(me().id, id(tid));
      ctx.changed('study');
    },
    deleteTutorSession: (tid) => {
      s.ai.deleteSession(me().id, id(tid));
      ctx.changed('study');
    },

    myReport: () => {
      open();
      return s.myReport();
    },
    exportMyReport: async () => {
      open();
      const r = s.myReport();
      return saveFile(`learning-report-${slug(r.student.displayName)}-${today()}.md`, s.reportMarkdown(r), [{ name: 'Markdown', extensions: ['md'] }]);
    },
    exportMyData: async () => {
      open();
      const d = s.exportMyData();
      return saveFile(`flowcompanion-student-learning-${today()}.json`, JSON.stringify(d, null, 2), [{ name: 'JSON', extensions: ['json'] }]);
    },
    deleteMyLearningData: (confirm) => {
      open();
      const n = s.deleteMyLearningData(str(confirm, 'Confirmation', 20));
      ctx.changed('study');
      return n;
    },
    reportContent: (input) => changed(s.reportContent(input)),
    contentReports: () => s.contentReports(),
    resolveContentReport: (rid) => {
      s.resolveContentReport(id(rid));
      ctx.changed('study');
    },
  };

  /** Shared-library assessments have no owner; the student's own ones are theirs. */
  function ownerOf(aid: unknown): string | null {
    const student = me();
    const row = ctx.db.get<{ owner_student_id: string | null }>('SELECT owner_student_id FROM study_assessments WHERE id = ?', [id(aid)]);
    return row?.owner_student_id === null ? null : student.id;
  }
}
