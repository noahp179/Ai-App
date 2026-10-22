import { AlarmClock, BellOff, BellRing, CheckCheck, Trash2 } from 'lucide-react';
import type { InboxNotification } from '../../shared/types';
import { Badge, Button, EmptyState, Loading, Select, useConfirm, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { fmtDateTime, fmtRelative } from '../lib/format';
import { invalidate, useQuery } from '../lib/query';
import { navigate } from '../lib/router';
import { useSettings } from '../lib/settings';

const DELIVERY: Record<InboxNotification['delivery'], { label: string; tone?: 'warn' | 'info' | 'accent' }> = {
  os: { label: 'Shown' },
  quiet_hours: { label: 'Held: quiet hours or paused', tone: 'info' },
  missed: { label: 'Missed while closed', tone: 'warn' },
  in_app: { label: 'In app only', tone: 'accent' },
};

export function InboxPage() {
  const { settings } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const list = useQuery('inbox:list', () => api.inbox.list(200));
  const paused = useQuery('inbox:paused', () => api.inbox.pausedUntil());
  const refresh = () => {
    invalidate('inbox');
    window.dispatchEvent(new Event('fc:inbox-read'));
  };

  return (
    <div className="page stack-4">
      <div className="page-header">
        <div className="grow">
          <h1>Notifications</h1>
          <p className="muted">Reminders, AI results and alerts. Items held by quiet hours or that came due while FlowCompanion was closed are kept here.</p>
        </div>
      </div>
      <div className="row-wrap">
        {paused.data ? (
          <>
            <Badge tone="info">
              <BellOff size={12} /> Paused until {fmtDateTime(paused.data, settings)}
            </Badge>
            <Button size="sm" onClick={() => void api.inbox.resume().then(refresh)}>
              Resume now
            </Button>
          </>
        ) : (
          <Select
            aria-label="Pause notifications"
            value=""
            onChange={(e) => {
              const m = Number(e.target.value);
              if (m) void api.inbox.pause(m).then(refresh);
            }}
            style={{ width: 'auto' }}
          >
            <option value="">Pause notifications…</option>
            <option value="30">for 30 minutes</option>
            <option value="60">for 1 hour</option>
            <option value="240">for 4 hours</option>
            <option value="1440">for 24 hours</option>
          </Select>
        )}
        <span className="spacer" />
        <Button size="sm" icon={<CheckCheck size={14} />} onClick={() => void api.inbox.markAllRead().then(refresh)}>
          Mark all read
        </Button>
        <Button
          size="sm"
          variant="danger"
          icon={<Trash2 size={14} />}
          onClick={async () => {
            if (await confirm({ title: 'Clear notifications?', message: 'The list is emptied. Cleared notifications will not fire again.', confirmLabel: 'Clear', danger: true })) {
              await api.inbox.clear();
              refresh();
            }
          }}
        >
          Clear
        </Button>
      </div>
      {!list.data ? <Loading /> : null}
      {list.data?.length === 0 ? <EmptyState title="You’re all caught up" icon={<BellRing size={28} />} /> : null}
      <div className="stack-3">
        {list.data?.map((n) => (
          <div key={n.id} className="card row" style={{ alignItems: 'flex-start', opacity: n.readAt ? 0.7 : 1 }}>
            {!n.readAt ? <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--accent)', marginTop: 7, flex: 'none' }} aria-label="Unread" /> : <span style={{ width: 8, flex: 'none' }} />}
            <button
              type="button"
              className="grow"
              style={{ border: 0, background: 'none', color: 'inherit', textAlign: 'left', cursor: n.action ? 'pointer' : 'default', padding: 0 }}
              onClick={() => {
                void api.inbox.markRead(n.id).then(refresh);
                if (n.action) navigate(n.action.route);
              }}
            >
              <div style={{ fontWeight: 600 }}>{n.title}</div>
              {n.body ? <div className="small muted">{n.body}</div> : null}
              <div className="row tiny faint" style={{ marginTop: 4 }}>
                <span>{fmtRelative(n.createdAt)}</span>
                <Badge tone={DELIVERY[n.delivery].tone}>{DELIVERY[n.delivery].label}</Badge>
              </div>
            </button>
            {n.snoozable ? (
              <Button
                size="sm"
                icon={<AlarmClock size={13} />}
                onClick={async () => {
                  try {
                    await api.inbox.snooze(n.id);
                    toast(`Snoozed for ${settings.notifications.snoozeMinutes} minutes`, 'success');
                    refresh();
                  } catch (err) {
                    toast(errorMessage(err), 'error');
                  }
                }}
              >
                Snooze
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
