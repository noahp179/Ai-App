import { answerText, checkResponse, isRecognition } from '../../shared/study/checking';
import {
  QUIZ_KIND_LABEL,
  type CheckResult,
  type Difficulty,
  type Misconception,
  type Question,
  type QuizAttempt,
  type QuizItem,
  type QuizKind,
  type QuizSettings,
  type QuizSummary,
  type Response,
  type StudentProfile,
} from '../../shared/study/types';
import type { CurriculumService } from '../curriculum/service';
import type { Db } from '../db/database';
import { json } from '../db/database';
import { type Clock, NotFoundError, UserError, newId } from '../util';
import { allMisconceptions, generateQuestion, levelsFor, skill, skillsFor } from './content/registry';
import { adaptDifficulty, startingDifficulty } from './mastery';
import type { ProgressStore } from './progress';

export interface QuizAi {
  questions(student: StudentProfile, expectationId: string, count: number, opts: { difficulty: Difficulty | 'mixed'; purpose: string }): Promise<Question[]>;
  writtenFeedback(student: StudentProfile, q: Question, text: string): Promise<CheckResult>;
}

/** The rules for each kind of quiz. Students see these before they start. */
export function defaultSettings(kind: QuizKind, o: { length?: number; timed?: boolean; minutes?: number | null } = {}): QuizSettings {
  const length = Math.max(1, Math.min(30, Math.trunc(o.length ?? 5)));
  switch (kind) {
    case 'diagnostic':
      return { length, timed: false, minutes: null, hints: false, feedback: 'end', adaptive: false };
    case 'summative_practice':
      return { length, timed: !!o.timed, minutes: o.timed ? Math.max(5, Math.min(180, o.minutes ?? length * 2)) : null, hints: false, feedback: 'end', adaptive: false };
    case 'unit_review':
      return { length, timed: false, minutes: null, hints: true, feedback: 'immediate', adaptive: false };
    case 'reflection':
      throw new UserError('Self-reflections are recorded on the Progress page, not as a quiz.');
    default:
      return { length, timed: false, minutes: null, hints: true, feedback: 'immediate', adaptive: true };
  }
}

const SOURCE_FOR: Record<QuizKind, 'quiz' | 'diagnostic' | 'assessment'> = {
  practice: 'quiz',
  pop: 'quiz',
  diagnostic: 'diagnostic',
  formative: 'quiz',
  unit_review: 'assessment',
  summative_practice: 'assessment',
  reflection: 'quiz',
};

export interface QuizAnswerOutcome {
  /** Null while feedback is held back until the end. */
  result: CheckResult | null;
  answer: string | null;
  solution: Question['solution'] | null;
  misconception: Misconception | null;
  adaptReason: string | null;
  attempt: QuizAttempt;
}

export class QuizService {
  constructor(
    private readonly d: {
      db: Db;
      clock: Clock;
      curriculum: CurriculumService;
      progress: ProgressStore;
      ai: () => QuizAi | null;
      log: (studentId: string, kind: string, detail: string, refId: string | null, expectationId: string | null, seconds?: number) => void;
    },
  ) {}

  private get db() {
    return this.d.db;
  }
  private now() {
    return this.d.clock.now().toISOString();
  }

  private load(studentId: string, id: string): QuizAttempt {
    const r = this.db.get<{ student_id: string; data: string }>('SELECT student_id, data FROM study_quizzes WHERE id = ?', [id]);
    if (!r || r.student_id !== studentId) throw new NotFoundError('That quiz');
    return json<QuizAttempt>(r.data, null as never);
  }

  private save(studentId: string, a: QuizAttempt): QuizAttempt {
    this.db.run(
      `INSERT INTO study_quizzes (id, student_id, kind, status, data, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, data = excluded.data, finished_at = excluded.finished_at`,
      [a.id, studentId, a.kind, a.status, JSON.stringify(a), a.startedAt, a.finishedAt],
    );
    return a;
  }

  private ctx(student: StudentProfile, expectationId: string) {
    return { grade: student.grade, expectationId, simple: student.accessibility.simplifiedLanguage };
  }

