import { DateTime } from 'luxon';
import { ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { OccurrenceScope } from '../../../shared/api';
import type { CalendarEvent, ChecklistItem, EventOccurrence, RecurrenceRule, Weekday } from '../../../shared/types';
import { LinksPanel } from '../../components/LinksPanel';
import { Badge, Banner, Button, Field, IconButton, Input, Modal, Select, Textarea, Toggle, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { zoneOf } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { useSettings } from '../../lib/settings';

const REMINDER_CHOICES = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];
const reminderLabel = (m: number) => (m === 0 ? 'At start' : m < 60 ? `${m} min before` : m < 1440 ? `${m / 60} h before` : `${m / 1440} day${m === 1440 ? '' : 's'} before`);
const WEEKDAYS: { d: Weekday; label: string }[] = [
  { d: 1, label: 'Mon' },
  { d: 2, label: 'Tue' },
  { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' },
  { d: 5, label: 'Fri' },
  { d: 6, label: 'Sat' },
  { d: 7, label: 'Sun' },
];

type RepeatKind = 'none' | 'daily' | 'weekly' | 'monthly_day' | 'monthly_nth' | 'yearly';

interface Draft {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timeZone: string;
  location: string;
  meetingUrl: string;
  category: string;
  notes: string;
  repeat: RepeatKind;
  interval: number;
  byWeekday: Weekday[];
  ends: 'never' | 'count' | 'until';
  count: number;
  until: string;
  reminders: number[];
  checklist: ChecklistItem[];
}

function nthOfMonth(dt: DateTime): number {
  const n = Math.ceil(dt.day / 7);
  return dt.plus({ weeks: 1 }).month !== dt.month ? -1 : n;
}

export function draftFromEvent(ev: CalendarEvent): Draft {
  const r = ev.recurrence;
  const start = ev.allDay ? DateTime.fromISO(ev.start) : DateTime.fromISO(ev.start);
  let repeat: RepeatKind = 'none';
  if (r) repeat = r.freq === 'monthly' ? (r.bySetPos ? 'monthly_nth' : 'monthly_day') : r.freq;
  return {
    title: ev.title,
    allDay: ev.allDay,
    startDate: ev.start.slice(0, 10),
    startTime: ev.allDay ? '09:00' : ev.start.slice(11, 16),
    endDate: ev.end.slice(0, 10),
    endTime: ev.allDay ? '10:00' : ev.end.slice(11, 16),
    timeZone: ev.timeZone,
    location: ev.location,
    meetingUrl: ev.meetingUrl,
    category: ev.category,
    notes: ev.notes,
    repeat,
    interval: r?.interval ?? 1,
    byWeekday: r?.byWeekday ?? [start.weekday as Weekday],
    ends: r?.count ? 'count' : r?.until ? 'until' : 'never',
    count: r?.count ?? 10,
    until: r?.until ?? start.plus({ months: 3 }).toISODate()!,
    reminders: ev.reminders,
    checklist: ev.checklist,
  };
}

export function newDraft(start: DateTime, zone: string, minutes: number, defaultReminder: number, allDay = false, category = 'general'): Draft {
  const end = start.plus({ minutes });
  return {
    title: '',
    allDay,
    startDate: start.toISODate()!,
    startTime: start.toFormat('HH:mm'),
    endDate: end.toISODate()!,
    endTime: end.toFormat('HH:mm'),
    timeZone: zone,
    location: '',
    meetingUrl: '',
    category,
    notes: '',
    repeat: 'none',
    interval: 1,
    byWeekday: [start.weekday as Weekday],
    ends: 'never',
    count: 10,
    until: start.plus({ months: 3 }).toISODate()!,
    reminders: allDay ? [] : [defaultReminder],
    checklist: [],
  };
}

function toInput(d: Draft) {
  let recurrence: RecurrenceRule | null = null;
  const startDt = DateTime.fromISO(d.startDate);
  if (d.repeat !== 'none') {
    recurrence = {
      freq: d.repeat === 'monthly_day' || d.repeat === 'monthly_nth' ? 'monthly' : d.repeat,
      interval: Math.max(1, Math.floor(d.interval || 1)),
    };
    if (d.repeat === 'weekly') recurrence.byWeekday = d.byWeekday.length ? d.byWeekday : [startDt.weekday as Weekday];
    if (d.repeat === 'monthly_nth') {
      recurrence.byWeekday = [startDt.weekday as Weekday];
      recurrence.bySetPos = nthOfMonth(startDt);
    }
    if (d.ends === 'count') recurrence.count = Math.max(1, Math.floor(d.count));
    if (d.ends === 'until') recurrence.until = d.until;
  }
  return {
    title: d.title,
    allDay: d.allDay,
    start: d.allDay ? d.startDate : `${d.startDate}T${d.startTime}`,
    end: d.allDay ? d.endDate : `${d.endDate}T${d.endTime}`,
    timeZone: d.timeZone,
    location: d.location,
    meetingUrl: d.meetingUrl.trim(),
    category: d.category,
    notes: d.notes,
    recurrence,
    reminders: d.reminders,
    checklist: d.checklist,
  };
}

/**
 * Creates or edits an event. When editing one occurrence of a recurring event,
 * the user picks whether the change applies to it, to it and later ones, or to all.
 */
export function EventEditor({
  event,
  occurrence,
  initial,
  onClose,
}: {
  event: CalendarEvent | null;
  occurrence: EventOccurrence | null;
  initial?: Draft;
  onClose: () => void;
}) {
  const { settings } = useSettings();
  const toast = useToast();
  const zones = useQuery('settings:zones', () => api.settings.timeZones());
  const [d, setD] = useState<Draft>(() => initial ?? (event ? draftFromEvent(event) : newDraft(DateTime.now().setZone(zoneOf(settings)).startOf('hour').plus({ hours: 1 }), zoneOf(settings), settings.calendar.defaultDurationMinutes, settings.notifications.defaultReminderMinutes)));
  const [scope, setScope] = useState<OccurrenceScope>('this');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const recurringOccurrence = !!(event?.recurrence && occurrence);

  // Editing a single occurrence shows that occurrence's own times.
  useEffect(() => {
    if (!event || !occurrence || !event.recurrence) return;
    const zone = event.allDay ? zoneOf(settings) : event.timeZone;
    const s = DateTime.fromISO(occurrence.startUtc).setZone(zone);
    const e = DateTime.fromISO(occurrence.endUtc).setZone(zone);
    setD((x) => ({
      ...x,
      title: occurrence.title,
      location: occurrence.location,
      startDate: event.allDay ? occurrence.startDate! : s.toISODate()!,
      startTime: s.toFormat('HH:mm'),
      endDate: event.allDay ? occurrence.endDate! : e.toISODate()!,
      endTime: e.toFormat('HH:mm'),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    if (d.allDay) return null;
    try {
      const local = DateTime.fromISO(`${d.startDate}T${d.startTime}`, { zone: d.timeZone });
      const mine = local.setZone(zoneOf(settings));
      return d.timeZone !== zoneOf(settings) ? `${mine.toFormat('ccc d LLL, HH:mm')} in your time zone (${zoneOf(settings)})` : null;
    } catch {
      return null;
    }
  }, [d, settings]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const input = toInput(d);
      if (!event) await api.calendar.create(input);
      else if (recurringOccurrence && scope !== 'all') {
        await api.calendar.updateOccurrence(event.id, occurrence!.occurrenceKey, { title: input.title, start: input.start, end: input.end, location: input.location, notes: input.notes }, scope);
        if (scope === 'following') {
          // Other fields apply to the new series as well; nothing more to do.
        }
      } else if (recurringOccurrence && scope === 'all') {
        const moved = input.start !== occurrence!.occurrenceKey;
        await api.calendar.update(event.id, { ...input, start: event.start, end: event.end });
        if (moved) await api.calendar.updateOccurrence(event.id, occurrence!.occurrenceKey, { start: input.start, end: input.end }, 'all');
      } else await api.calendar.update(event.id, input);
      invalidate('calendar');
      toast(event ? 'Event updated' : 'Event created', 'success');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: OccurrenceScope) => {
    if (!event) return;
    try {
      if (occurrence && event.recurrence) await api.calendar.deleteOccurrence(event.id, occurrence.occurrenceKey, s);
      else await api.calendar.delete(event.id);
      invalidate('calendar');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      wide
      title={event ? 'Edit event' : 'New event'}
      onClose={onClose}
      footer={
        <>
          {event ? (
            recurringOccurrence ? (
              <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => void remove(scope)}>
                Delete {scope === 'this' ? 'this occurrence' : scope === 'following' ? 'this and following' : 'all occurrences'}
              </Button>
            ) : (
              <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => void remove('all')}>
                Delete
              </Button>
            )
          ) : null}
          <span className="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!d.title.trim()} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="stack-4">
        <div className="row">
          <Input aria-label="Event title" placeholder="Event title" value={d.title} onChange={(e) => set('title', e.target.value)} autoFocus style={{ fontSize: '1.1rem', fontWeight: 600 }} />
          <Badge title="This event exists only in FlowCompanion on this computer.">Local</Badge>
        </div>
        {recurringOccurrence ? (
          <div className="row-wrap">
            <span className="small muted">Apply changes to:</span>
            {(['this', 'following', 'all'] as const).map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={scope === s} onClick={() => setScope(s)}>
                {s === 'this' ? 'This occurrence' : s === 'following' ? 'This and following' : 'All occurrences'}
              </button>
            ))}
          </div>
        ) : null}
        <Toggle checked={d.allDay} onChange={(v) => set('allDay', v)} label="All day" />
        <div className="field-row">
          <Field label="Starts" htmlFor="ev-sd">
            <div className="row">
              <input id="ev-sd" type="date" className="input" value={d.startDate} onChange={(e) => {
                const v = e.target.value;
                setD((x) => ({ ...x, startDate: v, endDate: x.endDate < v ? v : x.endDate }));
              }} />
              {!d.allDay ? <input aria-label="Start time" type="time" className="input" value={d.startTime} onChange={(e) => set('startTime', e.target.value)} /> : null}
            </div>
          </Field>
          <Field label="Ends" htmlFor="ev-ed">
            <div className="row">
              <input id="ev-ed" type="date" className="input" value={d.endDate} onChange={(e) => set('endDate', e.target.value)} />
              {!d.allDay ? <input aria-label="End time" type="time" className="input" value={d.endTime} onChange={(e) => set('endTime', e.target.value)} /> : null}
            </div>
          </Field>
          {!d.allDay ? (
            <Field label="Time zone" hint={summary ?? undefined} htmlFor="ev-tz">
              <Select id="ev-tz" value={d.timeZone} onChange={(e) => set('timeZone', e.target.value)}>
                {(zones.data ?? [d.timeZone]).map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>
        {!recurringOccurrence || scope === 'all' ? (
          <div className="card stack-3" style={{ background: 'var(--surface-2)' }}>
            <div className="field-row">
              <Field label="Repeat" htmlFor="ev-rep">
                <Select id="ev-rep" value={d.repeat} onChange={(e) => set('repeat', e.target.value as RepeatKind)}>
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly_day">Monthly on day {DateTime.fromISO(d.startDate).day}</option>
                  <option value="monthly_nth">
                    Monthly on the {(() => {
                      const n = nthOfMonth(DateTime.fromISO(d.startDate));
                      return n === -1 ? 'last' : ['', 'first', 'second', 'third', 'fourth'][n];
                    })()}{' '}
                    {DateTime.fromISO(d.startDate).toFormat('cccc')}
                  </option>
                  <option value="yearly">Yearly</option>
                </Select>
              </Field>
              {d.repeat !== 'none' ? (
                <Field label="Every" htmlFor="ev-int">
                  <Input id="ev-int" type="number" min={1} max={365} value={d.interval} onChange={(e) => set('interval', Number(e.target.value))} />
                </Field>
              ) : null}
              {d.repeat !== 'none' ? (
                <Field label="Ends" htmlFor="ev-ends">
                  <Select id="ev-ends" value={d.ends} onChange={(e) => set('ends', e.target.value as Draft['ends'])}>
                    <option value="never">Never</option>
                    <option value="count">After a number of times</option>
                    <option value="until">On a date</option>
                  </Select>
                </Field>
              ) : null}
              {d.repeat !== 'none' && d.ends === 'count' ? (
                <Field label="Times" htmlFor="ev-count">
                  <Input id="ev-count" type="number" min={1} max={1000} value={d.count} onChange={(e) => set('count', Number(e.target.value))} />
                </Field>
              ) : null}
              {d.repeat !== 'none' && d.ends === 'until' ? (
                <Field label="Until" htmlFor="ev-until">
                  <input id="ev-until" type="date" className="input" value={d.until} onChange={(e) => set('until', e.target.value)} />
                </Field>
              ) : null}
            </div>
            {d.repeat === 'weekly' ? (
              <div className="row-wrap" role="group" aria-label="Repeat on">
                {WEEKDAYS.map((w) => (
                  <button
                    key={w.d}
                    type="button"
                    className="chip"
                    aria-pressed={d.byWeekday.includes(w.d)}
                    onClick={() => set('byWeekday', d.byWeekday.includes(w.d) ? d.byWeekday.filter((x) => x !== w.d) : [...d.byWeekday, w.d])}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="field-row">
          <Field label="Location" htmlFor="ev-loc">
            <Input id="ev-loc" value={d.location} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="Meeting link" htmlFor="ev-url">
            <div className="row">
              <Input id="ev-url" placeholder="https://…" value={d.meetingUrl} onChange={(e) => set('meetingUrl', e.target.value)} />
              {d.meetingUrl.trim() ? (
                <IconButton label="Open meeting link" onClick={() => void api.app.openExternal(d.meetingUrl.trim())}>
                  <ExternalLink size={14} />
                </IconButton>
              ) : null}
            </div>
          </Field>
          <Field label="Category" htmlFor="ev-cat">
            <Select id="ev-cat" value={d.category} onChange={(e) => set('category', e.target.value)}>
              {['general', 'work', 'personal', 'study', 'health', 'social', 'travel'].map((c) => (
                <option key={c} value={c}>
                  {c[0]!.toUpperCase() + c.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Reminders" htmlFor="ev-rem">
          <div className="row-wrap" id="ev-rem">
            {REMINDER_CHOICES.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={d.reminders.includes(m)} onClick={() => set('reminders', d.reminders.includes(m) ? d.reminders.filter((x) => x !== m) : [...d.reminders, m].sort((a, b) => a - b))}>
                {reminderLabel(m)}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Notes" htmlFor="ev-notes">
          <Textarea id="ev-notes" rows={3} value={d.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <div className="stack-3">
          <div className="field-label">Checklist</div>
          {d.checklist.map((c) => (
            <div key={c.id} className="row">
              <input type="checkbox" checked={c.done} aria-label={c.text} onChange={(e) => set('checklist', d.checklist.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x)))} />
              <span className="grow" style={{ textDecoration: c.done ? 'line-through' : undefined }}>
                {c.text}
              </span>
              <IconButton label="Remove item" size="sm" onClick={() => set('checklist', d.checklist.filter((x) => x.id !== c.id))}>
                <X size={12} />
              </IconButton>
            </div>
          ))}
          <div className="row">
            <Input placeholder="Add a checklist item" aria-label="New checklist item" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter' && newItem.trim()) {
                e.preventDefault();
                set('checklist', [...d.checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]);
                setNewItem('');
              }
            }} />
            <IconButton label="Add item" onClick={() => {
              if (!newItem.trim()) return;
              set('checklist', [...d.checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]);
              setNewItem('');
            }}>
              <Plus size={14} />
            </IconButton>
          </div>
        </div>
        {event ? <LinksPanel type="event" id={event.id} /> : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </div>
    </Modal>
  );
}
