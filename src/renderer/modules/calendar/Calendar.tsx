import { DateTime } from 'luxon';
import { AlarmClock, BellRing, CalendarDays, Check, ChevronLeft, ChevronRight, Download, Plus, Repeat, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarEvent, EventOccurrence } from '../../../shared/types';
import { Badge, Button, EmptyState, IconButton, Input, Loading, Segmented, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtDateTime, hour12, zoneOf } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { EventEditor, newDraft } from './EventEditor';

type View = 'day' | 'week' | 'month' | 'agenda';
const HOUR_PX = 48;
const CATEGORY_COLOR: Record<string, string> = {
  general: 'var(--accent)',
  work: '#6aa8f7',
  personal: '#b083ff',
  study: '#4fc68f',
  health: '#f2757a',
  social: '#f0b44c',
  travel: '#3cc7b4',
};

interface Editing {
  event: CalendarEvent | null;
  occurrence: EventOccurrence | null;
  initial?: ReturnType<typeof newDraft>;
}

function useRange(view: View, anchor: DateTime, weekStartsOn: number) {
  return useMemo(() => {
    const startOfWeek = (d: DateTime) => {
      const offset = (d.weekday % 7) - (weekStartsOn % 7);
      return d.minus({ days: (offset + 7) % 7 }).startOf('day');
    };
    if (view === 'day') return { from: anchor.startOf('day'), to: anchor.startOf('day').plus({ days: 1 }) };
    if (view === 'week') {
      const s = startOfWeek(anchor);
      return { from: s, to: s.plus({ days: 7 }) };
    }
    if (view === 'month') {
      const s = startOfWeek(anchor.startOf('month'));
      return { from: s, to: s.plus({ days: 42 }) };
    }
    return { from: anchor.startOf('day'), to: anchor.startOf('day').plus({ days: 30 }) };
  }, [view, anchor, weekStartsOn]);
}

function EventChip({ o, onOpen, zone, h12 }: { o: EventOccurrence; onOpen: () => void; zone: string; h12: boolean | undefined }) {
  const color = CATEGORY_COLOR[o.category] ?? 'var(--accent)';
  return (
    <button
      type="button"
      className="ellipsis"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        border: 0,
        borderLeft: `3px solid ${color}`,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        color: 'var(--text)',
        borderRadius: 4,
        padding: '1px 5px',
        fontSize: '0.78rem',
        cursor: 'pointer',
      }}
      title={o.title}
    >
      {!o.allDay ? <span className="faint">{DateTime.fromISO(o.startUtc).setZone(zone).toLocaleString({ hour: 'numeric', minute: '2-digit', hour12: h12 })} </span> : null}
      {o.title}
    </button>
  );
}

