import { Section, NumberSetting, SelectSetting } from '../settings/controls';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';
import { navigate } from '../../lib/router';
import { useSettings } from '../../lib/settings';

export function LearningSettings() {
  const { settings, update } = useSettings();
  const paths = useQuery('learning:paths', () => api.learning.paths());
  const goals = settings.learning.goals;
  return (
    <div className="stack-5">
      <Section title="Learning goals" description="Choose what you want to learn. Suggestions in the Learning Hub follow these goals when personalization is on (Settings → Privacy).">
        <div className="row-wrap" style={{ gap: 6 }} role="group" aria-label="Learning goals">
          {paths.data?.map((p) => {
            const on = goals.includes(p.id);
            return (
              <button key={p.id} type="button" className="chip" aria-pressed={on} onClick={() => void update({ learning: { goals: on ? goals.filter((g) => g !== p.id) : [...goals, p.id] } })}>
                {p.title}
              </button>
            );
          })}
        </div>
        {!settings.privacy.personalization ? (
          <p className="small muted">
            Personalization is off, so goals are saved but not used.{' '}
            <button type="button" className="link-button" onClick={() => navigate('/settings/privacy')}>
              Privacy settings
            </button>
          </p>
        ) : null}
        <SelectSetting
          label="Preferred level"
          hint="Suggestions skip resources above this level."
          value={settings.learning.preferredLevel}
          options={[
            { value: 'any', label: 'Any level' },
            { value: 'beginner', label: 'Beginner' },
            { value: 'intermediate', label: 'Up to intermediate' },
            { value: 'advanced', label: 'Up to advanced' },
          ]}
          onSave={(v) => update({ learning: { preferredLevel: v } })}
        />
      </Section>
      <Section title="Study sessions" description="Study time you schedule from the Learning Hub or the study planner goes into your local calendar.">
        <NumberSetting label="Remind me before each session" hint="0 reminds you when the session starts." value={settings.learning.studyReminderMinutes} min={0} max={1440} suffix="minutes" onSave={(v) => update({ learning: { studyReminderMinutes: v } })} />
      </Section>
    </div>
  );
}
