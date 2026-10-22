import type { Settings } from '../../shared/settings';
import type { FeedAlert, FeedItem, FeedQuery, FeedRefreshResult, FeedSource } from '../../shared/types';
import type { Db } from '../db/database';
import { bool, ftsQuery } from '../db/database';
import type { KvStore } from '../kv';
import { type Clock, NotFoundError, UserError, cleanLine, newId, safeHttpUrl } from '../util';
import { FeedParseError, parseFeed, titleKey, urlKey } from './parser';
import { DEFAULT_SOURCES, FEED_CATEGORIES } from './sources';

interface SourceRow {
  id: string;
  name: string;
  url: string;
  site_url: string;
  category: string;
  enabled: number;
  blocked: number;
  builtin: number;
  etag: string | null;
  last_modified: string | null;
  last_fetched_at: string | null;
  last_error: string | null;
  created_at: string;
  item_count?: number;
}

interface ItemRow {
  id: string;
  source_id: string;
  source_name: string;
  category: string;
  guid: string;
  url: string;
  title: string;
  summary: string;
  author: string;
  published_at: string | null;
  fetched_at: string;
  read_at: string | null;
  saved_at: string | null;
  duplicate_of: string | null;
}

const toSource = (r: SourceRow): FeedSource => ({
  id: r.id,
  name: r.name,
  url: r.url,
  siteUrl: r.site_url,
  category: r.category,
  enabled: bool(r.enabled),
  blocked: bool(r.blocked),
  builtin: bool(r.builtin),
  lastFetchedAt: r.last_fetched_at,
  lastError: r.last_error,
  itemCount: r.item_count,
});

const toItem = (r: ItemRow): FeedItem => ({
  id: r.id,
  sourceId: r.source_id,
  sourceName: r.source_name,
  category: r.category,
  url: r.url,
  title: r.title,
  summary: r.summary,
  author: r.author,
  publishedAt: r.published_at,
  fetchedAt: r.fetched_at,
  readAt: r.read_at,
  savedAt: r.saved_at,
  duplicateOf: r.duplicate_of,
});

const MAX_BYTES = 5 * 1024 * 1024;
const KEEP_PER_SOURCE = 200;

async function readLimited(res: Response, limit: number): Promise<string> {
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > limit) throw new FeedParseError('Feed is larger than 5 MB.');
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new FeedParseError('Feed is larger than 5 MB.');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export interface FeedDeps {
  db: Db;
  clock: Clock;
  kv: KvStore;
  settings: () => Settings;
  fetch: typeof fetch;
  userAgent: string;
  onAlert: (item: FeedItem, keyword: string) => void;
}

/** News from RSS/Atom feeds. Only short previews are stored; full articles open in the browser. */
export class FeedService {
  private refreshing: Promise<FeedRefreshResult[]> | null = null;

  constructor(private readonly d: FeedDeps) {}

  private get db() {
    return this.d.db;
  }

  categories() {
    return FEED_CATEGORIES.map((c) => ({ ...c }));
  }

  /** Adds the built-in sources once. Later removals by the user are respected. */
  seedDefaults(): void {
    if (this.d.kv.get('feed:seeded', false)) return;
    const now = this.d.clock.now().toISOString();
    this.db.tx(() => {
      for (const s of DEFAULT_SOURCES) {
        this.db.run(
          `INSERT OR IGNORE INTO feed_sources (id, name, url, site_url, category, enabled, blocked, builtin, created_at) VALUES (?, ?, ?, ?, ?, 1, 0, 1, ?)`,
          [newId(), s.name, s.url, s.siteUrl, s.category, now],
        );
      }
    });
    this.d.kv.set('feed:seeded', true);
  }

  sources(): FeedSource[] {
    return this.db
      .all<SourceRow>(`SELECT s.*, (SELECT COUNT(*) FROM feed_items i WHERE i.source_id = s.id) AS item_count FROM feed_sources s ORDER BY s.category, s.name`)
      .map(toSource);
  }

  private source(id: string): SourceRow {
    const r = this.db.get<SourceRow>('SELECT * FROM feed_sources WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That source');
    return r;
  }

