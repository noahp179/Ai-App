/* eslint-disable @typescript-eslint/no-explicit-any -- raw HTTP JSON responses are inspected loosely in this test */
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMarketplaceServer, hashPassword, verifyPassword } from '../../server/app';
import { seedDemo } from '../../server/seed';
import { FakeClock, tempDir } from '../helpers/db';

const clock = new FakeClock('2026-10-01T09:00:00.000Z');
let base = '';
let close: () => Promise<void>;

async function call(method: string, p: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}/api/v1${p}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

const draft = (over: Record<string, unknown> = {}) => ({
  title: 'Interview practice coach',
  summary: 'Practise answering interview questions with feedback after each answer.',
  preview: 'A mock interviewer that asks one question at a time…',
  body: 'Act as an interviewer for a {{role}} position. Ask one question at a time, wait for my answer, then give specific feedback and a stronger example answer.',
  category: 'business',
  tags: ['interview'],
  providers: ['any'],
  pricing: { type: 'free' },
  trialEligible: false,
  version: '1.0.0',
  changelog: 'First version',
  ...over,
});

let admin = '';
let creator = '';
let buyer = '';

beforeAll(async () => {
  const s = createMarketplaceServer({ dbPath: path.join(tempDir(), 'm.db'), clock, adminEmail: 'mod@example.com', rateLimit: 1000 });
  await new Promise<void>((r) => s.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(s.server.address() as AddressInfo).port}`;
  close = s.close;
  admin = (await call('POST', '/accounts', { email: 'mod@example.com', password: 'correct horse battery', displayName: 'Moderator' })).json.token;
  creator = (await call('POST', '/accounts', { email: 'maker@example.com', password: 'correct horse battery', displayName: 'Maker' })).json.token;
  buyer = (await call('POST', '/accounts', { email: 'learner@example.com', password: 'correct horse battery', displayName: 'Learner' })).json.token;
});
afterAll(() => close());

describe('reference marketplace server', () => {
  it('hashes passwords with scrypt and never stores them in plain text', () => {
    const h = hashPassword('a long password');
    expect(h).toMatch(/^scrypt\$/);
    expect(h).not.toContain('a long password');
    expect(verifyPassword('a long password', h)).toBe(true);
    expect(verifyPassword('wrong', h)).toBe(false);
  });

  it('reports that payments are not configured', async () => {
    const r = await call('GET', '/info');
    expect(r.json).toMatchObject({ paymentsEnabled: false, trialDays: 7, registrationOpen: true });
  });

  it('handles accounts: duplicate email, bad password, sign-in, roles', async () => {
    expect((await call('POST', '/accounts', { email: 'maker@example.com', password: 'correct horse battery', displayName: 'X' })).status).toBe(409);
    expect((await call('POST', '/accounts', { email: 'short@example.com', password: 'short', displayName: 'X' })).status).toBe(400);
    expect((await call('POST', '/sessions', { email: 'maker@example.com', password: 'nope nope nope' })).status).toBe(401);
    const ok = await call('POST', '/sessions', { email: 'MAKER@example.com', password: 'correct horse battery' });
    expect(ok.status).toBe(200);
    expect((await call('GET', '/me', undefined, ok.json.token)).json).toMatchObject({ email: 'maker@example.com', role: 'user' });
    expect((await call('GET', '/me', undefined, admin)).json.role).toBe('admin');
    expect((await call('GET', '/me')).status).toBe(401);
    await call('DELETE', '/sessions', undefined, ok.json.token);
    expect((await call('GET', '/me', undefined, ok.json.token)).status).toBe(401);
  });

  it('runs listings through review before anyone else can see them', async () => {
    const created = await call('POST', '/me/listings', draft(), creator);
    expect(created.status).toBe(200);
    expect(created.json.status).toBe('draft');
    const id = created.json.id;
    expect((await call('GET', `/listings/${id}`)).status).toBe(404);
    expect((await call('POST', `/me/listings/${id}/submit`, {}, creator)).json.status).toBe('pending_review');
    expect((await call('GET', '/listings')).json.find((l: any) => l.id === id)).toBeUndefined();
    expect((await call('POST', `/moderation/listings/${id}`, { action: 'approve' }, creator)).status).toBe(403);
    const queue = await call('GET', '/moderation/queue', undefined, admin);
    expect(queue.json.pending.map((l: any) => l.id)).toContain(id);
    expect((await call('POST', `/moderation/listings/${id}`, { action: 'reject' }, admin)).status).toBe(400);
    expect((await call('POST', `/moderation/listings/${id}`, { action: 'approve', note: '' }, admin)).json.status).toBe('published');
    const pub = await call('GET', `/listings/${id}`);
    expect(pub.json).toMatchObject({ status: 'published', body: expect.stringContaining('interviewer'), rating: null });
    // Editing a published listing sends it back to review.
    const edited = await call('PUT', `/me/listings/${id}`, draft({ version: '1.1.0', body: `${draft().body} Finish with a summary.` }), creator);
    expect(edited.json.status).toBe('pending_review');
    expect((await call('GET', `/listings/${id}`)).status).toBe(404);
    await call('POST', `/moderation/listings/${id}`, { action: 'approve' }, admin);
  });

  it('rejects previews that give away the prompt and trials on free listings', async () => {
    const body = draft().body;
    expect((await call('POST', '/me/listings', draft({ preview: body }), creator)).json.error.message).toMatch(/preview/i);
    expect((await call('POST', '/me/listings', draft({ trialEligible: true }), creator)).status).toBe(400);
  });

  it('only lets people who used a prompt review it, and never the creator', async () => {
    const id = (await call('GET', '/listings?search=interview')).json[0].id;
    expect((await call('POST', `/listings/${id}/reviews`, { rating: 5, text: 'Great' }, buyer)).status).toBe(403);
    expect((await call('POST', `/listings/${id}/reviews`, { rating: 5, text: 'Mine' }, creator)).status).toBe(403);
    expect((await call('POST', `/listings/${id}/acquire`, {}, buyer)).status).toBe(200);
    expect((await call('POST', `/listings/${id}/reviews`, { rating: 4, text: 'Useful practice' }, buyer)).status).toBe(200);
    const reviews = await call('GET', `/listings/${id}/reviews`);
    expect(reviews.json).toEqual([expect.objectContaining({ authorName: 'Learner', rating: 4, verified: true })]);
    expect((await call('GET', `/listings/${id}`)).json.rating).toEqual({ average: 4, count: 1 });
  });

  it('enforces 7-day trials on the server and refuses purchases with 501', async () => {
    const created = await call('POST', '/me/listings', draft({ title: 'Paid essay planner', pricing: { type: 'paid', priceCents: 499, currency: 'USD' }, trialEligible: true }), creator);
    const id = created.json.id;
    await call('POST', `/me/listings/${id}/submit`, {}, creator);
    await call('POST', `/moderation/listings/${id}`, { action: 'approve' }, admin);
    expect((await call('GET', `/listings/${id}`, undefined, buyer)).json.body).toBeNull();
    expect((await call('POST', `/listings/${id}/acquire`, {}, buyer)).status).toBe(402);
    const buy = await call('POST', `/listings/${id}/purchase`, {}, buyer);
    expect(buy.status).toBe(501);
    expect(buy.json.error.code).toBe('payments_not_configured');

    const trial = await call('POST', `/listings/${id}/trial`, {}, buyer);
    expect(trial.status).toBe(200);
    expect(trial.json.entitlement).toMatchObject({ kind: 'trial', startsAt: '2026-10-01T09:00:00.000Z', expiresAt: '2026-10-08T09:00:00.000Z' });
    expect(trial.json.listing.body).toContain('interviewer');
    expect((await call('POST', `/listings/${id}/trial`, {}, buyer)).status).toBe(409);

    clock.set('2026-10-08T08:59:00.000Z');
    expect((await call('GET', `/listings/${id}`, undefined, buyer)).json.body).not.toBeNull();
    clock.set('2026-10-08T09:00:01.000Z');
    expect((await call('GET', `/listings/${id}`, undefined, buyer)).json.body).toBeNull();
    expect((await call('POST', `/listings/${id}/trial`, {}, buyer)).status).toBe(409);
    clock.set('2026-10-01T09:00:00.000Z');

    const a = await call('GET', `/me/listings/${id}/analytics`, undefined, creator);
    expect(a.json).toMatchObject({ trialStarts: 1, acquisitions: 0 });
    expect((await call('GET', `/me/listings/${id}/analytics`, undefined, buyer)).status).toBe(404);
  });

  it('collects abuse reports for moderators', async () => {
    const id = (await call('GET', '/listings?search=interview')).json[0].id;
    expect((await call('POST', `/listings/${id}/reports`, { reason: 'spam', details: 'test' })).status).toBe(401);
    expect((await call('POST', `/listings/${id}/reports`, { reason: 'spam', details: 'Looks copied' }, buyer)).status).toBe(200);
    const q = await call('GET', '/moderation/queue', undefined, admin);
    const rep = q.json.reports.find((r: any) => r.listingId === id);
    expect(rep).toMatchObject({ reason: 'spam', status: 'open' });
    expect((await call('POST', `/moderation/reports/${rep.id}`, { action: 'dismissed' }, admin)).status).toBe(200);
    expect((await call('GET', '/moderation/queue', undefined, admin)).json.reports.find((r: any) => r.id === rep.id)).toBeUndefined();
  });

  it('rejects malformed requests', async () => {
    expect((await call('POST', '/sessions', 'not json')).status).toBe(400);
    expect((await call('POST', '/sessions', 'x', undefined, { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await call('POST', '/me/listings', { ...draft(), body: 'x'.repeat(300_000) }, creator)).status).toBe(413);
    expect((await call('GET', '/nope')).status).toBe(404);
    expect((await call('PATCH', '/listings')).status).toBe(405);
  });

  it('seeds clearly labelled demo content without inventing reviews', async () => {
    const s = createMarketplaceServer({ dbPath: path.join(tempDir(), 'demo.db'), clock });
    expect(seedDemo(s.db, clock.now().toISOString())).toBe(3);
    expect(seedDemo(s.db, clock.now().toISOString())).toBe(0);
    const rows = s.db.all<{ title: string; demo: number }>('SELECT title, demo FROM listings');
    expect(rows.every((r) => r.demo === 1 && r.title.startsWith('Demo:'))).toBe(true);
    expect(s.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM reviews')!.n).toBe(0);
    await s.close();
  });
});

describe('rate limiting', () => {
  it('limits sign-in attempts per address', async () => {
    const s = createMarketplaceServer({ dbPath: path.join(tempDir(), 'rl.db'), rateLimit: 50 });
    await new Promise<void>((r) => s.server.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(s.server.address() as AddressInfo).port}/api/v1/sessions`;
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"email":"a@b.co","password":"x"}' })).status);
    expect(statuses.slice(0, 5).every((x) => x === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    await s.close();
  });
});
