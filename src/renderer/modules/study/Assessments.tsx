import { Copy, Download, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { answerText } from '../../../shared/study/checking';
import { RUBRIC_NOTE } from '../../../shared/study/subjects';
import { QUESTION_TYPE_LABEL, type Assessment } from '../../../shared/study/types';
import { Badge, Banner, Button, EmptyState, ErrorState, Field, Input, Loading, Select, useConfirm, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { indexOf } from './common';
import { Blocks, RichLine } from './render';

export default function Assessments() {
  const route = useRoute();
  const id = route.segments[2] === 'a' ? route.segments[3] : undefined;
  return id ? <AssessmentView id={id} /> : <List />;
}

function List() {
  const toast = useToast();
  const list = useQuery('study:assessments', () => api.study.assessments());
  const me = useQuery('study:me', () => api.study.me());
  const ai = useQuery('study:ai', () => api.study.aiStatus());
  const [cid, setCid] = useState('');
  const courses = useQuery(me.data ? `study:pcourses:${me.data.grade}` : null, () => api.curriculum.courses({ grade: me.data!.grade }));
  const course = cid || me.data?.courseIds[0] || '';
  const detail = useQuery(course ? `curriculum:course:${course}` : null, () => api.curriculum.course(course));
  const [ids, setIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<'quiz' | 'test' | 'assignment'>('test');
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'mixed' | '1' | '2' | '3' | '4'>('mixed');
  const [minutes, setMinutes] = useState('');
  const [written, setWritten] = useState(true);
  const [useAi, setUseAi] = useState(false);
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const build = async () => {
    setBusy(true);
    try {
      const r = await api.study.buildAssessment(
        { title, expectationIds: ids, format, questionCount: count, difficulty: difficulty === 'mixed' ? 'mixed' : (Number(difficulty) as 1 | 2 | 3 | 4), timeLimitMinutes: minutes ? Number(minutes) : null, includeWritten: written, useAi },
        shared,
      );
      if (r.skipped.length) toast(`Left out (no offline questions): ${r.skipped.map(indexOf).join(', ')}`, 'info');
      invalidate('study');
      navigate(`/study/assessments/a/${r.assessment.id}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page stack-4" style={{ maxWidth: 1000 }}>
      <h1>Assessments</h1>
      <p className="small muted">Build practice quizzes, tests and assignments from verified Ontario expectations — for yourself, or as a parent or educator. Questions from FlowCompanion’s math packs have answer keys checked by code; AI-written ones must be reviewed. These are practice assessments, not official Ontario assessments.</p>
      <section className="card stack-3" aria-label="Build an assessment">
        <div className="field-row">
          <Field label="Title" htmlFor="ab-title">
            <Input id="ab-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Format" htmlFor="ab-format">
            <Select id="ab-format" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
              <option value="quiz">Quiz</option>
              <option value="test">Test</option>
              <option value="assignment">Assignment</option>
            </Select>
          </Field>
          <Field label="Questions" htmlFor="ab-count">
            <Input id="ab-count" type="number" min={1} max={40} value={count} onChange={(e) => setCount(Math.max(1, Math.min(40, Number(e.target.value) || 10)))} style={{ width: 80 }} />
          </Field>
          <Field label="Difficulty" htmlFor="ab-diff">
            <Select id="ab-diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
              <option value="mixed">Mixed</option>
              <option value="1">Warm-up</option>
              <option value="2">Core</option>
              <option value="3">Apply</option>
              <option value="4">Stretch</option>
            </Select>
          </Field>
          <Field label="Time limit (minutes, optional)" htmlFor="ab-min">
            <Input id="ab-min" type="number" min={5} max={240} value={minutes} onChange={(e) => setMinutes(e.target.value)} style={{ width: 90 }} />
          </Field>
        </div>
        <Field label="Expectations">
          <Select value={course} onChange={(e) => (setCid(e.target.value), setIds([]))} aria-label="Course">
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
            <div className="expectation-picker" style={{ marginTop: 8 }}>
              {detail.data.strands.flatMap((s) =>
                s.overall.flatMap((o) =>
                  o.specifics.map((e) => (
                    <label key={e.id} className="row small">
                      <input type="checkbox" checked={ids.includes(e.id)} onChange={(ev) => setIds(ev.target.checked ? [...ids, e.id] : ids.filter((x) => x !== e.id))} />
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
        </Field>
        <div className="row-wrap small">
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={written} onChange={(e) => setWritten(e.target.checked)} /> Include a written question with a rubric
          </label>
          <label className="row" style={{ gap: 6 }} title={ai.data?.available ? undefined : (ai.data?.reason ?? undefined)}>
            <input type="checkbox" disabled={!ai.data?.available} checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> Use AI for expectations without offline questions
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Put it in the shared library (visible to every profile)
          </label>
        </div>
        <div>
          <Button variant="primary" loading={busy} disabled={!title.trim() || !ids.length} onClick={() => void build()}>
            Build
          </Button>
        </div>
      </section>
      {!list.data ? (
        <Loading />
      ) : list.data.length ? (
        <ul className="list">
          {list.data.map((a) => (
            <li key={a.id} className="list-item">
              <button type="button" className="link-button grow" style={{ textAlign: 'left' }} onClick={() => navigate(`/study/assessments/a/${a.id}`)}>
                <strong>{a.title}</strong>
                <span className="small muted">
                  {' '}
                  · {a.items.length} questions · {a.expectationIds.map(indexOf).join(', ')}
                </span>
              </button>
              <Badge tone={a.status === 'reviewed' ? 'ok' : 'warn'}>{a.status === 'reviewed' ? 'Reviewed' : 'Draft'}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No assessments yet" />
      )}
    </div>
  );
}

function AssessmentView({ id }: { id: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const q = useQuery(`study:assessment:${id}`, () => api.study.assessment(id));
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const a = q.data;
  const set = (x: Assessment) => q.setData(() => x);
  const act = (fn: () => Promise<Assessment | void>) =>
    void fn()
      .then((r) => {
        if (r) set(r);
        invalidate('study');
      })
      .catch((e: unknown) => toast(errorMessage(e), 'error'));
  const pending = a.items.filter((i) => !i.reviewed).length;
  return (
    <div className="page stack-4" style={{ maxWidth: 1000 }}>
      <button type="button" className="link-button small" onClick={() => navigate('/study/assessments')}>
        ← Assessments
      </button>
      <div className="row-wrap">
        <h1 className="grow">{a.title}</h1>
        <Badge tone={a.status === 'reviewed' ? 'ok' : 'warn'}>{a.status === 'reviewed' ? 'Reviewed' : 'Draft'}</Badge>
      </div>
      <p className="small muted">
        Practice {a.format}
        {a.timeLimitMinutes ? ` · ${a.timeLimitMinutes} minutes` : ''} · {a.expectationIds.map(indexOf).join(', ')}. Not an official Ontario assessment.
      </p>
      {pending ? <Banner tone="warn">{pending} question{pending === 1 ? ' has' : 's have'} an AI-written answer key. Check each one and mark it reviewed (or remove it) before using this assessment.</Banner> : null}
      <div className="row-wrap">
        <Button variant="primary" icon={<Play size={14} />} onClick={() => act(async () => navigate(`/study/quiz/${(await api.study.takeAssessment(a.id)).id}`))}>
          Take it as practice
        </Button>
        <Button disabled={!!pending || a.status === 'reviewed'} onClick={() => act(() => api.study.markAssessmentReviewed(a.id))}>
          Mark as reviewed
        </Button>
        <Button icon={<Download size={14} />} onClick={() => act(async () => void (await api.study.exportAssessment(a.id, 'markdown')))}>
          Export (printable)
        </Button>
        <Button icon={<Download size={14} />} onClick={() => act(async () => void (await api.study.exportAssessment(a.id, 'json')))}>
          Export JSON
        </Button>
        <Button icon={<Copy size={14} />} onClick={() => act(async () => navigate(`/study/assessments/a/${(await api.study.duplicateAssessment(a.id)).id}`))}>
          Duplicate
        </Button>
        <Button
          variant="ghost"
          icon={<Trash2 size={14} />}
          onClick={async () => {
            if (!(await confirm({ title: 'Delete this assessment?', message: 'Results of attempts already taken are kept.', confirmLabel: 'Delete', danger: true }))) return;
            act(async () => {
              await api.study.deleteAssessment(a.id);
              navigate('/study/assessments');
            });
          }}
        >
          Delete
        </Button>
      </div>
      {a.items.map((it, i) => (
        <section key={it.id} className="card stack-2" aria-label={`Question ${i + 1}`}>
          <div className="row tiny">
            <strong className="grow">
              {i + 1}. {QUESTION_TYPE_LABEL[it.question.type]} · {it.points} point{it.points === 1 ? '' : 's'} · {indexOf(it.question.expectationId)}
            </strong>
            {it.question.keyVerified ? <Badge tone="ok">Key checked by code</Badge> : it.question.origin === 'ai' ? <Badge tone="warn">AI-written key</Badge> : null}
          </div>
          <Blocks blocks={it.question.prompt} />
          {it.question.type === 'multiple_choice' ? (
            <ul className="small">
              {it.question.choices.map((c) => (
                <li key={c.id}>
                  {c.id}) <RichLine text={c.text} />
                </li>
              ))}
            </ul>
          ) : null}
          {it.question.type === 'written' ? (
            <div className="small">
              <p>Rubric: {it.question.rubric.map((c) => c.label).join(' · ')}</p>
              <p className="tiny faint">{RUBRIC_NOTE}</p>
            </div>
          ) : (
            <p className="small">
              Answer key: <RichLine text={answerText(it.question)} />
            </p>
          )}
          <div className="row-wrap">
            {!it.question.keyVerified && it.question.type !== 'written' ? (
              <label className="row small" style={{ gap: 6 }}>
                <input type="checkbox" checked={it.reviewed} onChange={(e) => act(() => api.study.reviewAssessmentItem(a.id, it.id, e.target.checked))} /> I checked this question and its answer
              </label>
            ) : null}
            {it.question.origin === 'generated' ? (
              <Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={() => act(() => api.study.regenerateAssessmentItem(a.id, it.id))}>
                Replace
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => act(() => api.study.removeAssessmentItem(a.id, it.id))}>
              Remove
            </Button>
          </div>
        </section>
      ))}
    </div>
  );
}
