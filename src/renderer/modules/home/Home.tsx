import { DateTime } from 'luxon';
import { ArrowRight, BookOpen, CalendarDays, ListTodo, NotebookPen, Send, Sparkles, Target } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Banner, Button, Input, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtDuration, fmtMinutes, fmtRelative, hour12, zoneOf } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { remainingMs, useFocusSession } from '../productivity/FocusTab';
import { HOME_WIDGETS } from './widgets';

export function Widget({ title, icon, action, children }: { title: string; icon: ReactNode; action?: { label: string; route: string }; children: ReactNode }) {
  return (
    <section className="card stack-3" aria-label={title}>
      <div className="row">
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        <h3 className="grow">{title}</h3>
        {action ? (
          <button type="button" className="btn ghost sm" onClick={() => navigate(action.route)}>
            {action.label} <ArrowRight size={13} />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StartupNotices() {
  const report = useQuery('app:startup', () => api.app.startupReport());
  const drafts = useQuery('notes:drafts', () => api.notes.drafts());
  const r = report.data;
  const pending = drafts.data?.filter((d) => d.differs) ?? [];
  return (
    <>
      {r?.recoveredFromCorruption ? (
        <Banner tone="warn" title="Your database was repaired">
          {r.recoveryDetail}
        </Banner>
      ) : null}
      {r && r.backupPath && r.migratedFrom > 0 && r.migratedFrom < r.migratedTo ? (
        <Banner tone="info">FlowCompanion updated its data format (v{r.migratedFrom} → v{r.migratedTo}). A backup was made first.</Banner>
      ) : null}
      {pending.length ? (
        <Banner tone="warn" title="Unsaved note edits were recovered">
          <div className="row-wrap" style={{ marginTop: 4 }}>
            {pending.map((d) => (
              <Button key={d.noteId} size="sm" onClick={() => navigate(`/notes/${d.noteId}`)}>
                {d.noteTitle || 'Untitled'}
              </Button>
            ))}
          </div>
        </Banner>
      ) : null}
    </>
  );
}

function Agenda() {
  const { settings } = useSettings();
  const zone = zoneOf(settings);
  const range = useMemo(() => {
    const d = DateTime.now().setZone(zone).startOf('day');
    return { from: d.toUTC().toISO()!, to: d.plus({ days: 1 }).toUTC().toISO()! };
  }, [zone]);
  const occ = useQuery(`calendar:home:${range.from}`, () => api.calendar.occurrences(range.from, range.to));
  return (
    <Widget title="Today" icon={<CalendarDays size={16} />} action={{ label: 'Calendar', route: '/calendar' }}>
      {occ.data?.length === 0 ? <p className="small muted">Nothing scheduled today.</p> : null}
      <div className="col" style={{ gap: 6 }}>
        {occ.data?.slice(0, 6).map((o) => (
          <button key={`${o.eventId}:${o.occurrenceKey}`} type="button" className="list-item" style={{ padding: '4px 6px' }} onClick={() => navigate(`/calendar?event=${o.eventId}`)}>
            <span className="small muted nowrap" style={{ width: 70 }}>
              {o.allDay ? 'All day' : DateTime.fromISO(o.startUtc).setZone(zone).toLocaleString({ hour: 'numeric', minute: '2-digit', hour12: hour12(settings) })}
            </span>
            <span className="ellipsis">{o.title}</span>
          </button>
        ))}
      </div>
    </Widget>
  );
}

function DueTasks() {
  const tasks = useQuery('tasks:home', () => api.tasks.list({ listId: 'today' }));
  const counts = useQuery('tasks:counts', () => api.tasks.counts());
  return (
    <Widget title="Tasks" icon={<ListTodo size={16} />} action={{ label: 'All tasks', route: '/productivity/tasks' }}>
      <div className="small muted">
        {counts.data ? `${counts.data.open} open · ${counts.data.overdue} overdue · ${counts.data.doneToday} done today` : ''}
      </div>
      {tasks.data?.length === 0 ? <p className="small muted">Nothing due today.</p> : null}
      <div className="col" style={{ gap: 4 }}>
        {tasks.data?.slice(0, 6).map((t) => (
          <label key={t.id} className="row" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={t.done} onChange={(e) => void api.tasks.toggle(t.id, e.target.checked).then(() => invalidate('tasks'))} />
            <span className="ellipsis grow">{t.title}</span>
            {t.dueAt && new Date(t.dueAt) < new Date() ? <span className="tiny danger-text">overdue</span> : null}
          </label>
        ))}
      </div>
    </Widget>
  );
}

function Focus() {
  const { settings } = useSettings();
  const cur = useFocusSession();
  const stats = useQuery('focus:stats', () => api.focus.stats());
  const s = cur.data;
  return (
    <Widget title="Focus" icon={<Target size={16} />} action={{ label: 'Open timer', route: '/productivity/focus' }}>
      {s ? (
        <div className="row">
          <span className="mono" style={{ fontSize: '1.6rem', fontWeight: 700 }}>
            {fmtDuration(remainingMs(s))}
          </span>
          <span className="muted small">{s.pausedAt ? 'paused' : s.kind === 'focus' ? 'focusing' : 'on a break'}</span>
        </div>
      ) : (
        <Button
          variant="primary"
          icon={<Target size={14} />}
          onClick={() => void api.focus.start('focus').then(() => (invalidate('focus'), navigate('/productivity/focus')))}
        >
          Focus for {settings.productivity.focusMinutes} minutes
        </Button>
      )}
      <div className="small muted">
        Today {fmtMinutes(stats.data?.todayFocusMinutes ?? 0)} · streak {stats.data?.streakDays ?? 0} day{stats.data?.streakDays === 1 ? '' : 's'}
      </div>
    </Widget>
  );
}

function QuickAsk() {
  const toast = useToast();
  const status = useQuery('providers:status', () => api.ai.status());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (status.data && !status.data.configured) {
    return (
      <Widget title="Ask AI" icon={<Sparkles size={16} />}>
        <p className="small muted">Connect an AI provider — a cloud service with your key, or a model on this computer — to ask questions here.</p>
        <div>
          <Button onClick={() => navigate('/ai/setup')}>Connect a provider</Button>
        </div>
      </Widget>
    );
  }
  const ask = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const c = await api.ai.createConversation();
      await api.ai.send({ conversationId: c.id, content: text });
      invalidate('conversations');
      navigate(`/ai/${c.id}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Widget title="Ask AI" icon={<Sparkles size={16} />} action={{ label: 'Workspace', route: '/ai' }}>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <Input placeholder="Ask anything…" aria-label="Ask AI" value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" variant="primary" loading={busy} disabled={!text.trim()} icon={<Send size={13} />}>
          Ask
        </Button>
      </form>
    </Widget>
  );
}

function RecentNotes() {
  const notes = useQuery('notes:list:home', () => api.notes.list({ view: 'all' }));
  return (
    <Widget title="Recent notes" icon={<NotebookPen size={16} />} action={{ label: 'Notes', route: '/notes' }}>
      {notes.data?.length === 0 ? (
        <div>
          <Button size="sm" onClick={() => navigate('/notes/new')}>
            Write your first note
          </Button>
        </div>
      ) : null}
      <div className="col" style={{ gap: 2 }}>
        {notes.data?.slice(0, 5).map((n) => (
          <button key={n.id} type="button" className="list-item" style={{ padding: '4px 6px' }} onClick={() => navigate(`/notes/${n.id}`)}>
            <span className="ellipsis grow">{n.title || 'Untitled'}</span>
            <span className="tiny faint nowrap">{fmtRelative(n.updatedAt)}</span>
          </button>
        ))}
      </div>
    </Widget>
  );
}

function Reading() {
  const list = useQuery('bookmarks:list:home', () => api.bookmarks.list({ queue: 'unread' }));
  if (!list.data?.length) return null;
  return (
    <Widget title="Reading queue" icon={<BookOpen size={16} />} action={{ label: 'Open', route: '/productivity/reading' }}>
      <div className="col" style={{ gap: 2 }}>
        {list.data.slice(0, 4).map((b) => (
          <button key={b.id} type="button" className="list-item" style={{ padding: '4px 6px' }} onClick={() => void api.app.openExternal(b.url)}>
            <span className="ellipsis">{b.title}</span>
          </button>
        ))}
      </div>
    </Widget>
  );
}

export default function Home() {
  const { settings } = useSettings();
  const m = settings.layout.modules;
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="page stack-5">
      <div>
        <h1>{greeting}</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          {DateTime.now().setZone(zoneOf(settings)).toFormat('cccc, d LLLL')}
        </p>
      </div>
      <StartupNotices />
      <div className="grid grid-2">
        {m.ai ? <QuickAsk /> : null}
        {m.calendar ? <Agenda /> : null}
        {m.productivity ? <DueTasks /> : null}
        {m.productivity ? <Focus /> : null}
        {HOME_WIDGETS.filter((w) => m[w.module]).map((w) => (
          <w.component key={w.id} />
        ))}
        {m.notes ? <RecentNotes /> : null}
        {m.productivity ? <Reading /> : null}
      </div>
    </div>
  );
}
