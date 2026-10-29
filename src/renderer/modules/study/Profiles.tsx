import { Lock, Plus, UserRound } from 'lucide-react';
import { useState } from 'react';
import { EXPLANATION_STYLES, EXPLANATION_STYLE_LABEL, GOAL_KINDS, GOAL_LABEL, GRADES, type ExplanationStyle, type GoalKind, type StudentProfile } from '../../../shared/study/types';
import { Banner, Button, EmptyState, Field, Input, Loading, Modal, Select, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { WEEKDAYS } from './common';

/** Shown when no profile is open: pick one (with its PIN) or create a new one. */
export function ProfileGate() {
  const list = useQuery('study:profiles', () => api.study.profiles());
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [pinFor, setPinFor] = useState<{ id: string; name: string } | null>(null);
  const [pin, setPin] = useState('');
  if (!list.data) return <Loading />;
  const open = async (id: string, p?: string) => {
    try {
      await api.study.openProfile(id, p ?? null);
      setPinFor(null);
      setPin('');
      invalidate('study');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  if (creating || !list.data.length) return <Onboarding onCancel={list.data.length ? () => setCreating(false) : undefined} />;
  return (
    <div className="page stack-5" style={{ maxWidth: 760 }}>
      <div>
        <h1>Student Learning</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Lessons, practice and planning for the Ontario curriculum, Grades 6 to 12. Choose your profile. Each profile’s work is private to it.
        </p>
      </div>
      <div className="grid grid-2">
        {list.data.map((s) => (
          <button key={s.id} type="button" className="card interactive row" style={{ textAlign: 'left' }} onClick={() => (s.hasPin ? setPinFor({ id: s.id, name: s.displayName }) : void open(s.id))}>
            <UserRound size={20} />
            <span className="grow">
              <strong>{s.displayName}</strong>
              <span className="small muted"> · Grade {s.grade}</span>
            </span>
            {s.hasPin ? <Lock size={14} aria-label="Protected with a PIN" /> : null}
          </button>
        ))}
        <button type="button" className="card interactive row" onClick={() => setCreating(true)}>
          <Plus size={18} /> <span>New student profile</span>
        </button>
      </div>
      <p className="tiny faint">Profiles are stored only on this computer. Anyone using this computer can see profile names and grades, but not what’s inside a profile with a PIN.</p>
      {pinFor ? (
        <Modal
          title={`Open ${pinFor.name}’s profile`}
          onClose={() => setPinFor(null)}
          footer={
            <>
              <Button onClick={() => setPinFor(null)}>Cancel</Button>
              <Button variant="primary" disabled={!pin} onClick={() => void open(pinFor.id, pin)}>
                Open
              </Button>
            </>
          }
        >
          <Field label="Profile PIN" htmlFor="study-pin">
            <Input id="study-pin" type="password" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pin && void open(pinFor.id, pin)} />
          </Field>
          <p className="tiny faint">Forgot it? A parent with the Parental Learning Controls PIN can reset it in Settings → Student Learning.</p>
        </Modal>
      ) : null}
    </div>
  );
}

/**
 * Onboarding asks only what is needed to personalise learning. Everything except a name and grade can be skipped
 * and changed later. Confidence is recorded as the student's own view, never as proof of knowledge.
 */
export function Onboarding({ onCancel }: { onCancel?: () => void }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<number>(7);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [goalKinds, setGoalKinds] = useState<GoalKind[]>([]);
  const [goal, setGoal] = useState('');
  const [style, setStyle] = useState<ExplanationStyle>('step_by_step');
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [days, setDays] = useState<(1 | 2 | 3 | 4 | 5 | 6 | 7)[]>([1, 2, 3, 4, 5]);
  const [minutes, setMinutes] = useState(30);
  const [session, setSession] = useState<5 | 10 | 20 | 30>(20);
  const [time, setTime] = useState('16:30');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const courses = useQuery(`study:onboard:courses:${grade}`, () => api.curriculum.courses({ grade }));

  const save = async () => {
    setBusy(true);
    try {
      const input: Partial<StudentProfile> = {
        displayName: name.trim(),
        grade: grade as StudentProfile['grade'],
        courseIds,
        goalKinds,
        goals: goal.trim() ? [goal.trim()] : [],
        explanationStyle: style,
        confidence,
        studyDays: days,
        dailyMinutes: minutes,
        sessionMinutes: session,
        studyTime: time,
        onboarded: true,
      };
      await api.study.createProfile(input, pin || null);
      toast('Profile created', 'success');
      invalidate('study');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const steps = ['About you', 'Courses', 'Goals', 'How you like to learn', 'Study time', 'Privacy'];
  const canNext = step === 0 ? name.trim().length > 0 : true;
  return (
    <div className="page stack-4" style={{ maxWidth: 760 }}>
      <div>
        <h1>Set up your learning profile</h1>
        <p className="muted small" style={{ marginTop: 4 }}>
          Step {step + 1} of {steps.length}: {steps[step]}. Only your name and grade are needed — skip anything else and change it later.
        </p>
      </div>
      <div className="card stack-4">
        {step === 0 ? (
          <>
            <Field label="First name or nickname" hint="Used only on this computer, to tell profiles apart. It is never sent to an AI provider." htmlFor="ob-name">
              <Input id="ob-name" autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Grade" htmlFor="ob-grade">
              <Select id="ob-grade" value={String(grade)} onChange={(e) => setGrade(Number(e.target.value))}>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}
        {step === 1 ? (
          <Field label={`Subjects and courses for Grade ${grade}`} hint="From the Ontario curriculum. Pick the ones you take; you can add more later.">
            {!courses.data ? (
              <Loading />
            ) : (
              <div className="chip-list" role="group" aria-label="Courses">
                {courses.data.map((c) => (
                  <button key={c.id} type="button" className="chip" aria-pressed={courseIds.includes(c.id)} onClick={() => setCourseIds(courseIds.includes(c.id) ? courseIds.filter((x) => x !== c.id) : [...courseIds, c.id])}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </Field>
        ) : null}
        {step === 2 ? (
          <>
            <Field label="What do you want to get out of this?">
              <div className="chip-list" role="group" aria-label="Goals">
                {GOAL_KINDS.map((g) => (
                  <button key={g} type="button" className="chip" aria-pressed={goalKinds.includes(g)} onClick={() => setGoalKinds(goalKinds.includes(g) ? goalKinds.filter((x) => x !== g) : [...goalKinds, g])}>
                    {GOAL_LABEL[g]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="In your own words (optional)" htmlFor="ob-goal">
              <Input id="ob-goal" maxLength={200} value={goal} placeholder="e.g. Feel ready for my fractions test" onChange={(e) => setGoal(e.target.value)} />
            </Field>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <Field label="Explanations I like" hint="This is a preference for how lessons start. It isn’t a ‘learning style’, and lessons always offer other ways to explain.">
              <Select value={style} onChange={(e) => setStyle(e.target.value as ExplanationStyle)} aria-label="Explanation style">
                {EXPLANATION_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {EXPLANATION_STYLE_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            {courseIds.length ? (
              <Field label="How confident do you feel? (optional)" hint="Your own view. FlowCompanion still checks with short, low-pressure questions before deciding where to start.">
                <div className="stack-2">
                  {courseIds.map((cid) => (
                    <label key={cid} className="row small">
                      <span className="grow">{courses.data?.find((c) => c.id === cid)?.label ?? cid}</span>
                      <select className="select" value={confidence[cid] ?? ''} onChange={(e) => setConfidence({ ...confidence, [cid]: Number(e.target.value) })} aria-label={`Confidence for ${cid}`}>
                        <option value="">Skip</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} — {['not at all', 'a little', 'okay', 'quite', 'very'][n - 1]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </Field>
            ) : null}
          </>
        ) : null}
        {step === 4 ? (
          <>
            <Field label="Days you can study">
              <div className="chip-list" role="group" aria-label="Study days">
                {WEEKDAYS.map(({ d, label }) => (
                  <button key={d} type="button" className="chip" aria-pressed={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort())}>
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="field-row">
              <Field label="Minutes per day" htmlFor="ob-min">
                <Input id="ob-min" type="number" min={5} max={240} value={minutes} onChange={(e) => setMinutes(Math.max(5, Math.min(240, Number(e.target.value) || 30)))} style={{ width: 100 }} />
              </Field>
              <Field label="Session length" htmlFor="ob-sess">
                <Select id="ob-sess" value={String(session)} onChange={(e) => setSession(Number(e.target.value) as 5 | 10 | 20 | 30)}>
                  {[5, 10, 20, 30].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Usual start time" htmlFor="ob-time">
                <input id="ob-time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            </div>
          </>
        ) : null}
        {step === 5 ? (
          <>
            <Banner tone="info" title="Your learning stays on this computer">
              Lessons, answers and progress are saved only here, in this profile. AI tutoring is <strong>off</strong> until you turn it on in Learning Settings, after reading exactly what would be sent. Sharing with a parent is also off until you choose it.
            </Banner>
            <Field label="Profile PIN (optional)" hint="Stops other people using this computer from opening your profile. 4 or more characters." htmlFor="ob-pin">
              <Input id="ob-pin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} style={{ maxWidth: 220 }} />
            </Field>
          </>
        ) : null}
        <div className="row">
          {onCancel && step === 0 ? <Button onClick={onCancel}>Cancel</Button> : null}
          {step > 0 ? <Button onClick={() => setStep(step - 1)}>Back</Button> : null}
          <span className="grow" />
          {step < steps.length - 1 ? (
            <>
              {step > 0 ? (
                <Button variant="ghost" onClick={() => setStep(step + 1)}>
                  Skip
                </Button>
              ) : null}
              <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
                Next
              </Button>
            </>
          ) : (
            <Button variant="primary" loading={busy} disabled={!name.trim() || (!!pin && pin.length < 4)} onClick={() => void save()}>
              Create profile
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function NoProfiles() {
  return <EmptyState icon={<UserRound size={28} />} title="No student profile open" />;
}
