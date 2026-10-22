import { DateTime } from 'luxon';
import { z } from 'zod';
import {
  ASSIGNMENT_KINDS,
  PLAN_ACTIVITY_LABEL,
  type Assignment,
  type AssignmentKind,
  type AssignmentStep,
  type MasteryStatus,
  type PlanActivityKind,
  type PlanSession,
  type StudentProfile,
  type StudyPlan,
} from '../../shared/study/types';
import type { EventsService } from '../calendar/events';
import type { CurriculumService } from '../curriculum/service';
import type { Db } from '../db/database';
import { json } from '../db/database';
import type { LinksService } from '../links';
import type { TasksService } from '../tasks';
import { type Clock, NotFoundError, UserError, cleanLine, newId } from '../util';
import type { ProgressStore } from './progress';

/**
 * Study plans and assignments. A plan is only a proposal until the student approves it; approving creates real
 * calendar events (with reminders) and tasks. Missed sessions can be moved without losing any progress, because
 * progress lives in the mastery records, not in the plan.
 */

export interface PlannerDeps {
  db: Db;
  clock: Clock;
  curriculum: CurriculumService;
  progress: ProgressStore;
  events: EventsService;
  tasks: TasksService;
  links: LinksService;
  zone: () => string;
  reminderMinutes: () => number;
}

interface Slot {
  date: string;
  start: string;
  minutes: number;
}

const WEAK: MasteryStatus[] = ['not_assessed', 'not_yet', 'in_progress'];

export const AssignmentInput = z.object({
  title: z.string().trim().min(1, 'Give the assignment a title.').max(200),
  kind: z.enum(ASSIGNMENT_KINDS).default('assignment'),
  courseId: z.string().max(80).nullable().default(null),
  expectationIds: z.array(z.string().max(120)).max(30).default([]),
  dueAt: z
    .string()
    .max(40)
    .nullable()
    .default(null)
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), 'Choose a valid due date.'),
  prompt: z.string().max(20_000).default(''),
  notes: z.string().max(20_000).default(''),
});

/** Steps that break a piece of work into manageable parts, by kind. Written by FlowCompanion. */
export function assignmentSteps(kind: AssignmentKind, expectationIds: string[]): AssignmentStep[] {
  const s = (title: string, detail: string, activity: AssignmentStep['activity'] = null): AssignmentStep => ({ id: newId(), title, detail, done: false, activity });
  switch (kind) {
    case 'test':
    case 'exam':
      return [
        s('Find out what you already know', 'A short diagnostic quiz on the topics.', { kind: 'diagnostic', expectationIds }),
        s('Review earlier skills', 'Go over any earlier skill the diagnostic shows needs work.', { kind: 'review', expectationIds }),
        s('Guided practice on weaker topics', 'Lessons with hints for the topics that need the most work.', { kind: 'lesson', expectationIds }),
        s('Practise on your own', 'Independent questions without hints.', { kind: 'quiz', expectationIds }),
        s('Mixed practice test', 'A practice test mixing all topics. It is practice, not the real test.', { kind: 'quiz', expectationIds }),
        s('Review recurring mistakes', 'Go back over the mistakes that came up more than once.', { kind: 'review', expectationIds }),
      ];
    case 'essay':
      return [
        s('Understand the task', 'Underline what the prompt asks you to do (analyse, argue, compare…) and any requirements.'),
        s('Gather ideas and evidence', 'Collect quotations, facts or examples, and note where each came from.', { kind: 'research', expectationIds }),
        s('Write a thesis and outline', 'One sentence that answers the prompt, then the main points that support it.', { kind: 'write', expectationIds }),
        s('Write a first draft', 'Get the ideas down in your own words; don’t polish yet.', { kind: 'write', expectationIds }),
        s('Get feedback on the draft', 'Check it against the criteria. The AI tutor can give feedback if you allow it — it won’t rewrite it for you.', { kind: 'write', expectationIds }),
        s('Revise', 'Fix the biggest issue first: argument, then organization, then sentences.'),
        s('Final check', 'Spelling, grammar, citations, length and formatting requirements.'),
      ];
    case 'project':
    case 'presentation':
      return [
        s('Understand the task and criteria', 'List what must be included and how it will be assessed.'),
        s('Plan', 'Break the work into parts and decide when you will do each.'),
        s('Research and learn what you need', 'Study the concepts the project uses.', { kind: 'lesson', expectationIds }),
        s('Make a first version', 'Build the draft, model or slides.'),
        s('Check against the criteria', 'Compare your work with every criterion and fix gaps.'),
        s(kind === 'presentation' ? 'Rehearse' : 'Finish and polish', kind === 'presentation' ? 'Practise out loud and time yourself.' : 'Final edits and checks.'),
      ];
    case 'lab':
      return [
        s('Understand the question and the variables', 'Identify the independent, dependent and controlled variables.', { kind: 'lesson', expectationIds }),
        s('Hypothesis and method', 'Write what you expect and why, and the steps you will follow.'),
        s('Record results', 'Use your real observations. Don’t make up data.'),
        s('Analyse and conclude', 'What do the results show? Use evidence.'),
        s('Check the report', 'Units, labels, sources and conclusion.'),
      ];
    default:
      return [
        s('Understand the task', 'What exactly is asked? What does a good answer include?'),
        s('Learn or review what you need', 'Lessons and practice on the topics involved.', { kind: 'lesson', expectationIds }),
        s('Do the work', 'Work through it in your own words.'),
        s('Check your work', 'Re-read the task and check every part is done.'),
      ];
  }
}

