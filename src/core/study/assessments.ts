import { z } from 'zod';
import { answerText } from '../../shared/study/checking';
import { RUBRIC_NOTE, subjectFor } from '../../shared/study/subjects';
import { QUESTION_TYPES, QUESTION_TYPE_LABEL, type Assessment, type AssessmentItem, type Block, type Difficulty, type Question, type StudentProfile } from '../../shared/study/types';
import type { CurriculumService } from '../curriculum/service';
import type { Db } from '../db/database';
import { json } from '../db/database';
import { type Clock, NotFoundError, UserError, cleanLine, newId } from '../util';
import { generateQuestion, levelsFor, skillsFor } from './content/registry';
import type { QuizAi } from './quizzes';

/**
 * Practice assessments built from verified curriculum expectations. Objective questions from authored packs have
 * answer keys checked by code; AI-written questions are marked unreviewed until a person reviews them. Nothing
 * here is an official Ontario assessment.
 */

export const AssessmentInput = z.object({
  title: z.string().trim().min(1, 'Give the assessment a title.').max(200),
  expectationIds: z.array(z.string().max(120)).min(1, 'Choose at least one expectation.').max(40),
  format: z.enum(['quiz', 'test', 'assignment']).default('quiz'),
  questionCount: z.number().int().min(1).max(40).default(10),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal('mixed')]).default('mixed'),
  questionTypes: z.array(z.enum(QUESTION_TYPES)).max(QUESTION_TYPES.length).default([]),
  timeLimitMinutes: z.number().int().min(5).max(240).nullable().default(null),
  includeWritten: z.boolean().default(false),
  useAi: z.boolean().default(false),
  instructions: z.string().max(2000).default(''),
});

export class AssessmentService {
  constructor(
    private readonly d: {
      db: Db;
      clock: Clock;
      curriculum: CurriculumService;
      ai: () => QuizAi | null;
    },
  ) {}

  private get db() {
    return this.d.db;
  }
  private now() {
    return this.d.clock.now().toISOString();
  }

  private load(owner: string | null, id: string): Assessment {
    const r = this.db.get<{ owner_student_id: string | null; data: string }>('SELECT owner_student_id, data FROM study_assessments WHERE id = ?', [id]);
    if (!r || (r.owner_student_id !== null && r.owner_student_id !== owner)) throw new NotFoundError('That assessment');
    return json<Assessment>(r.data, null as never);
  }

