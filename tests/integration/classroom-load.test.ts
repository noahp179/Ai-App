import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedClass, startClassroom, type Client, type TestClassroom } from '../helpers/classroom';

/**
 * A whole class at once: 35 students behind one school address, with the server's default rate limits, all
 * starting, chatting, autosaving, sending activity events and submitting at the same moment. The AI is scripted
 * (with a small delay per reply), so this measures the classroom server, not a model.
 */
const STUDENTS = 35;
let k: TestClassroom;
beforeAll(async () => {
  k = await startClassroom({ rateLimit: undefined });
  k.ai.onChat = async () => {
    await new Promise((r) => setTimeout(r, 50));
    return { text: 'Mitochondria release energy from glucose; chloroplasts capture light to make glucose.' };
  };
});
afterAll(() => k.close());

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))]!;

describe('a class of 35 at once', () => {
  it('starts, chats, autosaves and submits for every student without errors', async () => {
    const s = await seedClass(k, { evaluateAiUse: false });
    const students: Client[] = [s.ana, s.ben];
    for (let i = students.length; i < STUDENTS; i++) students.push(await k.student(s.code, `Student ${i + 1}`));
    const times: Record<string, number[]> = { start: [], autosave: [], chat: [], events: [], submit: [] };
    const timed = async <T,>(what: string, fn: () => Promise<T>): Promise<T> => {
      const t0 = performance.now();
      const r = await fn();
      times[what]!.push(performance.now() - t0);
      return r;
    };
    const t0 = performance.now();
    await Promise.all(
      students.map(async (st, n) => {
        const a = await timed('start', () => st.post(`/assessments/${s.assessment.id}/attempts`, { acknowledged: true }));
        for (let i = 1; i <= 5; i++) {
          await timed('autosave', () => st.put(`/attempts/${a.id}/responses`, { responses: { [s.items[2]!.id]: { type: 'written', text: `Draft ${i} by student ${n}. `.repeat(i * 4) } }, seconds: { [s.items[2]!.id]: 20 } }));
          if (i === 2) await timed('chat', () => st.chat(a.id, `How are mitochondria different from chloroplasts? (${n})`));
          if (i === 3) await timed('events', () => st.post(`/attempts/${a.id}/events`, { events: [{ kind: 'focus_lost', itemId: null, at: '2026-11-12T14:00:05Z', detail: { ms: 4000 } }] }));
        }
        await st.put(`/attempts/${a.id}/responses`, { responses: { [s.items[0]!.id]: { type: 'choice', choice: 'c2' }, [s.items[1]!.id]: { type: 'text', text: '8' } } });
        await timed('submit', () => st.post(`/attempts/${a.id}/submit`));
      }),
    );
    const wall = performance.now() - t0;
    const count = (sql: string) => k.srv.db.get<{ n: number }>(sql)!.n;
    expect(count(`SELECT COUNT(*) AS n FROM attempts WHERE status = 'submitted'`)).toBe(STUDENTS);
    expect(count(`SELECT COUNT(*) AS n FROM chat_messages WHERE role = 'assistant' AND status = 'complete'`)).toBe(STUDENTS);
    expect(count(`SELECT COUNT(*) AS n FROM integrity_events`)).toBe(STUDENTS);
    // Every final answer is the student's own last save.
    const rows = k.srv.db.all<{ responses: string }>('SELECT responses FROM attempts');
    for (const r of rows) expect(JSON.parse(r.responses)[s.items[2]!.id].text).toMatch(/^Draft 5 by student \d+\./);
    const gb = await s.teacher.get(`/classes/${s.cls.id}/gradebook`);
    expect(Object.values(gb.cells as Record<string, { status: string }>).filter((c) => c.status === 'submitted')).toHaveLength(STUDENTS);

    const summary = Object.fromEntries(Object.entries(times).map(([w, xs]) => [w, { n: xs.length, p50: Math.round(pct(xs, 50)), p95: Math.round(pct(xs, 95)), max: Math.round(Math.max(...xs)) }]));
    const report = { students: STUDENTS, wallMs: Math.round(wall), requests: Object.values(times).reduce((a, x) => a + x.length, 0) + STUDENTS, ms: summary, note: 'In-process server, scripted AI with a 50 ms reply delay, SQLite on local disk.' };
    fs.mkdirSync(path.join(__dirname, '..', '..', 'test-results'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '..', '..', 'test-results', 'classroom-load.json'), JSON.stringify(report, null, 2));
    console.log('classroom load:', JSON.stringify(report));
    // Generous limits: this catches lock contention or a rate limit hitting a class, not machine speed.
    expect(summary.autosave!.p95).toBeLessThan(1500);
    expect(summary.submit!.p95).toBeLessThan(3000);
  }, 120_000);
});