  async addSource(input: { url: string; name?: string; category?: string }): Promise<{ source: FeedSource; result: FeedRefreshResult }> {
    const url = safeHttpUrl(input.url ?? '');
    if (!url) throw new UserError('Enter the feed address (starting with http:// or https://).');
    if (this.db.get('SELECT 1 FROM feed_sources WHERE url = ?', [url])) throw new UserError('You already follow this feed.');
    const category = FEED_CATEGORIES.some((c) => c.id === input.category) ? input.category! : 'custom';
    const id = newId();
    this.db.run('INSERT INTO feed_sources (id, name, url, site_url, category, enabled, blocked, builtin, created_at) VALUES (?, ?, ?, ?, ?, 1, 0, 0, ?)', [
      id,
      cleanLine(input.name ?? '', 120) || new URL(url).hostname,
      url,
      '',
      category,
      this.d.clock.now().toISOString(),
    ]);
    const [result] = await this.refresh([id], { force: true });
    if (!result?.ok) {
      this.db.run('DELETE FROM feed_sources WHERE id = ?', [id]);
      throw new UserError(`Could not add this feed: ${result?.error ?? 'unknown error'}`);
    }
    return { source: toSource(this.source(id)), result };
  }

  updateSource(id: string, patch: { name?: string; category?: string; enabled?: boolean; blocked?: boolean }): FeedSource {
    const cur = this.source(id);
    if (patch.category && !FEED_CATEGORIES.some((c) => c.id === patch.category)) throw new UserError('Unknown category.');
    this.db.run('UPDATE feed_sources SET name = ?, category = ?, enabled = ?, blocked = ? WHERE id = ?', [
      patch.name !== undefined ? cleanLine(patch.name, 120) || cur.name : cur.name,
      patch.category ?? cur.category,
      patch.enabled ?? bool(cur.enabled),
      patch.blocked ?? bool(cur.blocked),
      id,
    ]);
    return toSource(this.source(id));
  }

  removeSource(id: string): void {
    this.source(id);
    this.db.run('DELETE FROM feed_sources WHERE id = ?', [id]);
  }

  /** Sources that a refresh should fetch: enabled, not blocked, and in a followed topic (custom sources always). */
  private activeSources(ids?: string[]): SourceRow[] {
    const topics = new Set(this.d.settings().feed.topics);
    return this.db
      .all<SourceRow>('SELECT * FROM feed_sources WHERE enabled = 1 AND blocked = 0')
      .filter((s) => (ids ? ids.includes(s.id) : s.category === 'custom' || topics.has(s.category)));
  }

  /** Fetches sources (4 at a time). Concurrent calls share one refresh. */
  refresh(ids?: string[], opts: { force?: boolean } = {}): Promise<FeedRefreshResult[]> {
    if (this.refreshing && !ids) return this.refreshing;
    const run = (async () => {
      const list = this.activeSources(ids);
      const results: FeedRefreshResult[] = [];
      for (let i = 0; i < list.length; i += 4) {
        results.push(...(await Promise.all(list.slice(i, i + 4).map((s) => this.fetchSource(s, opts.force ?? false)))));
      }
      this.d.kv.set('feed:lastRefresh', this.d.clock.now().toISOString());
      return results;
    })();
    if (!ids) {
      this.refreshing = run.finally(() => {
        this.refreshing = null;
      });
      return this.refreshing;
    }
    return run;
  }

  lastRefresh(): string | null {
    return this.d.kv.get<string | null>('feed:lastRefresh', null);
  }

  private async fetchSource(s: SourceRow, force: boolean): Promise<FeedRefreshResult> {
    const now = this.d.clock.now().toISOString();
    const base = { sourceId: s.id, name: s.name };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const headers: Record<string, string> = { 'User-Agent': this.d.userAgent, Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5' };
      if (!force && s.etag) headers['If-None-Match'] = s.etag;
      if (!force && s.last_modified) headers['If-Modified-Since'] = s.last_modified;
      const res = await this.d.fetch(s.url, { headers, signal: ctrl.signal, redirect: 'follow' });
      if (res.status === 304) {
        this.db.run('UPDATE feed_sources SET last_fetched_at = ?, last_error = NULL WHERE id = ?', [now, s.id]);
        return { ...base, ok: true, newItems: 0, error: null, notModified: true };
      }
      if (!res.ok) throw new FeedParseError(`The server answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}.`);
      const xml = await readLimited(res, MAX_BYTES);
      const parsed = parseFeed(xml, s.url, { previewLength: this.d.settings().feed.previewLength, maxItems: 60 });
      const newItems = this.store(s, parsed.items, now);
      this.db.run('UPDATE feed_sources SET etag = ?, last_modified = ?, last_fetched_at = ?, last_error = NULL, site_url = COALESCE(NULLIF(site_url, \'\'), ?) WHERE id = ?', [
        res.headers.get('etag'),
        res.headers.get('last-modified'),
        now,
        parsed.siteUrl,
        s.id,
      ]);
      return { ...base, ok: true, newItems, error: null, notModified: false };
    } catch (err) {
      const msg =
        err instanceof FeedParseError
          ? err.message
          : ctrl.signal.aborted
            ? 'Timed out after 20 seconds.'
            : `Could not connect (${err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err)}).`;
      this.db.run('UPDATE feed_sources SET last_fetched_at = ?, last_error = ? WHERE id = ?', [now, msg, s.id]);
      return { ...base, ok: false, newItems: 0, error: msg, notModified: false };
    } finally {
      clearTimeout(timer);
    }
  }

