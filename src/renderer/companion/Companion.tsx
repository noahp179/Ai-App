import { DateTime } from 'luxon';
import { CalendarDays, Maximize2, Minimize2, Minus, PanelLeft, PanelRight, PictureInPicture2, Send, Sparkles, Target, X, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CompanionState } from '../../shared/ipc';
import type { Message } from '../../shared/types';
import { Button, IconButton, Segmented, Textarea, useToast } from '../components/ui';
import { api, errorMessage, onAppEvent } from '../lib/api';
import { fmtDuration, hour12, zoneOf } from '../lib/format';
import { useParental } from '../lib/parental';
import { invalidate, useQuery } from '../lib/query';
import { useSettings } from '../lib/settings';
import { MessageView } from '../modules/ai/MessageView';
import { useStreams } from '../modules/ai/useStreams';
import { remainingMs, useFocusSession } from '../modules/productivity/FocusTab';

type Tab = 'capture' | 'ai' | 'today' | 'focus';

function CaptureTab() {
  const toast = useToast();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'auto' | 'note' | 'task' | 'reading'>('auto');
  const save = async () => {
    try {
      const r = await api.capture.capture({ text, kind: kind === 'auto' ? null : kind });
      toast(`Saved ${r.kind === 'reading' ? 'to reading queue' : `as ${r.kind}`}`, 'success');
      setText('');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  return (
    <div className="stack-3">
      <Segmented
        label="Save as"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'note', label: 'Note' },
          { value: 'task', label: 'Task' },
          { value: 'reading', label: 'Read later' },
        ]}
      />
      <Textarea
        aria-label="Capture"
        rows={6}
        placeholder="Jot something down… (Ctrl+Enter to save)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void save();
          }
        }}
      />
      <Button variant="primary" disabled={!text.trim()} onClick={() => void save()}>
        Save
      </Button>
    </div>
  );
}

