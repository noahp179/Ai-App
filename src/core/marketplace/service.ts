import { z } from 'zod';
import { parseVariables } from '../../shared/prompts';
import { ListingDraftBody, SEMVER, TRIAL_DAYS, previewProblem, type RemoteListingT } from '../../shared/marketplace/protocol';
import starter from '../../shared/marketplace/starter.json';
import type { Settings } from '../../shared/settings';
import type {
  AbuseReport,
  CreatorProfile,
  EntitlementStatus,
  Listing,
  ListingDetail,
  ListingDraftInput,
  ListingOrigin,
  ListingQuery,
  ListingStatus,
  MarketplaceAccount,
  MarketplaceStatus,
  Prompt,
  ProviderLabel,
  PublishCheck,
  Review,
} from '../../shared/types';
import type { Db } from '../db/database';
import { bool, json } from '../db/database';
import type { KvStore } from '../kv';
import type { PromptsService } from '../prompts';
import type { SecretStore } from '../secrets';
import { type Clock, NotFoundError, UserError, cleanLine, cleanTags, newId } from '../util';
import { MarketplaceRemote, RemoteError, normalizeServerUrl } from './remote';

export const STARTER_CREATOR_ID = starter.creator.id;
const TOKEN = 'marketplace:token';
const ACCOUNT = 'marketplace:account';

interface Row {
  id: string;
  origin: ListingOrigin;
  title: string;
  summary: string;
  preview: string;
  body: string;
  category: string;
  tags: string;
  providers: string;
  creator_id: string;
  creator_name: string;
  creator_is_self: number;
  pricing_type: 'free' | 'paid';
  price_cents: number;
  currency: string;
  trial_eligible: number;
  version: string;
  status: ListingStatus;
  moderation_note: string | null;
  demo: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  remote_id: string | null;
  remote_status: ListingStatus | null;
  imported: number;
  hidden: number;
}

const SELECT = 'SELECT l.*, c.display_name AS creator_name, c.is_self AS creator_is_self FROM listings l JOIN creator_profiles c ON c.id = l.creator_id';

const PackageDoc = z.object({
  format: z.literal('flowcompanion.listing'),
  version: z.literal(1),
  creator: z.object({ displayName: z.string().min(1).max(60), bio: z.string().max(1000).default(''), website: z.string().max(200).default('') }),
  listing: ListingDraftBody.extend({ pricing: z.object({ type: z.literal('free') }) }),
});

type AccountInfo = MarketplaceAccount & { role: 'user' | 'admin' };

export interface MarketplaceDeps {
  db: Db;
  clock: Clock;
  kv: KvStore;
  secrets: SecretStore;
  prompts: PromptsService;
  settings: () => Settings;
  fetch: typeof fetch;
  userAgent: string;
}

/**
 * Prompt marketplace. Works fully offline with the bundled free starter set, imported listing files and your own
 * drafts. A marketplace server (optional; see server/) adds community listings, accounts, verified reviews,
 * moderation and server-enforced trials. Nothing is ever charged: there is no payment integration.
 */
export class MarketplaceService {
  constructor(private readonly d: MarketplaceDeps) {}

  private get db() {
    return this.d.db;
  }
  private now() {
    return this.d.clock.now().toISOString();
  }

  // ───────── Seeding ─────────

  /** Adds or refreshes the bundled starter listings. Safe to run at every start. */
  seedStarter(): void {
    const now = this.now();
    this.db.tx(() => {
      this.db.run(
        `INSERT INTO creator_profiles (id, display_name, bio, website, is_self, origin, created_at) VALUES (?, ?, ?, ?, 0, 'bundled', ?)
         ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, bio = excluded.bio`,
        [starter.creator.id, starter.creator.displayName, starter.creator.bio, starter.creator.website, now],
      );
      for (const l of starter.listings) {
        this.db.run(
          `INSERT INTO listings (id, origin, title, summary, preview, body, category, tags, providers, creator_id, pricing_type, version, status, created_at, updated_at, published_at)
           VALUES (?, 'bundled', ?, ?, '', ?, ?, ?, '["any"]', ?, 'free', '1.0.0', 'published', ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET title = excluded.title, summary = excluded.summary, body = excluded.body, category = excluded.category, tags = excluded.tags`,
          [l.id, l.title, l.summary, l.body, l.category, JSON.stringify(l.tags), starter.creator.id, now, now, now],
        );
      }
    });
  }

  // ───────── Server connection ─────────

  private account(): AccountInfo | null {
    const a = this.d.kv.get<AccountInfo | null>(ACCOUNT, null);
    if (!a) return null;
    const url = this.d.settings().marketplace.serverUrl;
    if (!url || a.serverUrl !== safeNormalize(url) || !this.d.secrets.get(TOKEN)) return null;
    return a;
  }

  private remote(): MarketplaceRemote | null {
    const url = this.d.settings().marketplace.serverUrl;
    if (!url) return null;
    return new MarketplaceRemote(url, this.d.fetch, () => (this.account() ? this.d.secrets.get(TOKEN) : null), this.d.userAgent);
  }

  private requireRemote(): MarketplaceRemote {
    const r = this.remote();
    if (!r) throw new UserError('No marketplace server is set up. Add one in Settings → Marketplace.');
    return r;
  }

