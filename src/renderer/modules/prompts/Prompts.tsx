import { BookMarked, Copy, Download, History, Plus, Search, Star, Store, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PromptQuery } from '../../../shared/api';
import { PROMPT_CATEGORIES, PROVIDER_LABELS, parseVariables } from '../../../shared/prompts';
import type { Prompt, ProviderLabel } from '../../../shared/types';
import { LinksPanel } from '../../components/LinksPanel';
import { PromptUse } from '../../components/PromptUse';
import { Badge, Button, EmptyState, Field, IconButton, Input, Loading, Modal, Select, Textarea, useConfirm, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtRelative } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { useSettings } from '../../lib/settings';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Draft {
  title: string;
  description: string;
  body: string;
  category: string;
  tags: string;
  providers: ProviderLabel[];
}
const toDraft = (p: Prompt | null): Draft => ({
  title: p?.title ?? '',
  description: p?.description ?? '',
  body: p?.body ?? '',
  category: p?.category ?? 'general',
  tags: p?.tags.join(', ') ?? '',
  providers: p?.providers ?? ['any'],
});

function Versions({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  const toast = useToast();
  const versions = useQuery(`prompts:versions:${prompt.id}:${prompt.version}`, () => api.prompts.versions(prompt.id));
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Modal title={`Version history — ${prompt.title}`} onClose={onClose} wide>
      {!versions.data ? <Loading /> : null}
      <div className="stack-3">
        {versions.data?.map((v) => (
          <div key={v.id} className="card stack-2" style={{ padding: 12 }}>
            <div className="row">
              <strong>Version {v.version}</strong>
              {v.version === prompt.version ? <Badge tone="accent">Current</Badge> : null}
              <span className="small muted grow">
                {fmtRelative(v.createdAt)}
                {v.note ? ` · ${v.note}` : ''}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setOpen(open === v.version ? null : v.version)}>
                {open === v.version ? 'Hide' : 'Show'}
              </Button>
              {v.version !== prompt.version ? (
                <Button
                  size="sm"
                  onClick={() =>
                    void api.prompts
                      .restoreVersion(prompt.id, v.version)
                      .then(() => {
                        invalidate('prompts');
                        toast(`Restored version ${v.version} as a new version`, 'success');
                        onClose();
                      })
                      .catch((e: unknown) => toast(errorMessage(e), 'error'))
                  }
                >
                  Restore
                </Button>
              ) : null}
            </div>
            {open === v.version ? (
              <>
                <div className="small">
                  <strong>{v.title}</strong>
                </div>
                <pre className="prompt-preview">{v.body}</pre>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function Editor({ id }: { id: string | null }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { settings } = useSettings();
  const q = useQuery(id ? `prompts:item:${id}` : null, () => api.prompts.get(id!));
  const cats = useQuery('prompts:categories', () => api.prompts.categories());
  const p = id ? (q.data ?? null) : null;
  const [d, setD] = useState<Draft>(toDraft(null));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  useEffect(() => {
    setD(toDraft(p));
    setNote('');
    // Reset the form when another prompt is opened or a new version arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, p?.version, p?.updatedAt]);
  const dirty = JSON.stringify(d) !== JSON.stringify(toDraft(p));
  const vars = useMemo(() => parseVariables(d.body), [d.body]);

  const save = async () => {
    setBusy(true);
    try {
      const input = { title: d.title, description: d.description, body: d.body, category: d.category, tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean), providers: d.providers };
      const saved = p ? await api.prompts.update(p.id, input, note) : await api.prompts.create(input);
      invalidate('prompts');
      toast(p ? (saved.version > p.version ? `Saved as version ${saved.version}` : 'Saved') : 'Prompt created', 'success');
      if (!p) navigate(`/prompts/${saved.id}`, { replace: true });
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (id && q.error) return <EmptyState title="Prompt not found" action={<Button onClick={() => navigate('/prompts')}>Back to library</Button>} />;
  if (id && !p) return <Loading />;
  const toggleProvider = (v: ProviderLabel) => {
    if (v === 'any') return setD({ ...d, providers: ['any'] });
    const cur = d.providers.filter((x) => x !== 'any');
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    setD({ ...d, providers: next.length ? next : ['any'] });
  };
  const categories = [...new Set([...PROMPT_CATEGORIES, ...(cats.data?.map((c) => c.category) ?? []), d.category])];

  return (
    <div
      className="stack-4"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          if (dirty || !p) void save();
        }
      }}
    >
      <div className="row">
        <h2 className="grow" style={{ fontSize: '1.15rem' }}>
          {p ? p.title : 'New prompt'}
        </h2>
        {p ? (
          <>
            <span className="small muted">Version {p.version}</span>
            <IconButton label={p.favorite ? 'Remove from favourites' : 'Add to favourites'} active={p.favorite} onClick={() => void api.prompts.setFavorite(p.id, !p.favorite).then(() => invalidate('prompts'))}>
              <Star size={15} fill={p.favorite ? 'currentColor' : 'none'} />
            </IconButton>
            <IconButton label="Version history" onClick={() => setShowVersions(true)}>
              <History size={15} />
            </IconButton>
            <IconButton label="Duplicate" onClick={() => void api.prompts.duplicate(p.id).then((n) => (invalidate('prompts'), navigate(`/prompts/${n.id}`)))}>
              <Copy size={15} />
            </IconButton>
            {settings.layout.modules.creator ? (
              <IconButton
                label="Share in the marketplace (opens Creator Studio)"
                onClick={() =>
                  void api.creator
                    .fromPrompt(p.id)
                    .then((l) => navigate(`/creator/${l.id}`))
                    .catch((e: unknown) => toast(errorMessage(e), 'error'))
                }
              >
                <Store size={15} />
              </IconButton>
            ) : null}
            <IconButton
              label="Delete prompt"
              onClick={async () => {
                if (!(await confirm({ title: 'Delete this prompt?', message: `“${p.title}” and all its versions will be deleted.`, confirmLabel: 'Delete', danger: true }))) return;
                await api.prompts.delete(p.id);
                invalidate('prompts');
                navigate('/prompts');
              }}
            >
              <Trash2 size={15} />
            </IconButton>
          </>
        ) : null}
      </div>
      {p?.origin === 'marketplace' && p.listingId ? (
        <p className="small muted">
          Saved from the marketplace.{' '}
          <button type="button" className="link-button" style={{ color: 'var(--accent)' }} onClick={() => navigate(`/marketplace/listing/${p.listingId}`)}>
            View listing
          </button>
        </p>
      ) : null}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(300px, 1.4fr) minmax(260px, 1fr)', alignItems: 'start' }}>
        <div className="card stack-3">
          <Field label="Title" htmlFor="pr-title">
            <Input id="pr-title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. Summarise a meeting" />
          </Field>
          <Field label="Prompt" htmlFor="pr-body" hint="Use {{name}} for something to fill in, or {{name:default}} to give a default.">
            <Textarea id="pr-body" className="mono" rows={12} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} placeholder="Write the prompt…" />
          </Field>
          {vars.length ? (
            <div className="row-wrap small" style={{ gap: 4 }}>
              <span className="muted">Variables:</span>
              {vars.map((v) => (
                <Badge key={v.name} tone={v.required ? 'accent' : 'outline'}>
                  {v.name}
                  {v.defaultValue !== null ? ` = ${v.defaultValue}` : ''}
                </Badge>
              ))}
            </div>
          ) : null}
          <Field label="Description" htmlFor="pr-desc">
            <Input id="pr-desc" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="What it is for (optional)" />
          </Field>
          <div className="field-row">
            <Field label="Category" htmlFor="pr-cat">
              <Select id="pr-cat" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {cap(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tags" htmlFor="pr-tags" hint="Comma separated">
              <Input id="pr-tags" value={d.tags} onChange={(e) => setD({ ...d, tags: e.target.value })} />
            </Field>
          </div>
          <Field label="Works with">
            <div className="row-wrap" style={{ gap: 4 }} role="group" aria-label="Works with">
              {PROVIDER_LABELS.map((pl) => (
                <button key={pl.value} type="button" className="chip" aria-pressed={d.providers.includes(pl.value)} onClick={() => toggleProvider(pl.value)}>
                  {pl.label}
                </button>
              ))}
            </div>
          </Field>
          <div className="row-wrap">
            {p && dirty && (d.body !== p.body || d.title !== p.title) ? (
              <Input aria-label="What changed (optional)" placeholder="What changed? (optional, saved with the version)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            ) : null}
            <span className="spacer" />
            <span className="small muted" data-testid="prompt-save-state">
              {p ? (dirty ? 'Unsaved changes' : 'Saved') : ''}
            </span>
            <Button variant="primary" loading={busy} disabled={!d.body.trim() || (!!p && !dirty)} onClick={() => void save()}>
              {p ? 'Save' : 'Create prompt'}
            </Button>
          </div>
        </div>
        <div className="stack-4">
          {p ? (
            <div className="card stack-3">
              <h3>Use this prompt</h3>
              <PromptUse key={`${p.id}:${p.version}`} body={p.body} context="prompts" onUse={() => void api.prompts.recordUse(p.id).then(() => invalidate('prompts'))} />
              <p className="tiny faint">
                Used {p.useCount} time{p.useCount === 1 ? '' : 's'}
                {p.lastUsedAt ? `, last ${fmtRelative(p.lastUsedAt)}` : ''}.
              </p>
            </div>
          ) : null}
          {p ? (
            <div className="card">
              <LinksPanel type="prompt" id={p.id} />
            </div>
          ) : null}
        </div>
      </div>
      {showVersions && p ? <Versions prompt={p} onClose={() => setShowVersions(false)} /> : null}
    </div>
  );
}

export default function Prompts() {
  const route = useRoute();
  const toast = useToast();
  const { settings } = useSettings();
  const [q, setQ] = useState<PromptQuery>({ sort: 'recent' });
  const list = useQuery(`prompts:list:${JSON.stringify(q)}`, () => api.prompts.list(q));
  const cats = useQuery('prompts:categories', () => api.prompts.categories());
  const sel = route.segments[1] ?? null;
  const isNew = sel === 'new';

  return (
    <div className="split" style={{ gridTemplateColumns: '320px 1fr' }}>
      <aside className="pane pane-list" aria-label="Prompts">
        <div className="stack-3" style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <div className="row">
            <h1 className="grow" style={{ fontSize: '1.1rem' }}>
              Prompt Library
            </h1>
            <IconButton label="Import prompts" onClick={() => void api.prompts.importFile().then((r) => r && (invalidate('prompts'), toast(`Imported ${r.imported}, skipped ${r.skipped}${r.errors.length ? `, ${r.errors.length} errors` : ''}`, r.errors.length ? 'error' : 'success')))}>
              <Upload size={15} />
            </IconButton>
            <IconButton label="Export all prompts" onClick={() => void api.prompts.exportFile().then((r) => r.saved && toast('Prompts exported', 'success'))}>
              <Download size={15} />
            </IconButton>
            <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => navigate('/prompts/new')}>
              New
            </Button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 9, top: 10, color: 'var(--text-faint)' }} aria-hidden />
            <Input placeholder="Search prompts" aria-label="Search prompts" value={q.search ?? ''} onChange={(e) => setQ({ ...q, search: e.target.value })} style={{ paddingLeft: 28 }} />
          </div>
          <div className="row">
            <Select aria-label="Category" value={q.category ?? 'all'} onChange={(e) => setQ({ ...q, category: e.target.value })}>
              <option value="all">All categories</option>
              {cats.data
                ?.filter((c) => c.count > 0)
                .map((c) => (
                  <option key={c.category} value={c.category}>
                    {cap(c.category)} ({c.count})
                  </option>
                ))}
            </Select>
            <Select aria-label="Sort" value={q.sort ?? 'recent'} onChange={(e) => setQ({ ...q, sort: e.target.value as PromptQuery['sort'] })} style={{ width: 130 }}>
              <option value="recent">Recent</option>
              <option value="used">Most used</option>
              <option value="title">A–Z</option>
            </Select>
            <IconButton label="Favourites only" active={!!q.favorite} onClick={() => setQ({ ...q, favorite: !q.favorite })}>
              <Star size={15} fill={q.favorite ? 'currentColor' : 'none'} />
            </IconButton>
          </div>
        </div>
        <div className="list" style={{ overflow: 'auto' }}>
          {list.data?.length === 0 ? (
            <div className="small muted" style={{ padding: 16 }}>
              {q.search || q.favorite || (q.category && q.category !== 'all') ? 'No prompts match.' : 'No prompts yet.'}
              {settings.layout.modules.marketplace && !q.search ? (
                <div style={{ marginTop: 8 }}>
                  <Button size="sm" onClick={() => navigate('/marketplace')}>
                    Browse free starter prompts
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {list.data?.map((p) => (
            <button key={p.id} type="button" className={`list-item ${sel === p.id ? 'active' : ''}`} aria-current={sel === p.id ? 'true' : undefined} onClick={() => navigate(`/prompts/${p.id}`)} style={{ alignItems: 'flex-start' }}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 4 }}>
                  {p.favorite ? <Star size={12} fill="var(--warn)" color="var(--warn)" aria-label="Favourite" /> : null}
                  <span className="ellipsis" style={{ fontWeight: 560 }}>
                    {p.title}
                  </span>
                </div>
                <div className="tiny faint ellipsis">
                  {cap(p.category)} · v{p.version}
                  {p.origin === 'marketplace' ? ' · from marketplace' : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>
      <section className="pane" style={{ padding: 20 }}>
        {sel || isNew ? (
          <Editor key={sel ?? 'new'} id={isNew ? null : sel} />
        ) : (
          <EmptyState icon={<BookMarked size={30} />} title="Your prompt library" action={<Button onClick={() => navigate('/prompts/new')}>New prompt</Button>}>
            Save prompts you use often, with {'{{variables}}'} to fill in each time. Every edit keeps a version you can go back to.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
