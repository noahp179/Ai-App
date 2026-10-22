import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';
import { useSettings } from '../../lib/settings';
import { NumberSetting, Section, ToggleSetting } from '../settings/controls';

export function NewsSettings() {
  const { settings, update } = useSettings();
  const cats = useQuery('news:categories', () => api.news.categories());
  const f = settings.feed;
  return (
    <Section title="News" description="Feeds are downloaded directly from each publisher. FlowCompanion stores headlines and short previews only.">
      <div>
        <div className="field-label" style={{ marginBottom: 6 }}>
          Topics you follow
        </div>
        <div className="row-wrap">
          {cats.data
            ?.filter((c) => c.id !== 'custom')
            .map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={f.topics.includes(c.id)} onClick={() => void update({ feed: { topics: f.topics.includes(c.id) ? f.topics.filter((t) => t !== c.id) : [...f.topics, c.id] } })}>
                {c.label}
              </button>
            ))}
        </div>
      </div>
      <NumberSetting label="Refresh automatically every" hint="0 refreshes only when you ask. Refreshing happens only while FlowCompanion is running." value={f.refreshIntervalMinutes} min={0} max={1440} suffix="minutes" onSave={(v) => update({ feed: { refreshIntervalMinutes: v } })} />
      <NumberSetting label="Preview length" hint="Applies to newly downloaded items." value={f.previewLength} min={80} max={400} suffix="characters" onSave={(v) => update({ feed: { previewLength: v } })} />
      <ToggleSetting label="Keyword alerts" description="Notify about new headlines matching your alert keywords (News → Alerts)." value={f.alertsEnabled} onSave={(v) => update({ feed: { alertsEnabled: v } })} />
      <ToggleSetting label="Show only unread by default" value={f.hideRead} onSave={(v) => update({ feed: { hideRead: v } })} />
    </Section>
  );
}
