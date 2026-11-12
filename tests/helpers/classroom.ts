import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { createClassroomServer, type ClassroomServer } from '../../classroom-server/app';
import type { AiProvider, BatchEntry, ChatRequest, ChatResult, JudgeRequest, JudgeResult } from '../../classroom-server/ai/provider';
import type { ClassroomOptions } from '../../classroom-server/core';
import { CLASSROOM_API, type ChatStreamEvent, type SessionDto } from '../../src/shared/classroom/protocol';
import { FakeClock } from './db';

/**
 * A stand-in AI provider for tests. It records every request so tests can check what was sent, and returns what the
 * test scripted. It is never presented as a real model: tests of model behaviour live in tests/live.
 */
export class FakeAi implements AiProvider {
  readonly name = 'Fake AI (tests)';
  readonly batchDiscount = 0.5;
  chats: ChatRequest[] = [];
  judges: JudgeRequest[] = [];
  uploads: { name: string; mime: string; size: number }[] = [];
  deleted: string[] = [];
  /** What the next chat returns. */
  onChat: (req: ChatRequest) => Partial<ChatResult> | Promise<Partial<ChatResult>> = () => ({ text: 'A scripted reply.' });
  /** The JSON (as an object) the next judge call returns, or a thrower. */
  onJudge: (req: JudgeRequest) => unknown = () => ({});
  private batches = new Map<string, { items: { customId: string; request: JudgeRequest }[]; done: boolean }>();
  usage = { inputTokens: 1000, outputTokens: 200, cacheRead: 0, cacheWrite: 0 };

  async chat(req: ChatRequest): Promise<ChatResult> {
    this.chats.push(req);
    const r = await this.onChat(req);
    const text = r.text ?? '';
    for (const piece of text.match(/.{1,12}/gs) ?? []) req.onDelta(piece);
    return { text, payload: [{ type: 'text', text }], citations: [], usage: this.usage, model: 'fake-model', stop: 'end', notices: [], ...r };
  }

  private result(req: JudgeRequest): JudgeResult {
    const out = this.onJudge(req);
    if (out && typeof out === 'object' && 'stop' in (out as object)) return { text: null, usage: this.usage, model: 'fake-model', ...(out as { stop: JudgeResult['stop'] }) };
    return { text: typeof out === 'string' ? out : JSON.stringify(out), usage: this.usage, model: 'fake-model', stop: 'end' };
  }
  async judge(req: JudgeRequest): Promise<JudgeResult> {
    this.judges.push(req);
    return this.result(req);
  }
  async submitBatch(items: { customId: string; request: JudgeRequest }[]): Promise<string> {
    const id = `batch_${this.batches.size + 1}`;
    this.batches.set(id, { items, done: false });
    return id;
  }
  /** Marks submitted batches as finished, as the provider would some time later. */
  completeBatches(): void {
    for (const b of this.batches.values()) b.done = true;
  }
  async batch(id: string): Promise<{ done: boolean; results: BatchEntry[] }> {
    const b = this.batches.get(id);
    if (!b?.done) return { done: false, results: [] };
    // In reverse order on purpose: results must be matched by id, never by position.
    return { done: true, results: [...b.items].reverse().map((i) => ({ customId: i.customId, result: this.result(i.request), error: null })) };
  }
  async uploadFile(bytes: Buffer, name: string, mime: string): Promise<string> {
    this.uploads.push({ name, mime, size: bytes.length });
    return `file_${this.uploads.length}`;
  }
  async deleteFile(id: string): Promise<void> {
    this.deleted.push(id);
  }
}

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface Client {
  token: string;
  user: SessionDto['user'];
  get<T = any>(path: string): Promise<T>; // eslint-disable-line @typescript-eslint/no-explicit-any
  post<T = any>(path: string, body?: unknown): Promise<T>; // eslint-disable-line @typescript-eslint/no-explicit-any
  put<T = any>(path: string, body?: unknown): Promise<T>; // eslint-disable-line @typescript-eslint/no-explicit-any
  patch<T = any>(path: string, body?: unknown): Promise<T>; // eslint-disable-line @typescript-eslint/no-explicit-any
  del<T = any>(path: string): Promise<T>; // eslint-disable-line @typescript-eslint/no-explicit-any
  upload<T = any>(path: string, name: string, bytes: Buffer, headers?: Record<string, string>): Promise<T>; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Sends a chat message and collects the stream's events. */
  chat(attemptId: string, text: string, draftForItem?: string | null): Promise<ChatStreamEvent[]>;
  /** The status and error code of a request expected to fail. */
  fail(method: string, path: string, body?: unknown): Promise<{ status: number; code: string; message: string }>;
}

