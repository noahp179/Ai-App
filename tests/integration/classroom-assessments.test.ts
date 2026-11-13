import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QUESTIONS, seedClass, startClassroom, type TestClassroom } from '../helpers/classroom';

let k: TestClassroom;
beforeEach(async () => {
  k = await startClassroom();
});
afterEach(() => k.close());

const start = (c: Awaited<ReturnType<typeof seedClass>>['ana'], id: string) => c.post(`/assessments/${id}/attempts`, { acknowledged: true });

describe('writing and publishing assessments', () => {
  it('will not publish an empty assessment, or one with AI-drafted questions nobody has reviewed', async () => {
    const teacher = await k.admin();
    const cls = await teacher.post('/classes', { name: 'Science' });
    const m = await teacher.upload(`/classes/${cls.id}/materials`, 'notes.txt', Buffer.from('Cells have membranes. Mitochondria release energy. '.repeat(5)));
    const a = await teacher.post(`/classes/${cls.id}/assessments`, { title: 'Quiz', materialIds: [m.id] });
    expect((await teacher.fail('POST', `/assessments/${a.id}/publish`)).code).toBe('no_items');
    k.ai.onJudge = () => ({
      items: [
        { type: 'multiple_choice', prompt: 'What do mitochondria release?', choices: ['Energy', 'Water', 'Light', 'Sugar'], correctChoice: 0, correctBool: false, acceptedAnswers: [], teacherNotes: '', source: 'notes.txt, section 1' },
        { type: 'true_false', prompt: 'Cells have membranes.', choices: [], correctChoice: 0, correctBool: true, acceptedAnswers: [], teacherNotes: '', source: 'notes.txt' },
        { type: 'multiple_choice', prompt: 'Broken: answer out of range', choices: ['a', 'b'], correctChoice: 9, correctBool: false, acceptedAnswers: [], teacherNotes: '', source: '' },
      ],
    });
    const drafted = await teacher.post(`/assessments/${a.id}/items/draft`, { count: 3 });
    expect(drafted.added).toBe(2);
    expect(drafted.skipped).toHaveLength(1);
    expect(drafted.items.map((i: { aiDrafted: boolean; reviewed: boolean; question: { origin: string; keyVerified: boolean } }) => [i.aiDrafted, i.reviewed, i.question.origin, i.question.keyVerified])).toEqual([[true, false, 'ai', false], [true, false, 'ai', false]]);
    // The materials went to the AI as data; the teacher's name did not.
    expect(k.ai.judges[0]!.user).toContain('Mitochondria release energy');
    expect(k.ai.judges[0]!.system + k.ai.judges[0]!.user).not.toContain('Ms. Admin');
    const blocked = await teacher.fail('POST', `/assessments/${a.id}/publish`);
    expect(blocked).toMatchObject({ status: 400, code: 'unreviewed_items' });
    expect(blocked.message).toMatch(/2 AI-drafted questions need to be reviewed/);
    // Accept one as it is, edit the other: both count as reviewed.
    await teacher.patch(`/assessments/${a.id}/items/${drafted.items[0].id}`, { reviewed: true });
    expect((await teacher.fail('POST', `/assessments/${a.id}/publish`)).message).toMatch(/1 AI-drafted question needs/);
    const edited = await teacher.patch(`/assessments/${a.id}/items/${drafted.items[1].id}`, { question: { type: 'true_false', prompt: 'Every cell has a membrane.', answer: true } });
    expect(edited).toMatchObject({ reviewed: true, aiDrafted: true });
    expect((await teacher.post(`/assessments/${a.id}/publish`)).status).toBe('published');
  });

  it('says when the AI’s draft could not be used instead of adding anything', async () => {
    const teacher = await k.admin();
    const cls = await teacher.post('/classes', { name: 'Science' });
    const m = await teacher.upload(`/classes/${cls.id}/materials`, 'notes.txt', Buffer.from('Some readable notes about cells and energy.'));
    const a = await teacher.post(`/classes/${cls.id}/assessments`, { title: 'Quiz', materialIds: [m.id] });
    k.ai.onJudge = () => 'this is not json';
    expect(await teacher.fail('POST', `/assessments/${a.id}/items/draft`, {})).toMatchObject({ status: 502, code: 'ai_invalid' });
    expect(k.ai.judges).toHaveLength(2);
    expect(await teacher.get(`/assessments/${a.id}/items`)).toEqual([]);
    const none = await teacher.post(`/classes/${cls.id}/assessments`, { title: 'No materials' });
    expect((await teacher.fail('POST', `/assessments/${none.id}/items/draft`, {})).code).toBe('no_materials');
  });

  it('validates questions, reorders them, imports them from a file and rejects a closing time before the opening time', async () => {
    const teacher = await k.admin();
    const cls = await teacher.post('/classes', { name: 'Science' });
    const a = await teacher.post(`/classes/${cls.id}/assessments`, { title: 'Quiz' });
    expect(await teacher.fail('POST', `/assessments/${a.id}/items`, { question: { type: 'multiple_choice', prompt: 'x', choices: ['only one'], answer: 0 } })).toMatchObject({ status: 400, code: 'invalid_question' });
    const ids: string[] = [];
    for (const q of QUESTIONS) ids.push((await teacher.post(`/assessments/${a.id}/items`, q)).id);
    const re = await teacher.post(`/assessments/${a.id}/items/reorder`, { itemIds: [ids[2], ids[0], ids[1]] });
    expect(re.map((i: { id: string; position: number }) => [i.id, i.position])).toEqual([[ids[2], 1], [ids[0], 2], [ids[1], 3]]);
    const imp = await teacher.post(`/assessments/${a.id}/items/import`, { json: JSON.stringify({ items: [{ points: 2, question: { type: 'true_false', prompt: 'Imported.', answer: false } }, { question: { type: 'nonsense' } }] }) });
    expect(imp.added).toBe(1);
    expect(imp.problems).toHaveLength(1);
    expect((await teacher.get(`/assessments/${a.id}`)).points).toBe(9);
    expect((await teacher.fail('PATCH', `/assessments/${a.id}`, { settings: { opensAt: '2026-12-02T00:00:00.000Z', closesAt: '2026-12-01T00:00:00.000Z' } })).status).toBe(400);
    expect((await teacher.get('/curriculum/courses?grade=9')).some((c: { id: string }) => c.id === 'on-snc1w')).toBe(true);
    expect((await teacher.get('/curriculum/courses/on-snc1w/expectations')).length).toBeGreaterThan(10);
  });

  it('gives edited questions a new version; students who already answered keep the version they saw', async () => {
    const s = await seedClass(k);
    const t1 = await start(s.ana, s.assessment.id);
    await s.ana.put(`/attempts/${t1.id}/responses`, { responses: { [s.items[0]!.id]: { type: 'choice', choice: 'c2' } } });
    await s.ana.post(`/attempts/${t1.id}/submit`);
    await s.teacher.patch(`/assessments/${s.assessment.id}/items/${s.items[0]!.id}`, { question: { type: 'multiple_choice', prompt: 'Rewritten question?', choices: ['A', 'B'], answer: 0 } });
    expect((await s.teacher.get(`/assessments/${s.assessment.id}`)).version).toBe(2);
    const review = await s.teacher.get(`/attempts/${t1.id}/review`);
    expect(review.attempt.version).toBe(1);
    expect(review.items[0].question.prompt[0].text).toMatch(/controls what enters/);
    expect(review.grades[0].score).toBe(1);
    const t2 = await start(s.ben, s.assessment.id);
    expect(t2.items[0].question.prompt[0].text).toBe('Rewritten question?');
  });
});

