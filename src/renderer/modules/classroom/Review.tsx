import { Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ChatMessageDto, EvaluationDto, GradeDto, ItemDto, OverlapDto, SubmissionDto } from '../../../shared/classroom/protocol';
import { SIGNAL_LABEL, SIGNAL_MEANING } from '../../../shared/classroom/integrity';
import { responseText } from '../../../shared/classroom/items';
import { Badge, Banner, Button, Field, Input, Select, Tabs, Textarea } from '../../components/ui';
import { Blocks } from '../study/render';
import { ErrorNote, Loaded, PageHeader, fmtDateTime, fmtTime, pts } from './common';
import { useAction, useClassroom, useGet } from './context';

/** The answer with passages that match the assistant's messages highlighted, computed by code (not AI). */
function MarkedAnswer({ text, overlap, onPassage }: { text: string; overlap: OverlapDto | undefined; onPassage: (messageId: string) => void }) {
  if (!text.trim()) return <p className="muted small">No answer.</p>;
  const ps = [...(overlap?.passages ?? [])].sort((a, b) => a.answerStart - b.answerStart);
  const out: ReactNode[] = [];
  let at = 0;
  ps.forEach((p, i) => {
    if (p.answerStart < at) return;
    out.push(text.slice(at, p.answerStart));
    out.push(
      <mark key={i} className="overlap" title="The same words appear in an assistant message">
        {text.slice(p.answerStart, p.answerEnd)}
        <button type="button" className="link-button tiny" onClick={() => onPassage(p.messageId)}>
          {' '}
          (see message)
        </button>
      </mark>,
    );
    at = p.answerEnd;
  });
  out.push(text.slice(at));
  return <p className="student-answer">{out}</p>;
}

