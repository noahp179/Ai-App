import { answerText, checkResponse, isRecognition } from '../../shared/study/checking';
import { subjectFor } from '../../shared/study/subjects';
import {
  ALT_LABEL,
  STEP_LABEL,
  type AltExplanation,
  type AnswerRecord,
  type Block,
  type CheckResult,
  type Difficulty,
  type LessonContent,
  type LessonMode,
  type LessonSession,
  type LessonStep,
  type LessonSummary,
  type Misconception,
  type Question,
  type Response,
  type StepKind,
  type StudentProfile,
} from '../../shared/study/types';
import type { CurriculumService } from '../curriculum/service';
import type { Db } from '../db/database';
import { json } from '../db/database';
import { type Clock, NotFoundError, UserError, newId } from '../util';
import { Rng, type PackCtx, type SkillPack } from './content/kit';
import { allMisconceptions, generateQuestion, levelsFor, skill, skillsFor } from './content/registry';
import { adaptDifficulty, startingDifficulty } from './mastery';
import type { ProgressStore } from './progress';

/** What the lesson needs from the AI layer. Implemented in ai.ts; absent or refusing when AI is not allowed. */
export interface LessonAi {
  lesson(student: StudentProfile, expectationId: string, mode: LessonMode, minutes: number | null): Promise<LessonContent>;
  alternative(student: StudentProfile, expectationId: string, kind: AltExplanation, about: string): Promise<Block[]>;
  writtenFeedback(student: StudentProfile, q: Question, text: string): Promise<CheckResult>;
}

interface PlannedStep {
  kind: StepKind;
  questions: number;
}

/** Which steps a lesson has, by mode and time available. Exported for tests. */
export function lessonPlan(mode: LessonMode, minutes: number | null, opts: { proficient: boolean; hasPrerequisites: boolean }): PlannedStep[] {
  const s = (kind: StepKind, questions = 0): PlannedStep => ({ kind, questions });
  switch (mode) {
    case 'full':
      return [s('objective'), s('prerequisites', opts.hasPrerequisites ? 2 : 1), s('explain'), s('worked_example'), s('guided', 2), s('independent', 3), s('check', 3), s('summary'), s('next')];
    case 'short':
      return [s('objective'), s('explain'), s('worked_example'), s('summary'), s('next')];
    case 'concept':
      return [s('objective'), s('explain'), s('worked_example'), s('guided', 1), s('summary'), s('next')];
    case 'practice':
      return [s('objective'), s('independent', 6), s('next')];
    case 'revision':
      return [s('objective'), s('summary'), s('worked_example'), s('independent', 4), s('check', 3), s('next')];
    case 'challenge':
      return [s('objective'), s('worked_example'), s('independent', 3), s('next')];
    case 'mistakes':
      return [s('objective'), s('explain'), s('guided', 2), s('independent', 2), s('check', 2), s('summary'), s('next')];
    case 'timed': {
      // About a minute and a half per question; the rest of the time goes to teaching.
      const m = minutes ?? 10;
      if (opts.proficient) return [s('objective'), s('independent', Math.max(2, Math.floor((m - 1) / 1.5) - 2)), s('check', 2), s('next')];
      if (m <= 5) return [s('objective'), s('explain'), s('guided', 1), s('check', 1), s('next')];
      if (m <= 10) return [s('objective'), s('explain'), s('worked_example'), s('guided', 1), s('independent', 2), s('check', 1), s('next')];
      if (m <= 20) return [s('objective'), s('prerequisites', 1), s('explain'), s('worked_example'), s('guided', 2), s('independent', 4), s('check', 2), s('summary'), s('next')];
      return [s('objective'), s('prerequisites', 2), s('explain'), s('worked_example'), s('guided', 3), s('independent', 6), s('check', 3), s('summary'), s('next')];
    }
  }
}

const SUPPORT_TEACH = ['Key Concepts', 'Examples', 'Note', 'Knowledge and skills', 'Instructional tips', 'Using spatial skills'];
const SUPPORT_PROMPTS = ['Sample questions', 'Teacher Prompts', 'Teacher prompts and Student Answers', 'Sample guiding questions', 'Sample Issues (EN only)', 'Sample tasks'];