export interface TestClassroom {
  srv: ClassroomServer;
  base: string;
  dir: string;
  clock: FakeClock;
  ai: FakeAi;
  raw(method: string, path: string, init?: { token?: string; body?: unknown; headers?: Record<string, string> }): Promise<Response>;
  client(session: SessionDto): Client;
  /** Creates the school and its administrator (who can also teach). */
  admin(): Promise<Client>;
  teacher(admin: Client, name?: string): Promise<Client>;
  /** A student who joins a class with its code. */
  student(code: string, name: string): Promise<Client>;
  /** Signs in again as an existing user (for example after a session has expired). */
  signIn(login: string, password: string): Promise<Client>;
  close(): Promise<void>;
}

export async function startClassroom(opts: Partial<ClassroomOptions> & { noAi?: boolean } = {}): Promise<TestClassroom> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-classroom-'));
  const clock = new FakeClock(new Date('2026-11-12T14:00:00Z'));
  const ai = new FakeAi();
  const { noAi, ...rest } = opts;
  const srv = createClassroomServer({ dbPath: path.join(dir, 'classroom.db'), dataDir: dir, clock, ai: noAi ? null : ai, sweepSeconds: 0, rateLimit: 100_000, curriculumPath: path.join(__dirname, '..', 'fixtures', 'curriculum-sample.json.gz'), ...rest });
  await new Promise<void>((r) => srv.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(srv.server.address() as AddressInfo).port}`;

  const raw: TestClassroom['raw'] = (method, p, init = {}) =>
    fetch(`${base}${CLASSROOM_API}${p}`, {
      method,
      headers: { ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), ...init.headers },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  const call = async (method: string, p: string, token: string, body?: unknown) => {
    const res = await raw(method, p, { token, body: method === 'GET' || method === 'DELETE' ? undefined : (body ?? {}) });
    const data = (await res.json()) as { error?: { code: string; message: string } };
    if (!res.ok) throw new ApiFailure(res.status, data.error?.code ?? 'unknown', data.error?.message ?? res.statusText);
    return data;
  };
  const client = (session: SessionDto): Client => ({
    token: session.token,
    user: session.user,
    get: (p) => call('GET', p, session.token) as never,
    post: (p, b) => call('POST', p, session.token, b) as never,
    put: (p, b) => call('PUT', p, session.token, b) as never,
    patch: (p, b) => call('PATCH', p, session.token, b) as never,
    del: (p) => call('DELETE', p, session.token) as never,
    async upload(p, name, bytes, headers = { 'x-fc-rights': 'confirmed' }) {
      const res = await fetch(`${base}${CLASSROOM_API}${p}${p.includes('?') ? '&' : '?'}name=${encodeURIComponent(name)}`, { method: 'POST', headers: { authorization: `Bearer ${session.token}`, 'content-type': 'application/octet-stream', ...headers }, body: new Uint8Array(bytes) });
      const data = (await res.json()) as { error?: { code: string; message: string } };
      if (!res.ok) throw new ApiFailure(res.status, data.error?.code ?? 'unknown', data.error?.message ?? res.statusText);
      return data as never;
    },
    async chat(attemptId, text, draftForItem = null) {
      const res = await raw('POST', `/attempts/${attemptId}/chat`, { token: session.token, body: { text, draftForItem } });
      if (!res.ok) {
        const data = (await res.json()) as { error: { code: string; message: string } };
        throw new ApiFailure(res.status, data.error.code, data.error.message);
      }
      return (await res.text())
        .split('\n\n')
        .filter((l) => l.startsWith('data: '))
        .map((l) => JSON.parse(l.slice(6)) as ChatStreamEvent);
    },
    async fail(method, p, body) {
      const res = await raw(method, p, { token: session.token, body: method === 'GET' || method === 'DELETE' ? undefined : (body ?? {}) });
      const data = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string } };
      return { status: res.status, code: data.error?.code ?? (res.ok ? 'ok' : 'unknown'), message: data.error?.message ?? '' };
    },
  });
  let n = 0;
  const post = async (p: string, body: unknown): Promise<SessionDto> => {
    const res = await raw('POST', p, { body });
    const data = (await res.json()) as SessionDto & { session?: SessionDto; error?: { code: string; message: string } };
    if (!res.ok) throw new ApiFailure(res.status, data.error?.code ?? 'unknown', data.error?.message ?? '');
    return data.session ?? data;
  };
  return {
    srv,
    base,
    dir,
    clock,
    ai,
    raw,
    client,
    admin: async () => client(await post('/schools', { schoolName: 'Maple Ridge Secondary', displayName: 'Ms. Admin', login: 'admin@school.test', password: 'correct-horse-9' })),
    async teacher(admin, name = 'Mr. Okafor') {
      const school = await admin.post('/admin/teacher-invite');
      return client(await post('/teachers', { inviteCode: school.teacherInvite.code, displayName: name, login: `teacher${++n}@school.test`, password: 'correct-horse-9' }));
    },
    student: async (code, name) => client(await post('/join', { code, displayName: name, login: `${name.toLowerCase().replace(/\W+/g, '.')}@school.test`, password: 'student-pass-1' })),
    signIn: async (login, password) => client(await post('/sessions', { login, password })),
    async close() {
      await srv.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// ─────────── Fixture files ───────────

/** A small, valid PDF with one page of text per entry (an empty entry makes a page with no text, like a scan). */
export function makePdf(pages: string[]): Buffer {
  const objs: string[] = [];
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  const kids: number[] = [];
  pages.forEach((text, i) => {
    const page = 4 + i * 2;
    const lines = text ? text.split('\n') : [];
    const stream = lines.length ? `BT /F1 12 Tf 72 720 Td 14 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET` : '';
    objs[page] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${page + 1} 0 R >>`;
    objs[page + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    kids.push(page);
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** A ZIP archive (deflate), enough to build .docx and .pptx fixtures. */
export function makeZip(files: Record<string, string | Buffer>): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const comp = deflateRawSync(data);
    const nameBuf = Buffer.from(name, 'utf8');
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(crc32(data), 14);
    head.writeUInt32LE(comp.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(nameBuf.length, 26);
    locals.push(head, nameBuf, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc32(data), 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

export function makeDocx(pages: string[][], extra: Record<string, string | Buffer> = {}): Buffer {
  const body = pages.map((paras, i) => paras.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join('') + (i < pages.length - 1 ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '')).join('');
  return makeZip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`, ...extra });
}

export function makePptx(slides: string[][]): Buffer {
  const files: Record<string, string> = {
    '[Content_Types].xml': '<Types/>',
    'ppt/presentation.xml': `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('')}</p:sldIdLst></p:presentation>`,
    // Deliberately listed out of order: slide order comes from the presentation, not from file names.
    'ppt/_rels/presentation.xml.rels': `<Relationships>${slides.map((_, i) => `<Relationship Id="rId${i + 1}" Type="slide" Target="slides/slide${slides.length - i}.xml"/>`).join('')}</Relationships>`,
  };
  slides.forEach((lines, i) => (files[`ppt/slides/slide${slides.length - i}.xml`] = `<p:sld xmlns:a="a" xmlns:p="p">${lines.map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`).join('')}</p:sld>`));
  return makeZip(files);
}

export const NOTES_PDF = () => makePdf(['Unit 3: Cells\nThe cell membrane controls what enters and leaves the cell.', 'Mitochondria release energy from glucose.\nPlant cells also have chloroplasts.']);

export const QUESTIONS = [
  { points: 1, question: { type: 'multiple_choice', prompt: 'Which part controls what enters and leaves the cell?', choices: ['Nucleus', 'Cell membrane', 'Ribosome', 'Vacuole'], answer: 1 } },
  { points: 2, question: { type: 'numeric', prompt: 'A cell divides every 20 minutes. How many cells are there after 1 hour, starting from 1?', answer: '8' } },
  { points: 4, long: true, question: { type: 'written', prompt: 'Explain how mitochondria and chloroplasts are different.', sampleAnswer: 'Mitochondria release energy from glucose; chloroplasts make glucose using light. Only plant cells have chloroplasts.' } },
];

/** A class with a teacher, two students, one material and a published three-question assessment. */
export async function seedClass(k: TestClassroom, settings: Record<string, unknown> = {}) {
  const teacher = await k.admin();
  const cls = await teacher.post('/classes', { name: 'Grade 9 Science', courseId: 'on-snc1w', courseLabel: 'Science, Grade 9, De-streamed (SNC1W)' });
  const code = (await teacher.post(`/classes/${cls.id}/join-code`, {})).code as string;
  const ana = await k.student(code, 'Ana Lee');
  const ben = await k.student(code, 'Ben Roy');
  const material = await teacher.upload(`/classes/${cls.id}/materials`, 'Unit 3 notes.pdf', NOTES_PDF());
  const assessment = await teacher.post(`/classes/${cls.id}/assessments`, { title: 'Cells quiz', instructions: 'Answer in your own words.', materialIds: [material.id], settings });
  const items: { id: string }[] = [];
  for (const q of QUESTIONS) items.push(await teacher.post(`/assessments/${assessment.id}/items`, q));
  await teacher.post(`/assessments/${assessment.id}/publish`, {});
  return { teacher, cls, code, ana, ben, material, assessment, items };
}