  private save(owner: string | null, a: Assessment): Assessment {
    a.updatedAt = this.now();
    this.db.run(
      `INSERT INTO study_assessments (id, owner_student_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      [a.id, owner, JSON.stringify(a), a.createdAt, a.updatedAt],
    );
    return a;
  }

  /** Shared library assessments plus the student's own. */
  list(owner: string | null): Assessment[] {
    return this.db
      .all<{ data: string }>('SELECT data FROM study_assessments WHERE owner_student_id IS NULL OR owner_student_id = ? ORDER BY updated_at DESC', [owner])
      .map((r) => json<Assessment>(r.data, null as never));
  }

  get(owner: string | null, id: string): Assessment {
    return this.load(owner, id);
  }

  async build(owner: string | null, student: StudentProfile | null, input: unknown): Promise<{ assessment: Assessment; skipped: string[] }> {
    const d = AssessmentInput.parse(input ?? {});
    const exps = d.expectationIds.map((id) => {
      const e = this.d.curriculum.find(id);
      if (!e) throw new NotFoundError('A curriculum expectation');
      if (e.kind !== 'specific') throw new UserError(`${e.index} is an overall expectation. Choose specific expectations.`);
      return e;
    });
    const grades = [...new Set(exps.flatMap((e) => e.grades))];
    const courses = [...new Set(exps.map((e) => e.courseId))];
    const subject = subjectFor(exps[0]!.documentTitle);
    const items: AssessmentItem[] = [];
    const skipped: string[] = [];
    const ai = this.d.ai();
    const offline = exps.filter((e) => skillsFor(e.id).length);
    const online = exps.filter((e) => !skillsFor(e.id).length);
    const usable = [...offline, ...(d.useAi ? online : [])];
    if (!d.useAi) skipped.push(...online.map((e) => e.id));
    if (!usable.length) throw new UserError('None of these expectations have offline questions. Turn on “Use AI for expectations without offline questions”, or choose math expectations with offline practice.');
    if (d.useAi && online.length && (!ai || (student && !student.aiTutoring))) throw new UserError('AI is not available for this, so expectations without offline questions cannot be included.');
    const per = new Map<string, number>();
    for (let i = 0; i < d.questionCount; i++) per.set(usable[i % usable.length]!.id, (per.get(usable[i % usable.length]!.id) ?? 0) + 1);
    let seed = Date.now() >>> 0;
    for (const [eid, n] of per) {
      const pack = skillsFor(eid)[0];
      if (pack) {
        const levels = levelsFor(pack, eid);
        for (let k = 0; k < n; k++) {
          const want: Difficulty = d.difficulty === 'mixed' ? levels[k % levels.length]! : d.difficulty;
          let q: Question | null = null;
          for (let tries = 0; tries < 8 && !q; tries++) {
            const cand = generateQuestion(pack, eid, want, (seed += 104729), { grade: student?.grade ?? exps[0]!.grades[0] ?? 7 });
            if (!d.questionTypes.length || d.questionTypes.includes(cand.type)) q = cand;
          }
          if (q) items.push({ id: newId(), question: q, points: q.difficulty >= 3 ? 2 : 1, reviewed: true });
        }
      } else if (ai && student) {
        const qs = await ai.questions(student, eid, n, { difficulty: d.difficulty, purpose: `${d.format} practice assessment` });
        for (const q of qs.slice(0, n)) items.push({ id: newId(), question: q, points: 1, reviewed: false });
      }
    }
    if (d.includeWritten) {
      items.push({
        id: newId(),
        points: 4,
        reviewed: true,
        question: {
          id: newId(),
          type: 'written',
          expectationId: exps[0]!.id,
          skillId: null,
          difficulty: 3,
          cognitive: 'reasoning',
          prompt: [{ kind: 'p', text: `Explain, in your own words and with an example, how you would show this expectation: ${exps[0]!.text.split('\n')[0]!.slice(0, 300)}` }],
          hints: ['Use the vocabulary from the lessons.', 'Give one worked example or piece of evidence.'],
          solution: [{ kind: 'note', tone: 'source', text: RUBRIC_NOTE }],
          origin: 'authored',
          keyVerified: false,
          rubric: subject.criteria,
          sampleAnswer: null,
          minWords: 30,
        },
      });
    }
    if (!items.length) throw new UserError('No questions could be generated for that combination. Try allowing more question types.');
    const now = this.now();
    const origin = items.every((i) => i.question.origin !== 'ai') ? 'generated' : items.every((i) => i.question.origin === 'ai') ? 'ai' : 'mixed';
    const a: Assessment = {
      id: newId(),
      title: cleanLine(d.title, 200),
      grade: grades.length === 1 ? (grades[0] as Assessment['grade']) : null,
      courseId: courses.length === 1 ? courses[0]! : null,
      expectationIds: exps.map((e) => e.id),
      format: d.format,
      difficulty: d.difficulty,
      questionTypes: [...new Set(items.map((i) => i.question.type))],
      timeLimitMinutes: d.timeLimitMinutes,
      items,
      rubric: subject.criteria,
      instructions: d.instructions,
      status: 'draft',
      origin,
      createdAt: now,
      updatedAt: now,
    };
    return { assessment: this.save(owner, a), skipped };
  }

  /** Marks one item as reviewed (or not). AI items must be reviewed before the assessment is marked reviewed. */
  review(owner: string | null, id: string, itemId: string, reviewed: boolean): Assessment {
    const a = this.load(owner, id);
    const it = a.items.find((x) => x.id === itemId);
    if (!it) throw new NotFoundError('That question');
    it.reviewed = reviewed;
    if (!reviewed) a.status = 'draft';
    return this.save(owner, a);
  }

  markReviewed(owner: string | null, id: string): Assessment {
    const a = this.load(owner, id);
    const pending = a.items.filter((i) => !i.reviewed).length;
    if (pending) throw new UserError(`${pending} question${pending === 1 ? ' still needs' : 's still need'} reviewing first.`);
    a.status = 'reviewed';
    return this.save(owner, a);
  }

  removeItem(owner: string | null, id: string, itemId: string): Assessment {
    const a = this.load(owner, id);
    if (a.items.length <= 1) throw new UserError('An assessment needs at least one question.');
    a.items = a.items.filter((x) => x.id !== itemId);
    return this.save(owner, a);
  }

  /** Replaces a generated question with a new one for the same expectation and difficulty. */
  regenerateItem(owner: string | null, id: string, itemId: string): Assessment {
    const a = this.load(owner, id);
    const it = a.items.find((x) => x.id === itemId);
    if (!it) throw new NotFoundError('That question');
    const pack = skillsFor(it.question.expectationId)[0];
    if (!pack || it.question.origin !== 'generated') throw new UserError('Only generated questions can be replaced automatically. Remove this one instead.');
    it.question = generateQuestion(pack, it.question.expectationId, it.question.difficulty, (Date.now() + it.question.difficulty) >>> 0, { grade: a.grade ?? 7 });
    it.reviewed = true;
    return this.save(owner, a);
  }

  update(owner: string | null, id: string, patch: { title?: string; instructions?: string; timeLimitMinutes?: number | null }): Assessment {
    const a = this.load(owner, id);
    if (patch.title !== undefined) a.title = cleanLine(patch.title, 200) || a.title;
    if (patch.instructions !== undefined) a.instructions = String(patch.instructions).slice(0, 2000);
    if (patch.timeLimitMinutes !== undefined) a.timeLimitMinutes = patch.timeLimitMinutes === null ? null : Math.max(5, Math.min(240, Math.trunc(patch.timeLimitMinutes)));
    return this.save(owner, a);
  }

  duplicate(owner: string | null, id: string): Assessment {
    const a = this.load(owner, id);
    const now = this.now();
    return this.save(owner, { ...a, id: newId(), title: `${a.title} (copy)`.slice(0, 200), status: 'draft', items: a.items.map((i) => ({ ...i, id: newId() })), createdAt: now, updatedAt: now });
  }

  delete(owner: string | null, id: string): void {
    this.load(owner, id);
    this.db.run('DELETE FROM study_assessments WHERE id = ?', [id]);
  }

  /** A printable copy: questions, then answer key, solutions and rubric. */
  toMarkdown(owner: string | null, id: string): { filename: string; content: string } {
    const a = this.load(owner, id);
    const lines = [`# ${a.title}`, '', `_Practice assessment made with FlowCompanion. Not an official Ontario assessment._`, ''];
    if (a.instructions) lines.push(a.instructions, '');
    if (a.timeLimitMinutes) lines.push(`Time: ${a.timeLimitMinutes} minutes`, '');
    lines.push('## Curriculum expectations', '');
    for (const e of a.expectationIds) {
      const x = this.d.curriculum.find(e);
      if (x) lines.push(`- **${x.index}** (${x.courseLabel}): ${x.text.replace(/\n+/g, ' ')} — source: ${x.url}`);
    }
    lines.push('', '## Questions', '');
    a.items.forEach((it, i) => {
      lines.push(`**${i + 1}.** (${it.points} point${it.points === 1 ? '' : 's'}, ${QUESTION_TYPE_LABEL[it.question.type]}) ${blocksText(it.question.prompt)}`);
      if (it.question.type === 'multiple_choice' || it.question.type === 'multiple_select') for (const c of it.question.choices) lines.push(`   - ${c.id}) ${c.text}`);
      if (it.question.type === 'code_trace') lines.push('', '```python', it.question.code, '```');
      lines.push('');
    });
    lines.push('---', '', '## Answer key', '');
    a.items.forEach((it, i) => {
      const q = it.question;
      const key = q.type === 'written' ? 'Use the rubric.' : answerText(q);
      const flag = q.keyVerified ? '' : q.origin === 'ai' ? ' _(AI-written key — check before use)_' : '';
      lines.push(`${i + 1}. ${key}${flag}`);
      const sol = blocksText(q.solution);
      if (sol) lines.push(`   Solution: ${sol}`);
    });
    lines.push('', '## Rubric for written answers', '', RUBRIC_NOTE, '');
    for (const c of a.rubric) lines.push(`- **${c.label}:** ${c.description} (${c.levels.join(' / ')})`);
    const name = a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'assessment';
    return { filename: `${name}.md`, content: lines.join('\n') };
  }

  toJson(owner: string | null, id: string): { filename: string; content: string } {
    const a = this.load(owner, id);
    const name = a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'assessment';
    return { filename: `${name}.assessment.json`, content: JSON.stringify({ format: 'flowcompanion.assessment', version: 1, exportedAt: this.now(), note: 'Practice assessment. Not an official Ontario assessment.', assessment: a }, null, 2) };
  }

  deleteOwned(studentId: string): void {
    this.db.run('DELETE FROM study_assessments WHERE owner_student_id = ?', [studentId]);
  }
}

export function blocksText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case 'p':
        case 'note':
          return b.text;
        case 'math':
          return `$$${b.latex}$$`;
        case 'list':
          return b.items.map((i) => `• ${i}`).join(' ');
        case 'steps':
          return b.steps.map((s, i) => `${i + 1}. ${s.text}${s.math ? ` $$${s.math}$$` : ''}`).join(' ');
        case 'table':
          return [b.header.join(' | '), ...b.rows.map((r) => r.join(' | '))].join('; ');
        case 'code':
          return b.code;
        case 'diagram':
          return `[${b.alt}]`;
        case 'official':
          return `${b.index}: ${b.html.replace(/<[^>]+>/g, '')}`;
        case 'support':
          return `${b.label}: ${b.html.replace(/<[^>]+>/g, ' ')}`;
      }
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