export class PlannerService {
  constructor(private readonly d: PlannerDeps) {}

  private get db() {
    return this.d.db;
  }
  private now() {
    return this.d.clock.now().toISOString();
  }

  // ─────────── Assignments ───────────

  private loadAssignment(studentId: string, id: string): Assignment {
    const r = this.db.get<{ student_id: string; data: string }>('SELECT student_id, data FROM study_assignments WHERE id = ?', [id]);
    if (!r || r.student_id !== studentId) throw new NotFoundError('That assignment');
    return json<Assignment>(r.data, null as never);
  }

  private saveAssignment(studentId: string, a: Assignment): Assignment {
    a.updatedAt = this.now();
    this.db.run(
      `INSERT INTO study_assignments (id, student_id, status, due_at, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, due_at = excluded.due_at, data = excluded.data, updated_at = excluded.updated_at`,
      [a.id, studentId, a.status, a.dueAt, JSON.stringify(a), a.createdAt, a.updatedAt],
    );
    return a;
  }

  createAssignment(studentId: string, input: unknown): Assignment {
    const d = AssignmentInput.parse(input ?? {});
    for (const e of d.expectationIds) if (!this.d.curriculum.find(e)) throw new NotFoundError('A curriculum expectation');
    const now = this.now();
    return this.saveAssignment(studentId, { id: newId(), ...d, title: cleanLine(d.title, 200), status: 'open', steps: assignmentSteps(d.kind, d.expectationIds), createdAt: now, updatedAt: now });
  }

  updateAssignment(studentId: string, id: string, patch: unknown): Assignment {
    const cur = this.loadAssignment(studentId, id);
    const p = AssignmentInput.partial().extend({ status: z.enum(['open', 'done']).optional() }).parse(patch ?? {});
    return this.saveAssignment(studentId, { ...cur, ...p, title: p.title ? cleanLine(p.title, 200) : cur.title });
  }

  toggleStep(studentId: string, id: string, stepId: string, done: boolean): Assignment {
    const a = this.loadAssignment(studentId, id);
    const st = a.steps.find((x) => x.id === stepId);
    if (!st) throw new NotFoundError('That step');
    st.done = done;
    if (a.steps.every((x) => x.done)) a.status = 'done';
    else a.status = 'open';
    return this.saveAssignment(studentId, a);
  }

  assignments(studentId: string, includeDone = false): Assignment[] {
    return this.db
      .all<{ data: string }>(`SELECT data FROM study_assignments WHERE student_id = ? ${includeDone ? '' : "AND status = 'open'"} ORDER BY COALESCE(due_at, '9999'), created_at`, [studentId])
      .map((r) => json<Assignment>(r.data, null as never));
  }

