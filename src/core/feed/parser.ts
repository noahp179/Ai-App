import { XMLParser } from 'fast-xml-parser';

export interface ParsedItem {
  guid: string;
  url: string;
  title: string;
  summary: string;
  author: string;
  publishedAt: string | null;
}

export interface ParsedFeed {
  title: string;
  siteUrl: string;
  items: ParsedItem[];
}

export class FeedParseError extends Error {}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

/** Turns feed HTML/text into plain text. Never returns markup. */
export function toPlainText(input: unknown): string {
  let s = typeof input === 'string' ? input : input && typeof input === 'object' && '#text' in input ? String((input as Record<string, unknown>)['#text']) : '';
  for (let i = 0; i < 2; i++) {
    // Feeds often double-encode HTML.
    s = s
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
  }
  return s.replace(/\s+/g, ' ').trim();
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd()}…`;
}

export function absoluteHttpUrl(value: unknown, base: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const u = new URL(value.trim(), base || undefined);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function arr<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

function atomLink(link: unknown): string | null {
  for (const l of arr(link as Record<string, string> | Record<string, string>[])) {
    if (typeof l === 'string') return l;
    if (!l['@_rel'] || l['@_rel'] === 'alternate') return l['@_href'] ?? null;
  }
  return null;
}

function parseDate(v: unknown): string | null {
  const s = toPlainText(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Parses RSS 2.0, RSS 1.0 (RDF) and Atom. Documents declaring entities are
 * rejected to rule out entity-expansion attacks; external entities are never
 * resolved.
 */
export function parseFeed(xml: string, feedUrl: string, opts: { previewLength: number; maxItems: number }): ParsedFeed {
  if (xml.length > 5_000_000) throw new FeedParseError('Feed is larger than 5 MB.');
  if (/<!ENTITY/i.test(xml)) throw new FeedParseError('Feed declares XML entities, which are not allowed.');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: true,
    htmlEntities: false,
    trimValues: true,
    parseTagValue: false,
    removeNSPrefix: true,
  });
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch (err) {
    throw new FeedParseError(`Not a valid feed (${err instanceof Error ? err.message : 'parse error'}).`);
  }

  const items: ParsedItem[] = [];
  let title = '';
  let siteUrl = '';
  const rss = doc.rss as Record<string, unknown> | undefined;
  const atom = doc.feed as Record<string, unknown> | undefined;
  const rdf = doc.RDF as Record<string, unknown> | undefined;

  if (rss?.channel || rdf) {
    const channel = ((rss?.channel ?? rdf?.channel) as Record<string, unknown>) ?? {};
    title = toPlainText(channel.title);
    siteUrl = absoluteHttpUrl(typeof channel.link === 'string' ? channel.link : atomLink(channel.link), feedUrl) ?? '';
    const rawItems = arr((rss ? channel.item : rdf?.item) as Record<string, unknown>[] | Record<string, unknown> | undefined);
    for (const it of rawItems) {
      const url = absoluteHttpUrl(typeof it.link === 'string' ? it.link : atomLink(it.link), siteUrl || feedUrl) ?? absoluteHttpUrl(toPlainText(it.guid), feedUrl);
      const t = toPlainText(it.title);
      if (!url || !t) continue;
      items.push({
        guid: toPlainText(it.guid) || url,
        url,
        title: truncate(t, 300),
        summary: truncate(toPlainText(it.description ?? it.summary ?? it.encoded ?? ''), opts.previewLength),
        author: truncate(toPlainText(it.creator ?? it.author ?? ''), 120),
        publishedAt: parseDate(it.pubDate ?? it.date ?? it.published ?? it.updated),
      });
    }
  } else if (atom) {
    title = toPlainText(atom.title);
    siteUrl = absoluteHttpUrl(atomLink(atom.link), feedUrl) ?? '';
    for (const it of arr(atom.entry as Record<string, unknown>[] | Record<string, unknown> | undefined)) {
      const url = absoluteHttpUrl(atomLink(it.link), siteUrl || feedUrl);
      const t = toPlainText(it.title);
      if (!url || !t) continue;
      const author = arr(it.author as Record<string, unknown>[] | Record<string, unknown> | undefined)[0];
      items.push({
        guid: toPlainText(it.id) || url,
        url,
        title: truncate(t, 300),
        summary: truncate(toPlainText(it.summary ?? it.content ?? ''), opts.previewLength),
        author: truncate(toPlainText(author?.name ?? ''), 120),
        publishedAt: parseDate(it.published ?? it.updated),
      });
    }
  } else {
    throw new FeedParseError('This address does not look like an RSS or Atom feed.');
  }

  items.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  return { title, siteUrl, items: items.slice(0, opts.maxItems) };
}

const TRACKING = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|cmpid|ocid|at_medium|at_campaign)$/i;

/** Normalizes a URL so the same article from different feeds is recognised. */
export function urlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const p = u.pathname.replace(/\/+$/, '') || '/';
    const q = u.searchParams.toString();
    return `${host}${p}${q ? `?${q}` : ''}`;
  } catch {
    return url;
  }
}

export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
