import { Archive, ArchiveRestore, Download, Ellipsis, FileJson, NotebookPen, Settings2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from '../../../shared/types';
import { Banner, Button, ErrorState, IconButton, Input, Loading, Menu, Select, Textarea, useConfirm, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { modelLabel } from '../../lib/format';
import { useParental } from '../../lib/parental';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { Composer } from './Composer';
import { MessageView, StopButton } from './MessageView';
import { useStreams } from './useStreams';

function host(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function ConversationView({ id }: { id: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const route = useRoute();
  const parental = useParental();
  const conv = useQuery(`conversations:${id}`, () => api.ai.conversation(id));
  const msgs = useQuery(`conversations:${id}:messages`, () => api.ai.messages(id));
  const providers = useQuery('providers:list', () => api.ai.providers());
  const streams = useStreams(id);
  const [editingTitle, setEditingTitle] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  const [system, setSystem] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const c = conv.data;
  const provider = providers.data?.find((p) => p.id === c?.providerId) ?? null;
  const models = useQuery(provider ? `providers:models:${provider.id}:${provider.lastStatus?.checkedAt ?? ''}` : null, () => api.ai.models(provider!.id));
  const copyRestricted = !!parental?.enabled && parental.config.copyRestriction;
  const prefill = route.params.get('prompt') ?? undefined;

  useEffect(() => setSystem(c?.systemPrompt ?? ''), [c?.systemPrompt]);
  const streamingTotal = useMemo(() => Object.values(streams).join('').length, [streams]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [msgs.data?.length, streamingTotal]);

  if (conv.error) return <ErrorState error={conv.error} onRetry={conv.reload} />;
  if (!c || !msgs.data || !providers.data) return <Loading />;
  const messages = msgs.data;
  const active: Message | undefined = messages.find((m) => m.status === 'streaming');

  const send = async (text: string, attachments: { type: 'note' | 'task' | 'event'; id: string }[]) => {
    try {
      await api.ai.send({ conversationId: id, content: text, attachments: attachments.map(({ type, id: aid }) => ({ type, id: aid })) });
      invalidate(`conversations:${id}`, 'conversations:list');
      if (prefill) navigate(`/ai/${id}`, { replace: true });
      return true;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return false;
    }
  };

  const update = async (patch: Parameters<typeof api.ai.updateConversation>[1]) => {
    try {
      await api.ai.updateConversation(id, patch);
      invalidate(`conversations:${id}`, 'conversations:list');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="row" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', gap: 8, minWidth: 0 }}>
        {editingTitle ? (
          <Input
            autoFocus
            defaultValue={c.title}
            aria-label="Conversation title"
            onBlur={(e) => {
              setEditingTitle(false);
              void update({ title: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            style={{ maxWidth: 360 }}
          />
        ) : (
          <button type="button" className="btn ghost" style={{ fontWeight: 640, fontSize: '1rem', padding: '0 6px' }} onClick={() => setEditingTitle(true)} title="Rename">
            <span className="ellipsis" style={{ maxWidth: 'min(320px, 28vw)' }}>
              {c.title}
            </span>
          </button>
        )}
        <span className="spacer" />
        <Select
          aria-label="Provider"
          value={c.providerId ?? ''}
          onChange={(e) => void update({ providerId: e.target.value || null })}
          style={{ width: 'auto', minWidth: 120, maxWidth: 180 }}
        >
          {!c.providerId ? <option value="">Choose provider</option> : null}
          {providers.data.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.enabled}>
              {p.name}
            </option>
          ))}
        </Select>
        {provider ? (
          (models.data ?? []).length ? (
            <Select aria-label="Model" value={c.model ?? ''} onChange={(e) => void update({ model: e.target.value })} style={{ width: 'auto', minWidth: 140, maxWidth: 220 }}>
              {!c.model ? <option value="">Choose model</option> : null}
              {(models.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              {c.model && !(models.data ?? []).some((m) => m.id === c.model) ? <option value={c.model}>{modelLabel(c.model)}</option> : null}
            </Select>
          ) : (
            <Input aria-label="Model" defaultValue={c.model ?? ''} placeholder="model name" style={{ width: 180 }} onBlur={(e) => e.target.value !== c.model && void update({ model: e.target.value })} />
          )
        ) : null}
        <IconButton label="System instructions" active={showSystem} onClick={() => setShowSystem((v) => !v)}>
          <Settings2 size={16} />
        </IconButton>
        <Menu
          label="More actions"
          icon={<Ellipsis size={16} />}
          items={[
            {
              label: 'Save as note',
              icon: <NotebookPen size={14} />,
              onSelect: () =>
                void api.ai
                  .toNote(id)
                  .then((n) => {
                    toast('Conversation saved as a note', 'success');
                    navigate(`/notes/${n.id}`);
                  })
                  .catch((err: unknown) => toast(errorMessage(err), 'error')),
            },
            copyRestricted
              ? null
              : {
                  label: 'Export as Markdown',
                  icon: <Download size={14} />,
                  onSelect: () => void api.ai.exportConversation(id, 'markdown').then((r) => r.saved && toast(`Saved to ${r.path}`, 'success')),
                },
            copyRestricted
              ? null
              : {
                  label: 'Export as JSON',
                  icon: <FileJson size={14} />,
                  onSelect: () => void api.ai.exportConversation(id, 'json').then((r) => r.saved && toast(`Saved to ${r.path}`, 'success')),
                },
            {
              label: c.archivedAt ? 'Unarchive' : 'Archive',
              icon: c.archivedAt ? <ArchiveRestore size={14} /> : <Archive size={14} />,
              onSelect: () => void api.ai.archiveConversation(id, !c.archivedAt).then(() => invalidate('conversations')),
            },
            {
              label: 'Delete conversation',
              icon: <Trash2 size={14} />,
              danger: true,
              onSelect: async () => {
                if (await confirm({ title: 'Delete this conversation?', message: 'Its messages are removed from this computer. This cannot be undone.', confirmLabel: 'Delete', danger: true })) {
                  await api.ai.deleteConversation(id);
                  invalidate('conversations');
                  navigate('/ai');
                }
              },
            },
          ]}
        />
      </header>

      {showSystem ? (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-sunken)' }} className="stack-3">
          <label className="field-label" htmlFor="sys">
            System instructions for this conversation
          </label>
          <Textarea id="sys" value={system} onChange={(e) => setSystem(e.target.value)} placeholder="e.g. You are a patient tutor. Explain step by step." rows={3} />
          <div className="row">
            <Button size="sm" variant="primary" onClick={() => void update({ systemPrompt: system }).then(() => setShowSystem(false))}>
              Save instructions
            </Button>
            <span className="small faint">Global instructions from Settings → AI are added before these.</span>
          </div>
        </div>
      ) : null}

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 20px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          {c.ephemeral ? (
            <div style={{ marginTop: 12 }}>
              <Banner tone="info">Temporary chat: it is deleted the next time FlowCompanion starts (Settings → AI → Save conversations is off).</Banner>
            </div>
          ) : null}
          {messages.length === 0 ? (
            <div className="empty">
              <h3>Start the conversation</h3>
              <p>
                {provider ? `Messages go to ${provider.name} (${host(provider.baseUrl)}) and are stored on this computer.` : 'Choose a provider above to start.'}
              </p>
            </div>
          ) : null}
          {messages.map((m, i) => (
            <MessageView
              key={m.id}
              m={m}
              streamingText={streams[m.id]}
              isLast={i === messages.length - 1}
              copyRestricted={copyRestricted}
              onRetry={() =>
                void api.ai
                  .retry(m.id)
                  .then(() => invalidate(`conversations:${id}`))
                  .catch((err: unknown) => toast(errorMessage(err), 'error'))
              }
            />
          ))}
          <div ref={bottom} />
        </div>
      </div>

      <div style={{ padding: '10px 20px 16px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }} className="stack-3">
          {active ? (
            <div className="row" style={{ justifyContent: 'center' }}>
              <StopButton messageId={active.id} />
            </div>
          ) : null}
          <Composer
            disabled={!provider}
            busy={!!active}
            providerLabel={provider ? `${provider.name} (${host(provider.baseUrl)})` : 'no provider'}
            initialText={prefill}
            onSend={send}
          />
        </div>
      </div>
    </div>
  );
}
