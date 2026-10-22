import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FeedService } from '../../src/core/feed/service';
import { parseFeed, toPlainText, urlKey } from '../../src/core/feed/parser';
import { KvStore } from '../../src/core/kv';
import { SettingsService } from '../../src/core/settings';
import type { FeedItem } from '../../src/shared/types';
import { FakeClock, memoryDb } from '../helpers/db';

const RSS = (items: string) => `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Example News</title><link>https://example.com/</link>${items}</channel></rss>`;
const item = (t: string, link: string, desc = '', date = 'Wed, 21 Oct 2026 10:00:00 GMT') =>
  `<item><title>${t}</title><link>${link}</link><guid>${link}</guid><description><![CDATA[${desc}]]></description><pubDate>${date}</pubDate><dc:creator>Ada</dc:creator></item>`;

describe('feed parser', () => {
  it('parses RSS with HTML descriptions into plain-text previews', () => {
    const f = parseFeed(RSS(item('Hello &amp; welcome', '/a?utm_source=x', '<p>Some <b>bold</b> text &amp;amp; more</p><script>alert(1)</script>')), 'https://example.com/feed', { previewLength: 220, maxItems: 10 });
    expect(f.title).toBe('Example News');
    expect(f.items[0]).toMatchObject({ title: 'Hello & welcome', url: 'https://example.com/a?utm_source=x', summary: 'Some bold text & more', author: 'Ada', publishedAt: '2026-10-21T10:00:00.000Z' });
  });

  it('parses Atom and RSS 1.0 (RDF)', () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom site</title><link href="https://atom.test/"/>
      <entry><title type="html">Entry &amp;amp; one</title><link rel="alternate" href="https://atom.test/1"/><id>tag:1</id><updated>2026-10-20T08:00:00Z</updated><summary>Short</summary><author><name>Bo</name></author></entry></feed>`;
    expect(parseFeed(atom, 'https://atom.test/feed', { previewLength: 100, maxItems: 10 }).items[0]).toMatchObject({ title: 'Entry & one', url: 'https://atom.test/1', guid: 'tag:1', author: 'Bo' });
    const rdf = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/"><channel><title>RDF</title><link>https://rdf.test/</link></channel>
      <item><title>R1</title><link>https://rdf.test/1</link><description>d</description></item></rdf:RDF>`;
    expect(parseFeed(rdf, 'https://rdf.test/feed', { previewLength: 100, maxItems: 10 }).items.map((i) => i.title)).toEqual(['R1']);
  });

  it('rejects entity declarations, non-feeds and unsafe links', () => {
    const bomb = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><rss><channel><title>&lol2;</title></channel></rss>`;
    expect(() => parseFeed(bomb, 'https://x.test', { previewLength: 10, maxItems: 1 })).toThrow(/entities/);
    expect(() => parseFeed('<html><body>hi</body></html>', 'https://x.test', { previewLength: 10, maxItems: 1 })).toThrow(/does not look like/);
    const evil = parseFeed(RSS(item('Bad', 'javascript:alert(1)')), 'https://x.test', { previewLength: 10, maxItems: 5 });
    expect(evil.items).toHaveLength(0);
  });

  it('truncates long previews and caps item count', () => {
    const many = RSS(Array.from({ length: 30 }, (_, i) => item(`T${i}`, `https://e.com/${i}`, 'word '.repeat(200))).join(''));
    const f = parseFeed(many, 'https://e.com/feed', { previewLength: 80, maxItems: 10 });
    expect(f.items).toHaveLength(10);
    expect(f.items[0]!.summary.length).toBeLessThanOrEqual(81);
    expect(f.items[0]!.summary.endsWith('…')).toBe(true);
  });

  it('normalizes URLs for duplicate detection', () => {
    expect(urlKey('https://www.Example.com/story/?utm_source=a&id=3#top')).toBe('example.com/story?id=3');
    expect(toPlainText('&lt;b&gt;x&lt;/b&gt;')).toBe('x');
  });
});

