import { Send, Sparkles, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AssessmentDto, BatchStatusDto, ClassOverviewDto, SubmissionRow } from '../../../shared/classroom/protocol';
import { HONEST_LIMITS } from '../../../shared/classroom/integrity';
import { Badge, Banner, Button, EmptyState, ProgressBar, useConfirm } from '../../components/ui';
import { ErrorNote, Loaded, fmtDateTime, pts } from './common';
import { useAction, useClassroom, useGet } from './context';

const STATUS: Record<SubmissionRow['status'], { label: string; tone: 'outline' | 'info' | 'warn' | 'ok' | 'accent' }> = {
  not_started: { label: 'Not started', tone: 'outline' },
  in_progress: { label: 'In progress', tone: 'info' },
  submitted: { label: 'To mark', tone: 'warn' },
  graded: { label: 'Marked', tone: 'ok' },
  released: { label: 'Released', tone: 'accent' },
};
const EVAL: Record<SubmissionRow['evaluation'], string> = { none: '—', queued: 'Waiting', running: 'Running', done: 'AI-suggested', invalid: 'Not evaluated', failed: 'Failed' };

function Signals({ s }: { s: SubmissionRow['signals'] }) {
  const parts = [
    s.messages ? `${s.messages} message${s.messages === 1 ? '' : 's'}` : null,
    s.pasteAttempts ? `${s.pasteAttempts} paste` : null,
    s.focusLosses ? `${s.focusLosses} left page` : null,
    s.largeInserts ? `${s.largeInserts} large insert` : null,
    s.ruleChangeAttempts ? `${s.ruleChangeAttempts} rule-change` : null,
    s.maxOverlap >= 0.3 ? `${Math.round(s.maxOverlap * 100)}% matches chat` : null,
  ].filter(Boolean);
  return <span className="small">{parts.length ? parts.join(' · ') : <span className="muted">None</span>}</span>;
}

