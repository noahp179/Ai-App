import { Plus, RotateCcw, Send, Square, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EXPLANATION_STYLES, EXPLANATION_STYLE_LABEL, type ExplanationStyle, type TutorMessage } from '../../../shared/study/types';
import { Banner, Button, EmptyState, Loading, Select, Textarea, useConfirm, useToast } from '../../components/ui';
import { api, errorMessage, onAppEvent } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { ExpLink } from './common';
import { RichLine } from './render';

const EXAMPLES = [
  'Explain this in a simpler way.',
  'Give me five questions about this topic, one at a time.',
  'Help me understand why I got this wrong.',
  'Explain this using a real-world example.',
  'Review everything I struggled with this week.',
];

/** Paragraphs and "- " lists, with **bold** and $$math$$. Tutor text is plain text, never HTML. */
function TutorText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="blocks">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l)))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>
                  <RichLine text={l.replace(/^\s*([-*•]|\d+[.)])\s+/, '')} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i} style={{ whiteSpace: 'pre-wrap' }}>
            <RichLine text={b} />
          </p>
        );
      })}
    </div>
  );
}

export default function Tutor() {
  const route = useRoute();
  const toast = useToast();
  const confirm = useConfirm();
  const ai = useQuery('study:ai', () => api.study.aiStatus());
  const me = useQuery('study:me', () => api.study.me());
  const sessions = useQuery('study:tutor', () => api.study.tutorSessions());
  const sid = route.segments[2] ?? sessions.data?.[0]?.id ?? null;
  const msgs = useQuery(sid ? `study:tutor:${sid}` : null, () => api.study.tutorMessages(sid!));
  const [text, setText] = useState('');
  const [streams, setStreams] = useState<Record<string, string>>({});
  const end = useRef<HTMLDivElement>(null);
  const session = sessions.data?.find((s) => s.id === sid) ?? null;

  useEffect(
    () =>
      onAppEvent('study.tutor', (e) => {
        if (e.kind === 'delta') setStreams((s) => ({ ...s, [e.messageId]: (s[e.messageId] ?? '') + (e.delta ?? '') }));
        else {
          setStreams((s) => {
            const n = { ...s };
            delete n[e.messageId];
            return n;
          });
          invalidate(`study:tutor:${e.sessionId}`);
        }
      }),
    [],
  );
  useEffect(() => {
    // A block body: scrollIntoView returns a promise in current Chromium, which React would take for a cleanup function.
    end.current?.scrollIntoView({ block: 'end' });
  }, [msgs.data?.length, streams]);

  const newSession = async () => {
    try {
      const s = await api.study.createTutorSession({});
      invalidate('study:tutor');
      navigate(`/study/tutor/${s.id}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const send = async (t = text) => {
    if (!sid || !t.trim()) return;
    try {
      await api.study.sendTutor(sid, t);
      setText('');
      msgs.reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  if (!ai.data || !sessions.data) return <Loading />;
  const streaming = (msgs.data ?? []).some((m) => m.status === 'streaming');
  return (
    <div className="page tutor-page" style={{ maxWidth: 1100 }}>
      <aside className="tutor-sessions" aria-label="Tutoring sessions">
        <Button size="sm" icon={<Plus size={13} />} onClick={() => void newSession()} disabled={!ai.data.available}>
          New session
        </Button>
        <ul className="list">
          {sessions.data.map((s) => (
            <li key={s.id}>
              <button type="button" className={`nav-item ${s.id === sid ? 'active' : ''}`} onClick={() => navigate(`/study/tutor/${s.id}`)}>
                <span className="ellipsis">{s.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="tutor-chat stack-3" aria-label="Tutor conversation">
        <h1>AI tutor</h1>
        {!ai.data.available ? (
          <Banner tone="info" title="The AI tutor is off">
            {ai.data.reason}{' '}
            <button type="button" className="link-button" onClick={() => navigate('/study/settings')}>
              Learning settings
            </button>{' '}
            ·{' '}
            <button type="button" className="link-button" onClick={() => navigate('/settings/ai')}>
              AI providers
            </button>
            . Lessons, practice, review and planning all work without it.
          </Banner>
        ) : (
          <p className="tiny faint">
            Sent to your AI provider: what you type here, your grade, your explanation preference and the official expectation you’re studying{me.data?.shareProgressWithAi ? ', plus a short summary of your verified progress (you allowed this in Learning settings)' : ''}. Your name is never sent. The tutor can be wrong — check important answers with your teacher.
          </p>
        )}
        {session ? (
          <div className="row-wrap small">
            <span>
              Studying: {session.expectationId ? <ExpLink id={session.expectationId}>{session.title}</ExpLink> : 'anything (choose an expectation from the curriculum to focus)'}
            </span>
            <span className="grow" />
            <Select
              value={session.style}
              aria-label="Explanation style"
              onChange={(e) => void api.study.updateTutorSession(session.id, { style: e.target.value as ExplanationStyle }).then(() => invalidate('study:tutor'))}
            >
              {EXPLANATION_STYLES.map((s) => (
                <option key={s} value={s}>
                  {EXPLANATION_STYLE_LABEL[s]}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="ghost" icon={<RotateCcw size={12} />} onClick={() => void api.study.resetTutor(session.id).then(() => msgs.reload())}>
              Start over
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 size={12} />}
              onClick={async () => {
                if (!(await confirm({ title: 'Delete this tutoring session?', message: 'Its messages are deleted from this computer.', confirmLabel: 'Delete', danger: true }))) return;
                await api.study.deleteTutorSession(session.id);
                invalidate('study:tutor');
                navigate('/study/tutor');
              }}
            >
              Delete
            </Button>
          </div>
        ) : null}
        {!sid ? (
          <EmptyState title="No tutoring sessions yet">Start one here, or from any expectation in the curriculum so the tutor knows what you’re working on.</EmptyState>
        ) : (
          <div className="tutor-messages" aria-live="polite">
            {(msgs.data ?? []).map((m: TutorMessage) => (
              <div key={m.id} className={`tutor-msg ${m.role}`}>
                {m.role === 'tutor' ? <TutorText text={streams[m.id] ?? m.content} /> : <p style={{ whiteSpace: 'pre-wrap' }}>{m.content}</p>}
                {m.status === 'error' ? <p className="tiny danger-text">Not answered: {m.error}</p> : null}
                {m.role === 'tutor' && m.model ? <p className="tiny faint">{m.model} · AI-written</p> : null}
              </div>
            ))}
            <div ref={end} />
          </div>
        )}
        {sid && ai.data.available ? (
          <div className="stack-2">
            {!msgs.data?.length ? (
              <div className="row-wrap">
                {EXAMPLES.map((e) => (
                  <button key={e} type="button" className="chip" onClick={() => void send(e)}>
                    {e}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <Textarea
                aria-label="Message to the tutor"
                rows={2}
                value={text}
                placeholder="Ask a question, or say what you want to learn…"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              {streaming ? (
                <Button icon={<Square size={13} />} onClick={() => void api.study.stopTutor(sid)}>
                  Stop
                </Button>
              ) : (
                <Button variant="primary" icon={<Send size={13} />} disabled={!text.trim()} onClick={() => void send()}>
                  Send
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