  assignment(studentId: string, id: string): Assignment {
    return this.loadAssignment(studentId, id);
  }

  deleteAssignment(studentId: string, id: string): void {
    this.loadAssignment(studentId, id);
    this.db.run('DELETE FROM study_assignments WHERE id = ?', [id]);
  }

  /** The earliest open test or assignment due date covering an expectation, used to time reviews before it. */
  dueByFor(studentId: string, expectationId: string): Date | null {
    const due = this.assignments(studentId)
      .filter((a) => a.dueAt && a.expectationIds.includes(expectationId))
      .map((a) => new Date(a.dueAt!))
      .filter((d) => d > this.d.clock.now())
      .sort((a, b) => a.getTime() - b.getTime());
    return due[0] ?? null;
  }

  // ─────────── Plans ───────────

  private load(studentId: string, id: string): StudyPlan {
    const r = this.db.get<{ student_id: string; data: string }>('SELECT student_id, data FROM study_plans WHERE id = ?', [id]);
    if (!r || r.student_id !== studentId) throw new NotFoundError('That study plan');
    return json<StudyPlan>(r.data, null as never);
  }

  private save(studentId: string, p: StudyPlan): StudyPlan {
    this.db.run(
      `INSERT INTO study_plans (id, student_id, status, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, data = excluded.data, updated_at = excluded.updated_at`,
      [p.id, studentId, p.status, JSON.stringify(p), p.createdAt, this.now()],
    );
    return p;
  }

  plans(studentId: string, includeArchived = false): StudyPlan[] {
    return this.db
      .all<{ data: string }>(`SELECT data FROM study_plans WHERE student_id = ? ${includeArchived ? '' : "AND status != 'archived'"} ORDER BY created_at DESC`, [studentId])
      .map((r) => json<StudyPlan>(r.data, null as never));
  }

  plan(studentId: string, id: string): StudyPlan {
    return this.load(studentId, id);
  }

  /** Free study slots from the student's availability, skipping times already taken in the calendar. */
  private slots(student: StudentProfile, from: DateTime, until: DateTime): Slot[] {
    const zone = this.d.zone();
    const busy = this.d.events.occurrences(from.toUTC().toISO()!, until.toUTC().toISO()!).filter((o) => !o.allDay);
    const perDay = Math.max(1, Math.min(3, Math.floor(student.dailyMinutes / student.sessionMinutes)));
    const out: Slot[] = [];
    const [hh, mm] = student.studyTime.split(':').map(Number);
    for (let day = from.startOf('day'); day < until; day = day.plus({ days: 1 })) {
      if (!student.studyDays.includes(day.weekday as 1)) continue;
      let t = day.set({ hour: hh!, minute: mm!, second: 0, millisecond: 0 });
      let made = 0;
      for (let tries = 0; made < perDay && tries < perDay + 6; tries++) {
        const end = t.plus({ minutes: student.sessionMinutes });
        if (end.day !== t.day || t >= until) break;
        const clash = busy.some((o) => new Date(o.startUtc) < end.toJSDate() && new Date(o.endUtc) > t.toJSDate());
        if (!clash && t > DateTime.fromJSDate(this.d.clock.now()).setZone(zone)) {
          out.push({ date: t.toISODate()!, start: t.toFormat('HH:mm'), minutes: student.sessionMinutes });
          made++;
          t = end.plus({ minutes: 10 });
        } else t = t.plus({ minutes: 30 });
      }
    }
    return out;
  }

