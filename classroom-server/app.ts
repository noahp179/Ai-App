import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { z } from 'zod';
import { Db } from '../src/core/db/database';
import { hashSecret, randomCode, verifySecret } from '../src/core/passwords';
import { CLASSROOM_API, CLASSROOM_VERSION, CreateSchoolBody, RegisterTeacherBody, SignInBody, type ServerInfo, type SessionDto } from '../src/shared/classroom/protocol';
import { anthropicProvider } from './ai/anthropic';
import type { AiProvider } from './ai/provider';
import { HANDLED, HttpError, NO_ACCOMMODATION, forbidden, json, newToken, notFound, parseSettings, tokenHash, uuid, type ClassRow, type ClassroomOptions, type Ctx, type Handler, type RouteOptions, type S, type UserRow } from './core';
import { decryptText, loadMasterKey } from './crypto';
import { registerAdmin } from './routes/admin';
import { registerAssessments } from './routes/assessments';
import { registerAttempts } from './routes/attempts';
import { registerClasses } from './routes/classes';
import { registerGrading } from './routes/grading';
import { registerMaterials } from './routes/materials';
import { basicScanner } from './scan';
import { migrateClassroom } from './schema';
import { LocalEncryptedStorage } from './storage';

const SESSION_DAYS = 14;
const MAX_JSON = 2 * 1024 * 1024;
const COOKIE = 'fc_cls';

const STATIC_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};
/** The browser build runs only its own scripts and talks only to this server. */
const WEB_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

export interface ClassroomServer {
  server: http.Server;
  db: Db;
  s: S;
  /** Runs the periodic jobs once (finished batches, expired attempts, retention). */
  sweep(): Promise<void>;
  close(): Promise<void>;
}

/**
 * The FlowCompanion classroom service: accounts, classes, materials, assessments, attempts, grading and the AI that
 * goes with them. Plain node:http + SQLite, like the reference marketplace server, but a separate service with its
 * own database: student records need their own access rules, retention and deployment. Run it behind TLS.
 */