interface LessonRow {
  id: string;
  student_id: string;
  data: string;
}

export interface AnswerOutcome {
  result: CheckResult;
  answer: string;
  solution: Block[];
  misconception: Misconception | null;
  difficulty: Difficulty;
  adaptReason: string;
  session: LessonSession;
}

export class LessonService {
  constructor(
    private readonly d: {
      db: Db;
      clock: Clock;
      curriculum: CurriculumService;
      progress: ProgressStore;
      ai: () => LessonAi | null;
      log: (studentId: string, kind: string, detail: string, refId: string | null, expectationId: string | null, seconds?: number) => void;
    },
  ) {}

  private get db() {
    return this.d.db;
  }
  private now() {
    return this.d.clock.now().toISOString();
  }

  private load(studentId: string, id: string): LessonSession {
    const r = this.db.get<LessonRow>('SELECT id, student_id, data FROM study_lessons WHERE id = ?', [id]);
    if (!r || r.student_id !== studentId) throw new NotFoundError('That lesson');
    return json<LessonSession>(r.data, null as never);
  }

  private save(studentId: string, s: LessonSession): LessonSession {
    s.updatedAt = this.now();
    this.db.run(
      `INSERT INTO study_lessons (id, student_id, expectation_id, mode, status, data, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, data = excluded.data, updated_at = excluded.updated_at, completed_at = excluded.completed_at`,
      [s.id, studentId, s.expectationId, s.mode, s.status, JSON.stringify(s), s.createdAt, s.updatedAt, s.completedAt],
    );
    return s;
  }

  list(studentId: string, opts: { status?: 'open' | 'completed' | 'all'; limit?: number } = {}): LessonSummary[] {
    const where = opts.status === 'open' ? "AND status IN ('active', 'paused')" : opts.status === 'completed' ? "AND status = 'completed'" : '';
    return this.db
      .all<{ data: string }>(`SELECT data FROM study_lessons WHERE student_id = ? ${where} ORDER BY updated_at DESC LIMIT ?`, [studentId, Math.min(opts.limit ?? 50, 500)])
      .map((r) => {
        const s = json<LessonSession>(r.data, null as never);
        return { id: s.id, expectationId: s.expectationId, title: s.content.title, mode: s.mode, status: s.status, stepIndex: s.stepIndex, steps: s.content.steps.length, source: s.content.source, updatedAt: s.updatedAt, completedAt: s.completedAt };
      });
  }

  get(studentId: string, id: string): LessonSession {
    return this.load(studentId, id);
  }

  /** Where a lesson for this expectation can come from, best first. */
  sources(student: StudentProfile, expectationId: string): { authored: boolean; ministry: boolean; ai: { ok: boolean; reason: string | null } } {
    const supports = this.d.curriculum.supportsOf(expectationId);
    return { authored: skillsFor(expectationId).length > 0, ministry: supports.length > 0, ai: this.aiStatus(student) };
  }

  aiStatus(student: StudentProfile): { ok: boolean; reason: string | null } {
    const ai = this.d.ai();
    if (!student.aiTutoring) return { ok: false, reason: 'AI tutoring is off in your profile.' };
    if (!ai) return { ok: false, reason: 'AI tutoring is not available (it is turned off in Settings, locked by a parent, or no AI provider is connected).' };
    return { ok: true, reason: null };
  }

