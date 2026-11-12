import { CheckCircle2, Eye, EyeOff, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { AI_MODE_STUDENT, ASSESSMENT_KIND_LABEL, type AssessmentDto, type AssessmentIntroDto, type AttemptDto, type ClassDto, type ResultDto } from '../../../shared/classroom/protocol';
import { responseText } from '../../../shared/classroom/items';
import { Badge, Banner, Button, EmptyState, Field, Textarea } from '../../components/ui';
import { Blocks } from '../study/render';
import { ErrorNote, Loaded, PageHeader, fmtDateTime, plural, pts } from './common';
import { useAction, useClassroom, useGet } from './context';

const MY: Record<NonNullable<AssessmentDto['my']>['status'], { label: string; tone: 'outline' | 'info' | 'ok' | 'accent' }> = {
  not_started: { label: 'Not started', tone: 'outline' },
  in_progress: { label: 'In progress', tone: 'info' },
  submitted: { label: 'Submitted', tone: 'ok' },
  released: { label: 'Results ready', tone: 'accent' },
};

export function StudentClass({ cls }: { cls: ClassDto }) {
  const { go } = useClassroom();
  const list = useGet<AssessmentDto[]>(`/classes/${cls.id}/assessments`);
  return (
    <div className="stack-4">
      <PageHeader title={cls.name} subtitle={[cls.section, cls.courseLabel].filter(Boolean).join(' · ')} backLabel="All classes" />
      <Loaded q={list}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState title="Nothing here yet">Your teacher has not published any assessments in this class.</EmptyState>
          ) : (
            <ul className="stack-3">
              {items.map((a) => {
                const my = a.my ?? { status: 'not_started' as const, attemptId: null, attemptsUsed: 0, score: null };
                const open = a.phase === 'open';
                return (
                  <li key={a.id} className="card row-wrap">
                    <div className="grow stack-1">
                      <strong>{a.title}</strong>
                      <span className="small muted">
                        {ASSESSMENT_KIND_LABEL[a.settings.kind]} · {plural(a.items, 'question')}
                        {a.settings.timeLimitMinutes ? ` · ${a.settings.timeLimitMinutes} min` : ''}
                        {a.settings.closesAt ? ` · closes ${fmtDateTime(a.settings.closesAt)}` : ''}
                        {a.phase === 'scheduled' ? ` · opens ${fmtDateTime(a.settings.opensAt)}` : ''}
                      </span>
                    </div>
                    <Badge tone={MY[my.status].tone}>{MY[my.status].label}</Badge>
                    {my.status === 'released' || (my.status === 'submitted' && a.settings.showResults === 'immediately') ? (
                      <Button onClick={() => go({ v: 'result', attemptId: my.attemptId! })}>
                        {my.score !== null ? `See results (${pts(my.score)} / ${pts(a.points)})` : 'See results'}
                      </Button>
                    ) : null}
                    {my.status === 'in_progress' ? (
                      <Button variant="primary" icon={<PlayCircle size={15} />} onClick={() => go({ v: 'work', attemptId: my.attemptId! })}>
                        Continue
                      </Button>
                    ) : open && my.attemptsUsed < a.settings.attempts ? (
                      <Button variant={my.status === 'not_started' ? 'primary' : 'default'} onClick={() => go({ v: 'intro', id: a.id })}>
                        {my.attemptsUsed ? 'Try again' : 'Start'}
                      </Button>
                    ) : a.phase === 'closed' && my.status === 'not_started' ? (
                      <span className="small muted">Closed</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )
        }
      </Loaded>
    </div>
  );
}

/** What is recorded, and what is not, shown before every start. The student must acknowledge it. */
export function Intro({ id }: { id: string }) {
  const { go } = useClassroom();
  const q = useGet<AssessmentIntroDto>(`/assessments/${id}/intro`);
  const { run, busy, error } = useAction();
  const [ack, setAck] = useState(false);
  return (
    <Loaded q={q}>
      {(d) => {
        const st = d.assessment.settings;
        const acc = d.accommodation;
        const start = async () => {
          const t = await run<AttemptDto>('start', 'POST', `/assessments/${id}/attempts`, { acknowledged: true });
          if (t) go({ v: 'work', attemptId: t.id });
        };
        return (
          <div className="stack-4" style={{ maxWidth: 760 }}>
            <PageHeader title={d.assessment.title} subtitle={`${ASSESSMENT_KIND_LABEL[st.kind]} · ${plural(d.assessment.items, 'question')} · ${pts(d.assessment.points)} points`} />
            {d.assessment.instructions ? <p>{d.assessment.instructions}</p> : null}
            <div className="card stack-2">
              <h2 className="h2">Before you start</h2>
              <ul className="stack-1">
                <li>{st.timeLimitMinutes ? `You have ${st.timeLimitMinutes} minutes${acc.extraTimePercent ? `, plus your ${acc.extraTimePercent}% extra time` : ''} from when you press Start. The timer keeps going if you close the page.` : 'There is no time limit.'}</li>
                {st.closesAt ? <li>It closes {fmtDateTime(st.closesAt)}. Work still open then is submitted automatically.</li> : null}
                <li>{st.attempts > 1 ? `You can make ${st.attempts} attempts; you have used ${d.attemptsUsed}.` : 'You have one attempt.'}</li>
                <li>{AI_MODE_STUDENT[st.aiMode]}</li>
                <li>Your answers save automatically as you type.</li>
                {st.blockPaste && !acc.pasteAllowed ? <li>Pasting into answers is turned off, and so is copying from the assistant and the questions. Write answers in your own words.</li> : null}
                {acc.pasteAllowed ? <li>Your accommodation lets you paste into answers.</li> : null}
                {acc.textToSpeech ? <li>Each question has a Read aloud button.</li> : null}
              </ul>
            </div>
            <div className="grid grid-2">
              <div className="card stack-2">
                <h2 className="h2 row">
                  <Eye size={16} aria-hidden /> What is recorded
                </h2>
                <ul className="stack-1 small">
                  {d.recorded.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <div className="card stack-2">
                <h2 className="h2 row">
                  <EyeOff size={16} aria-hidden /> Never recorded
                </h2>
                <ul className="stack-1 small">
                  {d.neverRecorded.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="small muted">{d.limits}</p>
            {d.inProgress ? (
              <div>
                <Button variant="primary" onClick={() => go({ v: 'work', attemptId: d.inProgress! })}>
                  Continue where you left off
                </Button>
              </div>
            ) : (
              <>
                <label className="row" style={{ alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 4 }} />
                  <span>I have read what is recorded during this assessment.</span>
                </label>
                <div>
                  <Button variant="primary" onClick={start} disabled={!ack || d.assessment.phase !== 'open'} loading={busy === 'start'}>
                    Start
                  </Button>
                </div>
                {d.assessment.phase !== 'open' ? <Banner tone="info">This assessment is not open right now.</Banner> : null}
              </>
            )}
            <ErrorNote error={error} />
          </div>
        );
      }}
    </Loaded>
  );
}

export function Result({ attemptId }: { attemptId: string }) {
  const q = useGet<ResultDto>(`/attempts/${attemptId}/result`);
  const { run, busy, error } = useAction();
  const [reply, setReply] = useState('');
  const [sent, setSent] = useState(false);
  if (q.error?.code === 'not_released')
    return (
      <div className="stack-4" style={{ maxWidth: 640 }}>
        <PageHeader title="Results" />
        <Banner tone="info" title="Submitted">
          Your work is in. Your teacher has not released results yet; they will appear here when they do.
        </Banner>
      </div>
    );
  return (
    <Loaded q={q}>
      {(r) => (
        <div className="stack-4" style={{ maxWidth: 820 }}>
          <PageHeader title={r.title} subtitle={`Submitted ${fmtDateTime(r.submittedAt)}${r.total.score !== null ? ` · ${pts(r.total.score)} / ${pts(r.total.max)}` : ''}`} />
          {!r.released ? <Banner tone="info">These are only the questions marked automatically. Your teacher will mark the rest and release your full results later.</Banner> : null}
          {r.overallComment ? (
            <Banner tone="ok" title="Your teacher’s feedback">
              <span style={{ whiteSpace: 'pre-wrap' }}>{r.overallComment}</span>
            </Banner>
          ) : null}
          <ol className="stack-3">
            {r.items.map((it) => (
              <li key={it.item.id} className="card stack-2">
                <div className="row">
                  <strong className="grow">Question {it.item.position}</strong>
                  {it.score !== null ? (
                    <span>
                      {it.score === it.points ? <CheckCircle2 size={14} color="var(--ok)" aria-hidden /> : null} {pts(it.score)} / {pts(it.points)}
                    </span>
                  ) : (
                    <span className="small muted">Not marked yet</span>
                  )}
                </div>
                <Blocks blocks={it.item.question.prompt} />
                <div className="stack-1">
                  <span className="tiny faint">Your answer</span>
                  <p className="student-answer">{responseText(it.item.question, it.response) || <span className="muted">No answer.</span>}</p>
                </div>
                {it.correctAnswer !== null ? <p className="small">Answer: {it.correctAnswer}</p> : null}
                {it.solution.length ? <Blocks blocks={it.solution} /> : null}
                {it.levels && it.item.question.type === 'written' ? (
                  <ul className="small">
                    {it.item.question.rubric.map((cr) =>
                      it.levels![cr.id] ? (
                        <li key={cr.id}>
                          {cr.label}: level {it.levels![cr.id]} — {cr.levels[it.levels![cr.id]! - 1]}
                        </li>
                      ) : null,
                    )}
                  </ul>
                ) : null}
                {it.highlights.length ? (
                  <ul className="small">
                    {it.highlights.map((h, i) => (
                      <li key={i}>
                        “{responseText(it.item.question, it.response).slice(h.start, h.end)}”: {h.comment}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {it.comment ? <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{it.comment}</p> : null}
              </li>
            ))}
          </ol>
          {r.evaluation ? (
            <div className="card stack-2">
              <h2 className="h2">How you used the AI assistant</h2>
              <p className="small muted">Your teacher’s assessment of your chat.</p>
              <ul className="stack-2">
                {r.evaluation.rubric.map((cr) => {
                  const lv = r.evaluation!.levels[cr.id];
                  const ev = r.evaluation!.evidence.find((e) => e.criterionId === cr.id);
                  return (
                    <li key={cr.id}>
                      <strong>
                        {cr.label}: level {lv}
                      </strong>
                      <div className="small">{lv ? cr.levels[lv - 1] : ''}</div>
                      {ev?.quotes.length ? <div className="small muted">From your chat: {ev.quotes.map((q) => `“${q.text}”`).join(' · ')}</div> : null}
                    </li>
                  );
                })}
              </ul>
              {r.evaluation.comment ? <p style={{ whiteSpace: 'pre-wrap' }}>{r.evaluation.comment}</p> : null}
              {r.evaluation.studentReply || sent ? (
                <p className="small">You replied: {r.evaluation.studentReply ?? reply}</p>
              ) : (
                <>
                  <Field label="Reply to your teacher about this (optional)" htmlFor="ev-reply">
                    <Textarea id="ev-reply" rows={2} maxLength={1500} value={reply} onChange={(e) => setReply(e.target.value)} />
                  </Field>
                  <div>
                    <Button size="sm" onClick={async () => (await run('reply', 'POST', `/attempts/${attemptId}/evaluation-reply`, { text: reply })) && setSent(true)} loading={busy === 'reply'} disabled={!reply.trim()}>
                      Send reply
                    </Button>
                  </div>
                  <ErrorNote error={error} />
                </>
              )}
            </div>
          ) : null}
          {r.transcript?.length ? (
            <details className="card">
              <summary>Your chat with the assistant ({r.transcript.length} messages)</summary>
              <ol className="stack-2 review-chat" style={{ marginTop: 12 }}>
                {r.transcript.map((m) => (
                  <li key={m.id} className={`chat-msg ${m.role}`}>
                    <div className="tiny faint">{m.role === 'student' ? 'You' : 'Assistant'}</div>
                    <div className="chat-text">{m.content}</div>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      )}
    </Loaded>
  );
}
