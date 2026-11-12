import { toCsv } from '../../src/shared/classroom/csv';
import { isAnswered, isAutoGraded, promptText, responseText } from '../../src/shared/classroom/items';
import { computeOverlap, isVerbatim } from '../../src/shared/classroom/overlap';
import {
  BatchBody,
  CommentBankBody,
  EvaluationReviewBody,
  GradeBody,
  OverallFeedbackBody,
  ReleaseBody,
  type Accommodation,
  type BatchStatusDto,
  type ClassOverviewDto,
  type EvaluationDto,
  type GradeDto,
  type GradebookDto,
  type IntegrityEventDto,
  type ItemDto,
  type OverlapDto,
  type Response,
  type RubricCriterion,
  type SubmissionDto,
  type SubmissionRow,
  type WrittenSuggestion,
} from '../../src/shared/classroom/protocol';
import { AI_ERROR_MESSAGE, AiProviderError, type JudgeRequest, type JudgeResult } from '../ai/provider';
import { EvaluationOutput, WrittenOutput, evaluationPrompt, writtenPrompt } from '../ai/prompts';
import { HttpError, NO_ACCOMMODATION, json, notFound, type S } from '../core';
import { assessmentFor, attemptFor, itemsOf, settingsOf, type AssessmentRow, type AttemptRow } from '../lifecycle';
import { chatDto, type ChatRow } from './attempts';

interface GradeRow {
  attempt_id: string;
  item_id: string;
  auto_score: number | null;
  auto_result: string | null;
  suggestion: string | null;
  suggestion_status: GradeDto['suggestionStatus'];
  suggestion_error: string | null;
  score: number | null;
  source: 'auto' | 'teacher' | null;
  levels: string | null;
  override_reason: string;
  comment: string;
  highlights: string;
}
interface EvalRow {
  attempt_id: string;
  status: EvaluationDto['status'];
  error: string | null;
  rubric: string;
  suggested: string | null;
  evidence_removed: number;
  model: string | null;
  final: string | null;
  student_reply: string | null;
}
interface JobRow {
  id: string;
  school_id: string;
  assessment_id: string;
  attempt_id: string;
  item_id: string | null;
  kind: 'evaluate' | 'grade_written';
  status: 'queued' | 'budget' | 'batch' | 'done' | 'failed';
  batch_id: string | null;
}

const gradeDto = (g: GradeRow): GradeDto => ({
  itemId: g.item_id,
  auto: g.auto_result ? { score: g.auto_score ?? 0, result: JSON.parse(g.auto_result) as NonNullable<GradeDto['auto']>['result'] } : null,
  suggestion: json<WrittenSuggestion | null>(g.suggestion, null),
  suggestionStatus: g.suggestion_status,
  suggestionError: g.suggestion_error,
  score: g.score,
  source: g.source,
  levels: json<Record<string, number> | null>(g.levels, null),
  overrideReason: g.override_reason,
  comment: g.comment,
  highlights: json(g.highlights, []),
});
const evalDto = (e: EvalRow | undefined, rubric: RubricCriterion[]): EvaluationDto => ({
  status: e?.status ?? 'none',
  error: e?.error ?? null,
  rubric: e ? json(e.rubric, rubric) : rubric,
  suggested: json<EvaluationDto['suggested']>(e?.suggested, null),
  evidenceRemoved: e?.evidence_removed === 1,
  model: e?.model ?? null,
  final: json<EvaluationDto['final']>(e?.final, null),
  studentReply: e?.student_reply ?? null,
});
const round2 = (n: number) => Math.round(n * 100) / 100;

