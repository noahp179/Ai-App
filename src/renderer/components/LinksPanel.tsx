import { BookMarked, Bookmark, CalendarDays, GraduationCap, Link2, ListTodo, MessageSquare, NotebookPen, X } from 'lucide-react';
import { useState } from 'react';
import type { LinkableType, SearchHit } from '../../shared/types';
import { api, errorMessage } from '../lib/api';
import { invalidate, useQuery } from '../lib/query';
import { navigate } from '../lib/router';
import { Button, Input, Modal, useToast } from './ui';

const ICON: Record<LinkableType, typeof Link2> = {
  note: NotebookPen,
  task: ListTodo,
  prompt: BookMarked,
  event: CalendarDays,
  conversation: MessageSquare,
  bookmark: Bookmark,
  resource: GraduationCap,
};

export function routeFor(type: LinkableType | SearchHit['type'], id: string): string {
  switch (type) {
    case 'note':
      return `/notes/${id}`;
    case 'task':
      return `/productivity/tasks?task=${id}`;
    case 'prompt':
      return `/prompts/${id}`;
    case 'event':
      return `/calendar?event=${id}`;
    case 'conversation':
      return `/ai/${id}`;
    case 'bookmark':
      return '/productivity/bookmarks';
    case 'resource':
      return `/learning/resource/${id}`;
    case 'article':
      return '/news/saved';
    default:
      return '/home';
  }
}

const LINKABLE: SearchHit['type'][] = ['note', 'task', 'prompt', 'event', 'conversation', 'bookmark', 'resource'];

function LinkPicker({ onPick, onClose }: { onPick: (h: SearchHit) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const hits = useQuery(q.trim() ? `search:link:${q}` : null, () => api.search.query(q, LINKABLE));
  return (
    <Modal title="Link to…" onClose={onClose}>
      <Input autoFocus placeholder="Search notes, tasks, prompts, events, conversations…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="list" style={{ marginTop: 8, maxHeight: 340, overflow: 'auto' }}>
        {!q.trim() ? <div className="small muted" style={{ padding: 10 }}>Type to search.</div> : null}
        {hits.data?.length === 0 ? <div className="small muted" style={{ padding: 10 }}>Nothing found.</div> : null}
        {hits.data?.map((h) => {
          const Icon = ICON[h.type as LinkableType] ?? Link2;
          return (
            <button key={`${h.type}:${h.id}`} type="button" className="list-item" onClick={() => onPick(h)}>
              <Icon size={14} />
              <span className="grow ellipsis">{h.title}</span>
              <span className="tiny faint">{h.type}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/** Shows and edits explicit links between an item and anything else in the workspace. */
export function LinksPanel({ type, id }: { type: LinkableType; id: string }) {
  const toast = useToast();
  const links = useQuery(`links:${type}:${id}`, () => api.links.for(type, id));
  const [picking, setPicking] = useState(false);
  return (
    <div className="row-wrap" style={{ gap: 6 }}>
      <span className="small faint row" style={{ gap: 4 }}>
        <Link2 size={13} /> Linked:
      </span>
      {links.data?.length === 0 ? <span className="small faint">nothing yet</span> : null}
      {links.data?.map((l) => {
        const Icon = ICON[l.toType];
        return (
          <span key={l.id} className="chip" style={{ cursor: 'default' }}>
            <Icon size={12} />
            <button type="button" style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }} onClick={() => navigate(routeFor(l.toType, l.toId))}>
              {l.title ?? '(deleted)'}
            </button>
            <button
              type="button"
              aria-label={`Remove link to ${l.title ?? 'item'}`}
              style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
              onClick={() => void api.links.unlink(l.id).then(() => invalidate('links'))}
            >
              <X size={11} />
            </button>
          </span>
        );
      })}
      <Button size="sm" variant="ghost" onClick={() => setPicking(true)}>
        + Link
      </Button>
      {picking ? (
        <LinkPicker
          onClose={() => setPicking(false)}
          onPick={async (h) => {
            setPicking(false);
            try {
              await api.links.link(type, id, h.type as LinkableType, h.id);
              invalidate('links');
            } catch (err) {
              toast(errorMessage(err), 'error');
            }
          }}
        />
      ) : null}
    </div>
  );
}
