import { CalendarPlus, Check, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ASSIGNMENT_KINDS, PLAN_ACTIVITY_LABEL, type Assignment, type AssignmentKind, type StudyPlan } from '../../../shared/study/types';
import { Badge, Banner, Button, EmptyState, Field, Input, Loading, Select, Tabs, Textarea, useConfirm, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { navigate } from '../../lib/router';
import { indexOf } from './common';

const KIND_LABEL: Record<AssignmentKind, string> = { assignment: 'Assignment', test: 'Test', project: 'Project', exam: 'Exam', essay: 'Essay', lab: 'Lab report', presentation: 'Presentation' };

/** Picks specific expectations from one course. */
function ExpectationPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const me = useQuery('study:me', () => api.study.me());
  const [cid, setCid] = useState('');
  const courses = useQuery(me.data ? `study:pcourses:${me.data.grade}` : null, () => api.curriculum.courses({ grade: me.data!.grade }));
  const course = cid || me.data?.courseIds[0] || '';
  const detail = useQuery(course ? `curriculum:course:${course}` : null, () => api.curriculum.course(course));
  return (
    <div className="stack-2">
      <Select value={course} onChange={(e) => setCid(e.target.value)} aria-label="Course">
        <option value="">Choose a course…</option>
        {(courses.data ?? [])
          .filter((c) => c.expectationsSource === 'digital')
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
      </Select>
      {detail.data ? (
        <div className="expectation-picker">
          {detail.data.strands.flatMap((s) =>
            s.overall.flatMap((o) =>
              o.specifics.map((e) => (
                <label key={e.id} className="row small">
                  <input type="checkbox" checked={value.includes(e.id)} onChange={(ev) => onChange(ev.target.checked ? [...value, e.id] : value.filter((x) => x !== e.id))} />
                  <strong>{e.index}</strong>
                  <span className="grow ellipsis" title={e.text}>
                    {e.text}
                  </span>
                </label>
              )),
            ),
          )}
        </div>
      ) : null}
      <span className="tiny faint">{value.length} chosen</span>
    </div>
  );
}

export default function Plan() {
  const [tab, setTab] = useState<'plans' | 'assignments'>('plans');
  return (
    <div className="page stack-4" style={{ maxWidth: 1000 }}>
      <h1>Planner and assignments</h1>
      <Tabs
        label="Planner sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'plans', label: 'Study plans' },
          { value: 'assignments', label: 'Assignments and tests' },
        ]}
      />
      {tab === 'plans' ? <Plans /> : <Assignments />}
    </div>
  );
}

