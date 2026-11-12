import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startClassroom, type Client, type TestClassroom } from '../helpers/classroom';

let k: TestClassroom;
beforeEach(async () => {
  k = await startClassroom();
});
afterEach(() => k.close());

const newClass = (t: Client, extra: Record<string, unknown> = {}) => t.post('/classes', { name: 'Grade 9 Math', section: 'Period 2', schoolYear: '2026–27', courseId: 'on-mth1w', courseLabel: 'Mathematics, Grade 9, De-streamed (MTH1W)', ...extra });

describe('accounts and roles', () => {
  it('creates the first school freely, refuses a second one, and signs people in', async () => {
    expect((await (await k.raw('GET', '/info')).json()).openSetup).toBe(true);
    const admin = await k.admin();
    expect(admin.user).toMatchObject({ role: 'admin', schoolName: 'Maple Ridge Secondary' });
    const again = await k.raw('POST', '/schools', { body: { schoolName: 'Other', displayName: 'X', login: 'x@y.test', password: 'long-enough-1' } });
    expect(again.status).toBe(403);
    expect((await (await k.raw('GET', '/info')).json()).openSetup).toBe(false);
    const ok = await k.raw('POST', '/sessions', { body: { login: 'ADMIN@school.test', password: 'correct-horse-9' } });
    expect(ok.status).toBe(200);
    expect((await admin.get('/me')).login).toBe('admin@school.test');
    expect((await k.raw('GET', '/me')).status).toBe(401);
    expect((await k.raw('GET', '/me', { token: 'not-a-token' })).status).toBe(401);
  });

  it('locks a sign-in name after five wrong passwords without locking anyone else', async () => {
    const admin = await k.admin();
    for (let i = 0; i < 5; i++) expect((await k.raw('POST', '/sessions', { body: { login: 'admin@school.test', password: 'wrong-password' } })).status).toBe(401);
    const locked = await k.raw('POST', '/sessions', { body: { login: 'admin@school.test', password: 'correct-horse-9' } });
    expect(locked.status).toBe(429);
    const t = await k.teacher(admin);
    expect(t.user.role).toBe('teacher');
  });

  it('lets teachers register only with a valid invite from their school’s administrator', async () => {
    const admin = await k.admin();
    const bad = await k.raw('POST', '/teachers', { body: { inviteCode: 'AAAA-BBBB-CCCC', displayName: 'T', login: 't@x.test', password: 'long-enough-1' } });
    expect(bad.status).toBe(404);
    const t = await k.teacher(admin);
    expect((await t.fail('GET', '/admin/school')).status).toBe(403);
    expect((await t.fail('POST', '/admin/teacher-invite')).status).toBe(403);
  });

  it('uses an HttpOnly cookie for browsers and refuses cookie requests that did not come from the page', async () => {
    await k.admin();
    const res = await k.raw('POST', '/sessions', { body: { login: 'admin@school.test', password: 'correct-horse-9' }, headers: { 'x-fc-client': 'web' } });
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^fc_cls=[\w-]+; HttpOnly; SameSite=Strict/);
    expect((await res.json()).token).toBe('');
    const pair = cookie.split(';')[0]!;
    expect((await k.raw('GET', '/me', { headers: { cookie: pair } })).status).toBe(200);
    // A cross-site form post would carry the cookie but not our header.
    expect((await k.raw('POST', '/classes', { headers: { cookie: pair }, body: { name: 'X' } })).status).toBe(403);
    expect((await k.raw('POST', '/classes', { headers: { cookie: pair, 'x-fc-client': 'web' }, body: { name: 'X' } })).status).toBe(200);
  });
});