export function createClassroomServer(opts: ClassroomOptions): ClassroomServer {
  fs.mkdirSync(opts.dataDir, { recursive: true });
  const db = new Db(opts.dbPath);
  migrateClassroom(db);
  const clock = opts.clock ?? { now: () => new Date() };
  const now = () => clock.now().toISOString();
  const key = loadMasterKey(opts.dataDir, opts.masterKey);
  const storage = opts.storage ?? new LocalEncryptedStorage(path.join(opts.dataDir, 'files'), key);
  const scanner = opts.scanner ?? basicScanner;
  const limit = opts.rateLimit ?? 600;

  const buckets = new Map<string, { count: number; reset: number }>();
  const rate = (k: string, max: number) => {
    const t = Date.now();
    const b = buckets.get(k);
    if (!b || b.reset < t) {
      buckets.set(k, { count: 1, reset: t + 60_000 });
      if (buckets.size > 20_000) for (const [kk, v] of buckets) if (v.reset < t) buckets.delete(kk);
      return;
    }
    if (++b.count > max) throw new HttpError(429, 'rate_limited', 'Too many requests. Wait a minute and try again.');
  };
  /** Wrong passwords per sign-in name, so one address shared by a whole school is not locked out by one person. */
  const failures = new Map<string, { count: number; until: number }>();
  const checkLock = (login: string) => {
    const f = failures.get(login.toLowerCase());
    if (f && f.count >= 5 && f.until > Date.now()) throw new HttpError(429, 'locked', 'Too many wrong passwords. Wait 5 minutes and try again.');
  };
  const fail = (login: string) => {
    const k = login.toLowerCase();
    const f = failures.get(k);
    failures.set(k, { count: f && f.until > Date.now() ? f.count + 1 : 1, until: Date.now() + 5 * 60_000 });
  };

  const routes: { method: string; pattern: RegExp; handler: Handler; o: RouteOptions }[] = [];
  const providers = new Map<string, { key: string; provider: AiProvider }>();

  const s: S = {
    db,
    clock,
    opts,
    key,
    storage,
    scanner,
    now,
    sweeps: [],
    onSubmitted: [],
    idle: async () => {},
    newId: uuid,
    code: (groups = 2) => randomCode(groups),
    route(method, p, handler, o = {}) {
      routes.push({ method, pattern: new RegExp(`^${CLASSROOM_API}${p.replace(/:[a-zA-Z]+/g, '([A-Za-z0-9_.:~-]{1,160})')}$`), handler, o });
    },
    parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
      const r = schema.safeParse(body ?? {});
      if (!r.success) throw new HttpError(400, 'invalid_request', r.error.issues.map((i) => `${i.path.join('.') || 'request'}: ${i.message}`).join('; '));
      return r.data;
    },
    requireUser(c) {
      if (!c.user) throw new HttpError(401, 'unauthorized', 'Sign in first.');
      return c.user;
    },
    requireRole(c, ...roles) {
      const u = s.requireUser(c);
      if (!roles.includes(u.role)) throw forbidden();
      return u;
    },
    userDto(u) {
      const school = db.get<{ name: string }>('SELECT name FROM schools WHERE id = ?', [u.school_id]);
      return { id: u.id, schoolId: u.school_id, schoolName: school?.name ?? '', role: u.role, displayName: u.display_name, login: u.login };
    },
    issueSession(userId) {
      const token = newToken();
      db.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [tokenHash(token), userId, now(), new Date(clock.now().getTime() + SESSION_DAYS * 86_400_000).toISOString()]);
      return token;
    },
    settings: (schoolId) => parseSettings(db.get<{ settings: string }>('SELECT settings FROM schools WHERE id = ?', [schoolId])?.settings),
    aiKeySource(schoolId) {
      if (opts.ai) return 'server';
      if (db.get<{ k: string | null }>('SELECT ai_key_enc AS k FROM schools WHERE id = ?', [schoolId])?.k) return 'school';
      return opts.serverApiKey ? 'server' : 'none';
    },
    ai(schoolId) {
      if (opts.ai !== undefined) return opts.ai;
      const enc = db.get<{ k: string | null }>('SELECT ai_key_enc AS k FROM schools WHERE id = ?', [schoolId])?.k;
      let apiKey: string | null = null;
      try {
        apiKey = enc ? decryptText(key, enc) : (opts.serverApiKey ?? null);
      } catch {
        apiKey = null;
      }
      if (!apiKey) return null;
      const cached = providers.get(schoolId);
      if (cached?.key === apiKey) return cached.provider;
      const provider = anthropicProvider({ apiKey, baseURL: opts.aiBaseUrl });
      providers.set(schoolId, { key: apiKey, provider });
      return provider;
    },
    audit(actor, schoolId, action, target, detail = '') {
      db.run('INSERT INTO audit_log (id, school_id, at, actor_id, actor, action, target, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [uuid(), schoolId, now(), actor?.id ?? null, actor ? `${actor.display_name} (${actor.role})` : 'system', action, target, detail.slice(0, 500)]);
    },
    recordUsage({ schoolId, classId, assessmentId, kind, model, usage, discount = 1 }) {
      const p = s.settings(schoolId).prices;
      const cost = ((usage.inputTokens * p.input + usage.outputTokens * p.output + usage.cacheRead * p.cacheRead + usage.cacheWrite * p.cacheWrite) / 1_000_000) * discount;
      db.run('INSERT INTO ai_usage (id, school_id, class_id, assessment_id, kind, model, input_tokens, output_tokens, cache_read, cache_write, cost, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        uuid(),
        schoolId,
        classId,
        assessmentId,
        kind,
        model,
        usage.inputTokens,
        usage.outputTokens,
        usage.cacheRead,
        usage.cacheWrite,
        cost,
        now(),
      ]);
    },
    budget(schoolId) {
      const month = now().slice(0, 7);
      const u = db.get<{ cost: number | null; i: number | null; o: number | null; n: number }>(
        'SELECT SUM(cost) AS cost, SUM(input_tokens + cache_read + cache_write) AS i, SUM(output_tokens) AS o, COUNT(*) AS n FROM ai_usage WHERE school_id = ? AND at >= ?',
        [schoolId, `${month}-01`],
      )!;
      const budget = s.settings(schoolId).monthlyBudget;
      const cost = u.cost ?? 0;
      const state = budget === null ? 'ok' : cost >= budget ? 'paused' : cost >= budget * 0.8 ? 'warning' : 'ok';
      return { month, cost: Math.round(cost * 10000) / 10000, budget, state, inputTokens: u.i ?? 0, outputTokens: u.o ?? 0, requests: u.n };
    },
    classFor(c, classId, need = 'member') {
      const user = s.requireUser(c);
      const cls = db.get<ClassRow>('SELECT * FROM classes WHERE id = ?', [classId]);
      const m = cls ? db.get<{ role: 'teacher' | 'co_teacher' | 'student'; status: string }>('SELECT role, status FROM class_members WHERE class_id = ? AND user_id = ?', [classId, user.id]) : undefined;
      if (!cls || !m || m.status !== 'active' || cls.school_id !== user.school_id) throw notFound('That class');
      if (need === 'teacher' && m.role === 'student') throw forbidden('Only the class’s teachers can do this.');
      if (need === 'student' && m.role !== 'student') throw forbidden('Only students in the class can do this.');
      return { cls, role: m.role, user };
    },
    accommodation(classId, userId) {
      const r = db.get<{ data: string }>('SELECT data FROM accommodations WHERE class_id = ? AND user_id = ?', [classId, userId]);
      return { ...NO_ACCOMMODATION, ...json(r?.data, {}) };
    },
  };

  // ─────────── Accounts ───────────

  const session = (c: Ctx, user: UserRow): SessionDto => {
    const token = s.issueSession(user.id);
    if (c.req.headers['x-fc-client'] === 'web') {
      // Browsers get an HttpOnly cookie; page scripts never see the token.
      c.res.setHeader('set-cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}${opts.secureCookies ? '; Secure' : ''}`);
      return { token: '', user: s.userDto(user) };
    }
    return { token, user: s.userDto(user) };
  };
  const loginTaken = (login: string) => !!db.get('SELECT 1 FROM users WHERE login = ?', [login]);
  const createUser = (schoolId: string, role: UserRow['role'], displayName: string, login: string, password: string): UserRow => {
    if (loginTaken(login)) throw new HttpError(409, 'login_taken', 'That email or username is already in use. Sign in instead, or choose another.');
    const id = uuid();
    db.run('INSERT INTO users (id, school_id, role, display_name, login, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, schoolId, role, displayName, login, hashSecret(password), now()]);
    return db.get<UserRow>('SELECT * FROM users WHERE id = ?', [id])!;
  };

  s.route('GET', '/info', (): ServerInfo => {
    const schools = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM schools')!.n;
    return {
      name: opts.name ?? 'FlowCompanion classroom',
      version: CLASSROOM_VERSION,
      openSetup: !opts.setupCode && schools === 0,
      schools,
      capabilities: { ai: opts.ai !== undefined ? !!opts.ai : !!opts.serverApiKey || !!db.get('SELECT 1 FROM schools WHERE ai_key_enc IS NOT NULL'), antivirus: scanner.level, storage: storage.name, sso: false },
    };
  });

  s.route(
    'POST',
    '/schools',
    (c) => {
      const b = s.parse(CreateSchoolBody, c.body);
      const schools = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM schools')!.n;
      if (opts.setupCode ? b.setupCode !== opts.setupCode : schools > 0) throw forbidden(opts.setupCode ? 'The setup code is not right.' : 'This server already has a school. Ask its administrator for a teacher invite.');
      const user = db.tx(() => {
        const schoolId = uuid();
        db.run('INSERT INTO schools (id, name, settings, created_at) VALUES (?, ?, ?, ?)', [schoolId, b.schoolName, '{}', now()]);
        return createUser(schoolId, 'admin', b.displayName, b.login, b.password);
      });
      s.audit(user, user.school_id, 'school.created', b.schoolName);
      return session(c, user);
    },
    { auth: true },
  );

  s.route(
    'POST',
    '/teachers',
    (c) => {
      const b = s.parse(RegisterTeacherBody, c.body);
      const school = db.get<{ id: string }>('SELECT id FROM schools WHERE invite_code = ? AND invite_expires > ?', [b.inviteCode.toUpperCase(), now()]);
      if (!school) throw new HttpError(404, 'invite_invalid', 'That invite code is not valid or has expired. Ask your school’s administrator for a new one.');
      const user = createUser(school.id, 'teacher', b.displayName, b.login, b.password);
      s.audit(user, school.id, 'teacher.registered', user.login);
      return session(c, user);
    },
    { auth: true },
  );

  s.route(
    'POST',
    '/sessions',
    (c) => {
      const b = s.parse(SignInBody, c.body);
      checkLock(b.login);
      const user = db.get<UserRow>('SELECT * FROM users WHERE login = ?', [b.login]);
      if (!user || !verifySecret(b.password, user.password_hash)) {
        fail(b.login);
        throw new HttpError(401, 'bad_credentials', 'The email or username and password do not match.');
      }
      return session(c, user);
    },
    { auth: true },
  );

  s.route('DELETE', '/sessions', (c) => {
    const t = tokenOf(c.req);
    if (t) db.run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash(t.token)]);
    c.res.setHeader('set-cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    return { ok: true };
  });

  s.route('GET', '/me', (c) => s.userDto(s.requireUser(c)));

  registerClasses(s, { createUser, session, checkLock, fail });
  registerMaterials(s);
  registerAssessments(s);
  registerAttempts(s);
  registerGrading(s);
  registerAdmin(s);

  // ─────────── HTTP plumbing ───────────

  function tokenOf(req: http.IncomingMessage): { token: string; cookie: boolean } | null {
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) return { token: h.slice(7), cookie: false };
    const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]+)`).exec(req.headers.cookie ?? '');
    return m ? { token: m[1]!, cookie: true } : null;
  }
  const authenticate = (req: http.IncomingMessage): { user: UserRow; cookie: boolean } | null => {
    const t = tokenOf(req);
    if (!t) return null;
    const r = db.get<UserRow>('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?', [tokenHash(t.token), now()]);
    return r ? { user: r, cookie: t.cookie } : null;
  };

  const readBody = (req: http.IncomingMessage, max: number): Promise<Buffer> =>
    new Promise((resolve, reject) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on('data', (d: Buffer) => {
        size += d.length;
        // Over the limit: keep draining so the client gets a clean 413, but stop keeping the data.
        if (size > max * 4 + 1024 * 1024) req.destroy();
        else if (size <= max) chunks.push(d);
      });
      req.on('end', () => (size > max ? reject(new HttpError(413, 'too_large', 'That is too large to send.')) : resolve(Buffer.concat(chunks))));
      req.on('error', reject);
    });

  const serveStatic = (url: URL, res: http.ServerResponse): boolean => {
    if (!opts.webDir) return false;
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    let file = path.join(opts.webDir, rel);
    if (!file.startsWith(path.resolve(opts.webDir) + path.sep) && file !== path.resolve(opts.webDir, 'index.html')) return false;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      if (path.extname(rel)) return false;
      file = path.join(opts.webDir, 'index.html');
      if (!fs.existsSync(file)) return false;
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      'content-type': STATIC_TYPES[ext] ?? 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
      'content-security-policy': WEB_CSP,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'x-frame-options': 'DENY',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), display-capture=()',
    });
    fs.createReadStream(file).pipe(res);
    return true;
  };

  const server = http.createServer(async (req, res) => {
    const send = (status: number, body: unknown) => {
      if (res.headersSent) return void res.end();
      res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
        'referrer-policy': 'no-referrer',
      });
      res.end(JSON.stringify(body));
    };
    const started = Date.now();
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const ip = req.socket.remoteAddress ?? 'unknown';
      if (!url.pathname.startsWith(`${CLASSROOM_API}/`)) {
        if (req.method === 'GET' && serveStatic(url, res)) return;
        throw new HttpError(404, 'not_found', 'Not found.');
      }
      const match = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
      if (!match) {
        const exists = routes.some((r) => r.pattern.test(url.pathname));
        throw new HttpError(exists ? 405 : 404, exists ? 'method_not_allowed' : 'not_found', exists ? 'Method not allowed.' : 'Not found.');
      }
      const auth = authenticate(req);
      // Limits are per person once signed in: a whole class often shares one address.
      rate(auth ? `u:${auth.user.id}` : `ip:${ip}`, auth ? limit : limit * 4);
      if (match.o.auth) rate(`auth:${ip}`, Math.max(60, Math.floor(limit / 2)));
      // Cookie sessions must show the request came from our own page (cross-site forms cannot set this header).
      if (auth?.cookie && req.method !== 'GET' && !req.headers['x-fc-client']) throw forbidden('This request did not come from the classroom page.');
      let body: unknown = undefined;
      let raw: Buffer | null = null;
      if (req.method !== 'GET' && req.method !== 'DELETE') {
        if (match.o.rawLimit) raw = await readBody(req, match.o.rawLimit);
        else {
          if (!/^application\/json\b/.test(req.headers['content-type'] ?? '')) throw new HttpError(415, 'unsupported_media_type', 'Send JSON.');
          const buf = await readBody(req, MAX_JSON);
          try {
            body = buf.length ? JSON.parse(buf.toString('utf8')) : {};
          } catch {
            throw new HttpError(400, 'invalid_json', 'The request is not valid JSON.');
          }
        }
      }
      const params = match.pattern.exec(url.pathname)!.slice(1).map((p) => decodeURIComponent(p));
      const result = await match.handler({ req, res, url, user: auth?.user ?? null, cookieAuth: !!auth?.cookie, body, raw, ip }, params);
      if (result !== HANDLED) send(200, result ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) send(err.status, { error: { code: err.code, message: err.message } });
      else {
        opts.log?.(`error ${req.method} ${(req.url ?? '').split('?')[0]}: ${(err as Error).stack ?? err}`);
        send(500, { error: { code: 'internal', message: 'Something went wrong on the server.' } });
      }
    } finally {
      opts.log?.(`${req.method} ${(req.url ?? '').split('?')[0]} ${res.statusCode} ${Date.now() - started}ms`);
    }
  });
  server.requestTimeout = 120_000;
  server.headersTimeout = 15_000;

  let sweeping = false;
  const sweep = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      db.run('DELETE FROM sessions WHERE expires_at < ?', [now()]);
      for (const job of s.sweeps) {
        try {
          await job();
        } catch (err) {
          opts.log?.(`sweep failed: ${(err as Error).stack ?? err}`);
        }
      }
    } finally {
      sweeping = false;
    }
  };
  const every = opts.sweepSeconds ?? 30;
  const timer = every > 0 ? setInterval(() => void sweep(), every * 1000) : null;
  timer?.unref();

  return {
    server,
    db,
    s,
    sweep,
    close: () =>
      new Promise<void>((resolve) => {
        if (timer) clearInterval(timer);
        server.close(() => {
          db.close();
          resolve();
        });
        server.closeAllConnections?.();
      }),
  };
}