function TimeGrid({ days, occ, zone, h12, dayStartHour, onOpen, onCreate }: { days: DateTime[]; occ: EventOccurrence[]; zone: string; h12: boolean | undefined; dayStartHour: number; onOpen: (o: EventOccurrence) => void; onCreate: (at: DateTime, allDay?: boolean) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(DateTime.now().setZone(zone));
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = dayStartHour * HOUR_PX;
  }, [dayStartHour]);
  useEffect(() => {
    const t = setInterval(() => setNow(DateTime.now().setZone(zone)), 60_000);
    return () => clearInterval(t);
  }, [zone]);
  const cols = `56px repeat(${days.length}, 1fr)`;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--border)' }}>
        <div />
        {days.map((d) => (
          <div key={d.toISODate()} style={{ padding: '6px 8px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
            <div className="tiny faint">{d.toFormat('ccc')}</div>
            <div style={{ fontWeight: 650, color: d.hasSame(now, 'day') ? 'var(--accent)' : undefined }}>{d.day}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--border)', minHeight: 26 }}>
        <div className="tiny faint" style={{ padding: 4 }}>all-day</div>
        {days.map((d) => {
          const items = occ.filter((o) => o.allDay && o.startDate! <= d.toISODate()! && o.endDate! >= d.toISODate()!);
          return (
            <div key={d.toISODate()} style={{ borderLeft: '1px solid var(--border)', padding: 2, display: 'flex', flexDirection: 'column', gap: 2 }} onDoubleClick={() => onCreate(d, true)}>
              {items.map((o) => (
                <EventChip key={`${o.eventId}:${o.occurrenceKey}`} o={o} zone={zone} h12={h12} onOpen={() => onOpen(o)} />
              ))}
            </div>
          );
        })}
      </div>
      <div ref={scroller} style={{ maxHeight: 'calc(100vh - 290px)', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, position: 'relative' }}>
          <div>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="tiny faint" style={{ height: HOUR_PX, textAlign: 'right', paddingRight: 6, transform: 'translateY(-6px)' }}>
                {h === 0 ? '' : DateTime.fromObject({ hour: h }).toLocaleString({ hour: 'numeric', hour12: h12 })}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const dayStart = d.startOf('day');
            const dayEnd = dayStart.plus({ days: 1 });
            const items = occ
              .filter((o) => !o.allDay)
              .map((o) => ({ o, s: DateTime.fromISO(o.startUtc).setZone(zone), e: DateTime.fromISO(o.endUtc).setZone(zone) }))
              .filter(({ s, e }) => s < dayEnd && (e > dayStart || +e === +s));
            // Simple overlap layout: assign columns greedily.
            const lanes: DateTime[] = [];
            const placed = items.map((it) => {
              let lane = lanes.findIndex((end) => end <= it.s);
              if (lane < 0) {
                lane = lanes.length;
                lanes.push(it.e);
              } else lanes[lane] = it.e;
              return { ...it, lane };
            });
            const laneCount = Math.max(1, lanes.length);
            return (
              <div
                key={d.toISODate()}
                style={{ position: 'relative', borderLeft: '1px solid var(--border)', height: HOUR_PX * 24, backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${HOUR_PX}px)` }}
                onClick={(e) => {
                  const y = e.nativeEvent.offsetY;
                  const minutes = Math.floor(y / HOUR_PX / 0.25) * 15;
                  onCreate(dayStart.plus({ minutes }));
                }}
                aria-label={`${d.toFormat('cccc d LLLL')}. Click to add an event.`}
              >
                {d.hasSame(now, 'day') ? <div style={{ position: 'absolute', left: 0, right: 0, top: ((now.hour * 60 + now.minute) / 60) * HOUR_PX, borderTop: '2px solid var(--danger)', zIndex: 2 }} aria-hidden /> : null}
                {placed.map(({ o, s, e, lane }) => {
                  const top = Math.max(0, s < dayStart ? 0 : (s.diff(dayStart, 'minutes').minutes / 60) * HOUR_PX);
                  const bottom = Math.min(HOUR_PX * 24, e > dayEnd ? HOUR_PX * 24 : (e.diff(dayStart, 'minutes').minutes / 60) * HOUR_PX);
                  const color = CATEGORY_COLOR[o.category] ?? 'var(--accent)';
                  return (
                    <button
                      key={`${o.eventId}:${o.occurrenceKey}`}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onOpen(o);
                      }}
                      style={{
                        position: 'absolute',
                        top,
                        height: Math.max(18, bottom - top - 2),
                        left: `calc(${(lane / laneCount) * 100}% + 2px)`,
                        width: `calc(${100 / laneCount}% - 4px)`,
                        border: 0,
                        borderLeft: `3px solid ${color}`,
                        background: `color-mix(in srgb, ${color} 22%, var(--surface))`,
                        color: 'var(--text)',
                        borderRadius: 6,
                        padding: '2px 6px',
                        textAlign: 'left',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        zIndex: 1,
                      }}
                      title={`${o.title} · ${s.toLocaleString(DateTime.TIME_SIMPLE)}–${e.toLocaleString(DateTime.TIME_SIMPLE)}`}
                    >
                      <div style={{ fontWeight: 600 }} className="ellipsis">
                        {o.recurring ? <Repeat size={10} style={{ marginRight: 3 }} /> : null}
                        {o.title}
                      </div>
                      <div className="faint ellipsis">
                        {s.toLocaleString({ hour: 'numeric', minute: '2-digit', hour12: h12 })}–{e.toLocaleString({ hour: 'numeric', minute: '2-digit', hour12: h12 })}
                        {o.location ? ` · ${o.location}` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ from, anchor, occ, zone, h12, onOpen, onDay }: { from: DateTime; anchor: DateTime; occ: EventOccurrence[]; zone: string; h12: boolean | undefined; onOpen: (o: EventOccurrence) => void; onDay: (d: DateTime) => void }) {
  const days = Array.from({ length: 42 }, (_, i) => from.plus({ days: i }));
  const today = DateTime.now().setZone(zone);
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.slice(0, 7).map((d) => (
          <div key={d.toISODate()} className="tiny faint" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
            {d.toFormat('ccc')}
          </div>
        ))}
        {days.map((d) => {
          const iso = d.toISODate()!;
          const items = occ.filter((o) => (o.allDay ? o.startDate! <= iso && o.endDate! >= iso : DateTime.fromISO(o.startUtc).setZone(zone).toISODate() === iso));
          const inMonth = d.month === anchor.month;
          return (
            <div key={iso} style={{ minHeight: 104, padding: 4, borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)', opacity: inMonth ? 1 : 0.5 }}>
              <button type="button" className="btn ghost sm" onClick={() => onDay(d)} style={{ padding: '0 6px', fontWeight: 650, color: d.hasSame(today, 'day') ? 'var(--accent)' : undefined }} aria-label={d.toFormat('cccc d LLLL')}>
                {d.day}
              </button>
              <div className="col" style={{ gap: 2 }}>
                {items.slice(0, 3).map((o) => (
                  <EventChip key={`${o.eventId}:${o.occurrenceKey}`} o={o} zone={zone} h12={h12} onOpen={() => onOpen(o)} />
                ))}
                {items.length > 3 ? (
                  <button type="button" className="tiny faint" style={{ border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => onDay(d)}>
                    +{items.length - 3} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Agenda({ occ, zone, h12, onOpen }: { occ: EventOccurrence[]; zone: string; h12: boolean | undefined; onOpen: (o: EventOccurrence) => void }) {
  const groups = new Map<string, EventOccurrence[]>();
  for (const o of occ) {
    const key = o.allDay ? o.startDate! : DateTime.fromISO(o.startUtc).setZone(zone).toISODate()!;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  if (occ.length === 0) return <EmptyState title="Nothing scheduled in the next 30 days" icon={<CalendarDays size={28} />} />;
  return (
    <div className="stack-4">
      {[...groups].map(([day, items]) => (
        <div key={day}>
          <h3 style={{ marginBottom: 6 }}>{DateTime.fromISO(day).toFormat('cccc, d LLLL')}</h3>
          <div className="col" style={{ gap: 4 }}>
            {items.map((o) => (
              <button key={`${o.eventId}:${o.occurrenceKey}`} type="button" className="list-item card" onClick={() => onOpen(o)} style={{ padding: '8px 12px' }}>
                <span className="nowrap muted small" style={{ width: 120 }}>
                  {o.allDay ? 'All day' : `${DateTime.fromISO(o.startUtc).setZone(zone).toLocaleString({ hour: 'numeric', minute: '2-digit', hour12: h12 })} – ${DateTime.fromISO(o.endUtc).setZone(zone).toLocaleString({ hour: 'numeric', minute: '2-digit', hour12: h12 })}`}
                </span>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: CATEGORY_COLOR[o.category] ?? 'var(--accent)', flex: 'none' }} />
                <span className="grow ellipsis">{o.title}</span>
                {o.recurring ? <Repeat size={12} className="faint" /> : null}
                {o.location ? <span className="small faint ellipsis" style={{ maxWidth: 200 }}>{o.location}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RemindersPanel() {
  const { settings } = useSettings();
  const toast = useToast();
  const list = useQuery('reminders:list', () => api.reminders.list(false));
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(() => DateTime.now().plus({ hours: 1 }).startOf('hour').toFormat("yyyy-LL-dd'T'HH:mm"));
  const run = async (p: Promise<unknown>) => {
    try {
      await p;
      invalidate('reminders', 'calendar');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  return (
    <div className="stack-4">
      <form
        className="card row-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          void run(api.reminders.create({ title, fireAt: new Date(when).toISOString() }));
          setTitle('');
        }}
      >
        <Input placeholder="Remind me to…" aria-label="Reminder" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <input type="datetime-local" className="input" aria-label="When" value={when} onChange={(e) => setWhen(e.target.value)} style={{ width: 220 }} />
        <Button type="submit" variant="primary" icon={<AlarmClock size={14} />} disabled={!title.trim()}>
          Add reminder
        </Button>
      </form>
      {!list.data ? <Loading /> : null}
      {list.data?.length === 0 ? <EmptyState title="No open reminders" icon={<BellRing size={28} />}>Reminders fire as notifications, even after a restart. Quiet hours hold banners back.</EmptyState> : null}
      <div className="stack-3">
        {list.data?.map((r) => {
          const at = r.snoozedUntil ?? r.fireAt;
          const past = new Date(at) < new Date();
          return (
            <div key={r.id} className="card row">
              <div className="grow">
                <div style={{ fontWeight: 560 }}>{r.title}</div>
                <div className={`small ${past ? 'warn-text' : 'faint'}`}>
                  {fmtDateTime(at, settings)}
                  {r.snoozedUntil ? ' (snoozed)' : ''}
                  {past ? ' · overdue' : ''}
                </div>
              </div>
              <Button size="sm" onClick={() => void run(api.reminders.snooze(r.id, settings.notifications.snoozeMinutes))}>
                Snooze {settings.notifications.snoozeMinutes} min
              </Button>
              <IconButton label="Mark done" onClick={() => void run(api.reminders.complete(r.id))}>
                <Check size={15} />
              </IconButton>
              <IconButton label="Delete" onClick={() => void run(api.reminders.delete(r.id))}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Calendar() {
  const { settings } = useSettings();
  const toast = useToast();
  const route = useRoute();
  const zone = zoneOf(settings);
  const h12 = hour12(settings);
  const [view, setView] = useState<View>(settings.calendar.defaultView);
  const [anchor, setAnchor] = useState<DateTime>(() => DateTime.now().setZone(zone));
  const [editing, setEditing] = useState<Editing | null>(null);
  const { from, to } = useRange(view, anchor, settings.calendar.weekStartsOn);
  const occ = useQuery(`calendar:occ:${from.toISO()}:${to.toISO()}`, () => api.calendar.occurrences(from.toUTC().toISO()!, to.toUTC().toISO()!));
  const tab = route.segments[1] === 'reminders' ? 'reminders' : 'calendar';

  // Open an event linked from elsewhere (?event=id).
  useEffect(() => {
    const id = route.params.get('event');
    if (!id) return;
    api.calendar
      .get(id)
      .then((ev) => setEditing({ event: ev, occurrence: null }))
      .catch(() => toast('That event no longer exists.', 'error'))
      .finally(() => navigate('/calendar', { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.get('event')]);

  const open = async (o: EventOccurrence) => {
    try {
      const ev = await api.calendar.get(o.eventId);
      setEditing({ event: ev, occurrence: o });
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const create = (at: DateTime, allDay = false) =>
    setEditing({ event: null, occurrence: null, initial: newDraft(at, zone, settings.calendar.defaultDurationMinutes, settings.notifications.defaultReminderMinutes, allDay) });
  const step = (dir: 1 | -1) => setAnchor((a) => (view === 'day' ? a.plus({ days: dir }) : view === 'week' ? a.plus({ weeks: dir }) : view === 'month' ? a.plus({ months: dir }) : a.plus({ days: 30 * dir })));
  const title = view === 'month' ? anchor.toFormat('LLLL yyyy') : view === 'day' ? anchor.toFormat('cccc, d LLLL yyyy') : view === 'week' ? `${from.toFormat('d LLL')} – ${to.minus({ days: 1 }).toFormat('d LLL yyyy')}` : `Next 30 days from ${anchor.toFormat('d LLL')}`;

  return (
    <div className="page-wide stack-4">
      <div className="row-wrap">
        <Segmented
          label="Section"
          value={tab}
          options={[
            { value: 'calendar', label: 'Calendar' },
            { value: 'reminders', label: 'Reminders' },
          ]}
          onChange={(v) => navigate(v === 'reminders' ? '/calendar/reminders' : '/calendar')}
        />
        {tab === 'calendar' ? (
          <>
            <Button size="sm" onClick={() => setAnchor(DateTime.now().setZone(zone))}>
              Today
            </Button>
            <IconButton label="Previous" onClick={() => step(-1)}>
              <ChevronLeft size={16} />
            </IconButton>
            <IconButton label="Next" onClick={() => step(1)}>
              <ChevronRight size={16} />
            </IconButton>
            <h2 className="grow" style={{ fontSize: '1.1rem' }}>
              {title}
            </h2>
            <Segmented
              label="View"
              value={view}
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
                { value: 'agenda', label: 'Agenda' },
              ]}
              onChange={setView}
            />
            <IconButton
              label="Export calendar (.ics)"
              onClick={() => void api.calendar.exportIcs().then((r) => r.saved && toast(`Exported to ${r.path}`, 'success'))}
            >
              <Download size={16} />
            </IconButton>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => create(DateTime.now().setZone(zone).startOf('hour').plus({ hours: 1 }))}>
              New event
            </Button>
          </>
        ) : null}
      </div>
      {tab === 'reminders' ? (
        <RemindersPanel />
      ) : (
        <>
          <div className="row small faint">
            <Badge>Local calendar</Badge>
            <span>Events are stored on this computer in {zone}. External calendars (Google, Outlook, CalDAV) are not connected.</span>
          </div>
          {!occ.data ? (
            <Loading />
          ) : view === 'month' ? (
            <MonthGrid from={from} anchor={anchor} occ={occ.data} zone={zone} h12={h12} onOpen={(o) => void open(o)} onDay={(d) => (setAnchor(d), setView('day'))} />
          ) : view === 'agenda' ? (
            <Agenda occ={occ.data} zone={zone} h12={h12} onOpen={(o) => void open(o)} />
          ) : (
            <TimeGrid
              days={Array.from({ length: view === 'day' ? 1 : 7 }, (_, i) => from.plus({ days: i }))}
              occ={occ.data}
              zone={zone}
              h12={h12}
              dayStartHour={settings.calendar.dayStartHour}
              onOpen={(o) => void open(o)}
              onCreate={create}
            />
          )}
        </>
      )}
      {editing ? <EventEditor event={editing.event} occurrence={editing.occurrence} initial={editing.initial} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