  private requireAccount(): AccountInfo {
    const a = this.account();
    if (!a) throw new UserError('Sign in to the marketplace server first (Settings → Marketplace).');
    return a;
  }

  async status(): Promise<MarketplaceStatus> {
    const url = this.d.settings().marketplace.serverUrl;
    const acct = this.account();
    const base: MarketplaceStatus = { serverUrl: url, info: null, error: null, account: acct, tokenStorage: acct ? (this.d.secrets.secureAvailable ? 'secure' : 'session') : null };
    if (!url) return base;
    try {
      return { ...base, info: await this.requireRemote().info() };
    } catch (err) {
      return { ...base, error: (err as Error).message };
    }
  }

  private storeSession(r: { token: string; account: { email: string; displayName: string; creatorId: string; role: 'user' | 'admin' } }, serverUrl: string): AccountInfo {
    this.d.secrets.set(TOKEN, r.token);
    const a: AccountInfo = { serverUrl, email: r.account.email, displayName: r.account.displayName, creatorId: r.account.creatorId, role: r.account.role, loggedInAt: this.now() };
    this.d.kv.set(ACCOUNT, a);
    return a;
  }

  async register(input: { email: string; password: string; displayName: string }): Promise<AccountInfo> {
    const remote = this.requireRemote();
    return this.storeSession(await remote.register(input), remote.baseUrl);
  }

  async login(input: { email: string; password: string }): Promise<AccountInfo> {
    const remote = this.requireRemote();
    return this.storeSession(await remote.login(input), remote.baseUrl);
  }

  async logout(): Promise<void> {
    const remote = this.remote();
    try {
      if (remote && this.account()) await remote.logout();
    } catch {
      // Signing out locally must work even if the server is unreachable.
    } finally {
      this.d.secrets.delete(TOKEN);
      this.d.kv.delete(ACCOUNT);
      this.db.run("DELETE FROM entitlements WHERE authority = 'server'");
    }
  }

  /** Called when the server address changes: an account belongs to one server. */
  forgetAccount(): void {
    this.d.secrets.delete(TOKEN);
    this.d.kv.delete(ACCOUNT);
    this.db.run("DELETE FROM entitlements WHERE authority = 'server'");
  }

  // ───────── Mapping ─────────

  private toListing(r: Row, opts: { withBody: boolean }): Listing {
    return {
      id: r.id,
      key: this.keyOf(r.id, r.origin),
      origin: r.origin,
      title: r.title,
      summary: r.summary,
      preview: r.preview,
      body: opts.withBody ? r.body : null,
      category: r.category,
      tags: json<string[]>(r.tags, []),
      providers: json<ProviderLabel[]>(r.providers, ['any']),
      creatorId: r.creator_id,
      creatorName: r.creator_name,
      pricing: r.pricing_type === 'paid' ? { type: 'paid', priceCents: r.price_cents, currency: r.currency } : { type: 'free' },
      trialEligible: bool(r.trial_eligible),
      version: r.version,
      status: r.status,
      moderationNote: r.moderation_note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      publishedAt: r.published_at,
      // Ratings on this device are only yours, so they are never shown as a community average.
      rating: null,
      demo: bool(r.demo),
      imported: bool(r.imported),
      isMine: bool(r.creator_is_self),
      hidden: bool(r.hidden),
      remoteId: r.remote_id,
      remoteStatus: r.remote_status,
    };
  }

  private fromRemote(l: RemoteListingT): Listing {
    const acct = this.account();
    return {
      id: l.id,
      key: `remote:${l.id}`,
      origin: 'remote',
      title: l.title,
      summary: l.summary,
      preview: l.preview,
      body: l.body,
      category: l.category,
      tags: l.tags,
      providers: l.providers,
      creatorId: l.creator.id,
      creatorName: l.creator.displayName,
      pricing: l.pricing,
      trialEligible: l.trialEligible,
      version: l.version,
      status: l.status,
      moderationNote: l.moderationNote,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      publishedAt: l.publishedAt,
      rating: l.rating,
      demo: l.demo,
      imported: false,
      isMine: !!acct && acct.creatorId === l.creator.id,
      hidden: false,
      remoteId: l.id,
      remoteStatus: l.status,
    };
  }

  private keyOf(id: string, origin: ListingOrigin): string {
    return `${origin}:${id}`;
  }

  private parseKey(key: string): { origin: ListingOrigin; id: string } {
    const m = /^(bundled|local|remote):([A-Za-z0-9_-]{1,80})$/.exec(String(key));
    if (!m) throw new NotFoundError('That listing');
    return { origin: m[1] as ListingOrigin, id: m[2]! };
  }

  private localRow(id: string): Row {
    const r = this.db.get<Row>(`${SELECT} WHERE l.id = ? AND l.origin != 'remote'`, [id]);
    if (!r) throw new NotFoundError('That listing');
    return r;
  }

  // ───────── Browsing ─────────