describe('classes and enrolment', () => {
  it('a teacher creates a class linked to MTH1W, gets a join code, two students join; an expired code is refused', async () => {
    const admin = await k.admin();
    const teacher = await k.teacher(admin);
    const cls = await newClass(teacher);
    expect(cls).toMatchObject({ courseId: 'on-mth1w', myRole: 'teacher', students: 0 });
    const code = await teacher.post(`/classes/${cls.id}/join-code`, { expiresInDays: 7 });
    expect(code.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(await (await k.raw('GET', `/join/${code.code}`)).json()).toEqual({ className: 'Grade 9 Math', schoolName: 'Maple Ridge Secondary' });
    const ana = await k.student(code.code, 'Ana Lee');
    const ben = await k.student(code.code.toLowerCase(), 'Ben Roy');
    expect(ana.user.role).toBe('student');
    expect((await teacher.get(`/classes/${cls.id}`)).students).toBe(2);
    expect((await ana.get('/classes')).map((c: { name: string; myRole: string }) => [c.name, c.myRole])).toEqual([['Grade 9 Math', 'student']]);
    expect((await ben.fail('GET', `/classes/${cls.id}/members`)).status).toBe(403);
    k.clock.advance(8 * 86_400_000);
    const late = await k.raw('POST', '/join', { body: { code: code.code, displayName: 'Cy', login: 'cy@school.test', password: 'student-pass-1' } });
    expect(late.status).toBe(404);
    expect((await late.json()).error.code).toBe('code_invalid');
    // Rotating the code retires the old one.
    const fresh = await teacher.post(`/classes/${cls.id}/join-code`, {});
    expect(fresh.code).not.toBe(code.code);
  });

  it('can require approval, and removing a student keeps the membership record', async () => {
    const admin = await k.admin();
    const cls = await newClass(admin);
    const code = await admin.post(`/classes/${cls.id}/join-code`, { requireApproval: true });
    const ana = await k.student(code.code, 'Ana Lee');
    expect(await ana.get('/classes')).toEqual([]);
    expect((await admin.get(`/classes/${cls.id}`)).pending).toBe(1);
    await admin.post(`/classes/${cls.id}/members/${ana.user.id}`, { action: 'approve' });
    expect(await ana.get('/classes')).toHaveLength(1);
    await admin.post(`/classes/${cls.id}/members/${ana.user.id}`, { action: 'remove' });
    expect((await ana.fail('GET', `/classes/${cls.id}`)).status).toBe(404);
    expect((await ana.fail('POST', '/join', { code: code.code })).status).toBe(403);
  });

  it('previews a CSV roster with errors per row before creating anything, then imports it', async () => {
    const admin = await k.admin();
    const cls = await newClass(admin);
    const bad = await admin.post(`/classes/${cls.id}/roster`, { csv: 'Name,Email\nAna Lee,ana@school.test\n,ben@school.test\nCy Park,has space@x\nAna Again,ana@school.test\nMs. Admin,admin@school.test', commit: true });
    expect(bad.committed).toBe(false);
    expect(bad.errors).toBe(4);
    expect(bad.rows.map((r: { line: number; error: string | null }) => [r.line, r.error && r.error.split(' ').slice(0, 3).join(' ')])).toEqual([
      [2, null],
      [3, 'Name is missing.'],
      [4, 'Email or username'],
      [5, 'This email or'],
      [6, 'This email or'],
    ]);
    expect((await admin.get(`/classes/${cls.id}`)).students).toBe(0);
    const preview = await admin.post(`/classes/${cls.id}/roster`, { csv: 'Ana Lee,ana@school.test\nBen Roy,benroy' });
    expect(preview).toMatchObject({ committed: false, errors: 0, created: 0 });
    expect((await admin.get(`/classes/${cls.id}`)).students).toBe(0);
    const done = await admin.post(`/classes/${cls.id}/roster`, { csv: 'Ana Lee,ana@school.test\nBen Roy,benroy', commit: true });
    expect(done).toMatchObject({ committed: true, created: 2, added: 2 });
    const pw = done.rows[0].temporaryPassword;
    expect(pw).toMatch(/^[A-Z2-9-]{14}$/);
    expect((await k.raw('POST', '/sessions', { body: { login: 'ana@school.test', password: pw } })).status).toBe(200);
    // Importing again creates nobody twice.
    expect(await admin.post(`/classes/${cls.id}/roster`, { csv: 'Ana Lee,ana@school.test', commit: true })).toMatchObject({ created: 0, added: 0 });
  });

  it('needs the school to confirm consent before a class that may include under-13s can take students', async () => {
    const admin = await k.admin();
    const cls = await newClass(admin, { name: 'Grade 7 Science', mayIncludeUnder13: true });
    const code = await admin.post(`/classes/${cls.id}/join-code`, {});
    const refused = await k.raw('POST', '/join', { body: { code: code.code, displayName: 'Dee', login: 'dee@school.test', password: 'student-pass-1' } });
    expect(refused.status).toBe(403);
    expect((await refused.json()).error.message).toMatch(/under 13/);
    const school = await admin.patch('/admin/school', { under13Consent: true });
    expect(school.under13Consent).toMatchObject({ confirmedBy: 'Ms. Admin', at: expect.any(String) });
    expect((await k.student(code.code, 'Dee Okoye')).user.role).toBe('student');
  });

  it('keeps classes private: other teachers and students cannot see or change them; co-teachers cannot delete', async () => {
    const admin = await k.admin();
    const t1 = await k.teacher(admin, 'Teacher One');
    const t2 = await k.teacher(admin, 'Teacher Two');
    const a = await newClass(t1, { name: 'Class A' });
    const b = await newClass(t2, { name: 'Class B' });
    const codeA = await t1.post(`/classes/${a.id}/join-code`, {});
    const ana = await k.student(codeA.code, 'Ana Lee');
    for (const who of [t2, ana]) {
      for (const [method, path] of [
        ['GET', `/classes/${b.id === a.id ? '' : who === t2 ? a.id : b.id}`],
        ['GET', `/classes/${who === t2 ? a.id : b.id}/members`],
        ['GET', `/classes/${who === t2 ? a.id : b.id}/materials`],
        ['GET', `/classes/${who === t2 ? a.id : b.id}/assessments`],
        ['GET', `/classes/${who === t2 ? a.id : b.id}/gradebook`],
        ['POST', `/classes/${who === t2 ? a.id : b.id}/join-code`],
        ['DELETE', `/classes/${who === t2 ? a.id : b.id}`],
      ] as const)
        expect((await who.fail(method, path)).status, `${who.user.displayName} ${method} ${path}`).toBe(404);
    }
    // Students cannot do teacher things in their own class.
    for (const [method, path] of [['POST', `/classes/${a.id}/join-code`], ['GET', `/classes/${a.id}/members`], ['POST', `/classes/${a.id}/assessments`], ['GET', `/classes/${a.id}/materials`], ['GET', `/classes/${a.id}/gradebook`], ['POST', '/classes']] as const)
      expect((await ana.fail(method, path, { name: 'x', title: 'x' })).status, `student ${method} ${path}`).toBe(403);
    await t1.post(`/classes/${a.id}/co-teachers`, { login: t2.user.login });
    expect((await t2.get(`/classes/${a.id}`)).myRole).toBe('co_teacher');
    expect((await t2.fail('DELETE', `/classes/${a.id}`)).status).toBe(403);
    await t1.post(`/classes/${a.id}/archive`, {});
    expect((await t1.get(`/classes/${a.id}`)).archived).toBe(true);
    await t1.del(`/classes/${a.id}`);
    expect((await t1.fail('GET', `/classes/${a.id}`)).status).toBe(404);
  });

  it('records accommodations per student', async () => {
    const admin = await k.admin();
    const cls = await newClass(admin);
    const code = await admin.post(`/classes/${cls.id}/join-code`, {});
    const ana = await k.student(code.code, 'Ana Lee');
    await admin.put(`/classes/${cls.id}/accommodations/${ana.user.id}`, { extraTimePercent: 50, pasteAllowed: true });
    expect(await admin.get(`/classes/${cls.id}/accommodations`)).toEqual({ [ana.user.id]: { extraTimePercent: 50, pasteAllowed: true, textToSpeech: false, largerText: false, note: '' } });
    expect((await ana.fail('PUT', `/classes/${cls.id}/accommodations/${ana.user.id}`, { extraTimePercent: 100 })).status).toBe(403);
  });
});