  async start(student: StudentProfile, input: { expectationId: string; mode: LessonMode; minutes?: number | null; source?: 'auto' | 'authored' | 'ministry' | 'ai'; seed?: number }): Promise<LessonSession> {
    const exp = this.d.curriculum.find(input.expectationId);
    if (!exp) throw new NotFoundError('That curriculum expectation');
    if (exp.kind !== 'specific') throw new UserError('Lessons are made for specific expectations. Choose one of the numbered expectations under this one.');
    const minutes = input.mode === 'timed' ? ([5, 10, 20, 30].includes(Number(input.minutes)) ? Number(input.minutes) : 10) : null;
    const packs = skillsFor(exp.id);
    const want = input.source ?? 'auto';
    let content: LessonContent;
    const status = this.d.progress.status(student.id, exp.id);
    if ((want === 'auto' || want === 'authored') && packs.length) {
      content = this.authored(student, packs[0]!, exp.id, input.mode, minutes, input.seed ?? Date.now());
    } else if (want === 'ai' || (want === 'auto' && !packs.length && this.aiStatus(student).ok && student.aiTutoring)) {
      const ai = this.d.ai();
      if (!ai || !student.aiTutoring) throw new UserError(this.aiStatus(student).reason ?? 'AI tutoring is not available.', 'not_configured');
      content = await ai.lesson(student, exp.id, input.mode, minutes);
    } else if (want === 'authored') {
      throw new UserError('There is no offline lesson for this expectation yet.');
    } else {
      content = this.ministry(student, exp.id);
    }
    const allowed = packs[0] ? levelsFor(packs[0], exp.id) : ([1, 2, 3, 4] as Difficulty[]);
    const now = this.now();
    const session: LessonSession = {
      id: newId(),
      expectationId: exp.id,
      mode: input.mode,
      minutes,
      status: 'active',
      stepIndex: 0,
      content,
      answers: {},
      hints: {},
      masteryBefore: status,
      alternativesShown: [],
      difficulty: input.mode === 'challenge' ? (allowed.includes(4) ? 4 : allowed.at(-1)!) : startingDifficulty(status, allowed),
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      outcome: null,
    };
    this.prepareStep(student, session, 0);
    this.d.log(student.id, 'lesson_started', content.title, session.id, exp.id);
    return this.save(student.id, session);
  }

  // ─────────── Content ───────────

  private ctx(student: StudentProfile, expectationId: string): PackCtx {
    return { grade: student.grade, expectationId, simple: student.accessibility.simplifiedLanguage };
  }

  private objective(expectationId: string, goal: string, note: string | null): Block[] {
    const e = this.d.curriculum.find(expectationId)!;
    return [
      { kind: 'official', expectationId: e.id, index: e.index, course: e.courseLabel, html: e.html, url: e.url },
      { kind: 'p', text: `**Your goal:** ${goal}` },
      ...(note ? [{ kind: 'note', tone: 'source', text: note } as Block] : []),
    ];
  }

