import { CheckCircle2, Database, FolderOpen, HardDriveDownload, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import { useState } from 'react';
import { APP_MODES, MODE_PRESETS, MODULE_IDS, type ModuleId } from '../../../shared/settings';
import { Badge, Banner, Button, Field, Input, Loading, useConfirm, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { useSettings } from '../../lib/settings';
import { ProviderManager } from '../ai/ProviderSetup';
import { MODULES } from '../registry';
import { NumberSetting, Section, SelectSetting, TextSetting, ToggleSetting } from './controls';

function useCaps() {
  return useQuery('app:caps', () => api.app.capabilities());
}

export function GeneralSection() {
  const { settings, update } = useSettings();
  const toast = useToast();
  const caps = useCaps();
  const trayOk = caps.data?.tray.supported ?? false;
  return (
    <>
      <Section title="Mode" description="A mode sets which modules are shown. You can still change individual modules afterwards.">
        <div className="grid grid-3">
          {APP_MODES.map((m) => (
            <button
              key={m}
              type="button"
              className="card interactive"
              aria-pressed={settings.layout.mode === m}
              style={{ textAlign: 'left', borderColor: settings.layout.mode === m ? 'var(--accent)' : undefined }}
              onClick={() =>
                void api.settings
                  .applyMode(m)
                  .then(() => toast(`Switched to ${MODE_PRESETS[m].label}`, 'success'))
                  .catch((e: unknown) => toast(errorMessage(e), 'error'))
              }
            >
              <div style={{ fontWeight: 600 }}>{MODE_PRESETS[m].label}</div>
              <div className="small muted">{MODE_PRESETS[m].description}</div>
            </button>
          ))}
        </div>
        <p className="small faint">Choosing “Student” or “Parent-managed” does not verify anyone’s age or authority. Supervised features are set up separately under Parental Learning Controls.</p>
      </Section>
      <Section title="Startup">
        <SelectSetting
          label="Open to"
          value={settings.layout.openTo}
          options={[
            { value: 'home', label: 'Home' },
            { value: 'last', label: 'Where I left off' },
            { value: 'ai', label: 'AI Workspace' },
            { value: 'notes', label: 'Notes' },
            { value: 'calendar', label: 'Calendar' },
          ]}
          onSave={(v) => update({ layout: { openTo: v } })}
        />
        <ToggleSetting label="Launch at login" description={caps.data?.launchAtLogin.detail} value={settings.startup.launchAtLogin} onSave={(v) => update({ startup: { launchAtLogin: v } })} />
        <ToggleSetting
          label="Start hidden in the tray"
          description={trayOk ? 'FlowCompanion starts without opening a window. Open it from the tray icon.' : 'Unavailable: no tray icon area was found on this system.'}
          value={settings.startup.startHidden}
          disabled={!trayOk}
          onSave={(v) => update({ startup: { startHidden: v } })}
        />
        <ToggleSetting
          label="Closing the window keeps FlowCompanion running"
          description={trayOk ? 'Reminders keep firing. Quit from the tray menu.' : 'Unavailable: no tray icon area was found on this system.'}
          value={settings.startup.closeToTray}
          disabled={!trayOk}
          onSave={(v) => update({ startup: { closeToTray: v } })}
        />
      </Section>
    </>
  );
}

export function AppearanceSection() {
  const { settings, update } = useSettings();
  const a = settings.appearance;
  return (
    <Section title="Appearance">
      <div className="field-row">
        <SelectSetting
          label="Theme"
          value={a.theme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'Match system' },
          ]}
          onSave={(v) => update({ appearance: { theme: v } })}
        />
        <SelectSetting
          label="Accent colour"
          value={a.accent}
          options={[
            { value: 'indigo', label: 'Indigo' },
            { value: 'teal', label: 'Teal' },
            { value: 'violet', label: 'Violet' },
            { value: 'amber', label: 'Amber' },
            { value: 'rose', label: 'Rose' },
          ]}
          onSave={(v) => update({ appearance: { accent: v } })}
        />
        <SelectSetting
          label="Density"
          value={a.density}
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
          ]}
          onSave={(v) => update({ appearance: { density: v } })}
        />
      </div>
      <Field label={`Text size: ${Math.round(a.fontScale * 100)}%`} htmlFor="fs">
        <input id="fs" type="range" min={0.85} max={1.4} step={0.05} value={a.fontScale} onChange={(e) => void update({ appearance: { fontScale: Number(e.target.value) } })} style={{ maxWidth: 360 }} />
      </Field>
      <SelectSetting
        label="Motion"
        value={a.reducedMotion}
        options={[
          { value: 'system', label: 'Follow system setting' },
          { value: 'reduce', label: 'Reduce motion' },
          { value: 'allow', label: 'Allow animations' },
        ]}
        onSave={(v) => update({ appearance: { reducedMotion: v } })}
      />
      <ToggleSetting label="High contrast" description="Stronger borders and text." value={a.highContrast} onSave={(v) => update({ appearance: { highContrast: v } })} />
      <ToggleSetting label="Collapse sidebar" description="Icons only. Toggle with Ctrl+\\." value={settings.layout.sidebarCollapsed} onSave={(v) => update({ layout: { sidebarCollapsed: v } })} />
      <ToggleSetting label="Distraction-free mode" description="Hides the sidebar and top bar. Press Esc or Ctrl+Shift+D to leave." value={settings.layout.distractionFree} onSave={(v) => update({ layout: { distractionFree: v } })} />
    </Section>
  );
}