  async listings(q: ListingQuery = {}): Promise<{ items: Listing[]; remoteError: string | null }> {
    const where = ["l.status = 'published'", 'l.hidden = 0', "(c.is_self = 0)"];
    const p: string[] = [];
    if (q.search?.trim()) {
      const like = `%${q.search.trim().replace(/[%_\\]/g, '')}%`;
      where.push('(l.title LIKE ? OR l.summary LIKE ? OR l.tags LIKE ? OR c.display_name LIKE ?)');
      p.push(like, like, like, like);
    }
    if (q.category && q.category !== 'all') {
      where.push('l.category = ?');
      p.push(q.category);
    }
    if (q.pricing === 'paid') where.push('0');
    if (q.origin && q.origin !== 'any' && q.origin !== 'remote') {
      where.push('l.origin = ?');
      p.push(q.origin);
    }
    let items: Listing[] = q.origin === 'remote' ? [] : this.db.all<Row>(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY l.origin, l.title COLLATE NOCASE`, p).map((r) => this.toListing(r, { withBody: false }));
    let remoteError: string | null = null;
    const remote = this.remote();
    if (remote && (!q.origin || q.origin === 'any' || q.origin === 'remote')) {
      try {
        const showPaid = this.d.settings().marketplace.showPaidListings;
        const list = await remote.listings({ search: q.search, category: q.category, pricing: q.pricing, sort: q.sort });
        items = [...items, ...list.filter((l) => showPaid || l.pricing.type === 'free').map((l) => ({ ...this.fromRemote(l), body: null }))];
      } catch (err) {
        remoteError = (err as Error).message;
      }
    }
    if (q.sort === 'title') items.sort((a, b) => a.title.localeCompare(b.title));
    else if (q.sort === 'rating') items.sort((a, b) => (b.rating?.average ?? -1) - (a.rating?.average ?? -1));
    else if (q.sort === 'recent') items.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
    return { items, remoteError };
  }

  private events(key: string) {
    const count = (e: string) => this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM listing_events WHERE listing_id = ? AND event = ?', [key, e])!.n;
    return { views: count('view'), copies: count('copy'), inserts: count('insert'), saves: count('save') };
  }

  recordEvent(key: string, event: 'view' | 'copy' | 'insert' | 'save'): void {
    this.parseKey(key);
    this.db.run('INSERT INTO listing_events (id, listing_id, event, at) VALUES (?, ?, ?, ?)', [newId(), key, event, this.now()]);
  }

  private localAccess(r: Row): EntitlementStatus {
    return { listingId: r.id, access: 'free', expiresAt: null, remainingMs: null, trialAvailable: false, authority: 'local', reason: r.origin === 'bundled' ? 'Free, bundled with FlowCompanion.' : 'Free.' };
  }

  private cacheEntitlements(list: { id: string; listingId: string; kind: 'free' | 'trial' | 'purchase'; startsAt: string; expiresAt: string | null; revokedAt: string | null }[]): void {
    this.db.tx(() => {
      for (const e of list) {
        this.db.run(
          `INSERT INTO entitlements (id, listing_id, kind, starts_at, expires_at, authority, revoked_at, created_at) VALUES (?, ?, ?, ?, ?, 'server', ?, ?)
           ON CONFLICT(id) DO UPDATE SET expires_at = excluded.expires_at, revoked_at = excluded.revoked_at`,
          [e.id, `remote:${e.listingId}`, e.kind, e.startsAt, e.expiresAt, e.revokedAt, this.now()],
        );
      }
    });
  }

  /** Access to a server listing, as the server reports it (the server decides; this only explains it). */
  private remoteAccess(l: RemoteListingT): EntitlementStatus {
    const now = this.d.clock.now().getTime();
    const ents = this.db.all<{ kind: string; expires_at: string | null; revoked_at: string | null }>("SELECT kind, expires_at, revoked_at FROM entitlements WHERE listing_id = ? AND authority = 'server'", [`remote:${l.id}`]);
    const trial = ents.find((e) => e.kind === 'trial');
    const base = { listingId: l.id, authority: 'server' as const };
    if (l.pricing.type === 'free') return { ...base, access: 'free', expiresAt: null, remainingMs: null, trialAvailable: false, reason: 'Free.' };
    if (ents.some((e) => e.kind === 'purchase' && !e.revoked_at)) return { ...base, access: 'purchased', expiresAt: null, remainingMs: null, trialAvailable: false, reason: 'You bought this listing.' };
    if (trial && l.body !== null && trial.expires_at && new Date(trial.expires_at).getTime() > now) {
      return { ...base, access: 'trial_active', expiresAt: trial.expires_at, remainingMs: new Date(trial.expires_at).getTime() - now, trialAvailable: false, reason: 'Trial active. The server ends access when it expires.' };
    }
    if (trial) return { ...base, access: 'trial_expired', expiresAt: trial.expires_at, remainingMs: 0, trialAvailable: false, reason: 'Your trial has ended. Nothing was charged.' };
    if (l.body !== null) return { ...base, access: 'purchased', expiresAt: null, remainingMs: null, trialAvailable: false, reason: 'You have access to this listing.' };
    return { ...base, access: 'none', expiresAt: null, remainingMs: null, trialAvailable: l.trialEligible, reason: l.trialEligible ? `Paid listing with a free ${TRIAL_DAYS}-day trial.` : 'Paid listing.' };
  }

  async listing(key: string): Promise<ListingDetail> {
    const { origin, id } = this.parseKey(key);
    const inLibrary = this.db.get<{ id: string }>('SELECT id FROM prompts WHERE listing_id = ? ORDER BY created_at DESC LIMIT 1', [key])?.id ?? null;
    const myReport = this.db.get<{ id: string; listing_id: string; reason: AbuseReport['reason']; details: string; status: AbuseReport['status']; created_at: string }>(
      'SELECT * FROM abuse_reports WHERE listing_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
      [key],
    );
    const report: AbuseReport | null = myReport ? { id: myReport.id, listingId: key, reason: myReport.reason, details: myReport.details, status: myReport.status, createdAt: myReport.created_at } : null;
    if (origin === 'remote') {
      const remote = this.requireRemote();
      if (this.account()) {
        try {
          this.cacheEntitlements(await remote.entitlements());
        } catch {
          // Entitlement refresh is best-effort; the listing response below is authoritative for access.
        }
      }
      const l = await remote.listing(id);
      const reviews = await remote.reviews(id).catch(() => []);
      const acct = this.account();
      const hasAccess = l.body !== null;
      const reviewed = this.db.get("SELECT 1 FROM listing_events WHERE listing_id = ? AND event IN ('copy', 'insert', 'save')", [key]);
      this.recordEvent(key, 'view');
      return {
        ...this.fromRemote(l),
        access: this.remoteAccess(l),
        reviews: reviews.map((r) => ({ ...r, rating: r.rating as Review['rating'] })),
        reviewsScope: 'server',
        canReview: !!acct && hasAccess && !this.fromRemote(l).isMine && !!reviewed,
        reviewBlockedReason: !acct
          ? 'Sign in to review.'
          : this.fromRemote(l).isMine
            ? 'You cannot review your own listing.'
            : !hasAccess || !reviewed
              ? 'Use this prompt (copy, insert or save it) before reviewing. Only people who used a prompt can review it.'
              : null,
        myReport: report,
        yourUsage: this.events(key),
        versions: [],
        inLibrary,
      };
    }
    const r = this.localRow(id);
    const used = this.db.get("SELECT 1 FROM listing_events WHERE listing_id = ? AND event IN ('copy', 'insert', 'save')", [key]);
    const reviews = this.db
      .all<{ id: string; author_name: string; rating: Review['rating']; text: string; verified: number; created_at: string }>('SELECT * FROM reviews WHERE listing_id = ? ORDER BY created_at DESC', [key])
      .map((x) => ({ id: x.id, listingId: key, authorName: x.author_name, rating: x.rating, text: x.text, verified: bool(x.verified), createdAt: x.created_at }));
    if (!bool(r.creator_is_self)) this.recordEvent(key, 'view');
    return {
      ...this.toListing(r, { withBody: true }),
      access: this.localAccess(r),
      reviews,
      reviewsScope: 'this_device',
      canReview: !bool(r.creator_is_self) && !!used,
      reviewBlockedReason: bool(r.creator_is_self) ? 'This is your own listing.' : used ? null : 'Use this prompt (copy, insert or save it) before rating it.',
      myReport: report,
      yourUsage: this.events(key),
      versions: this.db
        .all<{ version: string; changelog: string; created_at: string }>('SELECT version, changelog, created_at FROM listing_versions WHERE listing_id = ? ORDER BY created_at DESC, rowid DESC', [r.id])
        .map((v) => ({ version: v.version, changelog: v.changelog, createdAt: v.created_at })),
      inLibrary,
    };
  }

  /** The prompt text, only when you have access. Using a free server listing while signed in records it on the server so you can review it. */
  async promptText(key: string, use: 'copy' | 'insert'): Promise<string> {
    const { origin, id } = this.parseKey(key);
    let body: string | null;
    if (origin === 'remote') {
      const remote = this.requireRemote();
      let l = await remote.listing(id);
      if (l.pricing.type === 'free' && this.account()) l = await remote.acquire(id);
      body = l.body;
      if (body === null) throw new UserError(l.pricing.type === 'paid' ? 'You need an active trial or purchase to use this prompt.' : 'This prompt is not available.');
    } else body = this.localRow(id).body;
    this.recordEvent(key, use);
    return body;
  }

  async saveToLibrary(key: string): Promise<Prompt> {
    const { origin, id } = this.parseKey(key);
    let src: { title: string; summary: string; body: string | null; category: string; tags: string[]; providers: ProviderLabel[] };
    if (origin === 'remote') {
      const remote = this.requireRemote();
      let l = await remote.listing(id);
      if (l.pricing.type === 'paid') {
        const access = this.remoteAccess(l);
        if (access.access !== 'purchased') throw new UserError('Paid listings can be saved to your library only after purchase. During a trial, use the prompt from the marketplace page.');
      } else if (this.account()) l = await remote.acquire(id);
      src = l;
    } else {
      const r = this.localRow(id);
      src = { title: r.title, summary: r.summary, body: r.body, category: r.category, tags: json<string[]>(r.tags, []), providers: json<ProviderLabel[]>(r.providers, ['any']) };
    }
    if (!src.body) throw new UserError('This prompt is not available.');
    const existing = this.db.get<{ id: string }>('SELECT id FROM prompts WHERE listing_id = ?', [key]);
    if (existing) return this.d.prompts.get(existing.id);
    const p = this.d.prompts.create({ title: src.title, description: src.summary, body: src.body, category: src.category, tags: src.tags, providers: src.providers }, { origin: 'marketplace', listingId: key });
    this.recordEvent(key, 'save');
    return p;
  }

  /** Starts a server-side trial after the user has seen and accepted the disclosure. */
  async startTrial(key: string, acknowledged: boolean): Promise<ListingDetail> {
    const { origin, id } = this.parseKey(key);
    if (origin !== 'remote') throw new UserError('Trials are only offered for paid listings on a marketplace server.');
    if (acknowledged !== true) throw new UserError('Please read and accept the trial terms first.');
    this.requireAccount();
    const r = await this.requireRemote().trial(id);
    this.cacheEntitlements([r.entitlement]);
    this.d.kv.set(`market:title:${key}`, r.listing.title);
    return this.listing(key);
  }

  async purchase(key: string): Promise<never> {
    const { origin, id } = this.parseKey(key);
    if (origin !== 'remote') throw new UserError('Only paid server listings can be bought.');
    this.requireAccount();
    await this.requireRemote().purchase(id);
    // A server that implemented payments would need a checkout flow this version does not have.
    throw new UserError('Purchasing is not supported by this version of FlowCompanion. Nothing was charged.');
  }

  async addReview(key: string, input: { rating: number; text: string }): Promise<void> {
    const { origin, id } = this.parseKey(key);
    const rating = Math.trunc(Number(input?.rating));
    if (!(rating >= 1 && rating <= 5)) throw new UserError('Choose a rating from 1 to 5.');
    const text = String(input?.text ?? '').trim().slice(0, 2000);
    const detail = await this.listing(key);
    if (!detail.canReview) throw new UserError(detail.reviewBlockedReason ?? 'You cannot review this listing.');
    if (origin === 'remote') return void (await this.requireRemote().addReview(id, { rating, text }));
    this.db.tx(() => {
      this.db.run('DELETE FROM reviews WHERE listing_id = ?', [key]);
      this.db.run('INSERT INTO reviews (id, listing_id, author_name, rating, text, verified, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)', [newId(), key, 'You', rating, text, this.now()]);
    });
  }

  /** Server listings: sent to the server's moderators. Local listings: recorded here and hidden from your browsing. */
  async report(key: string, input: { reason: AbuseReport['reason']; details: string }): Promise<{ sentTo: 'server' | 'this_device' }> {
    const { origin, id } = this.parseKey(key);
    const reason = z.enum(['spam', 'harmful', 'copyright', 'misleading', 'other']).parse(input?.reason);
    const details = String(input?.details ?? '').trim().slice(0, 2000);
    if (origin === 'remote') {
      this.requireAccount();
      await this.requireRemote().report(id, { reason, details });
    } else this.db.run('UPDATE listings SET hidden = 1 WHERE id = ?', [id]);
    this.db.run('INSERT INTO abuse_reports (id, listing_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', [newId(), key, reason, details, 'open', this.now()]);
    return { sentTo: origin === 'remote' ? 'server' : 'this_device' };
  }

  myReports(): (AbuseReport & { listingTitle: string | null })[] {
    return this.db
      .all<{ id: string; listing_id: string; reason: AbuseReport['reason']; details: string; status: AbuseReport['status']; created_at: string }>('SELECT * FROM abuse_reports ORDER BY created_at DESC')
      .map((r) => {
        const [origin, id] = r.listing_id.split(':');
        const title = origin !== 'remote' ? (this.db.get<{ title: string }>('SELECT title FROM listings WHERE id = ?', [id ?? ''])?.title ?? null) : null;
        return { id: r.id, listingId: r.listing_id, reason: r.reason, details: r.details, status: r.status, createdAt: r.created_at, listingTitle: title };
      });
  }

  /** Local moderation: un-hide a listing you reported, or remove an imported one. */
  resolveLocalReport(reportId: string, action: 'restore' | 'remove_listing' | 'dismiss'): void {
    const r = this.db.get<{ listing_id: string }>('SELECT listing_id FROM abuse_reports WHERE id = ?', [reportId]);
    if (!r) throw new NotFoundError('That report');
    const { origin, id } = this.parseKey(r.listing_id);
    this.db.tx(() => {
      if (origin !== 'remote' && action === 'restore') this.db.run('UPDATE listings SET hidden = 0 WHERE id = ?', [id]);
      if (origin === 'local' && action === 'remove_listing') {
        const row = this.localRow(id);
        if (!bool(row.imported)) throw new UserError('Only imported listings can be removed here.');
        this.db.run('DELETE FROM listings WHERE id = ?', [id]);
      }
      if (origin === 'bundled' && action === 'remove_listing') throw new UserError('Bundled listings cannot be removed; they stay hidden for you instead.');
      this.db.run("UPDATE abuse_reports SET status = ? WHERE id = ?", [action === 'dismiss' ? 'dismissed' : 'reviewed', reportId]);
    });
  }

  async creator(key: string): Promise<{ creator: CreatorProfile; listings: Listing[] }> {
    const { origin, id } = this.parseKey(key);
    if (origin === 'remote') {
      const r = await this.requireRemote().creator(id);
      return { creator: { id: r.creator.id, displayName: r.creator.displayName, bio: r.creator.bio, website: r.creator.website, isSelf: this.account()?.creatorId === r.creator.id, origin: 'remote', createdAt: '', listingCount: r.creator.listingCount }, listings: r.listings.map((l) => ({ ...this.fromRemote(l), body: null })) };
    }
    const c = this.db.get<{ id: string; display_name: string; bio: string; website: string; is_self: number; origin: ListingOrigin; created_at: string }>('SELECT * FROM creator_profiles WHERE id = ?', [id]);
    if (!c) throw new NotFoundError('That creator');
    const listings = this.db.all<Row>(`${SELECT} WHERE l.creator_id = ? AND l.status = 'published' AND l.hidden = 0`, [id]).map((r) => this.toListing(r, { withBody: false }));
    return { creator: { id: c.id, displayName: c.display_name, bio: c.bio, website: c.website, isSelf: bool(c.is_self), origin: c.origin, createdAt: c.created_at, listingCount: listings.length }, listings };
  }

  // ───────── Moderation on the server (moderator accounts) ─────────

  async moderationQueue() {
    const a = this.requireAccount();
    if (a.role !== 'admin') throw new UserError('Only moderator accounts can see the review queue.');
    const q = await this.requireRemote().moderationQueue();
    return { pending: q.pending.map((l) => this.fromRemote(l)), reports: q.reports };
  }

  async moderate(remoteId: string, action: 'approve' | 'reject' | 'remove', note: string): Promise<Listing> {
    this.requireAccount();
    return this.fromRemote(await this.requireRemote().moderate(remoteId, { action, note: String(note ?? '') }));
  }

  async resolveServerReport(id: string, action: 'reviewed' | 'dismissed'): Promise<void> {
    this.requireAccount();
    await this.requireRemote().resolveReport(id, action);
  }

  // ───────── Creator studio ─────────

  selfProfile(): CreatorProfile {
    let c = this.db.get<{ id: string; display_name: string; bio: string; website: string; created_at: string }>('SELECT * FROM creator_profiles WHERE is_self = 1');
    if (!c) {
      const id = newId();
      const name = this.account()?.displayName ?? 'Me';
      this.db.run("INSERT INTO creator_profiles (id, display_name, bio, website, is_self, origin, created_at) VALUES (?, ?, '', '', 1, 'local', ?)", [id, name, this.now()]);
      c = this.db.get('SELECT * FROM creator_profiles WHERE id = ?', [id])!;
    }
    return { id: c.id, displayName: c.display_name, bio: c.bio, website: c.website, isSelf: true, origin: 'local', createdAt: c.created_at };
  }

  async saveProfile(input: { displayName: string; bio: string; website: string }): Promise<CreatorProfile> {
    const p = this.selfProfile();
    const displayName = cleanLine(input?.displayName ?? '', 60);
    if (!displayName) throw new UserError('Enter a display name.');
    const website = String(input?.website ?? '').trim();
    if (website && !/^https:\/\/[^\s]+$/.test(website)) throw new UserError('Website must start with https://');
    const bio = String(input?.bio ?? '').trim().slice(0, 1000);
    this.db.run('UPDATE creator_profiles SET display_name = ?, bio = ?, website = ? WHERE id = ?', [displayName, bio, website, p.id]);
    if (this.account()) await this.requireRemote().updateProfile({ displayName, bio, website });
    return this.selfProfile();
  }

  myListings(): Listing[] {
    const self = this.selfProfile();
    return this.db.all<Row>(`${SELECT} WHERE l.creator_id = ? ORDER BY l.updated_at DESC`, [self.id]).map((r) => this.toListing(r, { withBody: true }));
  }

  /** Refreshes review status and moderator notes of your listings from the server. */
  async syncMyListings(): Promise<Listing[]> {
    if (this.account()) {
      const remote = await this.requireRemote().myListings();
      const byId = new Map(remote.map((l) => [l.id, l]));
      for (const l of this.myListings()) {
        const r = l.remoteId ? byId.get(l.remoteId) : undefined;
        if (r) this.db.run('UPDATE listings SET remote_status = ?, moderation_note = ? WHERE id = ?', [r.status, r.moderationNote, l.id]);
        else if (l.remoteId) this.db.run('UPDATE listings SET remote_status = NULL, remote_id = NULL WHERE id = ?', [l.id]);
      }
    }
    return this.myListings();
  }

  private draftData(input: Partial<ListingDraftInput>, cur?: ListingDraftInput): ListingDraftInput {
    const d = { ...(cur ?? { title: '', summary: '', preview: '', body: '', category: 'general', tags: [], providers: ['any'] as ProviderLabel[], pricing: { type: 'free' as const }, trialEligible: false, version: '1.0.0', changelog: '' }), ...input };
    const pricing = d.pricing?.type === 'paid' ? { type: 'paid' as const, priceCents: Math.max(0, Math.trunc(Number(d.pricing.priceCents) || 0)), currency: (['USD', 'EUR', 'GBP'].includes(d.pricing.currency) ? d.pricing.currency : 'USD') as 'USD' } : { type: 'free' as const };
    return {
      title: cleanLine(String(d.title ?? ''), 120),
      summary: cleanLine(String(d.summary ?? ''), 300),
      preview: String(d.preview ?? '').trim().slice(0, 600),
      body: String(d.body ?? '').slice(0, 50_000),
      category: cleanLine(String(d.category ?? 'general'), 40).toLowerCase() || 'general',
      tags: cleanTags(Array.isArray(d.tags) ? d.tags : []).slice(0, 10),
      providers: Array.isArray(d.providers) && d.providers.length ? ([...new Set(d.providers)] as ProviderLabel[]) : ['any'],
      pricing,
      trialEligible: pricing.type === 'paid' && d.trialEligible === true,
      version: String(d.version ?? '1.0.0').trim(),
      changelog: String(d.changelog ?? '').slice(0, 2000),
    };
  }

  private rowToDraft(r: Row): ListingDraftInput {
    return {
      title: r.title,
      summary: r.summary,
      preview: r.preview,
      body: r.body,
      category: r.category,
      tags: json<string[]>(r.tags, []),
      providers: json<ProviderLabel[]>(r.providers, ['any']),
      pricing: r.pricing_type === 'paid' ? { type: 'paid', priceCents: r.price_cents, currency: r.currency as 'USD' } : { type: 'free' },
      trialEligible: bool(r.trial_eligible),
      version: r.version,
      changelog: this.db.get<{ changelog: string }>('SELECT changelog FROM listing_versions WHERE listing_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1', [r.id])?.changelog ?? '',
    };
  }

  private ownRow(id: string): Row {
    const r = this.localRow(id);
    if (!bool(r.creator_is_self)) throw new NotFoundError('That draft');
    return r;
  }

  createDraft(input: Partial<ListingDraftInput> = {}): Listing {
    const self = this.selfProfile();
    const d = this.draftData(input);
    const id = newId();
    const now = this.now();
    this.db.tx(() => {
      this.db.run(
        `INSERT INTO listings (id, origin, title, summary, preview, body, category, tags, providers, creator_id, pricing_type, price_cents, currency, trial_eligible, version, status, created_at, updated_at)
         VALUES (?, 'local', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
        [id, d.title || 'Untitled listing', d.summary, d.preview, d.body, d.category, JSON.stringify(d.tags), JSON.stringify(d.providers), self.id, d.pricing.type, d.pricing.type === 'paid' ? d.pricing.priceCents : 0, d.pricing.type === 'paid' ? d.pricing.currency : 'USD', d.trialEligible ? 1 : 0, d.version, now, now],
      );
      this.db.run('INSERT INTO listing_versions (id, listing_id, version, title, body, changelog, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [newId(), id, d.version, d.title, d.body, d.changelog || 'First draft', now]);
    });
    return this.toListing(this.localRow(id), { withBody: true });
  }