function AiTab() {
  const toast = useToast();
  const parental = useParental();
  const status = useQuery('providers:status', () => api.ai.status());
  const [convId, setConvId] = useState<string | null>(() => sessionStorage.getItem('companion:conv'));
  const msgs = useQuery(convId ? `conversations:${convId}:messages` : null, () => api.ai.messages(convId!));
  const streams = useStreams(convId);
  const [text, setText] = useState('');
  const active: Message | undefined = msgs.data?.find((m) => m.status === 'streaming');

  useEffect(() => {
    if (msgs.error) {
      sessionStorage.removeItem('companion:conv');
      setConvId(null);
    }
  }, [msgs.error]);

  if (status.data && !status.data.configured) {
    return (
      <div className="stack-3 small muted">
        <p>No AI provider is connected.</p>
        <Button size="sm" onClick={() => void api.window.expandToMain('/ai/setup')}>
          Connect one
        </Button>
      </div>
    );
  }
  const send = async () => {
    if (!text.trim()) return;
    try {
      let id = convId;
      if (!id) {
        id = (await api.ai.createConversation()).id;
        sessionStorage.setItem('companion:conv', id);
        setConvId(id);
      }
      await api.ai.send({ conversationId: id, content: text });
      setText('');
      invalidate(`conversations:${id}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {msgs.data?.length ? null : <p className="small muted">Ask a quick question. The conversation is saved like any other and can be opened in the AI workspace.</p>}
        {msgs.data?.map((m, i) => (
          <MessageView key={m.id} m={m} streamingText={streams[m.id]} isLast={i === msgs.data!.length - 1} copyRestricted={!!parental?.enabled && parental.config.copyRestriction} onRetry={() => void api.ai.retry(m.id)} />
        ))}
      </div>
      <div className="row">
        <Textarea
          aria-label="Ask AI"
          rows={2}
          style={{ minHeight: 48 }}
          value={text}
          placeholder="Ask…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {active ? (
          <Button size="sm" onClick={() => void api.ai.cancel(active.id)}>
            Stop
          </Button>
        ) : (
          <IconButton label="Send" onClick={() => void send()} disabled={!text.trim()}>
            <Send size={15} />
          </IconButton>
        )}
      </div>
      <div className="row">
        {convId ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => void api.window.expandToMain(`/ai/${convId}`)}>
              Open in workspace
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                sessionStorage.removeItem('companion:conv');
                setConvId(null);
              }}
            >
              New chat
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function TodayTab() {
  const { settings } = useSettings();
  const zone = zoneOf(settings);
  const range = useMemo(() => {
    const d = DateTime.now().setZone(zone).startOf('day');
    return { from: d.toUTC().toISO()!, to: d.plus({ days: 1 }).toUTC().toISO()! };
  }, [zone]);
  const occ = useQuery(`calendar:companion:${range.from}`, () => api.calendar.occurrences(range.from, range.to));
  const tasks = useQuery('tasks:companion', () => api.tasks.list({ listId: 'today' }));
  return (
    <div className="stack-4">
      <div>
        <div className="field-label" style={{ marginBottom: 6 }}>
          Agenda
        </div>
        {occ.data?.length === 0 ? <div className="small muted">Nothing scheduled.</div> : null}
        {occ.data?.map((o) => (
          <div key={`${o.eventId}:${o.occurrenceKey}`} className="row small" style={{ padding: '3px 0' }}>
            <span className="muted nowrap" style={{ width: 64 }}>
              {o.allDay ? 'All day' : DateTime.fromISO(o.startUtc).setZone(zone).toLocaleString({ hour: 'numeric', minute: '2-digit', hour12: hour12(settings) })}
            </span>
            <span className="ellipsis">{o.title}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="field-label" style={{ marginBottom: 6 }}>
          Due today
        </div>
        {tasks.data?.length === 0 ? <div className="small muted">No tasks due.</div> : null}
        {tasks.data?.map((t) => (
          <label key={t.id} className="row small" style={{ padding: '3px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={t.done} onChange={(e) => void api.tasks.toggle(t.id, e.target.checked).then(() => invalidate('tasks'))} />
            <span className="ellipsis">{t.title}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function FocusTabMini() {
  const { settings } = useSettings();
  const cur = useFocusSession();
  const s = cur.data;
  const run = (p: Promise<unknown>) => void p.then(() => invalidate('focus'));
  return (
    <div className="stack-4 center">
      <div className="mono" style={{ fontSize: '2.6rem', fontWeight: 700 }}>
        {s ? fmtDuration(remainingMs(s)) : fmtDuration(settings.productivity.focusMinutes * 60_000)}
      </div>
      <div className="muted small">{s ? (s.pausedAt ? 'Paused' : s.kind === 'focus' ? 'Focusing' : 'Break') : 'Ready'}</div>
      <div className="row" style={{ justifyContent: 'center' }}>
        {!s ? (
          <Button variant="primary" onClick={() => run(api.focus.start('focus'))}>
            Start focus
          </Button>
        ) : (
          <>
            {s.pausedAt ? <Button onClick={() => run(api.focus.resume())}>Resume</Button> : <Button onClick={() => run(api.focus.pause())}>Pause</Button>}
            <Button onClick={() => run(api.focus.stop())}>Stop</Button>
          </>
        )}
      </div>
    </div>
  );
}

export function Companion() {
  const parental = useParental();
  const aiAllowed = parental?.isModuleAllowed('ai') ?? true;
  const [state, setState] = useState<CompanionState | null>(null);
  const [tab, setTab] = useState<Tab>('capture');
  useEffect(() => {
    if (!aiAllowed && tab === 'ai') setTab('capture');
  }, [aiAllowed, tab]);
  useEffect(() => {
    void api.window.companionState().then(setState);
    return onAppEvent('companion.state', setState);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state && !state.collapsed) void api.window.setCompanionCollapsed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  if (!state) return null;
  if (state.collapsed) {
    return (
      <div className="launcher" role="toolbar" aria-label="FlowCompanion launcher">
        <div className="brand-mark" aria-hidden>
          F
        </div>
        <span className="spacer" />
        <IconButton label="Quick capture" onClick={() => (setTab('capture'), void api.window.setCompanionCollapsed(false))}>
          <Zap size={15} />
        </IconButton>
        {aiAllowed ? (
          <IconButton label="Ask AI" onClick={() => (setTab('ai'), void api.window.setCompanionCollapsed(false))}>
            <Sparkles size={15} />
          </IconButton>
        ) : null}
        <IconButton label="Expand" onClick={() => void api.window.setCompanionCollapsed(false)}>
          <Maximize2 size={15} />
        </IconButton>
        <IconButton label="Hide" onClick={() => void api.window.hideCompanion()}>
          <X size={15} />
        </IconButton>
      </div>
    );
  }
  return (
    <div className="companion">
      <div className="companion-titlebar">
        <div className="brand-mark" aria-hidden style={{ width: 20, height: 20, fontSize: 11 }}>
          F
        </div>
        <strong className="grow small">FlowCompanion</strong>
        <IconButton label="Dock left" size="sm" active={state.dock === 'left'} onClick={() => void api.window.setCompanionDock(state.dock === 'left' ? 'floating' : 'left')}>
          <PanelLeft size={13} />
        </IconButton>
        <IconButton label="Dock right" size="sm" active={state.dock === 'right'} onClick={() => void api.window.setCompanionDock(state.dock === 'right' ? 'floating' : 'right')}>
          <PanelRight size={13} />
        </IconButton>
        <IconButton label="Open full workspace" size="sm" onClick={() => void api.window.expandToMain()}>
          <PictureInPicture2 size={13} />
        </IconButton>
        <IconButton label="Collapse to launcher" size="sm" onClick={() => void api.window.setCompanionCollapsed(true)}>
          <Minimize2 size={13} />
        </IconButton>
        <IconButton label="Minimize" size="sm" onClick={() => void api.window.minimizeCompanion()}>
          <Minus size={13} />
        </IconButton>
        <IconButton label="Hide companion" size="sm" onClick={() => void api.window.hideCompanion()}>
          <X size={13} />
        </IconButton>
      </div>
      <div style={{ padding: '8px 10px 0' }}>
        <Segmented
          label="Companion section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'capture', label: 'Capture' },
            ...(aiAllowed ? [{ value: 'ai' as const, label: 'Ask AI' }] : []),
            { value: 'today', label: <CalendarDays size={14} aria-label="Today" /> },
            { value: 'focus', label: <Target size={14} aria-label="Focus" /> },
          ]}
        />
      </div>
      <div className="companion-body">
        {tab === 'capture' ? <CaptureTab /> : null}
        {tab === 'ai' && aiAllowed ? <AiTab /> : null}
        {tab === 'today' ? <TodayTab /> : null}
        {tab === 'focus' ? <FocusTabMini /> : null}
      </div>
    </div>
  );
}