  /**
   * Builds a quiz. Expectations with authored packs get generated, code-checked questions; others get AI
   * questions only when the student allows AI, and are otherwise left out (and listed as skipped).
   */
  async create(
    student: StudentProfile,
    input: { kind: QuizKind; expectationIds: string[]; length?: number; timed?: boolean; minutes?: number | null; title?: string; questions?: Question[]; assessmentId?: string | null; useAi?: boolean },
  ): Promise<QuizAttempt> {
    if (!Array.isArray(input.expectationIds) || !input.expectationIds.length) throw new UserError('Choose at least one expectation to practise.');
    const ids = [...new Set(input.expectationIds)].slice(0, 40);
    for (const id of ids) if (!this.d.curriculum.find(id)) throw new NotFoundError('A curriculum expectation');
    const settings = defaultSettings(input.kind, { length: input.length ?? input.questions?.length, timed: input.timed, minutes: input.minutes });
    if (settings.timed && settings.minutes && student.accessibility.extraTime) settings.minutes = Math.round(settings.minutes * 1.5);
    const skipped: string[] = [];
    let questions: Question[] = input.questions ? [...input.questions] : [];
    if (!input.questions) {
      const offline = ids.filter((id) => skillsFor(id).length);
      const online = ids.filter((id) => !skillsFor(id).length);
      const ai = this.d.ai();
      const aiOk = !!ai && student.aiTutoring && input.useAi !== false;
      const useIds = [...offline, ...(aiOk ? online : [])];
      if (!aiOk) skipped.push(...online);
      if (!useIds.length) {
        throw new UserError(
          online.length && !aiOk
            ? 'There are no offline questions for these expectations yet. Turn on AI tutoring in your profile to practise them with AI-written questions, or choose math expectations with offline practice.'
            : 'Nothing to practise.',
        );
      }
      const per = new Map<string, number>();
      for (let i = 0; i < settings.length; i++) per.set(useIds[i % useIds.length]!, (per.get(useIds[i % useIds.length]!) ?? 0) + 1);
      const seedBase = Date.now() >>> 0;
      for (const [eid, n] of per) {
        const pack = skillsFor(eid)[0];
        if (pack) {
          const allowed = levelsFor(pack, eid);
          const start = startingDifficulty(this.d.progress.status(student.id, eid), allowed);
          for (let k = 0; k < n; k++) {
            const d = input.kind === 'diagnostic' ? allowed[k % allowed.length]! : input.kind === 'summative_practice' || input.kind === 'unit_review' ? allowed[Math.min(allowed.length - 1, k % 3)]! : start;
            questions.push(generateQuestion(pack, eid, d, (seedBase + questions.length * 104729) >>> 0, this.ctx(student, eid)));
          }
        } else if (aiOk) {
          questions.push(...(await ai!.questions(student, eid, n, { difficulty: 'mixed', purpose: QUIZ_KIND_LABEL[input.kind] })).slice(0, n));
        }
      }
      // Interleave expectations rather than blocking them.
      questions = interleave(questions);
    }
    const now = this.now();
    const attempt: QuizAttempt = {
      id: newId(),
      kind: input.kind,
      title: input.title?.trim().slice(0, 120) || `${QUIZ_KIND_LABEL[input.kind]}: ${ids.map((i) => this.d.curriculum.find(i)?.index ?? '').join(', ')}`.slice(0, 120),
      expectationIds: ids,
      settings: { ...settings, length: questions.length },
      status: 'active',
      items: questions.map((q, i) => ({ id: newId(), position: i, question: q, answer: null })),
      startedAt: now,
      finishedAt: null,
      deadlineAt: settings.timed && settings.minutes ? new Date(this.d.clock.now().getTime() + settings.minutes * 60_000).toISOString() : null,
      score: null,
      maxScore: null,
      hasUnverifiedKeys: questions.some((q) => !q.keyVerified && q.type !== 'written'),
      assessmentId: input.assessmentId ?? null,
      hints: {},
      skipped,
    };
    this.d.log(student.id, 'quiz_started', attempt.title, attempt.id, ids[0] ?? null);
    return this.save(student.id, attempt);
  }

  /** The attempt as the student may see it: answer keys stay hidden while the quiz is open. */
  view(a: QuizAttempt): QuizAttempt {
    if (a.status !== 'active') return a;
    return { ...a, items: a.items.map((it) => ({ ...it, question: it.answer && a.settings.feedback === 'immediate' ? it.question : redact(it.question), answer: it.answer && a.settings.feedback === 'end' ? { ...it.answer, result: { ...it.answer.result, correct: null, feedback: 'Saved. Feedback comes at the end.', misconception: null, score: 0 } } : it.answer })) };
  }

