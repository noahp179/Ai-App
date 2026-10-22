// Renders resources/*.svg to PNG with Playwright's Chromium. Run after editing the SVGs.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const jobs = [
  ['icon.svg', 'icon.png', 1024],
  ['icon.svg', 'icon-256.png', 256],
  ['tray.svg', 'tray.png', 64],
];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? undefined });
const page = await browser.newPage();
for (const [src, out, size] of jobs) {
  const svg = readFileSync(resolve(root, 'resources', src), 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: resolve(root, 'resources', out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`wrote resources/${out}`);
}
await browser.close();
