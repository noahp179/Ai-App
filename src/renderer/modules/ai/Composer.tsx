import { BookMarked, BookmarkPlus, CalendarDays, ListTodo, NotebookPen, Paperclip, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Prompt } from '../../../shared/types';
import { PromptUse, PromptVariables } from '../../components/PromptUse';
import { Badge, Button, IconButton, Input, Modal, Tabs, useConfirm, usePrompt, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { useSettings } from '../../lib/settings';

export interface Attachment {
  type: 'note' | 'task' | 'event';
  id: string;
  title: string;
}

function AttachPicker({ onPick, onClose }: { onPick: (a: Attachment) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'note' | 'task'>('note');
  const [q, setQ] = useState('');
  const notes = useQuery(tab === 'note' ? `notes:pick:${q}` : null, () => api.notes.list({ search: q || undefined }));
  const tasks = useQuery(tab === 'task' ? `tasks:pick:${q}` : null, () => api.tasks.list({ listId: 'all', search: q || undefined }));
  const items: Attachment[] =
    tab === 'note'
      ? (notes.data ?? []).slice(0, 50).map((n) => ({ type: 'note', id: n.id, title: n.title || 'Untitled' }))
      : (tasks.data ?? []).slice(0, 50).map((t) => ({ type: 'task', id: t.id, title: t.title }));
  return (
    <Modal title="Attach context" onClose={onClose}>
      <p className="small muted" style={{ marginBottom: 12 }}>
        The full text of what you attach is sent with your message to the AI provider. Nothing else from your notes or tasks is sent.
      </p>
      <Tabs
        label="Item type"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'note', label: 'Notes' },
          { value: 'task', label: 'Tasks' },
        ]}
      />
      <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="list" style={{ marginTop: 8, maxHeight: 320, overflow: 'auto' }}>
        {items.length === 0 ? <div className="small muted" style={{ padding: 12 }}>Nothing found.</div> : null}
        {items.map((it) => (
          <button key={it.id} type="button" className="list-item" onClick={() => onPick(it)}>
            {it.type === 'note' ? <NotebookPen size={14} /> : <ListTodo size={14} />}
            <span className="ellipsis">{it.title}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** A saved prompt, filled in, sent ahead of what the user types. */
export interface AttachedPrompt {
  id: string;
  title: string;
  text: string;
}

/** Pick a prompt from the library, fill in its variables, and attach it to the message. */
function PromptPicker({ onPick, onClose }: { onPick: (p: AttachedPrompt) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<Prompt | null>(null);
  const list = useQuery(`prompts:pick:${q}`, () => api.prompts.list({ search: q || undefined }));
  return (
    <Modal title={chosen ? chosen.title : 'Attach a saved prompt'} onClose={onClose} wide>
      {chosen ? (
        <div className="stack-3">
          {chosen.description ? <p className="small muted">{chosen.description}</p> : null}
          <pre className="prompt-preview prompt-body">{chosen.body}</pre>
          <PromptVariables body={chosen.body} />
          <PromptUse
            body={chosen.body}
            context="prompts"
            onUse={() => void api.prompts.recordUse(chosen.id).then(() => invalidate('prompts'))}
            onAttach={(text) => onPick({ id: chosen.id, title: chosen.title, text })}
          />
          <div>
            <Button size="sm" variant="ghost" onClick={() => setChosen(null)}>
              ← Choose a different prompt
            </Button>
          </div>
        </div>
      ) : (
        <div className="stack-3">
          <p className="small muted">The prompt is sent first, then whatever you type in the message box. Save prompts in the Prompt Library or with the bookmark button next to the message box.</p>
          <Input placeholder="Search your prompts…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search your prompts" />
          <div className="list" style={{ maxHeight: 360, overflow: 'auto' }}>
            {list.data && !list.data.length ? <div className="small muted" style={{ padding: 12 }}>{q ? 'No prompts match.' : 'Your Prompt Library is empty.'}</div> : null}
            {(list.data ?? []).slice(0, 100).map((p) => (
              <button key={p.id} type="button" className="list-item" onClick={() => setChosen(p)}>
                <BookMarked size={14} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="ellipsis" style={{ display: 'block' }}>
                    {p.title}
                  </span>
                  {p.description ? (
                    <span className="tiny muted ellipsis" style={{ display: 'block' }}>
                      {p.description}
                    </span>
                  ) : null}
                </span>
                <Badge>{p.category.charAt(0).toUpperCase() + p.category.slice(1)}</Badge>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function Composer({
  disabled,
  busy,
  providerLabel,
  initialText,
  onSend,
}: {
  disabled: boolean;
  busy: boolean;
  providerLabel: string;
  initialText?: string;
  onSend: (text: string, attachments: Attachment[]) => Promise<boolean>;
}) {
  const { settings } = useSettings();
  const confirm = useConfirm();
  const [text, setText] = useState(initialText ?? '');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [picking, setPicking] = useState(false);
  const [pickingPrompt, setPickingPrompt] = useState(false);
  const [attachedPrompt, setAttachedPrompt] = useState<AttachedPrompt | null>(null);
  const toast = useToast();
  const ask = usePrompt();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [text]);

  const message = attachedPrompt ? (text.trim() ? `${attachedPrompt.text}\n\n${text}` : attachedPrompt.text) : text;
  const canSend = !!message.trim() && !disabled && !busy;

  const saveAsPrompt = async () => {
    const body = text.trim();
    if (!body) return;
    const title = await ask({ title: 'Save as a prompt', label: 'Name for this prompt', initial: body.split('\n')[0]!.slice(0, 60), confirmLabel: 'Save' });
    if (!title) return;
    try {
      await api.prompts.create({ title, body });
      invalidate('prompts');
      toast('Saved to your Prompt Library. Use {{name}} in a prompt for parts you fill in each time.', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const submit = async () => {
    if (!canSend) return;
    if (attachments.length && settings.privacy.confirmBeforeSendingContext) {
      const ok = await confirm({
        title: 'Send attached items?',
        message: (
          <div className="col">
            <span>The full content of these items will be sent to {providerLabel} with your message:</span>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {attachments.map((a) => (
                <li key={a.id}>
                  {a.type}: {a.title}
                </li>
              ))}
            </ul>
            <span className="small faint">You can turn this confirmation off in Settings → Privacy.</span>
          </div>
        ),
        confirmLabel: 'Send',
      });
      if (!ok) return;
    }
    if (await onSend(message, attachments)) {
      setText('');
      setAttachments([]);
      setAttachedPrompt(null);
    }
  };

  return (
    <div className="card" style={{ padding: 10 }}>
      {attachedPrompt ? (
        <div className="row-wrap" style={{ marginBottom: 8 }}>
          <Badge tone="accent">
            <BookMarked size={11} />
            Prompt: {attachedPrompt.title}
            <button
              type="button"
              aria-label={`Remove prompt ${attachedPrompt.title}`}
              style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
              onClick={() => setAttachedPrompt(null)}
            >
              <X size={11} />
            </button>
          </Badge>
          <span className="tiny faint">Sent before your message. Type anything to add to it, or just press Send.</span>
        </div>
      ) : null}
      {attachments.length ? (
        <div className="row-wrap" style={{ marginBottom: 8 }}>
          {attachments.map((a) => (
            <Badge key={a.id} tone="accent">
              {a.type === 'note' ? <NotebookPen size={11} /> : a.type === 'task' ? <ListTodo size={11} /> : <CalendarDays size={11} />}
              {a.title}
              <button
                type="button"
                aria-label={`Remove ${a.title}`}
                style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                onClick={() => setAttachments((x) => x.filter((y) => y.id !== a.id))}
              >
                <X size={11} />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <textarea
        ref={ref}
        className="textarea"
        style={{ border: 0, background: 'transparent', boxShadow: 'none', minHeight: 44, resize: 'none', padding: '4px 6px' }}
        placeholder={disabled ? 'Connect a provider to start chatting' : 'Message… (Enter to send, Shift+Enter for a new line)'}
        value={text}
        disabled={disabled}
        aria-label="Message"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <div className="row" style={{ marginTop: 6 }}>
        <IconButton label="Attach a note or task" onClick={() => setPicking(true)} disabled={disabled}>
          <Paperclip size={16} />
        </IconButton>
        <IconButton label="Attach a saved prompt" onClick={() => setPickingPrompt(true)} disabled={disabled}>
          <BookMarked size={16} />
        </IconButton>
        <IconButton label="Save what you typed as a prompt" onClick={() => void saveAsPrompt()} disabled={!text.trim()}>
          <BookmarkPlus size={16} />
        </IconButton>
        <span className="tiny faint grow">Sent to {providerLabel}</span>
        <Button variant="primary" size="sm" onClick={() => void submit()} disabled={!canSend} icon={<Send size={13} />}>
          Send
        </Button>
      </div>
      {pickingPrompt ? (
        <PromptPicker
          onClose={() => setPickingPrompt(false)}
          onPick={(p) => {
            setAttachedPrompt(p);
            setPickingPrompt(false);
            ref.current?.focus();
          }}
        />
      ) : null}
      {picking ? (
        <AttachPicker
          onClose={() => setPicking(false)}
          onPick={(a) => {
            setAttachments((x) => (x.some((y) => y.id === a.id) ? x : [...x, a]));
            setPicking(false);
          }}
        />
      ) : null}
    </div>
  );
}
