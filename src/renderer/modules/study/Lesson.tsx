import { ArrowLeft, ArrowRight, NotebookPen, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ALT_EXPLANATIONS, ALT_LABEL, LESSON_MODE_LABEL, MASTERY_LABEL, STEP_LABEL, type AltExplanation, type Block, type LessonSession } from '../../../shared/study/types';
import { Badge, Banner, Button, ErrorState, Loading, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { navigate } from '../../lib/router';
import { ExpLink, StatusBadge } from './common';
import { QuestionCard, type Feedback } from './QuestionCard';
import { Blocks } from './render';

export default function LessonPage({ id }: { id: string }) {
  const toast = useToast();
  const q = useQuery(`study:lesson:${id}`, () => api.study.lesson(id));
  const ai = useQuery('study:ai', () => api.study.aiStatus());
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [alt, setAlt] = useState<{ blocks: Block[]; label: string; source: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <Loading />;
  const s = q.data;
  const set = (next: LessonSession) => q.setData(() => next);
  const step = s.content.steps[s.stepIndex]!;
  const last = s.stepIndex === s.content.steps.length - 1;
  const act = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    try {
      await fn();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const go = (i: number) =>
    act('nav', async () => {
      set(await api.study.goToStep(s.id, i));
      setAlt(null);
      window.scrollTo({ top: 0 });
    });
  const explain = (k: AltExplanation) =>
    act(`alt-${k}`, async () => {
      const r = await api.study.explainAgain(s.id, k);
      setAlt({ blocks: r.blocks, label: r.label, source: r.source });
    });
  const prereqMissed = s.content.steps.some((st) => st.kind === 'prerequisites' && st.questionIds.some((qid) => s.answers[qid]?.result.correct === false));
  const prereqStep = s.content.steps.find((st) => st.kind === 'prerequisites');

  return (
    <div className="page stack-4" style={{ maxWidth: 900 }}>
      <div className="row-wrap">
        <button type="button" className="link-button small" onClick={() => navigate(`/study/e/${encodeURIComponent(s.expectationId)}`)}>
          ← Back to the expectation
        </button>
        <span className="grow" />
        {s.status === 'active' ? (
          <Button size="sm" icon={<Pause size={13} />} loading={busy === 'pause'} onClick={() => void act('pause', async () => set(await api.study.pauseLesson(s.id)))}>
            Pause
          </Button>
        ) : s.status === 'paused' ? (
          <Button size="sm" icon={<Play size={13} />} loading={busy === 'resume'} onClick={() => void act('resume', async () => set(await api.study.resumeLesson(s.id)))}>
            Resume
          </Button>
        ) : null}
        <Button
          size="sm"
          icon={<RotateCcw size={13} />}
          loading={busy === 'repeat'}
          onClick={() =>
            void act('repeat', async () => {
              const n = await api.study.repeatLesson(s.id);
              navigate(`/study/lesson/${n.id}`);
            })
          }
        >
          Start again
        </Button>
      </div>
      <div>
        <h1>{s.content.title}</h1>
        <p className="tiny faint" style={{ marginTop: 4 }}>
          {LESSON_MODE_LABEL[s.mode]}
          {s.minutes ? ` (${s.minutes} min)` : ''} · {s.content.provenance}
        </p>
      </div>
      <ol className="lesson-progress" aria-label="Lesson steps">
        {s.content.steps.map((st, i) => (
          <li key={i}>
            <button type="button" className={`step-pill ${i === s.stepIndex ? 'current' : i < s.stepIndex ? 'done' : ''}`} aria-current={i === s.stepIndex ? 'step' : undefined} onClick={() => void go(i)} disabled={s.status === 'completed'}>
              {i + 1}. {STEP_LABEL[st.kind]}
            </button>
          </li>
        ))}
      </ol>
      {s.status === 'paused' ? <Banner tone="info">This lesson is paused. Resume whenever you’re ready; your place and answers are saved.</Banner> : null}

      <section className="card stack-4" aria-label={step.title}>
        <h2 className="h2">{step.title}</h2>
        <Blocks blocks={step.blocks} />
        {step.kind === 'guided' && prereqMissed ? (
          <Banner tone="warn">
            The warm-up showed an earlier skill needs work. These questions start gently, and you can{' '}
            {prereqStep?.forExpectationId ? <ExpLink id={prereqStep.forExpectationId}>review that skill first</ExpLink> : 'review it first'}.
          </Banner>
        ) : null}
        {(step.kind === 'explain' || step.kind === 'worked_example' || step.kind === 'objective') && s.status !== 'completed' ? (
          <div className="stack-2">
            <span className="small muted">Didn’t click? Try another way:</span>
            <div className="row-wrap">
              {ALT_EXPLANATIONS.filter((k) => s.content.alternatives[k] || k === 'example' || ai.data?.available).map((k) => (
                <Button key={k} size="sm" variant="ghost" icon={s.content.alternatives[k] || (k === 'example' && s.content.skillId) ? undefined : <Sparkles size={12} />} loading={busy === `alt-${k}`} onClick={() => void explain(k)}>
                  {ALT_LABEL[k]}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {alt ? (
          <div className="alt-explanation" aria-live="polite">
            <div className="row tiny">
              <strong className="grow">{alt.label}</strong>
              {alt.source === 'ai' ? <Badge tone="warn">AI-written</Badge> : null}
            </div>
            <Blocks blocks={alt.blocks} />
          </div>
        ) : null}
        {step.questionIds.map((qid, i) => {
          const question = s.content.questions.find((x) => x.id === qid);
          if (!question) return null;
          return (
            <QuestionCard
              key={qid}
              q={question}
              number={i + 1}
              answered={s.answers[qid] ?? null}
              feedback={feedback[qid] ?? null}
              hintsAllowed={step.kind !== 'check'}
              locked={s.status !== 'active'}
              aiFeedbackAvailable={ai.data?.available}
              onHint={() => api.study.lessonHint(s.id, qid)}
              onSubmit={async (r, opts) => {
                const res = await api.study.answerLesson(s.id, qid, r, opts);
                setFeedback((f) => ({ ...f, [qid]: { result: res.result, answer: res.answer, solution: res.solution, misconception: res.misconception, adaptReason: res.adaptReason } }));
                set(res.session);
              }}
              onSimilar={question.skillId ? async () => set(await api.study.similarQuestion(s.id, qid)) : undefined}
            />
          );
        })}
        {last && s.status !== 'completed' ? (
          <div>
            <Button
              variant="primary"
              loading={busy === 'complete'}
              onClick={() =>
                void act('complete', async () => {
                  set(await api.study.completeLesson(s.id));
                  invalidate('study');
                })
              }
            >
              Finish lesson
            </Button>
          </div>
        ) : null}
        {s.status === 'completed' && s.outcome ? <Outcome s={s} /> : null}
      </section>
      {s.status !== 'completed' ? (
        <div className="row">
          <Button icon={<ArrowLeft size={14} />} disabled={s.stepIndex === 0 || s.status !== 'active'} onClick={() => void go(s.stepIndex - 1)}>
            Back
          </Button>
          <span className="grow" />
          {!last ? (
            <Button variant="primary" disabled={s.status !== 'active'} loading={busy === 'nav'} onClick={() => void go(s.stepIndex + 1)}>
              Next <ArrowRight size={14} />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Outcome({ s }: { s: LessonSession }) {
  const toast = useToast();
  const o = s.outcome!;
  const saveGuide = async () => {
    try {
      const body = [`# Study guide: ${s.content.title}`, '', s.content.goal ? `Goal: ${s.content.goal}` : '', '', '## Key ideas', ...s.content.summary.map((x) => `- ${x}`), '', `_From FlowCompanion Student Learning (${s.expectationId.split(':').pop()})._`].join('\n');
      const n = await api.notes.create({ title: `Study guide: ${s.content.title}`, body, format: 'markdown', tags: ['study-guide'] });
      toast('Saved to Notes', 'success');
      navigate(`/notes/${n.id}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <div className="stack-3" aria-live="polite">
      <h3>How it went</h3>
      <p>
        {o.answered ? `${o.correct} of ${o.answered} questions right, ${o.independentCorrect} without help.` : 'No questions in this lesson.'} {o.hintsUsed ? `${o.hintsUsed} hint${o.hintsUsed === 1 ? '' : 's'} used.` : ''}
      </p>
      <p className="row-wrap" style={{ gap: 6 }}>
        <span className="small">Before:</span> <StatusBadge status={o.masteryBefore} /> <span className="small">Now:</span> <StatusBadge status={o.masteryAfter} />
      </p>
      <p className="tiny faint">“{MASTERY_LABEL[o.masteryAfter]}” is a FlowCompanion learning indicator, not an Ontario mark.</p>
      <Banner tone="info" title={o.recommendation.title}>
        {o.recommendation.reason}{' '}
        <button type="button" className="link-button" onClick={() => navigate(`/study/e/${encodeURIComponent(o.recommendation.expectationId)}`)}>
          Go
        </button>
      </Banner>
      {s.content.summary.length ? (
        <div>
          <Button icon={<NotebookPen size={14} />} onClick={() => void saveGuide()}>
            Save key ideas as a study guide
          </Button>
        </div>
      ) : null}
    </div>
  );
}