export function ModulesSection() {
  const { settings, update } = useSettings();
  return (
    <Section title="Modules" description="Turn off what you don’t use. Turned-off modules disappear from navigation and search; their data stays.">
      {MODULE_IDS.filter((m) => m !== 'home' && m !== 'settings').map((id) => {
        const def = MODULES.find((m) => m.id === id)!;
        return (
          <ToggleSetting key={id} label={def.label} description={def.description} value={settings.layout.modules[id as ModuleId]} onSave={(v) => update({ layout: { modules: { [id]: v } } })} />
        );
      })}
    </Section>
  );
}

export function CompanionSection() {
  const { settings, update } = useSettings();
  const caps = useCaps();
  const c = settings.companion;
  return (
    <Section title="Floating companion" description="A small always-available panel with quick capture, a quick AI prompt, today’s agenda and the focus timer. It never takes keyboard focus unless you open it.">
      <ToggleSetting label="Enable the companion" value={c.enabled} onSave={(v) => update({ companion: { enabled: v } })} />
      <ToggleSetting label="Show when FlowCompanion starts" value={c.showOnStartup} disabled={!c.enabled} onSave={(v) => update({ companion: { showOnStartup: v } })} />
      <ToggleSetting label="Keep on top of other windows" value={c.alwaysOnTop} disabled={!c.enabled} onSave={(v) => update({ companion: { alwaysOnTop: v } })} />
      <SelectSetting
        label="Position"
        value={c.dock}
        options={[
          { value: 'floating', label: 'Floating (move it anywhere)' },
          { value: 'left', label: 'Docked to the left edge' },
          { value: 'right', label: 'Docked to the right edge' },
        ]}
        onSave={(v) => update({ companion: { dock: v } })}
      />
      <Field label={`Opacity: ${Math.round(c.opacity * 100)}%`} hint={caps.data?.windowOpacity.supported ? undefined : caps.data?.windowOpacity.detail} htmlFor="op">
        <input id="op" type="range" min={0.4} max={1} step={0.05} value={c.opacity} disabled={!caps.data?.windowOpacity.supported} onChange={(e) => void update({ companion: { opacity: Number(e.target.value) } })} style={{ maxWidth: 360 }} />
      </Field>
      <div>
        <Button onClick={() => void api.window.toggleCompanion()} disabled={!c.enabled}>
          Show or hide the companion now
        </Button>
      </div>
    </Section>
  );
}

