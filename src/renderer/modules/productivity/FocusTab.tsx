import { Coffee, Pause, Play, Square, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FocusSession } from '../../../shared/types';
import { Button, Input, Loading, useToast } from '../../components/ui';
import { api, errorMessage, onAppEvent } from '../../lib/api';
import { fmtDuration, fmtMinutes, fmtRelative } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { useSettings } from '../../lib/settings';

const KIND_LABEL: Record<FocusSession['kind'], string> = { focus: 'Focus', short_break: 'Short break', long_break: 'Long break' };

export function remainingMs(s: FocusSession, now = Date.now()): number {
  if (s.pausedAt) return s.remainingMs ?? 0;
  return Math.max(0, new Date(s.endsAt).getTime() - now);
}

export function useFocusSession() {
  const q = useQuery('focus:current', () => api.focus.current());
  const [, setTick] = useState(0);
  useEffect(() => onAppEvent('focus.tick', () => invalidate('focus')), []);
  useEffect(() => {
    if (!q.data || q.data.pausedAt) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [q.data]);
  return q;
}

export function FocusTab() {
  const { settings } = useSettings();
  const toast = useToast();
  const route = useRoute();
  const cur = useFocusSession();
  const stats = useQuery('focus:stats', () => api.focus.stats());
  const history = useQuery('focus:history', () => api.focus.history(10));
  const next = useQuery('focus:next', () => api.focus.nextKind());
  const [label, setLabel] = useState('');
  const run = async (p: Promise<unknown>) => {
    try {
      await p;
      invalidate('focus');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  useEffect(() => {
    if (route.params.get('start') === '1' && cur.data === null) {
      void run(api.focus.start('focus'));
      navigate('/productivity/focus', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur.data]);

  if (cur.data === undefined) return <Loading />;
  const s = cur.data;
  const total = s ? s.plannedMinutes * 60_000 : 1;
  const left = s ? remainingMs(s) : 0;
  const pct = s ? 1 - left / total : 0;
  const R = 92;
  const C = 2 * Math.PI * R;
  const p = settings.productivity;

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(300px, 1fr) minmax(260px, 340px)', alignItems: 'start' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 32 }}>
        <svg width="220" height="220" viewBox="0 0 220 220" role="img" aria-label={s ? `${KIND_LABEL[s.kind]}: ${fmtDuration(left)} left` : 'Timer idle'}>
          <circle cx="110" cy="110" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
          <circle
            cx="110"
            cy="110"
            r={R}
            fill="none"
            stroke={s?.kind === 'focus' || !s ? 'var(--accent)' : 'var(--ok)'}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            transform="rotate(-90 110 110)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
          <text x="110" y="108" textAnchor="middle" fill="var(--text)" fontSize="40" fontWeight="700" fontFamily="var(--font-mono)">
            {s ? fmtDuration(left) : fmtDuration(p.focusMinutes * 60_000)}
          </text>
          <text x="110" y="138" textAnchor="middle" fill="var(--text-muted)" fontSize="14">
            {s ? (s.pausedAt ? 'Paused' : KIND_LABEL[s.kind]) : 'Ready'}
          </text>
        </svg>
        {s?.label ? <div className="muted">{s.label}</div> : null}
        {s ? (
          <div className="row">
            {s.pausedAt ? (
              <Button variant="primary" icon={<Play size={14} />} onClick={() => void run(api.focus.resume())}>
                Resume
              </Button>
            ) : (
              <Button icon={<Pause size={14} />} onClick={() => void run(api.focus.pause())}>
                Pause
              </Button>
            )}
            <Button icon={<Square size={13} />} onClick={() => void run(api.focus.stop())}>
              Stop
            </Button>
          </div>
        ) : (
          <div className="stack-3" style={{ width: '100%', maxWidth: 360 }}>
            <Input placeholder="What are you focusing on? (optional)" aria-label="Focus label" value={label} onChange={(e) => setLabel(e.target.value)} />
            <div className="row" style={{ justifyContent: 'center' }}>
              <Button variant="primary" icon={<Target size={14} />} onClick={() => void run(api.focus.start('focus', undefined, label))}>
                Focus {p.focusMinutes} min
              </Button>
              <Button icon={<Coffee size={14} />} onClick={() => void run(api.focus.start(next.data === 'long_break' ? 'long_break' : 'short_break'))}>
                {next.data === 'long_break' ? `Long break ${p.longBreakMinutes} min` : `Break ${p.shortBreakMinutes} min`}
              </Button>
            </div>
            <p className="small faint center">Durations are set in Settings → Productivity. You get a notification when time is up, even if this window is closed.</p>
          </div>
        )}
      </div>
      <div className="stack-4">
        <div className="card">
          <div className="card-header">
            <h3>Your focus</h3>
          </div>
          <dl className="kv">
            <dt>Today</dt>
            <dd>
              {fmtMinutes(stats.data?.todayFocusMinutes ?? 0)} · {stats.data?.todaySessions ?? 0} session{stats.data?.todaySessions === 1 ? '' : 's'}
            </dd>
            <dt>Last 7 days</dt>
            <dd>{fmtMinutes(stats.data?.weekFocusMinutes ?? 0)}</dd>
            <dt>Streak</dt>
            <dd>{stats.data?.streakDays ?? 0} day{stats.data?.streakDays === 1 ? '' : 's'}</dd>
          </dl>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>Recent sessions</h3>
          </div>
          {history.data?.length === 0 ? <div className="small muted">None yet.</div> : null}
          <div className="col" style={{ gap: 6 }}>
            {history.data?.map((h) => (
              <div key={h.id} className="row small">
                <span className="grow">
                  {KIND_LABEL[h.kind]} · {h.plannedMinutes} min{h.label ? ` · ${h.label}` : ''}
                </span>
                <span className={h.completed ? 'ok-text' : 'faint'}>{h.completed ? 'done' : 'stopped'}</span>
                <span className="faint">{fmtRelative(h.startedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