export function Submissions({ a }: { a: AssessmentDto }) {
  const { go, refresh } = useClassroom();
  const confirm = useConfirm();
  const rows = useGet<SubmissionRow[]>(`/assessments/${a.id}/submissions`);
  const [polling, setPolling] = useState(false);
  const batch = useGet<BatchStatusDto>(`/assessments/${a.id}/batch`, { pollMs: polling ? 4000 : undefined });
  const { run, busy, error } = useAction();
  const [note, setNote] = useState<string | null>(null);
  const running = batch.data?.running ?? false;
  const reloadRows = rows.reload;
  useEffect(() => {
    if (polling && batch.data && !running) {
      setPolling(false);
      reloadRows();
    }
  }, [polling, batch.data, running, reloadRows]);
  const startBatch = async (what: 'evaluate' | 'grade_written') => {
    const r = await run<BatchStatusDto>(what, 'POST', `/assessments/${a.id}/batch`, { what });
    if (r) {
      batch.set(() => r);
      setPolling(r.running);
      setNote(r.total ? null : 'Nothing left to do: every submission already has a suggestion or your decision.');
    }
  };
  const release = async (on: boolean) => {
    if (!on && !(await confirm({ title: 'Withdraw released results?', message: 'Students stop seeing their marks and feedback until you release them again.', confirmLabel: 'Withdraw' }))) return;
    const r = await run<{ released: number; notReady: number }>('release', 'POST', `/assessments/${a.id}/release`, { release: on });
    if (r) {
      setNote(on ? `Released to ${r.released} student${r.released === 1 ? '' : 's'}.${r.notReady ? ` ${r.notReady} not released: some questions are not marked yet.` : ''}` : `Withdrawn for ${r.released} student${r.released === 1 ? '' : 's'}.`);
      rows.reload();
      refresh(`/assessments/${a.id}`);
    }
  };
  return (
    <div className="stack-4">
      <div className="row-wrap">
        {a.settings.aiMode !== 'off' ? (
          <Button icon={<Sparkles size={15} />} onClick={() => void startBatch('evaluate')} loading={busy === 'evaluate'} disabled={running}>
            Suggest AI-use evaluations
          </Button>
        ) : null}
        <Button icon={<Sparkles size={15} />} onClick={() => void startBatch('grade_written')} loading={busy === 'grade_written'} disabled={running}>
          Suggest marks for written answers
        </Button>
        <span className="grow" />
        <Button variant="primary" icon={<Send size={15} />} onClick={() => void release(true)} loading={busy === 'release'}>
          Release marked results
        </Button>
        <Button variant="ghost" icon={<Undo2 size={15} />} onClick={() => void release(false)}>
          Withdraw
        </Button>
      </div>
      <p className="small muted">AI suggestions run for the whole class at once, at a lower cost, and can take a few minutes. They are only suggestions: nothing counts until you decide it, and students see nothing until you release.</p>
      {batch.data && (batch.data.running || batch.data.total) ? (
        <div className="card stack-2" aria-live="polite">
          <ProgressBar value={batch.data.total ? batch.data.done / batch.data.total : 0} label="AI suggestions" />
          <span className="small">
            {batch.data.running ? 'Working: ' : 'Finished: '}
            {batch.data.done} of {batch.data.total} done{batch.data.failed ? `, ${batch.data.failed} could not be used` : ''}
            {batch.data.queuedForBudget ? `, ${batch.data.queuedForBudget} waiting for AI budget` : ''}.
          </span>
        </div>
      ) : null}
      {note ? (
        <p className="small" role="status">
          {note}
        </p>
      ) : null}
      <ErrorNote error={error} />
      <Loaded q={rows}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="No students in this class yet" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Status</th>
                    <th scope="col">Submitted</th>
                    <th scope="col">Mark</th>
                    {a.settings.aiMode !== 'off' ? <th scope="col">AI use</th> : null}
                    <th scope="col">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.student.id}>
                      <td>
                        {r.attemptId && r.status !== 'not_started' ? (
                          <button type="button" className="link-button" onClick={() => go({ v: 'review', attemptId: r.attemptId!, assessmentId: a.id })}>
                            {r.student.displayName}
                          </button>
                        ) : (
                          r.student.displayName
                        )}
                        {r.hasAccommodation ? (
                          <div className="tiny faint" title="This student has accommodations in this class.">
                            Accommodations
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                        {r.toGrade && r.status === 'submitted' ? <div className="tiny faint">{r.toGrade} to mark</div> : null}
                      </td>
                      <td className="small">{fmtDateTime(r.submittedAt)}</td>
                      <td>{r.score !== null ? `${pts(r.score)} / ${pts(r.max)}` : '—'}</td>
                      {a.settings.aiMode !== 'off' ? (
                        <td className="small">
                          {r.evaluationReviewed ? 'Decided' : EVAL[r.evaluation]}
                        </td>
                      ) : null}
                      <td>
                        <Signals s={r.signals} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      <p className="tiny faint">Activity counts are things to look at, never conclusions. {HONEST_LIMITS}</p>
    </div>
  );
}

export function Overview({ a }: { a: AssessmentDto }) {
  const o = useGet<ClassOverviewDto>(`/assessments/${a.id}/overview`);
  return (
    <Loaded q={o}>
      {(d) => {
        const c = d.completion;
        const maxBucket = Math.max(1, ...d.scores.buckets);
        return (
          <div className="stack-4">
            <div className="grid grid-2">
              <div className="card stack-2">
                <h2 className="h2">Completion</h2>
                <p>
                  {c.submitted} of {c.students} submitted · {c.started - c.submitted} in progress · {c.graded} marked · {c.released} released
                </p>
                <ProgressBar value={c.students ? c.submitted / c.students : 0} label="Submitted" />
              </div>
              <div className="card stack-2">
                <h2 className="h2">Marks</h2>
                {d.scores.mean === null ? (
                  <p className="small muted">Shown once work is marked.</p>
                ) : (
                  <>
                    <p>
                      Average {pts(d.scores.mean)} out of {pts(d.scores.max)}
                    </p>
                    <div className="score-bars" role="img" aria-label={`Marks by fifth of the total: ${d.scores.buckets.join(', ')} students`}>
                      {d.scores.buckets.map((n, i) => (
                        <div key={i} className="score-bar">
                          <div style={{ height: `${(n / maxBucket) * 60}px` }} />
                          <span className="tiny">
                            {i * 20}–{i * 20 + 20}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Results by question</caption>
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">Answered</th>
                    <th scope="col">Correct</th>
                    <th scope="col">Average</th>
                    <th scope="col">Most common wrong answers</th>
                  </tr>
                </thead>
                <tbody>
                  {d.questions.map((q) => (
                    <tr key={q.itemId}>
                      <th scope="row">{q.position}</th>
                      <td>{q.answered}</td>
                      <td>{q.correct === null ? 'Marked by you' : `${q.correct} of ${q.answered}`}</td>
                      <td>{q.meanScore === null ? '—' : `${pts(q.meanScore)} / ${pts(q.points)}`}</td>
                      <td className="small">
                        {q.commonWrong.length
                          ? q.commonWrong.map((w) => (
                              <div key={w.answer}>
                                “{w.answer}” × {w.count}
                                {w.misconception ? <span className="muted"> · {w.misconception}</span> : null}
                              </div>
                            ))
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {d.aiUse.evaluated ? (
              <div className="card stack-2">
                <h2 className="h2">AI use (your decisions, {d.aiUse.evaluated} students)</h2>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Criterion</th>
                        {[1, 2, 3, 4].map((l) => (
                          <th key={l} scope="col">
                            Level {l}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.aiUse.criteria.map((cr) => (
                        <tr key={cr.criterionId}>
                          <th scope="row">{cr.label}</th>
                          {cr.counts.map((n, i) => (
                            <td key={i}>{n}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {c.submitted === 0 ? <Banner tone="info">Nothing submitted yet.</Banner> : null}
          </div>
        );
      }}
    </Loaded>
  );
}
