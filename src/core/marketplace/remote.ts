import { z } from 'zod';
import {
  API_PREFIX,
  Account,
  ErrorBody,
  ModerationQueue,
  RemoteAnalytics,
  RemoteCreator,
  RemoteEntitlement,
  RemoteListing,
  RemoteReview,
  ServerInfo,
  type ListingDraftBodyT,
} from '../../shared/marketplace/protocol';
import { UserError } from '../util';

export class RemoteError extends UserError {
  constructor(
    message: string,
    readonly status: number,
    code: string,
  ) {
    super(message, code);
    this.name = 'RemoteError';
  }
}

/** https only, except plain http to this computer (for running the reference server locally). */
export function normalizeServerUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new UserError('Enter the marketplace server address, for example https://market.example.org');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) throw new UserError('Marketplace servers must use https:// (plain http is only allowed for localhost).');
  if (u.username || u.password) throw new UserError('Do not put a username or password in the server address.');
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

const Session = z.object({ token: z.string().min(20), account: Account });
const Ok = z.object({ ok: z.literal(true) }).passthrough();

/** Thin, validated client for the marketplace HTTP API. */
export class MarketplaceRemote {
  readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchFn: typeof fetch,
    private readonly token: () => string | null,
    private readonly userAgent: string,
    private readonly timeoutMs = 15_000,
  ) {
    this.baseUrl = normalizeServerUrl(baseUrl);
  }

  private async req<S extends z.ZodTypeAny>(method: string, path: string, schema: S, body?: unknown): Promise<z.infer<S>> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      const token = this.token();
      res = await this.fetchFn(`${this.baseUrl}${API_PREFIX}${path}`, {
        method,
        signal: ctrl.signal,
        redirect: 'error',
        headers: {
          accept: 'application/json',
          'user-agent': this.userAgent,
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new RemoteError(
        (err as Error).name === 'AbortError' ? 'The marketplace server did not respond in time.' : `Could not reach the marketplace server (${new URL(this.baseUrl).host}).`,
        0,
        'network',
      );
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new RemoteError(`The marketplace server sent an unexpected response (HTTP ${res.status}).`, res.status, 'bad_response');
    }
    if (!res.ok) {
      const e = ErrorBody.safeParse(data);
      throw new RemoteError(e.success ? e.data.error.message : `The marketplace server returned HTTP ${res.status}.`, res.status, e.success ? e.data.error.code : 'http_error');
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new RemoteError('The marketplace server sent data this version of FlowCompanion does not understand.', res.status, 'bad_response');
    return parsed.data;
  }

  info() {
    return this.req('GET', '/info', ServerInfo);
  }
  register(b: { email: string; password: string; displayName: string }) {
    return this.req('POST', '/accounts', Session, b);
  }
  login(b: { email: string; password: string }) {
    return this.req('POST', '/sessions', Session, b);
  }
  logout() {
    return this.req('DELETE', '/sessions', Ok);
  }
  me() {
    return this.req('GET', '/me', Account);
  }
  updateProfile(b: { displayName: string; bio: string; website: string }) {
    return this.req('PUT', '/me/profile', Ok, b);
  }
  listings(q: { search?: string; category?: string; pricing?: string; sort?: string }) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v && v !== 'any' && v !== 'all') p.set(k, v);
    return this.req('GET', `/listings${p.size ? `?${p}` : ''}`, z.array(RemoteListing));
  }
  listing(id: string) {
    return this.req('GET', `/listings/${encodeURIComponent(id)}`, RemoteListing);
  }
  reviews(id: string) {
    return this.req('GET', `/listings/${encodeURIComponent(id)}/reviews`, z.array(RemoteReview));
  }
  addReview(id: string, b: { rating: number; text: string }) {
    return this.req('POST', `/listings/${encodeURIComponent(id)}/reviews`, Ok, b);
  }
  report(id: string, b: { reason: string; details: string }) {
    return this.req('POST', `/listings/${encodeURIComponent(id)}/reports`, Ok, b);
  }
  acquire(id: string) {
    return this.req('POST', `/listings/${encodeURIComponent(id)}/acquire`, RemoteListing, {});
  }
  trial(id: string) {
    return this.req('POST', `/listings/${encodeURIComponent(id)}/trial`, z.object({ entitlement: RemoteEntitlement, listing: RemoteListing }), {});
  }
  purchase(id: string) {
    return this.req('POST', `/listings/${encodeURIComponent(id)}/purchase`, z.unknown(), {});
  }
  entitlements() {
    return this.req('GET', '/me/entitlements', z.array(RemoteEntitlement));
  }
  creator(id: string) {
    return this.req('GET', `/creators/${encodeURIComponent(id)}`, z.object({ creator: RemoteCreator, listings: z.array(RemoteListing) }));
  }
  myListings() {
    return this.req('GET', '/me/listings', z.array(RemoteListing));
  }
  createListing(b: ListingDraftBodyT) {
    return this.req('POST', '/me/listings', RemoteListing, b);
  }
  updateListing(id: string, b: ListingDraftBodyT) {
    return this.req('PUT', `/me/listings/${encodeURIComponent(id)}`, RemoteListing, b);
  }
  submit(id: string) {
    return this.req('POST', `/me/listings/${encodeURIComponent(id)}/submit`, RemoteListing, {});
  }
  deleteListing(id: string) {
    return this.req('DELETE', `/me/listings/${encodeURIComponent(id)}`, Ok);
  }
  analytics(id: string) {
    return this.req('GET', `/me/listings/${encodeURIComponent(id)}/analytics`, RemoteAnalytics);
  }
  moderationQueue() {
    return this.req('GET', '/moderation/queue', ModerationQueue);
  }
  moderate(id: string, b: { action: 'approve' | 'reject' | 'remove'; note: string }) {
    return this.req('POST', `/moderation/listings/${encodeURIComponent(id)}`, RemoteListing, b);
  }
  resolveReport(id: string, action: 'reviewed' | 'dismissed') {
    return this.req('POST', `/moderation/reports/${encodeURIComponent(id)}`, Ok, { action });
  }
}
