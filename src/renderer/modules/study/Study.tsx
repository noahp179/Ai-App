import { BookOpen, CalendarCheck, ClipboardList, Compass, GraduationCap, LayoutDashboard, LineChart, ListChecks, MessageCircle, PieChart, RefreshCcw, Settings2, UserRound } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { GAP_LABEL, LESSON_MODE_LABEL, MASTERY_LABEL, MASTERY_STATUSES, PLAN_ACTIVITY_LABEL, QUIZ_KIND_LABEL } from '../../../shared/study/types';
import { Badge, Banner, Button, EmptyState, ErrorState, Loading } from '../../components/ui';
import { api } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { ExpLink, indexOf, studentStyle } from './common';
import { ProfileGate } from './Profiles';

const Explore = lazy(() => import('./Explore'));
const LessonPage = lazy(() => import('./Lesson'));
const Practice = lazy(() => import('./Practice'));
const Plan = lazy(() => import('./Plan'));
const Assessments = lazy(() => import('./Assessments'));
const Tutor = lazy(() => import('./Tutor'));
const Progress = lazy(() => import('./Progress'));
const Coverage = lazy(() => import('./Coverage'));
const LearningSettings = lazy(() => import('./LearningSettings'));

const NAV = [
  { id: '', label: 'My dashboard', icon: LayoutDashboard },
  { id: 'explore', label: 'Curriculum', icon: Compass },
  { id: 'practice', label: 'Practice & quizzes', icon: ListChecks },
  { id: 'review', label: 'Review', icon: RefreshCcw },
  { id: 'plan', label: 'Planner & assignments', icon: CalendarCheck },
  { id: 'assessments', label: 'Assessments', icon: ClipboardList },
  { id: 'tutor', label: 'AI tutor', icon: MessageCircle },
  { id: 'progress', label: 'Progress', icon: LineChart },
  { id: 'coverage', label: 'Coverage', icon: PieChart },
  { id: 'settings', label: 'Learning settings', icon: Settings2 },
];

/** Pages that work without a profile (they show only shared, non-personal information). */
const PUBLIC = new Set(['explore', 'course', 'coverage']);

export default function Study() {
  const route = useRoute();
  const me = useQuery('study:me', () => api.study.me());
  const seg = route.segments[1] ?? '';
  if (me.error) return <ErrorState error={me.error} onRetry={me.reload} />;
  if (me.data === undefined) return <Loading />;
  if (!me.data && !PUBLIC.has(seg)) return <ProfileGate />;
  const active = seg === 'e' || seg === 'course' ? 'explore' : seg === 'lesson' ? '' : seg === 'quiz' ? 'practice' : seg;
  return (
    <div className="study" style={studentStyle(me.data)}>
      <nav className="study-nav" aria-label="Student Learning sections">
        <div className="study-nav-head">
          <GraduationCap size={18} />
          <div className="grow">
            <strong>Student Learning</strong>
            {me.data ? (
              <div className="tiny muted">
                {me.data.displayName} · Grade {me.data.grade}
              </div>
            ) : null}
          </div>
        </div>
        {NAV.map((n) => (
          <button key={n.id} type="button" className={`nav-item ${active === n.id ? 'active' : ''}`} aria-current={active === n.id ? 'page' : undefined} onClick={() => navigate(`/study${n.id ? `/${n.id}` : ''}`)}>
            <n.icon size={15} /> {n.label}
          </button>
        ))}
        {me.data ? (
          <button
            type="button"
            className="nav-item"
            onClick={() =>
              void api.study.closeProfile().then(() => {
                invalidate('study');
                navigate('/study');
              })
            }
          >
            <UserRound size={15} /> Switch profile
          </button>
        ) : null}
      </nav>
      <div className="study-main">
        <Suspense fallback={<Loading />}>
          {seg === '' ? <Dashboard /> : null}
          {seg === 'explore' || seg === 'course' || seg === 'e' ? <Explore /> : null}
          {seg === 'lesson' && route.segments[2] ? <LessonPage id={route.segments[2]} /> : null}
          {seg === 'practice' || seg === 'quiz' || seg === 'review' ? <Practice /> : null}
          {seg === 'plan' ? <Plan /> : null}
          {seg === 'assessments' ? <Assessments /> : null}
          {seg === 'tutor' ? <Tutor /> : null}
          {seg === 'progress' ? <Progress /> : null}
          {seg === 'coverage' ? <Coverage /> : null}
          {seg === 'settings' ? <LearningSettings /> : null}
        </Suspense>
      </div>
    </div>
  );
}

