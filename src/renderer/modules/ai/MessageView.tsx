import { AlertTriangle, Bot, Copy, ListTodo, NotebookPen, RotateCcw, Square, User } from 'lucide-react';
import { memo } from 'react';
import type { Message } from '../../../shared/types';
import { Markdown } from '../../components/Markdown';
import { Badge, Button, IconButton, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useCopy } from '../../lib/copy';
import { modelLabel } from '../../lib/format';
import { navigate } from '../../lib/router';

const ERROR_HELP: Record<string, string> = {
  auth: 'Check the API key in Settings → AI providers.',
  rate_limit: 'Wait a moment and retry, or switch to another model.',
  model_not_found: 'Pick a different model from the selector above.',
  context_length: 'Start a new conversation, or switch to a model with a larger context window.',
  network: 'Check your connection, then retry.',
  timeout: 'Retry, or raise the timeout in Settings → AI.',
  not_configured: 'Open Settings → AI providers.',
  refused: 'Rephrase the request, or try a different model.',
};

export const MessageView = memo(function MessageView({
  m,
  streamingText,
  isLast,
  copyRestricted,
  onRetry,
}: {
  m: Message;
  streamingText?: string;
  isLast: boolean;
  copyRestricted: boolean;
  onRetry: () => void;
}) {
  const copy = useCopy();
  const toast = useToast();
  const streaming = m.status === 'streaming';
  const content = streaming ? (streamingText ?? m.content) : m.content;
  const isUser = m.role === 'user';

  return (
    <article className="row" style={{ alignItems: 'flex-start', gap: 12, padding: '14px 0' }} aria-label={isUser ? 'Your message' : 'Assistant message'}>
      <div className="brand-mark" style={{ background: isUser ? 'var(--surface-3)' : undefined, color: isUser ? 'var(--text-muted)' : undefined }} aria-hidden>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row small faint" style={{ marginBottom: 4 }}>
          <strong style={{ color: 'var(--text)' }}>{isUser ? 'You' : 'Assistant'}</strong>
          {!isUser && (m.servedModel ?? m.model) ? <span className="ellipsis" style={{ maxWidth: 360 }} title={m.servedModel ?? m.model ?? ''}>{modelLabel(m.servedModel ?? m.model)}</span> : null}
          {streaming ? (
            <span className="row" style={{ gap: 6 }}>
              <span className="spinner" aria-hidden /> writing…
            </span>
          ) : null}
          {m.status === 'canceled' ? <Badge>Stopped</Badge> : null}
        </div>
        <div data-copy-context={isUser ? undefined : 'ai'} data-copy-restricted={!isUser && copyRestricted ? 'true' : undefined}>
          {isUser ? (
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</div>
          ) : content ? (
            <Markdown source={content} copyContext="ai" canCopy={!copyRestricted} />
          ) : streaming ? null : m.status === 'error' ? null : (
            <span className="faint">(no content)</span>
          )}
        </div>
        {m.notices.length ? (
          <div className="col" style={{ marginTop: 8 }}>
            {m.notices.map((n) => (
              <div key={n} className="small row" style={{ color: 'var(--info)' }}>
                <AlertTriangle size={13} /> {n}
              </div>
            ))}
          </div>
        ) : null}
        {m.status === 'error' && m.error ? (
          <div className="banner danger" role="alert" style={{ marginTop: 8 }}>
            <div className="grow">
              <div>{m.error.message}</div>
              {ERROR_HELP[m.error.code] ? <div className="small muted" style={{ marginTop: 2 }}>{ERROR_HELP[m.error.code]}</div> : null}
            </div>
            {isLast ? (
              <Button size="sm" onClick={onRetry} icon={<RotateCcw size={13} />}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}
        {!isUser && !streaming && content ? (
          <div className="row" style={{ marginTop: 6, gap: 2 }}>
            {!copyRestricted ? (
              <IconButton label="Copy response" size="sm" onClick={() => void copy(content, 'ai')}>
                <Copy size={13} />
              </IconButton>
            ) : null}
            <IconButton
              label="Save response as a note"
              size="sm"
              onClick={async () => {
                try {
                  const n = await api.ai.toNote(m.conversationId, m.id);
                  toast(
                    <span>
                      Saved as note.{' '}
                      <a href="#" onClick={(e) => (e.preventDefault(), navigate(`/notes/${n.id}`))}>
                        Open
                      </a>
                    </span>,
                    'success',
                  );
                } catch (err) {
                  toast(errorMessage(err), 'error');
                }
              }}
            >
              <NotebookPen size={13} />
            </IconButton>
            <IconButton
              label="Create a task from this response"
              size="sm"
              onClick={async () => {
                try {
                  const t = await api.ai.toTask(m.id);
                  toast(`Task created: ${t.title}`, 'success');
                } catch (err) {
                  toast(errorMessage(err), 'error');
                }
              }}
            >
              <ListTodo size={13} />
            </IconButton>
            {isLast && m.status !== 'error' ? (
              <IconButton label="Regenerate" size="sm" onClick={onRetry}>
                <RotateCcw size={13} />
              </IconButton>
            ) : null}
            {m.usage?.outputTokens ? (
              <span className="tiny faint" style={{ marginLeft: 6 }}>
                {m.usage.inputTokens ?? '?'} in · {m.usage.outputTokens} out tokens
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
});

export function StopButton({ messageId }: { messageId: string }) {
  return (
    <Button size="sm" onClick={() => void api.ai.cancel(messageId)} icon={<Square size={12} />}>
      Stop
    </Button>
  );
}