function GradeItem({ d, it, g, overlap, onSaved, showMessage }: { d: SubmissionDto; it: ItemDto; g: GradeDto; overlap: OverlapDto | undefined; onSaved: (g: GradeDto) => void; showMessage: (id: string) => void }) {
  const { run, busy, error } = useAction();
  const q = it.question;
  const resp = d.responses[it.id] ?? null;
  const [score, setScore] = useState<string>(g.score === null ? '' : String(g.score));
  const [comment, setComment] = useState(g.comment);
  const [reason, setReason] = useState(g.overrideReason);
  const [levels, setLevels] = useState<Record<string, number>>(g.levels ?? {});
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setScore(g.score === null ? '' : String(g.score));
    setComment(g.comment);
    setReason(g.overrideReason);
    setLevels(g.levels ?? {});
  }, [g]);
  const n = score === '' ? null : Number(score);
  const overriding = g.auto !== null && n !== null && n !== g.auto.score;
  const save = async () => {
    if (n === null) return;
    const r = await run<GradeDto>('save', 'PUT', `/attempts/${d.attempt.id}/grades/${it.id}`, { score: n, comment, overrideReason: overriding ? reason : '', levels: q.type === 'written' && Object.keys(levels).length ? levels : null });
    if (r) {
      setSaved(true);
      onSaved(r);
    }
  };
  const suggest = async () => {
    const r = await run<GradeDto>('suggest', 'POST', `/attempts/${d.attempt.id}/suggest/${it.id}`);
    if (r) onSaved(r);
  };
  const useSuggestion = () => {
    if (!g.suggestion) return;
    setScore(String(g.suggestion.score));
    setLevels(Object.fromEntries(g.suggestion.levels.map((l) => [l.criterionId, l.level])));
    setComment(g.suggestion.feedback);
    setSaved(false);
  };
  const text = responseText(q, resp);
  return (
    <li className="card stack-3" id={`item-${it.id}`}>
      <div className="row-wrap">
        <strong>Question {it.position}</strong>
        <span className="small muted">out of {pts(it.points)}</span>
        {d.seconds[it.id] ? <span className="tiny faint">{Math.round(d.seconds[it.id]! / 60)} min on this question</span> : null}
        <span className="grow" />
        {g.score !== null ? <Badge tone={g.source === 'auto' ? 'info' : 'ok'}>{g.source === 'auto' ? 'Marked by the checker' : 'Marked by you'}</Badge> : <Badge tone="warn">Not marked</Badge>}
      </div>
      <Blocks blocks={q.prompt} />
      <div className="stack-1">
        <span className="tiny faint">Student’s answer</span>
        {q.type === 'written' ? <MarkedAnswer text={text} overlap={overlap} onPassage={showMessage} /> : <p className="student-answer">{text || <span className="muted">No answer.</span>}</p>}
        {overlap && overlap.similarity >= 0.3 ? (
          <p className="tiny" style={{ color: 'var(--warn)' }}>
            {Math.round(overlap.similarity * 100)}% of this answer’s word sequences also appear in the assistant’s messages. Retyping happens for many reasons; read both before deciding.
          </p>
        ) : null}
        {g.auto ? (
          <p className="small">
            Checker: {g.auto.result.correct ? 'correct' : 'not correct'} · {pts(g.auto.score)} point{g.auto.score === 1 ? '' : 's'}
            {g.auto.result.unreadable ? <span className="muted"> · {g.auto.result.unreadable}</span> : null}
          </p>
        ) : null}
      </div>
      {q.type === 'written' ? (
        <div className="ai-suggestion stack-2">
          <div className="row-wrap">
            <span className="small" style={{ fontWeight: 600 }}>
              AI-suggested mark
            </span>
            <span className="grow" />
            <Button size="sm" icon={<Sparkles size={14} />} onClick={suggest} loading={busy === 'suggest'} disabled={g.suggestionStatus === 'queued' || g.suggestionStatus === 'running'}>
              {g.suggestion ? 'Ask again' : 'Suggest a mark'}
            </Button>
          </div>
          {g.suggestionStatus === 'queued' || g.suggestionStatus === 'running' ? <p className="small muted">Waiting for the AI…</p> : null}
          {g.suggestionStatus === 'invalid' || g.suggestionStatus === 'failed' ? <p className="small" style={{ color: 'var(--danger)' }}>{g.suggestionError}</p> : null}
          {g.suggestion ? (
            <>
              <ul className="stack-1 small">
                {g.suggestion.levels.map((l) => {
                  const cr = q.rubric.find((c) => c.id === l.criterionId);
                  return (
                    <li key={l.criterionId}>
                      <strong>
                        {cr?.label ?? l.criterionId}: level {l.level}
                      </strong>
                      {l.quote ? <span> · “{l.quote}”</span> : null}
                      <div className="muted">{l.rationale}</div>
                    </li>
                  );
                })}
              </ul>
              <p className="small">
                Suggested: {pts(g.suggestion.score)} / {pts(it.points)}. Feedback: {g.suggestion.feedback}
              </p>
              {g.suggestion.evidenceRemoved ? <p className="tiny" style={{ color: 'var(--warn)' }}>The AI quoted words that are not in the answer; those quotes were removed.</p> : null}
              <div>
                <Button size="sm" onClick={useSuggestion}>
                  Use as a starting point
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="stack-2">
        {q.type === 'written' ? (
          <div className="field-row">
            {q.rubric.map((cr) => (
              <Field key={cr.id} label={cr.label} htmlFor={`lv-${it.id}-${cr.id}`}>
                <Select id={`lv-${it.id}-${cr.id}`} value={levels[cr.id] ?? ''} onChange={(e) => (setLevels({ ...levels, [cr.id]: Number(e.target.value) }), setSaved(false))}>
                  <option value="">—</option>
                  {cr.levels.map((desc, i) => (
                    <option key={i} value={i + 1} title={desc}>
                      Level {i + 1}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        ) : null}
        <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
          <Field label={`Mark (out of ${pts(it.points)})`} htmlFor={`sc-${it.id}`}>
            <Input id={`sc-${it.id}`} type="number" min={0} max={it.points} step={0.5} value={score} onChange={(e) => (setScore(e.target.value), setSaved(false))} style={{ maxWidth: 110 }} />
          </Field>
          {overriding ? (
            <Field label="Reason for changing the checker’s mark" htmlFor={`rs-${it.id}`}>
              <Input id={`rs-${it.id}`} value={reason} onChange={(e) => (setReason(e.target.value), setSaved(false))} style={{ minWidth: 260 }} />
            </Field>
          ) : null}
        </div>
        <Field label="Comment for the student" htmlFor={`cm-${it.id}`}>
          <Textarea id={`cm-${it.id}`} rows={2} value={comment} onChange={(e) => (setComment(e.target.value), setSaved(false))} />
        </Field>
        <div className="row">
          <Button variant="primary" size="sm" onClick={save} loading={busy === 'save'} disabled={n === null || n < 0 || n > it.points || (overriding && !reason.trim())}>
            Save mark
          </Button>
          {saved ? (
            <span className="small" role="status">
              Saved.
            </span>
          ) : null}
        </div>
        <ErrorNote error={error} />
      </div>
    </li>
  );
}

function ChatView({ chat, highlight }: { chat: ChatMessageDto[]; highlight: string | null }) {
  if (!chat.length) return <p className="small muted">The student did not use the assistant.</p>;
  return (
    <ol className="stack-2 review-chat">
      {chat.map((m) => (
        <li key={m.id} id={`msg-${m.id}`} className={`chat-msg ${m.role} ${highlight === m.id ? 'highlight' : ''}`} tabIndex={-1}>
          <div className="tiny faint">
            {m.role === 'student' ? (m.kind === 'draft' ? 'Student (shared their draft)' : 'Student') : 'Assistant'} · {fmtTime(m.createdAt)}
            {m.status === 'refused' ? ' · declined' : m.status === 'error' ? ' · failed' : ''}
          </div>
          <div className="chat-text">{m.content}</div>
          {m.citations.length ? (
            <ul className="tiny citations">
              {m.citations.map((c, i) => (
                <li key={i}>
                  {c.title}
                  {c.page ? `, page ${c.page}` : ''}: “{c.quote.slice(0, 160)}
                  {c.quote.length > 160 ? '…' : ''}”
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function EvaluationView({ d, ev, onChange, showMessage }: { d: SubmissionDto; ev: EvaluationDto; onChange: (e: EvaluationDto) => void; showMessage: (id: string) => void }) {
  const { run, busy, error } = useAction();
  const start = ev.final?.levels ?? Object.fromEntries((ev.suggested?.criteria ?? []).map((c) => [c.criterionId, c.level]));
  const [levels, setLevels] = useState<Record<string, number>>(start);
  const [comment, setComment] = useState(ev.final?.comment ?? '');
  useEffect(() => {
    setLevels(ev.final?.levels ?? Object.fromEntries((ev.suggested?.criteria ?? []).map((c) => [c.criterionId, c.level])));
    setComment(ev.final?.comment ?? '');
  }, [ev]);
  const decide = async () => {
    const r = await run<EvaluationDto>('decide', 'PUT', `/attempts/${d.attempt.id}/evaluation`, { levels, comment });
    if (r) onChange(r);
  };
  const evaluate = async () => {
    const r = await run<EvaluationDto>('evaluate', 'POST', `/attempts/${d.attempt.id}/evaluate`);
    if (r) onChange(r);
  };
  const complete = ev.rubric.every((c) => levels[c.id]);
  return (
    <div className="stack-3">
      <p className="small muted">An AI suggests a level for each criterion from the chat alone (it does not see names, marks or activity). Every quote links to the message it came from. You decide; the student sees only your levels and comment, after release.</p>
      {ev.status === 'none' || ev.status === 'invalid' || ev.status === 'failed' ? (
        <div className="stack-2">
          {ev.error ? <Banner tone={ev.status === 'none' ? 'info' : 'warn'}>{ev.error}</Banner> : null}
          {d.chat.length ? (
            <div>
              <Button icon={<Sparkles size={14} />} onClick={evaluate} loading={busy === 'evaluate'}>
                {ev.status === 'none' ? 'Suggest an evaluation' : 'Try again'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {ev.status === 'queued' || ev.status === 'running' ? <p className="small muted">{ev.error ?? 'Waiting for the AI…'}</p> : null}
      {ev.suggested ? (
        <div className="stack-2">
          <p className="small">
            <strong>AI-suggested summary:</strong> {ev.suggested.summary}
          </p>
          {ev.suggested.flags.length ? (
            <div className="small">
              <strong>Worth a look:</strong>
              <ul>
                {ev.suggested.flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {ev.evidenceRemoved ? <p className="tiny" style={{ color: 'var(--warn)' }}>Some quotes the AI gave are not in the chat; they were removed.</p> : null}
        </div>
      ) : null}
      {ev.rubric.length && (ev.suggested?.criteria.length || ev.final || d.chat.length) ? (
        <ol className="stack-3">
          {ev.rubric.map((cr) => {
            const s = ev.suggested?.criteria.find((c) => c.criterionId === cr.id);
            return (
              <li key={cr.id} className="stack-1">
                <div className="row-wrap">
                  <strong className="grow">{cr.label}</strong>
                  {s ? <Badge tone="info">AI-suggested: level {s.level}</Badge> : null}
                </div>
                <div>
                  <Select aria-label={`Your level for ${cr.label}`} value={levels[cr.id] ?? ''} onChange={(e) => setLevels({ ...levels, [cr.id]: Number(e.target.value) })} style={{ width: '100%', maxWidth: '100%' }}>
                    <option value="">Your level…</option>
                    {cr.levels.map((desc, i) => (
                      <option key={i} value={i + 1}>
                        Level {i + 1}: {desc.slice(0, 60)}
                        {desc.length > 60 ? '…' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <span className="tiny faint">{cr.description}</span>
                {s ? (
                  <div className="small">
                    {s.quotes.map((qt, i) => (
                      <div key={i}>
                        <button type="button" className="link-button" onClick={() => showMessage(qt.messageId)}>
                          “{qt.text}”
                        </button>
                      </div>
                    ))}
                    <div className="muted">{s.rationale}</div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      {ev.rubric.length && d.chat.length ? (
        <>
          <Field label="Comment for the student about their AI use" htmlFor="ev-comment">
            <Textarea id="ev-comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
          <div className="row">
            <Button variant="primary" size="sm" onClick={decide} loading={busy === 'decide'} disabled={!complete}>
              {ev.final ? 'Update my decision' : 'Save my decision'}
            </Button>
            {ev.final ? <span className="small muted">Decided {fmtDateTime(ev.final.reviewedAt)}</span> : null}
          </div>
        </>
      ) : null}
      {ev.studentReply ? (
        <Banner tone="info" title="The student replied">
          {ev.studentReply}
        </Banner>
      ) : null}
      <ErrorNote error={error} />
    </div>
  );
}

function Feedback({ d, onSaved }: { d: SubmissionDto; onSaved: () => void }) {
  const { run, busy, error } = useAction();
  const bank = useGet<{ id: string; text: string }[]>('/comment-bank');
  const [text, setText] = useState(d.overallComment);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    if (await run('save', 'PUT', `/attempts/${d.attempt.id}/feedback`, { comment: text })) {
      setSaved(true);
      onSaved();
    }
  };
  const keep = async () => {
    if (text.trim() && (await run('keep', 'POST', '/comment-bank', { text: text.trim() }))) bank.reload();
  };
  return (
    <div className="card stack-2">
      <h2 className="h2">Overall feedback</h2>
      <Textarea aria-label="Overall feedback" rows={3} value={text} onChange={(e) => (setText(e.target.value), setSaved(false))} />
      {bank.data?.length ? (
        <Select aria-label="Insert a saved comment" value="" onChange={(e) => e.target.value && (setText((t) => (t ? `${t}\n` : '') + e.target.value), setSaved(false))}>
          <option value="">Insert a saved comment…</option>
          {bank.data.map((c) => (
            <option key={c.id} value={c.text}>
              {c.text.slice(0, 80)}
            </option>
          ))}
        </Select>
      ) : null}
      <div className="row-wrap">
        <Button variant="primary" size="sm" onClick={save} loading={busy === 'save'}>
          Save feedback
        </Button>
        <Button size="sm" variant="ghost" onClick={keep} loading={busy === 'keep'} disabled={!text.trim()}>
          Save to my comment bank
        </Button>
        {saved ? (
          <span className="small" role="status">
            Saved.
          </span>
        ) : null}
      </div>
      <ErrorNote error={error} />
    </div>
  );
}

type Side = 'chat' | 'evaluation' | 'activity' | 'drafts';

export function Review({ attemptId }: { attemptId: string }) {
  const { refresh } = useClassroom();
  const q = useGet<SubmissionDto>(`/attempts/${attemptId}/review`);
  const [side, setSide] = useState<Side>('chat');
  const [highlight, setHighlight] = useState<string | null>(null);
  const showMessage = (id: string) => {
    setSide('chat');
    setHighlight(id);
    setTimeout(() => document.getElementById(`msg-${id}`)?.focus(), 50);
  };
  const changed = () => refresh(`/assessments/`);
  return (
    <Loaded q={q}>
      {(d) => (
        <ReviewBody
          d={d}
          side={side}
          setSide={setSide}
          highlight={highlight}
          showMessage={showMessage}
          onGrade={(g) => {
            q.set((prev) => (prev ? { ...prev, grades: prev.grades.map((x) => (x.itemId === g.itemId ? g : x)) } : prev));
            q.reload();
            changed();
          }}
          onEval={(e) => (q.set((prev) => (prev ? { ...prev, evaluation: e } : prev)), changed())}
          reload={() => (q.reload(), changed())}
        />
      )}
    </Loaded>
  );
}

function ReviewBody({ d, side, setSide, highlight, showMessage, onGrade, onEval, reload }: { d: SubmissionDto; side: Side; setSide: (s: Side) => void; highlight: string | null; showMessage: (id: string) => void; onGrade: (g: GradeDto) => void; onEval: (e: EvaluationDto) => void; reload: () => void }) {
  const overlapFor = useMemo(() => new Map(d.overlap.map((o) => [o.itemId, o])), [d.overlap]);
  const acc = d.accommodation;
  const accText = [acc.extraTimePercent ? `${acc.extraTimePercent}% extra time` : '', acc.pasteAllowed ? 'pasting allowed' : '', acc.textToSpeech ? 'read aloud' : '', acc.largerText ? 'larger text' : ''].filter(Boolean).join(', ');
  return (
    <div className="stack-4">
      <PageHeader
        title={`${d.student.displayName} · ${d.assessment.title}`}
        subtitle={`Attempt ${d.attempt.number} · started ${fmtDateTime(d.attempt.startedAt)} · ${d.attempt.submittedAt ? `submitted ${fmtDateTime(d.attempt.submittedAt)}${d.attempt.autoSubmitted ? ' (automatically, at the deadline)' : ''}` : 'still in progress'} · ${d.total.score === null ? `${d.total.decided} of ${d.total.of} questions marked` : `${pts(d.total.score)} / ${pts(d.total.max)}`}${d.attempt.released ? ' · released' : ''}`}
        backLabel="Submissions"
      />
      {accText ? <p className="small muted">Accommodations: {accText}. These are part of how this student works and are not flags.</p> : null}
      {d.attempt.reference ? <p className="tiny faint">Receipt {d.attempt.reference}</p> : null}
      <div className="review-layout">
        <div className="stack-3">
          <ol className="stack-3 item-list">
            {d.items.map((it) => (
              <GradeItem key={it.id} d={d} it={it} g={d.grades.find((g) => g.itemId === it.id)!} overlap={overlapFor.get(it.id)} onSaved={onGrade} showMessage={showMessage} />
            ))}
          </ol>
          <Feedback d={d} onSaved={reload} />
        </div>
        <aside className="card stack-3 review-side" aria-label="Chat, AI-use evaluation and activity">
          <Tabs
            label="Details"
            value={side}
            onChange={setSide}
            tabs={[
              { value: 'chat', label: `Chat (${d.chat.length})` },
              ...(d.assessment.settings.aiMode !== 'off' ? [{ value: 'evaluation' as Side, label: 'AI use' }] : []),
              { value: 'activity', label: `Activity (${d.events.length})` },
              { value: 'drafts', label: 'Drafts' },
            ]}
          />
          {side === 'chat' ? <ChatView chat={d.chat} highlight={highlight} /> : null}
          {side === 'evaluation' ? <EvaluationView d={d} ev={d.evaluation} onChange={onEval} showMessage={showMessage} /> : null}
          {side === 'activity' ? (
            d.events.length === 0 ? (
              <p className="small muted">Nothing was recorded.</p>
            ) : (
              <ol className="stack-2 small">
                {d.events.map((e) => (
                  <li key={e.id}>
                    <strong>{SIGNAL_LABEL[e.kind]}</strong> · {fmtTime(e.at)}
                    {e.itemId ? ` · question ${d.items.find((i) => i.id === e.itemId)?.position ?? '?'}` : ''}
                    {e.detail.ms ? ` · ${Math.round(e.detail.ms / 1000)} s` : ''}
                    {e.detail.chars ? ` · ${e.detail.chars} characters` : ''}
                    {e.detail.text ? <div className="muted">“{e.detail.text.slice(0, 200)}”</div> : null}
                    <div className="tiny faint">{SIGNAL_MEANING[e.kind]}</div>
                  </li>
                ))}
              </ol>
            )
          ) : null}
          {side === 'drafts' ? (
            d.snapshots.length === 0 ? (
              <p className="small muted">No saved drafts of written answers.</p>
            ) : (
              <ol className="stack-2 small">
                {d.snapshots.map((sn, i) => (
                  <li key={i}>
                    <strong>Question {d.items.find((x) => x.id === sn.itemId)?.position}</strong> · {fmtTime(sn.at)}
                    <div className="chat-text">{sn.text || <span className="muted">(empty)</span>}</div>
                  </li>
                ))}
              </ol>
            )
          ) : null}
        </aside>
      </div>
    </div>
  );
}