  /**
   * Proposes a plan. For a test it follows: diagnostic → earlier skills → guided practice on weak topics →
   * independent practice → mixed quiz → recurring mistakes, then spaced review in any time left.
   */
  propose(student: StudentProfile, input: { kind: StudyPlan['kind']; expectationIds: string[]; dueDate?: string | null; goal?: string; assignmentId?: string | null }): StudyPlan {
    const zone = this.d.zone();
    const ids = [...new Set(input.expectationIds ?? [])].filter((id) => this.d.curriculum.find(id));
    const now = DateTime.fromJSDate(this.d.clock.now()).setZone(zone);
    let until: DateTime;
    if (input.kind === 'test_prep' || input.kind === 'assignment') {
      if (!input.dueDate) throw new UserError('Choose the date of the test or the due date.');
      const due = DateTime.fromISO(input.dueDate, { zone });
      if (!due.isValid || due <= now) throw new UserError('The due date has to be in the future.');
      until = due.startOf('day');
      if (!ids.length && input.kind === 'test_prep') throw new UserError('Choose the topics the test covers.');
    } else until = now.plus({ days: 7 }).endOf('day');
    const slots = this.slots(student, now, until);
    if (!slots.length) throw new UserError('There are no free study times before then. Add study days or change your study time in your profile.');

    const status = (id: string) => this.d.progress.status(student.id, id);
    const weak = ids.filter((id) => WEAK.includes(status(id)));
    const developing = ids.filter((id) => status(id) === 'developing');
    const prereqs = [...new Set(ids.flatMap((id) => this.d.progress.prerequisiteExpectations(id)).filter((p) => WEAK.includes(status(p))))];
    const withMistakes = ids.filter((id) => Object.keys(this.d.progress.get(student.id, id).misconceptions).length > 0);
    const dueReviews = this.d.progress.dueReviews(student.id, 24 * 7).map((r) => r.expectationId);
    const label = (xs: string[]) => xs.map((x) => this.d.curriculum.find(x)?.index ?? '').filter(Boolean).slice(0, 4).join(', ');

    const acts: { activity: PlanActivityKind; expectationIds: string[]; reason: string }[] = [];
    if (input.kind === 'test_prep' || input.kind === 'assignment') {
      acts.push({ activity: 'diagnostic', expectationIds: ids, reason: 'Find out what you already know so the time goes where it is needed.' });
      if (prereqs.length) acts.push({ activity: 'prerequisite_review', expectationIds: prereqs, reason: 'Earlier skills these topics build on are not secure yet.' });
      for (const id of weak.length ? weak : ids.slice(0, 1)) acts.push({ activity: 'guided_practice', expectationIds: [id], reason: weak.length ? 'This topic needs the most work.' : 'A guided warm-up on the first topic.' });
      for (const id of developing.length ? developing : ids) acts.push({ activity: 'independent_practice', expectationIds: [id], reason: 'Practise without hints to show what you can do on your own.' });
      acts.push({ activity: 'mixed_quiz', expectationIds: ids, reason: 'Mixing topics is closer to a real test and helps you remember.' });
      acts.push({ activity: 'mistakes_review', expectationIds: withMistakes.length ? withMistakes : ids, reason: withMistakes.length ? 'Go back over mistakes that came up more than once.' : 'A last look at anything that was tricky.' });
    } else if (input.kind === 'daily_review') {
      for (const id of dueReviews) acts.push({ activity: 'spaced_review', expectationIds: [id], reason: 'A review is due, so you keep remembering it.' });
      if (!acts.length) throw new UserError('Nothing is due for review this week. Practise something new first.');
    } else {
      const fresh = ids.length ? ids : this.nextNew(student, 4);
      for (const id of fresh) {
        acts.push({ activity: WEAK.includes(status(id)) ? 'lesson' : 'independent_practice', expectationIds: [id], reason: 'New learning from your courses.' });
        const review = dueReviews.shift();
        if (review) acts.push({ activity: 'spaced_review', expectationIds: [review], reason: 'A review is due.' });
      }
      if (fresh.length > 1) acts.push({ activity: 'mixed_quiz', expectationIds: fresh, reason: 'A mixed quiz to finish the week.' });
    }
    // Fit activities to slots: keep the first and last activities, fill extra slots with reviews or practice.
    let plan = acts;
    if (acts.length > slots.length) {
      const first = acts.slice(0, 1);
      const last = acts.slice(-2);
      const middle = acts.slice(1, -2);
      plan = [...first, ...middle.slice(0, Math.max(0, slots.length - 3)), ...last].slice(0, slots.length);
    } else {
      const extra = slots.length - acts.length;
      const fill = (input.kind === 'test_prep' || input.kind === 'assignment') && ids.length ? ids : [];
      const insertAt = Math.max(1, plan.length - 2);
      const filler = Array.from({ length: Math.min(extra, fill.length * 2) }, (_, i) => ({ activity: 'spaced_review' as PlanActivityKind, expectationIds: [fill[i % fill.length]!], reason: 'Spaced practice: coming back to a topic after a gap helps it stick.' }));
      plan = [...plan.slice(0, insertAt), ...filler, ...plan.slice(insertAt)];
    }
    const sessions: PlanSession[] = plan.map((a, i) => ({
      id: newId(),
      date: slots[i]!.date,
      start: slots[i]!.start,
      minutes: slots[i]!.minutes,
      activity: a.activity,
      expectationIds: a.expectationIds,
      title: `${PLAN_ACTIVITY_LABEL[a.activity]}${label(a.expectationIds) ? `: ${label(a.expectationIds)}` : ''}`,
      reason: a.reason,
      status: 'planned',
      eventId: null,
      taskId: null,
    }));
    const p: StudyPlan = {
      id: newId(),
      title: input.kind === 'test_prep' ? `Test preparation${input.dueDate ? ` for ${input.dueDate}` : ''}` : input.kind === 'daily_review' ? 'Review plan' : input.kind === 'assignment' ? 'Assignment plan' : 'This week’s study plan',
      goal: cleanLine(input.goal ?? '', 200),
      kind: input.kind,
      assignmentId: input.assignmentId ?? null,
      status: 'proposed',
      sessions,
      createdAt: this.now(),
      approvedAt: null,
      timeZone: zone,
    };
    return this.save(student.id, p);
  }

