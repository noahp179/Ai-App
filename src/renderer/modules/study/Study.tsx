import { BookOpen, CalendarCheck, ClipboardList, Compass, GraduationCap, LayoutDashboard, LineChart, ListChecks, MessageCircle, PieChart, RefreshCcw, Settings2, UserRound } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { GAP_LABEL, LESSON_MODE_LABEL, MASTERY_LABEL, MASTERY_STATUSES, PLAN_ACTIVITY_LABEL, QUIZ_KIND_LABEL, type Recommendation } from '../../../shared/study/types';
import { Badge, Banner, Button, EmptyState, ErrorState, Loading, ProgressBar, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { ExpLink, NoGuaranteeNotice, indexOf, studentStyle } from './common';
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

const NAV_GROUPS = [
  {
    label: 'Learn',
    items: [
      { id: '', label: 'My dashboard', icon: LayoutDashboard },
      { id: 'explore', label: 'Curriculum', icon: Compass },
      { id: 'practice', label: 'Practice & quizzes', icon: ListChecks },
      { id: 'review', label: 'Review', icon: RefreshCcw },
      { id: 'tutor', label: 'AI tutor', icon: MessageCircle },
    ],
  },
  {
    label: 'Plan',
    items: [
      { id: 'plan', label: 'Planner', icon: CalendarCheck },
      { id: 'assessments', label: 'Assessments', icon: ClipboardList },
    ],
  },
  {
    label: 'Track',
    items: [
      { id: 'progress', label: 'Progress', icon: LineChart },
      { id: 'coverage', label: 'Coverage', icon: PieChart },
    ],
  },
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
        {me.data ? (
          <div className="study-profile">
            <span className="study-avatar" aria-hidden title={`${me.data.displayName} · Grade ${me.data.grade}`}>
              {me.data.displayName.charAt(0).toUpperCase()}
            </span>
            <span className="study-profile-text">
              <strong className="ellipsis">{me.data.displayName}</strong>
              <span className="tiny muted">Grade {me.data.grade}</span>
            </span>
            <button
              type="button"
              className="icon-btn sm"
              title="Switch profile"
              aria-label="Switch profile"
              onClick={() =>
                void api.study.closeProfile().then(() => {
                  invalidate('study');
                  navigate('/study');
                })
              }
            >
              <UserRound size={15} />
            </button>
          </div>
        ) : (
          <div className="study-profile">
            <GraduationCap size={18} />
            <strong>Student Learning</strong>
          </div>
        )}
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="study-nav-group" role="group" aria-label={g.label}>
            <div className="nav-section">{g.label}</div>
            {g.items.map((n) => (
              <button key={n.id} type="button" title={n.label} aria-label={n.label} className={`nav-item ${active === n.id ? 'active' : ''}`} aria-current={active === n.id ? 'page' : undefined} onClick={() => navigate(`/study${n.id ? `/${n.id}` : ''}`)}>
                <n.icon size={15} /> <span>{n.label}</span>
              </button>
            ))}
          </div>
        ))}
        <div className="study-nav-foot">
          <button type="button" title="Learning settings" aria-label="Learning settings" className={`nav-item ${active === 'settings' ? 'active' : ''}`} aria-current={active === 'settings' ? 'page' : undefined} onClick={() => navigate('/study/settings')}>
            <Settings2 size={15} /> <span>Learning settings</span>
          </button>
        </div>
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
          <div className="grid grid-2 dash-grid">
            {x.recommendations.map((r) => (
              <Suggestion key={`${r.kind}:${r.expectationId}`} r={r} aiOk={x.ai.available} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing suggested yet">
            <Button variant="primary" onClick={() => navigate('/study/explore')}>
              Browse the curriculum
            </Button>
          </EmptyState>
        )}
      </section>

      <div className="grid grid-2 dash-grid">
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
            <p className="small muted">No approved study sessions this week. Make one in the Planner.</p>
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

      <div className="grid grid-2 dash-grid">
        <section className="card stack-3" aria-label="Your progress">
          <h2 className="h2">Your progress</h2>
          {x.courseProgress.length ? (
            <div className="stack-3">
              {x.courseProgress.map((c) => (
                <div key={c.courseId} className="course-progress">
                  <div className="row small">
                    <button type="button" className="link-button grow" style={{ textAlign: 'left' }} onClick={() => navigate(`/study/course/${encodeURIComponent(c.courseId)}`)}>
                      {c.label}
                    </button>
                    <span className="tiny muted">
                      {c.proficient} of {c.expectations} proficient
                    </span>
                  </div>
                  <ProgressBar value={c.expectations ? (100 * c.proficient) / c.expectations : 0} label={`${c.label}: ${c.proficient} of ${c.expectations} expectations proficient in the app`} />
                  <span className="tiny faint">
                    Practised {c.practised} · {c.offline ? `${c.offline} with offline lessons` : 'no offline lessons yet (Ministry supports or AI)'}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
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
          <NoGuaranteeNotice compact />
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
      {!x.ai.available ? (
        <Banner tone="info" title="The AI tutor isn’t ready">
          {x.ai.reason} Lessons, practice and planning work without it.{' '}
          {x.ai.studentAllows === false ? (
            <button type="button" className="link-button" onClick={() => navigate('/study/settings')}>
              Turn it on in Learning settings
            </button>
          ) : (
            <button type="button" className="link-button" onClick={() => navigate('/settings/ai')}>
              Open Settings → AI providers
            </button>
          )}
        </Banner>
      ) : null}
    </div>
  );
}

const KIND_TAG: Record<Recommendation['kind'], string> = {
  start: 'New',
  retry_lesson: 'Try again',
  more_practice: 'Practise',
  spaced_review: 'Review',
  extension: 'Challenge',
  review_prerequisite: 'Earlier skill',
  move_on: 'Next up',
};

/** A suggestion that can be acted on directly: start the lesson, practise, or review, without hunting for a button. */
function Suggestion({ r, aiOk }: { r: Recommendation; aiOk: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (what: string, fn: () => Promise<string>) => {
    setBusy(what);
    try {
      navigate(await fn());
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const lesson = () =>
    run('lesson', async () => {
      const mode = r.kind === 'extension' ? 'challenge' : r.kind === 'more_practice' ? 'practice' : r.kind === 'spaced_review' ? 'revision' : 'full';
      const l = await api.study.startLesson({ expectationId: r.expectationId, mode, source: 'auto' });
      return `/study/lesson/${l.id}`;
    });
  const practise = () =>
    run('practice', async () => {
      const q = r.kind === 'spaced_review' ? await api.study.startReview([r.expectationId]) : await api.study.createQuiz({ kind: 'practice', expectationIds: [r.expectationId] });
      return `/study/quiz/${q.id}`;
    });
  const canPractise = !!r.offline || aiOk;
  const source = r.offline ? (
    <Badge tone="ok" title="FlowCompanion lesson with practice checked by code; works offline">
      Offline lesson
    </Badge>
  ) : aiOk ? (
    <Badge tone="warn" title="Written by AI from the official expectation">
      AI lesson
    </Badge>
  ) : r.supports ? (
    <Badge tone="info" title="Lesson built from the Ministry's teacher supports">
      Ministry supports
    </Badge>
  ) : (
    <Badge tone="outline" title="The official expectation, with reflection prompts">
      Official text
    </Badge>
  );
  return (
    <article className="card dash-card" aria-label={`${KIND_TAG[r.kind]}: ${indexOf(r.expectationId)}`}>
      <div className="row-wrap" style={{ gap: 6 }}>
        <Badge tone="accent">{KIND_TAG[r.kind]}</Badge>
        {source}
      </div>
      <div className="dash-card-title">
        <strong>{indexOf(r.expectationId)}</strong>
        {r.course ? <span className="small muted"> · {r.course}</span> : null}
      </div>
      {r.text ? <p className="small">{r.text}</p> : null}
      <p className="tiny muted">{r.reason}</p>
      <div className="row-wrap dash-card-actions">
        <Button size="sm" variant="primary" icon={<BookOpen size={13} />} loading={busy === 'lesson'} disabled={!!busy} onClick={() => void lesson()}>
          {r.kind === 'spaced_review' ? 'Review lesson' : 'Start lesson'}
        </Button>
        {canPractise ? (
          <Button size="sm" icon={<ListChecks size={13} />} loading={busy === 'practice'} disabled={!!busy} onClick={() => void practise()}>
            {r.kind === 'spaced_review' ? 'Quick review' : 'Practice'}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => navigate(`/study/e/${encodeURIComponent(r.expectationId)}`)}>
          Details
        </Button>
      </div>
    </article>
  );
}
