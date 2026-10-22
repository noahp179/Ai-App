import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import type { z } from 'zod';
import { Db } from '../src/core/db/database';
import type { Clock } from '../src/core/util';
import {
  API_PREFIX,
  ListingDraftBody,
  LoginBody,
  ModerateListingBody,
  ProfileBody,
  RegisterBody,
  ReportBody,
  ResolveReportBody,
  ReviewBody,
  TRIAL_DAYS,
  previewProblem,
  type AccountT,
  type PricingT,
  type RemoteListingT,
} from '../src/shared/marketplace/protocol';
import { migrateServer } from './schema';

export interface ServerOptions {
  dbPath: string;
  name?: string;
  clock?: Clock;
  /** Email that becomes an administrator (moderator) when it registers. */
  adminEmail?: string | null;
  registrationOpen?: boolean;
  /** Requests per minute per client address (auth endpoints get a tenth of this). */
  rateLimit?: number;
  log?: (line: string) => void;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface ListingRow {
  id: string;
  creator_id: string;
  creator_name: string;
  title: string;
  summary: string;
  preview: string;
  body: string;
  category: string;
  tags: string;
  providers: string;
  pricing: string;
  trial_eligible: number;
  version: string;
  status: RemoteListingT['status'];
  moderation_note: string | null;
  demo: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface Ctx {
  req: http.IncomingMessage;
  url: URL;
  account: (AccountT & { creatorId: string }) | null;
  visitor: string;
  body: unknown;
}

const PASSWORD_N = 16384;
const SESSION_DAYS = 30;
const MAX_BODY = 256 * 1024;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: PASSWORD_N });
  return `scrypt$${PASSWORD_N}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, n, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n) });
  return timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Reference marketplace server. Plain node:http + SQLite, no framework. It is meant to be run behind a
 * TLS-terminating reverse proxy. Payments are deliberately not implemented: purchase requests get 501.
 */
export function createMarketplaceServer(opts: ServerOptions): { server: http.Server; db: Db; close: () => Promise<void> } {
  const db = new Db(opts.dbPath);
  migrateServer(db);
  const clock = opts.clock ?? { now: () => new Date() };
  const now = () => clock.now().toISOString();
  const limit = opts.rateLimit ?? 240;
  const buckets = new Map<string, { count: number; reset: number }>();

  const rate = (key: string, max: number) => {
    const t = Date.now();
    const b = buckets.get(key);
    if (!b || b.reset < t) {
      buckets.set(key, { count: 1, reset: t + 60_000 });
      if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < t) buckets.delete(k);
      return;
    }
    if (++b.count > max) throw new HttpError(429, 'rate_limited', 'Too many requests. Wait a minute and try again.');
  };

  const parse = <S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> => {
    const r = schema.safeParse(body);
    if (!r.success) throw new HttpError(400, 'invalid_request', r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
    return r.data;
  };

  const requireAccount = (c: Ctx) => {
    if (!c.account) throw new HttpError(401, 'unauthorized', 'Sign in to the marketplace first.');
    return c.account;
  };
  const requireAdmin = (c: Ctx) => {
    const a = requireAccount(c);
    if (a.role !== 'admin') throw new HttpError(403, 'forbidden', 'Only moderators can do this.');
    return a;
  };

  const listingRow = (id: string) => db.get<ListingRow>('SELECT l.*, c.display_name AS creator_name FROM listings l JOIN creators c ON c.id = l.creator_id WHERE l.id = ?', [id]);

  const activeEntitlement = (accountId: string, listingId: string) =>
    db.get<{ id: string; kind: string; expires_at: string | null }>(
      `SELECT id, kind, expires_at FROM entitlements WHERE account_id = ? AND listing_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) ORDER BY kind = 'purchase' DESC LIMIT 1`,
      [accountId, listingId, now()],
    );

  const canSee = (r: ListingRow, c: Ctx) => r.status === 'published' || (c.account && (c.account.creatorId === r.creator_id || c.account.role === 'admin'));

  const toListing = (r: ListingRow, c: Ctx): RemoteListingT => {
    const pricing = JSON.parse(r.pricing) as PricingT;
    const own = !!c.account && (c.account.creatorId === r.creator_id || c.account.role === 'admin');
    const entitled = !!c.account && !!activeEntitlement(c.account.id, r.id);
    const rating = db.get<{ avg: number | null; n: number }>('SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE listing_id = ?', [r.id])!;
    return {
      id: r.id,
      title: r.title,
      summary: r.summary,
      preview: r.preview,
      body: pricing.type === 'free' || own || entitled ? r.body : null,
      category: r.category,
      tags: JSON.parse(r.tags) as string[],
      providers: JSON.parse(r.providers) as RemoteListingT['providers'],
      creator: { id: r.creator_id, displayName: r.creator_name },
      pricing,
      trialEligible: r.trial_eligible === 1,
      version: r.version,
      status: r.status,
      moderationNote: own ? r.moderation_note : null,
      demo: r.demo === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      publishedAt: r.published_at,
      rating: rating.n ? { average: Math.round((rating.avg ?? 0) * 10) / 10, count: rating.n } : null,
    };
  };

  const recordEvent = (listingId: string, kind: 'view' | 'trial' | 'acquire', visitor: string) => {
    if (kind === 'view' && db.get('SELECT 1 FROM events WHERE listing_id = ? AND kind = ? AND visitor = ? AND at > ?', [listingId, kind, visitor, new Date(clock.now().getTime() - 3600_000).toISOString()])) return;
    db.run('INSERT INTO events (listing_id, kind, visitor, at) VALUES (?, ?, ?, ?)', [listingId, kind, visitor, now()]);
  };

  const entitlementDto = (e: { id: string; listing_id: string; kind: string; starts_at: string; expires_at: string | null; revoked_at: string | null }) => ({
    id: e.id,
    listingId: e.listing_id,
    kind: e.kind,
    startsAt: e.starts_at,
    expiresAt: e.expires_at,
    revokedAt: e.revoked_at,
  });

  const issueSession = (accountId: string) => {
    const token = randomBytes(32).toString('base64url');
    db.run('INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [sha256(token), accountId, now(), new Date(clock.now().getTime() + SESSION_DAYS * 86_400_000).toISOString()]);
    return token;
  };

  const accountDto = (id: string): AccountT & { creatorId: string } => {
    const a = db.get<{ id: string; email: string; display_name: string; role: 'user' | 'admin'; creator_id: string }>(
      'SELECT a.id, a.email, a.display_name, a.role, c.id AS creator_id FROM accounts a JOIN creators c ON c.account_id = a.id WHERE a.id = ?',
      [id],
    )!;
    return { id: a.id, email: a.email, displayName: a.display_name, role: a.role, creatorId: a.creator_id };
  };

  type Handler = (c: Ctx, params: string[]) => unknown;
  const routes: { method: string; pattern: RegExp; handler: Handler }[] = [];
  const route = (method: string, path: string, handler: Handler) =>
    routes.push({ method, pattern: new RegExp(`^${API_PREFIX}${path.replace(/:[a-z]+/g, '([A-Za-z0-9_-]{1,64})')}$`), handler });

  route('GET', '/info', () => ({ name: opts.name ?? 'FlowCompanion reference marketplace', version: '1.0.0', paymentsEnabled: false, trialDays: TRIAL_DAYS, registrationOpen: opts.registrationOpen !== false, demoContent: !!db.get('SELECT 1 FROM listings WHERE demo = 1') }));

  route('POST', '/accounts', (c) => {
    if (opts.registrationOpen === false) throw new HttpError(403, 'registration_closed', 'This marketplace is not accepting new accounts.');
    const b = parse(RegisterBody, c.body);
    if (db.get('SELECT 1 FROM accounts WHERE email = ?', [b.email])) throw new HttpError(409, 'email_taken', 'An account with this email already exists. Sign in instead.');
    const id = randomUUID();
    const role = opts.adminEmail && b.email.toLowerCase() === opts.adminEmail.toLowerCase() ? 'admin' : 'user';
    db.tx(() => {
      db.run('INSERT INTO accounts (id, email, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, b.email, hashPassword(b.password), b.displayName.trim(), role, now()]);
      db.run('INSERT INTO creators (id, account_id, display_name) VALUES (?, ?, ?)', [randomUUID(), id, b.displayName.trim()]);
    });
    return { token: issueSession(id), account: accountDto(id) };
  });

  route('POST', '/sessions', (c) => {
    const b = parse(LoginBody, c.body);
    const a = db.get<{ id: string; password_hash: string }>('SELECT id, password_hash FROM accounts WHERE email = ?', [b.email]);
    if (!a || !verifyPassword(b.password, a.password_hash)) throw new HttpError(401, 'bad_credentials', 'Email or password is incorrect.');
    return { token: issueSession(a.id), account: accountDto(a.id) };
  });

  route('DELETE', '/sessions', (c) => {
    const token = (c.req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (token) db.run('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
    return { ok: true };
  });

  route('GET', '/me', (c) => requireAccount(c));

  route('PUT', '/me/profile', (c) => {
    const a = requireAccount(c);
    const b = parse(ProfileBody, c.body);
    if (b.website && !/^https:\/\/[^\s]+$/.test(b.website)) throw new HttpError(400, 'invalid_request', 'Website must start with https://');
    db.run('UPDATE creators SET display_name = ?, bio = ?, website = ? WHERE id = ?', [b.displayName.trim(), b.bio.trim(), b.website.trim(), a.creatorId]);
    return { ok: true };
  });

  route('GET', '/listings', (c) => {
    const q = c.url.searchParams;
    const where = ["l.status = 'published'"];
    const p: string[] = [];
    const search = (q.get('search') ?? '').trim().slice(0, 100);
    if (search) {
      const like = `%${search.replace(/[%_\\]/g, '')}%`;
      where.push('(l.title LIKE ? OR l.summary LIKE ? OR l.tags LIKE ?)');
      p.push(like, like, like);
    }
    const cat = q.get('category');
    if (cat && cat !== 'all') {
      where.push('l.category = ?');
      p.push(cat);
    }
    const pricing = q.get('pricing');
    if (pricing === 'free' || pricing === 'paid') {
      where.push("json_extract(l.pricing, '$.type') = ?");
      p.push(pricing);
    }
    const sort = q.get('sort') === 'title' ? 'l.title COLLATE NOCASE' : q.get('sort') === 'rating' ? '(SELECT AVG(rating) FROM reviews r WHERE r.listing_id = l.id) DESC NULLS LAST' : 'l.published_at DESC';
    const rows = db.all<ListingRow>(`SELECT l.*, c.display_name AS creator_name FROM listings l JOIN creators c ON c.id = l.creator_id WHERE ${where.join(' AND ')} ORDER BY ${sort} LIMIT 200`, p);
    return rows.map((r) => toListing(r, c));
  });

  route('GET', '/listings/:id', (c, [id]) => {
    const r = listingRow(id!);
    if (!r || !canSee(r, c)) throw new HttpError(404, 'not_found', 'That listing is not available.');
    if (r.status === 'published') recordEvent(r.id, 'view', c.visitor);
    return toListing(r, c);
  });

  route('GET', '/listings/:id/reviews', (c, [id]) => {
    const r = listingRow(id!);
    if (!r || !canSee(r, c)) throw new HttpError(404, 'not_found', 'That listing is not available.');
    return db
      .all<{ id: string; listing_id: string; display_name: string; rating: number; text: string; created_at: string }>(
        'SELECT r.*, a.display_name FROM reviews r JOIN accounts a ON a.id = r.account_id WHERE r.listing_id = ? ORDER BY r.created_at DESC LIMIT 200',
        [id!],
      )
      .map((x) => ({ id: x.id, listingId: x.listing_id, authorName: x.display_name, rating: x.rating, text: x.text, verified: true, createdAt: x.created_at }));
  });

  /** Only people who had access (free acquisition, trial or purchase) can review: every review is verified. */
  route('POST', '/listings/:id/reviews', (c, [id]) => {
    const a = requireAccount(c);
    const r = listingRow(id!);
    if (!r || r.status !== 'published') throw new HttpError(404, 'not_found', 'That listing is not available.');
    if (r.creator_id === a.creatorId) throw new HttpError(403, 'own_listing', 'You cannot review your own listing.');
    if (!db.get('SELECT 1 FROM entitlements WHERE account_id = ? AND listing_id = ?', [a.id, r.id]))
      throw new HttpError(403, 'not_verified', 'Only people who have used this prompt (free, trial or purchase) can review it.');
    const b = parse(ReviewBody, c.body);
    db.run(
      `INSERT INTO reviews (id, listing_id, account_id, rating, text, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(listing_id, account_id) DO UPDATE SET rating = excluded.rating, text = excluded.text, created_at = excluded.created_at`,
      [randomUUID(), r.id, a.id, b.rating, b.text.trim(), now()],
    );
    return { ok: true };
  });

  route('POST', '/listings/:id/reports', (c, [id]) => {
    const a = requireAccount(c);
    const r = listingRow(id!);
    if (!r || !canSee(r, c)) throw new HttpError(404, 'not_found', 'That listing is not available.');
    const b = parse(ReportBody, c.body);
    if (db.get("SELECT 1 FROM reports WHERE listing_id = ? AND account_id = ? AND status = 'open'", [r.id, a.id])) return { ok: true, duplicate: true };
    db.run('INSERT INTO reports (id, listing_id, account_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomUUID(), r.id, a.id, b.reason, b.details.trim(), 'open', now()]);
    return { ok: true };
  });

  route('POST', '/listings/:id/acquire', (c, [id]) => {
    const a = requireAccount(c);
    const r = listingRow(id!);
    if (!r || r.status !== 'published') throw new HttpError(404, 'not_found', 'That listing is not available.');
    if ((JSON.parse(r.pricing) as PricingT).type !== 'free') throw new HttpError(402, 'payment_required', 'This is a paid listing. Start a trial instead.');
    if (!db.get("SELECT 1 FROM entitlements WHERE account_id = ? AND listing_id = ? AND kind = 'free'", [a.id, r.id])) {
      db.run('INSERT INTO entitlements (id, account_id, listing_id, kind, starts_at) VALUES (?, ?, ?, ?, ?)', [randomUUID(), a.id, r.id, 'free', now()]);
      recordEvent(r.id, 'acquire', a.id);
    }
    return toListing(r, c);
  });

  /** Server-authoritative trial: the server sets the expiry and stops returning the prompt after it. One per account per listing. */
  route('POST', '/listings/:id/trial', (c, [id]) => {
    const a = requireAccount(c);
    const r = listingRow(id!);
    if (!r || r.status !== 'published') throw new HttpError(404, 'not_found', 'That listing is not available.');
    if ((JSON.parse(r.pricing) as PricingT).type !== 'paid' || r.trial_eligible !== 1) throw new HttpError(400, 'no_trial', 'This listing does not offer a trial.');
    if (r.creator_id === a.creatorId) throw new HttpError(400, 'own_listing', 'You already have access to your own listing.');
    if (db.get("SELECT 1 FROM entitlements WHERE account_id = ? AND listing_id = ? AND kind = 'trial'", [a.id, r.id])) throw new HttpError(409, 'trial_used', 'You have already used the trial for this listing.');
    const start = clock.now();
    const e = { id: randomUUID(), listing_id: r.id, kind: 'trial', starts_at: start.toISOString(), expires_at: new Date(start.getTime() + TRIAL_DAYS * 86_400_000).toISOString(), revoked_at: null };
    db.run('INSERT INTO entitlements (id, account_id, listing_id, kind, starts_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', [e.id, a.id, e.listing_id, e.kind, e.starts_at, e.expires_at]);
    recordEvent(r.id, 'trial', a.id);
    return { entitlement: entitlementDto(e), listing: toListing(r, c) };
  });

  route('POST', '/listings/:id/purchase', () => {
    throw new HttpError(501, 'payments_not_configured', 'Payments are not set up on this marketplace server, so nothing can be bought and you have not been charged.');
  });

  route('GET', '/me/entitlements', (c) => {
    const a = requireAccount(c);
    return db.all<{ id: string; listing_id: string; kind: string; starts_at: string; expires_at: string | null; revoked_at: string | null }>('SELECT * FROM entitlements WHERE account_id = ?', [a.id]).map(entitlementDto);
  });

  route('GET', '/creators/:id', (c, [id]) => {
    const cr = db.get<{ id: string; display_name: string; bio: string; website: string }>('SELECT * FROM creators WHERE id = ?', [id!]);
    if (!cr) throw new HttpError(404, 'not_found', 'Creator not found.');
    const listings = db.all<ListingRow>("SELECT l.*, c.display_name AS creator_name FROM listings l JOIN creators c ON c.id = l.creator_id WHERE l.creator_id = ? AND l.status = 'published' ORDER BY l.published_at DESC", [cr.id]);
    return { creator: { id: cr.id, displayName: cr.display_name, bio: cr.bio, website: cr.website, listingCount: listings.length }, listings: listings.map((l) => toListing(l, c)) };
  });

  // ── Creator tools ──
  const ownListing = (c: Ctx, id: string) => {
    const a = requireAccount(c);
    const r = listingRow(id);
    if (!r || r.creator_id !== a.creatorId) throw new HttpError(404, 'not_found', 'That listing is not yours or does not exist.');
    return r;
  };
  const checkDraft = (b: z.infer<typeof ListingDraftBody>) => {
    const p = previewProblem(b.preview, b.body);
    if (p) throw new HttpError(400, 'invalid_request', p);
    if (b.trialEligible && b.pricing.type !== 'paid') throw new HttpError(400, 'invalid_request', 'Only paid listings can offer a trial.');
  };

  route('GET', '/me/listings', (c) => {
    const a = requireAccount(c);
    return db.all<ListingRow>('SELECT l.*, c.display_name AS creator_name FROM listings l JOIN creators c ON c.id = l.creator_id WHERE l.creator_id = ? ORDER BY l.updated_at DESC', [a.creatorId]).map((r) => toListing(r, c));
  });

  /** New listings start as drafts. */
  route('POST', '/me/listings', (c) => {
    const a = requireAccount(c);
    const b = parse(ListingDraftBody, c.body);
    checkDraft(b);
    const id = randomUUID();
    const t = now();
    db.tx(() => {
      db.run(
        `INSERT INTO listings (id, creator_id, title, summary, preview, body, category, tags, providers, pricing, trial_eligible, version, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
        [id, a.creatorId, b.title.trim(), b.summary.trim(), b.preview.trim(), b.body, b.category, JSON.stringify(b.tags), JSON.stringify(b.providers), JSON.stringify(b.pricing), b.trialEligible ? 1 : 0, b.version, t, t],
      );
      db.run('INSERT INTO listing_versions (id, listing_id, version, body, changelog, created_at) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), id, b.version, b.body, b.changelog, t]);
    });
    return toListing(listingRow(id)!, c);
  });

  /** Editing a published listing sends it back to review; it is hidden until a moderator approves it again. */
  route('PUT', '/me/listings/:id', (c, [id]) => {
    const r = ownListing(c, id!);
    if (r.status === 'removed') throw new HttpError(409, 'removed', 'This listing was removed by a moderator and cannot be edited.');
    const b = parse(ListingDraftBody, c.body);
    checkDraft(b);
    const status = r.status === 'draft' ? 'draft' : 'pending_review';
    db.tx(() => {
      db.run(
        `UPDATE listings SET title = ?, summary = ?, preview = ?, body = ?, category = ?, tags = ?, providers = ?, pricing = ?, trial_eligible = ?, version = ?, status = ?, updated_at = ? WHERE id = ?`,
        [b.title.trim(), b.summary.trim(), b.preview.trim(), b.body, b.category, JSON.stringify(b.tags), JSON.stringify(b.providers), JSON.stringify(b.pricing), b.trialEligible ? 1 : 0, b.version, status, now(), r.id],
      );
      if (b.version !== r.version || b.body !== r.body) db.run('INSERT INTO listing_versions (id, listing_id, version, body, changelog, created_at) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), r.id, b.version, b.body, b.changelog, now()]);
    });
    return toListing(listingRow(r.id)!, c);
  });

  route('POST', '/me/listings/:id/submit', (c, [id]) => {
    const r = ownListing(c, id!);
    if (r.status !== 'draft' && r.status !== 'rejected') throw new HttpError(409, 'bad_state', `A ${r.status.replace('_', ' ')} listing cannot be submitted.`);
    db.run("UPDATE listings SET status = 'pending_review', updated_at = ? WHERE id = ?", [now(), r.id]);
    return toListing(listingRow(r.id)!, c);
  });

  route('DELETE', '/me/listings/:id', (c, [id]) => {
    const r = ownListing(c, id!);
    if (db.get('SELECT 1 FROM entitlements WHERE listing_id = ? AND kind = ?', [r.id, 'purchase'])) throw new HttpError(409, 'has_buyers', 'Listings with buyers cannot be deleted.');
    db.run('DELETE FROM listings WHERE id = ?', [r.id]);
    return { ok: true };
  });

  route('GET', '/me/listings/:id/analytics', (c, [id]) => {
    const r = ownListing(c, id!);
    const count = (kind: string) => db.get<{ n: number }>('SELECT COUNT(*) AS n FROM events WHERE listing_id = ? AND kind = ?', [r.id, kind])!.n;
    const rv = db.get<{ n: number; avg: number | null }>('SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE listing_id = ?', [r.id])!;
    return { listingId: r.id, views: count('view'), trialStarts: count('trial'), acquisitions: count('acquire'), reviews: rv.n, averageRating: rv.avg === null ? null : Math.round(rv.avg * 10) / 10 };
  });

  // ── Moderation ──
  route('GET', '/moderation/queue', (c) => {
    requireAdmin(c);
    const pending = db.all<ListingRow>("SELECT l.*, c.display_name AS creator_name FROM listings l JOIN creators c ON c.id = l.creator_id WHERE l.status = 'pending_review' ORDER BY l.updated_at").map((r) => toListing(r, c));
    const reports = db
      .all<{ id: string; listing_id: string; title: string; reason: string; details: string; status: string; created_at: string }>(
        "SELECT r.*, l.title FROM reports r JOIN listings l ON l.id = r.listing_id WHERE r.status = 'open' ORDER BY r.created_at",
      )
      .map((r) => ({ id: r.id, listingId: r.listing_id, listingTitle: r.title, reason: r.reason, details: r.details, status: r.status, createdAt: r.created_at }));
    return { pending, reports };
  });

  route('POST', '/moderation/listings/:id', (c, [id]) => {
    requireAdmin(c);
    const r = listingRow(id!);
    if (!r) throw new HttpError(404, 'not_found', 'Listing not found.');
    const b = parse(ModerateListingBody, c.body);
    if (b.action === 'approve' && r.status !== 'pending_review') throw new HttpError(409, 'bad_state', 'Only listings waiting for review can be approved.');
    if (b.action === 'reject' && !b.note.trim()) throw new HttpError(400, 'invalid_request', 'Tell the creator why the listing was rejected.');
    const status = b.action === 'approve' ? 'published' : b.action === 'reject' ? 'rejected' : 'removed';
    db.run('UPDATE listings SET status = ?, moderation_note = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?', [status, b.note.trim() || null, status === 'published' ? now() : null, now(), r.id]);
    return toListing(listingRow(r.id)!, c);
  });

  route('POST', '/moderation/reports/:id', (c, [id]) => {
    requireAdmin(c);
    const b = parse(ResolveReportBody, c.body);
    if (!db.run('UPDATE reports SET status = ? WHERE id = ?', [b.action, id!]).changes) throw new HttpError(404, 'not_found', 'Report not found.');
    return { ok: true };
  });

  const authenticate = (req: http.IncomingMessage) => {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return null;
    const s = db.get<{ account_id: string }>('SELECT account_id FROM sessions WHERE token_hash = ? AND expires_at > ?', [sha256(h.slice(7)), now()]);
    return s ? accountDto(s.account_id) : null;
  };

  const readBody = (req: http.IncomingMessage): Promise<unknown> =>
    new Promise((resolve, reject) => {
      if (req.method === 'GET' || req.method === 'DELETE') return resolve(undefined);
      if (!/^application\/json\b/.test(req.headers['content-type'] ?? '')) return reject(new HttpError(415, 'unsupported_media_type', 'Send JSON.'));
      let size = 0;
      const chunks: Buffer[] = [];
      req.on('data', (d: Buffer) => {
        size += d.length;
        // Over the limit: keep draining (so the client gets a clean 413) but drop the data; cut off abusive uploads.
        if (size > MAX_BODY * 16) req.destroy();
        else if (size <= MAX_BODY) chunks.push(d);
      });
      req.on('end', () => {
        if (size > MAX_BODY) return reject(new HttpError(413, 'too_large', 'Request body too large.'));
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
        } catch {
          reject(new HttpError(400, 'invalid_json', 'Body is not valid JSON.'));
        }
      });
      req.on('error', reject);
    });

  const server = http.createServer(async (req, res) => {
    const send = (status: number, body: unknown) => {
      const data = JSON.stringify(body);
      res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'",
        'referrer-policy': 'no-referrer',
      });
      res.end(data);
    };
    const started = Date.now();
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const ip = req.socket.remoteAddress ?? 'unknown';
      rate(`all:${ip}`, limit);
      if (url.pathname.startsWith(`${API_PREFIX}/sessions`) || url.pathname === `${API_PREFIX}/accounts`) rate(`auth:${ip}`, Math.max(5, Math.floor(limit / 10)));
      const match = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
      if (!match) {
        const pathExists = routes.some((r) => r.pattern.test(url.pathname));
        throw new HttpError(pathExists ? 405 : 404, pathExists ? 'method_not_allowed' : 'not_found', pathExists ? 'Method not allowed.' : 'Not found.');
      }
      const account = authenticate(req);
      const body = await readBody(req);
      const params = match.pattern.exec(url.pathname)!.slice(1);
      const result = await match.handler({ req, url, account, visitor: account?.id ?? sha256(ip), body }, params);
      send(200, result);
    } catch (err) {
      if (err instanceof HttpError) send(err.status, { error: { code: err.code, message: err.message } });
      else {
        opts.log?.(`error ${req.method} ${req.url}: ${(err as Error).stack ?? err}`);
        send(500, { error: { code: 'internal', message: 'Something went wrong on the server.' } });
      }
    } finally {
      opts.log?.(`${req.method} ${(req.url ?? '').split('?')[0]} ${res.statusCode} ${Date.now() - started}ms`);
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;

  return {
    server,
    db,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          db.close();
          resolve();
        });
        server.closeAllConnections?.();
      }),
  };
}