export function ShortcutsSection() {
  const { settings, update } = useSettings();
  const status = useQuery(`shortcuts:${JSON.stringify(settings.shortcuts)}`, () => api.settings.shortcutStatus());
  const caps = useCaps();
  const names = { toggleCompanion: 'Show or hide companion', quickCapture: 'Quick capture', showMainWindow: 'Show FlowCompanion' } as const;
  return (
    <>
      <Section title="Global shortcuts" description={caps.data?.globalShortcuts.detail}>
        <ToggleSetting label="Enable global shortcuts" description="These work while FlowCompanion runs in the background." value={settings.shortcuts.enabled} onSave={(v) => update({ shortcuts: { enabled: v } })} />
        {(Object.keys(names) as (keyof typeof names)[]).map((k) => {
          const st = status.data?.find((s) => s.name === k);
          return (
            <div key={k} className="row" style={{ alignItems: 'flex-end' }}>
              <div className="grow">
                <TextSetting label={names[k]} hint="Format: CommandOrControl+Shift+K. Leave empty to disable." value={settings.shortcuts[k]} onSave={(v) => update({ shortcuts: { [k]: v } })} />
              </div>
              {st ? (
                st.registered ? (
                  <Badge tone="ok">
                    <CheckCircle2 size={12} /> Active
                  </Badge>
                ) : (
                  <Badge tone="warn" title={st.error ?? ''}>
                    <XCircle size={12} /> {st.error}
                  </Badge>
                )
              ) : null}
            </div>
          );
        })}
      </Section>
      <Section title="In-app shortcuts">
        <dl className="kv">
          <dt>
            <kbd>Ctrl</kbd> <kbd>K</kbd>
          </dt>
          <dd>Search and commands</dd>
          <dt>
            <kbd>Ctrl</kbd> <kbd>1</kbd>–<kbd>9</kbd>
          </dt>
          <dd>Jump to a module</dd>
          <dt>
            <kbd>Ctrl</kbd> <kbd>N</kbd>
          </dt>
          <dd>New note</dd>
          <dt>
            <kbd>Ctrl</kbd> <kbd>S</kbd>
          </dt>
          <dd>Save the current note now</dd>
          <dt>
            <kbd>Ctrl</kbd> <kbd>\</kbd>
          </dt>
          <dd>Collapse the sidebar</dd>
          <dt>
            <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>D</kbd>
          </dt>
          <dd>Distraction-free mode</dd>
          <dt>
            <kbd>Ctrl</kbd> <kbd>,</kbd>
          </dt>
          <dd>Settings</dd>
        </dl>
        <p className="small faint">On macOS use ⌘ instead of Ctrl.</p>
      </Section>
    </>
  );
}

export function AiSection() {
  const { settings, update } = useSettings();
  const confirm = useConfirm();
  const toast = useToast();
  const a = settings.ai;
  return (
    <>
      <Section title="AI providers" description="Connect the services or local runtimes the AI workspace may use. Keys are stored with your OS secure storage when available.">
        <ProviderManager />
      </Section>
      <Section title="Behaviour">
        <TextSetting label="Instructions for every conversation" hint="Sent as system instructions with each request, before a conversation’s own instructions." value={a.systemPrompt} multiline placeholder="e.g. Answer concisely. Use British spelling." onSave={(v) => update({ ai: { systemPrompt: v } })} />
        <ToggleSetting label="Stream responses" description="Show answers as they are written. When off, the full answer appears at once." value={a.streaming} onSave={(v) => update({ ai: { streaming: v } })} />
        <ToggleSetting label="Notify when a response is ready" description="Only when no FlowCompanion window is focused." value={a.notifyOnCompletion} onSave={(v) => update({ ai: { notifyOnCompletion: v } })} />
        <div className="field-row">
          <NumberSetting label="Request timeout" hint="Give up when the provider sends nothing for this long." value={a.requestTimeoutSeconds} min={15} max={600} suffix="seconds" onSave={(v) => update({ ai: { requestTimeoutSeconds: v } })} />
          <NumberSetting label="Max output tokens" hint="0 uses the provider’s default (64,000 when streaming from Claude)." value={a.maxOutputTokens} min={0} max={128000} step={256} onSave={(v) => update({ ai: { maxOutputTokens: v } })} />
          <Field label="Temperature" hint="Leave empty for the provider default. Not sent to Claude, whose API no longer accepts it." htmlFor="temp">
            <Input
              id="temp"
              type="number"
              min={0}
              max={2}
              step={0.1}
              defaultValue={a.temperature ?? ''}
              style={{ width: 120 }}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                void update({ ai: { temperature: raw === '' ? null : Number(raw) } }).catch((err: unknown) => toast(errorMessage(err), 'error'));
              }}
            />
          </Field>
        </div>
      </Section>
      <Section title="Conversation storage and retention">
        <ToggleSetting label="Save conversations" description="When off, new conversations are temporary and deleted the next time FlowCompanion starts." value={a.storeConversations} onSave={(v) => update({ ai: { storeConversations: v } })} />
        <NumberSetting label="Delete conversations after" hint="0 keeps them until you delete them. Applied at startup." value={a.retentionDays} min={0} max={3650} suffix="days without activity" onSave={(v) => update({ ai: { retentionDays: v } })} />
        <div>
          <Button
            variant="danger"
            onClick={async () => {
              if (await confirm({ title: 'Delete all AI conversations?', message: 'Every conversation and message stored on this computer is removed. Providers stay connected.', confirmLabel: 'Delete all', danger: true })) {
                const n = await api.ai.deleteAllConversations();
                invalidate('conversations');
                toast(`Deleted ${n} conversation${n === 1 ? '' : 's'}`, 'success');
              }
            }}
          >
            Delete all conversations
          </Button>
        </div>
      </Section>
    </>
  );
}