describe('taking an assessment', () => {
  it('shows what is recorded before the start, and will not start without the acknowledgement', async () => {
    const s = await seedClass(k);
    const intro = await s.ana.get(`/assessments/${s.assessment.id}/intro`);
    expect(intro.assessment).toMatchObject({ title: 'Cells quiz', phase: 'open', items: 3, points: 7 });
    expect(intro.recorded.join(' ')).toMatch(/Your teacher can read this chat/);
    expect(intro.recorded.join(' ')).toMatch(/paste/);
    expect(intro.neverRecorded.join(' ')).toMatch(/camera, microphone or screen/);
    expect(intro.limits).toMatch(/not proctoring and not proof/);
    expect((await s.ana.fail('POST', `/assessments/${s.assessment.id}/attempts`, {})).status).toBe(400);
    expect((await s.ana.fail('POST', `/assessments/${s.assessment.id}/attempts`, { acknowledged: false })).status).toBe(400);
    const t = await start(s.ana, s.assessment.id);
    expect(t.status).toBe('in_progress');
    // Answer keys never reach the student.
    const text = JSON.stringify(t);
    expect(text).not.toContain('Mitochondria release energy from glucose; chloroplasts');
    expect(t.items[0].question.answer).toBe('');
    expect(t.items[1].question.answer).toBe('');
    expect(t.materials).toEqual([{ id: s.material.id, name: 'Unit 3 notes.pdf', pages: 2 }]);
    // Teachers do not take their own assessments.
    expect((await s.teacher.fail('POST', `/assessments/${s.assessment.id}/attempts`, { acknowledged: true })).status).toBe(403);
  });

  it('saves as the student works, resumes after a restart with the right time left, and submits on the server’s clock', async () => {
    const s = await seedClass(k, { timeLimitMinutes: 30 });
    const t = await start(s.ana, s.assessment.id);
    expect(Date.parse(t.deadline) - Date.parse(t.startedAt)).toBe(30 * 60_000);
    const [q1, q2, q3] = s.items.map((i) => i.id) as [string, string, string];
    await s.ana.put(`/attempts/${t.id}/responses`, { responses: { [q1]: { type: 'choice', choice: 'c2' }, [q3]: { type: 'written', text: 'Mitochondria release energy.' } }, flags: [q2], seconds: { [q1]: 40, [q3]: 90 } });
    k.clock.advance(10 * 60_000);
    // "The app was killed": a fresh request sees everything that was saved, and server time, not client time.
    const back = await s.ana.get(`/attempts/${t.id}`);
    expect(back.responses[q1]).toEqual({ type: 'choice', choice: 'c2' });
    expect(back.responses[q3].text).toBe('Mitochondria release energy.');
    expect(back.flags).toEqual([q2]);
    expect(Date.parse(back.deadline) - Date.parse(back.serverNow)).toBe(20 * 60_000);
    // Starting again returns the same attempt, not a new one.
    expect((await start(s.ana, s.assessment.id)).id).toBe(t.id);
    expect((await s.ana.fail('PUT', `/attempts/${t.id}/responses`, { responses: { [q1]: { type: 'text', text: 'wrong shape' } } })).code).toBe('invalid_response');
    // Time runs out while the laptop is closed: the server submits what was saved.
    k.clock.advance(21 * 60_000);
    await k.srv.sweep();
    const done = await s.ana.get(`/attempts/${t.id}`);
    expect(done).toMatchObject({ status: 'submitted', autoSubmitted: true, submittedAt: t.deadline });
    expect(done.reference).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect((await s.ana.fail('PUT', `/attempts/${t.id}/responses`, { responses: {} })).code).toBe('submitted');
  });

  it('refuses late work whatever the student’s clock says, and counts extra time from an accommodation', async () => {
    const s = await seedClass(k, { timeLimitMinutes: 10, closesAt: '2026-11-12T16:00:00.000Z' });
    await s.teacher.put(`/classes/${s.cls.id}/accommodations/${s.ben.user.id}`, { extraTimePercent: 50 });
    const ta = await start(s.ana, s.assessment.id);
    const tb = await start(s.ben, s.assessment.id);
    expect(Date.parse(ta.deadline) - Date.parse(ta.startedAt)).toBe(10 * 60_000);
    expect(Date.parse(tb.deadline) - Date.parse(tb.startedAt)).toBe(15 * 60_000);
    k.clock.advance(10 * 60_000 + 5_000);
    // Within the short grace for slow connections.
    expect((await s.ana.put(`/attempts/${ta.id}/responses`, { responses: { [s.items[1]!.id]: { type: 'text', text: '8' } } })).savedAt).toBeTruthy();
    k.clock.advance(60_000);
    const late = await s.ana.fail('PUT', `/attempts/${ta.id}/responses`, { responses: { [s.items[1]!.id]: { type: 'text', text: '999' } } });
    expect(late).toMatchObject({ status: 409, code: 'time_up' });
    const final = await s.ana.get(`/attempts/${ta.id}`);
    expect(final.status).toBe('submitted');
    expect(final.responses[s.items[1]!.id].text).toBe('8');
    expect((await s.ben.put(`/attempts/${tb.id}/responses`, { responses: {} })).savedAt).toBeTruthy();
    // After the closing time nobody can start, and a deadline never runs past it.
    k.clock.set('2026-11-12T15:55:00Z');
    const cy = await k.student(s.code, 'Cy Park');
    const tc = await start(cy, s.assessment.id);
    expect(tc.deadline).toBe('2026-11-12T16:00:00.000Z');
    k.clock.set('2026-11-12T16:00:30Z');
    const dee = await k.student(s.code, 'Dee Okoye');
    expect(await dee.fail('POST', `/assessments/${s.assessment.id}/attempts`, { acknowledged: true })).toMatchObject({ status: 409, code: 'closed' });
    // Cy's time ran out too: the server has already submitted what was saved, and says so.
    expect(await cy.post(`/attempts/${tc.id}/submit`)).toMatchObject({ autoSubmitted: true, submittedAt: '2026-11-12T16:00:00.000Z' });
    expect((await cy.get(`/attempts/${tc.id}`)).status).toBe('submitted');
  });

  it('opens on schedule and limits the number of attempts', async () => {
    const s = await seedClass(k, { opensAt: '2026-11-13T14:00:00.000Z', attempts: 2 });
    expect((await s.ana.get(`/classes/${s.cls.id}/assessments`))[0]).toMatchObject({ phase: 'scheduled', my: { status: 'not_started', attemptsUsed: 0 } });
    expect((await s.ana.fail('POST', `/assessments/${s.assessment.id}/attempts`, { acknowledged: true })).code).toBe('not_open');
    k.clock.set('2026-11-13T14:00:01Z');
    for (let i = 1; i <= 2; i++) {
      const t = await start(s.ana, s.assessment.id);
      expect(t.number).toBe(i);
      await s.ana.post(`/attempts/${t.id}/submit`);
    }
    expect((await s.ana.fail('POST', `/assessments/${s.assessment.id}/attempts`, { acknowledged: true })).code).toBe('no_attempts_left');
    expect((await s.ana.get(`/classes/${s.cls.id}/assessments`))[0].my).toMatchObject({ status: 'submitted', attemptsUsed: 2 });
  });

  it('records paste attempts, focus changes and large insertions, and never turns an accommodation into a signal', async () => {
    const s = await seedClass(k);
    await s.teacher.put(`/classes/${s.cls.id}/accommodations/${s.ben.user.id}`, { pasteAllowed: true });
    const ta = await start(s.ana, s.assessment.id);
    const tb = await start(s.ben, s.assessment.id);
    const at = k.clock.now().toISOString();
    const events = [
      { kind: 'paste_blocked', itemId: s.items[2]!.id, at, detail: { how: 'keyboard', chars: 412 } },
      { kind: 'copy_blocked', itemId: null, at, detail: { where: 'assistant' } },
      { kind: 'focus_lost', itemId: null, at, detail: { ms: 42_000 } },
      { kind: 'large_insert', itemId: s.items[2]!.id, at, detail: { chars: 260 } },
    ];
    expect((await s.ana.post(`/attempts/${ta.id}/events`, { events })).recorded).toBe(4);
    // Ben may paste and dictate: only leaving the window and the copy attempt are kept.
    expect((await s.ben.post(`/attempts/${tb.id}/events`, { events })).recorded).toBe(2);
    expect((await s.ana.fail('POST', `/attempts/${ta.id}/events`, { events: [{ kind: 'keystroke', at, detail: {} }] })).status).toBe(400);
    await s.ana.post(`/attempts/${ta.id}/submit`);
    await s.ben.post(`/attempts/${tb.id}/submit`);
    // Nothing is recorded once the attempt is submitted.
    expect((await s.ana.post(`/attempts/${ta.id}/events`, { events })).recorded).toBe(0);
    const rows = await s.teacher.get(`/assessments/${s.assessment.id}/submissions`);
    expect(rows.find((r: { student: { displayName: string } }) => r.student.displayName === 'Ana Lee').signals).toMatchObject({ pasteAttempts: 1, focusLosses: 1, largeInserts: 1 });
    expect(rows.find((r: { student: { displayName: string } }) => r.student.displayName === 'Ben Roy')).toMatchObject({ signals: { pasteAttempts: 0, largeInserts: 0, focusLosses: 1 }, hasAccommodation: true });
    const review = await s.teacher.get(`/attempts/${ta.id}/review`);
    expect(review.events.map((e: { kind: string }) => e.kind)).toEqual(['paste_blocked', 'copy_blocked', 'focus_lost', 'large_insert']);
  });

  it('with the settings off, nothing is logged at all', async () => {
    const s = await seedClass(k, { blockPaste: false, logFocus: false, largeInsertSignal: false });
    const t = await start(s.ana, s.assessment.id);
    const at = k.clock.now().toISOString();
    expect((await s.ana.post(`/attempts/${t.id}/events`, { events: [{ kind: 'paste_blocked', at, detail: {} }, { kind: 'focus_lost', at, detail: {} }, { kind: 'large_insert', at, detail: {} }] })).recorded).toBe(0);
    const intro = await s.ben.get(`/assessments/${s.assessment.id}/intro`);
    expect(intro.recorded.join(' ')).not.toMatch(/paste|leave this window|large amount/);
  });

  it('keeps every attempt, assessment and draft away from people who should not see them', async () => {
    const s = await seedClass(k);
    const other = await k.teacher(s.teacher, 'Other Teacher');
    const otherClass = await other.post('/classes', { name: 'Other class' });
    const otherCode = (await other.post(`/classes/${otherClass.id}/join-code`, {})).code;
    const eve = await k.student(otherCode, 'Eve Outsider');
    const draft = await s.teacher.post(`/classes/${s.cls.id}/assessments`, { title: 'Still a draft' });
    const t = await start(s.ana, s.assessment.id);
    await s.ana.put(`/attempts/${t.id}/responses`, { responses: { [s.items[1]!.id]: { type: 'text', text: '8' } } });
    const A = s.assessment.id;
    const routes: [string, string][] = [
      ['GET', `/assessments/${A}`],
      ['GET', `/assessments/${A}/intro`],
      ['POST', `/assessments/${A}/attempts`],
      ['GET', `/assessments/${A}/items`],
      ['GET', `/assessments/${A}/submissions`],
      ['GET', `/assessments/${A}/overview`],
      ['POST', `/assessments/${A}/release`],
      ['POST', `/assessments/${A}/batch`],
      ['GET', `/attempts/${t.id}`],
      ['PUT', `/attempts/${t.id}/responses`],
      ['POST', `/attempts/${t.id}/events`],
      ['GET', `/attempts/${t.id}/chat`],
      ['POST', `/attempts/${t.id}/chat`],
      ['POST', `/attempts/${t.id}/submit`],
      ['GET', `/attempts/${t.id}/result`],
      ['GET', `/attempts/${t.id}/review`],
      ['PUT', `/attempts/${t.id}/grades/${s.items[0]!.id}`],
      ['POST', `/attempts/${t.id}/evaluate`],
      ['PUT', `/attempts/${t.id}/evaluation`],
      ['GET', `/attempts/${t.id}/materials/${s.material.id}/pages/1`],
    ];
    // A student and a teacher from another class get "not found" everywhere.
    for (const who of [eve, other]) for (const [m, p] of routes) expect((await who.fail(m, p, { acknowledged: true, text: 'hi', score: 1, levels: {} })).status, `${who.user.displayName} ${m} ${p}`).toBe(404);
    // A classmate cannot reach another student's attempt, and no student can use teacher routes.
    for (const [m, p] of routes.filter(([, p]) => p.startsWith('/attempts/'))) expect((await s.ben.fail(m, p, { text: 'hi', score: 1, levels: {} })).status, `classmate ${m} ${p}`).toBe(404);
    for (const p of [`/assessments/${A}/items`, `/assessments/${A}/submissions`, `/assessments/${A}/overview`]) expect((await s.ben.fail('GET', p)).status, `student GET ${p}`).toBe(403);
    expect((await s.ana.fail('GET', `/attempts/${t.id}/review`)).status).toBe(404);
    expect((await s.ana.fail('PUT', `/attempts/${t.id}/grades/${s.items[0]!.id}`, { score: 1 })).status).toBe(404);
    // Drafts are invisible to students.
    expect((await s.ana.fail('GET', `/assessments/${draft.id}`)).status).toBe(404);
    expect((await s.ana.get(`/classes/${s.cls.id}/assessments`)).map((a: { title: string }) => a.title)).toEqual(['Cells quiz']);
    // Without a session nothing answers.
    for (const [m, p] of routes) expect((await k.raw(m, p, { body: m === 'GET' ? undefined : {} })).status, `anonymous ${m} ${p}`).toBe(401);
  });
});