  get(studentId: string, id: string): QuizAttempt {
    const a = this.load(studentId, id);
    if (a.status === 'active' && a.deadlineAt && new Date(a.deadlineAt) <= this.d.clock.now()) return this.finishAttempt(studentId, a, 'time');
    return a;
  }

  hint(studentId: string, id: string, itemId: string): { hint: string | null; used: number; total: number } {
    const a = this.get(studentId, id);
    if (a.status !== 'active') throw new UserError('This quiz is finished.');
    if (!a.settings.hints) throw new UserError('Hints are not available in this kind of quiz.');
    const it = a.items.find((x) => x.id === itemId);
    if (!it) throw new NotFoundError('That question');
    if (it.answer) throw new UserError('You have already answered this question.');
    const used = Math.min(it.question.hints.length, (a.hints[itemId] ?? 0) + 1);
    a.hints[itemId] = used;
    this.save(studentId, a);
    return { hint: it.question.hints[used - 1] ?? null, used, total: it.question.hints.length };
  }

  async answer(student: StudentProfile, id: string, itemId: string, response: Response, opts: { seconds?: number | null; aiFeedback?: boolean } = {}): Promise<QuizAnswerOutcome> {
    const a = this.get(student.id, id);
    if (a.status !== 'active') throw new UserError(a.deadlineAt && a.finishedAt && a.finishedAt >= a.deadlineAt ? 'Time is up. Your answers so far have been saved.' : 'This quiz is finished.');
    const it = a.items.find((x) => x.id === itemId);
    if (!it) throw new NotFoundError('That question');
    if (it.answer) throw new UserError('You have already answered this question.');
    const q = it.question;
    let result = checkResponse(q, response);
    if (result.unreadable) return { result, answer: null, solution: null, misconception: null, adaptReason: null, attempt: this.view(a) };
    if (q.type === 'written' && opts.aiFeedback) {
      const ai = this.d.ai();
      if (ai && student.aiTutoring) result = await ai.writtenFeedback(student, q, (response as { text: string }).text);
    }
    const hints = a.hints[itemId] ?? 0;
    it.answer = { questionId: q.id, response, result, hintsUsed: hints, attempts: 1, at: this.now(), seconds: opts.seconds ?? null };
    if (result.correct !== null) {
      this.d.progress.add(student.id, q.expectationId, {
        at: it.answer.at,
        correct: result.correct,
        score: result.score,
        difficulty: q.difficulty,
        cognitive: isRecognition(q) ? 'recognition' : q.cognitive,
        hinted: hints > 0,
        weight: q.keyVerified ? 1 : 0.4,
        source: SOURCE_FOR[a.kind],
        misconception: result.misconception,
        sourceId: a.id,
        questionId: q.id,
      });
    }
    let adaptReason: string | null = null;
    if (a.settings.adaptive && q.skillId) {
      const pack = skill(q.skillId)!;
      const history = a.items.filter((x) => x.answer && x.question.expectationId === q.expectationId).map((x) => ({ correct: x.answer!.result.correct, hinted: (a.hints[x.id] ?? 0) > 0, difficulty: x.question.difficulty }));
      const adapt = adaptDifficulty(q.difficulty, history, levelsFor(pack, q.expectationId));
      adaptReason = adapt.reason;
      if (adapt.difficulty !== q.difficulty) {
        // Regenerate the remaining unanswered questions for this expectation at the new level.
        for (const later of a.items.filter((x) => !x.answer && x.question.expectationId === q.expectationId && x.question.skillId === q.skillId)) {
          later.question = generateQuestion(pack, q.expectationId, adapt.difficulty, (Date.now() + later.position * 7919) >>> 0, this.ctx(student, q.expectationId));
        }
      }
    }
    this.save(student.id, a);
    const immediate = a.settings.feedback === 'immediate';
    return {
      result: immediate ? result : null,
      answer: immediate ? answerText(q) : null,
      solution: immediate ? q.solution : null,
      misconception: immediate && result.misconception ? (allMisconceptions().get(result.misconception) ?? null) : null,
      adaptReason: immediate ? adaptReason : null,
      attempt: this.view(a),
    };
  }

