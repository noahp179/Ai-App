import { BookOpen, ChevronDown, ChevronRight, FileText, ListChecks, MessageCircle, Search, ShieldCheck, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { courseLabel } from '../../../shared/curriculum/types';
import { GAP_LABEL, GRADES, LESSON_MODES, LESSON_MODE_LABEL, type LessonMode } from '../../../shared/study/types';
import { Badge, Banner, Button, EmptyState, ErrorState, Field, Input, Loading, Select, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { ExpLink, StatusBadge, VerificationBadge } from './common';
import { OfficialBox, OfficialHtml, SourceLink } from './render';

export default function Explore() {
  const route = useRoute();
  const seg = route.segments[1];
  if (seg === 'course' && route.segments[2]) return <CoursePage id={decodeURIComponent(route.segments[2])} />;
  if (seg === 'e' && route.segments[2]) return <ExpectationPage id={decodeURIComponent(route.segments[2])} />;
  return <Browse />;
}

function SourceNote() {
  const o = useQuery('curriculum:overview', () => api.curriculum.overview());
  if (!o.data) return null;
  return (
    <p className="row tiny muted" style={{ gap: 6 }}>
      <ShieldCheck size={13} color="var(--ok)" />
      <span>
        Official expectations from the Ontario Ministry of Education ({' '}
        <SourceLink url={o.data.source.site} label="dcp.edu.gov.on.ca" />
        ), imported {o.data.source.fetchedAt.slice(0, 10)}
        {o.data.source.lastCheckedAt ? `, last checked ${o.data.source.lastCheckedAt.slice(0, 10)}` : ''}. {o.data.source.copyright}
      </span>
    </p>
  );
}

function Browse() {
  const me = useQuery('study:me', () => api.study.me());
  const [grade, setGrade] = useState<number>(me.data?.grade ?? 7);
  const [doc, setDoc] = useState<string>('');
  const [q, setQ] = useState('');
  const overview = useQuery('curriculum:overview', () => api.curriculum.overview());
  const courses = useQuery(`curriculum:courses:${grade}:${doc}`, () => api.curriculum.courses({ grade, documentId: doc || null }));
  const hits = useQuery(q.trim().length >= 2 ? `curriculum:search:${grade}:${q}` : null, () => api.curriculum.search(q, { grade, limit: 30 }));
  const subjects = overview.data?.subjects.filter((s) => s.grades.includes(grade)) ?? [];
  return (
    <div className="page stack-4" style={{ maxWidth: 1100 }}>
      <div>
        <h1>Ontario curriculum</h1>
        <SourceNote />
      </div>
      <div className="field-row">
        <Field label="Grade" htmlFor="ex-grade">
          <Select id="ex-grade" value={String(grade)} onChange={(e) => (setGrade(Number(e.target.value)), setDoc(''))}>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subject" htmlFor="ex-subject">
          <Select id="ex-subject" value={doc} onChange={(e) => setDoc(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.documentId} value={s.documentId}>
                {s.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Search expectations, topics or course codes" htmlFor="ex-q">
          <div className="row" style={{ gap: 6 }}>
            <Search size={14} />
            <Input id="ex-q" value={q} placeholder="e.g. fractions, MTH1W, photosynthesis" onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} />
          </div>
        </Field>
      </div>
      {q.trim().length >= 2 ? (
        <section className="stack-2" aria-label="Search results">
          <h2 className="h2">Search results</h2>
          {!hits.data ? (
            <Loading />
          ) : hits.data.length ? (
            <ul className="list">
              {hits.data.map((h) => (
                <li key={h.id} className="list-item">
                  <button type="button" className="link-button grow" style={{ textAlign: 'left' }} onClick={() => navigate(h.type === 'course' ? `/study/course/${encodeURIComponent(h.id)}` : `/study/e/${encodeURIComponent(h.id)}`)}>
                    <strong>{h.title}</strong>
                    <span className="small muted"> — {h.snippet}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">No matches in Grade {grade}.</p>
          )}
        </section>
      ) : null}
      {!courses.data ? (
        <Loading />
      ) : (
        <div className="grid grid-2">
          {courses.data.map((c) => (
            <button key={c.id} type="button" className="card interactive stack-2" style={{ textAlign: 'left' }} onClick={() => navigate(`/study/course/${encodeURIComponent(c.id)}`)}>
              <div className="row">
                <strong className="grow">{c.label}</strong>
                <VerificationBadge v={c.verification} />
              </div>
              <span className="tiny muted">
                {c.documentTitle}
                {c.expectationsSource === 'digital' ? ` · ${c.specificCount} specific expectations` : ' · expectations in the Ministry PDF only'}
              </span>
            </button>
          ))}
        </div>
      )}
      {overview.data ? (
        <p className="tiny faint">
          {overview.data.courses} courses for Grades {overview.data.grades[0]}–{overview.data.grades.at(-1)}; {overview.data.pdfOnlyCourses} are published by the Ministry only as PDFs, so FlowCompanion lists them but has not imported their expectations. See Coverage for what can be studied offline.
        </p>
      ) : null}
    </div>
  );
}

function CoursePage({ id }: { id: string }) {
  const me = useQuery('study:me', () => api.study.me());
  const course = useQuery(`curriculum:course:${id}`, () => api.curriculum.course(id));
  const progress = useQuery(me.data ? `study:course:${id}` : null, () => api.study.courseProgress(id));
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (course.error) return <ErrorState error={course.error} />;
  if (!course.data) return <Loading />;
  const { course: c, document: d, strands, prerequisiteCourses } = course.data;
  const rows = new Map((progress.data?.rows ?? []).map((r) => [r.expectationId, r]));
  return (
    <div className="page stack-4" style={{ maxWidth: 1100 }}>
      <div>
        <button type="button" className="link-button small" onClick={() => navigate('/study/explore')}>
          ← Curriculum
        </button>
        <div className="row" style={{ marginTop: 6 }}>
          <h1 className="grow">{c.label}</h1>
          <VerificationBadge v={c.verification} />
        </div>
        <p className="small muted">
          {d.title} curriculum{d.year ? ` (${d.year})` : ''}
          {c.yearIssued ? ` · course issued ${c.yearIssued}` : ''} · <SourceLink url={c.url} label="Ministry page" />
          {c.pdf ? (
            <>
              {' '}
              · <SourceLink url={c.pdf.url} label="Curriculum PDF" />
            </>
          ) : null}
        </p>
      </div>
      {c.description ? <p>{c.description}</p> : null}
      {c.code ? (
        <dl className="facts small">
          <dt>Course code</dt>
          <dd>{c.code}</dd>
          <dt>Course type</dt>
          <dd>{c.courseType ?? '—'}</dd>
          <dt>Prerequisite</dt>
          <dd>
            {prerequisiteCourses.length
              ? prerequisiteCourses.map((p, i) => (
                  <span key={i}>
                    {i ? '; ' : ''}
                    {p.courseId ? (
                      <button type="button" className="link-button" onClick={() => navigate(`/study/course/${encodeURIComponent(p.courseId!)}`)}>
                        {p.text}
                      </button>
                    ) : (
                      p.text
                    )}
                  </span>
                ))
              : 'None'}
          </dd>
        </dl>
      ) : null}
      {c.expectationsSource === 'pdf' ? (
        <Banner tone="info" title="Expectations are in the Ministry PDF">
          The Ministry publishes this course’s expectations only as a PDF, so FlowCompanion has not imported them and has no lessons for it. Open the PDF from the Ministry link above. The AI tutor can still help with general questions, but it is not linked to verified expectations for this course.
        </Banner>
      ) : null}
      {strands.map((s) => (
        <section key={s.id} className="card stack-3">
          <button type="button" className="row link-button" style={{ textAlign: 'left' }} onClick={() => setOpen({ ...open, [s.id]: !open[s.id] })} aria-expanded={open[s.id] !== false}>
            {open[s.id] === false ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            <h2 className="h2">
              {s.index}. {s.title}
            </h2>
          </button>
          {open[s.id] === false
            ? null
            : s.overall.map((o) => (
                <div key={o.id} className="stack-2" style={{ paddingLeft: 8 }}>
                  <div className="small">
                    <strong>{o.index}</strong> {o.title ? <em>{o.title}: </em> : null}
                    <span className="muted">{o.text}</span>
                  </div>
                  <ul className="list">
                    {o.specifics.map((e) => {
                      const r = rows.get(e.id);
                      return (
                        <li key={e.id} className="list-item">
                          <ExpLink id={e.id}>
                            <strong>{e.index}</strong>
                          </ExpLink>
                          <span className="grow small">{e.text.split('\n')[0]}</span>
                          {r?.offline ? <Badge tone="ok" title="Offline lesson and code-checked practice">Lesson</Badge> : e.supportCount ? <Badge tone="outline" title="Ministry teacher supports available offline">Supports</Badge> : null}
                          {r ? <StatusBadge status={r.status} estimate={r.estimate} /> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
        </section>
      ))}
    </div>
  );
}

function ExpectationPage({ id }: { id: string }) {
  const toast = useToast();
  const me = useQuery('study:me', () => api.study.me());
  const e = useQuery(`curriculum:e:${id}`, () => api.curriculum.expectation(id));
  const p = useQuery(me.data ? `study:e:${id}` : null, () => api.study.expectationProgress(id));
  const [mode, setMode] = useState<LessonMode>('full');
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);
  const [showSupports, setShowSupports] = useState(false);
  if (e.error) return <ErrorState error={e.error} />;
  if (!e.data) return <Loading />;
  const x = e.data;
  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    try {
      await fn();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };
  const start = (source: 'auto' | 'ministry' | 'ai') =>
    run(`lesson-${source}`, async () => {
      const l = await api.study.startLesson({ expectationId: id, mode, minutes: mode === 'timed' ? minutes : null, source });
      navigate(`/study/lesson/${l.id}`);
    });
  const quiz = (kind: 'practice' | 'diagnostic') =>
    run(kind, async () => {
      const q = await api.study.createQuiz({ kind, expectationIds: [id] });
      navigate(`/study/quiz/${q.id}`);
    });
  const tutor = () =>
    run('tutor', async () => {
      const s = await api.study.createTutorSession({ expectationId: id });
      navigate(`/study/tutor/${s.id}`);
    });
  const src = p.data?.sources;
  return (
    <div className="page stack-4" style={{ maxWidth: 1000 }}>
      <button type="button" className="link-button small" onClick={() => navigate(`/study/course/${encodeURIComponent(x.courseId)}`)}>
        ← {courseLabel(x.course)}
      </button>
      <div className="row">
        <h1 className="grow">
          {x.index}
          {x.title ? ` — ${x.title}` : ''}
        </h1>
        <VerificationBadge v={x.verification} />
      </div>
      <OfficialBox index={x.index} course={x.course.label} html={x.html} url={x.url} />
      {x.parent ? (
        <p className="small muted">
          Part of overall expectation <strong>{x.parent.index}</strong>: {x.parent.text}
        </p>
      ) : null}
      <p className="tiny faint">
        Strand {x.strand.index}: {x.strand.title}. Checked against the Ministry site {x.checkedAt.slice(0, 10)}.
        {x.revisions.length ? ` Changed by the Ministry: ${x.revisions.map((r) => `${r.change} on ${r.at.slice(0, 10)}`).join('; ')}.` : ''}
      </p>
      {x.revisions.some((r) => r.change === 'changed') ? (
        <details className="small">
          <summary>Earlier wording</summary>
          {x.revisions
            .filter((r) => r.change === 'changed')
            .map((r, i) => (
              <p key={i} className="muted">
                Before {r.at.slice(0, 10)}: {r.before}
              </p>
            ))}
        </details>
      ) : null}
      {x.kind === 'overall' ? (
        <section className="stack-2">
          <h2 className="h2">Specific expectations</h2>
          <ul className="list">
            {x.specifics.map((s) => (
              <li key={s.id} className="list-item">
                <ExpLink id={s.id}>{s.index}</ExpLink> <span className="small">{s.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {x.kind === 'specific' && me.data && p.data ? (
        <section className="card stack-3" aria-label="Study this expectation">
          <div className="row">
            <h2 className="h2 grow">Study this</h2>
            <StatusBadge status={p.data.record.status} estimate={p.data.showEstimates ? p.data.record.estimate : null} />
          </div>
          <ul className="tiny muted">
            {p.data.record.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <p className="small">
            <strong>Next:</strong> {p.data.recommendation.title}. <span className="muted">{p.data.recommendation.reason}</span>
          </p>
          {p.data.gaps.map((g, i) => (
            <Banner key={i} tone="warn">
              {GAP_LABEL[g.kind]}: {g.detail}
              {g.relatedExpectationId && g.relatedExpectationId !== id ? (
                <>
                  {' '}
                  <ExpLink id={g.relatedExpectationId}>Review the earlier skill</ExpLink>
                </>
              ) : null}
            </Banner>
          ))}
          <div className="field-row">
            <Field label="Kind of session" htmlFor="ex-mode">
              <Select id="ex-mode" value={mode} onChange={(ev) => setMode(ev.target.value as LessonMode)}>
                {LESSON_MODES.map((m) => (
                  <option key={m} value={m}>
                    {LESSON_MODE_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
            {mode === 'timed' ? (
              <Field label="Minutes" htmlFor="ex-min">
                <Select id="ex-min" value={String(minutes)} onChange={(ev) => setMinutes(Number(ev.target.value))}>
                  {[5, 10, 20, 30].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          <div className="row-wrap">
            {src?.authored ? (
              <Button variant="primary" icon={<BookOpen size={14} />} loading={busy === 'lesson-auto'} onClick={() => void start('auto')}>
                Start lesson
              </Button>
            ) : null}
            {!src?.authored && src?.ministry ? (
              <Button variant={src.ai.ok ? 'default' : 'primary'} icon={<FileText size={14} />} loading={busy === 'lesson-ministry'} onClick={() => void start('ministry')}>
                Study from the Ministry supports
              </Button>
            ) : null}
            {!src?.authored ? (
              <Button variant={src?.ai.ok ? 'primary' : 'default'} disabled={!src?.ai.ok} title={src?.ai.reason ?? undefined} loading={busy === 'lesson-ai'} onClick={() => void start('ai')}>
                AI lesson
              </Button>
            ) : null}
            <Button icon={<ListChecks size={14} />} loading={busy === 'practice'} onClick={() => void quiz('practice')} disabled={!src?.authored && !src?.ai.ok}>
              Practice quiz
            </Button>
            <Button icon={<Stethoscope size={14} />} loading={busy === 'diagnostic'} onClick={() => void quiz('diagnostic')} disabled={!src?.authored && !src?.ai.ok}>
              Diagnostic check
            </Button>
            <Button icon={<MessageCircle size={14} />} loading={busy === 'tutor'} onClick={() => void tutor()} disabled={!src?.ai.ok} title={src?.ai.reason ?? undefined}>
              Ask the tutor
            </Button>
          </div>
          {!src?.authored ? (
            <p className="tiny faint">
              FlowCompanion has no offline lesson with checked questions for this expectation yet.{' '}
              {src?.ai.ok ? 'AI lessons are written for you and are not reviewed by a teacher.' : src?.ai.reason}
            </p>
          ) : null}
          {p.data.prerequisites.length ? (
            <p className="small">
              Builds on:{' '}
              {p.data.prerequisites.map((pr, i) => (
                <span key={pr}>
                  {i ? ', ' : ''}
                  <ExpLink id={pr}>{pr.split(':').pop()}</ExpLink>
                </span>
              ))}
            </p>
          ) : null}
        </section>
      ) : x.kind === 'specific' && !me.data ? (
        <EmptyState title="Open a student profile to study this">
          <Button variant="primary" onClick={() => navigate('/study')}>
            Choose a profile
          </Button>
        </EmptyState>
      ) : null}

      {x.supports.length ? (
        <section className="stack-2">
          <button type="button" className="link-button" onClick={() => setShowSupports((v) => !v)} aria-expanded={showSupports}>
            {showSupports ? 'Hide' : 'Show'} the Ministry’s teacher supports ({x.supports.length})
          </button>
          {showSupports
            ? x.supports.map((s, i) => (
                <figure key={i} className="support">
                  <figcaption className="tiny">Ministry teacher support · {s.kind}</figcaption>
                  <OfficialHtml html={s.html} />
                  {s.omittedMedia ? <p className="tiny faint">An image was left out; see the Ministry page.</p> : null}
                </figure>
              ))
            : null}
        </section>
      ) : null}
    </div>
  );
}
