#!/usr/bin/env node
// FlowCompanion classroom server.
//
//   npm run classroom -- [--port 8790] [--host 127.0.0.1] [--data ./classroom-data] [--web dist/classroom-web]
//
// Environment:
//   FC_CLASSROOM_KEY         32-byte base64 master key (otherwise a key file is created in the data folder)
//   FC_CLASSROOM_SETUP_CODE  required to create a school (otherwise only the first school can be created)
//   ANTHROPIC_API_KEY        server-wide AI key, used by schools that have not set their own
//   FC_CLAMD                 host:port of a ClamAV daemon for upload scanning (otherwise basic checks only)
//   FC_CLASSROOM_SECURE=1    mark cookies Secure (set this when served over https)
// Run it behind a TLS-terminating reverse proxy. See docs/CLASSROOM.md.
import fs from 'node:fs';
import path from 'node:path';
import { createClassroomServer } from './app';
import { basicScanner, clamdScanner } from './scan';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const port = Number(arg('port', process.env.PORT ?? '8790'));
const host = arg('host', '127.0.0.1');
const dataDir = path.resolve(arg('data', process.env.FC_CLASSROOM_DATA ?? 'classroom-data'));
const webDir = path.resolve(arg('web', path.join(__dirname, '..', 'classroom-web')));
const clamd = /^([^:]+):(\d+)$/.exec(process.env.FC_CLAMD ?? '');
const scanner = clamd ? clamdScanner(clamd[1]!, Number(clamd[2])) : basicScanner;
const curriculum = [path.join(process.cwd(), 'resources', 'curriculum', 'ontario.json.gz'), path.join(__dirname, '..', '..', 'resources', 'curriculum', 'ontario.json.gz')].find((p) => fs.existsSync(p)) ?? null;

const { server, close } = createClassroomServer({
  dbPath: path.join(dataDir, 'classroom.db'),
  dataDir,
  masterKey: process.env.FC_CLASSROOM_KEY ?? null,
  setupCode: process.env.FC_CLASSROOM_SETUP_CODE ?? null,
  serverApiKey: process.env.ANTHROPIC_API_KEY ?? null,
  scanner,
  curriculumPath: curriculum,
  webDir: fs.existsSync(path.join(webDir, 'index.html')) ? webDir : null,
  secureCookies: process.env.FC_CLASSROOM_SECURE === '1',
  log: (l) => console.log(`${new Date().toISOString()} ${l}`),
});
server.listen(port, host, () => {
  console.log(`Classroom server on http://${host}:${port}`);
  console.log(`  data: ${dataDir}`);
  console.log(`  upload scanning: ${scanner.label}`);
  console.log(`  browser app: ${fs.existsSync(path.join(webDir, 'index.html')) ? webDir : 'not built (npm run build:classroom)'}`);
  console.log(`  AI: ${process.env.ANTHROPIC_API_KEY ? 'server key set' : 'no server key; each school sets its own in School settings'}`);
});
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void close().then(() => process.exit(0)));
