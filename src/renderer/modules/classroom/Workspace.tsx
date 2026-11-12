import { BookOpen, Clock, Send, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react';
import type { AttemptDto, ChatMessageDto, ChatStreamEvent, Response, StudentItemDto } from '../../../shared/classroom/protocol';
import { isAnswered, promptText } from '../../../shared/classroom/items';
import { ClassroomError } from '../../../shared/classroom/transport';
import { Banner, Button, Modal, Select, Textarea, useConfirm } from '../../components/ui';
import { AnswerInput, initial } from '../study/QuestionCard';
import { Blocks } from '../study/render';
import { ErrorNote, Loaded, fmtTime, remaining } from './common';
import { useClassroom, useGet, useTransport } from './context';

type EventKind = 'paste_blocked' | 'copy_blocked' | 'drop_blocked' | 'focus_lost' | 'large_insert';
interface PendingEvent {
  kind: EventKind;
  itemId: string | null;
  at: string;
  detail: { how?: string; chars?: number; ms?: number; where?: string };
}

const SAVE_DELAY = 1500;
const backupKey = (id: string) => `fc-classroom-unsaved-${id}`;
function readBackup(id: string): Record<string, Response> {
  try {
    return JSON.parse(localStorage.getItem(backupKey(id)) ?? '{}') as Record<string, Response>;
  } catch {
    return {};
  }
}
function writeBackup(id: string, v: Record<string, Response> | null) {
  try {
    if (v && Object.keys(v).length) localStorage.setItem(backupKey(id), JSON.stringify(v));
    else localStorage.removeItem(backupKey(id));
  } catch {
    /* storage can be unavailable; the server copy is the real one */
  }
}

const eventsKey = (id: string) => `fc-classroom-events-${id}`;
function readEvents(id: string): PendingEvent[] {
  try {
    return JSON.parse(localStorage.getItem(eventsKey(id)) ?? '[]') as PendingEvent[];
  } catch {
    return [];
  }
}
function writeEvents(id: string, v: PendingEvent[]) {
  try {
    if (v.length) localStorage.setItem(eventsKey(id), JSON.stringify(v.slice(-500)));
    else localStorage.removeItem(eventsKey(id));
  } catch {
    /* storage can be unavailable */
  }
}

export function Workspace({ attemptId }: { attemptId: string }) {
  const q = useGet<AttemptDto>(`/attempts/${attemptId}`);
  return <Loaded q={q}>{(a) => (a.status === 'submitted' ? <Submitted a={a} /> : <Work a={a} />)}</Loaded>;
}

function Submitted({ a, receipt }: { a: AttemptDto; receipt?: { reference: string | null; submittedAt: string | null; autoSubmitted: boolean } }) {
  const { go } = useClassroom();
  const r = receipt ?? { reference: a.reference, submittedAt: a.submittedAt, autoSubmitted: a.autoSubmitted };
  return (
    <div className="stack-4" style={{ maxWidth: 640 }}>
      <h1>{a.title}</h1>
      <Banner tone="ok" title={r.autoSubmitted ? 'Time was up, so your work was submitted' : 'Submitted'}>
        <div className="stack-1">
          <span>Your answers were received{r.submittedAt ? ` at ${new Date(r.submittedAt).toLocaleString()}` : ''}.</span>
          {r.reference ? <span>Receipt: <strong>{r.reference}</strong></span> : null}
        </div>
      </Banner>
      <div className="row-wrap">
        <Button variant="primary" onClick={() => go({ v: 'class', id: a.classId })}>
          Back to the class
        </Button>
        {a.settings.showResults === 'immediately' ? <Button onClick={() => go({ v: 'result', attemptId: a.id })}>See results</Button> : null}
      </div>
    </div>
  );
}

function Work({ a }: { a: AttemptDto }) {
  const t = useTransport();
  const confirm = useConfirm();
  const st = a.settings;
  const acc = a.accommodation;
  const blockPaste = st.blockPaste && !acc.pasteAllowed;

  // ── Answers and autosave ──
  const [responses, setResponses] = useState<Record<string, Response>>(() => ({ ...a.responses, ...readBackup(a.id) }));
  const dirty = useRef<Record<string, Response>>(readBackup(a.id));
  const seconds = useRef<Record<string, number>>({});
  const [save, setSave] = useState<{ state: 'saved' | 'saving' | 'offline' | 'error'; at: string | null; message?: string }>({ state: 'saved', at: null });
  const [submitted, setSubmitted] = useState<{ reference: string | null; submittedAt: string | null; autoSubmitted: boolean } | null>(null);
  const saving = useRef(false);
  const flush = useCallback(async (): Promise<boolean> => {
    if (saving.current) return false;
    const changed = dirty.current;
    const secs = seconds.current;
    if (!Object.keys(changed).length && !Object.keys(secs).length) return true;
    saving.current = true;
    dirty.current = {};
    seconds.current = {};
    setSave((s) => ({ ...s, state: 'saving' }));
    try {
      await t.request('PUT', `/attempts/${a.id}/responses`, { responses: changed, seconds: Object.fromEntries(Object.entries(secs).map(([k, v]) => [k, Math.min(3600, Math.round(v))])) });
      writeBackup(a.id, Object.keys(dirty.current).length ? dirty.current : null);
      setSave({ state: 'saved', at: new Date().toISOString() });
      return true;
    } catch (e) {
      // Keep what was not saved, so the next try sends it (and a reload finds it in this browser).
      dirty.current = { ...changed, ...dirty.current };
      for (const [k, v] of Object.entries(secs)) seconds.current[k] = (seconds.current[k] ?? 0) + v;
      writeBackup(a.id, dirty.current);
      const err = e instanceof ClassroomError ? e : null;
      if (err && (err.code === 'submitted' || err.code === 'time_up' || err.code === 'closed')) setSubmitted({ reference: null, submittedAt: null, autoSubmitted: true });
      setSave({ state: err?.status === 0 ? 'offline' : 'error', at: null, message: err?.message });
      return false;
    } finally {
      saving.current = false;
    }
  }, [a.id, t]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setResp = (itemId: string, r: Response) => {
    setResponses((p) => ({ ...p, [itemId]: r }));
    dirty.current = { ...dirty.current, [itemId]: r };
    writeBackup(a.id, dirty.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY);
  };
  useEffect(() => {
    const every = setInterval(() => void flush(), 15_000);
    const online = () => void flush();
    window.addEventListener('online', online);
    return () => {
      clearInterval(every);
      window.removeEventListener('online', online);
      void flush();
    };
  }, [flush]);

  // ── Activity the student was told about ──
  // Sent within a second, and kept in this browser until the server has them, so closing or reloading the page
  // does not lose them (they are sent on the next visit).
  const events = useRef<PendingEvent[]>(readEvents(a.id));
  const sendEvents = useCallback(async () => {
    if (!events.current.length) return;
    const batch = events.current.splice(0, 100);
    try {
      await t.request('POST', `/attempts/${a.id}/events`, { events: batch });
    } catch {
      events.current.unshift(...batch);
    }
    writeEvents(a.id, events.current);
  }, [a.id, t]);
  const sendSoon = useRef<ReturnType<typeof setTimeout> | null>(null);
  const record = useCallback(
    (kind: EventKind, itemId: string | null, detail: PendingEvent['detail'] = {}) => {
      events.current.push({ kind, itemId, at: new Date().toISOString(), detail });
      writeEvents(a.id, events.current);
      if (sendSoon.current) clearTimeout(sendSoon.current);
      sendSoon.current = setTimeout(() => void sendEvents(), 1000);
    },
    [a.id, sendEvents],
  );
  useEffect(() => {
    void sendEvents();
    const every = setInterval(() => void sendEvents(), 10_000);
    return () => {
      clearInterval(every);
      void sendEvents();
    };
  }, [sendEvents]);
  const current = useRef<string | null>(null);
  useEffect(() => {
    if (!st.logFocus) return;
    let leftAt: number | null = null;
    const away = () => {
      if (leftAt === null) leftAt = Date.now();
    };
    const back = () => {
      if (leftAt === null) return;
      const ms = Date.now() - leftAt;
      leftAt = null;
      if (ms >= 2000) record('focus_lost', current.current, { ms });
    };
    const vis = () => (document.hidden ? away() : back());
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('blur', away);
    window.addEventListener('focus', back);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('blur', away);
      window.removeEventListener('focus', back);
    };
  }, [st.logFocus, record]);
  // In the desktop app the whole app refuses to copy while the assessment is open.
  useEffect(() => {
    void t.setAssessmentLock?.(true);
    return () => void t.setAssessmentLock?.(false);
  }, [t]);

  // ── Time ──
  const offset = useRef(Date.parse(a.serverNow) - Date.now());
  const deadline = a.deadline ? Date.parse(a.deadline) : null;
  const [now, setNow] = useState(() => Date.now() + offset.current);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(i);
  }, []);
  const left = deadline ? deadline - now : null;
  const warned = useRef<Set<number>>(new Set());
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    if (left === null) return;
    for (const m of [10, 5, 1])
      if (left <= m * 60_000 && left > 0 && !warned.current.has(m)) {
        warned.current.add(m);
        setAnnounce(`${m} minute${m === 1 ? '' : 's'} left.`);
      }
  }, [left]);

  // ── Navigation and time per question ──
  const [index, setIndex] = useState(0);
  const items = a.items;
  const shown = st.layout === 'one' ? [items[index]!] : items;
  const lastTick = useRef(Date.now());
  useEffect(() => {
    const i = setInterval(() => {
      const n = Date.now();
      if (current.current && !document.hidden) seconds.current[current.current] = (seconds.current[current.current] ?? 0) + (n - lastTick.current) / 1000;
      lastTick.current = n;
    }, 5000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    if (st.layout === 'one') current.current = items[index]?.id ?? null;
  }, [index, items, st.layout]);

  // ── Submit ──
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submit = useCallback(
    async (auto: boolean) => {
      setSubmitting(true);
      setSubmitError(null);
      await flush();
      await sendEvents();
      try {
        const r = await t.request<{ reference: string | null; submittedAt: string | null; autoSubmitted: boolean }>('POST', `/attempts/${a.id}/submit`);
        writeBackup(a.id, null);
        void t.setAssessmentLock?.(false);
        setSubmitted({ ...r, autoSubmitted: r.autoSubmitted || auto });
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : String(e));
      } finally {
        setSubmitting(false);
      }
    },
    [a.id, flush, sendEvents, t],
  );
  const autoDone = useRef(false);
  useEffect(() => {
    if (left !== null && left <= 0 && !autoDone.current) {
      autoDone.current = true;
      void submit(true);
    }
  }, [left, submit]);
  const askSubmit = async () => {
    const unanswered = items.filter((it) => !isAnswered(responses[it.id])).length;
    if (
      await confirm({
        title: 'Submit your answers?',
        message: unanswered ? `${unanswered} question${unanswered === 1 ? ' is' : 's are'} not answered. You cannot change your answers after submitting.` : 'You cannot change your answers after submitting.',
        confirmLabel: 'Submit',
      })
    )
      await submit(false);
  };

  // ── Paste, drop and large inserts in answers ──
  const onPaste = (itemId: string) => (e: ClipboardEvent) => {
    if (!blockPaste) return;
    e.preventDefault();
    record('paste_blocked', itemId, { chars: e.clipboardData.getData('text').length });
    setNotice('Pasting is turned off in this assessment. Type your answer in your own words.');
  };
  const onDrop = (itemId: string) => (e: DragEvent) => {
    if (!blockPaste) return;
    e.preventDefault();
    record('drop_blocked', itemId, {});
  };
  const lengths = useRef<Record<string, number>>({});
  const onWritten = (itemId: string, text: string, inputType: string) => {
    const before = lengths.current[itemId] ?? (responses[itemId] && 'text' in responses[itemId]! ? (responses[itemId] as { text: string }).text.length : 0);
    lengths.current[itemId] = text.length;
    const grew = text.length - before;
    if (st.largeInsertSignal && grew >= st.largeInsertChars && !(acc.pasteAllowed && inputType === 'insertFromPaste')) record('large_insert', itemId, { chars: grew, how: inputType || 'unknown' });
    setResp(itemId, { type: 'written', text });
  };
  const onCopyBlocked = (where: string) => (e: ClipboardEvent) => {
    if (!st.blockPaste) return;
    e.preventDefault();
    record('copy_blocked', null, { where });
    setNotice('Copying is turned off in this assessment.');
  };
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const i = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(i);
  }, [notice]);

  const speak = (it: StudentItemDto) => {
    try {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(promptText(it.question)));
    } catch {
      setNotice('Reading aloud is not available on this device.');
    }
  };

  if (submitted) return <Submitted a={a} receipt={submitted} />;

  const answered = items.filter((it) => isAnswered(responses[it.id])).length;
  return (
    <div className={`workspace ${acc.largerText ? 'larger-text' : ''} ${st.aiMode === 'off' ? 'no-ai' : ''}`}>
      <header className="workspace-bar row-wrap">
        <h1 className="grow">{a.title}</h1>
        <span className="small muted" aria-live="polite">
          {save.state === 'saving' ? 'Saving…' : save.state === 'saved' ? (save.at ? `Saved ${fmtTime(save.at)}` : 'All changes saved') : save.state === 'offline' ? 'Offline: your answers are kept here and will save when you reconnect' : `Not saved: ${save.message ?? 'try again'}`}
        </span>
        {left !== null ? (
          <span className={`timer ${left < 5 * 60_000 ? 'low' : ''}`} role="timer" aria-label={remaining(left)}>
            <Clock size={15} aria-hidden /> {remaining(left)}
          </span>
        ) : null}
        <Button variant="primary" onClick={askSubmit} loading={submitting}>
          Submit
        </Button>
      </header>
      <div className="sr-only" aria-live="assertive">
        {announce}
      </div>
      {notice ? (
        <div role="status" className="workspace-notice">
          {notice}
        </div>
      ) : null}
      <ErrorNote error={submitError} />
      <div className="workspace-panes">
        {st.aiMode !== 'off' ? <ChatPane a={a} responses={responses} onCopy={onCopyBlocked('assistant')} /> : null}
        <section className="answers-pane stack-3" aria-label="Your answers" onCopy={st.blockPaste ? (e) => {
          // Copying inside your own answer is fine; copying the questions is not.
          if ((e.target as HTMLElement).closest('textarea, input')) return;
          onCopyBlocked('question')(e);
        } : undefined}>
          {a.instructions ? <p className="small muted">{a.instructions}</p> : null}
          {st.layout === 'one' ? (
            <nav className="question-nav row-wrap" aria-label="Questions">
              {items.map((it, i) => (
                <button key={it.id} type="button" className={`qnav ${i === index ? 'current' : ''} ${isAnswered(responses[it.id]) ? 'done' : ''}`} aria-current={i === index ? 'step' : undefined} aria-label={`Question ${i + 1}${isAnswered(responses[it.id]) ? ', answered' : ''}`} onClick={() => setIndex(i)}>
                  {i + 1}
                </button>
              ))}
              <span className="small muted">
                {answered} of {items.length} answered
              </span>
            </nav>
          ) : null}
          {shown.map((it) => (
            <article key={it.id} className="card stack-2 question" aria-labelledby={`q-${it.id}`} onFocusCapture={() => (current.current = it.id)}>
              <div className="row">
                <h2 className="h2 grow" id={`q-${it.id}`}>
                  Question {it.position} <span className="small muted">({it.points} {it.points === 1 ? 'point' : 'points'})</span>
                </h2>
                {acc.textToSpeech ? (
                  <Button size="sm" variant="ghost" icon={<Volume2 size={14} />} onClick={() => speak(it)}>
                    Read aloud
                  </Button>
                ) : null}
              </div>
              <Blocks blocks={it.question.prompt} />
              {it.question.hints.length ? (
                <details className="small">
                  <summary>Hint</summary>
                  <ul>
                    {it.question.hints.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <div onPasteCapture={onPaste(it.id)} onDropCapture={onDrop(it.id)}>
                {it.question.type === 'written' ? (
                  <WrittenAnswer it={it} value={responses[it.id]?.type === 'written' ? (responses[it.id] as { text: string }).text : ''} onChange={(text, how) => onWritten(it.id, text, how)} />
                ) : (
                  <AnswerInput q={it.question} resp={responses[it.id] ?? initial(it.question)} setResp={(r) => setResp(it.id, r)} disabled={false} onEnter={() => undefined} />
                )}
              </div>
            </article>
          ))}
          {st.layout === 'one' ? (
            <div className="row">
              <Button disabled={index === 0} onClick={() => setIndex(index - 1)}>
                Previous
              </Button>
              <span className="grow" />
              {index < items.length - 1 ? (
                <Button variant="primary" onClick={() => setIndex(index + 1)}>
                  Next question
                </Button>
              ) : (
                <Button variant="primary" onClick={askSubmit} loading={submitting}>
                  Submit
                </Button>
              )}
            </div>
          ) : (
            <div>
              <Button variant="primary" onClick={askSubmit} loading={submitting}>
                Submit
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function WrittenAnswer({ it, value, onChange }: { it: StudentItemDto; value: string; onChange: (text: string, how: string) => void }) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const min = it.question.type === 'written' ? (it.question.minWords ?? 0) : 0;
  return (
    <div className="stack-1">
      <Textarea
        aria-label={`Your answer to question ${it.position}`}
        aria-describedby={`wc-${it.id}`}
        rows={it.long ? 14 : 6}
        value={value}
        spellCheck
        onChange={(e) => onChange(e.target.value, (e.nativeEvent as InputEvent).inputType ?? '')}
      />
      <span id={`wc-${it.id}`} className="tiny faint">
        {words} word{words === 1 ? '' : 's'}
        {min ? ` · at least ${min} expected` : ''}
      </span>
    </div>
  );
}

function ChatPane({ a, responses, onCopy }: { a: AttemptDto; responses: Record<string, Response>; onCopy: (e: ClipboardEvent) => void }) {
  const t = useTransport();
  const history = useGet<ChatMessageDto[]>(`/attempts/${a.id}/chat`);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [text, setText] = useState('');
  const [draftFor, setDraftFor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState(a.messagesUsed);
  const [page, setPage] = useState<{ materialId: string; name: string; page: number; pages: number; text: string } | null>(null);
  const list = useRef<HTMLOListElement>(null);
  // The history can arrive after a reply has started streaming; what streamed here is newer, so it wins.
  useEffect(() => {
    const h = history.data;
    if (!h) return;
    setMessages((cur) => {
      const local = new Map(cur.map((m) => [m.id, m]));
      return [...h.map((m) => local.get(m.id) ?? m), ...cur.filter((m) => !h.some((x) => x.id === m.id))];
    });
  }, [history.data]);
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }, [messages]);
  const limit = a.settings.messageLimit;
  const writtenItems = a.items.filter((it) => it.question.type === 'written');
  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = { text: text.trim(), draftForItem: draftFor || null };
    if (!body.text || busy) return;
    setBusy(true);
    setError(null);
    let assistantId: string | null = null;
    try {
      await t.stream(`/attempts/${a.id}/chat`, body, (ev: ChatStreamEvent) => {
        if (ev.type === 'start') {
          assistantId = ev.assistant.id;
          setMessages((m) => [...m, ev.student, ev.assistant]);
          setText('');
          setDraftFor('');
          setUsed((u) => u + 1);
        } else if (ev.type === 'delta') setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: x.content + ev.text } : x)));
        else if (ev.type === 'done') setMessages((m) => m.map((x) => (x.id === ev.assistant.id ? ev.assistant : x)));
        else {
          setError(ev.message);
          if (ev.assistant) setMessages((m) => m.map((x) => (x.id === ev.assistant!.id ? ev.assistant! : x)));
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const openPage = async (materialId: string, n: number) => {
    try {
      setPage(await t.request('GET', `/attempts/${a.id}/materials/${materialId}/pages/${n}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <section className="chat-pane stack-2" aria-label="AI assistant" onCopy={onCopy} onCut={onCopy} onDragStart={(e) => a.settings.blockPaste && e.preventDefault()}>
      <div className="row">
        <h2 className="h2 grow">Assistant</h2>
        {limit ? (
          <span className="tiny faint">
            {Math.max(0, limit - used)} of {limit} messages left
          </span>
        ) : null}
      </div>
      <p className="tiny faint">Your teacher can read this chat. The assistant can be wrong; check what it says against your materials.</p>
      {a.materials.length ? (
        <details className="tiny">
          <summary>
            <BookOpen size={12} aria-hidden /> Materials ({a.materials.length})
          </summary>
          <ul>
            {a.materials.map((m) => (
              <li key={m.id}>
                {m.pages ? (
                  <button type="button" className="link-button" onClick={() => void openPage(m.id, 1)}>
                    {m.name}
                  </button>
                ) : (
                  m.name
                )}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <ol ref={list} className="chat-list stack-2" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? <li className="small muted">Ask about the ideas in your materials. The assistant will not give you answers to the questions.</li> : null}
        {messages.map((m) => (
          <li key={m.id} className={`chat-msg ${m.role}`}>
            <div className="tiny faint">{m.role === 'student' ? (m.kind === 'draft' ? 'You (with your draft)' : 'You') : 'Assistant'}</div>
            <div className="chat-text">{m.content || (m.status === 'streaming' ? '…' : '')}</div>
            {m.status === 'error' && m.error ? <div className="tiny" style={{ color: 'var(--danger)' }}>{m.error}</div> : null}
            {m.citations.length ? (
              <ul className="citations tiny">
                {m.citations.map((c, i) => (
                  <li key={i}>
                    <button type="button" className="link-button" onClick={() => c.page && void openPage(c.materialId, c.page)} disabled={!c.page}>
                      {c.title}
                      {c.page ? `, page ${c.page}` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
      <ErrorNote error={error} />
      <form className="stack-2" onSubmit={send}>
        <Textarea
          aria-label="Message to the assistant"
          rows={3}
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          disabled={busy || (limit !== null && used >= limit)}
        />
        <div className="row-wrap">
          {writtenItems.length ? (
            <Select aria-label="Share a draft answer with this message" value={draftFor} onChange={(e) => setDraftFor(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Don’t share a draft</option>
              {writtenItems.map((it) => (
                <option key={it.id} value={it.id} disabled={!isAnswered(responses[it.id])}>
                  Share my draft of question {it.position}
                </option>
              ))}
            </Select>
          ) : null}
          <span className="grow" />
          <Button type="submit" variant="primary" icon={<Send size={14} />} loading={busy} disabled={!text.trim() || (limit !== null && used >= limit)}>
            Ask
          </Button>
        </div>
      </form>
      {page ? (
        <Modal
          wide
          title={`${page.name} · page ${page.page} of ${page.pages}`}
          onClose={() => setPage(null)}
          footer={
            <>
              <Button disabled={page.page <= 1} onClick={() => void openPage(page.materialId, page.page - 1)}>
                Previous page
              </Button>
              <Button disabled={page.page >= page.pages} onClick={() => void openPage(page.materialId, page.page + 1)}>
                Next page
              </Button>
            </>
          }
        >
          <pre className="material-text" onCopy={onCopy}>
            {page.text || '(No text on this page.)'}
          </pre>
        </Modal>
      ) : null}
    </section>
  );
}
