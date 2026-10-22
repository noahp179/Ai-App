import { Archive, FileDown, FileUp, Folder, FolderPlus, Hash, NotebookPen, Pin, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { NoteView } from '../../../shared/types';
import { Badge, Button, EmptyState, IconButton, Input, Loading, Menu, Select, useConfirm, usePrompt, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtRelative } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { NoteEditor } from './NoteEditor';

const VIEWS: { value: NoteView; label: string; icon: typeof Pin }[] = [
  { value: 'all', label: 'All notes', icon: NotebookPen },
  { value: 'pinned', label: 'Pinned', icon: Pin },
  { value: 'favorites', label: 'Favorites', icon: Star },
  { value: 'archived', label: 'Archived', icon: Archive },
  { value: 'trash', label: 'Trash', icon: Trash2 },
];

function NewNote() {
  const { settings } = useSettings();
  const toast = useToast();
  useEffect(() => {
    let cancelled = false;
    api.notes
      .create({ format: settings.notes.defaultFormat })
      .then((n) => {
        if (cancelled) return;
        invalidate('notes');
        navigate(`/notes/${n.id}`, { replace: true });
      })
      .catch((err: unknown) => toast(errorMessage(err), 'error'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Loading label="Creating note…" />;
}

export default function Notes() {
  const route = useRoute();
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const sub = route.segments[1] ?? null;
  const view = (route.params.get('view') as NoteView) ?? 'all';
  const [q, setQ] = useState('');
  const [folder, setFolder] = useState<string>('any');
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<'updated' | 'created' | 'title'>('updated');
  const folders = useQuery('notes:folders', () => api.notes.folders());
  const tags = useQuery('notes:tags', () => api.notes.tags());
  const list = useQuery(`notes:list:${view}:${folder}:${tag ?? ''}:${q}:${sort}`, () =>
    api.notes.list({
      view,
      folderId: folder === 'any' ? undefined : folder === 'none' ? null : folder,
      tag: tag ?? undefined,
      search: q || undefined,
      sort,
    }),
  );

  const setView = (v: NoteView) => navigate(`/notes${sub && sub !== 'new' ? `/${sub}` : ''}?view=${v}`);

  return (
    <div className="split" style={{ gridTemplateColumns: '320px 1fr' }}>
      <div className="pane pane-list">
        <div style={{ padding: 12 }} className="stack-3">
          <div className="row">
            <Button variant="primary" style={{ flex: 1 }} icon={<Plus size={15} />} onClick={() => navigate('/notes/new')}>
              New note
            </Button>
            <Menu
              label="Import and export"
              icon={<FileDown size={16} />}
              items={[
                {
                  label: 'Import Markdown, text or JSON…',
                  icon: <FileUp size={14} />,
                  onSelect: async () => {
                    try {
                      const r = await api.notes.importFiles();
                      if (!r) return;
                      invalidate('notes');
                      toast(`Imported ${r.imported} note${r.imported === 1 ? '' : 's'}${r.skipped ? `, skipped ${r.skipped}` : ''}.${r.errors.length ? ` ${r.errors.slice(0, 2).join('; ')}` : ''}`, r.imported ? 'success' : 'error');
                    } catch (err) {
                      toast(errorMessage(err), 'error');
                    }
                  },
                },
                {
                  label: 'Export all notes (JSON)…',
                  icon: <FileDown size={14} />,
                  onSelect: async () => {
                    const r = await api.notes.exportAll();
                    if (r.saved) toast(`Exported to ${r.path}`, 'success');
                  },
                },
              ]}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 9, top: 10, color: 'var(--text-faint)' }} />
            <Input placeholder="Search notes" aria-label="Search notes" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 28 }} />
          </div>
          <div className="row-wrap" style={{ gap: 4 }}>
            {VIEWS.map((v) => {
              const Icon = v.icon;
              return (
                <button key={v.value} type="button" className="chip" aria-pressed={view === v.value} onClick={() => setView(v.value)}>
                  <Icon size={12} /> {v.label}
                </button>
              );
            })}
          </div>
          <div className="row">
            <Select aria-label="Folder filter" value={folder} onChange={(e) => setFolder(e.target.value)} disabled={view === 'trash'}>
              <option value="any">All folders</option>
              <option value="none">No folder</option>
              {folders.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.noteCount})
                </option>
              ))}
            </Select>
            <IconButton
              label="New folder"
              onClick={async () => {
                const name = await prompt({ title: 'New folder', label: 'Folder name', confirmLabel: 'Create' });
                if (!name) return;
                try {
                  const f = await api.notes.createFolder(name);
                  invalidate('notes');
                  setFolder(f.id);
                } catch (err) {
                  toast(errorMessage(err), 'error');
                }
              }}
            >
              <FolderPlus size={16} />
            </IconButton>
            {folder !== 'any' && folder !== 'none' ? (
              <Menu
                label="Folder actions"
                icon={<Folder size={16} />}
                items={[
                  {
                    label: 'Rename folder',
                    onSelect: async () => {
                      const name = await prompt({ title: 'Rename folder', label: 'Folder name', initial: folders.data?.find((f) => f.id === folder)?.name ?? '', confirmLabel: 'Rename' });
                      if (name) await api.notes.renameFolder(folder, name).then(() => invalidate('notes'));
                    },
                  },
                  {
                    label: 'Delete folder (keeps notes)',
                    danger: true,
                    onSelect: async () => {
                      if (await confirm({ title: 'Delete folder?', message: 'Notes in it are kept and moved to “No folder”.', confirmLabel: 'Delete folder', danger: true })) {
                        await api.notes.deleteFolder(folder);
                        setFolder('any');
                        invalidate('notes');
                      }
                    },
                  },
                ]}
              />
            ) : null}
          </div>
          {tags.data && tags.data.length > 0 ? (
            <div className="row-wrap" style={{ gap: 4 }}>
              {tags.data.slice(0, 24).map((t) => (
                <button key={t.tag} type="button" className="chip" aria-pressed={tag === t.tag} onClick={() => setTag(tag === t.tag ? null : t.tag)}>
                  <Hash size={11} />
                  {t.tag} <span className="faint">{t.count}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="row small faint">
            <span className="grow">{list.data ? `${list.data.length} note${list.data.length === 1 ? '' : 's'}` : ''}</span>
            <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ width: 'auto', height: 28, fontSize: '0.8rem' }}>
              <option value="updated">Last edited</option>
              <option value="created">Created</option>
              <option value="title">Title</option>
            </Select>
          </div>
          {view === 'trash' && (list.data?.length ?? 0) > 0 ? (
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                if (await confirm({ title: 'Empty trash?', message: 'All notes in the trash will be permanently deleted.', confirmLabel: 'Empty trash', danger: true })) {
                  const n = await api.notes.emptyTrash();
                  invalidate('notes');
                  toast(`Deleted ${n} note${n === 1 ? '' : 's'}`, 'success');
                }
              }}
            >
              Empty trash
            </Button>
          ) : null}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
          {list.loading && !list.data ? <Loading /> : null}
          {list.data?.length === 0 ? <div className="small muted" style={{ padding: 12 }}>{q ? 'No notes match.' : view === 'trash' ? 'Trash is empty.' : 'No notes here yet.'}</div> : null}
          {list.data?.map((n) => (
            <button key={n.id} type="button" className={`list-item ${n.id === sub ? 'active' : ''}`} style={{ alignItems: 'flex-start' }} onClick={() => navigate(`/notes/${n.id}?view=${view}`)}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 4 }}>
                  {n.pinned ? <Pin size={12} color="var(--accent)" /> : null}
                  {n.favorite ? <Star size={12} color="var(--warn)" fill="var(--warn)" /> : null}
                  <span className="ellipsis" style={{ fontWeight: 560 }}>
                    {n.title || 'Untitled'}
                  </span>
                </div>
                <div className="small faint ellipsis">{n.excerpt || 'Empty note'}</div>
                <div className="row tiny faint" style={{ gap: 4, marginTop: 2 }}>
                  <span>{fmtRelative(n.updatedAt)}</span>
                  {n.tags.slice(0, 3).map((t) => (
                    <Badge key={t}>#{t}</Badge>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="pane">
        {sub === 'new' ? (
          <NewNote />
        ) : sub ? (
          <NoteEditor key={sub} id={sub} />
        ) : (
          <EmptyState
            icon={<NotebookPen size={28} />}
            title="Select a note or create one"
            action={
              <Button variant="primary" onClick={() => navigate('/notes/new')}>
                New note
              </Button>
            }
          >
            Notes are stored on this computer, work offline and save automatically.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
