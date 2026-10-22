import { Play, Square, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, IconButton, Input, Loading, Select, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtDuration, fmtMinutes, fmtTime } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { useSettings } from '../../lib/settings';
import { fromLocalInput, toLocalInput } from './TasksTab';

export function TimeTab() {
  const { settings } = useSettings();
  const toast = useToast();
  const running = useQuery('time:running', () => api.time.running());
  const entries = useQuery('time:list', () => api.time.list(7));
  const summary = useQuery('time:summary', () => api.time.summary(7));
  const tasks = useQuery('tasks:open', () => api.tasks.list({ listId: 'all' }));
  const [label, setLabel] = useState('');
  const [taskId, setTaskId] = useState('');
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running.data) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [running.data]);
  const run = async (p: Promise<unknown>) => {
    try {
      await p;
      invalidate('time');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  if (!entries.data || !summary.data) return <Loading />;
  const maxLabel = Math.max(1, ...summary.data.byLabel.map((x) => x.minutes));

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(320px, 1fr) minmax(260px, 340px)', alignItems: 'start' }}>
      <div className="stack-4">
        <div className="card">
          {running.data ? (
            <div className="row">
              <div className="grow">
                <div className="small muted">Tracking</div>
                <div style={{ fontWeight: 600 }}>{running.data.label}</div>
              </div>
              <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 700 }} aria-live="off">
                {fmtDuration(Date.now() - new Date(running.data.startedAt).getTime())}
              </div>
              <Button variant="danger" icon={<Square size={13} />} onClick={() => void run(api.time.stop())}>
                Stop
              </Button>
            </div>
          ) : (
            <form
              className="row-wrap"
              onSubmit={(e) => {
                e.preventDefault();
                const t = tasks.data?.find((x) => x.id === taskId);
                void run(api.time.start(label || t?.title || 'Untitled', taskId || null));
                setLabel('');
              }}
            >
              <Input placeholder="What are you working on?" aria-label="Activity" value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
              <Select aria-label="Link to task" value={taskId} onChange={(e) => setTaskId(e.target.value)} style={{ width: 200 }}>
                <option value="">No task</option>
                {tasks.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="primary" icon={<Play size={13} />}>
                Start
              </Button>
            </form>
          )}
        </div>
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Start</th>
                <th>End</th>
                <th>Duration</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No time tracked in the last 7 days.
                  </td>
                </tr>
              ) : null}
              {entries.data.map((e) => (
                <tr key={e.id}>
                  <td>
                    <input className="input" aria-label="Activity" defaultValue={e.label} onBlur={(ev) => ev.target.value !== e.label && void run(api.time.update(e.id, { label: ev.target.value }))} />
                  </td>
                  <td>
                    <input
                      type="datetime-local"
                      className="input"
                      aria-label="Start"
                      defaultValue={toLocalInput(e.startedAt)}
                      onBlur={(ev) => {
                        const v = fromLocalInput(ev.target.value);
                        if (v && v !== e.startedAt) void run(api.time.update(e.id, { startedAt: v }));
                      }}
                    />
                  </td>
                  <td>
                    {e.endedAt ? (
                      <input
                        type="datetime-local"
                        className="input"
                        aria-label="End"
                        defaultValue={toLocalInput(e.endedAt)}
                        onBlur={(ev) => {
                          const v = fromLocalInput(ev.target.value);
                          if (v && v !== e.endedAt) void run(api.time.update(e.id, { endedAt: v }));
                        }}
                      />
                    ) : (
                      <span className="badge accent">running</span>
                    )}
                  </td>
                  <td className="nowrap mono">{fmtDuration((e.endedAt ? new Date(e.endedAt).getTime() : Date.now()) - new Date(e.startedAt).getTime())}</td>
                  <td>
                    <IconButton label="Delete entry" size="sm" onClick={() => void run(api.time.delete(e.id))}>
                      <Trash2 size={13} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="stack-4">
        <div className="card">
          <div className="card-header">
            <h3 className="grow">Last 7 days</h3>
            <strong>{fmtMinutes(summary.data.totalMinutes)}</strong>
          </div>
          <div className="col" style={{ gap: 8 }}>
            {summary.data.byLabel.slice(0, 8).map((x) => (
              <div key={x.label}>
                <div className="row small">
                  <span className="grow ellipsis">{x.label}</span>
                  <span className="muted">{fmtMinutes(x.minutes)}</span>
                </div>
                <div className="progress" aria-hidden>
                  <div style={{ width: `${(x.minutes / maxLabel) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>By day</h3>
          </div>
          {summary.data.byDay.map((d) => (
            <div key={d.date} className="row small">
              <span className="grow">{new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="muted">{fmtMinutes(d.minutes)}</span>
            </div>
          ))}
          {running.data ? <div className="tiny faint" style={{ marginTop: 8 }}>Started {fmtTime(running.data.startedAt, settings)}</div> : null}
        </div>
      </div>
    </div>
  );
}
