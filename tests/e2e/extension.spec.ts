// Loads the real browser extension into Chromium and drives it against a live FlowCompanion bridge.
import { chromium, expect, test } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { BrowserBridge } from '../../src/core/bridge';
import { Db } from '../../src/core/db/database';
import { migrate } from '../../src/core/db/migrations';
import { KvStore } from '../../src/core/kv';
import { systemClock } from '../../src/core/util';
import type { CaptureResult } from '../../src/shared/types';

const EXT_DIR = path.resolve(__dirname, '..', '..', 'extension');
const CHROMIUM = process.env.PW_CHROMIUM ?? (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

test('browser extension pairs with the bridge and saves pages and selections; web pages are refused', async () => {
  const db = new Db(':memory:');
  migrate(db);
  const captured: { text: string; kind: string; url?: string | null }[] = [];
  const asked: string[] = [];
  const bridge = new BrowserBridge({
    kv: new KvStore(db, systemClock),
    clock: systemClock,
    version: '1.0.0-test',
    capture: (i) => (captured.push(i), { kind: i.kind, id: String(captured.length), title: i.text.split('\n')[0]! } as CaptureResult),
    openAi: (p) => asked.push(p),
    blocked: () => null,
  });
  await bridge.start(0);
  const port = bridge.status(true).port;

  // An ordinary web page on this computer, used to show that pages cannot call the bridge.
  const site = http.createServer((_q, r) => (r.writeHead(200, { 'content-type': 'text/html' }), r.end('<title>Tides</title><p id="t">Tides are caused by the moon.</p>')));
  await new Promise<void>((r) => site.listen(0, '127.0.0.1', r));
  const sitePort = (site.address() as AddressInfo).port;

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-ext-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: CHROMIUM,
    headless: false,
    args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`, '--no-sandbox'],
  });
  try {
    const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;

    const popup = await ctx.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await expect(popup.getByRole('status')).toContainText('not reachable on port 47823');
    await popup.getByText('Connection').click();
    await popup.getByLabel('Port').fill(String(port));
    await popup.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(popup.getByRole('status')).toContainText('Pair this browser');

    await popup.getByLabel('Pairing code').fill('WRNG-CODE');
    await popup.getByRole('button', { name: 'Pair', exact: true }).click();
    await expect(popup.getByRole('status')).toContainText('No pairing code is active');
    const { code } = bridge.startPairing();
    await popup.getByLabel('Pairing code').fill(code.toLowerCase());
    await popup.getByRole('button', { name: 'Pair', exact: true }).click();
    await expect(popup.getByRole('status')).toContainText('Connected to FlowCompanion 1.0.0-test');
    expect(bridge.status(true).clients).toHaveLength(1);

    const tab = { url: `http://localhost:${sitePort}/tides`, title: 'Tides' };
    expect(await worker.evaluate((t) => (self as unknown as { handleMenu: (i: object, t: object) => Promise<unknown> }).handleMenu({ menuItemId: 'fc-save-page' }, t), tab)).toEqual({ ok: true });
    expect(await worker.evaluate((t) => (self as unknown as { handleMenu: (i: object, t: object) => Promise<unknown> }).handleMenu({ menuItemId: 'fc-save-selection', selectionText: 'Tides are caused by the moon.' }, t), tab)).toEqual({ ok: true });
    expect(await worker.evaluate((t) => (self as unknown as { handleMenu: (i: object, t: object) => Promise<unknown> }).handleMenu({ menuItemId: 'fc-ask-selection', selectionText: 'Why two tides a day?' }, t), tab)).toEqual({ ok: true });
    expect(await worker.evaluate(() => (self as unknown as { handleMenu: (i: object, t: object) => Promise<unknown> }).handleMenu({ menuItemId: 'fc-save-page' }, { url: 'chrome://settings', title: 'Settings' }))).toEqual({
      ok: false,
      error: 'Only web pages (http or https) can be saved.',
    });
    expect(captured).toEqual([
      { kind: 'reading', text: `Tides http://localhost:${sitePort}/tides`, url: `http://localhost:${sitePort}/tides` },
      { kind: 'note', text: `Tides\n\nTides are caused by the moon.\n\nSource: http://localhost:${sitePort}/tides`, url: `http://localhost:${sitePort}/tides` },
    ]);
    expect(asked).toEqual([`Why two tides a day?\n\n(From: Tides — http://localhost:${sitePort}/tides)`]);

    // A normal web page trying to reach the bridge is refused (no CORS grant, 403 on the server).
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${sitePort}/`);
    const fromPage = await page.evaluate(async (p) => {
      try {
        const r = await fetch(`http://127.0.0.1:${p}/v1/status`);
        return `status ${r.status}`;
      } catch (e) {
        return `blocked: ${(e as Error).name}`;
      }
    }, port);
    expect(fromPage).toMatch(/^(blocked|status 403)/);
    const viaPost = await page.evaluate(async (p) => {
      try {
        await fetch(`http://127.0.0.1:${p}/v1/capture`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{"kind":"note","text":"x"}' });
        return 'sent';
      } catch {
        return 'blocked';
      }
    }, port);
    expect(['sent', 'blocked']).toContain(viaPost);
    expect(captured).toHaveLength(2);
  } finally {
    await ctx.close();
    await bridge.stop();
    site.close();
    db.close();
  }
});