function Dashboard() {
  const d = useQuery('study:dashboard', () => api.study.dashboard());
  if (d.error) return <ErrorState error={d.error} onRetry={d.reload} />;
  if (!d.data) return <Loading />;
  const x = d.data;
  const total = MASTERY_STATUSES.reduce((a, s) => a + x.byStatus[s], 0);
  return (
    <div className="page stack-5" style={{ maxWidth: 1100 }}>
      <div>
        <h1>Hi, {x.profile.displayName}</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          {x.profile.goals[0] ? `Your goal: ${x.profile.goals[0]}` : 'Pick up where you left off, or choose something from the curriculum.'}
        </p>
      </div>
      {!x.profile.courseIds.length ? (
        <Banner tone="info" title="Add your courses">
          Choose your subjects in <button type="button" className="link-button" onClick={() => navigate('/study/settings')}>Learning settings</button> so suggestions and plans fit what you’re taking.
        </Banner>
      ) : null}
      {x.plansWithMissed.length ? (
        <Banner tone="warn" title="Some planned study sessions were missed">
          No problem — your progress is safe. <button type="button" className="link-button" onClick={() => navigate('/study/plan')}>Move them to new times</button>.
        </Banner>
      ) : null}

      {x.continueLessons.length ? (
        <section className="stack-3" aria-label="Continue learning">
          <h2 className="h2">Continue learning</h2>
          <div className="grid grid-2">
            {x.continueLessons.map((l) => (
              <button key={l.id} type="button" className="card interactive stack-2" style={{ textAlign: 'left' }} onClick={() => navigate(`/study/lesson/${l.id}`)}>
                <div className="row">
                  <BookOpen size={15} />
                  <strong className="grow">{l.title}</strong>
                  <Badge tone="outline">{l.status === 'paused' ? 'Paused' : 'In progress'}</Badge>
                </div>
                <span className="tiny muted">
                  {LESSON_MODE_LABEL[l.mode]} · step {l.stepIndex + 1} of {l.steps} · {indexOf(l.expectationId)}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="stack-3" aria-label="Suggested next">
        <h2 className="h2">Suggested next</h2>
        {x.recommendations.length ? (
          <div className="grid grid-2">
            {x.recommendations.map((r) => (
              <div key={`${r.kind}:${r.expectationId}`} className="card stack-2">
                <strong>{r.title}</strong>
                <span className="small muted">{r.reason}</span>
                <div className="row">
                  <Button size="sm" variant="primary" onClick={() => navigate(`/study/e/${encodeURIComponent(r.expectationId)}`)}>
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing suggested yet">Open the curriculum and start a lesson or a short diagnostic; suggestions will follow from your answers.</EmptyState>
        )}
      </section>

      <div className="grid grid-2">
        <section className="card stack-3" aria-label="Coming up">
          <h2 className="h2">Coming up</h2>
          {x.upcoming.length ? (
            <ul className="list">
              {x.upcoming.map((s) => (
                <li key={s.id} className="list-item">
                  <span className="grow">
                    <strong>{PLAN_ACTIVITY_LABEL[s.activity]}</strong>
                    <span className="tiny muted">
                      {' '}
                      · {s.date} {s.start} · {s.minutes} min
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">No approved study sessions this week. Make a plan in Planner & assignments.</p>
          )}
          {x.assignments.length ? (
            <p className="small">
              Due soon: {x.assignments.map((a) => `${a.title}${a.dueAt ? ` (${a.dueAt.slice(0, 10)})` : ''}`).join(', ')}
            </p>
          ) : null}
        </section>
        <section className="card stack-3" aria-label="Review and practice">
          <h2 className="h2">Review</h2>
          <p className="small">{x.reviewsDue ? `${x.reviewsDue} topic${x.reviewsDue === 1 ? ' is' : 's are'} due for a short review.` : 'Nothing is due for review right now.'}</p>
          {x.reviewsDue ? (
            <div>
              <Button size="sm" onClick={() => navigate('/study/review')}>
                Start review
              </Button>
            </div>
          ) : null}
          {x.gaps.length ? (
            <ul className="small">
              {x.gaps.map((g, i) => (
                <li key={i}>
                  <ExpLink id={g.expectationId}>{indexOf(g.expectationId)}</ExpLink>: {GAP_LABEL[g.kind]}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <div className="grid grid-2">
        <section className="card stack-3" aria-label="Your progress">
          <h2 className="h2">Your progress</h2>
          {total ? (
            <ul className="small">
              {MASTERY_STATUSES.filter((s) => x.byStatus[s]).map((s) => (
                <li key={s}>
                  {MASTERY_LABEL[s]}: {x.byStatus[s]}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Your progress shows up here once you answer some questions.</p>
          )}
          <p className="tiny faint">Learning indicators from answers marked in the app — not Ontario achievement levels or marks.</p>
        </section>
        <section className="card stack-3" aria-label="Recent">
          <h2 className="h2">Recently</h2>
          {x.recentLessons.length || x.recentQuizzes.length ? (
            <ul className="small">
              {x.recentLessons.slice(0, 3).map((l) => (
                <li key={l.id}>
                  Lesson: {l.title} ({indexOf(l.expectationId)})
                </li>
              ))}
              {x.recentQuizzes.slice(0, 3).map((q) => (
                <li key={q.id}>
                  {QUIZ_KIND_LABEL[q.kind]}: {q.correct} of {q.questions} right{q.hintsUsed ? `, ${q.hintsUsed} hint${q.hintsUsed === 1 ? '' : 's'}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Nothing yet.</p>
          )}
        </section>
      </div>
      {!x.ai.available ? <p className="tiny faint">AI tutor: {x.ai.reason} Everything else here works without it.</p> : null}
    </div>
  );
}