export function registerGrading(s: S): void {
  const { db } = s;

  // ─────────── AI jobs: AI-use evaluation and written-answer suggestions ───────────

  const chatOf = (attemptId: string) => db.all<ChatRow>('SELECT * FROM chat_messages WHERE attempt_id = ? ORDER BY rowid', [attemptId]);
  const context = (job: Pick<JobRow, 'attempt_id'>) => {
    const t = db.get<AttemptRow>('SELECT * FROM attempts WHERE id = ?', [job.attempt_id])!;
    const a = db.get<AssessmentRow>('SELECT * FROM assessments WHERE id = ?', [t.assessment_id])!;
    const cls = db.get<{ id: string; school_id: string }>('SELECT id, school_id FROM classes WHERE id = ?', [a.class_id])!;
    return { t, a, cls, items: itemsOf(s, a.id, t.version), school: s.settings(cls.school_id) };
  };

  /** The request for a job, or null when there is nothing for the AI to look at. Students are never named. */
  const requestFor = (job: JobRow): JudgeRequest | null => {
    const { t, a, items, school } = context(job);
    if (job.kind === 'evaluate') {
      const chat = chatOf(t.id).filter((m) => m.status === 'complete' || m.status === 'refused');
      if (!chat.some((m) => m.role === 'student')) return null;
      const rubric = json<RubricCriterion[]>(db.get<EvalRow>('SELECT * FROM ai_evaluations WHERE attempt_id = ?', [t.id])?.rubric, settingsOf(a).aiUseRubric);
      const p = evaluationPrompt({ mode: settingsOf(a).aiMode, questions: items.map((i) => promptText(i.question)), rubric, transcript: chat.map((m) => ({ id: m.id.slice(0, 8), role: m.role, kind: m.kind, text: m.content })) });
      return { model: school.aiModel, effort: school.gradingEffort, system: p.system, user: p.user, schema: EvaluationOutput };
    }
    const item = items.find((i) => i.id === job.item_id);
    const r = json<Record<string, Response>>(t.responses, {})[job.item_id ?? ''];
    if (!item || item.question.type !== 'written' || !r || r.type !== 'written' || !r.text.trim()) return null;
    const p = writtenPrompt({ question: promptText(item.question), rubric: item.question.rubric, sampleAnswer: item.question.sampleAnswer, answer: r.text });
    return { model: school.aiModel, effort: school.gradingEffort, system: p.system, user: p.user, schema: WrittenOutput };
  };

  const setTarget = (job: JobRow, status: string, error: string | null = null) => {
    if (job.kind === 'evaluate') db.run('UPDATE ai_evaluations SET status = ?, error = ?, updated_at = ? WHERE attempt_id = ?', [status, error, s.now(), job.attempt_id]);
    else db.run('UPDATE grades SET suggestion_status = ?, suggestion_error = ? WHERE attempt_id = ? AND item_id = ?', [status, error, job.attempt_id, job.item_id]);
  };
  const finish = (job: JobRow, status: 'done' | 'failed', target: string, error: string | null = null) => {
    db.run('UPDATE ai_jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?', [status, error, s.now(), job.id]);
    setTarget(job, target, error);
  };

  /**
   * Checks and stores a judge's reply. Returns false when the reply cannot be used (wrong shape, missing criteria,
   * cut off). Quotes that are not word for word in the source are dropped and the result is marked as such.
   */
  const apply = (job: JobRow, r: JudgeResult): boolean => {
    if (r.stop === 'refusal') {
      finish(job, 'failed', 'failed', 'The AI declined this request.');
      return true;
    }
    if (r.stop !== 'end' || !r.text) return false;
    let data: unknown;
    try {
      data = JSON.parse(r.text);
    } catch {
      return false;
    }
    const { t, items } = context(job);
    if (job.kind === 'evaluate') {
      const out = EvaluationOutput.safeParse(data);
      const ev = db.get<EvalRow>('SELECT * FROM ai_evaluations WHERE attempt_id = ?', [t.id])!;
      const rubric = json<RubricCriterion[]>(ev.rubric, []);
      if (!out.success || !rubric.every((c) => out.data.criteria.some((x) => x.criterionId === c.id && x.level >= 1 && x.level <= 4))) return false;
      const chat = chatOf(t.id);
      let removed = false;
      const criteria = rubric.map((c) => {
        const x = out.data.criteria.find((y) => y.criterionId === c.id)!;
        const quotes: { messageId: string; text: string }[] = [];
        for (const q of x.quotes.slice(0, 3)) {
          // The quote must be in the message it names, or in another message of the transcript.
          const m = chat.find((cm) => cm.id.startsWith(q.messageId) && isVerbatim(q.text, cm.content)) ?? chat.find((cm) => isVerbatim(q.text, cm.content));
          if (m) quotes.push({ messageId: m.id, text: q.text.slice(0, 500) });
          else removed = true;
        }
        return { criterionId: c.id, level: x.level, quotes, rationale: x.rationale.slice(0, 600) };
      });
      db.run(`UPDATE ai_evaluations SET status = 'done', error = NULL, suggested = ?, evidence_removed = ?, model = ?, updated_at = ? WHERE attempt_id = ?`, [
        JSON.stringify({ criteria, summary: out.data.summary.slice(0, 1500), flags: out.data.flags.slice(0, 8).map((f) => f.slice(0, 200)) }),
        removed,
        r.model,
        s.now(),
        t.id,
      ]);
    } else {
      const out = WrittenOutput.safeParse(data);
      const item = items.find((i) => i.id === job.item_id);
      if (!out.success || !item || item.question.type !== 'written') return false;
      const rubric = item.question.rubric;
      if (!rubric.every((c) => out.data.levels.some((x) => x.criterionId === c.id && x.level >= 1 && x.level <= 4))) return false;
      const answer = (json<Record<string, Response>>(t.responses, {})[item.id] as { text?: string } | undefined)?.text ?? '';
      let removed = false;
      const levels = rubric.map((c) => {
        const x = out.data.levels.find((y) => y.criterionId === c.id)!;
        const ok = !x.quote.trim() || isVerbatim(x.quote, answer);
        if (!ok) removed = true;
        return { criterionId: c.id, level: x.level, quote: ok ? x.quote.slice(0, 500) : '', rationale: x.rationale.slice(0, 600) };
      });
      // A starting point for the teacher: the lowest level is worth nothing, the highest full marks.
      const score = Math.round(((levels.reduce((n, l) => n + (l.level - 1) / 3, 0) / levels.length) * item.points) * 2) / 2;
      const suggestion: WrittenSuggestion = { levels, feedback: out.data.feedback.slice(0, 3000), score, evidenceRemoved: removed, model: r.model };
      db.run(`UPDATE grades SET suggestion = ?, suggestion_status = 'done', suggestion_error = NULL WHERE attempt_id = ? AND item_id = ?`, [JSON.stringify(suggestion), t.id, item.id]);
    }
    db.run(`UPDATE ai_jobs SET status = 'done', finished_at = ? WHERE id = ?`, [s.now(), job.id]);
    return true;
  };

  const usage = (job: JobRow, r: JudgeResult, discount = 1) => {
    const { a, cls } = context(job);
    s.recordUsage({ schoolId: cls.school_id, classId: cls.id, assessmentId: a.id, kind: job.kind, model: r.model, usage: r.usage, discount });
  };

  /** Runs one job now. An unusable reply is retried once; after that it is reported as not evaluated, never guessed. */
  const runNow = async (jobId: string, attemptsLeft = 2): Promise<void> => {
    const job = db.get<JobRow>('SELECT * FROM ai_jobs WHERE id = ?', [jobId]);
    if (!job || job.status === 'done' || job.status === 'failed') return;
    const ai = s.ai(job.school_id);
    if (!ai) return finish(job, 'failed', 'failed', 'No AI key is set up for your school.');
    if (s.budget(job.school_id).state === 'paused') {
      db.run(`UPDATE ai_jobs SET status = 'budget' WHERE id = ?`, [job.id]);
      return setTarget(job, 'queued', 'Waiting: the school’s AI budget for this month is used up.');
    }
    const req = requestFor(job);
    if (!req) {
      if (job.kind === 'evaluate') {
        db.run(`UPDATE ai_evaluations SET status = 'done', error = NULL, suggested = ?, evidence_removed = 0, model = NULL, updated_at = ? WHERE attempt_id = ?`, [
          JSON.stringify({ criteria: [], summary: 'The student did not use the AI assistant, so there is nothing to evaluate.', flags: [] }),
          s.now(),
          job.attempt_id,
        ]);
        db.run(`UPDATE ai_jobs SET status = 'done', finished_at = ? WHERE id = ?`, [s.now(), job.id]);
      } else finish(job, 'failed', 'none', 'There is no written answer to mark.');
      return;
    }
    setTarget(job, 'running');
    try {
      for (let i = 0; i < attemptsLeft; i++) {
        const r = await ai.judge(req);
        usage(job, r);
        if (apply(job, r)) return;
      }
      finish(job, 'failed', 'invalid', job.kind === 'evaluate' ? 'Not evaluated: the AI’s reply could not be used. Try again.' : 'Not graded: the AI’s reply could not be used. Try again.');
    } catch (err) {
      finish(job, 'failed', 'failed', err instanceof AiProviderError ? AI_ERROR_MESSAGE[err.kind] : 'The AI request failed.');
      if (!(err instanceof AiProviderError)) s.opts.log?.(`job failed: ${(err as Error).stack ?? err}`);
    }
  };

  const enqueue = (kind: JobRow['kind'], t: Pick<AttemptRow, 'id' | 'assessment_id'>, schoolId: string, itemId: string | null): string => {
    const open = db.get<{ id: string }>(`SELECT id FROM ai_jobs WHERE attempt_id = ? AND kind = ? AND COALESCE(item_id, '') = ? AND status IN ('queued', 'budget', 'batch')`, [t.id, kind, itemId ?? '']);
    if (open) return open.id;
    const id = s.newId();
    db.run(`INSERT INTO ai_jobs (id, school_id, assessment_id, attempt_id, item_id, kind, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)`, [id, schoolId, t.assessment_id, t.id, itemId, kind, s.now()]);
    setTarget({ kind, attempt_id: t.id, item_id: itemId } as JobRow, 'queued');
    return id;
  };

  // Background work started by submissions runs one at a time and is awaited by idle().
  let chain: Promise<void> = Promise.resolve();
  const background = (jobId: string) => {
    chain = chain.then(() => runNow(jobId)).catch((err) => s.opts.log?.(`background job failed: ${(err as Error).stack ?? err}`));
  };
  s.idle = () => chain;

  s.onSubmitted.push((attemptId) => {
    const { t, a, cls } = context({ attempt_id: attemptId });
    const st = settingsOf(a);
    if (!st.evaluateAiUse || st.aiMode === 'off' || !s.ai(cls.school_id)) return;
    background(enqueue('evaluate', t, cls.school_id, null));
  });

  /** Collects finished batches. Results come back in any order and are matched by job id. */
  const pollBatches = async () => {
    for (const { batch_id, school_id } of db.all<{ batch_id: string; school_id: string }>(`SELECT DISTINCT batch_id, school_id FROM ai_jobs WHERE status = 'batch' AND batch_id IS NOT NULL`)) {
      const ai = s.ai(school_id);
      if (!ai) continue;
      let res: Awaited<ReturnType<typeof ai.batch>>;
      try {
        res = await ai.batch(batch_id);
      } catch (err) {
        s.opts.log?.(`batch ${batch_id} could not be checked: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      if (!res.done) continue;
      const jobs = db.all<JobRow>(`SELECT * FROM ai_jobs WHERE batch_id = ? AND status = 'batch'`, [batch_id]);
      for (const job of jobs) {
        const entry = res.results.find((e) => e.customId === job.id);
        if (!entry?.result) {
          finish(job, 'failed', 'failed', entry?.error ?? 'The AI service returned no result for this request.');
          continue;
        }
        usage(job, entry.result, ai.batchDiscount);
        if (!apply(job, entry.result)) {
          // One more try on its own before giving up.
          db.run(`UPDATE ai_jobs SET status = 'queued', batch_id = NULL WHERE id = ?`, [job.id]);
          await runNow(job.id, 1);
        }
      }
    }
  };
  /** Jobs that waited for budget run once there is budget again. */
  const resumeBudgetJobs = async () => {
    for (const job of db.all<JobRow>(`SELECT * FROM ai_jobs WHERE status = 'budget'`)) {
      if (s.budget(job.school_id).state === 'paused') continue;
      db.run(`UPDATE ai_jobs SET status = 'queued' WHERE id = ?`, [job.id]);
      await runNow(job.id);
    }
  };
  s.sweeps.push(pollBatches, resumeBudgetJobs);

  // ─────────── Submissions ───────────

  const signals = (attemptId: string, answers: OverlapDto[]): SubmissionRow['signals'] => {
    const n = (kind: string) => db.get<{ n: number }>('SELECT COUNT(*) AS n FROM integrity_events WHERE attempt_id = ? AND kind = ?', [attemptId, kind])!.n;
    return {
      pasteAttempts: n('paste_blocked') + n('drop_blocked'),
      focusLosses: n('focus_lost'),
      largeInserts: n('large_insert'),
      ruleChangeAttempts: n('rule_change_attempt'),
      messages: db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM chat_messages WHERE attempt_id = ? AND role = 'student'`, [attemptId])!.n,
      maxOverlap: Math.max(0, ...answers.map((o) => o.similarity)),
    };
  };
  const overlapOf = (t: AttemptRow, items: ItemDto[]): OverlapDto[] => {
    const messages = chatOf(t.id)
      .filter((m) => m.role === 'assistant' && m.content)
      .map((m) => ({ id: m.id, text: m.content }));
    const responses = json<Record<string, Response>>(t.responses, {});
    return items
      .filter((i) => i.question.type === 'written' || i.question.type === 'short_answer')
      .map((i) => {
        const r = responses[i.id];
        const text = r && (r.type === 'written' || r.type === 'text') ? r.text : '';
        return { itemId: i.id, ...computeOverlap(text, messages) };
      });
  };
  const totals = (t: AttemptRow, items: ItemDto[]) => {
    const grades = db.all<GradeRow>('SELECT * FROM grades WHERE attempt_id = ?', [t.id]);
    const decided = items.filter((i) => grades.find((g) => g.item_id === i.id)?.score !== null && grades.find((g) => g.item_id === i.id)?.score !== undefined).length;
    const max = items.reduce((n, i) => n + i.points, 0);
    return { grades, decided, of: items.length, max, score: t.status === 'submitted' && decided === items.length ? round2(grades.reduce((n, g) => n + (g.score ?? 0), 0)) : null };
  };

  /** One row per student in the class: their latest attempt, how far grading is, and plain counts of signals. */
  s.route('GET', '/assessments/:id/submissions', (c, [id]) => {
    const { a, cls } = assessmentFor(s, c, id!, 'teacher');
    const students = db.all<{ user_id: string; display_name: string }>(`SELECT m.user_id, u.display_name FROM class_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? AND m.role = 'student' AND m.status = 'active' ORDER BY u.display_name COLLATE NOCASE`, [cls.id]);
    const accs = new Set(db.all<{ user_id: string; data: string }>('SELECT user_id, data FROM accommodations WHERE class_id = ?', [cls.id]).filter((r) => Object.entries(json<Accommodation>(r.data, NO_ACCOMMODATION)).some(([k, v]) => k !== 'note' && !!v)).map((r) => r.user_id));
    return students.map((st): SubmissionRow => {
      const t = db.get<AttemptRow>('SELECT * FROM attempts WHERE assessment_id = ? AND user_id = ? ORDER BY number DESC LIMIT 1', [a.id, st.user_id]);
      const student = { id: st.user_id, displayName: st.display_name };
      const none = { pasteAttempts: 0, focusLosses: 0, largeInserts: 0, ruleChangeAttempts: 0, messages: 0, maxOverlap: 0 };
      if (!t) return { attemptId: null, student, status: 'not_started', submittedAt: null, score: null, max: 0, toGrade: 0, evaluation: 'none', evaluationReviewed: false, signals: none, hasAccommodation: accs.has(st.user_id) };
      const items = itemsOf(s, a.id, t.version);
      const tot = totals(t, items);
      const ev = db.get<EvalRow>('SELECT * FROM ai_evaluations WHERE attempt_id = ?', [t.id]);
      return {
        attemptId: t.id,
        student,
        status: t.status === 'in_progress' ? 'in_progress' : t.released_at ? 'released' : tot.score !== null ? 'graded' : 'submitted',
        submittedAt: t.submitted_at,
        score: tot.score,
        max: tot.max,
        toGrade: t.status === 'submitted' ? tot.of - tot.decided : 0,
        evaluation: ev?.status ?? 'none',
        evaluationReviewed: !!ev?.final,
        signals: signals(t.id, t.status === 'submitted' ? overlapOf(t, items) : []),
        hasAccommodation: accs.has(st.user_id),
      };
    });
  });

  /** Everything about one submission on one screen. Opening it is written to the audit log. */
  s.route('GET', '/attempts/:id/review', (c, [id]) => {
    const { t, a, cls, user, viaAdmin } = attemptFor(s, c, id!, 'teacher');
    const items = itemsOf(s, a.id, t.version);
    const tot = totals(t, items);
    const student = db.get<{ id: string; display_name: string }>('SELECT id, display_name FROM users WHERE id = ?', [t.user_id])!;
    const st = settingsOf(a);
    s.audit(user, cls.school_id, 'submission.viewed', `${cls.name}: ${a.title}`, `Student ${student.display_name}: answers, chat and activity${viaAdmin ? ' (opened by an administrator)' : ''}`);
    return {
      attempt: { id: t.id, number: t.number, status: t.status, startedAt: t.started_at, deadline: t.deadline, submittedAt: t.submitted_at, autoSubmitted: t.auto_submitted === 1, reference: t.reference, version: t.version, released: !!t.released_at },
      student: { id: student.id, displayName: student.display_name },
      assessment: { id: a.id, title: a.title, classId: a.class_id, settings: st },
      items,
      responses: json(t.responses, {}),
      seconds: json(t.seconds, {}),
      grades: items.map((i) => gradeDto(tot.grades.find((g) => g.item_id === i.id) ?? ({ attempt_id: t.id, item_id: i.id, auto_score: null, auto_result: null, suggestion: null, suggestion_status: 'none', suggestion_error: null, score: null, source: null, levels: null, override_reason: '', comment: '', highlights: '[]' } satisfies GradeRow))),
      overallComment: t.overall_comment,
      total: { score: tot.score, max: tot.max, decided: tot.decided, of: tot.of },
      chat: chatOf(t.id).map(chatDto),
      events: db.all<{ id: string; kind: IntegrityEventDto['kind']; item_id: string | null; at: string; detail: string }>('SELECT * FROM integrity_events WHERE attempt_id = ? ORDER BY at', [t.id]).map((e) => ({ id: e.id, kind: e.kind, itemId: e.item_id, at: e.at, detail: json(e.detail, {}) })),
      snapshots: db.all<{ item_id: string; at: string; text: string }>('SELECT item_id, at, text FROM snapshots WHERE attempt_id = ? ORDER BY at', [t.id]).map((x) => ({ itemId: x.item_id, at: x.at, text: x.text })),
      evaluation: evalDto(db.get<EvalRow>('SELECT * FROM ai_evaluations WHERE attempt_id = ?', [t.id]), st.aiUseRubric),
      overlap: t.status === 'submitted' ? overlapOf(t, items) : [],
      accommodation: { ...NO_ACCOMMODATION, ...json<Partial<Accommodation>>(t.accommodation, {}) },
    } satisfies SubmissionDto;
  });

  /** The teacher's mark for one question. This, not any suggestion, is what counts. */
  s.route('PUT', '/attempts/:id/grades/:item', (c, [id, itemId]) => {
    const { t, a, cls, user } = attemptFor(s, c, id!, 'teacher');
    if (user.role === 'admin' && !db.get(`SELECT 1 FROM class_members WHERE class_id = ? AND user_id = ? AND status = 'active'`, [cls.id, user.id])) throw new HttpError(403, 'forbidden', 'Only the class’s teachers can grade.');
    if (t.status !== 'submitted') throw new HttpError(409, 'not_submitted', 'This attempt has not been submitted yet.');
    const b = s.parse(GradeBody, c.body);
    const item = itemsOf(s, a.id, t.version).find((i) => i.id === itemId);
    if (!item) throw notFound('That question');
    if (b.score > item.points) throw new HttpError(400, 'invalid_request', `This question is out of ${item.points}.`);
    const cur = db.get<GradeRow>('SELECT * FROM grades WHERE attempt_id = ? AND item_id = ?', [t.id, item.id]);
    // Changing a mark the checker gave needs a reason, which is kept.
    if (cur?.source === 'auto' && cur.auto_score !== null && b.score !== cur.auto_score && !b.overrideReason.trim()) throw new HttpError(400, 'reason_required', 'Say why you are changing the automatic mark.');
    const answer = responseText(item.question, json<Record<string, Response>>(t.responses, {})[item.id]);
    const highlights = b.highlights.filter((h) => h.end > h.start && h.end <= answer.length);
    db.run(
      `INSERT INTO grades (attempt_id, item_id, score, source, levels, override_reason, comment, highlights, graded_by, graded_at) VALUES (?, ?, ?, 'teacher', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(attempt_id, item_id) DO UPDATE SET score = excluded.score, source = 'teacher', levels = excluded.levels, override_reason = excluded.override_reason, comment = excluded.comment, highlights = excluded.highlights, graded_by = excluded.graded_by, graded_at = excluded.graded_at`,
      [t.id, item.id, b.score, b.levels ? JSON.stringify(b.levels) : null, b.overrideReason, b.comment, JSON.stringify(highlights), user.id, s.now()],
    );
    if (cur?.source === 'auto' && b.score !== cur.auto_score) s.audit(user, cls.school_id, 'grade.overridden', `${cls.name}: ${a.title}`, `Question ${item.position}: ${cur.auto_score} → ${b.score}. ${b.overrideReason}`);
    return gradeDto(db.get<GradeRow>('SELECT * FROM grades WHERE attempt_id = ? AND item_id = ?', [t.id, item.id])!);
  });

  s.route('PUT', '/attempts/:id/feedback', (c, [id]) => {
    const { t } = attemptFor(s, c, id!, 'teacher');
    const b = s.parse(OverallFeedbackBody, c.body);
    db.run('UPDATE attempts SET overall_comment = ? WHERE id = ?', [b.comment, t.id]);
    return { ok: true };
  });

  /** Asks the AI for a suggested rubric level and feedback for one written answer. */
  s.route('POST', '/attempts/:id/suggest/:item', async (c, [id, itemId]) => {
    const { t, cls } = attemptFor(s, c, id!, 'teacher');
    if (t.status !== 'submitted') throw new HttpError(409, 'not_submitted', 'This attempt has not been submitted yet.');
    if (!s.ai(cls.school_id)) throw new HttpError(409, 'ai_unavailable', 'No AI key is set up for your school.');
    db.run('INSERT OR IGNORE INTO grades (attempt_id, item_id) VALUES (?, ?)', [t.id, itemId!]);
    await runNow(enqueue('grade_written', t, cls.school_id, itemId!));
    return gradeDto(db.get<GradeRow>('SELECT * FROM grades WHERE attempt_id = ? AND item_id = ?', [t.id, itemId!])!);
  });

  s.route('POST', '/attempts/:id/evaluate', async (c, [id]) => {
    const { t, a, cls } = attemptFor(s, c, id!, 'teacher');
    if (t.status !== 'submitted') throw new HttpError(409, 'not_submitted', 'This attempt has not been submitted yet.');
    if (!s.ai(cls.school_id)) throw new HttpError(409, 'ai_unavailable', 'No AI key is set up for your school.');
    await runNow(enqueue('evaluate', t, cls.school_id, null));
    return evalDto(db.get<EvalRow>('SELECT * FROM ai_evaluations WHERE attempt_id = ?', [t.id]), settingsOf(a).aiUseRubric);
  });

  /** The teacher's decision on AI use. Final; the AI's suggestion is only ever a starting point. */
  s.route('PUT', '/attempts/:id/evaluation', (c, [id]) => {
    const { t, a, cls, user } = attemptFor(s, c, id!, 'teacher');
    const b = s.parse(EvaluationReviewBody, c.body);
    const ev = db.get<EvalRow>('SELECT * FROM ai_evaluations WHERE attempt_id = ?', [t.id]);
    if (!ev) throw new HttpError(409, 'not_submitted', 'This attempt has not been submitted yet.');
    const rubric = json<RubricCriterion[]>(ev.rubric, []);
    if (!rubric.every((r) => b.levels[r.id])) throw new HttpError(400, 'invalid_request', 'Choose a level for every criterion.');
    const suggested = json<EvaluationDto['suggested']>(ev.suggested, null);
    const changed = (suggested?.criteria ?? []).filter((x) => b.levels[x.criterionId] !== x.level).map((x) => `${x.criterionId}: ${x.level} → ${b.levels[x.criterionId]}`);
    db.run('UPDATE ai_evaluations SET final = ?, updated_at = ? WHERE attempt_id = ?', [JSON.stringify({ levels: b.levels, comment: b.comment, reviewedAt: s.now() }), s.now(), t.id]);
    if (changed.length) s.audit(user, cls.school_id, 'evaluation.changed', `${cls.name}: ${a.title}`, `Teacher changed the AI’s suggestion: ${changed.join(', ')}`);
    return evalDto(db.get<EvalRow>('SELECT * FROM ai_evaluations WHERE attempt_id = ?', [t.id]), settingsOf(a).aiUseRubric);
  });

  // ─────────── Whole class at once ───────────

  const batchStatus = (assessmentId: string): BatchStatusDto => {
    const last = db.get<{ kind: JobRow['kind']; created_at: string }>(`SELECT kind, created_at FROM ai_jobs WHERE assessment_id = ? AND (batch_id IS NOT NULL OR status = 'budget') ORDER BY created_at DESC LIMIT 1`, [assessmentId]);
    if (!last) return { running: false, what: null, total: 0, done: 0, failed: 0, queuedForBudget: 0 };
    const rows = db.all<{ status: string; n: number }>(`SELECT status, COUNT(*) AS n FROM ai_jobs WHERE assessment_id = ? AND kind = ? AND created_at >= ? GROUP BY status`, [assessmentId, last.kind, new Date(Date.parse(last.created_at) - 5000).toISOString()]);
    const n = (st: string) => rows.find((r) => r.status === st)?.n ?? 0;
    return { running: n('batch') + n('queued') > 0, what: last.kind, total: rows.reduce((x, r) => x + r.n, 0), done: n('done'), failed: n('failed'), queuedForBudget: n('budget') };
  };

  s.route('POST', '/assessments/:id/batch', async (c, [id]) => {
    const { a, cls } = assessmentFor(s, c, id!, 'teacher');
    const b = s.parse(BatchBody, c.body);
    const ai = s.ai(cls.school_id);
    if (!ai) throw new HttpError(409, 'ai_unavailable', 'No AI key is set up for your school.');
    const jobs: JobRow[] = [];
    const empty: string[] = [];
    for (const t of db.all<AttemptRow>(`SELECT * FROM attempts WHERE assessment_id = ? AND status = 'submitted'`, [a.id])) {
      if (b.what === 'evaluate') {
        if (settingsOf(a).aiMode === 'off') continue;
        const ev = db.get<EvalRow>('SELECT * FROM ai_evaluations WHERE attempt_id = ?', [t.id]);
        if (ev?.final || ev?.status === 'done' || ev?.status === 'running') continue;
        jobs.push(db.get<JobRow>('SELECT * FROM ai_jobs WHERE id = ?', [enqueue('evaluate', t, cls.school_id, null)])!);
      } else {
        for (const item of itemsOf(s, a.id, t.version).filter((i) => i.question.type === 'written')) {
          const g = db.get<GradeRow>('SELECT * FROM grades WHERE attempt_id = ? AND item_id = ?', [t.id, item.id]);
          if (typeof g?.score === 'number' || g?.suggestion_status === 'done' || g?.suggestion_status === 'running') continue;
          db.run('INSERT OR IGNORE INTO grades (attempt_id, item_id) VALUES (?, ?)', [t.id, item.id]);
          jobs.push(db.get<JobRow>('SELECT * FROM ai_jobs WHERE id = ?', [enqueue('grade_written', t, cls.school_id, item.id)])!);
        }
      }
    }
    const paused = s.budget(cls.school_id).state === 'paused';
    const items: { customId: string; request: JudgeRequest }[] = [];
    for (const job of jobs.filter((j) => j.status === 'queued')) {
      const req = requestFor(job);
      // Nothing to send (no chat, no answer): settled without the AI.
      if (!req) empty.push(job.id);
      else if (paused) {
        db.run(`UPDATE ai_jobs SET status = 'budget', batch_id = NULL WHERE id = ?`, [job.id]);
        setTarget(job, 'queued', 'Waiting: the school’s AI budget for this month is used up.');
      } else items.push({ customId: job.id, request: req });
    }
    for (const jid of empty) await runNow(jid);
    if (items.length) {
      try {
        const batchId = await ai.submitBatch(items);
        db.tx(() => items.forEach((i) => db.run(`UPDATE ai_jobs SET status = 'batch', batch_id = ? WHERE id = ?`, [batchId, i.customId])));
      } catch (err) {
        for (const i of items) finish(db.get<JobRow>('SELECT * FROM ai_jobs WHERE id = ?', [i.customId])!, 'failed', 'failed', err instanceof AiProviderError ? AI_ERROR_MESSAGE[err.kind] : 'The AI request failed.');
        throw new HttpError(502, 'ai_failed', err instanceof AiProviderError ? AI_ERROR_MESSAGE[err.kind] : 'The AI request failed.');
      }
    }
    return batchStatus(a.id);
  });

  s.route('GET', '/assessments/:id/batch', async (c, [id]) => {
    const { a } = assessmentFor(s, c, id!, 'teacher');
    await pollBatches();
    return batchStatus(a.id);
  });

  /** Releases results to students. Only fully marked submissions can be released. */
  s.route('POST', '/assessments/:id/release', (c, [id]) => {
    const { a, cls, user } = assessmentFor(s, c, id!, 'teacher');
    const b = s.parse(ReleaseBody, c.body);
    const attempts = db.all<AttemptRow>(`SELECT * FROM attempts WHERE assessment_id = ? AND status = 'submitted'`, [a.id]).filter((t) => !b.attemptIds || b.attemptIds.includes(t.id));
    let released = 0;
    const notReady: string[] = [];
    for (const t of attempts) {
      if (!b.release) {
        released += db.run('UPDATE attempts SET released_at = NULL WHERE id = ? AND released_at IS NOT NULL', [t.id]).changes;
        continue;
      }
      if (t.released_at) continue;
      if (totals(t, itemsOf(s, a.id, t.version)).score === null) {
        notReady.push(t.id);
        continue;
      }
      db.run('UPDATE attempts SET released_at = ? WHERE id = ?', [s.now(), t.id]);
      released++;
    }
    if (released) s.audit(user, cls.school_id, b.release ? 'results.released' : 'results.withdrawn', `${cls.name}: ${a.title}`, `${released} student${released === 1 ? '' : 's'}`);
    return { released, notReady: notReady.length };
  });

  s.route('GET', '/assessments/:id/overview', (c, [id]) => {
    const { a, cls } = assessmentFor(s, c, id!, 'teacher');
    const students = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM class_members WHERE class_id = ? AND role = 'student' AND status = 'active'`, [cls.id])!.n;
    const latest = db.all<AttemptRow>('SELECT t.* FROM attempts t WHERE t.assessment_id = ? AND t.number = (SELECT MAX(number) FROM attempts WHERE assessment_id = t.assessment_id AND user_id = t.user_id)', [a.id]);
    const submitted = latest.filter((t) => t.status === 'submitted');
    const items = itemsOf(s, a.id, a.version);
    const max = items.reduce((n, i) => n + i.points, 0);
    const scored = submitted.map((t) => totals(t, itemsOf(s, a.id, t.version))).filter((t) => t.score !== null);
    const buckets = [0, 0, 0, 0, 0];
    for (const t of scored) buckets[Math.min(4, Math.floor(((t.score ?? 0) / (t.max || 1)) * 5))]!++;
    const st = settingsOf(a);
    const finals = submitted.map((t) => json<EvaluationDto['final']>(db.get<EvalRow>('SELECT * FROM ai_evaluations WHERE attempt_id = ?', [t.id])?.final, null)).filter((f): f is NonNullable<EvaluationDto['final']> => !!f);
    return {
      assessmentId: a.id,
      completion: { students, started: latest.length, submitted: submitted.length, graded: scored.length, released: submitted.filter((t) => t.released_at).length },
      scores: { buckets, mean: scored.length ? round2(scored.reduce((n, t) => n + (t.score ?? 0), 0) / scored.length) : null, max },
      questions: items.map((item) => {
        const rows = submitted.filter((t) => t.version === a.version).map((t) => ({ r: json<Record<string, Response>>(t.responses, {})[item.id], g: db.get<GradeRow>('SELECT * FROM grades WHERE attempt_id = ? AND item_id = ?', [t.id, item.id]) }));
        const answered = rows.filter((x) => isAnswered(x.r));
        const marked = rows.filter((x) => typeof x.g?.score === 'number');
        const wrong = new Map<string, { count: number; misconception: string | null }>();
        if (isAutoGraded(item.question))
          for (const x of answered) {
            const res = json<{ correct: boolean | null; misconception: string | null } | null>(x.g?.auto_result, null);
            if (res?.correct !== false) continue;
            const key = responseText(item.question, x.r).slice(0, 120);
            wrong.set(key, { count: (wrong.get(key)?.count ?? 0) + 1, misconception: res.misconception });
          }
        return {
          itemId: item.id,
          position: item.position,
          type: item.question.type,
          answered: answered.length,
          correct: isAutoGraded(item.question) ? rows.filter((x) => json<{ correct: boolean | null } | null>(x.g?.auto_result, null)?.correct === true).length : null,
          meanScore: marked.length ? round2(marked.reduce((n, x) => n + (x.g!.score ?? 0), 0) / marked.length) : null,
          points: item.points,
          commonWrong: [...wrong.entries()].map(([answer, v]) => ({ answer, ...v })).sort((x, y) => y.count - x.count).slice(0, 3),
        };
      }),
      aiUse: { evaluated: finals.length, criteria: st.aiUseRubric.map((cr) => ({ criterionId: cr.id, label: cr.label, counts: [1, 2, 3, 4].map((l) => finals.filter((f) => f.levels[cr.id] === l).length) as [number, number, number, number] })) },
    } satisfies ClassOverviewDto;
  });

  const gradebook = (classId: string): GradebookDto => {
    const assessments = db.all<AssessmentRow>(`SELECT * FROM assessments WHERE class_id = ? AND status = 'published' ORDER BY created_at`, [classId]);
    const students = db.all<{ user_id: string; display_name: string }>(`SELECT m.user_id, u.display_name FROM class_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? AND m.role = 'student' AND m.status = 'active' ORDER BY u.display_name COLLATE NOCASE`, [classId]);
    const cells: GradebookDto['cells'] = {};
    for (const a of assessments) {
      for (const st of students) {
        const t = db.get<AttemptRow>('SELECT * FROM attempts WHERE assessment_id = ? AND user_id = ? ORDER BY number DESC LIMIT 1', [a.id, st.user_id]);
        if (!t) {
          cells[`${st.user_id}:${a.id}`] = { status: 'not_started', score: null, max: 0 };
          continue;
        }
        const tot = totals(t, itemsOf(s, a.id, t.version));
        cells[`${st.user_id}:${a.id}`] = { status: t.status === 'in_progress' ? 'in_progress' : t.released_at ? 'released' : tot.score !== null ? 'graded' : 'submitted', score: tot.score, max: tot.max };
      }
    }
    return {
      assessments: assessments.map((a) => ({ id: a.id, title: a.title, points: db.get<{ p: number | null }>('SELECT SUM(points) AS p FROM assessment_items WHERE assessment_id = ? AND version = ?', [a.id, a.version])!.p ?? 0, kind: settingsOf(a).kind })),
      students: students.map((x) => ({ id: x.user_id, displayName: x.display_name })),
      cells,
    };
  };

  s.route('GET', '/classes/:id/gradebook', (c, [id]) => {
    s.classFor(c, id!, 'teacher');
    return gradebook(id!);
  });

  /** The gradebook as CSV: exactly what the screen shows. Results of assessments, not report-card marks. */
  s.route('GET', '/classes/:id/gradebook/csv', (c, [id]) => {
    const { cls, user } = s.classFor(c, id!, 'teacher');
    const g = gradebook(cls.id);
    const label: Record<SubmissionRow['status'], string> = { not_started: 'Not started', in_progress: 'In progress', submitted: 'Submitted, not yet graded', graded: 'Graded', released: 'Released' };
    const rows: (string | number | null)[][] = [['Student', ...g.assessments.flatMap((a) => [`${a.title} (out of ${a.points})`, `${a.title}: status`])]];
    for (const st of g.students) rows.push([st.displayName, ...g.assessments.flatMap((a) => [g.cells[`${st.id}:${a.id}`]!.score, label[g.cells[`${st.id}:${a.id}`]!.status]])]);
    s.audit(user, cls.school_id, 'gradebook.exported', cls.name);
    return { filename: `${cls.name.replace(/[^\w-]+/g, '-').slice(0, 40) || 'class'}-gradebook-${s.now().slice(0, 10)}.csv`, csv: toCsv(rows) };
  });

  // ─────────── Comment bank ───────────

  s.route('GET', '/comment-bank', (c) => db.all<{ id: string; text: string }>('SELECT id, text FROM comment_bank WHERE user_id = ? ORDER BY created_at DESC', [s.requireRole(c, 'teacher', 'admin').id]));
  s.route('POST', '/comment-bank', (c) => {
    const u = s.requireRole(c, 'teacher', 'admin');
    const b = s.parse(CommentBankBody, c.body);
    if (db.get<{ n: number }>('SELECT COUNT(*) AS n FROM comment_bank WHERE user_id = ?', [u.id])!.n >= 200) throw new HttpError(409, 'full', 'The comment bank holds up to 200 comments.');
    const id = s.newId();
    db.run('INSERT INTO comment_bank (id, user_id, text, created_at) VALUES (?, ?, ?, ?)', [id, u.id, b.text, s.now()]);
    return { id, text: b.text };
  });
  s.route('DELETE', '/comment-bank/:id', (c, [id]) => {
    db.run('DELETE FROM comment_bank WHERE id = ? AND user_id = ?', [id!, s.requireRole(c, 'teacher', 'admin').id]);
    return { ok: true };
  });
}
