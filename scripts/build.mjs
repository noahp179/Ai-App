// Builds FlowCompanion: main + preload + reference server with esbuild, the UI with Vite.
// Usage: node scripts/build.mjs [--only=main,preload,renderer,server] [--dev]
import { build as esbuild } from 'esbuild';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dev = args.includes('--dev');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : ['main', 'preload', 'renderer'];

const pkg = (await import(resolve(root, 'package.json'), { with: { type: 'json' } })).default;

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  sourcemap: dev ? 'inline' : false,
  minify: !dev,
  logLevel: 'warning',
  define: {
    'process.env.FC_VERSION': JSON.stringify(pkg.version),
  },
};

export const targets = {
  main: () =>
    esbuild({
      ...common,
      entryPoints: [resolve(root, 'src/main/index.ts')],
      outfile: resolve(root, 'dist/main/index.js'),
      target: 'node24',
      external: ['electron'],
    }),
  preload: () =>
    esbuild({
      ...common,
      entryPoints: [resolve(root, 'src/preload/index.ts')],
      outfile: resolve(root, 'dist/preload/index.js'),
      target: 'chrome150',
      external: ['electron'],
    }),
  server: () =>
    esbuild({
      ...common,
      entryPoints: [resolve(root, 'server/main.ts')],
      outfile: resolve(root, 'dist/server/main.js'),
      target: 'node22',
      minify: false,
    }),
  renderer: async () => {
    const { build } = await import('vite');
    await build({ configFile: resolve(root, 'vite.config.ts'), mode: dev ? 'development' : 'production', logLevel: 'warn' });
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!onlyArg) rmSync(resolve(root, 'dist'), { recursive: true, force: true });
  const started = Date.now();
  for (const name of only) {
    if (!targets[name]) throw new Error(`Unknown build target: ${name}`);
    const t = Date.now();
    await targets[name]();
    console.log(`built ${name} in ${Date.now() - t} ms`);
  }
  console.log(`build finished in ${Date.now() - started} ms`);
}
