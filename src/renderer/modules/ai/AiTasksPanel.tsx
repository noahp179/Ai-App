import { CheckCircle2, Circle, Clock, HelpCircle, Timer, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { AiTask, AiTaskState } from '../../../shared/types';
import { Badge, Button, EmptyState, Field, IconButton, Input, Loading, Select, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtRelative } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';

const STATE_LABEL: Record<AiTaskState, string> = {
  idle: 'Idle',
  running: 'Running',
  waiting_input: 'Waiting for you',
  completed: 'Completed',
  failed: 'Failed',
  canceled: 'Canceled',
  unknown: 'Unknown',
};
const CONFIDENCE: Record<AiTask['confidence'], { label: string; tone: 'ok' | 'warn' | 'info'; help: string }> = {
  confirmed: { label: 'Confirmed', tone: 'ok', help: 'Reported by the provider API.' },
  estimated: { label: 'Estimated', tone: 'warn', help: 'Based on a timer or a lost connection; not confirmed.' },
  manual: { label: 'Set by you', tone: 'info', help: 'You set this state yourself.' },
};

function StateIcon({ s }: { s: AiTaskState }) {
  if (s === 'completed') return <CheckCircle2 size={16} color="var(--ok)" />;
  if (s === 'failed') return <XCircle size={16} color="var(--danger)" />;
  if (s === 'running') return <span className="spinner" aria-hidden />;
  if (s === 'unknown') return <HelpCircle size={16} color="var(--warn)" />;
  if (s === 'waiting_input') return <Clock size={16} color="var(--info)" />;
  return <Circle size={16} />;
}

export function AiTasksPanel() {
  const toast = useToast();
  const tasks = useQuery('aiTasks:list', () => api.ai.tasks(false));
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(10);

  if (!tasks.data) return <Loading />;
  return (
    <div className="page stack-5">
      <div className="page-header">
        <div className="grow">
          <h1>AI task status</h1>
          <p className="muted">
            Requests made in FlowCompanion are tracked automatically and confirmed by the provider. For work running elsewhere, start a timer — FlowCompanion will remind you to check, but it cannot see whether that work finished.
          </p>
        </div>
      </div>
      <div className="card">
        <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
          <div className="grow" style={{ minWidth: 220 }}>
            <Field label="Track work running elsewhere" htmlFor="tt">
              <Input id="tt" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deep research report in another app" />
            </Field>
          </div>
          <Field label="Check back in" htmlFor="tm">
            <Select id="tm" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} style={{ width: 130 }}>
              {[2, 5, 10, 15, 30, 45, 60, 120].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
          </Field>
          <Button
            variant="primary"
            icon={<Timer size={14} />}
            disabled={!title.trim()}
            onClick={async () => {
              try {
                await api.ai.startTimer(title, minutes);
                setTitle('');
                invalidate('aiTasks');
              } catch (err) {
                toast(errorMessage(err), 'error');
              }
            }}
          >
            Start timer
          </Button>
        </div>
      </div>
      {tasks.data.length === 0 ? (
        <EmptyState title="No AI tasks yet" icon={<Timer size={28} />}>
          Sending a message in the AI workspace creates one automatically.
        </EmptyState>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>State</th>
                <th>How we know</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tasks.data.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 540 }}>{t.title}</div>
                    <div className="small faint">{t.detail}</div>
                  </td>
                  <td>
                    <span className="row">
                      <StateIcon s={t.state} />
                      {STATE_LABEL[t.state]}
                    </span>
                  </td>
                  <td>
                    <Badge tone={CONFIDENCE[t.confidence].tone} title={CONFIDENCE[t.confidence].help}>
                      {CONFIDENCE[t.confidence].label}
                    </Badge>
                    <div className="tiny faint">{t.source === 'native' ? 'FlowCompanion request' : t.source === 'timer' ? 'Timer' : t.source === 'browser' ? 'Browser extension' : 'Manual'}</div>
                  </td>
                  <td className="small muted nowrap">{fmtRelative(t.updatedAt)}</td>
                  <td className="nowrap">
                    {t.source !== 'native' && !['completed', 'failed', 'canceled'].includes(t.state) ? (
                      <Button size="sm" onClick={() => void api.ai.setTaskState(t.id, 'completed').then(() => invalidate('aiTasks'))}>
                        Mark done
                      </Button>
                    ) : null}
                    <IconButton label="Remove" size="sm" onClick={() => void api.ai.deleteTask(t.id).then(() => invalidate('aiTasks'))}>
                      <Trash2 size={13} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div>
        <Button size="sm" onClick={() => void api.ai.clearFinishedTasks().then(() => invalidate('aiTasks'))}>
          Clear finished
        </Button>
      </div>
    </div>
  );
}