  private store(s: SourceRow, items: ReturnType<typeof parseFeed>['items'], now: string): number {
    const alerts = this.d.settings().feed.alertsEnabled ? this.alerts().filter((a) => a.enabled) : [];
    let added = 0;
    const fresh: FeedItem[] = [];
    this.db.tx(() => {
      for (const it of items) {
        const uk = urlKey(it.url);
        const tk = titleKey(it.title);
        const dup = this.db.get<{ id: string }>(
          'SELECT id FROM feed_items WHERE source_id != ? AND duplicate_of IS NULL AND (url_key = ? OR (title_key = ? AND length(title_key) > 20)) LIMIT 1',
          [s.id, uk, tk],
        );
        const id = newId();
        const r = this.db.run(
          `INSERT OR IGNORE INTO feed_items (id, source_id, guid, url, title, summary, author, published_at, fetched_at, url_key, title_key, duplicate_of)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, s.id, it.guid.slice(0, 500), it.url, it.title, it.summary, it.author, it.publishedAt, now, uk, tk, dup?.id ?? null],
        );
        if (r.changes > 0) {
          added++;
          if (!dup) fresh.push({ id, sourceId: s.id, sourceName: s.name, category: s.category, url: it.url, title: it.title, summary: it.summary, author: it.author, publishedAt: it.publishedAt, fetchedAt: now, readAt: null, savedAt: null, duplicateOf: null });
        }
      }
      // Keep the cache bounded; never drop saved items.
      this.db.run(
        `DELETE FROM feed_items WHERE source_id = ? AND saved_at IS NULL AND id NOT IN (
           SELECT id FROM feed_items WHERE source_id = ? ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT ?)`,
        [s.id, s.id, KEEP_PER_SOURCE],
      );
    });
    // Alerts only for items first seen after the source's first fetch, to avoid a burst on setup.
    if (s.last_fetched_at && alerts.length) {
      for (const item of fresh) {
        const hay = `${item.title} ${item.summary}`.toLowerCase();
        const hit = alerts.find((a) => new RegExp(`\\b${a.keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(hay));
        if (hit) this.d.onAlert(item, hit.keyword);
      }
    }
    return added;
  }

  items(q: FeedQuery = {}): FeedItem[] {
    const where = ['s.blocked = 0'];
    const params: (string | number)[] = [];
    if (!q.savedOnly) where.push('i.duplicate_of IS NULL');
    if (q.category) {
      where.push('s.category = ?');
      params.push(q.category);
    } else if (!q.savedOnly && !q.sourceId) {
      const topics = this.d.settings().feed.topics;
      where.push(`(s.category = 'custom' OR s.category IN (${topics.map(() => '?').join(',') || "''"}))`);
      params.push(...topics);
    }
    if (q.sourceId) {
      where.push('i.source_id = ?');
      params.push(q.sourceId);
    }
    if (q.savedOnly) where.push('i.saved_at IS NOT NULL');
    if (q.unreadOnly) where.push('i.read_at IS NULL');
    if (q.search?.trim()) {
      const like = `%${q.search.trim().replace(/[%_]/g, '')}%`;
      where.push('(i.title LIKE ? OR i.summary LIKE ?)');
      params.push(like, like);
    }
    params.push(Math.min(Math.max(q.limit ?? 150, 1), 500));
    return this.db
      .all<ItemRow>(
        `SELECT i.*, s.name AS source_name, s.category AS category FROM feed_items i JOIN feed_sources s ON s.id = i.source_id
         WHERE ${where.join(' AND ')} ORDER BY COALESCE(i.published_at, i.fetched_at) DESC LIMIT ?`,
        params,
      )
      .map(toItem);
  }

  /** Other sources that carried the same story. */
  duplicatesOf(id: string): FeedItem[] {
    return this.db
      .all<ItemRow>('SELECT i.*, s.name AS source_name, s.category AS category FROM feed_items i JOIN feed_sources s ON s.id = i.source_id WHERE i.duplicate_of = ?', [id])
      .map(toItem);
  }

  get(id: string): FeedItem {
    const r = this.db.get<ItemRow>('SELECT i.*, s.name AS source_name, s.category AS category FROM feed_items i JOIN feed_sources s ON s.id = i.source_id WHERE i.id = ?', [id]);
    if (!r) throw new NotFoundError('That article');
    return toItem(r);
  }

  markRead(id: string, read: boolean): void {
    this.get(id);
    this.db.run('UPDATE feed_items SET read_at = ? WHERE id = ? OR duplicate_of = ?', [read ? this.d.clock.now().toISOString() : null, id, id]);
  }

  markAllRead(category?: string): number {
    const now = this.d.clock.now().toISOString();
    if (category) {
      return this.db.run('UPDATE feed_items SET read_at = ? WHERE read_at IS NULL AND source_id IN (SELECT id FROM feed_sources WHERE category = ?)', [now, category]).changes;
    }
    return this.db.run('UPDATE feed_items SET read_at = ? WHERE read_at IS NULL', [now]).changes;
  }

  setSaved(id: string, saved: boolean): FeedItem {
    this.get(id);
    this.db.run('UPDATE feed_items SET saved_at = ? WHERE id = ?', [saved ? this.d.clock.now().toISOString() : null, id]);
    return this.get(id);
  }

  unreadCount(): number {
    const topics = this.d.settings().feed.topics;
    return (
      this.db.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM feed_items i JOIN feed_sources s ON s.id = i.source_id
         WHERE i.read_at IS NULL AND i.duplicate_of IS NULL AND s.blocked = 0 AND (s.category = 'custom' OR s.category IN (${topics.map(() => '?').join(',') || "''"}))`,
        topics,
      )?.n ?? 0
    );
  }

  // ─────────── Alerts ───────────

  alerts(): FeedAlert[] {
    return this.db
      .all<{ id: string; keyword: string; enabled: number; created_at: string }>('SELECT * FROM feed_alerts ORDER BY keyword')
      .map((r) => ({ id: r.id, keyword: r.keyword, enabled: bool(r.enabled), createdAt: r.created_at }));
  }

  addAlert(keyword: string): FeedAlert {
    const k = cleanLine(String(keyword ?? ''), 60);
    if (k.length < 2) throw new UserError('Alert keywords need at least 2 characters.');
    if (this.db.get('SELECT 1 FROM feed_alerts WHERE keyword = ? COLLATE NOCASE', [k])) throw new UserError('You already have this alert.');
    const id = newId();
    this.db.run('INSERT INTO feed_alerts (id, keyword, enabled, created_at) VALUES (?, ?, 1, ?)', [id, k, this.d.clock.now().toISOString()]);
    return this.alerts().find((a) => a.id === id)!;
  }

  setAlertEnabled(id: string, enabled: boolean): void {
    this.db.run('UPDATE feed_alerts SET enabled = ? WHERE id = ?', [enabled, id]);
  }

  removeAlert(id: string): void {
    this.db.run('DELETE FROM feed_alerts WHERE id = ?', [id]);
  }

  /** Saved articles are indexed for global search. */
  searchSaved(q: string): FeedItem[] {
    const fts = ftsQuery(q);
    if (!fts) return [];
    return this.db
      .all<ItemRow>(
        `SELECT i.*, s.name AS source_name, s.category AS category FROM feed_items i JOIN feed_sources s ON s.id = i.source_id
         WHERE i.id IN (SELECT ref_id FROM search_index WHERE search_index MATCH ? AND type = 'article')`,
        [fts],
      )
      .map(toItem);
  }

  /** When the scheduler should next refresh, or null if automatic refresh is off. */
  nextRefreshAt(): Date | null {
    const min = this.d.settings().feed.refreshIntervalMinutes;
    if (min <= 0) return null;
    const last = this.lastRefresh();
    if (!last) return this.d.clock.now();
    return new Date(new Date(last).getTime() + min * 60_000);
  }
}
