import net from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractText } from '../../classroom-server/extract';
import { basicChecks, clamdScanner } from '../../classroom-server/scan';
import { readZip } from '../../classroom-server/zip';
import { ApiFailure, makeDocx, makePdf, makePptx, makeZip, startClassroom, type Client, type TestClassroom } from '../helpers/classroom';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const NOTES = makePdf(['Unit 3: Cells\nThe cell membrane controls what enters and leaves the cell.', 'Mitochondria release energy from glucose.\nPlant cells also have chloroplasts.']);

describe('reading uploaded files', () => {
  it('reads PDF text page by page', async () => {
    const r = await extractText(NOTES, 'notes.pdf');
    expect(r.status).toBe('ready');
    expect(r.pages).toHaveLength(2);
    expect(r.pages[0]).toContain('cell membrane controls');
    expect(r.pages[1]).toContain('chloroplasts');
    expect(r.detail).toBe('2 pages read.');
  });

  it('says so when a PDF has no text (a scan) instead of pretending it was read', async () => {
    const r = await extractText(makePdf(['', '']), 'scan.pdf');
    expect(r).toMatchObject({ status: 'unreadable', pages: [] });
    expect(r.detail).toMatch(/scanned PDF/);
  });

  it('reads Word pages and PowerPoint slides in presentation order', async () => {
    const d = await extractText(makeDocx([['Photosynthesis &amp; respiration', 'Plants make glucose.'], ['Page two starts here with more text.']]), 'unit.docx');
    expect(d.pages).toEqual(['Photosynthesis & respiration\n\nPlants make glucose.', 'Page two starts here with more text.']);
    const p = await extractText(makePptx([['Slide one title', 'First point'], ['Slide two title'], ['Slide three']]), 'deck.pptx');
    expect(p.pages).toEqual(['Slide one title\nFirst point', 'Slide two title', 'Slide three']);
    expect(p.detail).toBe('3 slides read.');
  });

  it('splits long text files into sections and reports images honestly', async () => {
    const t = await extractText(Buffer.from(Array.from({ length: 40 }, (_, i) => `Paragraph ${i} ${'word '.repeat(60)}`).join('\n\n')), 'notes.md');
    expect(t.status).toBe('ready');
    expect(t.pages.length).toBeGreaterThan(2);
    expect(await extractText(PNG, 'diagram.png')).toMatchObject({ status: 'unreadable', pages: [] });
  });
});

