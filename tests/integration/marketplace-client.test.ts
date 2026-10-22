import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMarketplaceServer } from '../../server/app';
import { seedDemo } from '../../server/seed';
import { KvStore } from '../../src/core/kv';
import { MarketplaceService } from '../../src/core/marketplace/service';
import { normalizeServerUrl } from '../../src/core/marketplace/remote';
import { PromptsService } from '../../src/core/prompts';
import { SecretStore } from '../../src/core/secrets';
import { SettingsSchema, type Settings } from '../../src/shared/settings';
import { fakeCipher } from '../helpers/ai';
import { FakeClock, memoryDb, tempDir } from '../helpers/db';

const clock = new FakeClock('2026-10-01T09:00:00.000Z');
let url = '';
let stop: () => Promise<void>;

function client(opts: { serverUrl?: string; secure?: boolean } = {}) {
  const db = memoryDb();
  const settings: Settings = SettingsSchema.parse({});
  settings.marketplace.serverUrl = opts.serverUrl ?? '';
  const kv = new KvStore(db, clock);
  const secrets = new SecretStore(db, fakeCipher(opts.secure ?? true), clock);
  const prompts = new PromptsService(db, clock);
  const m = new MarketplaceService({ db, clock, kv, secrets, prompts, settings: () => settings, fetch, userAgent: 'FlowCompanion-test' });
  m.seedStarter();
  return { db, m, prompts, settings, secrets };
}