export function NotificationsSection() {
  const { settings, update } = useSettings();
  const caps = useCaps();
  const n = settings.notifications;
  return (
    <Section title="Notifications" description={caps.data?.notifications.detail}>
      <ToggleSetting label="Show system notifications" description="When off, reminders still appear in the in-app notification list." value={n.enabled} onSave={(v) => update({ notifications: { enabled: v } })} />
      <ToggleSetting label="Play a sound" value={n.sound} onSave={(v) => update({ notifications: { sound: v } })} />
      <ToggleSetting label="Quiet hours" description="Hold banners during these hours. Items still go to the notification list." value={n.quietHours.enabled} onSave={(v) => update({ notifications: { quietHours: { enabled: v } } })} />
      <div className="field-row">
        <Field label="Quiet from" htmlFor="qs">
          <input id="qs" type="time" className="input" value={n.quietHours.start} disabled={!n.quietHours.enabled} onChange={(e) => void update({ notifications: { quietHours: { start: e.target.value } } })} />
        </Field>
        <Field label="Quiet until" htmlFor="qe">
          <input id="qe" type="time" className="input" value={n.quietHours.end} disabled={!n.quietHours.enabled} onChange={(e) => void update({ notifications: { quietHours: { end: e.target.value } } })} />
        </Field>
      </div>
      <div className="field-row">
        <NumberSetting label="Default event reminder" value={n.defaultReminderMinutes} min={0} max={10080} suffix="minutes before" onSave={(v) => update({ notifications: { defaultReminderMinutes: v } })} />
        <NumberSetting label="Snooze for" value={n.snoozeMinutes} min={1} max={1440} suffix="minutes" onSave={(v) => update({ notifications: { snoozeMinutes: v } })} />
        <NumberSetting label="Show missed reminders from the last" hint="Reminders that came due while FlowCompanion was closed." value={n.missedGraceMinutes} min={0} max={10080} suffix="minutes" onSave={(v) => update({ notifications: { missedGraceMinutes: v } })} />
      </div>
    </Section>
  );
}

