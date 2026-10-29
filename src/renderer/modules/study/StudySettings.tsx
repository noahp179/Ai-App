import { useState } from 'react';
import { MASTERY_LABEL, MASTERY_STATUSES, type ProgressReport } from '../../../shared/study/types';
import { Button, Modal, usePrompt, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { navigate } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { NumberSetting, Section, SelectSetting, TextSetting, ToggleSetting } from '../settings/controls';

const REPORT_KIND: Record<string, string> = { inaccurate: 'Inaccurate', inappropriate: 'Inappropriate', unclear: 'Unclear', curriculum_mismatch: 'Doesn’t match the curriculum', other: 'Other' };

/** Settings → Student Learning: app-wide options, parent tools and content reports. Per-student options live in Student Learning → Settings. */
export function StudySettings() {
  const { settings, update } = useSettings();
  const s = settings.study;
  return (
    <>
      <Section title="Practice and progress" description="Apply to every student profile on this computer. Each student’s own preferences are in Student Learning → Settings.">
        <SelectSetting
          label="Questions in a quiz"
          value={s.quizLength}
          options={[3, 5, 10, 15].map((n) => ({ value: n, label: `${n} questions` }))}
          onSave={(v) => update({ study: { quizLength: v as 3 | 5 | 10 | 15 } })}
        />
        <ToggleSetting label="Time practice tests" description="Off by default. Pop quizzes and practice are never timed." value={s.timedPracticeTests} onSave={(v) => update({ study: { timedPracticeTests: v } })} />
        <ToggleSetting label="Show the percentage next to progress statuses" value={s.showEstimates} onSave={(v) => update({ study: { showEstimates: v } })} />
        <NumberSetting
          label="Proficient needs about"
          hint="Weighted share of recent answers that are right. 60–95%."
          value={Math.round(s.proficientThreshold * 100)}
          min={60}
          max={95}
          suffix="% right"
          onSave={(v) => update({ study: { proficientThreshold: v / 100 } })}
        />
        <NumberSetting label="…and at least" hint="Answers right without hints before an expectation can be proficient. 2–6." value={s.minIndependentCorrect} min={2} max={6} suffix="answers without hints" onSave={(v) => update({ study: { minIndependentCorrect: v } })} />
      </Section>
      <Section title="Review reminders">
        <ToggleSetting label="Remind me when reviews are due" description="One notification a day, without the student’s name, while FlowCompanion is running." value={s.reviewReminders} onSave={(v) => update({ study: { reviewReminders: v } })} />
        <TextSetting label="Reminder time (HH:MM)" value={s.reviewReminderTime} onSave={(v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? update({ study: { reviewReminderTime: v } }) : Promise.reject(new Error('Use a 24-hour time like 16:30.')))} />
      </Section>
      <Section title="AI in Student Learning" description="Lessons from the app’s own content, checked practice, review and planning work with AI off.">
        <ToggleSetting
          label="Allow the AI tutor and AI-written lessons"
          description="When on, each student still decides for themselves in their own settings, after seeing what is sent to the AI provider."
          value={s.aiTutor}
          onSave={(v) => update({ study: { aiTutor: v } })}
        />
      </Section>
      <ParentTools />
      <ContentReports />
      <Section title="Curriculum">
        <p className="small">Ontario curriculum expectations come from the Ministry of Education’s Curriculum and Resources site. See what is included, check for updates and export a coverage report on the coverage page.</p>
        <div>
          <Button onClick={() => navigate('/study/coverage')}>Open curriculum coverage</Button>
        </div>
      </Section>
    </>
  );
}

function ParentTools() {
  const toast = useToast();
  const prompt = usePrompt();
  const profiles = useQuery('study:profiles', () => api.study.profiles());
  const [report, setReport] = useState<{ id: string; pin: string; data: ProgressReport } | null>(null);
  const askPin = () => prompt({ title: 'Parent PIN', label: 'Enter the Parental Learning Controls PIN', secret: true });
  return (
    <Section
      title="Parent tools"
      description="Need Parental Learning Controls to be turned on (Settings → Parental Learning Controls). A report is available only if the student has chosen to share one, and it never includes tutoring conversations, answers, written work or reflections."
    >
      {!profiles.data?.length ? (
        <p className="small muted">No student profiles yet.</p>
      ) : (
        <ul className="list">
          {profiles.data.map((p) => (
            <li key={p.id} className="row-wrap" style={{ padding: '6px 0' }}>
              <span className="grow">
                {p.displayName} · Grade {p.grade}
                {p.hasPin ? ' · PIN set' : ''}
              </span>
              <Button
                size="sm"
                onClick={async () => {
                  const pin = await askPin();
                  if (!pin) return;
                  try {
                    setReport({ id: p.id, pin, data: await api.study.parentReport(p.id, pin) });
                  } catch (e) {
                    toast(errorMessage(e), 'error');
                  }
                }}
              >
                View shared report
              </Button>
              {p.hasPin ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const pin = await askPin();
                    if (!pin) return;
                    try {
                      await api.study.parentResetPin(p.id, pin);
                      invalidate('study');
                      toast(`${p.displayName}’s profile PIN was removed. They can set a new one in Student Learning → Settings.`, 'success');
                    } catch (e) {
                      toast(errorMessage(e), 'error');
                    }
                  }}
                >
                  Remove profile PIN
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {report ? (
        <Modal
          wide
          title={`Shared report — ${report.data.student.displayName}`}
          onClose={() => setReport(null)}
          footer={
            <>
              <Button
                onClick={() =>
                  void api.study
                    .exportParentReport(report.id, report.pin)
                    .then((r) => r.saved && toast('Report saved', 'success'))
                    .catch((e: unknown) => toast(errorMessage(e), 'error'))
                }
              >
                Save as a file
              </Button>
              <Button variant="primary" onClick={() => setReport(null)}>
                Close
              </Button>
            </>
          }
        >
          <ReportView r={report.data} />
        </Modal>
      ) : null}
    </Section>
  );
}

export function ReportView({ r }: { r: ProgressReport }) {
  return (
    <div className="stack-3 small">
      <p className="tiny faint">{r.privacyNote}</p>
      {r.goals ? <p>Goals: {r.goals.length ? r.goals.join('; ') : 'none set'}</p> : null}
      {r.activities ? (
        <p>
          {r.activities.lessonsCompleted} lessons and {r.activities.quizzesCompleted} quizzes finished; {r.activities.questionsAnswered} questions answered; about {r.activities.minutesStudied} minutes recorded.
        </p>
      ) : null}
      {r.progress?.map((c) => (
        <div key={c.courseId} className="stack-1">
          <strong>{c.course}</strong>
          <span>{MASTERY_STATUSES.filter((st) => c.byStatus[st]).map((st) => `${MASTERY_LABEL[st]}: ${c.byStatus[st]}`).join(' · ') || 'Nothing practised yet.'}</span>
          {c.strengths.length ? <span className="muted">Strengths: {c.strengths.join(', ')}</span> : null}
          {c.needsPractice.length ? <span className="muted">Needs practice: {c.needsPractice.join(', ')}</span> : null}
        </div>
      ))}
      {!r.goals && !r.activities && !r.progress ? <p className="muted">The student is sharing a report but hasn’t chosen anything to include.</p> : null}
      <p className="tiny faint">{r.disclaimer}</p>
    </div>
  );
}

function ContentReports() {
  const toast = useToast();
  const reports = useQuery('study:reports', () => api.study.contentReports());
  const open = (reports.data ?? []).filter((r) => r.status === 'open');
  return (
    <Section title="Content reports" description="Problems students flagged in lessons, questions or the tutor. They stay on this computer; nothing is sent anywhere.">
      {!reports.data?.length ? (
        <p className="small muted">No reports.</p>
      ) : (
        <ul className="list small">
          {reports.data.map((r) => (
            <li key={r.id} className="row-wrap" style={{ padding: '6px 0', opacity: r.status === 'resolved' ? 0.6 : 1 }}>
              <span className="grow">
                <strong>{REPORT_KIND[r.kind] ?? r.kind}</strong> · {r.target}
                {r.detail ? <span className="muted"> — {r.detail}</span> : null}
                <span className="tiny faint"> · {r.createdAt.slice(0, 10)}</span>
              </span>
              {r.status === 'open' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void api.study
                      .resolveContentReport(r.id)
                      .then(() => reports.reload())
                      .catch((e: unknown) => toast(errorMessage(e), 'error'))
                  }
                >
                  Mark resolved
                </Button>
              ) : (
                <span className="tiny faint">Resolved</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {open.length ? <p className="tiny faint">{open.length} open.</p> : null}
    </Section>
  );
}