  private authored(student: StudentProfile, pack: SkillPack, expectationId: string, mode: LessonMode, minutes: number | null, seed: number): LessonContent {
    const ctx = this.ctx(student, expectationId);
    const mapping = pack.expectations.find((e) => e.id === expectationId)!;
    const status = this.d.progress.status(student.id, expectationId);
    const prereqs = this.d.progress.prerequisiteExpectations(expectationId);
    const plan = lessonPlan(mode, minutes, { proficient: status === 'proficient' || status === 'extension_ready', hasPrerequisites: prereqs.length > 0 });
    const rng = new Rng(seed >>> 0);
    const mistakes = mode === 'mistakes' ? this.recentMisconceptions(student.id, expectationId) : [];
    const steps: LessonStep[] = plan.map((p) => {
      const step: LessonStep = { kind: p.kind, title: STEP_LABEL[p.kind], blocks: [], questionIds: [], planned: p.questions || undefined };
      switch (p.kind) {
        case 'objective':
          step.blocks = this.objective(expectationId, pack.goal, `How FlowCompanion covers this: ${mapping.note}`);
          break;
        case 'prerequisites':
          step.title = 'Warm-up: what you already know';
          step.forExpectationId = prereqs[0] ?? null;
          step.blocks = [{ kind: 'p', text: prereqs.length ? 'A quick check of an earlier skill this lesson builds on. There’s no mark — it tells the lesson where to start.' : 'A quick warm-up question before we start.' }];
          break;
        case 'explain':
          step.blocks =
            mode === 'mistakes' && mistakes.length
              ? [{ kind: 'p', text: 'These mistakes came up in your recent answers. Here is what usually causes each one and how to fix it.' }, ...mistakes.flatMap((m) => [{ kind: 'note', tone: 'warn', text: `**${m.label}.** ${m.explanation}` } as Block, { kind: 'note', tone: 'tip', text: `**Fix:** ${m.fix}` } as Block]), ...pack.explain(ctx)]
              : pack.explain(ctx);
          break;
        case 'worked_example':
          step.blocks = pack.example(rng, ctx);
          break;
        case 'guided':
          step.blocks = [{ kind: 'p', text: 'Try this one. Hints are there if you need them; using them is fine while learning.' }];
          break;
        case 'independent':
          step.blocks = [{ kind: 'p', text: 'Now on your own. You can still ask for a hint, but try first — it shows what you can do independently.' }];
          break;
        case 'check':
          step.blocks = [{ kind: 'p', text: 'A short check. No hints here; this tells you and the app how secure the skill is.' }];
          break;
        case 'summary':
          step.blocks = [{ kind: 'list', items: pack.summary }];
          break;
        case 'next':
          step.blocks = [{ kind: 'p', text: 'Finish the lesson to see how it went and what to do next.' }];
          break;
      }
      return step;
    });
    return {
      title: pack.title,
      expectationId,
      skillId: pack.id,
      source: 'authored',
      provenance: 'Lesson written by FlowCompanion for this Ontario expectation. Questions are generated and their answers checked by code. Not reviewed by an Ontario teacher.',
      goal: pack.goal,
      steps,
      alternatives: pack.alternatives(ctx),
      questions: [],
      summary: pack.summary,
    };
  }

  /** An offline lesson built only from the Ministry's teacher supports for this expectation. */
  private ministry(student: StudentProfile, expectationId: string): LessonContent {
    const e = this.d.curriculum.find(expectationId)!;
    const supports = this.d.curriculum.supportsOf(expectationId);
    const teach = supports.filter((s) => SUPPORT_TEACH.includes(s.kind));
    const prompts = supports.filter((s) => SUPPORT_PROMPTS.includes(s.kind));
    const subject = subjectFor(e.documentTitle);
    const toBlock = (s: (typeof supports)[number]): Block => ({ kind: 'support', label: s.kind, html: s.html, omittedMedia: s.omittedMedia, url: e.url });
    const questions: Question[] = prompts.slice(0, 3).map((s, i) => ({
      id: `ministry:${expectationId}:${i}`,
      type: 'written',
      expectationId,
      skillId: null,
      difficulty: 2,
      cognitive: 'reasoning',
      prompt: [{ kind: 'p', text: 'Answer in your own words. These prompts come from the Ministry’s teacher supports for this expectation.' }, toBlock(s)],
      hints: ['Look back at the key concepts above.', 'Use an example from class or from your own life.'],
      solution: teach.length ? [{ kind: 'p', text: 'Compare your answer with the key concepts:' }, ...teach.slice(0, 1).map(toBlock)] : [{ kind: 'p', text: 'Check your answer with your teacher or class notes.' }],
      origin: 'ministry',
      keyVerified: false,
      rubric: subject.criteria,
      sampleAnswer: null,
      minWords: 15,
    }));
    const steps: LessonStep[] = [
      { kind: 'objective', title: STEP_LABEL.objective, blocks: this.objective(expectationId, `I can show what this expectation asks for: ${e.text.split('\n')[0]!.slice(0, 160)}${e.text.length > 160 ? '…' : ''}`, null), questionIds: [] },
      {
        kind: 'explain',
        title: 'From the Ontario curriculum',
        blocks: teach.length
          ? [{ kind: 'p', text: 'These notes are the Ministry of Education’s own teacher supports for this expectation, quoted as published.' }, ...teach.map(toBlock)]
          : [{ kind: 'p', text: 'The Ministry has not published key concepts for this expectation. Use your class notes, or an AI lesson if you have turned AI tutoring on.' }],
        questionIds: [],
      },
    ];
    if (questions.length) steps.push({ kind: 'guided', title: 'Think it through', blocks: [{ kind: 'p', text: 'Write an answer to each prompt, then rate it against the rubric. Your own ratings are not counted as proof of mastery.' }], questionIds: questions.map((q) => q.id) });
    steps.push({ kind: 'next', title: STEP_LABEL.next, blocks: [{ kind: 'p', text: 'Finish to save your work.' }], questionIds: [] });
    return {
      title: `${e.index}: ${e.title || e.courseLabel}`,
      expectationId,
      skillId: null,
      source: 'ministry',
      provenance: 'Built from the Ministry of Education’s teacher supports for this expectation, quoted without changes. FlowCompanion has not written a lesson for it, and nothing here is marked automatically.',
      goal: '',
      steps,
      alternatives: {},
      questions,
      summary: [],
    };
  }

