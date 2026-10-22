import { BellPlus, BookmarkPlus, Check, ExternalLink, Newspaper, Plus, RefreshCw, Search, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FeedItem, FeedRefreshResult } from '../../../shared/types';
import { Badge, Banner, Button, EmptyState, Field, IconButton, Input, Loading, Select, Tabs, Toggle, useToast } from '../../components/ui';
import { api, errorMessage, onAppEvent } from '../../lib/api';
import { fmtRelative } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { useSettings } from '../../lib/settings';

function ItemCard({ it }: { it: FeedItem }) {
  const toast = useToast();
  const dups = useQuery(`news:dups:${it.id}`, () => api.news.duplicates(it.id));
  const open = () => {
    void api.app.openExternal(it.url);
    if (!it.readAt) void api.news.markRead(it.id, true).then(() => invalidate('news'));
  };
  const run = (p: Promise<unknown>, msg?: string) =>
    void p
      .then(() => {
        invalidate('news', 'bookmarks');
        if (msg) toast(msg, 'success');
      })
      .catch((err: unknown) => toast(errorMessage(err), 'error'));
  return (
    <article className="card" style={{ opacity: it.readAt ? 0.65 : 1 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow" style={{ minWidth: 0 }}>
          <a
            href={it.url}
            onClick={(e) => {
              e.preventDefault();
              open();
            }}
            style={{ color: 'var(--text)', fontWeight: 620, fontSize: '1.02rem' }}
          >
            {it.title}
          </a>
          <div className="small faint" style={{ marginTop: 2 }}>
            <strong style={{ color: 'var(--text-muted)' }}>{it.sourceName}</strong>
            {it.author ? ` · ${it.author}` : ''}
            {it.publishedAt ? ` · ${fmtRelative(it.publishedAt)}` : ' · date not given'}
          </div>
          {it.summary ? <p className="small muted" style={{ marginTop: 6 }}>{it.summary}</p> : null}
          {dups.data?.length ? <div className="tiny faint" style={{ marginTop: 4 }}>Also reported by {dups.data.map((d) => d.sourceName).join(', ')}</div> : null}
        </div>
        <div className="col" style={{ gap: 2 }}>
          <IconButton label="Open the article on the publisher’s site" size="sm" onClick={open}>
            <ExternalLink size={14} />
          </IconButton>
          <IconButton label={it.savedAt ? 'Remove from saved' : 'Save'} size="sm" active={!!it.savedAt} onClick={() => run(api.news.setSaved(it.id, !it.savedAt))}>
            <Star size={14} fill={it.savedAt ? 'currentColor' : 'none'} />
          </IconButton>
          <IconButton label="Add to reading queue" size="sm" onClick={() => run(api.news.addToReadingQueue(it.id), 'Added to your reading queue')}>
            <BookmarkPlus size={14} />
          </IconButton>
          <IconButton label={it.readAt ? 'Mark unread' : 'Mark read'} size="sm" onClick={() => run(api.news.markRead(it.id, !it.readAt))}>
            <Check size={14} />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

function FeedTab({ saved }: { saved: boolean }) {
  const { settings, update } = useSettings();
  const toast = useToast();
  const cats = useQuery('news:categories', () => api.news.categories());
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [unread, setUnread] = useState(settings.feed.hideRead);
  const [refreshing, setRefreshing] = useState(false);
  const [lastResults, setLastResults] = useState<FeedRefreshResult[] | null>(null);
  const items = useQuery(`news:items:${saved}:${cat ?? ''}:${q}:${unread}`, () => api.news.items({ savedOnly: saved, category: cat ?? undefined, search: q || undefined, unreadOnly: unread && !saved }));
  const last = useQuery('news:last', () => api.news.lastRefresh());
  useEffect(() => onAppEvent('feed.refreshed', (r) => (setLastResults(r), invalidate('news'))), []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await api.news.refresh();
      setLastResults(r);
      const fresh = r.reduce((n, x) => n + x.newItems, 0);
      toast(`${fresh} new item${fresh === 1 ? '' : 's'} from ${r.filter((x) => x.ok).length} source${r.length === 1 ? '' : 's'}`, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setRefreshing(false);
    }
  };
  const failures = lastResults?.filter((r) => !r.ok) ?? [];
  const topics = settings.feed.topics;

  return (
    <div className="stack-4">
      {!saved ? (
        <div className="row-wrap" style={{ gap: 4 }}>
          <button type="button" className="chip" aria-pressed={cat === null} onClick={() => setCat(null)}>
            All followed
          </button>
          {cats.data
            ?.filter((c) => c.id !== 'custom')
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={cat === c.id}
                title={topics.includes(c.id) ? 'Followed topic' : 'Not followed — click Follow to include it in your feed'}
                onClick={() => setCat(c.id)}
              >
                {c.label}
                {topics.includes(c.id) ? null : <span className="faint">·</span>}
              </button>
            ))}
          {cat && cat !== 'custom' ? (
            <Button size="sm" variant="ghost" onClick={() => void update({ feed: { topics: topics.includes(cat) ? topics.filter((t) => t !== cat) : [...topics, cat] } })}>
              {topics.includes(cat) ? 'Unfollow topic' : 'Follow topic'}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="row-wrap">
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 9, top: 10, color: 'var(--text-faint)' }} />
          <Input placeholder="Search headlines" aria-label="Search headlines" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 28 }} />
        </div>
        {!saved ? (
          <>
            <Toggle checked={unread} onChange={setUnread} label="Unread only" />
            <Button size="sm" onClick={() => void api.news.markAllRead(cat ?? undefined).then(() => invalidate('news'))}>
              Mark all read
            </Button>
            <Button size="sm" variant="primary" loading={refreshing} icon={<RefreshCw size={13} />} onClick={() => void refresh()}>
              Refresh
            </Button>
          </>
        ) : null}
      </div>
      {!saved ? (
        <div className="small faint">
          {last.data ? `Last refreshed ${fmtRelative(last.data)}.` : 'Not refreshed yet.'} Headlines and short previews come from each publisher’s public feed; articles open on the publisher’s site.
        </div>
      ) : null}
      {failures.length ? (
        <Banner tone="warn" title={`${failures.length} source${failures.length === 1 ? '' : 's'} could not be refreshed`}>
          {failures.slice(0, 4).map((f) => `${f.name}: ${f.error}`).join(' · ')}
          {failures.length > 4 ? ' …' : ''} Previously downloaded headlines are still shown.
        </Banner>
      ) : null}
      {!items.data ? <Loading /> : null}
      {items.data?.length === 0 ? (
        <EmptyState title={saved ? 'No saved articles' : 'No headlines yet'} icon={<Newspaper size={28} />} action={!saved ? <Button onClick={() => void refresh()}>Refresh now</Button> : undefined}>
          {saved ? 'Star an article to keep it here; saved articles are also searchable.' : topics.length === 0 ? 'You are not following any topics. Pick one above.' : 'Refresh to download headlines from your sources.'}
        </EmptyState>
      ) : null}
      <div className="stack-3">{items.data?.map((it) => <ItemCard key={it.id} it={it} />)}</div>
    </div>
  );
}

function SourcesTab() {
  const toast = useToast();
  const sources = useQuery('news:sources', () => api.news.sources());
  const cats = useQuery('news:categories', () => api.news.categories());
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [cat, setCat] = useState('custom');
  const [busy, setBusy] = useState(false);
  const run = (p: Promise<unknown>) => void p.then(() => invalidate('news')).catch((err: unknown) => toast(errorMessage(err), 'error'));
  const allSources = sources.data;
  if (!allSources || !cats.data) return <Loading />;
  return (
    <div className="stack-4">
      <form
        className="card stack-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await api.news.addSource({ url, name: name || undefined, category: cat });
            toast(`Added ${r.source.name} (${r.result.newItems} items)`, 'success');
            setUrl('');
            setName('');
            invalidate('news');
          } catch (err) {
            toast(errorMessage(err), 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>Add an RSS or Atom feed</h3>
        <div className="row-wrap">
          <Input placeholder="https://example.com/feed.xml" aria-label="Feed address" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 2, minWidth: 240 }} />
          <Input placeholder="Name (optional)" aria-label="Feed name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 150 }} />
          <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 160 }}>
            {cats.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary" loading={busy} disabled={!url.trim()} icon={<Plus size={14} />}>
            Add
          </Button>
        </div>
        <p className="small faint">The feed is fetched once to check it works. Use only feeds you are allowed to read.</p>
      </form>
      {cats.data.map((c) => {
        const list = allSources.filter((s) => s.category === c.id);
        if (!list.length) return null;
        return (
          <div key={c.id} className="card stack-3">
            <h3>{c.label}</h3>
            {list.map((s) => (
              <div key={s.id} className="row" style={{ alignItems: 'flex-start', opacity: s.blocked ? 0.6 : 1 }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <strong className="ellipsis">{s.name}</strong>
                    {s.builtin ? <Badge>Built-in</Badge> : <Badge tone="accent">Yours</Badge>}
                    {s.blocked ? <Badge tone="danger">Blocked</Badge> : null}
                  </div>
                  <div className="tiny faint ellipsis">{s.url}</div>
                  <div className={`tiny ${s.lastError ? 'warn-text' : 'faint'}`}>
                    {s.lastError ? `Last attempt failed: ${s.lastError}` : s.lastFetchedAt ? `Updated ${fmtRelative(s.lastFetchedAt)} · ${s.itemCount ?? 0} items cached` : 'Not fetched yet'}
                  </div>
                </div>
                <Toggle checked={s.enabled} onChange={(v) => run(api.news.updateSource(s.id, { enabled: v }))} label="On" />
                <Button size="sm" variant="ghost" onClick={() => run(api.news.updateSource(s.id, { blocked: !s.blocked }))}>
                  {s.blocked ? 'Unblock' : 'Block'}
                </Button>
                {!s.builtin ? (
                  <IconButton label="Remove source" size="sm" onClick={() => run(api.news.removeSource(s.id))}>
                    <Trash2 size={13} />
                  </IconButton>
                ) : null}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function AlertsTab() {
  const { settings, update } = useSettings();
  const toast = useToast();
  const alerts = useQuery('news:alerts', () => api.news.alerts());
  const [kw, setKw] = useState('');
  return (
    <div className="stack-4">
      <div className="card stack-3">
        <Toggle checked={settings.feed.alertsEnabled} onChange={(v) => void update({ feed: { alertsEnabled: v } })} label="Notify me about new headlines that match a keyword" description="Checked each time feeds refresh. Only new items trigger alerts." />
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void api.news
              .addAlert(kw)
              .then(() => (setKw(''), invalidate('news')))
              .catch((err: unknown) => toast(errorMessage(err), 'error'));
          }}
        >
          <Field label="Keyword" htmlFor="kw">
            <Input id="kw" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="e.g. open-source model" />
          </Field>
          <Button type="submit" icon={<BellPlus size={14} />} disabled={kw.trim().length < 2} style={{ alignSelf: 'flex-end' }}>
            Add alert
          </Button>
        </form>
      </div>
      {alerts.data?.length === 0 ? <EmptyState title="No alerts yet" /> : null}
      {alerts.data?.map((a) => (
        <div key={a.id} className="card row">
          <strong className="grow">{a.keyword}</strong>
          <Toggle checked={a.enabled} onChange={(v) => void api.news.setAlertEnabled(a.id, v).then(() => invalidate('news'))} label="On" />
          <IconButton label="Remove alert" onClick={() => void api.news.removeAlert(a.id).then(() => invalidate('news'))}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

export default function News() {
  const route = useRoute();
  const tab = (['feed', 'saved', 'sources', 'alerts'].includes(route.segments[1] ?? '') ? route.segments[1] : 'feed') as 'feed' | 'saved' | 'sources' | 'alerts';
  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <Tabs
        label="News sections"
        value={tab}
        onChange={(v) => navigate(`/news/${v}`)}
        tabs={[
          { value: 'feed', label: 'Headlines' },
          { value: 'saved', label: 'Saved' },
          { value: 'sources', label: 'Sources' },
          { value: 'alerts', label: 'Alerts' },
        ]}
      />
      {tab === 'feed' ? <FeedTab saved={false} /> : null}
      {tab === 'saved' ? <FeedTab saved /> : null}
      {tab === 'sources' ? <SourcesTab /> : null}
      {tab === 'alerts' ? <AlertsTab /> : null}
    </div>
  );
}