export function CalendarSection() {
  const { settings, update } = useSettings();
  const zones = useQuery('settings:zones', () => api.settings.timeZones());
  const info = useQuery('app:info', () => api.app.info());
  const c = settings.calendar;
  return (
    <>
      <Section title="Calendar">
        <SelectSetting
          label="Time zone"
          hint={`System time zone: ${info.data?.systemTimeZone ?? '…'}. Events keep their own time zone; this sets how they are displayed.`}
          value={c.timeZone}
          options={[{ value: 'system', label: `Use system time zone` }, ...(zones.data ?? []).map((z) => ({ value: z, label: z }))]}
          onSave={(v) => update({ calendar: { timeZone: v } })}
        />
        <div className="field-row">
          <SelectSetting
            label="Week starts on"
            value={c.weekStartsOn}
            options={[
              { value: 1, label: 'Monday' },
              { value: 0, label: 'Sunday' },
              { value: 6, label: 'Saturday' },
            ]}
            onSave={(v) => update({ calendar: { weekStartsOn: v } })}
          />
          <SelectSetting
            label="Default view"
            value={c.defaultView}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
              { value: 'agenda', label: 'Agenda' },
            ]}
            onSave={(v) => update({ calendar: { defaultView: v } })}
          />
          <SelectSetting
            label="Time format"
            value={c.timeFormat}
            options={[
              { value: 'auto', label: 'From system locale' },
              { value: '12h', label: '12-hour' },
              { value: '24h', label: '24-hour' },
            ]}
            onSave={(v) => update({ calendar: { timeFormat: v } })}
          />
        </div>
        <div className="field-row">
          <NumberSetting label="Default event length" value={c.defaultDurationMinutes} min={5} max={1440} suffix="minutes" onSave={(v) => update({ calendar: { defaultDurationMinutes: v } })} />
          <NumberSetting label="Day view scrolls to" value={c.dayStartHour} min={0} max={12} suffix=":00" onSave={(v) => update({ calendar: { dayStartHour: v } })} />
        </div>
      </Section>
      <Section title="External calendars">
        <Banner tone="info">Google Calendar, Microsoft Outlook and CalDAV are not connected in this version. Your calendar is stored only on this computer; you can export it as an .ics file from the calendar toolbar.</Banner>
      </Section>
    </>
  );
}

export function NotesSection() {
  const { settings, update } = useSettings();
  const n = settings.notes;
  return (
    <Section title="Notes">
      <SelectSetting
        label="Format for new notes"
        value={n.defaultFormat}
        options={[
          { value: 'markdown', label: 'Markdown' },
          { value: 'plain', label: 'Plain text' },
        ]}
        onSave={(v) => update({ notes: { defaultFormat: v } })}
      />
      <div className="field-row">
        <NumberSetting label="Autosave after typing stops for" value={n.autosaveDelayMs} min={300} max={5000} step={100} suffix="ms" onSave={(v) => update({ notes: { autosaveDelayMs: v } })} />
        <NumberSetting label="Empty trash after" value={n.trashRetentionDays} min={1} max={365} suffix="days" onSave={(v) => update({ notes: { trashRetentionDays: v } })} />
      </div>
      <ToggleSetting label="Show Markdown preview beside the editor" value={n.showPreview} onSave={(v) => update({ notes: { showPreview: v } })} />
      <ToggleSetting label="Spell check" description="On Windows and Linux, the first use may download dictionary files from Google’s servers." value={n.spellcheck} onSave={(v) => update({ notes: { spellcheck: v } })} />
    </Section>
  );
}

export function ProductivitySection() {
  const { settings, update } = useSettings();
  const p = settings.productivity;
  return (
    <Section title="Focus timer">
      <div className="field-row">
        <NumberSetting label="Focus length" value={p.focusMinutes} min={1} max={180} suffix="min" onSave={(v) => update({ productivity: { focusMinutes: v } })} />
        <NumberSetting label="Short break" value={p.shortBreakMinutes} min={1} max={60} suffix="min" onSave={(v) => update({ productivity: { shortBreakMinutes: v } })} />
        <NumberSetting label="Long break" value={p.longBreakMinutes} min={1} max={90} suffix="min" onSave={(v) => update({ productivity: { longBreakMinutes: v } })} />
        <NumberSetting label="Long break every" value={p.longBreakEvery} min={2} max={12} suffix="focus sessions" onSave={(v) => update({ productivity: { longBreakEvery: v } })} />
      </div>
      <ToggleSetting label="Start breaks automatically" value={p.autoStartBreaks} onSave={(v) => update({ productivity: { autoStartBreaks: v } })} />
    </Section>
  );
}

