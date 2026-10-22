#!/usr/bin/env node
// FlowCompanion reference marketplace server.
//
//   npm run server -- [--port 8787] [--host 127.0.0.1] [--db ./marketplace.db] [--seed-demo]
//
// Environment: FC_MARKET_ADMIN_EMAIL (account that becomes moderator on sign-up),
// FC_MARKET_REGISTRATION=closed (disable sign-ups). Run behind a TLS reverse proxy in production;
// the desktop app only accepts plain http for localhost addresses.
import path from 'node:path';
import { createMarketplaceServer } from './app';
import { seedDemo } from './seed';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const port = Number(arg('port', process.env.PORT ?? '8787'));
const host = arg('host', '127.0.0.1');
const dbPath = path.resolve(arg('db', process.env.FC_MARKET_DB ?? 'marketplace.db'));
const { server, db, close } = createMarketplaceServer({
  dbPath,
  adminEmail: process.env.FC_MARKET_ADMIN_EMAIL ?? null,
  registrationOpen: process.env.FC_MARKET_REGISTRATION !== 'closed',
  log: (l) => console.log(`${new Date().toISOString()} ${l}`),
});
if (process.argv.includes('--seed-demo')) console.log(`Seeded ${seedDemo(db, new Date().toISOString())} demo listings (labelled as demo data).`);
server.listen(port, host, () => console.log(`Marketplace server on http://${host}:${port} (database ${dbPath}). Payments: not configured.`));
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void close().then(() => process.exit(0)));
