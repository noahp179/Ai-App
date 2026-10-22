import { CalendarDays, ListTodo, NotebookPen, Paperclip, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, IconButton, Input, Modal, Tabs, useConfirm } from '../../components/ui';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';
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

  const submit = async () => {
    if (!text.trim() || disabled || busy) return;
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
    if (await onSend(text, attachments)) {
      setText('');
      setAttachments([]);
    }
  };

  return (
    <div className="card" style={{ padding: 10 }}>
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
        <span className="tiny faint grow">Sent to {providerLabel}</span>
        <Button variant="primary" size="sm" onClick={() => void submit()} disabled={disabled || busy || !text.trim()} icon={<Send size={13} />}>
          Send
        </Button>
      </div>
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