  private recentMisconceptions(studentId: string, expectationId: string): Misconception[] {
    const all = allMisconceptions();
    const ids = this.db
      .all<{ misconception: string; n: number }>(
        'SELECT misconception, COUNT(*) AS n FROM study_evidence WHERE student_id = ? AND expectation_id = ? AND misconception IS NOT NULL AND correct = 0 GROUP BY misconception ORDER BY n DESC LIMIT 3',
        [studentId, expectationId],
      )
      .map((r) => r.misconception);
    return ids.map((id) => all.get(id)).filter((m): m is Misconception => !!m);
  }

  /** Generates the questions for a step when it is first opened, at the difficulty the lesson has reached. */
  private prepareStep(student: StudentProfile, s: LessonSession, index: number): void {
    const step = s.content.steps[index];
    if (!step || !step.planned || step.questionIds.length >= step.planned || s.content.source !== 'authored') return;
    const pack = skill(s.content.skillId ?? '');
    if (!pack) return;
    for (let i = step.questionIds.length; i < step.planned; i++) {
      let q: Question;
      const seed = (Date.parse(s.createdAt) + index * 1009 + i * 7919 + Object.keys(s.answers).length * 31) >>> 0;
      if (step.kind === 'prerequisites') {
        const pre = step.forExpectationId ? skillsFor(step.forExpectationId)[0] : null;
        q = pre ? generateQuestion(pre, step.forExpectationId!, i === 0 ? 1 : 2, seed, this.ctx(student, step.forExpectationId!)) : generateQuestion(pack, s.expectationId, 1, seed, this.ctx(student, s.expectationId));
      } else {
        const d: Difficulty = step.kind === 'guided' ? (Math.max(1, s.difficulty - 1) as Difficulty) : s.difficulty;
        q = generateQuestion(pack, s.expectationId, d, seed, this.ctx(student, s.expectationId));
      }
      s.content.questions.push(q);
      step.questionIds.push(q.id);
    }
  }

  // ─────────── Moving through a lesson ───────────

  goTo(student: StudentProfile, id: string, stepIndex: number): LessonSession {
    const s = this.load(student.id, id);
    if (s.status === 'completed') throw new UserError('This lesson is finished. Start it again to repeat it.');
    const i = Math.max(0, Math.min(s.content.steps.length - 1, Math.trunc(stepIndex)));
    s.stepIndex = i;
    s.status = 'active';
    this.prepareStep(student, s, i);
    return this.save(student.id, s);
  }

  pause(studentId: string, id: string): LessonSession {
    const s = this.load(studentId, id);
    if (s.status !== 'active') return s;
    s.status = 'paused';
    this.d.log(studentId, 'lesson_paused', s.content.title, s.id, s.expectationId);
    return this.save(studentId, s);
  }

  resume(student: StudentProfile, id: string): LessonSession {
    const s = this.load(student.id, id);
    if (s.status === 'completed') return s;
    s.status = 'active';
    this.prepareStep(student, s, s.stepIndex);
    return this.save(student.id, s);
  }

  abandon(studentId: string, id: string): void {
    const s = this.load(studentId, id);
    if (s.status === 'completed') return;
    s.status = 'abandoned';
    this.save(studentId, s);
  }