  /** Up to n expectations from the student's courses that have offline practice and aren't proficient yet. */
  nextNew(student: StudentProfile, n: number): string[] {
    const out: string[] = [];
    for (const c of student.courseIds) {
      for (const e of this.d.curriculum.expectationsOf(c)) {
        if (out.length >= n) return out;
        const s = this.d.progress.status(student.id, e.id);
        if (s === 'proficient' || s === 'extension_ready') continue;
        out.push(e.id);
      }
    }
    return out;
  }

  private studyList(): string {
    const found = this.d.tasks.lists().find((l) => l.name === 'Study plan');
    return (found ?? this.d.tasks.createList('Study plan')).id;
  }

  private materialize(p: PlanSession, zone: string, studentName: string): { eventId: string; taskId: string } {
    const start = DateTime.fromISO(`${p.date}T${p.start}`, { zone });
    const end = start.plus({ minutes: p.minutes });
    const ev = this.d.events.create({
      title: `Study: ${p.title}`,
      notes: `${p.reason}\n\nOpen Student Learning in FlowCompanion (profile: ${studentName}) to start.`,
      category: 'study',
      start: start.toFormat("yyyy-LL-dd'T'HH:mm"),
      end: end.toFormat("yyyy-LL-dd'T'HH:mm"),
      timeZone: zone,
      reminders: [this.d.reminderMinutes()],
    });
    const task = this.d.tasks.create({ title: `${p.title} (${studentName})`, listId: this.studyList(), dueAt: start.toUTC().toISO()!, notes: p.reason });
    this.d.links.link('task', task.id, 'event', ev.id);
    return { eventId: ev.id, taskId: task.id };
  }

  /** Approving creates the calendar events (with reminders) and tasks. Nothing is created before this. */
  approve(student: StudentProfile, id: string): StudyPlan {
    const p = this.load(student.id, id);
    if (p.status !== 'proposed') throw new UserError('This plan has already been approved.');
    for (const s of p.sessions) {
      const r = this.materialize(s, p.timeZone, student.displayName);
      s.eventId = r.eventId;
      s.taskId = r.taskId;
    }
    p.status = 'approved';
    p.approvedAt = this.now();
    return this.save(student.id, p);
  }

