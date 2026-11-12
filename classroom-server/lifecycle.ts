import { randomCode } from '../src/core/passwords';
import { isAnswered, isAutoGraded, parseResponse } from '../src/shared/classroom/items';
import { AssessmentSettingsSchema, type AssessmentPhase, type AssessmentSettings, type ItemDto, type Question, type Response } from '../src/shared/classroom/protocol';
import { checkResponse } from '../src/shared/study/checking';
import { HttpError, forbidden, json, notFound, type ClassRow, type Ctx, type S, type UserRow } from './core';

export interface AssessmentRow {
  id: string;
  class_id: string;
  title: string;
  instructions: string;
  status: 'draft' | 'published';
  version: number;
  settings: string;
  material_ids: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
export interface AttemptRow {
  id: string;
  assessment_id: string;
  version: number;
  user_id: string;
  number: number;
  status: 'in_progress' | 'submitted';
  acknowledged_at: string;
  started_at: string;
  deadline: string | null;
  submitted_at: string | null;
  auto_submitted: number;
  reference: string | null;
  item_order: string;
  responses: string;
  flags: string;
  seconds: string;
  accommodation: string;
  overall_comment: string;
  released_at: string | null;
  updated_at: string;
}
interface ItemRow {
  id: string;
  position: number;
  points: number;
  question: string;
  long: number;
  ai_drafted: number;
  reviewed_by: string | null;
  expectation_ids: string;
}

/** Saves arriving this long after the deadline are still accepted (slow connections); after that the server submits. */
export const GRACE_MS = 20_000;

export const settingsOf = (a: Pick<AssessmentRow, 'settings'>): AssessmentSettings => AssessmentSettingsSchema.parse(json(a.settings, {}));

export function phaseOf(a: AssessmentRow, now: string): AssessmentPhase {
  if (a.status === 'draft') return 'draft';
  const st = settingsOf(a);
  if (st.opensAt && now < st.opensAt) return 'scheduled';
  if (st.closesAt && now >= st.closesAt) return 'closed';
  return 'open';
}

export function itemsOf(s: S, assessmentId: string, version: number): ItemDto[] {
  return s.db.all<ItemRow>('SELECT * FROM assessment_items WHERE assessment_id = ? AND version = ? ORDER BY position', [assessmentId, version]).map((r) => ({
    id: r.id,
    position: r.position,
    points: r.points,
    question: JSON.parse(r.question) as Question,
    long: r.long === 1,
    aiDrafted: r.ai_drafted === 1,
    reviewed: r.ai_drafted === 0 || !!r.reviewed_by,
    expectationIds: json<string[]>(r.expectation_ids, []),
  }));
}

export function assessmentFor(s: S, c: Ctx, id: string, need: 'member' | 'teacher' | 'student' = 'member') {
  const a = s.db.get<AssessmentRow>('SELECT * FROM assessments WHERE id = ?', [id]);
  if (!a) throw notFound('That assessment');
  const { cls, role, user } = s.classFor(c, a.class_id, need);
  // Students never see drafts.
  if (role === 'student' && a.status !== 'published') throw notFound('That assessment');
  return { a, cls, role, user };
}

/** The attempt and who is asking. Students reach only their own; teachers only their classes'. */
export function attemptFor(s: S, c: Ctx, id: string, who: 'owner' | 'teacher'): { t: AttemptRow; a: AssessmentRow; cls: ClassRow; user: UserRow; viaAdmin: boolean } {
  const user = s.requireUser(c);
  const t = s.db.get<AttemptRow>('SELECT * FROM attempts WHERE id = ?', [id]);
  const a = t ? s.db.get<AssessmentRow>('SELECT * FROM assessments WHERE id = ?', [t.assessment_id]) : undefined;
  if (!t || !a) throw notFound('That attempt');
  if (who === 'owner') {
    if (t.user_id !== user.id) throw notFound('That attempt');
    const cls = s.db.get<ClassRow>('SELECT * FROM classes WHERE id = ?', [a.class_id])!;
    return { t, a, cls, user, viaAdmin: false };
  }
  const cls = s.db.get<ClassRow>('SELECT * FROM classes WHERE id = ?', [a.class_id])!;
  const m = s.db.get<{ role: string; status: string }>('SELECT role, status FROM class_members WHERE class_id = ? AND user_id = ?', [cls.id, user.id]);
  if (m && m.status === 'active' && m.role !== 'student') return { t, a, cls, user, viaAdmin: false };
  // Administrators only when the school has switched that on; every such view is audited by the caller.
  if (user.role === 'admin' && user.school_id === cls.school_id && s.settings(cls.school_id).adminCanViewChats) return { t, a, cls, user, viaAdmin: true };
  throw notFound('That attempt');
}

/** Marks every item that code can check. Written answers wait for the teacher. */
function autoGrade(s: S, t: AttemptRow): void {
  const responses = json<Record<string, unknown>>(t.responses, {});
  for (const item of itemsOf(s, t.assessment_id, t.version)) {
    const r = parseResponse(item.question, responses[item.id]);
    if (!isAutoGraded(item.question)) {
      s.db.run('INSERT OR IGNORE INTO grades (attempt_id, item_id) VALUES (?, ?)', [t.id, item.id]);
      // Nothing written: zero, decided by rule, not by AI.
      if (!isAnswered(r)) s.db.run(`UPDATE grades SET score = 0, source = 'auto', auto_score = 0, auto_result = ? WHERE attempt_id = ? AND item_id = ?`, [JSON.stringify({ correct: false, score: 0, feedback: 'No answer was written.', misconception: null, method: 'none' }), t.id, item.id]);
      continue;
    }
    const result = isAnswered(r) ? checkResponse(item.question, r as Response) : { correct: false, score: 0, feedback: 'Not answered.', misconception: null, method: 'none' as const };
    // An answer the checker could not read is left for the teacher instead of being marked wrong.
    const decided = !result.unreadable;
    const score = Math.round(result.score * item.points * 100) / 100;
    s.db.run(
      `INSERT INTO grades (attempt_id, item_id, auto_score, auto_result, score, source) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(attempt_id, item_id) DO UPDATE SET auto_score = excluded.auto_score, auto_result = excluded.auto_result, score = excluded.score, source = excluded.source`,
      [t.id, item.id, decided ? score : null, JSON.stringify(result), decided ? score : null, decided ? 'auto' : null],
    );
  }
}

/** Submits an attempt: by the student, or by the server when time has run out. Safe to call twice. */
export function finalizeAttempt(s: S, attemptId: string, auto: boolean): AttemptRow {
  const t = s.db.get<AttemptRow>('SELECT * FROM attempts WHERE id = ?', [attemptId]);
  if (!t) throw notFound('That attempt');
  if (t.status === 'submitted') return t;
  const now = s.now();
  const at = auto && t.deadline && t.deadline < now ? t.deadline : now;
  s.db.tx(() => {
    s.db.run(`UPDATE attempts SET status = 'submitted', submitted_at = ?, auto_submitted = ?, reference = ?, updated_at = ? WHERE id = ?`, [at, auto, randomCode(2), now, t.id]);
    // A last snapshot of each written answer, so the timeline ends with what was submitted.
    const responses = json<Record<string, { type?: string; text?: string }>>(t.responses, {});
    for (const [itemId, r] of Object.entries(responses)) {
      if ((r?.type === 'written' || r?.type === 'text') && r.text) {
        const last = s.db.get<{ text: string }>('SELECT text FROM snapshots WHERE attempt_id = ? AND item_id = ? ORDER BY at DESC LIMIT 1', [t.id, itemId]);
        if (last?.text !== r.text) s.db.run('INSERT INTO snapshots (attempt_id, item_id, at, text) VALUES (?, ?, ?, ?)', [t.id, itemId, at, r.text]);
      }
    }
    autoGrade(s, t);
    const a = s.db.get<AssessmentRow>('SELECT * FROM assessments WHERE id = ?', [t.assessment_id])!;
    s.db.run(`INSERT OR IGNORE INTO ai_evaluations (attempt_id, status, rubric, updated_at) VALUES (?, 'none', ?, ?)`, [t.id, JSON.stringify(settingsOf(a).aiUseRubric), now]);
  });
  for (const fn of s.onSubmitted) {
    try {
      fn(t.id);
    } catch (err) {
      s.opts.log?.(`after-submit hook failed: ${(err as Error).stack ?? err}`);
    }
  }
  return s.db.get<AttemptRow>('SELECT * FROM attempts WHERE id = ?', [attemptId])!;
}

/**
 * Refuses work on an attempt whose time is up, submitting it with what was last saved. The server's clock decides;
 * the student's clock is never trusted.
 */
export function requireOpen(s: S, t: AttemptRow): void {
  if (t.status === 'submitted') throw new HttpError(409, 'submitted', 'This attempt has already been submitted.');
  if (t.deadline && Date.parse(s.now()) > Date.parse(t.deadline) + GRACE_MS) {
    finalizeAttempt(s, t.id, true);
    throw new HttpError(409, 'time_up', 'Time is up. Your saved answers were submitted.');
  }
}

/** Submits attempts whose time ran out while nobody was looking (closed laptop, lost connection). */
export function expireAttempts(s: S): number {
  const cutoff = new Date(Date.parse(s.now()) - GRACE_MS).toISOString();
  const due = s.db.all<{ id: string }>(`SELECT id FROM attempts WHERE status = 'in_progress' AND deadline IS NOT NULL AND deadline < ?`, [cutoff]);
  for (const d of due) finalizeAttempt(s, d.id, true);
  return due.length;
}

export { forbidden };