  draftFromPrompt(promptId: string): Listing {
    const p = this.d.prompts.get(promptId);
    return this.createDraft({ title: p.title, summary: p.description, body: p.body, category: p.category, tags: p.tags, providers: p.providers });
  }

  draft(id: string): ListingDraftInput & { id: string; status: ListingStatus; remoteId: string | null; remoteStatus: ListingStatus | null; moderationNote: string | null } {
    const r = this.ownRow(id);
    return { ...this.rowToDraft(r), id: r.id, status: r.status, remoteId: r.remote_id, remoteStatus: r.remote_status, moderationNote: r.moderation_note };
  }

  /** Saving with a new version number records it in the version history. */
  updateDraft(id: string, patch: Partial<ListingDraftInput>): Listing {
    const r = this.ownRow(id);
    const cur = this.rowToDraft(r);
    const d = this.draftData(patch, cur);
    const now = this.now();
    this.db.tx(() => {
      this.db.run(
        `UPDATE listings SET title = ?, summary = ?, preview = ?, body = ?, category = ?, tags = ?, providers = ?, pricing_type = ?, price_cents = ?, currency = ?, trial_eligible = ?, version = ?, updated_at = ? WHERE id = ?`,
        [d.title || r.title, d.summary, d.preview, d.body, d.category, JSON.stringify(d.tags), JSON.stringify(d.providers), d.pricing.type, d.pricing.type === 'paid' ? d.pricing.priceCents : 0, d.pricing.type === 'paid' ? d.pricing.currency : 'USD', d.trialEligible ? 1 : 0, d.version, now, id],
      );
      if (d.version !== cur.version) this.db.run('INSERT INTO listing_versions (id, listing_id, version, title, body, changelog, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [newId(), id, d.version, d.title, d.body, d.changelog, now]);
      else this.db.run('UPDATE listing_versions SET body = ?, title = ?, changelog = ? WHERE id = (SELECT id FROM listing_versions WHERE listing_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1)', [d.body, d.title, d.changelog, id]);
    });
    return this.toListing(this.localRow(id), { withBody: true });
  }

  deleteDraft(id: string): void {
    const r = this.ownRow(id);
    if (r.remote_id) throw new UserError('This listing is on the marketplace server. Remove it there first (Unpublish).');
    this.db.run('DELETE FROM listings WHERE id = ?', [id]);
  }

  async unpublish(id: string): Promise<Listing> {
    const r = this.ownRow(id);
    if (!r.remote_id) throw new UserError('This listing is not on a marketplace server.');
    this.requireAccount();
    await this.requireRemote().deleteListing(r.remote_id);
    this.db.run('UPDATE listings SET remote_id = NULL, remote_status = NULL WHERE id = ?', [id]);
    return this.toListing(this.localRow(id), { withBody: true });
  }

  checks(id: string): PublishCheck[] {
    const d = this.rowToDraft(this.ownRow(id));
    const vars = parseVariables(d.body);
    const out: PublishCheck[] = [
      { id: 'title', label: 'Title (3–120 characters)', ok: d.title.length >= 3, detail: null },
      { id: 'summary', label: 'Summary (at least 10 characters)', ok: d.summary.length >= 10, detail: null },
      { id: 'body', label: 'Prompt text (at least 20 characters)', ok: d.body.trim().length >= 20, detail: vars.length ? `Variables: ${vars.map((v) => v.name).join(', ')}` : null },
      { id: 'preview', label: 'Preview does not give away the prompt', ok: !previewProblem(d.preview, d.body), detail: previewProblem(d.preview, d.body) },
      { id: 'version', label: 'Version number like 1.0.0', ok: SEMVER.test(d.version), detail: null },
    ];
    if (d.pricing.type === 'paid') {
      out.push({ id: 'price', label: 'Price of at least 0.99', ok: d.pricing.priceCents >= 99 && d.pricing.priceCents <= 100_000, detail: null });
      out.push({ id: 'paid-server', label: 'Paid listings need a marketplace server', ok: !!this.account(), detail: 'Paid listings can only be published to a server; they cannot be exported as files.' });
    }
    return out;
  }

  /** Sends the listing to the server for moderator review. */
  async publish(id: string): Promise<Listing> {
    const failed = this.checks(id).filter((c) => !c.ok && c.id !== 'paid-server');
    if (failed.length) throw new UserError(`Fix these first: ${failed.map((c) => c.label).join('; ')}.`);
    this.requireAccount();
    const remote = this.requireRemote();
    const r = this.ownRow(id);
    const body = this.rowToDraft(r);
    let l = r.remote_id ? await remote.updateListing(r.remote_id, body).catch(async (err: unknown) => (err instanceof RemoteError && err.status === 404 ? remote.createListing(body) : Promise.reject(err))) : await remote.createListing(body);
    if (l.status === 'draft' || l.status === 'rejected') l = await remote.submit(l.id);
    this.db.run("UPDATE listings SET remote_id = ?, remote_status = ?, moderation_note = ?, status = 'published', published_at = COALESCE(published_at, ?) WHERE id = ?", [l.id, l.status, l.moderationNote, this.now(), id]);
    return this.toListing(this.localRow(id), { withBody: true });
  }

  async analytics(id: string): Promise<{ server: { views: number; trialStarts: number; acquisitions: number; reviews: number; averageRating: number | null } | null; note: string }> {
    const r = this.ownRow(id);
    if (!r.remote_id || !this.account()) {
      return { server: null, note: 'Analytics appear once the listing is published on a marketplace server. Prompts shared as files are not tracked.' };
    }
    const a = await this.requireRemote().analytics(r.remote_id);
    return { server: { views: a.views, trialStarts: a.trialStarts, acquisitions: a.acquisitions, reviews: a.reviews, averageRating: a.averageRating }, note: 'Counted by the marketplace server: page views (once per visitor per hour), trials started, free acquisitions and reviews.' };
  }

  /** A shareable file for a free listing. */
  exportPackage(id: string): object {
    const d = this.rowToDraft(this.ownRow(id));
    if (d.pricing.type !== 'free') throw new UserError('Only free listings can be shared as files. Paid listings must go through a marketplace server.');
    const self = this.selfProfile();
    return { format: 'flowcompanion.listing', version: 1, creator: { displayName: self.displayName, bio: self.bio, website: self.website }, listing: d };
  }

  importPackage(raw: unknown): Listing {
    const parsed = PackageDoc.safeParse(raw);
    if (!parsed.success) throw new UserError('This is not a valid FlowCompanion listing file. Only free listings can be imported from files.');
    const { creator, listing } = parsed.data;
    const now = this.now();
    const creatorId = newId();
    const id = newId();
    this.db.tx(() => {
      this.db.run("INSERT INTO creator_profiles (id, display_name, bio, website, is_self, origin, created_at) VALUES (?, ?, ?, ?, 0, 'local', ?)", [creatorId, cleanLine(creator.displayName, 60), creator.bio, /^https:\/\//.test(creator.website) ? creator.website : '', now]);
      this.db.run(
        `INSERT INTO listings (id, origin, title, summary, preview, body, category, tags, providers, creator_id, pricing_type, version, status, imported, created_at, updated_at, published_at)
         VALUES (?, 'local', ?, ?, ?, ?, ?, ?, ?, ?, 'free', ?, 'published', 1, ?, ?, ?)`,
        [id, cleanLine(listing.title, 120), cleanLine(listing.summary, 300), listing.preview, listing.body, cleanLine(listing.category, 40).toLowerCase(), JSON.stringify(cleanTags(listing.tags)), JSON.stringify(listing.providers), creatorId, listing.version, now, now, now],
      );
      this.db.run('INSERT INTO listing_versions (id, listing_id, version, title, body, changelog, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [newId(), id, listing.version, listing.title, listing.body, listing.changelog, now]);
    });
    return this.toListing(this.localRow(id), { withBody: true });
  }

  // ───────── Trials ─────────

  /** Server trials cached on this device, for expiry reminders. */
  trials(): { listingKey: string; title: string; expiresAt: string; entitlementId: string }[] {
    return this.db
      .all<{ id: string; listing_id: string; expires_at: string }>("SELECT id, listing_id, expires_at FROM entitlements WHERE kind = 'trial' AND authority = 'server' AND revoked_at IS NULL AND expires_at IS NOT NULL")
      .map((e) => ({ listingKey: e.listing_id, title: this.d.kv.get<string>(`market:title:${e.listing_id}`, 'A marketplace prompt'), expiresAt: e.expires_at, entitlementId: e.id }));
  }
}

function safeNormalize(url: string): string | null {
  try {
    return normalizeServerUrl(url);
  } catch {
    return null;
  }
}
