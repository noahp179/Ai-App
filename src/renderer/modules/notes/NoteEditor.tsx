import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileJson,
  FileText,
  Pin,
  PinOff,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Note } from '../../../shared/types';
import { LinksPanel } from '../../components/LinksPanel';
import { Markdown } from '../../components/Markdown';
import { Banner, Button, ErrorState, IconButton, Input, Loading, Menu, Select, useConfirm, useToast } from '../../components/ui';
import { ApiError, api, errorMessage } from '../../lib/api';
import { fmtRelative } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate } from '../../lib/router';
import { useSettings } from '../../lib/settings';

type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Saved',
  pending: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Not saved',
  conflict: 'Changed elsewhere',
};

export function NoteEditor({ id }: { id: string }) {
  const { settings } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const loaded = useQuery(`notes:${id}`, () => api.notes.get(id));
  const folders = useQuery('notes:folders', () => api.notes.folders());
  const draft = useQuery(`notes:draft:${id}`, () => api.notes.draftFor(id));
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [state, setState] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(settings.notes.showPreview);
  const revision = useRef(0);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title: '', body: '' });

  // Take the server copy only when we have no local edits.
  useEffect(() => {
    const n = loaded.data;
    if (!n) return;
    if (note?.id === n.id && dirty.current) return;
    setNote(n);
    setTitle(n.title);
    setBody(n.body);
    setTags(n.tags.join(', '));
    revision.current = n.revision;
    latest.current = { title: n.title, body: n.body };
    setState('saved');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded.data]);

  const save = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!dirty.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setState('saving');
      const { title: t, body: b } = latest.current;
      try {
        const n = await api.notes.update(id, { title: t, body: b, expectedRevision: opts.force ? undefined : revision.current });
        revision.current = n.revision;
        if (latest.current.title === t && latest.current.body === b) {
          dirty.current = false;
          setState('saved');
        } else {
          setState('pending');
        }
        setNote(n);
        setError(null);
        invalidate('notes:list');
      } catch (err) {
        if (err instanceof ApiError && err.code === 'conflict') {
          setState('conflict');
        } else {
          setState('error');
          setError(errorMessage(err));
        }
      }
    },
    [id],
  );

  const onEdit = (t: string, b: string) => {
    setTitle(t);
    setBody(b);
    latest.current = { title: t, body: b };
    dirty.current = true;
    setState('pending');
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => void api.notes.saveDraft(id, t, b, revision.current).catch(() => {}), 250);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), settings.notes.autosaveDelayMs);
  };

  // Flush on leave so nothing is silently dropped.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (draftTimer.current) clearTimeout(draftTimer.current);
      if (dirty.current) void api.notes.update(id, { ...latest.current, expectedRevision: revision.current }).catch(() => {});
    },
    [id],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  if (loaded.error) return <ErrorState error={loaded.error} onRetry={loaded.reload} />;
  if (!note) return <Loading />;

  const patchMeta = async (patch: Parameters<typeof api.notes.update>[1]) => {
    try {
      const n = await api.notes.update(id, patch);
      setNote(n);
      revision.current = n.revision;
      invalidate('notes');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const exportAs = async (format: 'markdown' | 'text' | 'json') => {
    await save();
    const r = await api.notes.exportNote(id, format);
    if (r.saved) toast(`Exported to ${r.path}`, 'success');
  };
  const inTrash = !!note.deletedAt;
  const showPreview = preview && note.format === 'markdown';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="row" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', gap: 6 }}>
        <span className={`small ${state === 'error' || state === 'conflict' ? 'danger-text' : state === 'saved' ? 'faint' : 'muted'}`} role="status" aria-live="polite" data-testid="save-status">
          {SAVE_LABEL[state]}
          {state === 'saved' ? ` · edited ${fmtRelative(note.updatedAt)}` : ''}
        </span>
        <span className="spacer" />
        <Select aria-label="Format" value={note.format} onChange={(e) => void patchMeta({ format: e.target.value as Note['format'] })} style={{ width: 'auto' }} disabled={inTrash}>
          <option value="markdown">Markdown</option>
          <option value="plain">Plain text</option>
        </Select>
        {note.format === 'markdown' ? (
          <IconButton label={preview ? 'Hide preview' : 'Show preview'} active={preview} onClick={() => setPreview((v) => !v)}>
            {preview ? <Eye size={16} /> : <EyeOff size={16} />}
          </IconButton>
        ) : null}
        <IconButton label={note.pinned ? 'Unpin' : 'Pin'} active={note.pinned} onClick={() => void patchMeta({ pinned: !note.pinned })} disabled={inTrash}>
          {note.pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </IconButton>
        <IconButton label={note.favorite ? 'Remove from favorites' : 'Add to favorites'} active={note.favorite} onClick={() => void patchMeta({ favorite: !note.favorite })} disabled={inTrash}>
          <Star size={16} fill={note.favorite ? 'currentColor' : 'none'} />
        </IconButton>
        <Menu
          label="Note actions"
          icon={<Ellipsis size={16} />}
          items={[
            {
              label: 'Ask AI about this note',
              icon: <Sparkles size={14} />,
              onSelect: () => {
                void save();
                navigate(`/ai/new?prompt=${encodeURIComponent(`Help me with my note "${title || 'Untitled'}". (Attach it with the paperclip to share its text.)`)}`);
              },
            },
            { label: 'Duplicate', icon: <Copy size={14} />, onSelect: () => void api.notes.duplicate(id).then((n) => (invalidate('notes'), navigate(`/notes/${n.id}`))) },
            { label: 'Export as Markdown', icon: <Download size={14} />, onSelect: () => void exportAs('markdown') },
            { label: 'Export as plain text', icon: <FileText size={14} />, onSelect: () => void exportAs('text') },
            { label: 'Export as JSON', icon: <FileJson size={14} />, onSelect: () => void exportAs('json') },
            note.archivedAt
              ? { label: 'Unarchive', icon: <ArchiveRestore size={14} />, onSelect: () => void api.notes.unarchive(id).then(() => invalidate('notes')) }
              : { label: 'Archive', icon: <Archive size={14} />, onSelect: () => void api.notes.archive(id).then(() => invalidate('notes')) },
            inTrash
              ? null
              : {
                  label: 'Move to trash',
                  icon: <Trash2 size={14} />,
                  danger: true,
                  onSelect: async () => {
                    await save();
                    await api.notes.trash(id);
                    invalidate('notes');
                    toast(`Moved to trash. Trash is emptied after ${settings.notes.trashRetentionDays} days.`, 'info');
                    navigate('/notes');
                  },
                },
          ]}
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: showPreview ? 1200 : 820, margin: '0 auto', padding: '18px 24px' }} className="stack-4">
          {inTrash ? (
            <Banner tone="warn" title="This note is in the trash">
              <div className="row" style={{ marginTop: 6 }}>
                <Button size="sm" onClick={() => void api.notes.restore(id).then(() => invalidate('notes'))}>
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    if (await confirm({ title: 'Delete forever?', message: 'This note will be permanently deleted.', confirmLabel: 'Delete forever', danger: true })) {
                      await api.notes.deletePermanently(id);
                      invalidate('notes');
                      navigate('/notes?view=trash');
                    }
                  }}
                >
                  Delete forever
                </Button>
              </div>
            </Banner>
          ) : null}
          {draft.data && !dirty.current ? (
            <Banner tone="warn" title="Unsaved changes were recovered">
              FlowCompanion closed before your last edits to this note were saved ({fmtRelative(draft.data.savedAt)}).
              <div className="row" style={{ marginTop: 6 }}>
                <Button size="sm" variant="primary" onClick={() => void api.notes.recoverDraft(id).then(() => invalidate('notes'))}>
                  Restore my edits
                </Button>
                <Button size="sm" onClick={() => void api.notes.discardDraft(id).then(() => invalidate(`notes:draft:${id}`))}>
                  Discard them
                </Button>
              </div>
            </Banner>
          ) : null}
          {state === 'conflict' ? (
            <Banner tone="danger" title="This note was changed in another window">
              Your text is still here. Choose which version to keep.
              <div className="row" style={{ marginTop: 6 }}>
                <Button size="sm" variant="primary" onClick={() => void save({ force: true })}>
                  Keep mine
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    dirty.current = false;
                    void api.notes.discardDraft(id);
                    loaded.reload();
                  }}
                >
                  Load the other version
                </Button>
              </div>
            </Banner>
          ) : null}
          {state === 'error' && error ? <Banner tone="danger" title="Could not save">{error} Your text is kept as a recovery draft.</Banner> : null}
          <input
            className="input"
            aria-label="Title"
            placeholder="Untitled"
            value={title}
            readOnly={inTrash}
            onChange={(e) => onEdit(e.target.value, body)}
            style={{ fontSize: '1.5rem', fontWeight: 680, border: 0, background: 'transparent', padding: 0, height: 'auto', boxShadow: 'none' }}
          />
          <div className="row-wrap">
            <Select
              aria-label="Folder"
              value={note.folderId ?? ''}
              onChange={(e) => void patchMeta({ folderId: e.target.value || null })}
              style={{ width: 'auto', maxWidth: 200 }}
              disabled={inTrash}
            >
              <option value="">No folder</option>
              {folders.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Tags"
              placeholder="Tags, comma separated"
              value={tags}
              readOnly={inTrash}
              onChange={(e) => setTags(e.target.value)}
              onBlur={() => {
                const next = tags.split(',').map((t) => t.trim()).filter(Boolean);
                if (next.join(',') !== note.tags.join(',')) void patchMeta({ tags: next });
              }}
              style={{ flex: 1, minWidth: 200 }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr', gap: 20, alignItems: 'start' }}>
            <textarea
              className="textarea"
              aria-label="Note body"
              value={body}
              readOnly={inTrash}
              spellCheck={settings.notes.spellcheck}
              placeholder={note.format === 'markdown' ? 'Write in Markdown…' : 'Write…'}
              onChange={(e) => onEdit(title, e.target.value)}
              onBlur={() => void save()}
              style={{ minHeight: '55vh', fontFamily: note.format === 'markdown' ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: note.format === 'markdown' ? '0.92rem' : '1rem', lineHeight: 1.6 }}
            />
            {showPreview ? (
              <div className="card" style={{ minHeight: '55vh' }} aria-label="Preview">
                {body.trim() ? <Markdown source={body} copyContext="notes" /> : <span className="faint">Nothing to preview.</span>}
              </div>
            ) : null}
          </div>
          <LinksPanel type="note" id={id} />
        </div>
      </div>
    </div>
  );
}
