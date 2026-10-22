import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface Launched {
  app: ElectronApplication;
  page: Page;
  dataDir: string;
  logs: string[];
}

export function freshDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fc-e2e-'));
}

/** Launches the built app (run `npm run build` first) with an isolated data directory. */
export async function launch(dataDir = freshDataDir(), env: Record<string, string> = {}): Promise<Launched> {
  const root = path.resolve(__dirname, '..', '..');
  const args = [root];
  if (process.getuid?.() === 0) args.push('--no-sandbox');
  const app = await electron.launch({
    args,
    env: { ...process.env, FC_USER_DATA_DIR: dataDir, ...env } as Record<string, string>,
    timeout: 60_000,
  });
  const logs: string[] = [];
  app.process().stdout?.on('data', (d) => logs.push(String(d)));
  app.process().stderr?.on('data', (d) => logs.push(String(d)));
  const page = await app.firstWindow();
  await page.waitForSelector('.shell', { timeout: 30_000 });
  return { app, page, dataDir, logs };
}

export async function close(l: Launched): Promise<void> {
  await l.app.evaluate(({ app }) => app.quit()).catch(() => {});
  await l.app.close().catch(() => {});
}