function PlanView({ p }: { p: StudyPlan }) {
  const toast = useToast();
  const confirm = useConfirm();
  const act = (fn: () => Promise<unknown>, ok?: string) =>
    void fn()
      .then(() => {
        invalidate('study');
        if (ok) toast(ok, 'success');
      })
      .catch((e: unknown) => toast(errorMessage(e), 'error'));
  const missed = p.status === 'approved' && p.sessions.some((s) => s.status === 'planned' && `${s.date}T${s.start}` < new Date().toISOString().slice(0, 16));
  return (
    <section className="card stack-3" aria-label={p.title}>
      <div className="row">
        <h2 className="h2 grow">{p.title}</h2>
        <Badge tone={p.status === 'approved' ? 'ok' : p.status === 'proposed' ? 'warn' : 'outline'}>{p.status === 'proposed' ? 'Proposal — not scheduled yet' : p.status}</Badge>
      </div>
      {p.goal ? <p className="small">{p.goal}</p> : null}
      <table className="table small">
        <thead>
          <tr>
            <th>When</th>
            <th>Activity</th>
            <th>Why</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {p.sessions.map((s) => (
            <tr key={s.id} className={s.status === 'done' ? 'faint' : ''}>
              <td className="nowrap">
                {s.date} {s.start} · {s.minutes} min
              </td>
              <td>
                <strong>{PLAN_ACTIVITY_LABEL[s.activity]}</strong>
                <div className="tiny muted">{s.expectationIds.map(indexOf).join(', ')}</div>
              </td>
              <td className="muted">{s.reason}</td>
              <td className="nowrap">
                {p.status === 'approved' && s.status === 'planned' ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => navigate(s.activity === 'mixed_quiz' || s.activity === 'diagnostic' || s.activity === 'spaced_review' ? '/study/practice' : `/study/e/${encodeURIComponent(s.expectationIds[0] ?? '')}`)}>
                      Start
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Check size={12} />} onClick={() => act(() => api.study.markPlanSession(p.id, s.id, 'done'))}>
                      Done
                    </Button>
                  </>
                ) : (
                  <span className="tiny muted">{s.status === 'planned' ? '' : s.status}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {missed ? <Banner tone="warn">Some sessions were missed. Moving them keeps all your progress — it lives in your results, not in the plan.</Banner> : null}
      <div className="row-wrap">
        {p.status === 'proposed' ? (
          <>
            <Button variant="primary" icon={<CalendarPlus size={14} />} onClick={() => act(() => api.study.approvePlan(p.id), 'Added to your calendar and tasks')}>
              Approve and add to calendar
            </Button>
            <Button onClick={() => act(() => api.study.discardPlan(p.id))}>Discard</Button>
            <span className="tiny faint">Approving creates calendar events with reminders and tasks in a “Study plan” list. They appear in FlowCompanion’s calendar, which anyone using this computer account can see.</span>
          </>
        ) : null}
        {missed ? (
          <Button onClick={() => act(async () => {
            const r = await api.study.reschedulePlan(p.id);
            toast(`${r.moved} moved${r.dropped ? `, ${r.dropped} didn’t fit before the due date` : ''}`, 'success');
          })}>
            Move missed sessions
          </Button>
        ) : null}
        {p.status === 'approved' || p.status === 'completed' ? (
          <>
            <Button variant="ghost" onClick={() => act(() => api.study.archivePlan(p.id, false), 'Plan archived; its calendar events were kept')}>
              Archive
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                if (!(await confirm({ title: 'Archive and remove upcoming sessions?', message: 'This archives the plan and deletes its upcoming calendar events and open tasks. Past sessions and your progress are kept.', confirmLabel: 'Archive and remove', danger: true }))) return;
                act(() => api.study.archivePlan(p.id, true), 'Plan archived and upcoming sessions removed');
              }}
            >
              Archive and remove upcoming
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}

function Plans() {
  const toast = useToast();
  const plans = useQuery('study:plans', () => api.study.plans());
  const [kind, setKind] = useState<StudyPlan['kind']>('test_prep');
  const [ids, setIds] = useState<string[]>([]);
  const [due, setDue] = useState('');
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const propose = async () => {
    setBusy(true);
    try {
      await api.study.proposePlan({ kind, expectationIds: ids, dueDate: kind === 'test_prep' ? due : null, goal });
      invalidate('study');
      setIds([]);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack-4">
      <section className="card stack-3" aria-label="Make a plan">
        <h2 className="h2">Make a plan</h2>
        <p className="small muted">Plans fit your study days, time and session length (Learning settings), avoid events already in your calendar, mix new learning with review, and are only scheduled after you approve them.</p>
        <div className="field-row">
          <Field label="Plan for" htmlFor="pl-kind">
            <Select id="pl-kind" value={kind} onChange={(e) => setKind(e.target.value as StudyPlan['kind'])}>
              <option value="test_prep">A test</option>
              <option value="weekly">This week</option>
              <option value="daily_review">Reviews due this week</option>
            </Select>
          </Field>
          {kind === 'test_prep' ? (
            <Field label="Test date" htmlFor="pl-due">
              <input id="pl-due" className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          ) : null}
          <Field label="Goal (optional)" htmlFor="pl-goal">
            <Input id="pl-goal" value={goal} maxLength={200} onChange={(e) => setGoal(e.target.value)} />
          </Field>
        </div>
        {kind !== 'daily_review' ? (
          <Field label={kind === 'test_prep' ? 'What the test covers' : 'What to work on (optional — leave empty to use your courses)'}>
            <ExpectationPicker value={ids} onChange={setIds} />
          </Field>
        ) : null}
        <div>
          <Button variant="primary" loading={busy} onClick={() => void propose()}>
            Propose a plan
          </Button>
        </div>
      </section>
      {!plans.data ? <Loading /> : plans.data.length ? plans.data.map((p) => <PlanView key={p.id} p={p} />) : <EmptyState title="No plans yet" />}
    </div>
  );
}

function Assignments() {
  const toast = useToast();
  const list = useQuery('study:assignments', () => api.study.assignments(true));
  const ai = useQuery('study:ai', () => api.study.aiStatus());
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<AssignmentKind>('test');
  const [due, setDue] = useState('');
  const [prompt, setPrompt] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const create = async () => {
    try {
      await api.study.createAssignment({ title, kind, dueAt: due ? new Date(`${due}T12:00:00`).toISOString() : null, prompt, expectationIds: ids });
      setTitle('');
      setPrompt('');
      setIds([]);
      invalidate('study');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <div className="stack-4">
      <section className="card stack-3" aria-label="Add an assignment">
        <h2 className="h2">Add an assignment or test</h2>
        <div className="field-row">
          <Field label="Title" htmlFor="as-title">
            <Input id="as-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Kind" htmlFor="as-kind">
            <Select id="as-kind" value={kind} onChange={(e) => setKind(e.target.value as AssignmentKind)}>
              {ASSIGNMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due" htmlFor="as-due">
            <input id="as-due" className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        <Field label="The task, as your teacher gave it (optional)" hint="It stays on this computer. It is only sent to an AI provider if you ask for AI feedback.">
          <Textarea rows={3} value={prompt} maxLength={20_000} onChange={(e) => setPrompt(e.target.value)} />
        </Field>
        <Field label="Curriculum topics (optional)">
          <ExpectationPicker value={ids} onChange={setIds} />
        </Field>
        <div>
          <Button variant="primary" disabled={!title.trim()} onClick={() => void create()}>
            Add
          </Button>
        </div>
      </section>
      {!list.data ? <Loading /> : list.data.length ? list.data.map((a) => <AssignmentCard key={a.id} a={a} aiAvailable={!!ai.data?.available} aiReason={ai.data?.reason ?? null} />) : <EmptyState title="No assignments yet" />}
    </div>
  );
}

function AssignmentCard({ a, aiAvailable, aiReason }: { a: Assignment; aiAvailable: boolean; aiReason: string | null }) {
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [fb, setFb] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const plan = async () => {
    try {
      if (!a.dueAt) throw new Error('Add a due date first.');
      await api.study.proposePlan({ kind: a.kind === 'test' || a.kind === 'exam' ? 'test_prep' : 'assignment', expectationIds: a.expectationIds, dueDate: a.dueAt.slice(0, 10), goal: a.title, assignmentId: a.id });
      invalidate('study');
      toast('A plan was proposed under Study plans. Review it before approving.', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <section className="card stack-3" aria-label={a.title}>
      <div className="row">
        <h3 className="grow">{a.title}</h3>
        <Badge tone="outline">{KIND_LABEL[a.kind]}</Badge>
        {a.dueAt ? <span className="tiny muted">due {a.dueAt.slice(0, 10)}</span> : null}
        <button type="button" className="icon-btn sm" aria-label="Delete assignment" onClick={() => void api.study.deleteAssignment(a.id).then(() => invalidate('study'))}>
          <Trash2 size={13} />
        </button>
      </div>
      <ol className="stack-2">
        {a.steps.map((s) => (
          <li key={s.id}>
            <label className="row small" style={{ gap: 8, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={s.done} onChange={(e) => void api.study.toggleAssignmentStep(a.id, s.id, e.target.checked).then(() => invalidate('study'))} />
              <span>
                <strong>{s.title}</strong> <span className="muted">— {s.detail}</span>
              </span>
            </label>
          </li>
        ))}
      </ol>
      <div className="row-wrap">
        <Button size="sm" icon={<CalendarPlus size={13} />} onClick={() => void plan()}>
          Plan study time for this
        </Button>
      </div>
      {['essay', 'assignment', 'project', 'lab', 'presentation'].includes(a.kind) ? (
        <details>
          <summary className="small">Get feedback on a draft</summary>
          <div className="stack-2" style={{ marginTop: 8 }}>
            {aiAvailable ? (
              <>
                <Textarea rows={6} value={draft} placeholder="Paste your draft. The AI tutor gives feedback against the subject’s criteria; it won’t rewrite it for you." onChange={(e) => setDraft(e.target.value)} />
                <div>
                  <Button
                    size="sm"
                    loading={busy}
                    disabled={draft.trim().length < 20}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        setFb(await api.study.draftFeedback(a.id, draft));
                      } catch (e) {
                        toast(errorMessage(e), 'error');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Ask for feedback (sends the draft to your AI provider)
                  </Button>
                </div>
                {fb ? <div className="feedback info" style={{ whiteSpace: 'pre-wrap' }}>{fb}</div> : null}
              </>
            ) : (
              <p className="small muted">{aiReason}</p>
            )}
          </div>
        </details>
      ) : null}
    </section>
  );
}