  /** Starts the same lesson again, with new questions. */
  async repeat(student: StudentProfile, id: string): Promise<LessonSession> {
    const s = this.load(student.id, id);
    return this.start(student, { expectationId: s.expectationId, mode: s.mode, minutes: s.minutes, source: s.content.source === 'authored' ? 'authored' : s.content.source === 'ai' ? 'ai' : 'ministry' });
  }

  hint(studentId: string, id: string, questionId: string): { hint: string | null; used: number; total: number } {
    const s = this.load(studentId, id);
    const q = s.content.questions.find((x) => x.id === questionId);
    if (!q) throw new NotFoundError('That question');
    const step = s.content.steps.find((st) => st.questionIds.includes(questionId));
    if (step?.kind === 'check') throw new UserError('Hints are not available in the quick check.');
    const used = Math.min(q.hints.length, (s.hints[questionId] ?? 0) + 1);
    s.hints[questionId] = used;
    this.save(studentId, s);
    return { hint: q.hints[used - 1] ?? null, used, total: q.hints.length };
  }

  async answer(student: StudentProfile, id: string, questionId: string, response: Response, opts: { seconds?: number | null; aiFeedback?: boolean } = {}): Promise<AnswerOutcome> {
    const s = this.load(student.id, id);
    if (s.status === 'completed') throw new UserError('This lesson is finished.');
    const q = s.content.questions.find((x) => x.id === questionId);
    if (!q) throw new NotFoundError('That question');
    let result = checkResponse(q, response);
    if (q.type === 'written' && opts.aiFeedback && !result.unreadable) {
      const ai = this.d.ai();
      if (ai && student.aiTutoring) result = await ai.writtenFeedback(student, q, (response as { text: string }).text);
    }
    const hints = s.hints[questionId] ?? 0;
    const prev = s.answers[questionId];
    const record: AnswerRecord = { questionId, response, result, hintsUsed: hints, attempts: (prev?.attempts ?? 0) + 1, at: this.now(), seconds: opts.seconds ?? null };
    s.answers[questionId] = record;
    const step = s.content.steps.find((st) => st.questionIds.includes(questionId));
    // Only the first readable attempt is evidence; later tries come after seeing feedback.
    if (!prev && !result.unreadable && result.correct !== null) {
      const evidenceFor = step?.kind === 'prerequisites' && step.forExpectationId ? step.forExpectationId : q.expectationId;
      this.d.progress.add(student.id, evidenceFor, {
        at: record.at,
        correct: result.correct,
        score: result.score,
        difficulty: q.difficulty,
        cognitive: isRecognition(q) ? 'recognition' : q.cognitive,
        hinted: hints > 0 || step?.kind === 'guided',
        // Code-checked keys are full evidence; AI-written keys or AI-marked answers count for less.
        weight: q.keyVerified ? 1 : 0.4,
        source: step?.kind === 'prerequisites' ? 'diagnostic' : 'lesson',
        misconception: result.misconception,
        sourceId: s.id,
        questionId: q.id,
      });
    }
    if (result.unreadable && !prev) delete s.answers[questionId];
    const history = s.content.questions
      .filter((x) => s.answers[x.id] && x.expectationId === s.expectationId)
      .map((x) => ({ correct: s.answers[x.id]!.result.correct, hinted: s.answers[x.id]!.hintsUsed > 0, difficulty: x.difficulty }));
    const pack = skill(s.content.skillId ?? '');
    const adapt = adaptDifficulty(s.difficulty, history, pack ? levelsFor(pack, s.expectationId) : [1, 2, 3, 4]);
    s.difficulty = adapt.difficulty;
    this.save(student.id, s);
    const misconception = result.misconception ? (allMisconceptions().get(result.misconception) ?? null) : null;
    return { result, answer: answerText(q), solution: q.solution, misconception, difficulty: s.difficulty, adaptReason: adapt.reason, session: s };
  }