  /** Moves missed sessions to the next free times before the plan ends. Progress is not affected. */
  rescheduleMissed(student: StudentProfile, id: string): { plan: StudyPlan; moved: number; dropped: number } {
    const p = this.load(student.id, id);
    const now = this.d.clock.now();
    const zone = p.timeZone;
    const missed = p.sessions.filter((s) => s.status === 'planned' && DateTime.fromISO(`${s.date}T${s.start}`, { zone }).plus({ minutes: s.minutes }).toJSDate() < now);
    if (!missed.length) return { plan: p, moved: 0, dropped: 0 };
    const lastDate = p.sessions.reduce((m, s) => (s.date > m ? s.date : m), p.sessions[0]!.date);
    const until = DateTime.fromISO(lastDate, { zone }).plus({ days: p.kind === 'weekly' || p.kind === 'daily_review' ? 7 : 1 }).startOf('day');
    const taken = new Set(p.sessions.filter((s) => s.status === 'planned').map((s) => `${s.date}T${s.start}`));
    const free = this.slots(student, DateTime.fromJSDate(now).setZone(zone), until).filter((sl) => !taken.has(`${sl.date}T${sl.start}`));
    let moved = 0;
    let dropped = 0;
    for (const s of missed) {
      const slot = free.shift();
      if (!slot) {
        s.status = 'missed';
        dropped++;
        continue;
      }
      s.date = slot.date;
      s.start = slot.start;
      if (p.status === 'approved' && s.eventId) {
        const start = DateTime.fromISO(`${s.date}T${s.start}`, { zone });
        try {
          this.d.events.update(s.eventId, { start: start.toFormat("yyyy-LL-dd'T'HH:mm"), end: start.plus({ minutes: s.minutes }).toFormat("yyyy-LL-dd'T'HH:mm"), timeZone: zone });
          if (s.taskId) this.d.tasks.update(s.taskId, { dueAt: start.toUTC().toISO()! });
        } catch {
          // The student deleted the event or task themselves; recreate them.
          const r = this.materialize(s, zone, student.displayName);
          s.eventId = r.eventId;
          s.taskId = r.taskId;
        }
      }
      moved++;
    }
    p.sessions.sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
    return { plan: this.save(student.id, p), moved, dropped };
  }

  markSession(student: StudentProfile, id: string, sessionId: string, status: 'done' | 'skipped' | 'planned'): StudyPlan {
    const p = this.load(student.id, id);
    const s = p.sessions.find((x) => x.id === sessionId);
    if (!s) throw new NotFoundError('That study session');
    s.status = status;
    if (s.taskId) {
      try {
        this.d.tasks.toggle(s.taskId, status === 'done');
      } catch {
        s.taskId = null;
      }
    }
    if (p.status === 'approved' && p.sessions.every((x) => x.status !== 'planned')) p.status = 'completed';
    return this.save(student.id, p);
  }

  /** Archives a plan. With removeFuture, its upcoming calendar events and open tasks are deleted too. */
  archive(student: StudentProfile, id: string, removeFuture: boolean): StudyPlan {
    const p = this.load(student.id, id);
    if (removeFuture) {
      for (const s of p.sessions.filter((x) => x.status === 'planned')) {
        try {
          if (s.eventId) this.d.events.delete(s.eventId);
        } catch {
          /* already gone */
        }
        try {
          if (s.taskId) this.d.tasks.delete(s.taskId);
        } catch {
          /* already gone */
        }
        s.eventId = null;
        s.taskId = null;
      }
    }
    p.status = 'archived';
    return this.save(student.id, p);
  }

  deleteProposed(studentId: string, id: string): void {
    const p = this.load(studentId, id);
    if (p.status !== 'proposed') throw new UserError('Only proposed plans can be discarded. Archive approved plans instead.');
    this.db.run('DELETE FROM study_plans WHERE id = ?', [id]);
  }

  deleteAll(studentId: string): void {
    this.db.run('DELETE FROM study_plans WHERE student_id = ?', [studentId]);
    this.db.run('DELETE FROM study_assignments WHERE student_id = ?', [studentId]);
  }
}