describe('partial updates', () => {
  it('change only the fields that were sent, never resetting the rest to defaults', async () => {
    const s = await seedClass(k, { aiMode: 'hints', timeLimitMinutes: 30, evaluateAiUse: false });
    // Assessment: a new title keeps instructions, settings and materials.
    await s.teacher.post(`/assessments/${s.assessment.id}/publish`, { publish: false });
    const renamed = await s.teacher.patch(`/assessments/${s.assessment.id}`, { title: 'Cells quiz (v2)' });
    expect(renamed).toMatchObject({ title: 'Cells quiz (v2)', instructions: 'Answer in your own words.', materialIds: [s.material.id], settings: { aiMode: 'hints', timeLimitMinutes: 30, evaluateAiUse: false } });
    // One setting changes; the others stay.
    const one = await s.teacher.patch(`/assessments/${s.assessment.id}`, { settings: { messageLimit: 5 } });
    expect(one.settings).toMatchObject({ messageLimit: 5, aiMode: 'hints', timeLimitMinutes: 30, evaluateAiUse: false });
    // Question: accepting keeps its points; changing points keeps the question.
    const item = s.items[2]!;
    expect(await s.teacher.patch(`/assessments/${s.assessment.id}/items/${item.id}`, { reviewed: true })).toMatchObject({ points: 4 });
    expect(await s.teacher.patch(`/assessments/${s.assessment.id}/items/${item.id}`, { points: 5 })).toMatchObject({ points: 5, long: true, question: { type: 'written' } });
    // School settings: one field, and one price, at a time.
    await s.teacher.patch('/admin/school', { aiModel: 'claude-sonnet-5-5', prices: { input: 3 } });
    const school = await s.teacher.patch('/admin/school', { monthlyBudget: 25 });
    expect(school.settings).toMatchObject({ aiModel: 'claude-sonnet-5-5', monthlyBudget: 25, retentionDays: 365, prices: { input: 3, output: 20, cacheRead: 0.2, cacheWrite: 5 } });
    expect((await s.teacher.get('/admin/audit?action=school.settings'))[0].detail).toBe('monthlyBudget');
    expect((await s.teacher.get('/admin/audit?action=school.settings'))[1].detail).toBe('aiModel, prices');
  });
});

describe('hints', () => {
  it('reach students only in practice quizzes', async () => {
    const withHint = { points: 1, question: { type: 'true_false', prompt: 'Plant cells have chloroplasts.', answer: true, hints: ['Think about photosynthesis.'] } };
    for (const [kind, expected] of [['quiz', []], ['practice', ['Think about photosynthesis.']]] as const) {
      const local = await startClassroom();
      const teacher = await local.admin();
      const cls = await teacher.post('/classes', { name: 'Science' });
      const code = (await teacher.post(`/classes/${cls.id}/join-code`, {})).code;
      const ana = await local.student(code, 'Ana Lee');
      const a = await teacher.post(`/classes/${cls.id}/assessments`, { title: 'Q', settings: { kind, aiMode: 'off' } });
      await teacher.post(`/assessments/${a.id}/items`, withHint);
      await teacher.post(`/assessments/${a.id}/publish`, {});
      const t = await ana.post(`/assessments/${a.id}/attempts`, { acknowledged: true });
      expect(t.items[0].question.hints, kind).toEqual(expected);
      await local.close();
    }
  });
});
