import { DateTime } from 'luxon';
import { CalendarPlus, GraduationCap, Target } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Weekday } from '../../../shared/types';
import { Button, EmptyState, Field, Input, Loading, Select, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtMinutes, zoneOf } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate } from '../../lib/router';
import { useSettings } from '../../lib/settings';

const DAYS: { d: Weekday; label: string }[] = [
  { d: 1, label: 'Mon' },
  { d: 2, label: 'Tue' },
  { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' },
  { d: 5, label: 'Fri' },
  { d: 6, label: 'Sat' },
  { d: 7, label: 'Sun' },
];

/** Plans study sessions as "study" events in the local calendar, with reminders. */
export function PlannerTab() {
  const { settings } = useSettings();
  const toast = useToast();
  const zone = zoneOf(settings);
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(() => DateTime.now().setZone(zone).plus({ days: 1 }).toISODate()!);
  const [time, setTime] = useState('17:00');
  const [minutes, setMinutes] = useState(45);
  const [days, setDays] = useState<Weekday[]>([]);
  const [weeks, setWeeks] = useState(4);
  const range = useMemo(() => {
    const now = DateTime.now().setZone(zone).startOf('day');
    return { from: now.toUTC().toISO()!, to: now.plus({ days: 14 }).toUTC().toISO()! };
  }, [zone]);
  const occ = useQuery(`calendar:study:${range.from}`, () => api.calendar.occurrences(range.from, range.to));
  const study = (occ.data ?? []).filter((o) => o.category === 'study');
  const plannedMinutes = study.reduce((sum, o) => sum + (new Date(o.endUtc).getTime() - new Date(o.startUtc).getTime()) / 60_000, 0);

  const plan = async () => {
    try {
      const start = DateTime.fromISO(`${date}T${time}`, { zone });
      const end = start.plus({ minutes });
      await api.calendar.create({
        title: `Study: ${subject.trim()}`,
        category: 'study',
        start: start.toFormat("yyyy-LL-dd'T'HH:mm"),
        end: end.toFormat("yyyy-LL-dd'T'HH:mm"),
        timeZone: zone,
        reminders: [settings.learning.studyReminderMinutes],
        recurrence: days.length ? { freq: 'weekly', interval: 1, byWeekday: days, count: days.length * weeks } : null,
      });
      invalidate('calendar');
      toast('Study session added to your calendar', 'success');
      setSubject('');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(320px, 1fr) minmax(280px, 380px)', alignItems: 'start' }}>
      <div className="card stack-4">
        <h3>Plan a study session</h3>
        <Field label="What will you study?" htmlFor="pl-sub">
          <Input id="pl-sub" placeholder="e.g. Prompt engineering basics" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <div className="field-row">
          <Field label="First session" htmlFor="pl-date">
            <input id="pl-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time" htmlFor="pl-time">
            <input id="pl-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Length" htmlFor="pl-len">
            <Select id="pl-len" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[15, 25, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {fmtMinutes(m)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Repeat on (optional)" htmlFor="pl-days" hint={days.length ? `${days.length * weeks} sessions over ${weeks} weeks` : 'Leave empty for a single session.'}>
          <div className="row-wrap" id="pl-days">
            {DAYS.map((d) => (
              <button key={d.d} type="button" className="chip" aria-pressed={days.includes(d.d)} onClick={() => setDays(days.includes(d.d) ? days.filter((x) => x !== d.d) : [...days, d.d])}>
                {d.label}
              </button>
            ))}
            {days.length ? (
              <Select aria-label="For how many weeks" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} style={{ width: 'auto' }}>
                {[1, 2, 4, 6, 8, 12].map((w) => (
                  <option key={w} value={w}>
                    for {w} week{w === 1 ? '' : 's'}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        </Field>
        <div className="row">
          <Button variant="primary" icon={<CalendarPlus size={14} />} disabled={!subject.trim()} onClick={() => void plan()}>
            Add to calendar
          </Button>
          <span className="small faint">You’ll get a reminder {settings.learning.studyReminderMinutes} min before (Settings → Learning).</span>
        </div>
        <Button variant="ghost" icon={<GraduationCap size={14} />} onClick={() => navigate('/learning')}>
          Find something to study in the Learning Hub
        </Button>
      </div>
      <div className="card stack-3">
        <div className="card-header">
          <h3 className="grow">Next 14 days</h3>
          <span className="small muted">{fmtMinutes(plannedMinutes)} planned</span>
        </div>
        {!occ.data ? <Loading /> : null}
        {occ.data && study.length === 0 ? <EmptyState title="No study sessions planned" /> : null}
        {study.map((o) => (
          <div key={`${o.eventId}:${o.occurrenceKey}`} className="row">
            <div className="grow">
              <div style={{ fontWeight: 560 }}>{o.title.replace(/^Study: /, '')}</div>
              <div className="small faint">{DateTime.fromISO(o.startUtc).setZone(zone).toFormat('ccc d LLL · HH:mm')}</div>
            </div>
            <Button
              size="sm"
              icon={<Target size={13} />}
              onClick={async () => {
                const len = Math.round((new Date(o.endUtc).getTime() - new Date(o.startUtc).getTime()) / 60_000);
                await api.focus.start('focus', Math.min(240, Math.max(1, len)), o.title.replace(/^Study: /, ''));
                invalidate('focus');
                navigate('/productivity/focus');
              }}
            >
              Start
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