  finish(studentId: string, id: string): QuizAttempt {
    const a = this.load(studentId, id);
    if (a.status !== 'active') return a;
    return this.finishAttempt(studentId, a, 'student');
  }

  private finishAttempt(studentId: string, a: QuizAttempt, by: 'student' | 'time'): QuizAttempt {
    const marked = a.items.filter((it) => it.answer && it.answer.result.correct !== null);
    const markable = a.items.filter((it) => it.question.type !== 'written');
    a.score = Math.round(marked.reduce((s, it) => s + it.answer!.result.score, 0) * 100) / 100;
    a.maxScore = markable.length;
    a.status = 'completed';
    a.finishedAt = by === 'time' && a.deadlineAt ? a.deadlineAt : this.now();
    for (const eid of a.expectationIds) {
      const items = marked.filter((it) => it.question.expectationId === eid);
      if (!items.length) continue;
      const independent = items.filter((it) => it.answer!.result.correct && it.answer!.hintsUsed === 0).length;
      this.d.progress.scheduleReview(studentId, eid, independent / items.length);
    }
    const seconds = Math.min(3 * 3600, Math.max(0, (Date.parse(a.finishedAt) - Date.parse(a.startedAt)) / 1000));
    this.d.log(studentId, 'quiz_completed', `${a.title} — ${a.score} / ${a.maxScore}${by === 'time' ? ' (time ran out)' : ''}`, a.id, a.expectationIds[0] ?? null, Math.round(seconds));
    return this.save(studentId, a);
  }

  abandon(studentId: string, id: string): void {
    const a = this.load(studentId, id);
    if (a.status !== 'active') return;
    a.status = 'abandoned';
    a.finishedAt = this.now();
    this.save(studentId, a);
  }

  list(studentId: string, limit = 50): QuizSummary[] {
    return this.db
      .all<{ data: string }>('SELECT data FROM study_quizzes WHERE student_id = ? ORDER BY started_at DESC LIMIT ?', [studentId, Math.min(limit, 500)])
      .map((r) => summarize(json<QuizAttempt>(r.data, null as never)));
  }

  deleteAll(studentId: string): void {
    this.db.run('DELETE FROM study_quizzes WHERE student_id = ?', [studentId]);
  }
}

export function summarize(a: QuizAttempt): QuizSummary {
  const answered = a.items.filter((it) => it.answer);
  return {
    id: a.id,
    kind: a.kind,
    title: a.title,
    status: a.status,
    questions: a.items.length,
    answered: answered.length,
    correct: answered.filter((it) => it.answer!.result.correct).length,
    score: a.score,
    maxScore: a.maxScore,
    startedAt: a.startedAt,
    finishedAt: a.finishedAt,
    hintsUsed: Object.values(a.hints).reduce((s, n) => s + n, 0),
  };
}

/** Removes everything that would give the answer away before the student answers. */
export function redact(q: Question): Question {
  const base = { ...q, solution: [], knownWrong: [], params: undefined } as Question;
  switch (base.type) {
    case 'multiple_choice':
      return { ...base, answer: '' };
    case 'multiple_select':
      return { ...base, answers: [] };
    case 'true_false':
      return { ...base, answer: false };
    case 'numeric':
    case 'expression':
    case 'code_trace':
      return { ...base, answer: '' };
    case 'short_answer':
      return { ...base, accepted: [], keywords: [] };
    case 'fill_blank':
      return { ...base, blanks: base.blanks.map(() => ({ accepted: [] })) };
    case 'matching':
      return { ...base, pairs: {} };
    case 'ordering':
      return { ...base, order: [] };
    case 'written':
      return { ...base, sampleAnswer: null };
  }
}

function interleave(qs: Question[]): Question[] {
  const groups = new Map<string, Question[]>();
  for (const q of qs) groups.set(q.expectationId, [...(groups.get(q.expectationId) ?? []), q]);
  const out: Question[] = [];
  const lists = [...groups.values()];
  for (let i = 0; out.length < qs.length; i++) for (const l of lists) if (l[i]) out.push(l[i]!);
  return out;
}

export type { QuizItem };
