import { CheckCircle2, CircleAlert, Flag, Lightbulb, RotateCcw, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DIFFICULTY_LABEL, QUESTION_TYPE_LABEL, type AnswerRecord, type Block, type CheckResult, type Misconception, type Question, type Response } from '../../../shared/study/types';
import { RUBRIC_NOTE } from '../../../shared/study/subjects';
import { Badge, Banner, Button, Input, Textarea, usePrompt, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { Blocks, RichLine } from './render';

export interface Feedback {
  result: CheckResult;
  answer: string | null;
  solution: Block[] | null;
  misconception: Misconception | null;
  adaptReason?: string | null;
}

function initial(q: Question): Response | null {
  switch (q.type) {
    case 'multiple_select':
      return { type: 'choices', choices: [] };
    case 'fill_blank':
      return { type: 'blanks', values: q.blanks.map(() => '') };
    case 'matching':
      return { type: 'pairs', pairs: {} };
    case 'ordering':
      return { type: 'order', order: q.items.map((i) => i.id) };
    case 'written':
      return { type: 'written', text: '' };
    case 'numeric':
    case 'expression':
    case 'short_answer':
    case 'code_trace':
      return { type: 'text', text: '' };
    default:
      return null;
  }
}

function OriginNote({ q }: { q: Question }) {
  if (q.origin === 'ai') return <Badge tone="warn" title="Written by AI. The answer key was not checked by FlowCompanion.">AI-written · key not checked</Badge>;
  if (q.origin === 'ministry') return <Badge tone="info" title="Prompt quoted from the Ministry's teacher supports">From Ministry supports</Badge>;
  if (q.keyVerified) return <Badge tone="ok" title="The answer key was computed and checked by code">Answer checked by code</Badge>;
  return null;
}

/**
 * One question: the input for its type, hints on request (counted), and feedback. Used by lessons and quizzes.
 * `answered` is the stored answer (when reopening); `feedback` is what the last submission returned.
 */
export function QuestionCard({
  q,
  number,
  answered,
  feedback,
  hintsAllowed,
  onHint,
  onSubmit,
  onSimilar,
  aiFeedbackAvailable,
  locked,
}: {
  q: Question;
  number: number;
  answered: AnswerRecord | null;
  feedback: Feedback | null;
  hintsAllowed: boolean;
  onHint: () => Promise<{ hint: string | null; used: number; total: number }>;
  onSubmit: (r: Response, opts: { seconds: number; aiFeedback: boolean }) => Promise<void>;
  onSimilar?: () => Promise<void>;
  aiFeedbackAvailable?: boolean;
  locked?: boolean;
}) {
  const toast = useToast();
  const prompt = usePrompt();
  const [resp, setResp] = useState<Response | null>(() => answered?.response ?? initial(q));
  const [hints, setHints] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(false);
  const started = useRef(Date.now());
  useEffect(() => {
    setResp(answered?.response ?? initial(q));
    setHints(q.hints.slice(0, 0));
    started.current = Date.now();
  }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = !!answered && !feedback?.result.unreadable;
  const result = feedback?.result ?? answered?.result ?? null;
  const showResult = !!feedback || (!!answered && answered.result.feedback !== 'Saved. Feedback comes at the end.');
  const disabled = busy || locked || (done && q.type !== 'written');

  const submit = async () => {
    if (!resp) return;
    setBusy(true);
    try {
      await onSubmit(resp, { seconds: Math.round((Date.now() - started.current) / 1000), aiFeedback });
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const hint = async () => {
    try {
      const h = await onHint();
      if (h.hint) setHints((x) => [...x, h.hint!]);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const report = async () => {
    const detail = await prompt({ title: 'Report a problem', label: 'What looks wrong with this question? Reports are saved on this computer for whoever reviews the content.' });
    if (!detail) return;
    try {
      await api.study.reportContent({ kind: 'inaccurate', target: `Question ${q.id} (${q.expectationId})`, detail });
      toast('Thanks — your report was saved.', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <section className="question card stack-3" aria-label={`Question ${number}`}>
      <div className="row-wrap tiny">
        <strong>Question {number}</strong>
        <span className="faint">
          {QUESTION_TYPE_LABEL[q.type]} · {DIFFICULTY_LABEL[q.difficulty]}
        </span>
        <span className="grow" />
        <OriginNote q={q} />
        <button type="button" className="icon-btn sm" title="Report a problem with this question" aria-label="Report a problem with this question" onClick={() => void report()}>
          <Flag size={13} />
        </button>
      </div>
      {q.source ? (
        <figure className="support">
          <figcaption className="tiny">
            {q.source.kind === 'primary' ? 'Primary source' : q.source.kind === 'secondary' ? 'Secondary source' : 'Source'} · {q.source.title}
          </figcaption>
          <p>{q.source.text}</p>
          <p className="tiny faint">{q.source.citation}</p>
        </figure>
      ) : null}
      <Blocks blocks={q.prompt} />
      {q.type === 'code_trace' && !q.prompt.some((b) => b.kind === 'code') ? (
        <pre className="code-snippet">
          <code>{q.code}</code>
        </pre>
      ) : null}

      <AnswerInput q={q} resp={resp} setResp={setResp} disabled={disabled} onEnter={() => void submit()} />

      {hints.length ? (
        <div className="stack-2">
          {hints.map((h, i) => (
            <div key={i} className="lesson-note tip" role="note">
              <strong>Hint {i + 1}:</strong> <RichLine text={h} />
            </div>
          ))}
        </div>
      ) : null}

      {!done && !locked ? (
        <div className="row-wrap">
          <Button variant="primary" loading={busy} onClick={() => void submit()} disabled={!resp}>
            Check answer
          </Button>
          {hintsAllowed && q.hints.length > hints.length ? (
            <Button icon={<Lightbulb size={14} />} onClick={() => void hint()}>
              {hints.length ? 'Another hint' : 'Hint'}
            </Button>
          ) : null}
          {q.type === 'written' && aiFeedbackAvailable ? (
            <label className="row small" style={{ gap: 6 }}>
              <input type="checkbox" checked={aiFeedback} onChange={(e) => setAiFeedback(e.target.checked)} /> Ask the AI tutor for feedback (sends your answer to your AI provider)
            </label>
          ) : null}
          {hintsAllowed && hints.length ? <span className="tiny faint">Hints are fine while learning. Answers with hints count as “with help”.</span> : null}
        </div>
      ) : null}

      {showResult && result ? <FeedbackView q={q} feedback={feedback} result={result} onSimilar={onSimilar} /> : null}
    </section>
  );
}

function FeedbackView({ q, feedback, result, onSimilar }: { q: Question; feedback: Feedback | null; result: CheckResult; onSimilar?: () => Promise<void> }) {
  const [showSolution, setShowSolution] = useState(result.correct === false);
  if (result.unreadable) return <Banner tone="warn">{result.unreadable}</Banner>;
  const tone = result.correct === true ? 'ok' : result.correct === false ? (result.score > 0 ? 'warn' : 'danger') : 'info';
  const icon = result.correct === true ? <CheckCircle2 size={16} /> : result.correct === false ? <XCircle size={16} /> : <CircleAlert size={16} />;
  return (
    <div className={`feedback ${tone}`} role="status" aria-live="polite">
      <div className="row" style={{ gap: 8 }}>
        {icon}
        <strong className="grow" style={{ whiteSpace: 'pre-wrap' }}>
          {result.feedback}
        </strong>
      </div>
      {feedback?.misconception ? (
        <div className="stack-2" style={{ marginTop: 8 }}>
          <p>
            <strong>Likely mix-up: {feedback.misconception.label}.</strong> <RichLine text={feedback.misconception.explanation} />
          </p>
          <p>
            <strong>Try this:</strong> <RichLine text={feedback.misconception.fix} />
          </p>
        </div>
      ) : null}
      {feedback?.answer && result.correct !== true && q.type !== 'written' ? (
        <p style={{ marginTop: 8 }}>
          Correct answer: <RichLine text={feedback.answer} />
        </p>
      ) : null}
      {q.type === 'written' ? (
        <div className="stack-2" style={{ marginTop: 8 }}>
          <p className="small">Rubric:</p>
          <ul className="small">
            {q.rubric.map((c) => (
              <li key={c.id}>
                <strong>{c.label}:</strong> {c.description}
              </li>
            ))}
          </ul>
          <p className="tiny faint">{RUBRIC_NOTE}</p>
        </div>
      ) : null}
      {feedback?.solution?.length ? (
        <div style={{ marginTop: 8 }}>
          <button type="button" className="link-button small" onClick={() => setShowSolution((v) => !v)} aria-expanded={showSolution}>
            {showSolution ? 'Hide' : 'Show'} the worked solution
          </button>
          {showSolution ? <Blocks blocks={feedback.solution} /> : null}
        </div>
      ) : null}
      {feedback?.adaptReason ? <p className="tiny faint">{feedback.adaptReason}</p> : null}
      {result.correct === false && onSimilar ? (
        <div style={{ marginTop: 8 }}>
          <Button size="sm" icon={<RotateCcw size={13} />} onClick={() => void onSimilar()}>
            Try a similar question
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AnswerInput({ q, resp, setResp, disabled, onEnter }: { q: Question; resp: Response | null; setResp: (r: Response) => void; disabled: boolean; onEnter: () => void }) {
  const label = `Answer to the question`;
  switch (q.type) {
    case 'multiple_choice':
      return (
        <div className="choices" role="radiogroup" aria-label={label}>
          {q.choices.map((c) => (
            <label key={c.id} className={`choice ${resp?.type === 'choice' && resp.choice === c.id ? 'selected' : ''}`}>
              <input type="radio" name={q.id} disabled={disabled} checked={resp?.type === 'choice' && resp.choice === c.id} onChange={() => setResp({ type: 'choice', choice: c.id })} />
              <span>
                <RichLine text={c.text} />
              </span>
            </label>
          ))}
        </div>
      );
    case 'multiple_select': {
      const sel = resp?.type === 'choices' ? resp.choices : [];
      return (
        <div className="choices" role="group" aria-label={`${label} (choose all that apply)`}>
          {q.choices.map((c) => (
            <label key={c.id} className={`choice ${sel.includes(c.id) ? 'selected' : ''}`}>
              <input type="checkbox" disabled={disabled} checked={sel.includes(c.id)} onChange={(e) => setResp({ type: 'choices', choices: e.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id) })} />
              <span>
                <RichLine text={c.text} />
              </span>
            </label>
          ))}
        </div>
      );
    }
    case 'true_false':
      return (
        <div className="row" role="radiogroup" aria-label={label}>
          {[true, false].map((v) => (
            <label key={String(v)} className={`choice ${resp?.type === 'bool' && resp.value === v ? 'selected' : ''}`}>
              <input type="radio" name={q.id} disabled={disabled} checked={resp?.type === 'bool' && resp.value === v} onChange={() => setResp({ type: 'bool', value: v })} />
              <span>{v ? 'True' : 'False'}</span>
            </label>
          ))}
        </div>
      );
    case 'numeric':
    case 'expression':
    case 'short_answer':
    case 'code_trace':
      return (
        <div className="row" style={{ gap: 8 }}>
          <Input
            aria-label={label}
            value={resp?.type === 'text' ? resp.text : ''}
            disabled={disabled}
            autoComplete="off"
            spellCheck={q.type === 'short_answer'}
            placeholder={q.type === 'expression' ? 'e.g. 3x + 2' : q.type === 'numeric' ? 'e.g. 3/4, 1 1/2 or 0.75' : q.type === 'code_trace' ? 'What it prints' : 'Your answer'}
            onChange={(e) => setResp({ type: 'text', text: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onEnter()}
            style={{ maxWidth: 320 }}
          />
          {q.type === 'numeric' && q.unit ? <span className="muted">{q.unit}</span> : null}
        </div>
      );
    case 'fill_blank': {
      const vals = resp?.type === 'blanks' ? resp.values : q.blanks.map(() => '');
      const parts = q.template.split('___');
      return (
        <p className="fill-blank">
          {parts.map((p, i) => (
            <span key={i}>
              <RichLine text={p} />
              {i < parts.length - 1 ? (
                <Input
                  aria-label={`Blank ${i + 1}`}
                  disabled={disabled}
                  value={vals[i] ?? ''}
                  onChange={(e) => setResp({ type: 'blanks', values: vals.map((v, j) => (j === i ? e.target.value : v)) })}
                  style={{ width: 120, display: 'inline-block' }}
                />
              ) : null}
            </span>
          ))}
        </p>
      );
    }
    case 'matching': {
      const pairs = resp?.type === 'pairs' ? resp.pairs : {};
      return (
        <div className="stack-2" role="group" aria-label={label}>
          {q.left.map((l) => (
            <label key={l.id} className="row" style={{ gap: 8 }}>
              <span className="grow">
                <RichLine text={l.text} />
              </span>
              <select className="select" disabled={disabled} value={pairs[l.id] ?? ''} onChange={(e) => setResp({ type: 'pairs', pairs: { ...pairs, [l.id]: e.target.value } })} aria-label={`Match for ${l.text}`}>
                <option value="">Choose…</option>
                {q.right.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.text}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      );
    }
    case 'ordering': {
      const order = resp?.type === 'order' ? resp.order : q.items.map((i) => i.id);
      const move = (i: number, d: -1 | 1) => {
        const next = [...order];
        const j = i + d;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j]!, next[i]!];
        setResp({ type: 'order', order: next });
      };
      return (
        <ol className="ordering" aria-label={`${label}: put in order`}>
          {order.map((id, i) => (
            <li key={id} className="row" style={{ gap: 6 }}>
              <span className="grow">
                <RichLine text={q.items.find((x) => x.id === id)?.text ?? ''} />
              </span>
              <button type="button" className="icon-btn sm" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                ↑
              </button>
              <button type="button" className="icon-btn sm" disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                ↓
              </button>
            </li>
          ))}
        </ol>
      );
    }
    case 'written':
      return (
        <Textarea
          aria-label={label}
          rows={6}
          disabled={disabled}
          value={resp?.type === 'written' ? resp.text : ''}
          placeholder="Write your answer in your own words."
          onChange={(e) => setResp({ type: 'written', text: e.target.value })}
        />
      );
  }
}
