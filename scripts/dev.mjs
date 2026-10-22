// Development loop: Vite dev server for the UI, esbuild watch for main/preload,
// and an Electron process that restarts when the main bundle changes.
import { spawn } from 'node:child_process';
import { context } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const electronBin = (await import('electron')).default;

const server = await createServer({ configFile: resolve(root, 'vite.config.ts') });
await server.listen();
const url = `http://localhost:${server.config.server.port}/`;
console.log(`UI dev server: ${url}`);

let child = null;
function restart() {
  if (child) {
    child.removeAllListeners('exit');
    child.kill();
  }
  const extra = process.getuid?.() === 0 ? ['--no-sandbox'] : [];
  child = spawn(electronBin, [root, ...extra], {
    stdio: 'inherit',
    env: { ...process.env, FC_DEV_SERVER_URL: url, FC_USER_DATA_DIR: process.env.FC_USER_DATA_DIR ?? resolve(root, '.flowcompanion-dev') },
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

const common = { bundle: true, platform: 'node', format: 'cjs', sourcemap: 'inline', external: ['electron'], logLevel: 'info' };
const restartPlugin = { name: 'restart', setup: (b) => b.onEnd((r) => r.errors.length === 0 && restart()) };
const preload = await context({ ...common, entryPoints: [resolve(root, 'src/preload/index.ts')], outfile: resolve(root, 'dist/preload/index.js'), target: 'chrome150' });
await preload.rebuild();
await preload.watch();
const main = await context({
  ...common,
  entryPoints: [resolve(root, 'src/main/index.ts')],
  outfile: resolve(root, 'dist/main/index.js'),
  target: 'node24',
  define: { 'process.env.FC_VERSION': JSON.stringify('dev') },
  plugins: [restartPlugin],
});
await main.watch();
