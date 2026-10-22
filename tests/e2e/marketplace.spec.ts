import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createMarketplaceServer } from '../../server/app';
import { close, launch, nav } from './launch';

test('prompt library: variables, versions, restore, copy; starter marketplace prompts', async () => {
  const l = await launch();
  try {
    const { page, app } = l;
    await nav(page, 'Prompt Library').click();
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByLabel('Title').fill('Explain simply');
    await page.getByLabel('Prompt', { exact: true }).fill('Explain {{topic}} to a {{audience:child}}.');
    await expect(page.getByText('audience = child')).toBeVisible();
    await page.getByRole('button', { name: 'Create prompt' }).click();
    await expect(page.getByText('Version 1', { exact: true })).toBeVisible();

    await page.getByLabel('Prompt', { exact: true }).fill('Explain {{topic}} to a {{audience:child}} in three sentences.');
    await page.getByLabel('What changed (optional)').fill('shorter answers');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Version 2', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Version history' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg.getByText('shorter answers')).toBeVisible();
    await dlg.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Version 3', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue('Explain {{topic}} to a {{audience:child}}.');

    await page.getByLabel('topic').fill('rainbows');
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe('Explain rainbows to a child.');

    await nav(page, 'Marketplace').click();
    const card = page.getByRole('button', { name: /^Quiz me by FlowCompanion starter set, Free/ });
    await expect(card).toContainText('Bundled with FlowCompanion');
    await card.click();
    await expect(page.getByText('Ratings of bundled and imported prompts stay on this computer')).toBeVisible();
    await page.getByRole('button', { name: 'Save to Prompt Library' }).click();
    await expect(page.getByRole('heading', { name: 'Quiz me' })).toBeVisible();
    await expect(page.getByText('Saved from the marketplace.')).toBeVisible();
  } finally {
    await close(l);
  }
});

test('marketplace server: sign up, server-enforced trial with disclosure, no purchases, publish for review', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-market-'));
  const srv = createMarketplaceServer({ dbPath: path.join(dir, 'm.db'), adminEmail: 'mod@example.com' });
  await new Promise<void>((r) => srv.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(srv.server.address() as AddressInfo).port}`;
  const call = async (method: string, p: string, body?: unknown, token?: string) => {
    const res = await fetch(`${base}/api/v1${p}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return (await res.json()) as Record<string, unknown> & { token: string; id: string };
  };
  const mod = (await call('POST', '/accounts', { email: 'mod@example.com', password: 'correct horse battery', displayName: 'Mod' })).token;
  const maker = (await call('POST', '/accounts', { email: 'maker@example.com', password: 'correct horse battery', displayName: 'Maker' })).token;
  const listing = await call(
    'POST',
    '/me/listings',
    {
      title: 'Exam revision planner',
      summary: 'Builds a revision timetable from your exam dates and topics.',
      preview: 'A planner that spreads revision across the weeks before your exams.',
      body: 'My exams are: {{exams}}. Build a revision timetable that interleaves subjects and leaves rest days.',
      category: 'study',
      tags: ['exams'],
      providers: ['any'],
      pricing: { type: 'paid', priceCents: 349, currency: 'USD' },
      trialEligible: true,
      version: '1.0.0',
      changelog: '',
    },
    maker,
  );
  await call('POST', `/me/listings/${listing.id}/submit`, {}, maker);
  await call('POST', `/moderation/listings/${listing.id}`, { action: 'approve', note: '' }, mod);

  const l = await launch();
  try {
    const { page } = l;
    await nav(page, 'Settings').click();
    await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: 'Marketplace', exact: true }).click();
    await page.getByLabel('Marketplace server').fill(base);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Payments are not set up on this server')).toBeVisible();
    await page.getByRole('button', { name: 'Create account' }).first().click();
    await page.getByLabel('Display name').fill('Learner');
    await page.getByLabel('Email').fill('learner@example.com');
    await page.getByLabel('Password').fill('correct horse battery');
    await page.getByRole('button', { name: 'Create account' }).last().click();
    await expect(page.getByText('Signed in as')).toBeVisible();

    await nav(page, 'Marketplace').click();
    await page.getByLabel('Source').selectOption('remote');
    await page.getByRole('button', { name: /^Exam revision planner by Maker, \$3\.49/ }).click();
    await expect(page.getByText('A planner that spreads revision')).toBeVisible();
    await page.getByRole('button', { name: 'Start free trial' }).click();
    const dlg = page.getByRole('dialog', { name: /Start a 7-day free trial/ });
    await expect(dlg.getByText('you will not be charged')).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Start free trial' })).toBeDisabled();
    await dlg.getByLabel('I understand how this trial works.').check();
    await dlg.getByRole('button', { name: 'Start free trial' }).click();
    await expect(page.getByText(/Trial ends in 7 days|Trial ends in 6 days/)).toBeVisible();
    await expect(page.getByText('Build a revision timetable').first()).toBeVisible();
    await page.getByRole('button', { name: 'Buy' }).click();
    await expect(page.getByText(/Payments are not set up on this marketplace server/)).toBeVisible();

    await nav(page, 'Creator Studio').click();
    await page.getByRole('button', { name: 'New listing' }).click();
    await page.getByLabel('Title').fill('Lab report checker');
    await page.getByLabel('Summary').fill('Checks a lab report for structure and clarity.');
    await page.getByLabel('Prompt', { exact: true }).fill('Check this lab report for a clear aim, method, results and conclusion, and list gaps: {{report}}');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('#main-content').getByText('Saved', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Publish to marketplace server' }).click();
    await expect(page.getByText('Waiting for review')).toBeVisible();
  } finally {
    await close(l);
    await srv.close();
  }
});
