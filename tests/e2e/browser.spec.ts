import { expect, test } from '@playwright/test';
import http from 'node:http';
import net from 'node:net';
import { close, launch, nav } from './launch';

const EXT = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(p));
    });
  });
}

function post(port: number, path: string, body: unknown, token?: string) {
  return new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
    const data = JSON.stringify(body);
    const r = http.request(
      { host: '127.0.0.1', port, path, method: 'POST', headers: { origin: EXT, 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...(token ? { authorization: `Bearer ${token}` } : {}) } },
      (res) => {
        let s = '';
        res.on('data', (c) => (s += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, json: JSON.parse(s || '{}') }));
      },
    );
    r.on('error', reject);
    r.end(data);
  });
}

test('browser bridge: off by default, turns on from Settings, pairs, and saves a page to the reading queue', async () => {
  const port = await freePort();
  const l = await launch();
  try {
    const { page } = l;
    await expect(post(port, '/v1/status', {})).rejects.toThrow(/ECONNREFUSED/);
    await nav(page, 'Settings').click();
    await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: 'Browser', exact: true }).click();
    await page.getByLabel('Port').fill(String(port));
    await page.getByLabel('Port').press('Enter');
    await page.getByRole('switch', { name: /Browser bridge/ }).check();
    await expect(page.getByText(`Listening on 127.0.0.1:${port}`)).toBeVisible();
    await page.getByRole('button', { name: 'Pair a browser' }).click();
    const code = (await page.getByTestId('pairing-code').textContent())!;
    const paired = await post(port, '/v1/pair', { code, name: 'Test browser' });
    expect(paired.status).toBe(200);
    await expect(page.getByText(/Test browser · paired/)).toBeVisible();

    const saved = await post(port, '/v1/capture', { kind: 'reading', title: 'How tides work', url: 'https://example.org/tides' }, paired.json.token as string);
    expect(saved.status).toBe(200);
    await nav(page, 'Productivity').click();
    await page.getByRole('tab', { name: 'Reading queue' }).click();
    await expect(page.getByText('How tides work')).toBeVisible();
  } finally {
    await close(l);
  }
});
