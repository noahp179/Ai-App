import { DateTime } from 'luxon';
import { ArrowLeft, CalendarPlus, ExternalLink, NotebookPen, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Weekday } from '../../../shared/types';
import { topicLabel } from '../../../shared/learning';
import { LinksPanel } from '../../components/LinksPanel';
import { Banner, Button, Field, Input, Loading, Modal, ErrorState, Segmented, Textarea, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { zoneOf } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { LEVEL_LABEL, REGISTRATION_LABEL, STATUS_LABEL, TYPE_LABEL, useLearningActions } from './common';

const DAYS: { d: Weekday; label: string }[] = [
  { d: 1, label: 'Mon' },
  { d: 2, label: 'Tue' },
  { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' },
  { d: 5, label: 'Fri' },
  { d: 6, label: 'Sat' },
  { d: 7, label: 'Sun' },
];

function ScheduleModal({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  const { settings } = useSettings();
  const toast = useToast();
  const zone = zoneOf(settings);
  const [date, setDate] = useState(() => DateTime.now().setZone(zone).plus({ days: 1 }).toISODate()!);
  const [time, setTime] = useState('17:00');
  const [minutes, setMinutes] = useState(45);
  const [days, setDays] = useState<Weekday[]>([]);
  const [weeks, setWeeks] = useState(4);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const start = DateTime.fromISO(`${date}T${time}`, { zone });
      if (!start.isValid) throw new Error('Choose a valid date and time.');
      const end = start.plus({ minutes });
      await api.learning.schedule(id, {
        start: start.toFormat("yyyy-LL-dd'T'HH:mm"),
        end: end.toFormat("yyyy-LL-dd'T'HH:mm"),
        timeZone: zone,
        recurrence: days.length ? { freq: 'weekly', interval: 1, byWeekday: days, count: days.length * weeks } : null,
      });
      invalidate('calendar');
      invalidate('links');
      toast('Study time added to your calendar', 'success');
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Schedule study time`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={() => void save()} icon={<CalendarPlus size={14} />}>
            Add to calendar
          </Button>
        </>
      }
    >
      <div className="stack-4">
        <p className="small muted">“Study: {title}” will be added to your local calendar.</p>
        <div className="field-row">
          <Field label="Date" htmlFor="ls-date">
            <input id="ls-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time" htmlFor="ls-time">
            <input id="ls-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Minutes" htmlFor="ls-min">
            <Input id="ls-min" type="number" min={5} max={480} step={5} value={minutes} onChange={(e) => setMinutes(Math.max(5, Math.min(480, Number(e.target.value) || 45)))} style={{ width: 100 }} />
          </Field>
        </div>
        <Field label="Repeat weekly on (optional)">
          <div className="row-wrap" style={{ gap: 4 }}>
            {DAYS.map(({ d, label }) => (
              <button key={d} type="button" className="chip" aria-pressed={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort())}>
                {label}
              </button>
            ))}
          </div>
        </Field>
        {days.length ? (
          <Field label="For how many weeks" htmlFor="ls-weeks">
            <Input id="ls-weeks" type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)))} style={{ width: 100 }} />
          </Field>
        ) : null}
        <p className="tiny faint">
          {settings.learning.studyReminderMinutes ? `You’ll get a reminder ${settings.learning.studyReminderMinutes} minutes before each session.` : 'You’ll get a reminder when each session starts.'} Change this in Settings → Learning.
        </p>
      </div>
    </Modal>
  );
}

function NotesEditor({ id, initial }: { id: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const latest = useRef(text);
  latest.current = text;
  useEffect(() => {
    if (text === initial) return;
    setState('dirty');
    const t = setTimeout(() => {
      setState('saving');
      api.learning
        .setNotes(id, latest.current)
        .then(() => setState('saved'))
        .catch(() => setState('error'));
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <div className="stack-2">
      <Textarea aria-label="Your notes on this resource" rows={6} value={text} placeholder="What did you learn? Questions to follow up?" onChange={(e) => setText(e.target.value)} />
      <span className="tiny faint" role="status" data-testid="learning-notes-status">
        {state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : state === 'dirty' ? 'Unsaved changes' : 'Could not save — check your disk space and try again.'}
      </span>
    </div>
  );
}

export function ResourceDetail({ id }: { id: string }) {
  const { settings } = useSettings();
  const toast = useToast();
  const act = useLearningActions();
  const q = useQuery(`learning:resource:${id}`, () => api.learning.resource(id));
  const all = useQuery('learning:resources:all', () => api.learning.resources());
  const [scheduling, setScheduling] = useState(false);
  if (q.error) return <ErrorState error={q.error} onRetry={() => navigate('/learning/library')} />;
  if (!q.data) return <Loading />;
  const r = q.data;
  const p = r.progress;
  const titleOf = (x: string) => all.data?.find((o) => o.id === x)?.title ?? null;
  const askAi = () => {
    const prompt = `I'm learning from "${r.title}" by ${r.publisher} (${r.url}). Topic: ${r.topics.map(topicLabel).join(', ')}. Help me check my understanding: ask me a few questions one at a time, and explain anything I get wrong.`;
    navigate(`/ai/new?prompt=${encodeURIComponent(prompt)}`);
  };
  const newNote = async () => {
    try {
      const n = await api.learning.createNote(r.id);
      invalidate('notes');
      navigate(`/notes/${n.id}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="stack-4">
      <div>
        <Button size="sm" variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => history.back()}>
          Back
        </Button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(320px, 1fr) minmax(240px, 320px)', alignItems: 'start' }}>
        <div className="stack-4">
          <div className="card stack-4">
            <div>
              <h1 style={{ fontSize: '1.4rem' }}>{r.title}</h1>
              <p className="muted" style={{ marginTop: 4 }}>
                {r.publisher}
              </p>
            </div>
            <p>{r.summary}</p>
            <div className="row-wrap">
              <Button variant="primary" icon={<ExternalLink size={14} />} onClick={() => void act.open(r.id)}>
                Open on {new URL(r.url).hostname.replace(/^www\./, '')}
              </Button>
              <Button onClick={() => void act.save(r.id, !p?.saved)} aria-pressed={!!p?.saved}>
                {p?.saved ? 'Saved' : 'Save'}
              </Button>
              <Button icon={<CalendarPlus size={14} />} onClick={() => setScheduling(true)}>
                Schedule study time
              </Button>
              <Button icon={<NotebookPen size={14} />} onClick={() => void newNote()}>
                New note
              </Button>
              {settings.layout.modules.ai ? (
                <Button icon={<Sparkles size={14} />} onClick={askAi}>
                  Quiz me with AI
                </Button>
              ) : null}
            </div>
            <Field label="Your progress">
              <Segmented
                label="Progress"
                value={p?.status ?? 'not_started'}
                onChange={(s) => void act.status(r.id, s)}
                options={(['not_started', 'in_progress', 'completed'] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              />
            </Field>
            {p?.lastOpenedAt ? <p className="tiny faint">Last opened {DateTime.fromISO(p.lastOpenedAt).toRelative()}. Opening a link doesn’t change your progress — you decide when it’s done.</p> : null}
          </div>
          <div className="card stack-3">
            <h3>Notes</h3>
            <NotesEditor key={r.id} id={r.id} initial={p?.notes ?? ''} />
          </div>
          <div className="card stack-3">
            <LinksPanel type="resource" id={r.id} />
          </div>
        </div>
        <div className="stack-4">
          <div className="card stack-3 small">
            <h3>About this resource</h3>
            <dl className="facts">
              <dt>Type</dt>
              <dd>{TYPE_LABEL[r.type]}</dd>
              <dt>Level</dt>
              <dd>{LEVEL_LABEL[r.level]}</dd>
              <dt>Cost</dt>
              <dd>Free to learn{r.paidExtras ? `. ${r.paidExtras}` : ''}</dd>
              <dt>Account</dt>
              <dd>{REGISTRATION_LABEL[r.registration]}</dd>
              <dt>Topics</dt>
              <dd>{r.topics.map(topicLabel).join(', ')}</dd>
              {r.prerequisites.length ? (
                <>
                  <dt>Helpful first</dt>
                  <dd>
                    {r.prerequisites.map((x, i) => {
                      const t = titleOf(x);
                      return (
                        <span key={x}>
                          {i ? ', ' : ''}
                          {t ? (
                            <button type="button" className="link-button" onClick={() => navigate(`/learning/resource/${x}`)}>
                              {t}
                            </button>
                          ) : (
                            x
                          )}
                        </span>
                      );
                    })}
                  </dd>
                </>
              ) : null}
              {r.accessibility ? (
                <>
                  <dt>Access</dt>
                  <dd>{r.accessibility}</dd>
                </>
              ) : null}
            </dl>
          </div>
          {r.linkCheck?.ok ? (
            <div className="row small muted" style={{ gap: 6 }}>
              <ShieldCheck size={14} color="var(--ok)" />
              Link checked on {r.linkCheck.checkedOn}.
            </div>
          ) : (
            <Banner tone="warn">
              <span className="row" style={{ gap: 6 }}>
                <TriangleAlert size={14} /> This link could not be verified automatically{r.linkCheck ? ` on ${r.linkCheck.checkedOn}` : ''}.
              </span>
            </Banner>
          )}
          <p className="tiny faint">
            FlowCompanion is not affiliated with {r.publisher}. Content, prices and sign-up rules are set by the publisher and may change. We don’t show ratings or time estimates because we can’t verify them.
          </p>
        </div>
      </div>
      {scheduling ? <ScheduleModal id={r.id} title={r.title} onClose={() => setScheduling(false)} /> : null}
    </div>
  );
}