export function PrivacySection() {
  const { settings, update } = useSettings();
  const inv = useQuery('data:inventory', () => api.data.inventory());
  const p = settings.privacy;
  return (
    <>
      <Section title="What leaves this computer" description="FlowCompanion keeps your data in a local database. Data is sent out only in these cases:">
        <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>
            <strong>AI requests</strong> — the messages in a conversation, and anything you explicitly attach, go to the provider you chose for it.
          </li>
          <li>
            <strong>News</strong> — FlowCompanion downloads the feeds you follow from their publishers. Nothing about you is sent beyond a normal web request.
          </li>
          <li>
            <strong>Marketplace server</strong> — only if you set one up in Settings → Marketplace.
          </li>
          <li>
            <strong>Links</strong> you open go to your web browser.
          </li>
        </ul>
        <p className="small muted">There is no analytics, telemetry or crash reporting.</p>
      </Section>
      <Section title="Personalization" description="Suggestions on the home screen are computed on this computer.">
        <ToggleSetting label="Personalize suggestions" description="Use the interests and learning goals you choose to suggest resources, news topics and prompts." value={p.personalization} onSave={(v) => update({ privacy: { personalization: v } })} />
        <ToggleSetting
          label="Also use my activity"
          description="Use what you saved and completed (learning progress, saved articles) to improve suggestions. Stays on this computer."
          value={p.useActivityForPersonalization}
          disabled={!p.personalization}
          onSave={(v) => update({ privacy: { useActivityForPersonalization: v } })}
        />
        <ToggleSetting
          label="Also use my AI conversation titles"
          description="Separate consent: lets Learning Hub suggestions consider the titles of your recent AI conversations. Matched on this computer; never sent anywhere."
          value={p.useConversationsForPersonalization}
          disabled={!p.personalization}
          onSave={(v) => update({ privacy: { useConversationsForPersonalization: v } })}
        />
      </Section>
      <Section title="Sharing context with AI">
        <ToggleSetting label="Ask before sending attached notes, tasks or events" description="Shows exactly what will be sent and to which provider." value={p.confirmBeforeSendingContext} onSave={(v) => update({ privacy: { confirmBeforeSendingContext: v } })} />
      </Section>
      <Section title="Stored on this computer">
        {!inv.data ? (
          <Loading />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>What it is</th>
                <th className="right">Items</th>
              </tr>
            </thead>
            <tbody>
              {inv.data.map((r) => (
                <tr key={r.table}>
                  <td className="nowrap">{r.label}</td>
                  <td className="small muted">{r.description}</td>
                  <td className="right mono">{r.rows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

export function DataSection() {
  const { settings, update } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const backups = useQuery('data:backups', () => api.data.backups());
  const info = useQuery('app:info', () => api.app.info());
  const [typed, setTyped] = useState('');
  return (
    <>
      <Section title="Export" description="Everything except API keys, as one JSON file you can keep or inspect.">
        <div className="row-wrap">
          <Button icon={<HardDriveDownload size={14} />} onClick={() => void api.data.exportAll().then((r) => r.saved && toast(`Exported to ${r.path}`, 'success'))}>
            Export all data
          </Button>
          <Button onClick={() => void api.notes.exportAll().then((r) => r.saved && toast(`Exported to ${r.path}`, 'success'))}>Export notes only</Button>
          <Button onClick={() => void api.calendar.exportIcs().then((r) => r.saved && toast(`Exported to ${r.path}`, 'success'))}>Export calendar (.ics)</Button>
        </div>
      </Section>
      <Section title="Backups" description="A copy of the database is made before every update. You can also make one now and restore any of them.">
        <div className="row-wrap">
          <Button
            icon={<Database size={14} />}
            onClick={async () => {
              try {
                const r = await api.data.createBackup();
                invalidate('data:backups');
                toast(`Backup created: ${r.file}`, 'success');
              } catch (err) {
                toast(errorMessage(err), 'error');
              }
            }}
          >
            Back up now
          </Button>
          <Button icon={<FolderOpen size={14} />} onClick={() => void api.data.openFolder()}>
            Open data folder
          </Button>
        </div>
        <NumberSetting label="Keep this many backups" value={settings.data.backupsToKeep} min={1} max={50} onSave={(v) => update({ data: { backupsToKeep: v } })} />
        {backups.data?.length ? (
          <table className="table">
            <tbody>
              {backups.data.map((b) => (
                <tr key={b.file}>
                  <td className="mono small">{b.file}</td>
                  <td className="small muted nowrap">{fmtDateTime(b.createdAt, settings)}</td>
                  <td className="small muted nowrap">{(b.size / 1024).toFixed(0)} KB</td>
                  <td>
                    <Button
                      size="sm"
                      icon={<RotateCcw size={13} />}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: 'Restore this backup?',
                            message: 'FlowCompanion restarts with the data from this backup. Your current data is backed up first, so you can switch back.',
                            confirmLabel: 'Restore and restart',
                          })
                        )
                          await api.data.restoreBackup(b.file);
                      }}
                    >
                      Restore
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="small muted">No backups yet.</p>
        )}
        <p className="small faint">Data folder: {info.data?.dataDir}</p>
      </Section>
      <Section title="Delete everything">
        <Banner tone="danger" title="This cannot be undone">
          Deletes all notes, tasks, events, conversations, settings, backups and saved API keys from this computer, then restarts FlowCompanion empty. Export first if you want a copy.
        </Banner>
        <Field label="Type DELETE to confirm" htmlFor="del">
          <Input id="del" value={typed} onChange={(e) => setTyped(e.target.value)} style={{ maxWidth: 220 }} />
        </Field>
        <div>
          <Button variant="danger-solid" icon={<ShieldAlert size={14} />} disabled={typed !== 'DELETE'} onClick={() => void api.data.deleteAll(typed)}>
            Delete all data
          </Button>
        </div>
      </Section>
    </>
  );
}

export function AccountsSection() {
  return (
    <Section title="Accounts and sync">
      <Banner tone="info" title="Not available in this version">
        FlowCompanion works fully without an account. Syncing between devices is not implemented; your data stays on this computer. A marketplace account can be set up in Settings → Marketplace if you connect to a marketplace server.
      </Banner>
    </Section>
  );
}

export function AboutSection() {
  const info = useQuery('app:info', () => api.app.info());
  const caps = useCaps();
  const report = useQuery('app:startup', () => api.app.startupReport());
  if (!info.data || !caps.data) return <Loading />;
  const cap = (label: string, c: { supported?: boolean; available?: boolean; detail: string }) => (
    <tr key={label}>
      <td className="nowrap">{label}</td>
      <td>{(c.supported ?? c.available) ? <Badge tone="ok">Available</Badge> : <Badge tone="warn">Unavailable</Badge>}</td>
      <td className="small muted">{c.detail}</td>
    </tr>
  );
  return (
    <>
      <Section title="About FlowCompanion">
        <dl className="kv">
          <dt>Version</dt>
          <dd>{info.data.version}</dd>
          <dt>Platform</dt>
          <dd>
            {info.data.platform} ({info.data.arch})
          </dd>
          <dt>Electron / Chromium / Node</dt>
          <dd>
            {info.data.electron} / {info.data.chrome} / {info.data.node}
          </dd>
          <dt>SQLite</dt>
          <dd>{info.data.sqlite}</dd>
          <dt>Database schema</dt>
          <dd>v{report.data?.migratedTo}</dd>
          <dt>Data folder</dt>
          <dd className="mono small">{info.data.dataDir}</dd>
        </dl>
      </Section>
      <Section title="What this computer supports" description="Detected at startup. Features that depend on something unavailable say so where they appear.">
        <table className="table">
          <tbody>
            {cap('Secure key storage', caps.data.secureStorage)}
            {cap('System notifications', caps.data.notifications)}
            {cap('Tray / menu bar icon', caps.data.tray)}
            {cap('Global shortcuts', caps.data.globalShortcuts)}
            {cap('Launch at login', caps.data.launchAtLogin)}
            {cap('Window transparency', caps.data.windowOpacity)}
            {cap('Screen-capture exclusion', caps.data.contentProtection)}
          </tbody>
        </table>
      </Section>
    </>
  );
}