beforeAll(async () => {
  const s = createMarketplaceServer({ dbPath: path.join(tempDir(), 'c.db'), clock, adminEmail: 'mod@example.com', rateLimit: 2000 });
  seedDemo(s.db, clock.now().toISOString());
  await new Promise<void>((r) => s.server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(s.server.address() as AddressInfo).port}`;
  stop = s.close;
});
afterAll(() => stop());

describe('marketplace without a server', () => {
  it('lists only the free bundled starter set, labelled as bundled and unrated', async () => {
    const { m } = client();
    const r = await m.listings();
    expect(r.remoteError).toBeNull();
    expect(r.items.length).toBe(16);
    expect(r.items.every((l) => l.origin === 'bundled' && l.pricing.type === 'free' && l.rating === null && l.body === null)).toBe(true);
    expect((await m.listings({ pricing: 'paid' })).items).toEqual([]);
    expect((await m.listings({ search: 'debug' })).items.map((l) => l.id)).toEqual(['starter-debug']);
  });

  it('only lets you rate a prompt after using it, and keeps the rating on this device', async () => {
    const { m } = client();
    const d = await m.listing('bundled:starter-quiz-me');
    expect(d).toMatchObject({ canReview: false, reviewsScope: 'this_device', access: { access: 'free', authority: 'local' } });
    await expect(m.addReview('bundled:starter-quiz-me', { rating: 5, text: 'x' })).rejects.toThrow(/Use this prompt/);
    expect(await m.promptText('bundled:starter-quiz-me', 'copy')).toContain('Quiz me on {{topic}}');
    await m.addReview('bundled:starter-quiz-me', { rating: 4, text: 'Handy' });
    const after = await m.listing('bundled:starter-quiz-me');
    expect(after.reviews).toEqual([expect.objectContaining({ authorName: 'You', rating: 4, verified: true })]);
    expect(after.rating).toBeNull();
    expect(after.yourUsage).toMatchObject({ copies: 1 });
  });

  it('saves to the library once and links back to the listing', async () => {
    const { m } = client();
    const p = await m.saveToLibrary('bundled:starter-summarise');
    expect(p).toMatchObject({ origin: 'marketplace', listingId: 'bundled:starter-summarise', title: 'Summarise a text' });
    expect((await m.saveToLibrary('bundled:starter-summarise')).id).toBe(p.id);
    expect((await m.listing('bundled:starter-summarise')).inLibrary).toBe(p.id);
  });

  it('hides a reported listing locally and can restore it', async () => {
    const { m } = client();
    expect(await m.report('bundled:starter-email-draft', { reason: 'misleading', details: 'test' })).toEqual({ sentTo: 'this_device' });
    expect((await m.listings()).items.find((l) => l.id === 'starter-email-draft')).toBeUndefined();
    const [rep] = m.myReports();
    expect(rep).toMatchObject({ listingTitle: 'Draft a clear email', status: 'open' });
    expect(() => m.resolveLocalReport(rep!.id, 'remove_listing')).toThrow(/Bundled listings cannot be removed/);
    m.resolveLocalReport(rep!.id, 'restore');
    expect((await m.listings()).items.find((l) => l.id === 'starter-email-draft')).toBeDefined();
  });

  it('creates drafts with checks, versions, and exports/imports free listing files', async () => {
    const { m, prompts } = client();
    const src = prompts.create({ title: 'Flashcards', description: 'Turn notes into flashcards for revision', body: 'Make {{count:10}} flashcards from these notes: {{notes}}', category: 'study' });
    const draft = m.draftFromPrompt(src.id);
    expect(draft).toMatchObject({ isMine: true, status: 'draft', title: 'Flashcards' });
    expect((await m.listings()).items.find((l) => l.id === draft.id)).toBeUndefined();
    const checks = m.checks(draft.id);
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(checks.find((c) => c.id === 'body')?.detail).toBe('Variables: count, notes');
    m.updateDraft(draft.id, { preview: 'Make 10 flashcards from these notes: {{notes}}' });
    expect(m.checks(draft.id).find((c) => c.id === 'preview')?.ok).toBe(false);
    m.updateDraft(draft.id, { preview: 'Turns your notes into question-and-answer cards.', version: '1.1.0', changelog: 'Better preview' });
    expect((await m.listing(`local:${draft.id}`)).versions.map((v) => v.version)).toEqual(['1.1.0', '1.0.0']);

    const pkg = JSON.parse(JSON.stringify(m.exportPackage(draft.id)));
    const other = client().m;
    const imported = other.importPackage(pkg);
    expect(imported).toMatchObject({ imported: true, isMine: false, origin: 'local', pricing: { type: 'free' }, title: 'Flashcards' });
    expect((await other.listings()).items.some((l) => l.id === imported.id && l.imported)).toBe(true);

    m.updateDraft(draft.id, { pricing: { type: 'paid', priceCents: 299, currency: 'USD' }, trialEligible: true });
    expect(() => m.exportPackage(draft.id)).toThrow(/Only free listings/);
    expect(() => other.importPackage({ ...pkg, listing: { ...pkg.listing, pricing: { type: 'paid', priceCents: 299, currency: 'USD' } } })).toThrow(/not a valid/);
    await expect(m.publish(draft.id)).rejects.toThrow(/Sign in/);
  });

  it('accepts https, and http only for localhost', () => {
    expect(normalizeServerUrl('https://market.example.org/')).toBe('https://market.example.org');
    expect(normalizeServerUrl('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787');
    expect(() => normalizeServerUrl('http://market.example.org')).toThrow(/https/);
    expect(() => normalizeServerUrl('https://user:pw@market.example.org')).toThrow(/password/);
    expect(() => normalizeServerUrl('ftp://x')).toThrow();
  });
});

describe('marketplace with the reference server', () => {
  it('reports a clear error when the server is unreachable, but still shows bundled listings', async () => {
    const { m } = client({ serverUrl: 'http://127.0.0.1:9' });
    const r = await m.listings();
    expect(r.remoteError).toMatch(/Could not reach/);
    expect(r.items.length).toBe(16);
    expect((await m.status()).error).toMatch(/Could not reach/);
  });

  it('runs the full flow: publish, moderate, trial with disclosure, expiry, purchase refusal, verified review', async () => {
    const creator = client({ serverUrl: url });
    const mod = client({ serverUrl: url });
    const learner = client({ serverUrl: url, secure: false });

    expect((await creator.m.status()).info).toMatchObject({ paymentsEnabled: false, trialDays: 7, demoContent: true });
    await creator.m.register({ email: 'maker@example.com', password: 'correct horse battery', displayName: 'Maker' });
    await mod.m.register({ email: 'mod@example.com', password: 'correct horse battery', displayName: 'Mod' });
    await learner.m.register({ email: 'learner@example.com', password: 'correct horse battery', displayName: 'Learner' });
    expect((await learner.m.status()).tokenStorage).toBe('session');
    expect((await creator.m.status()).account).toMatchObject({ email: 'maker@example.com', role: 'user' });

    // Demo listings are visible and labelled.
    const demo = (await learner.m.listings({ origin: 'remote' })).items;
    expect(demo.length).toBe(3);
    expect(demo.every((l) => l.demo)).toBe(true);

    // Publish a paid listing with a trial; it waits for review.
    const draft = creator.m.createDraft({
      title: 'Thesis outline coach',
      summary: 'Builds a chapter-by-chapter thesis outline and asks the right questions.',
      preview: 'Get a structured outline for your thesis.',
      body: 'Help me outline a thesis on {{topic}}. Ask me questions about my research question first, then propose chapters with their purpose.',
      category: 'research',
      pricing: { type: 'paid', priceCents: 300, currency: 'USD' },
      trialEligible: true,
    });
    const published = await creator.m.publish(draft.id);
    expect(published).toMatchObject({ remoteStatus: 'pending_review', remoteId: expect.any(String) });
    expect((await learner.m.listings({ search: 'thesis' })).items).toEqual([]);
    await expect(creator.m.moderationQueue()).rejects.toThrow(/moderator/);
    const queue = await mod.m.moderationQueue();
    expect(queue.pending.map((l) => l.title)).toContain('Thesis outline coach');
    await mod.m.moderate(published.remoteId!, 'approve', '');
    expect((await creator.m.syncMyListings()).find((l) => l.id === draft.id)?.remoteStatus).toBe('published');

    // Learner: paid listing hidden body, trial requires acknowledgement, server enforces expiry.
    const key = `remote:${published.remoteId}`;
    let d = await learner.m.listing(key);
    expect(d).toMatchObject({ body: null, access: { access: 'none', trialAvailable: true, authority: 'server' }, pricing: { type: 'paid', priceCents: 300 } });
    await expect(learner.m.promptText(key, 'insert')).rejects.toThrow(/active trial or purchase/);
    await expect(learner.m.startTrial(key, false)).rejects.toThrow(/accept the trial terms/);
    d = await learner.m.startTrial(key, true);
    expect(d.access).toMatchObject({ access: 'trial_active', expiresAt: '2026-10-08T09:00:00.000Z' });
    expect(learner.m.trials()).toEqual([expect.objectContaining({ listingKey: key, expiresAt: '2026-10-08T09:00:00.000Z' })]);
    expect(await learner.m.promptText(key, 'insert')).toContain('thesis');
    await expect(learner.m.saveToLibrary(key)).rejects.toThrow(/only after purchase/);
    await expect(learner.m.purchase(key)).rejects.toThrow(/Payments are not set up/);

    // Review: allowed now that the learner used it during the trial.
    await learner.m.addReview(key, { rating: 5, text: 'Very structured' });
    d = await learner.m.listing(key);
    expect(d.reviews).toEqual([expect.objectContaining({ authorName: 'Learner', verified: true, rating: 5 })]);
    expect(d.rating).toEqual({ average: 5, count: 1 });

    clock.set('2026-10-08T09:00:01.000Z');
    d = await learner.m.listing(key);
    expect(d.body).toBeNull();
    expect(d.access.access).toBe('trial_expired');
    await expect(learner.m.promptText(key, 'copy')).rejects.toThrow(/active trial or purchase/);
    clock.set('2026-10-01T09:00:00.000Z');

    // Creator analytics come from the server and say what they count.
    const a = await creator.m.analytics(draft.id);
    expect(a.server).toMatchObject({ trialStarts: 1, reviews: 1, averageRating: 5 });

    // Reports go to the server's moderators.
    expect(await learner.m.report(key, { reason: 'copyright', details: 'Seen elsewhere' })).toEqual({ sentTo: 'server' });
    expect((await mod.m.moderationQueue()).reports).toEqual([expect.objectContaining({ listingTitle: 'Thesis outline coach', reason: 'copyright' })]);

    // Free server listing: using it while signed in records access so it can be reviewed.
    const free = demo.find((l) => l.pricing.type === 'free')!;
    const saved = await learner.m.saveToLibrary(free.key);
    expect(saved.listingId).toBe(free.key);
    expect((await learner.m.listing(free.key)).canReview).toBe(true);

    await learner.m.logout();
    expect((await learner.m.status()).account).toBeNull();
    expect(learner.m.trials()).toEqual([]);
  });
});
