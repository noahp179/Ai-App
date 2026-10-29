import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EXPLANATION_STYLES, EXPLANATION_STYLE_LABEL, GOAL_KINDS, GOAL_LABEL, GRADES, type ExplanationStyle, type StudentProfile } from '../../../shared/study/types';
import { Banner, Button, Field, Input, Loading, Modal, Select, Toggle, useConfirm, usePrompt, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { navigate } from '../../lib/router';
import { WEEKDAYS } from './common';

export default function LearningSettings() {
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const me = useQuery('study:me', () => api.study.me());
  const ai = useQuery('study:ai', () => api.study.aiStatus());
  const courses = useQuery(me.data ? `study:pcourses:${me.data.grade}` : null, () => api.curriculum.courses({ grade: me.data!.grade }));
  const [aiDialog, setAiDialog] = useState(false);
  if (!me.data) return <Loading />;
  const p = me.data;
  const save = async (patch: Partial<StudentProfile>, msg = 'Saved') => {
    try {
      await api.study.updateProfile(patch);
      invalidate('study');
      toast(msg, 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <div className="page stack-4" style={{ maxWidth: 820 }}>
      <h1>Learning settings</h1>
      <p className="small muted">These belong to {p.displayName}’s profile. App-wide options (quiz length, review reminders, the AI switch) are in Settings → Student Learning.</p>

      <section className="card stack-3" aria-label="About you">
        <h2 className="h2">About you</h2>
        <div className="field-row">
          <Field label="Name or nickname" htmlFor="ls-name">
            <Input id="ls-name" defaultValue={p.displayName} maxLength={40} onBlur={(e) => e.target.value.trim() && e.target.value !== p.displayName && void save({ displayName: e.target.value.trim() })} />
          </Field>
          <Field label="Grade" htmlFor="ls-grade">
            <Select id="ls-grade" value={String(p.grade)} onChange={(e) => void save({ grade: Number(e.target.value) as StudentProfile['grade'] })}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Explanations I like" htmlFor="ls-style">
            <Select id="ls-style" value={p.explanationStyle} onChange={(e) => void save({ explanationStyle: e.target.value as ExplanationStyle })}>
              {EXPLANATION_STYLES.map((s) => (
                <option key={s} value={s}>
                  {EXPLANATION_STYLE_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="My courses">
          <div className="chip-list" role="group" aria-label="Courses">
            {(courses.data ?? []).map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={p.courseIds.includes(c.id)} onClick={() => void save({ courseIds: p.courseIds.includes(c.id) ? p.courseIds.filter((x) => x !== c.id) : [...p.courseIds, c.id] })}>
                {c.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Goals">
          <div className="chip-list" role="group" aria-label="Goals">
            {GOAL_KINDS.map((g) => (
              <button key={g} type="button" className="chip" aria-pressed={p.goalKinds.includes(g)} onClick={() => void save({ goalKinds: p.goalKinds.includes(g) ? p.goalKinds.filter((x) => x !== g) : [...p.goalKinds, g] })}>
                {GOAL_LABEL[g]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="My goal in my own words" htmlFor="ls-goal">
          <Input id="ls-goal" defaultValue={p.goals[0] ?? ''} maxLength={200} onBlur={(e) => e.target.value !== (p.goals[0] ?? '') && void save({ goals: e.target.value.trim() ? [e.target.value.trim()] : [] })} />
        </Field>
      </section>

      <section className="card stack-3" aria-label="Study time">
        <h2 className="h2">Study time</h2>
        <Field label="Days">
          <div className="chip-list" role="group" aria-label="Study days">
            {WEEKDAYS.map(({ d, label }) => (
              <button key={d} type="button" className="chip" aria-pressed={p.studyDays.includes(d)} onClick={() => void save({ studyDays: p.studyDays.includes(d) ? p.studyDays.filter((x) => x !== d) : [...p.studyDays, d] })}>
                {label}
              </button>
            ))}
          </div>
        </Field>
        <div className="field-row">
          <Field label="Minutes per day" htmlFor="ls-min">
            <Input id="ls-min" type="number" min={5} max={240} defaultValue={p.dailyMinutes} onBlur={(e) => void save({ dailyMinutes: Math.max(5, Math.min(240, Number(e.target.value) || 30)) })} style={{ width: 100 }} />
          </Field>
          <Field label="Session length" htmlFor="ls-sess">
            <Select id="ls-sess" value={String(p.sessionMinutes)} onChange={(e) => void save({ sessionMinutes: Number(e.target.value) as 5 | 10 | 20 | 30 })}>
              {[5, 10, 20, 30].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Usual start time" htmlFor="ls-time">
            <input id="ls-time" className="input" type="time" defaultValue={p.studyTime} onBlur={(e) => e.target.value && void save({ studyTime: e.target.value })} />
          </Field>
        </div>
        <Toggle label="Schedule approved-style plans automatically" description="Off: every plan waits for you to approve it before anything is added to the calendar. On: plans you make are added straight away." checked={p.autoSchedule} onChange={(v) => void save({ autoSchedule: v })} />
      </section>

      <section className="card stack-3" aria-label="Accessibility">
        <h2 className="h2">Reading and pacing</h2>
        <Field label="Text size in Student Learning" htmlFor="ls-scale">
          <Select id="ls-scale" value={String(p.accessibility.textScale)} onChange={(e) => void save({ accessibility: { ...p.accessibility, textScale: Number(e.target.value) } })}>
            {[1, 1.15, 1.3, 1.45, 1.6].map((x) => (
              <option key={x} value={x}>
                {Math.round(x * 100)}%
              </option>
            ))}
          </Select>
        </Field>
        <Toggle label="Easier-to-read font" checked={p.accessibility.readableFont} onChange={(v) => void save({ accessibility: { ...p.accessibility, readableFont: v } })} />
        <Toggle label="Plainer language" description="Lessons and the tutor use simpler words and shorter sentences." checked={p.accessibility.simplifiedLanguage} onChange={(v) => void save({ accessibility: { ...p.accessibility, simplifiedLanguage: v } })} />
        <Toggle label="Extra time on timed practice tests" description="Timed practice tests get 50% more time." checked={p.accessibility.extraTime} onChange={(v) => void save({ accessibility: { ...p.accessibility, extraTime: v } })} />
      </section>

      <section className="card stack-3" aria-label="AI and privacy">
        <h2 className="h2">AI tutoring and privacy</h2>
        <Toggle
          label="Use the AI tutor and AI-written lessons"
          description={p.aiTutoring ? 'On. Your messages and the expectations you study are sent to the AI provider connected in Settings.' : 'Off. Everything else in Student Learning works without it.'}
          checked={p.aiTutoring}
          onChange={(v) => (v ? setAiDialog(true) : void save({ aiTutoring: false, shareProgressWithAi: false }, 'AI tutoring turned off'))}
        />
        {p.aiTutoring && ai.data && !ai.data.available ? <Banner tone="warn">{ai.data.reason}</Banner> : null}
        <Toggle
          label="Include a short summary of my verified progress in AI requests"
          description="Helps the tutor pitch explanations at the right level: status, counts of right/wrong answers and recurring mistakes for the expectation you’re working on. Never your name or past conversations."
          checked={p.shareProgressWithAi}
          disabled={!p.aiTutoring}
          onChange={(v) => void save({ shareProgressWithAi: v })}
        />
        <h3>Sharing with a parent</h3>
        <p className="small muted">A parent can see a report only if Parental Learning Controls are set up, they enter its PIN, and you turn sharing on here. Tutoring conversations, answers, written work and reflections are never shared.</p>
        <Toggle label="Share a report with a parent" checked={p.parentSharing.enabled} onChange={(v) => void save({ parentSharing: { ...p.parentSharing, enabled: v } })} />
        {p.parentSharing.enabled ? (
          <div className="stack-2" style={{ paddingLeft: 16 }}>
            <Toggle label="My goals" checked={p.parentSharing.goals} onChange={(v) => void save({ parentSharing: { ...p.parentSharing, goals: v } })} />
            <Toggle label="Lessons and quizzes I finished, and time studied" checked={p.parentSharing.activities} onChange={(v) => void save({ parentSharing: { ...p.parentSharing, activities: v } })} />
            <Toggle label="Progress by course" checked={p.parentSharing.progress} onChange={(v) => void save({ parentSharing: { ...p.parentSharing, progress: v } })} />
          </div>
        ) : null}
      </section>

      <section className="card stack-3" aria-label="Profile PIN">
        <h2 className="h2">Profile PIN</h2>
        <p className="small muted">{p.hasPin ? 'This profile needs a PIN to open.' : 'Anyone using this computer can open this profile.'}</p>
        <div className="row-wrap">
          <Button
            onClick={async () => {
              const cur = p.hasPin ? await prompt({ title: 'Current PIN', label: 'Enter your current PIN', secret: true }) : null;
              if (p.hasPin && !cur) return;
              const next = await prompt({ title: p.hasPin ? 'New PIN' : 'Set a PIN', label: 'New PIN (4 or more characters)', secret: true });
              if (!next) return;
              try {
                await api.study.setPin(cur, next);
                invalidate('study');
                toast('PIN saved', 'success');
              } catch (e) {
                toast(errorMessage(e), 'error');
              }
            }}
          >
            {p.hasPin ? 'Change PIN' : 'Set a PIN'}
          </Button>
          {p.hasPin ? (
            <Button
              variant="ghost"
              onClick={async () => {
                const cur = await prompt({ title: 'Remove PIN', label: 'Enter your current PIN', secret: true });
                if (!cur) return;
                try {
                  await api.study.setPin(cur, null);
                  invalidate('study');
                  toast('PIN removed', 'success');
                } catch (e) {
                  toast(errorMessage(e), 'error');
                }
              }}
            >
              Remove PIN
            </Button>
          ) : null}
        </div>
      </section>

      <section className="card stack-3" aria-label="Your data">
        <h2 className="h2">Your learning data</h2>
        <p className="small muted">Everything is stored only on this computer. You can take a copy or delete it at any time.</p>
        <div className="row-wrap">
          <Button icon={<Download size={14} />} onClick={() => void api.study.exportMyData().then((r) => r.saved && toast('Exported', 'success')).catch((e: unknown) => toast(errorMessage(e), 'error'))}>
            Export my learning data
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 size={14} />}
            onClick={async () => {
              const typed = await prompt({ title: 'Delete learning records?', label: 'This deletes your lessons, quizzes, answers, progress, plans, assignments and tutor conversations, but keeps your profile. Type DELETE to confirm.', confirmLabel: 'Delete' });
              if (!typed) return;
              try {
                const n = await api.study.deleteMyLearningData(typed);
                invalidate('study');
                toast(`Deleted ${n} records`, 'success');
              } catch (e) {
                toast(errorMessage(e), 'error');
              }
            }}
          >
            Delete my learning records
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!(await confirm({ title: 'Delete this profile?', message: 'The profile and everything in it is deleted from this computer. Calendar events and tasks you approved stay in the calendar.', confirmLabel: 'Continue', danger: true }))) return;
              const typed = await prompt({ title: 'Confirm', label: `Type the profile name (${p.displayName}) to delete it` });
              if (!typed) return;
              try {
                await api.study.deleteProfile(typed);
                invalidate('study');
                navigate('/study');
              } catch (e) {
                toast(errorMessage(e), 'error');
              }
            }}
          >
            Delete profile
          </Button>
        </div>
      </section>

      {aiDialog ? (
        <Modal
          title="Turn on AI tutoring?"
          onClose={() => setAiDialog(false)}
          footer={
            <>
              <Button onClick={() => setAiDialog(false)}>Not now</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setAiDialog(false);
                  void save({ aiTutoring: true }, 'AI tutoring turned on');
                }}
              >
                Turn on
              </Button>
            </>
          }
        >
          <div className="stack-3 small">
            <p>The AI tutor and AI-written lessons use the AI provider connected in Settings → AI providers. When you use them, FlowCompanion sends:</p>
            <ul>
              <li>what you type, and answers you ask it to give feedback on;</li>
              <li>the official expectation you’re studying and the Ministry’s notes for it (public text);</li>
              <li>your grade, your explanation preference and whether you asked for plain language;</li>
              <li>only if you turn it on separately: a short summary of your verified progress.</li>
            </ul>
            <p>Your name, PIN, other profiles and past conversations with other people are never sent. The provider’s own privacy terms apply to what it receives.</p>
            <p>AI can be wrong. Lessons and answers it writes are labelled, are not reviewed by a teacher, and count for less in your progress. If you are under the age your provider allows, ask a parent first.</p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
