#!/usr/bin/env node
// Checks every learning-hub link: the page must load (HTTP 2xx after redirects) and contain the
// resource's `check` text. Results go to src/shared/learning/link-check.json, which the app shows
// as "Link checked on <date>". Exits 1 if any link fails, so it can gate releases.
//
//   npm run verify:links            # check and write results
//   npm run verify:links -- --dry   # check only
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(root, 'src/shared/learning/catalog.json');
const outPath = path.join(root, 'src/shared/learning/link-check.json');
const dry = process.argv.includes('--dry');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const CHALLENGE = /client challenge|just a moment\.\.\.|attention required|_incapsula_resource|captcha/i;

async function check(r) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(r.url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; FlowCompanion-LinkCheck/1.0; +https://github.com/noahp179/Ai-App)', accept: 'text/html,application/xhtml+xml' },
    });
    const body = (await res.text()).slice(0, 2_000_000);
    const finalUrl = res.url !== r.url ? res.url : null;
    if (!res.ok) return { status: res.status, ok: false, finalUrl, note: `HTTP ${res.status}` };
    if (CHALLENGE.test(body.slice(0, 20_000)) && !body.toLowerCase().includes(r.check.toLowerCase())) {
      return { status: res.status, ok: false, finalUrl, note: 'Site returned a bot check; verify by hand.' };
    }
    const text = body.replace(/&amp;/g, '&').replace(/&#x27;|&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ');
    if (!text.toLowerCase().includes(r.check.toLowerCase())) return { status: res.status, ok: false, finalUrl, note: `Page loaded but "${r.check}" was not found.` };
    return { status: res.status, ok: true, finalUrl, note: null };
  } catch (err) {
    return { status: null, ok: false, finalUrl: null, note: err.name === 'AbortError' ? 'Timed out' : String(err.cause?.code ?? err.message) };
  } finally {
    clearTimeout(timer);
  }
}

const queue = [...catalog.resources];
const results = {};
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      let res = await check(r);
      if (!res.ok && (res.status === null || res.status >= 500)) res = await check(r); // one retry for transient errors
      results[r.id] = res;
      process.stdout.write(`${res.ok ? 'ok  ' : 'FAIL'} ${String(res.status ?? '---').padEnd(4)} ${r.id}${res.note ? ` — ${res.note}` : ''}${res.finalUrl ? ` (→ ${res.finalUrl})` : ''}\n`);
    }
  }),
);

const failed = Object.entries(results).filter(([, v]) => !v.ok);
const ordered = Object.fromEntries(catalog.resources.map((r) => [r.id, results[r.id]]));
if (!dry) {
  fs.writeFileSync(outPath, `${JSON.stringify({ checkedOn: new Date().toISOString().slice(0, 10), results: ordered }, null, 2)}\n`);
  console.log(`\nWrote ${path.relative(root, outPath)}`);
}
console.log(`${catalog.resources.length - failed.length}/${catalog.resources.length} links verified.`);
process.exit(failed.length ? 1 : 0);
