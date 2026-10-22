import { BookOpen, Check, ExternalLink, Hash, Search, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import type { Bookmark } from '../../../shared/types';
import { Badge, Button, EmptyState, IconButton, Input, Loading, Toggle, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtRelative } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function BookmarkRow({ b, reading }: { b: Bookmark; reading: boolean }) {
  const toast = useToast();
  const run = async (p: Promise<unknown>) => {
    try {
      await p;
      invalidate('bookmarks');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  return (
    <div className="card row" style={{ padding: '10px 12px', alignItems: 'flex-start' }}>
      <div className="grow" style={{ minWidth: 0 }}>
        <a
          href={b.url}
          onClick={(e) => {
            e.preventDefault();
            void api.app.openExternal(b.url);
          }}
          style={{ fontWeight: 560, color: b.queue === 'read' ? 'var(--text-muted)' : 'var(--text)' }}
        >
          {b.title}
        </a>
        <div className="small faint ellipsis">
          {host(b.url)} · added {fmtRelative(b.createdAt)}
          {b.readAt ? ` · read ${fmtRelative(b.readAt)}` : ''}
        </div>
        {b.description ? <div className="small muted" style={{ marginTop: 2 }}>{b.description}</div> : null}
        {b.tags.length ? (
          <div className="row-wrap" style={{ marginTop: 4, gap: 4 }}>
            {b.tags.map((t) => (
              <Badge key={t}>#{t}</Badge>
            ))}
          </div>
        ) : null}
      </div>
      <IconButton label="Open in browser" size="sm" onClick={() => void api.app.openExternal(b.url)}>
        <ExternalLink size={14} />
      </IconButton>
      {reading ? (
        b.queue === 'read' ? (
          <IconButton label="Mark unread" size="sm" onClick={() => void run(api.bookmarks.setRead(b.id, false))}>
            <Undo2 size={14} />
          </IconButton>
        ) : (
          <IconButton label="Mark as read" size="sm" onClick={() => void run(api.bookmarks.setRead(b.id, true))}>
            <Check size={14} />
          </IconButton>
        )
      ) : (
        <IconButton label={b.queue === 'none' ? 'Add to reading queue' : 'Remove from reading queue'} size="sm" active={b.queue !== 'none'} onClick={() => void run(api.bookmarks.update(b.id, { queue: b.queue === 'none' ? 'unread' : 'none' }))}>
          <BookOpen size={14} />
        </IconButton>
      )}
      <IconButton label="Delete" size="sm" onClick={() => void run(api.bookmarks.delete(b.id))}>
        <Trash2 size={14} />
      </IconButton>
    </div>
  );
}

export function BookmarksTab({ reading }: { reading: boolean }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [queue, setQueue] = useState(reading);
  const list = useQuery(`bookmarks:list:${reading}:${q}:${tag ?? ''}`, () => api.bookmarks.list({ search: q || undefined, tag: tag ?? undefined, queue: reading ? 'reading' : 'all' }));
  const allTags = useQuery('bookmarks:tags', () => api.bookmarks.tags());

  const add = async () => {
    try {
      await api.bookmarks.create({ url, title: title || undefined, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), queue: queue ? 'unread' : 'none' });
      setUrl('');
      setTitle('');
      setTags('');
      invalidate('bookmarks');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const unread = list.data?.filter((b) => b.queue === 'unread') ?? [];
  const read = list.data?.filter((b) => b.queue === 'read') ?? [];

  return (
    <div className="stack-4">
      <form
        className="card stack-3"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <div className="row-wrap">
          <Input placeholder="https://…" aria-label="Link" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 2, minWidth: 220 }} />
          <Input placeholder="Title (optional)" aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <Input placeholder="Tags" aria-label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
        </div>
        <div className="row">
          <Toggle checked={queue} onChange={setQueue} label="Add to reading queue" />
          <span className="spacer" />
          <Button type="submit" variant="primary" disabled={!url.trim()}>
            Save link
          </Button>
        </div>
        <div className="tiny faint">FlowCompanion does not visit the page; links open in your browser.</div>
      </form>
      <div className="row-wrap">
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 9, top: 10, color: 'var(--text-faint)' }} />
          <Input placeholder="Search links" aria-label="Search links" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 28 }} />
        </div>
        {allTags.data?.map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
            <Hash size={11} />
            {t}
          </button>
        ))}
      </div>
      {!list.data ? <Loading /> : null}
      {list.data?.length === 0 ? (
        <EmptyState title={reading ? 'Your reading queue is empty' : 'No links saved yet'} icon={<BookOpen size={28} />}>
          {reading ? 'Save articles here to read later. News articles can be added from the News module.' : 'Save a link above.'}
        </EmptyState>
      ) : null}
      {reading ? (
        <>
          {unread.length ? <h3>To read ({unread.length})</h3> : null}
          <div className="stack-3">{unread.map((b) => <BookmarkRow key={b.id} b={b} reading />)}</div>
          {read.length ? <h3 className="muted">Read ({read.length})</h3> : null}
          <div className="stack-3">{read.map((b) => <BookmarkRow key={b.id} b={b} reading />)}</div>
        </>
      ) : (
        <div className="stack-3">{list.data?.map((b) => <BookmarkRow key={b.id} b={b} reading={false} />)}</div>
      )}
    </div>
  );
}
