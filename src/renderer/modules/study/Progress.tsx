import { Download } from 'lucide-react';
import { useState } from 'react';
import { MASTERY_LABEL, MASTERY_STATUSES } from '../../../shared/study/types';
import { Button, Loading, Select, Tabs, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useQuery } from '../../lib/query';
import { useSettings } from '../../lib/settings';
import { ExpLink, StatusBadge, indexOf } from './common';

const MEANING: Record<string, string> = {
  not_assessed: 'No answers yet.',
  not_yet: 'Answers so far haven’t been right yet — that’s where learning starts.',
  in_progress: 'Some answers right, fewer than half recently.',
  developing: 'Getting there: more independent practice, or harder questions, still needed.',
  proficient: 'Enough recent answers right without hints, at grade level.',
  extension_ready: 'Strong, independent results including harder questions on more than one day.',
  review: 'Was proficient; a short review now helps it stick.',
};

export default function Progress() {
  const [tab, setTab] = useState<'mastery' | 'activity' | 'report'>('mastery');
  return (
    <div className="page stack-4" style={{ maxWidth: 1000 }}>
      <h1>Progress</h1>
      <Tabs
        label="Progress sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'mastery', label: 'By expectation' },
          { value: 'activity', label: 'Activity and reflections' },
          { value: 'report', label: 'Report' },
        ]}
      />
      {tab === 'mastery' ? <Mastery /> : tab === 'activity' ? <Activity /> : <Report />}
    </div>
  );
}

function Mastery() {
  const { settings } = useSettings();
  const me = useQuery('study:me', () => api.study.me());
  const all = useQuery('study:mastery', () => api.study.mastery());
  const [cid, setCid] = useState('');
  const course = cid || me.data?.courseIds[0] || '';
  const prog = useQuery(course ? `study:course:${course}` : null, () => api.study.courseProgress(course));
  const courses = useQuery(me.data ? `study:pcourses:${me.data.grade}` : null, () => api.curriculum.courses({ grade: me.data!.grade }));
  return (
    <div className="stack-4">
      <details className="card small">
        <summary>How these indicators work</summary>
        <div className="stack-2" style={{ marginTop: 8 }}>
          <p>
            Each expectation’s status comes from your last {12} answers on it. Harder questions count a bit more, answers that needed hints count as “with help”, answers on AI-written questions count for less because their keys aren’t checked, and older answers slowly count less. Proficient needs at least {settings.study.minIndependentCorrect} answers right without hints and about {Math.round(settings.study.proficientThreshold * 100)}% overall (both adjustable in Settings → Student Learning).
          </p>
          <ul>
            {MASTERY_STATUSES.map((s) => (
              <li key={s}>
                <strong>{MASTERY_LABEL[s]}:</strong> {MEANING[s]}
              </li>
            ))}
          </ul>
          <p className="faint">These are FlowCompanion’s learning indicators. They are not Ontario achievement levels, marks or a prediction, and the percentage is a weighted share of recent answers, not a probability.</p>
        </div>
      </details>
      <Select value={course} onChange={(e) => setCid(e.target.value)} aria-label="Course">
        {(courses.data ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
      {!prog.data ? (
        course ? <Loading /> : <p className="small muted">Choose a course.</p>
      ) : (
        <table className="table small">
          <thead>
            <tr>
              <th>Expectation</th>
              <th>Strand</th>
              <th>Status</th>
              <th>Offline practice</th>
            </tr>
          </thead>
          <tbody>
            {prog.data.rows.map((r) => (
              <tr key={r.expectationId}>
                <td>
                  <ExpLink id={r.expectationId}>{r.index}</ExpLink>
                </td>
                <td>{r.strand}</td>
                <td>
                  <StatusBadge status={r.status} estimate={r.estimate} />
                </td>
                <td>{r.offline ? 'Yes' : r.supports ? 'Ministry supports' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {all.data && all.data.some((r) => !prog.data?.rows.some((x) => x.expectationId === r.expectationId)) ? (
        <section className="stack-2">
          <h2 className="h2">Other expectations you’ve worked on</h2>
          <ul className="small">
            {all.data
              .filter((r) => !prog.data?.rows.some((x) => x.expectationId === r.expectationId))
              .map((r) => (
                <li key={r.expectationId}>
                  <ExpLink id={r.expectationId}>{indexOf(r.expectationId)}</ExpLink> <StatusBadge status={r.status} estimate={settings.study.showEstimates ? r.estimate : null} />
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Activity() {
  const a = useQuery('study:activity', () => api.study.activity(100));
  if (!a.data) return <Loading />;
  const label: Record<string, string> = { lesson_started: 'Started lesson', lesson_completed: 'Finished lesson', lesson_paused: 'Paused lesson', quiz_started: 'Started', quiz_completed: 'Finished', reflection: 'Reflection' };
  return a.data.length ? (
    <table className="table small">
      <thead>
        <tr>
          <th>When</th>
          <th>What</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {a.data.map((x, i) => {
          let detail = x.detail;
          if (x.kind === 'reflection') {
            try {
              const r = JSON.parse(x.detail) as { confidence: number; note: string };
              detail = `Confidence ${r.confidence}/5${r.note ? ` — “${r.note}”` : ''} (your own view, not evidence)`;
            } catch {
              /* keep raw */
            }
          }
          return (
            <tr key={i}>
              <td className="nowrap">{x.at.slice(0, 16).replace('T', ' ')}</td>
              <td>{label[x.kind] ?? x.kind}</td>
              <td>
                {detail}
                {x.seconds ? <span className="faint"> · {Math.round(x.seconds / 60)} min</span> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  ) : (
    <p className="small muted">Nothing yet.</p>
  );
}

function Report() {
  const toast = useToast();
  const r = useQuery('study:report', () => api.study.myReport());
  if (!r.data) return <Loading />;
  const x = r.data;
  return (
    <div className="card stack-3">
      <p className="tiny faint">{x.privacyNote}</p>
      {x.goals?.length ? <p>Goals: {x.goals.join('; ')}</p> : null}
      {x.activities ? (
        <p>
          {x.activities.lessonsCompleted} lessons and {x.activities.quizzesCompleted} quizzes finished; {x.activities.questionsAnswered} questions answered; about {x.activities.minutesStudied} minutes recorded.
        </p>
      ) : null}
      {x.progress?.map((c) => (
        <div key={c.courseId} className="stack-1">
          <strong>{c.course}</strong>
          <span className="small">
            {MASTERY_STATUSES.filter((s) => c.byStatus[s]).map((s) => `${MASTERY_LABEL[s]}: ${c.byStatus[s]}`).join(' · ') || 'Nothing practised yet.'}
          </span>
        </div>
      ))}
      <p className="tiny faint">{x.disclaimer}</p>
      <div>
        <Button icon={<Download size={14} />} onClick={() => void api.study.exportMyReport().then((s) => s.saved && toast('Report saved', 'success')).catch((e: unknown) => toast(errorMessage(e), 'error'))}>
          Save as a file
        </Button>
      </div>
    </div>
  );
}