describe('upload checks', () => {
  it('refuses files that are not what they claim, macros, programs, scripts and the antivirus test file', () => {
    expect(basicChecks(NOTES, 'notes.pdf')).toEqual({ ok: true });
    expect(basicChecks(Buffer.from('MZ\x90\x00binary'), 'notes.pdf')).toMatchObject({ ok: false, reason: expect.stringMatching(/do not match/) });
    expect(basicChecks(NOTES, 'notes.exe')).toMatchObject({ ok: false, reason: expect.stringMatching(/not accepted/) });
    expect(basicChecks(makeDocx([['hi']], { 'word/vbaProject.bin': 'x' }), 'macro.docx')).toMatchObject({ ok: false, reason: expect.stringMatching(/macros/) });
    expect(basicChecks(makeDocx([['hi']], { 'word/embeddings/tool.exe': 'x' }), 'embedded.docx')).toMatchObject({ ok: false, reason: expect.stringMatching(/embedded program/) });
    expect(basicChecks(Buffer.from(`${NOTES.toString('latin1')}\n/JavaScript (app.alert(1))`, 'latin1'), 'script.pdf')).toMatchObject({ ok: false, reason: expect.stringMatching(/scripts/) });
    expect(basicChecks(Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'), 'eicar.txt')).toMatchObject({ ok: false, reason: expect.stringMatching(/antivirus test/) });
    expect(basicChecks(makeZip({ 'a.txt': 'x' }), 'fake.docx')).toMatchObject({ ok: false, reason: expect.stringMatching(/not a valid \.docx/) });
  });

  it('refuses password-protected and oversized archives', () => {
    const z = makeZip({ 'a.txt': 'hello' });
    z.writeUInt16LE(1, z.indexOf(Buffer.from([0x50, 0x4b, 1, 2])) + 8);
    expect(() => readZip(z)).toThrow(/password/);
    expect(() => readZip(Buffer.from('not a zip at all, just some text here'))).toThrow(/Not a ZIP/);
  });

  it('talks to a ClamAV daemon and fails closed when it cannot be reached', async () => {
    const seen: number[] = [];
    const server = net.createServer((sock) => {
      let got = Buffer.alloc(0);
      sock.on('data', (d) => {
        got = Buffer.concat([got, d]);
        if (got.subarray(-4).equals(Buffer.alloc(4))) {
          seen.push(got.length);
          sock.end(got.includes('VIRUS') ? 'stream: Test.Signature FOUND\0' : 'stream: OK\0');
        }
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as net.AddressInfo).port;
    const scanner = clamdScanner('127.0.0.1', port, 2000);
    expect(await scanner.scan(Buffer.from('plain notes'), 'a.txt')).toEqual({ ok: true });
    expect(await scanner.scan(Buffer.from('this has a VIRUS marker'), 'b.txt')).toMatchObject({ ok: false, reason: expect.stringMatching(/flagged/) });
    expect(seen).toHaveLength(2);
    await new Promise((r) => server.close(r));
    expect(await clamdScanner('127.0.0.1', port, 500).scan(Buffer.from('plain'), 'c.txt')).toMatchObject({ ok: false, reason: expect.stringMatching(/could not be reached/) });
  });
});

describe('the material library', () => {
  let k: TestClassroom;
  let teacher: Client;
  let classId: string;
  beforeEach(async () => {
    k = await startClassroom();
    teacher = await k.admin();
    classId = (await teacher.post('/classes', { name: 'Grade 9 Science' })).id;
  });
  afterEach(() => k.close());

  it('uploads a PDF and shows “Ready” with its page count; a scanned PDF shows that it could not be read', async () => {
    const m = await teacher.upload(`/classes/${classId}/materials?folder=Unit%203`, 'Unit 3 notes.pdf', NOTES);
    expect(m).toMatchObject({ name: 'Unit 3 notes.pdf', folder: 'Unit 3', status: 'ready', pages: 2, version: 1, mime: 'application/pdf', statusDetail: '2 pages read.' });
    expect(m.scan).toMatch(/Basic checks only/);
    expect((await teacher.get(`/materials/${m.id}/pages/2`)).text).toContain('chloroplasts');
    const scan = await teacher.upload(`/classes/${classId}/materials`, 'scan.pdf', makePdf(['']));
    expect(scan).toMatchObject({ status: 'unreadable', pages: 0 });
    expect(scan.statusDetail).toMatch(/could not be read/);
    expect(await teacher.get(`/classes/${classId}/materials`)).toHaveLength(2);
  });

  it('needs the teacher to confirm their right to share, and refuses unsafe or unsupported files without storing them', async () => {
    await expect(teacher.upload(`/classes/${classId}/materials`, 'notes.pdf', NOTES, {})).rejects.toMatchObject({ code: 'rights_required' });
    await expect(teacher.upload(`/classes/${classId}/materials`, 'macro.docx', makeDocx([['x']], { 'word/vbaProject.bin': 'x' }))).rejects.toMatchObject({ status: 422, code: 'file_rejected' });
    await expect(teacher.upload(`/classes/${classId}/materials`, 'tool.exe', Buffer.from('MZ'))).rejects.toBeInstanceOf(ApiFailure);
    expect(await teacher.get(`/classes/${classId}/materials`)).toEqual([]);
    expect(await k.srv.s.storage.list(classId)).toEqual([]);
    const audit = await teacher.get('/admin/audit?action=material.rejected');
    expect(audit[0].detail).toMatch(/macros/);
  });

  it('stores files encrypted, keeps versions when replaced, and serves downloads only as attachments through short-lived links', async () => {
    const m = await teacher.upload(`/classes/${classId}/materials`, 'notes.pdf', NOTES);
    const [key] = await k.srv.s.storage.list(classId);
    const fs = await import('node:fs');
    const onDisk = fs.readFileSync(`${k.dir}/files/${key}`);
    expect(onDisk.includes('cell membrane')).toBe(false);
    expect(onDisk.includes('%PDF')).toBe(false);
    const v2 = await teacher.upload(`/materials/${m.id}/content`, 'notes.pdf', makePdf(['Unit 3, revised: cells have a nucleus.']));
    expect(v2).toMatchObject({ id: m.id, version: 2, pages: 1 });
    expect((await teacher.get(`/materials/${m.id}/versions`)).map((v: { version: number; current: boolean }) => [v.version, v.current])).toEqual([[2, true], [1, false]]);
    const link = await teacher.get(`/materials/${m.id}/download-link`);
    const res = await fetch(`${k.base}${link.url}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename\*=UTF-8''notes\.pdf$/);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-security-policy')).toMatch(/sandbox/);
    expect(Buffer.from(await res.arrayBuffer()).toString('latin1')).toContain('revised');
    expect((await fetch(`${k.base}${link.url.replace(/sig=.{6}/, 'sig=AAAAAA')}`)).status).toBe(403);
    expect((await fetch(`${k.base}${link.url.replace(/exp=\d+/, 'exp=1000')}`)).status).toBe(403);
  });

  it('renames, moves and deletes materials, removing the stored files', async () => {
    const m = await teacher.upload(`/classes/${classId}/materials`, 'notes.pdf', NOTES);
    expect(await teacher.patch(`/materials/${m.id}`, { name: 'Cells', folder: 'Biology' })).toMatchObject({ name: 'Cells.pdf', folder: 'Biology' });
    const a = await teacher.post(`/classes/${classId}/assessments`, { title: 'Quiz', materialIds: [m.id] });
    await teacher.del(`/materials/${m.id}`);
    expect(await k.srv.s.storage.list(classId)).toEqual([]);
    expect((await teacher.get(`/assessments/${a.id}`)).materialIds).toEqual([]);
  });

  it('keeps materials away from students and from other classes', async () => {
    const m = await teacher.upload(`/classes/${classId}/materials`, 'notes.pdf', NOTES);
    const code = await teacher.post(`/classes/${classId}/join-code`, {});
    const ana = await k.student(code.code, 'Ana Lee');
    for (const [method, path] of [['GET', `/materials/${m.id}/pages/1`], ['GET', `/materials/${m.id}/download-link`], ['DELETE', `/materials/${m.id}`], ['PATCH', `/materials/${m.id}`]] as const) expect((await ana.fail(method, path)).status).toBe(403);
    const other = await k.teacher(teacher);
    expect((await other.fail('GET', `/materials/${m.id}/pages/1`)).status).toBe(404);
    const otherClass = await other.post('/classes', { name: 'Other' });
    expect((await other.fail('POST', `/classes/${otherClass.id}/assessments`, { title: 'Q', materialIds: [m.id] })).status).toBe(400);
  });
});