describe('feed service', () => {
  let server: http.Server;
  let base = '';
  const hits: Record<string, number> = {};
  const feeds: Record<string, { body: string; etag?: string; status?: number }> = {};
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const p = req.url ?? '/';
      hits[p] = (hits[p] ?? 0) + 1;
      const f = feeds[p];
      if (!f) return void res.writeHead(404).end('nope');
      if (f.etag && req.headers['if-none-match'] === f.etag) return void res.writeHead(304).end();
      res.writeHead(f.status ?? 200, { 'Content-Type': 'application/rss+xml', ...(f.etag ? { ETag: f.etag } : {}) });
      res.end(f.body);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  function setup() {
    const db = memoryDb();
    const clock = new FakeClock('2026-10-22T00:00:00Z');
    const kv = new KvStore(db, clock);
    const settings = new SettingsService(kv);
    const alerts: { item: FeedItem; keyword: string }[] = [];
    const svc = new FeedService({ db, clock, kv, settings: () => settings.get(), fetch, userAgent: 'test', onAlert: (item, keyword) => alerts.push({ item, keyword }) });
    return { db, clock, settings, svc, alerts };
  }

  it('seeds the built-in sources once', () => {
    const { svc } = setup();
    svc.seedDefaults();
    const n = svc.sources().length;
    expect(n).toBeGreaterThan(15);
    svc.removeSource(svc.sources()[0]!.id);
    svc.seedDefaults();
    expect(svc.sources()).toHaveLength(n - 1);
  });

  it('adds a source, refreshes with ETag caching and reports failures honestly', async () => {
    feeds['/a.xml'] = { body: RSS(item('Story one', 'https://news.test/1', 'about rockets') + item('Story two', 'https://news.test/2')), etag: '"v1"' };
    const { svc } = setup();
    const { source, result } = await svc.addSource({ url: `${base}/a.xml`, category: 'technology' });
    expect(result).toMatchObject({ ok: true, newItems: 2 });
    expect(source.category).toBe('technology');
    expect(svc.items({ category: 'technology' }).map((i) => i.title)).toEqual(['Story one', 'Story two']);
    const again = await svc.refresh([source.id]);
    expect(again[0]).toMatchObject({ ok: true, notModified: true, newItems: 0 });
    feeds['/a.xml'] = { body: 'oops', status: 500 };
    const failed = await svc.refresh([source.id], { force: true });
    expect(failed[0]).toMatchObject({ ok: false, error: 'The server answered 500 Internal Server Error.' });
    expect(svc.items({ category: 'technology' })).toHaveLength(2); // cached items stay
    await expect(svc.addSource({ url: `${base}/missing.xml` })).rejects.toThrow(/Could not add this feed/);
    await expect(svc.addSource({ url: 'ftp://x' })).rejects.toThrow(/http/);
  });

  it('refuses oversized feeds', async () => {
    feeds['/big.xml'] = { body: 'x'.repeat(5 * 1024 * 1024 + 10) };
    const { svc } = setup();
    await expect(svc.addSource({ url: `${base}/big.xml` })).rejects.toThrow(/larger than 5 MB/);
  });

  it('collapses the same story from two sources and tracks read/saved state', async () => {
    feeds['/b1.xml'] = { body: RSS(item('Big launch today', 'https://www.site.test/launch?utm_source=rss')) };
    feeds['/b2.xml'] = { body: RSS(item('Big launch today!', 'https://site.test/launch/')) };
    const { svc, settings } = setup();
    settings.update({ feed: { topics: ['science'] } });
    await svc.addSource({ url: `${base}/b1.xml`, category: 'science' });
    await svc.addSource({ url: `${base}/b2.xml`, category: 'science' });
    const items = svc.items();
    expect(items).toHaveLength(1);
    expect(svc.duplicatesOf(items[0]!.id)).toHaveLength(1);
    expect(svc.unreadCount()).toBe(1);
    svc.markRead(items[0]!.id, true);
    expect(svc.unreadCount()).toBe(0);
    svc.setSaved(items[0]!.id, true);
    expect(svc.items({ savedOnly: true })).toHaveLength(1);
    expect(svc.searchSaved('launch')).toHaveLength(1);
  });

  it('treats an article re-issued in the same feed with a new GUID as one item (BBC style)', async () => {
    const story = (guid: string, title: string) =>
      `<item><title>${title}</title><link>https://www.bbc.co.uk/news/articles/c623?at_medium=RSS&amp;at_campaign=rss</link><guid isPermaLink="false">${guid}</guid><description>About energy</description></item>`;
    feeds['/bbc.xml'] = { body: `<?xml version="1.0"?><rss version="2.0"><channel><title>BBC</title>${story('https://www.bbc.co.uk/news/articles/c623#0', 'NI risks missing 2030 goals')}${story('https://www.bbc.co.uk/news/articles/c623#3', 'NI risks missing 2030 energy goals')}</channel></rss>` };
    const { svc, settings, db } = setup();
    settings.update({ feed: { topics: ['science'] } });
    const { source } = await svc.addSource({ url: `${base}/bbc.xml`, category: 'science' });
    expect(svc.items().map((i) => i.title)).toEqual(['NI risks missing 2030 energy goals']);
    // A cache written by an older version that stored both copies is folded on the next refresh.
    db.run("INSERT INTO feed_items (id, source_id, guid, url, title, summary, author, published_at, fetched_at, url_key, title_key) SELECT 'old-copy', source_id, 'legacy#9', url, title, summary, author, published_at, fetched_at, url_key, title_key FROM feed_items LIMIT 1");
    expect(svc.items()).toHaveLength(2);
    await svc.refresh([source.id], { force: true });
    expect(svc.items()).toHaveLength(1);
  });

  it('hides blocked sources and fires keyword alerts for new items only', async () => {
    feeds['/c.xml'] = { body: RSS(item('Weather update', 'https://c.test/1')) };
    const { svc, alerts } = setup();
    svc.addAlert('quantum');
    const { source } = await svc.addSource({ url: `${base}/c.xml`, category: 'custom' });
    feeds['/c.xml'] = { body: RSS(item('Quantum computing milestone', 'https://c.test/2') + item('Weather update', 'https://c.test/1')) };
    await svc.refresh([source.id], { force: true });
    expect(alerts.map((a) => [a.keyword, a.item.title])).toEqual([['quantum', 'Quantum computing milestone']]);
    svc.updateSource(source.id, { blocked: true });
    expect(svc.items({ category: 'custom' })).toHaveLength(0);
    expect(() => svc.addAlert('q')).toThrow(/2 characters/);
  });

  it('schedules automatic refresh from the setting', () => {
    const { svc, settings, clock } = setup();
    expect(svc.nextRefreshAt()?.toISOString()).toBe(clock.now().toISOString());
    settings.update({ feed: { refreshIntervalMinutes: 0 } });
    expect(svc.nextRefreshAt()).toBeNull();
  });
});
