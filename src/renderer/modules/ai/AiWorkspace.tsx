import { Activity, Archive, MessageSquare, Plus, Search, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Banner, Button, EmptyState, IconButton, Input, Loading, useToast } from '../../components/ui';
import { api, errorMessage, onAppEvent } from '../../lib/api';
import { fmtRelative } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { AiTasksPanel } from './AiTasksPanel';
import { ConversationView } from './ConversationView';
import { ProviderManager } from './ProviderSetup';

function SetupScreen() {
  return (
    <div className="page stack-5" style={{ maxWidth: 900 }}>
      <div>
        <h1 className="row">
          <Sparkles size={22} color="var(--accent)" /> Connect an AI provider
        </h1>
        <p className="muted" style={{ marginTop: 8 }}>
          The AI workspace sends your messages to a model you choose: a cloud service with your own API key, or a model running on this computer. Until you connect one, FlowCompanion will not answer here — it never makes up responses. Everything else in the app works without AI.
        </p>
      </div>
      <Banner tone="info" title="What gets sent">
        Only the messages in a conversation (and anything you explicitly attach) go to the provider you pick for it. Your notes, calendar and other data stay on this computer.
      </Banner>
      <ProviderManager />
    </div>
  );
}

function ConversationList({ activeId }: { activeId: string | null }) {
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState(false);
  const list = useQuery(`conversations:list:${archived}:${q}`, () => api.ai.conversations({ archived, search: q || undefined }));
  return (
    <div className="pane pane-list">
      <div style={{ padding: 12 }} className="stack-3">
        <Button variant="primary" style={{ width: '100%' }} icon={<Plus size={15} />} onClick={() => navigate('/ai/new')}>
          New conversation
        </Button>
        <div className="row">
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 9, top: 10, color: 'var(--text-faint)' }} />
            <Input placeholder="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 28 }} aria-label="Search conversations" />
          </div>
          <IconButton label={archived ? 'Show active' : 'Show archived'} active={archived} onClick={() => setArchived((v) => !v)}>
            <Archive size={15} />
          </IconButton>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
        {list.loading && !list.data ? <Loading /> : null}
        {list.data?.length === 0 ? <div className="small muted" style={{ padding: 12 }}>{q ? 'No matches.' : archived ? 'No archived conversations.' : 'No conversations yet.'}</div> : null}
        {list.data?.map((c) => (
          <button key={c.id} type="button" className={`list-item ${c.id === activeId ? 'active' : ''}`} onClick={() => navigate(`/ai/${c.id}`)} style={{ alignItems: 'flex-start' }}>
            <MessageSquare size={14} style={{ marginTop: 3, flex: 'none' }} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 540 }}>
                {c.title}
              </div>
              <div className="tiny faint ellipsis">
                {fmtRelative(c.updatedAt)}
                {c.ephemeral ? ' · temporary' : ''}
                {c.lastMessagePreview ? ` · ${c.lastMessagePreview}` : ''}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
        <button type="button" className="nav-item" onClick={() => navigate('/ai/tasks')}>
          <Activity size={15} /> AI task status
        </button>
      </div>
    </div>
  );
}

function NewConversation() {
  const toast = useToast();
  const route = useRoute();
  useEffect(() => {
    let cancelled = false;
    api.ai
      .createConversation()
      .then((c) => {
        if (cancelled) return;
        invalidate('conversations');
        const prompt = route.params.get('prompt');
        navigate(`/ai/${c.id}${prompt ? `?prompt=${encodeURIComponent(prompt)}` : ''}`, { replace: true });
      })
      .catch((err: unknown) => toast(errorMessage(err), 'error'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Loading label="Starting a conversation…" />;
}

export default function AiWorkspace() {
  const route = useRoute();
  const status = useQuery('providers:status', () => api.ai.status());
  useEffect(() => onAppEvent('ai.task', () => invalidate('aiTasks')), []);
  const sub = route.segments[1] ?? null;

  if (sub === 'tasks') return <AiTasksPanel />;
  if (sub === 'setup') return <SetupScreen />;
  if (!status.data) return <Loading />;
  if (!status.data.configured && sub !== null && sub !== 'new') {
    // Existing conversations stay readable without a provider.
  } else if (!status.data.configured) {
    return <SetupScreen />;
  }
  return (
    <div className="split">
      <ConversationList activeId={sub && sub !== 'new' ? sub : null} />
      <div className="pane">
        {sub === 'new' ? (
          <NewConversation />
        ) : sub ? (
          <ConversationView key={sub} id={sub} />
        ) : (
          <EmptyState title="Pick a conversation or start a new one" icon={<MessageSquare size={28} />} action={<Button variant="primary" onClick={() => navigate('/ai/new')}>New conversation</Button>}>
            Conversations are saved on this computer and searchable.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
