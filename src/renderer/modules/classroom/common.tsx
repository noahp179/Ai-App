import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Banner, Button, Loading } from '../../components/ui';
import type { ClassroomError } from '../../../shared/classroom/transport';
import { useClassroom, type Q } from './context';

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
export const fmtDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
export const pts = (n: number | null | undefined) => (n === null || n === undefined ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(1));
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "2026-11-12T14:00" for <input type="datetime-local"> and back. */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export function ErrorNote({ error, onRetry }: { error: ClassroomError | string | null | undefined; onRetry?: () => void }) {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : error.message;
  return (
    <Banner tone="danger">
      <span className="grow">{msg}</span>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Banner>
  );
}

/** Shows loading or an error until the data is there. */
export function Loaded<T>({ q, children, label }: { q: Q<T>; children: (data: T) => ReactNode; label?: string }) {
  if (q.data !== undefined) return <>{children(q.data)}</>;
  if (q.error) return <ErrorNote error={q.error} onRetry={q.reload} />;
  return <Loading label={label} />;
}

export function PageHeader({ title, subtitle, actions, backLabel = 'Back' }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; backLabel?: string }) {
  const { back, canGoBack } = useClassroom();
  return (
    <header className="stack-2">
      {canGoBack ? (
        <div>
          <Button size="sm" variant="ghost" icon={<ArrowLeft size={14} />} onClick={back}>
            {backLabel}
          </Button>
        </div>
      ) : null}
      <div className="row-wrap" style={{ alignItems: 'flex-start' }}>
        <div className="grow stack-1">
          <h1>{title}</h1>
          {subtitle ? <div className="muted small">{subtitle}</div> : null}
        </div>
        {actions ? <div className="row-wrap">{actions}</div> : null}
      </div>
    </header>
  );
}

/** A label for a time remaining, in words a screen reader reads well. */
export function remaining(ms: number): string {
  if (ms <= 0) return 'Time is up';
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min left`;
  return m >= 5 ? `${m} min left` : `${m}:${String(s).padStart(2, '0')} left`;
}

export const ROLE_LABEL: Record<string, string> = { admin: 'Administrator', teacher: 'Teacher', student: 'Student', co_teacher: 'Co-teacher' };
