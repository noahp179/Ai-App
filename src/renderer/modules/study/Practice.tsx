import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { answerText } from '../../../shared/study/checking';
import { GAP_LABEL, QUIZ_KINDS, QUIZ_KIND_LABEL, QUIZ_KIND_RULES, type QuizAttempt, type QuizKind } from '../../../shared/study/types';
import { Banner, Button, EmptyState, ErrorState, Field, Input, Loading, Select, Tabs, Textarea, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { ExpLink, StatusBadge, indexOf } from './common';
import { QuestionCard, type Feedback } from './QuestionCard';
import { Blocks, RichLine } from './render';

export default function Practice() {
  const route = useRoute();
  const seg = route.segments[1];
  if (seg === 'quiz' && route.segments[2]) return <QuizPage id={route.segments[2]} />;
  if (seg === 'review') return <Review />;
  return <Builder />;
}

function Builder() {
  const toast = useToast();
  const { settings } = useSettings();
  const me = useQuery('study:me', () => api.study.me());
  const [courseId, setCourseId] = useState('');
  const courses = useQuery(me.data ? `study:pcourses:${me.data.grade}` : null, () => api.curriculum.courses({ grade: me.data!.grade }));
  const cid = courseId || me.data?.courseIds[0] || courses.data?.find((c) => c.expectationsSource === 'digital')?.id || '';
  const prog = useQuery(cid ? `study:course:${cid}` : null, () => api.study.courseProgress(cid));
  const [picked, setPicked] = useState<string[]>([]);
  const [kind, setKind] = useState<QuizKind>('practice');
  const [length, setLength] = useState<number>(settings.study.quizLength);
  const [timed, setTimed] = useState(settings.study.timedPracticeTests);
  const [minutes, setMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const history = useQuery('study:quizzes', () => api.study.quizzes());
  const ai = useQuery('study:ai', () => api.study.aiStatus());
  useEffect(() => setPicked([]), [cid]);
  if (!me.data) return <Loading />;
  const start = async () => {
    setBusy(true);
    try {
      const q = await api.study.createQuiz({ kind, expectationIds: picked, length, timed: kind === 'summative_practice' ? timed : false, minutes });
      navigate(`/study/quiz/${q.id}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page stack-4" style={{ maxWidth: 1000 }}>
      <h1>Practice and quizzes</h1>
      <div className="card stack-4">
        <div className="field-row">
          <Field label="Course" htmlFor="pq-course">
            <Select id="pq-course" value={cid} onChange={(e) => setCourseId(e.target.value)}>
              {(courses.data ?? [])
                .filter((c) => c.expectationsSource === 'digital')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Kind" htmlFor="pq-kind">
            <Select id="pq-kind" value={kind} onChange={(e) => setKind(e.target.value as QuizKind)}>
              {QUIZ_KINDS.filter((k) => k !== 'reflection').map((k) => (
                <option key={k} value={k}>
                  {QUIZ_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Questions" htmlFor="pq-len">
            <Select id="pq-len" value={String(length)} onChange={(e) => setLength(Number(e.target.value))}>
              {[3, 5, 10, 15].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          {kind === 'summative_practice' ? (
            <>
              <label className="row small" style={{ gap: 6, alignSelf: 'end' }}>
                <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} /> Timed
              </label>
              {timed ? (
                <Field label="Minutes" htmlFor="pq-min">
                  <Input id="pq-min" type="number" min={5} max={180} value={minutes} onChange={(e) => setMinutes(Math.max(5, Math.min(180, Number(e.target.value) || 15)))} style={{ width: 90 }} />
                </Field>
              ) : null}
            </>
          ) : null}
        </div>
        <Banner tone="info">{QUIZ_KIND_RULES[kind]}</Banner>
        {!prog.data ? (
          <Loading />
        ) : (
          <fieldset className="stack-2">
            <legend className="small">Choose expectations ({picked.length} chosen)</legend>
            <div className="expectation-picker">
              {prog.data.rows.map((r) => {
                const usable = r.offline || !!ai.data?.available;
                return (
                  <label key={r.expectationId} className={`row small ${usable ? '' : 'faint'}`} title={usable ? undefined : 'No offline questions; AI tutoring is off.'}>
                    <input type="checkbox" disabled={!usable} checked={picked.includes(r.expectationId)} onChange={(e) => setPicked(e.target.checked ? [...picked, r.expectationId] : picked.filter((x) => x !== r.expectationId))} />
                    <strong>{r.index}</strong>
                    <span className="grow ellipsis">{r.offline ? 'Offline questions' : 'AI questions'}</span>
                    <StatusBadge status={r.status} />
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        <div>
          <Button variant="primary" loading={busy} disabled={!picked.length} onClick={() => void start()}>
            Start
          </Button>
        </div>
      </div>
      <section className="stack-2">
        <h2 className="h2">Assessment history</h2>
        {history.data?.length ? (
          <table className="table small">
            <thead>
              <tr>
                <th>When</th>
                <th>Kind</th>
                <th>Title</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((h) => (
                <tr key={h.id}>
                  <td>{h.startedAt.slice(0, 10)}</td>
                  <td>{QUIZ_KIND_LABEL[h.kind]}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => navigate(`/study/quiz/${h.id}`)}>
                      {h.title}
                    </button>
                  </td>
                  <td>{h.status === 'completed' ? `${h.score ?? 0} / ${h.maxScore ?? h.questions}${h.hintsUsed ? ` · ${h.hintsUsed} hints` : ''}` : h.status === 'active' ? 'In progress' : 'Stopped'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="small muted">No quizzes yet.</p>
        )}
      </section>
    </div>
  );
}

function Countdown({ deadline, onEnd }: { deadline: string; onEnd: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Date.parse(deadline) - now);
  useEffect(() => {
    if (left === 0) onEnd();
  }, [left === 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className="row small" role="timer" aria-live="off" style={{ gap: 4 }}>
      <Clock size={13} /> {m}:{String(s).padStart(2, '0')} left
    </span>
  );
}

function QuizPage({ id }: { id: string }) {
  const toast = useToast();
  const q = useQuery(`study:quiz:${id}`, () => api.study.quiz(id));
  const ai = useQuery('study:ai', () => api.study.aiStatus());
  const [i, setI] = useState(0);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <Loading />;
  const a = q.data;
  const set = (x: QuizAttempt) => q.setData(() => x);
  const finish = async () => {
    try {
      set(await api.study.finishQuiz(a.id));
      invalidate('study');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  if (a.status !== 'active') return <Results a={a} />;
  const item = a.items[Math.min(i, a.items.length - 1)]!;
  const answered = a.items.filter((x) => x.answer).length;
  return (
    <div className="page stack-4" style={{ maxWidth: 860 }}>
      <div className="row-wrap">
        <h1 className="grow">{a.title}</h1>
        {a.deadlineAt ? <Countdown deadline={a.deadlineAt} onEnd={() => void q.reload()} /> : null}
      </div>
      <Banner tone="info">{QUIZ_KIND_RULES[a.kind]}</Banner>
      {a.hasUnverifiedKeys ? <Banner tone="warn">Some questions were written by AI; their answer keys are not checked by FlowCompanion and count for less in your progress.</Banner> : null}
      {a.skipped.length ? <p className="tiny faint">Left out (no offline questions and AI is off): {a.skipped.map(indexOf).join(', ')}</p> : null}
      <p className="small muted">
        Question {i + 1} of {a.items.length} · {answered} answered
      </p>
      <QuestionCard
        key={item.id}
        q={item.question}
        number={i + 1}
        answered={item.answer}
        feedback={feedback[item.id] ?? null}
        hintsAllowed={a.settings.hints}
        aiFeedbackAvailable={ai.data?.available}
        onHint={() => api.study.quizHint(a.id, item.id)}
        onSubmit={async (r, opts) => {
          const res = await api.study.answerQuiz(a.id, item.id, r, opts);
          if (res.result) setFeedback((f) => ({ ...f, [item.id]: { result: res.result!, answer: res.answer, solution: res.solution, misconception: res.misconception, adaptReason: res.adaptReason } }));
          set(res.attempt);
        }}
      />
      <div className="row">
        <Button disabled={i === 0} onClick={() => setI(i - 1)}>
          Previous
        </Button>
        <span className="grow" />
        {i < a.items.length - 1 ? (
          <Button variant="primary" onClick={() => setI(i + 1)}>
            Next question
          </Button>
        ) : null}
        <Button variant={i === a.items.length - 1 ? 'primary' : 'default'} onClick={() => void finish()}>
          Finish{answered < a.items.length ? ` (${a.items.length - answered} unanswered)` : ''}
        </Button>
      </div>
    </div>
  );
}

function Results({ a }: { a: QuizAttempt }) {
  return (
    <div className="page stack-4" style={{ maxWidth: 860 }}>
      <h1>{a.title}</h1>
      <div className="card stack-2">
        <p style={{ fontSize: '1.2rem' }}>
          {a.score ?? 0} out of {a.maxScore ?? a.items.length}
        </p>
        <p className="small muted">
          {QUIZ_KIND_LABEL[a.kind]} · {a.status === 'abandoned' ? 'stopped early' : `finished ${a.finishedAt?.slice(0, 16).replace('T', ' ')}`}. Practice result — not an official test or mark.
        </p>
        <div className="row-wrap">
          <Button onClick={() => navigate('/study/practice')}>Back to practice</Button>
          <Button onClick={() => navigate('/study/review')}>See what to review</Button>
        </div>
      </div>
      {a.items.map((it, n) => (
        <section key={it.id} className="card stack-2" aria-label={`Question ${n + 1}`}>
          <div className="row">
            {it.answer?.result.correct ? <CheckCircle2 size={16} color="var(--ok)" /> : it.answer ? <XCircle size={16} color="var(--danger)" /> : null}
            <strong className="grow">Question {n + 1}</strong>
            <span className="tiny faint">{it.answer ? (it.answer.hintsUsed ? `${it.answer.hintsUsed} hint(s)` : 'no hints') : 'not answered'}</span>
          </div>
          <Blocks blocks={it.question.prompt} />
          {it.answer ? <p className="small">{it.answer.result.feedback}</p> : null}
          {it.question.type !== 'written' ? (
            <p className="small">
              Answer: <RichLine text={answerText(it.question)} />
            </p>
          ) : null}
          {it.question.solution.length ? (
            <details>
              <summary className="small">Worked solution</summary>
              <Blocks blocks={it.question.solution} />
            </details>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function Review() {
  const toast = useToast();
  const queue = useQuery('study:reviews', () => api.study.reviewQueue());
  const gaps = useQuery('study:gaps', () => api.study.gaps());
  const me = useQuery('study:me', () => api.study.me());
  const [tab, setTab] = useState<'due' | 'gaps' | 'reflect'>('due');
  const [busy, setBusy] = useState(false);
  const start = async (ids?: string[]) => {
    setBusy(true);
    try {
      const q = await api.study.startReview(ids);
      navigate(`/study/quiz/${q.id}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const byMis = useMemo(() => gaps.data ?? [], [gaps.data]);
  return (
    <div className="page stack-4" style={{ maxWidth: 1000 }}>
      <h1>Review</h1>
      <Tabs
        label="Review sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'due', label: 'Spaced review' },
          { value: 'gaps', label: 'Knowledge gaps' },
          { value: 'reflect', label: 'Reflect' },
        ]}
      />
      {tab === 'due' ? (
        <section className="stack-3">
          <p className="small muted">Coming back to a skill just before you’d forget it helps it stick. The gap between reviews grows when you get things right without hints and shrinks when you don’t.</p>
          {!queue.data ? (
            <Loading />
          ) : queue.data.length ? (
            <>
              <ul className="list">
                {queue.data.map((r) => (
                  <li key={r.expectationId} className="list-item">
                    <ExpLink id={r.expectationId}>{indexOf(r.expectationId)}</ExpLink>
                    <span className="grow tiny muted">due {r.nextReviewAt?.slice(0, 10)}</span>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
              <div>
                <Button variant="primary" loading={busy} onClick={() => void start()}>
                  Start a review quiz
                </Button>
              </div>
            </>
          ) : (
            <EmptyState title="Nothing due for review">Practise something new; reviews will be scheduled from your results.</EmptyState>
          )}
        </section>
      ) : null}
      {tab === 'gaps' ? (
        <section className="stack-3">
          <p className="small muted">Patterns in your answers that are worth a targeted look. These describe answers, not you.</p>
          {!gaps.data ? (
            <Loading />
          ) : byMis.length ? (
            <ul className="list">
              {byMis.map((g, i) => (
                <li key={i} className="list-item stack-1">
                  <div className="row">
                    <ExpLink id={g.expectationId}>{indexOf(g.expectationId)}</ExpLink>
                    <strong className="grow small">{GAP_LABEL[g.kind]}</strong>
                  </div>
                  <span className="small muted">{g.detail}</span>
                  <div className="row-wrap">
                    <Button
                      size="sm"
                      onClick={() =>
                        void api.study
                          .startLesson({ expectationId: g.kind === 'prerequisite' && g.relatedExpectationId ? g.relatedExpectationId : g.expectationId, mode: g.kind === 'repeated_error' ? 'mistakes' : g.kind === 'decay' ? 'revision' : 'concept' })
                          .then((l) => navigate(`/study/lesson/${l.id}`))
                          .catch((e: unknown) => toast(errorMessage(e), 'error'))
                      }
                    >
                      {g.kind === 'repeated_error' ? 'Review my mistakes' : g.kind === 'prerequisite' ? 'Review the earlier skill' : g.kind === 'decay' ? 'Quick revision' : 'Go over the idea again'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No gaps found">Keep practising; patterns show up after a few answers.</EmptyState>
          )}
        </section>
      ) : null}
      {tab === 'reflect' && me.data ? <Reflect courseIds={me.data.courseIds} /> : null}
    </div>
  );
}

function Reflect({ courseIds }: { courseIds: string[] }) {
  const toast = useToast();
  const courses = useQuery(`study:reflect:courses:${courseIds.join(',')}`, () => Promise.all(courseIds.map((c) => api.curriculum.course(c).then((d) => d.course))));
  const [course, setCourse] = useState(courseIds[0] ?? '');
  const [conf, setConf] = useState(3);
  const [note, setNote] = useState('');
  if (!courseIds.length) return <p className="small muted">Add your courses in Learning settings to reflect on them.</p>;
  return (
    <section className="card stack-3">
      <p className="small muted">A self-reflection is your own view. It is saved for you to look back on and is never counted as proof of what you know.</p>
      <div className="field-row">
        <Field label="Course" htmlFor="rf-course">
          <Select id="rf-course" value={course} onChange={(e) => setCourse(e.target.value)}>
            {(courses.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="How confident do you feel? (1–5)" htmlFor="rf-conf">
          <Select id="rf-conf" value={String(conf)} onChange={(e) => setConf(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="What went well, and what’s still tricky? (optional)" htmlFor="rf-note">
        <Textarea id="rf-note" rows={3} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div>
        <Button
          variant="primary"
          onClick={() =>
            void api.study
              .reflect({ courseId: course, confidence: conf, note })
              .then(() => {
                setNote('');
                toast('Reflection saved', 'success');
                invalidate('study');
              })
              .catch((e: unknown) => toast(errorMessage(e), 'error'))
          }
        >
          Save reflection
        </Button>
      </div>
    </section>
  );
}