  /** Adds another question like this one (same step, current difficulty) — "try a similar question". */
  similar(student: StudentProfile, id: string, questionId: string): LessonSession {
    const s = this.load(student.id, id);
    const q = s.content.questions.find((x) => x.id === questionId);
    const pack = skill(q?.skillId ?? '');
    if (!q || !pack) throw new UserError('There is no similar question for this one.');
    const step = s.content.steps.find((st) => st.questionIds.includes(questionId))!;
    if (step.questionIds.length >= 12) throw new UserError('That’s plenty of practice for one step. Move on and come back later.');
    const d = step.kind === 'prerequisites' ? q.difficulty : s.difficulty;
    const nq = generateQuestion(pack, q.expectationId, d, (Date.now() + step.questionIds.length * 7919) >>> 0, this.ctx(student, q.expectationId));
    s.content.questions.push(nq);
    step.questionIds.splice(step.questionIds.indexOf(questionId) + 1, 0, nq.id);
    if (step.planned) step.planned++;
    return this.save(student.id, s);
  }

  /** A different explanation. Authored alternatives first; the AI writes one when allowed and none exists. */
  async explainAgain(student: StudentProfile, id: string, kind: AltExplanation): Promise<{ blocks: Block[]; source: 'authored' | 'ai'; label: string }> {
    const s = this.load(student.id, id);
    const pack = skill(s.content.skillId ?? '');
    let blocks: Block[] | undefined;
    let source: 'authored' | 'ai' = 'authored';
    if (kind === 'example' && pack) blocks = pack.example(new Rng((Date.now() + s.alternativesShown.length) >>> 0), this.ctx(student, s.expectationId));
    else blocks = s.content.alternatives[kind];
    if (!blocks?.length) {
      const ai = this.d.ai();
      if (!ai || !student.aiTutoring) throw new UserError(`There is no “${ALT_LABEL[kind].toLowerCase()}” explanation written for this lesson. ${this.aiStatus(student).reason ?? ''}`.trim());
      const step = s.content.steps[s.stepIndex];
      blocks = await ai.alternative(student, s.expectationId, kind, step ? step.blocks.map((b) => ('text' in b ? b.text : '')).join(' ').slice(0, 1500) : s.content.title);
      source = 'ai';
    }
    s.alternativesShown.push(kind);
    this.save(student.id, s);
    return { blocks, source, label: ALT_LABEL[kind] };
  }

  complete(student: StudentProfile, id: string): LessonSession {
    const s = this.load(student.id, id);
    if (s.status === 'completed') return s;
    const own = s.content.questions.filter((q) => q.expectationId === s.expectationId && s.answers[q.id]);
    const marked = own.filter((q) => s.answers[q.id]!.result.correct !== null);
    const correct = marked.filter((q) => s.answers[q.id]!.result.correct).length;
    const independent = marked.filter((q) => s.answers[q.id]!.result.correct && s.answers[q.id]!.hintsUsed === 0 && s.content.steps.find((st) => st.questionIds.includes(q.id))?.kind !== 'guided').length;
    const hints = own.reduce((a, q) => a + s.answers[q.id]!.hintsUsed, 0);
    if (marked.length) this.d.progress.scheduleReview(student.id, s.expectationId, independent / marked.length);
    const after = this.d.progress.get(student.id, s.expectationId);
    s.outcome = {
      correct,
      answered: own.length,
      independentCorrect: independent,
      hintsUsed: hints,
      masteryBefore: s.masteryBefore,
      masteryAfter: after.status,
      recommendation: this.d.progress.recommend(student.id, s.expectationId),
    };
    s.status = 'completed';
    s.completedAt = this.now();
    s.stepIndex = s.content.steps.length - 1;
    const seconds = Math.min(3 * 3600, Math.max(0, (Date.parse(s.completedAt) - Date.parse(s.createdAt)) / 1000));
    this.d.log(student.id, 'lesson_completed', s.content.title, s.id, s.expectationId, Math.round(seconds));
    return this.save(student.id, s);
  }

  deleteAll(studentId: string): void {
    this.db.run('DELETE FROM study_lessons WHERE student_id = ?', [studentId]);
  }
}
