// Runs scripts/curriculum-cli.ts (TypeScript) by bundling it with esbuild first.
// Usage: node scripts/curriculum.mjs <fetch|verify|summary> [--no-cache]
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = resolve(root, '.cache', 'curriculum-cli.mjs');
mkdirSync(dirname(outfile), { recursive: true });
await build({ entryPoints: [resolve(root, 'scripts/curriculum-cli.ts')], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', logLevel: 'warning' });
const r = spawnSync(process.execPath, [outfile, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
process.exit(r.status ?? 1);
