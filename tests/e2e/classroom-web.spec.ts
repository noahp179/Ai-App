import { chromium, expect, test, type Browser, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { JudgeRequest } from '../../classroom-server/ai/provider';
import { NOTES_PDF, startClassroom, type TestClassroom } from '../helpers/classroom';

/**
 * The browser build of the classroom against a real classroom server (in this process, with a scripted AI that is
 * never presented as a real model). Run `npm run build:classroom` first.
 */
const WEB = path.resolve(__dirname, '..', '..', 'dist', 'classroom-web');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

let k: TestClassroom;
let browser: Browser;
/** Fails the test on any uncaught page error, which would otherwise show only as a blank page. */
let afterTest: (() => void) | null = null;
test.afterEach(() => {
  afterTest?.();
  afterTest = null;
});

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(WEB, 'index.html'))) throw new Error('Build the browser app first: npm run build:classroom');
  k = await startClassroom({ webDir: WEB });
  k.ai.onChat = (req) => ({
    text: 'The cell membrane controls what goes in and out of the cell.',
    citations: req.documents[0] ? [{ materialId: req.documents[0].materialId, page: 1, quote: 'The cell membrane controls what enters and leaves the cell.' }] : [],
  });
  k.ai.onJudge = (req: JudgeRequest) => {
    if (/review how a student used an AI study assistant/.test(req.system)) {
      const id = /<message id="([^"]+)" from="student"/.exec(req.user)?.[1] ?? '';
      const first = /<message id="[^"]+" from="student"[^>]*>\n([^\n]+)/.exec(req.user)?.[1] ?? '';
      return { criteria: ['understanding', 'materials', 'critical', 'honesty', 'prompts'].map((c) => ({ criterionId: c, level: 3, quotes: [{ messageId: id, text: first }], rationale: `Asked about the idea, not the answer (${c}).` })), summary: 'Asked one question about the notes.', flags: [] };
    }
    return {};
  };
  // Use the browser Playwright installed; FC_CHROMIUM (or a preinstalled Chromium) when its version differs.
  const preinstalled = process.env.FC_CHROMIUM ?? '/opt/pw-browsers/chromium';
  browser = await chromium.launch(fs.existsSync(preinstalled) && !fs.existsSync(chromium.executablePath()) ? { executablePath: preinstalled } : {});
});
test.afterAll(async () => {
  await browser?.close();
  await k?.close();
});

/** Runs axe for WCAG 2.x A and AA (including 2.2) and returns violations, most serious first. */
async function axe(page: Page, label: string) {
  await page.evaluate(AXE);
  const r = await page.evaluate(async () => {
    const res = await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }> } }).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  if (r.length) console.log(`axe ${label}:`, JSON.stringify(r, null, 1));
  return r;
}

test('a teacher sets a quiz, a student takes it with the assistant, and the teacher marks and releases it', async () => {
  const teacherCtx = await browser.newContext();
  const t = await teacherCtx.newPage();
  const errors: string[] = [];
  t.on('pageerror', (e) => errors.push(`teacher: ${e.message}\n${e.stack ?? ''}`));
  t.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`teacher console: ${m.text()}`));
  afterTest = () => expect(errors, errors.join('\n')).toEqual([]);
  await t.goto(k.base);

  // ── The first visit sets up the school. ──
  await expect(t.getByRole('heading', { name: 'Classroom' })).toBeVisible();
  expect(await axe(t, 'sign-in')).toEqual([]);
  await t.getByLabel('School name').fill('Maple Ridge Secondary');
  await t.getByLabel('Your name').fill('Ms. Admin');
  await t.getByLabel('Email or username').fill('admin@school.test');
  await t.getByLabel('Password').fill('correct-horse-9');
  await t.getByRole('button', { name: 'Create school' }).click();
  await expect(t.getByText('Ms. Admin · Administrator · Maple Ridge Secondary')).toBeVisible();

  // ── A class, its code and a material. ──
  await t.getByRole('button', { name: 'New class' }).click();
  await t.getByLabel('Class name').fill('Grade 9 Science');
  await t.getByRole('button', { name: 'Create class' }).click();
  await expect(t.getByRole('heading', { name: 'Grade 9 Science' })).toBeVisible();
  await t.getByRole('tab', { name: 'Students' }).click();
  await t.getByRole('button', { name: 'Make a code' }).click();
  const code = (await t.locator('.class-code').first().textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9-]{4,}$/);
  await t.getByRole('tab', { name: 'Materials' }).click();
  await t.getByRole('switch', { name: 'I have the right to share these files with my class' }).check();
  await t.getByLabel('Material files').setInputFiles({ name: 'Unit 3 notes.pdf', mimeType: 'application/pdf', buffer: NOTES_PDF() });
  await expect(t.getByRole('row', { name: /Unit 3 notes\.pdf/ })).toContainText('Text read');
  expect(await axe(t, 'materials')).toEqual([]);

  // ── An assessment with two questions, using the material. ──
  await t.getByRole('tab', { name: 'Assessments' }).click();
  await t.getByLabel('Assessment title').fill('Cells quiz');
  await t.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(t.getByRole('heading', { name: 'Cells quiz' })).toBeVisible();
  await t.getByRole('button', { name: 'Add question' }).click();
  const dlg = t.getByRole('dialog');
  await dlg.getByLabel('Question', { exact: true }).fill('Which part controls what enters and leaves the cell?');
  for (const [i, c] of ['Nucleus', 'Cell membrane', 'Ribosome', 'Vacuole'].entries()) await dlg.getByLabel(`Choice ${i + 1}`, { exact: true }).fill(c);
  await dlg.getByLabel('Choice 2 is correct').check();
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(t.getByText('Answer: · Nucleus   ✓ Cell membrane')).toBeVisible();
  await t.getByRole('button', { name: 'Add question' }).click();
  await dlg.getByLabel('Type').selectOption('written');
  await dlg.getByLabel('Points').fill('4');
  await dlg.getByLabel('Question', { exact: true }).fill('Explain how mitochondria and chloroplasts are different.');
  await dlg.getByLabel(/Notes for marking/).fill('Mitochondria release energy; chloroplasts make glucose using light.');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(t.getByText('Question 2', { exact: true })).toBeVisible();
  expect(await axe(t, 'questions')).toEqual([]);
  await t.getByRole('tab', { name: 'Settings' }).click();
  await t.getByRole('checkbox', { name: /Unit 3 notes\.pdf/ }).check();
  expect(await axe(t, 'settings')).toEqual([]);
  await t.getByRole('button', { name: 'Save settings' }).click();
  await expect(t.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await t.getByRole('button', { name: 'Publish' }).click();
  await expect(t.getByText(/Quiz · Materials-only tutor · Open/)).toBeVisible();

  // ── A student joins and takes it. ──
  const studentCtx = await browser.newContext();
  const s = await studentCtx.newPage();
  s.on('pageerror', (e) => errors.push(`student: ${e.message}\n${e.stack ?? ''}`));
  s.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`student console: ${m.text()}`));
  await s.goto(k.base);
  await s.getByRole('tab', { name: 'Join a class' }).click();
  await s.getByLabel('Class code').fill(code);
  await expect(s.getByText('Grade 9 Science · Maple Ridge Secondary')).toBeVisible();
  await s.getByLabel('Your name').fill('Ana Lee');
  await s.getByLabel('Email or username').fill('ana.lee@school.test');
  await s.getByLabel('Password').fill('student-pass-1');
  await s.getByRole('button', { name: 'Join class' }).click();
  await s.getByRole('button', { name: /Grade 9 Science/ }).click();
  await s.getByRole('button', { name: 'Start' }).click();
  // Told exactly what is recorded, and what never is, before starting.
  await expect(s.getByText('Everything you type to the AI assistant and its replies.', { exact: false })).toBeVisible();
  await expect(s.getByText('Your camera, microphone or screen.')).toBeVisible();
  expect(await axe(s, 'intro')).toEqual([]);
  await expect(s.getByRole('button', { name: 'Start' })).toBeDisabled();
  await s.getByLabel('I have read what is recorded during this assessment.').check();
  await s.getByRole('button', { name: 'Start' }).click();

  // The assistant, grounded in the teacher's notes, with a citation to the page.
  await s.getByLabel('Message to the assistant').fill('What does the cell membrane do?');
  await s.getByRole('button', { name: 'Ask' }).click();
  const reply = s.locator('.chat-msg.assistant').last();
  await expect(reply).toContainText('controls what goes in and out');
  await reply.getByRole('button', { name: 'Unit 3 notes.pdf, page 1' }).click();
  await expect(s.getByRole('dialog')).toContainText('The cell membrane controls what enters and leaves the cell.');
  await s.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  // Copying out of the assistant is blocked, and recorded.
  await reply.locator('.chat-text').dispatchEvent('copy');
  await expect(s.getByRole('status').filter({ hasText: 'Copying is turned off' })).toBeVisible();

  await s.getByRole('radio', { name: 'Cell membrane' }).check();
  await s.getByRole('button', { name: 'Next question' }).click();
  const answer = s.getByLabel('Your answer to question 2');
  await answer.fill('Mitochondria release energy from glucose. Chloroplasts make glucose using light.');
  // Pasting into an answer is blocked, and recorded.
  await answer.evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', 'pasted text');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(s.getByRole('status').filter({ hasText: 'Pasting is turned off' })).toBeVisible();
  await expect(answer).toHaveValue('Mitochondria release energy from glucose. Chloroplasts make glucose using light.');
  await expect(s.getByText(/Saved \d/)).toBeVisible({ timeout: 10_000 });
  expect(await axe(s, 'workspace')).toEqual([]);
  // Autosave survives a reload.
  await s.reload();
  await s.getByRole('button', { name: /Grade 9 Science/ }).click();
  await s.getByRole('button', { name: 'Continue' }).click();
  await s.getByRole('button', { name: 'Question 2, answered' }).click();
  await expect(s.getByLabel('Your answer to question 2')).toHaveValue(/Chloroplasts make glucose using light/);
  await s.getByRole('button', { name: 'Submit' }).last().click();
  await s.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await expect(s.getByText('Your answers were received')).toBeVisible();
  await expect(s.getByText(/Receipt:/)).toBeVisible();

  // ── The teacher reviews: answers, chat, activity, and an AI-suggested evaluation they decide on. ──
  await t.getByRole('tab', { name: /Submissions/ }).click();
  await expect(t.getByRole('row', { name: /Ana Lee/ })).toContainText('To mark');
  await expect(t.getByRole('row', { name: /Ana Lee/ })).toContainText('1 paste');
  await t.getByRole('button', { name: 'Ana Lee' }).click();
  await expect(t.getByText('Marked by the checker')).toBeVisible();
  await expect(t.locator('.review-chat')).toContainText('What does the cell membrane do?');
  await t.getByRole('tab', { name: /Activity/ }).click();
  await expect(t.getByText('Paste attempt (blocked)')).toBeVisible();
  await expect(t.getByText('Copy attempt (blocked)')).toBeVisible();
  await expect(t.getByText(/It does not show that work was copied/)).toBeVisible();
  await t.getByRole('tab', { name: 'AI use' }).click();
  await expect(t.getByText('AI-suggested summary:')).toBeVisible();
  await expect(t.getByText('AI-suggested: level 3').first()).toBeVisible();
  expect(await axe(t, 'review')).toEqual([]);
  // The AI's levels are a starting point; the teacher changes one and saves their decision.
  await t.getByLabel('Your level for Seeks understanding').selectOption('4');
  await t.getByLabel('Comment for the student about their AI use').fill('Good question about the idea.');
  await t.getByRole('button', { name: 'Save my decision' }).click();
  await expect(t.getByText(/Decided/)).toBeVisible();
  const q2 = t.locator('li.card').filter({ has: t.getByLabel('Mark (out of 4)') });
  await q2.getByLabel('Mark (out of 4)').fill('3');
  await q2.getByLabel('Comment for the student', { exact: true }).fill('Clear and correct; say where each is found.');
  await q2.getByRole('button', { name: 'Save mark' }).click();
  await expect(q2.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await t.getByRole('button', { name: 'Submissions' }).click();
  await t.getByRole('button', { name: 'Release marked results' }).click();
  await expect(t.getByText('Released to 1 student.')).toBeVisible();

  // ── The student sees the teacher's decision, not the AI's. ──
  await s.getByRole('button', { name: 'Back to the class' }).click();
  await s.getByRole('button', { name: /See results \(4 \/ 5\)/ }).click();
  await expect(s.getByText('Clear and correct; say where each is found.')).toBeVisible();
  await expect(s.getByText('Seeks understanding: level 4')).toBeVisible();
  await expect(s.getByText('Good question about the idea.')).toBeVisible();
  await expect(s.getByText(/Asked about the idea, not the answer/)).toHaveCount(0);
  expect(await axe(s, 'results')).toEqual([]);

  // The server recorded the teacher opening the chat.
  expect(k.srv.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'submission.viewed'`)!.n).toBeGreaterThan(0);
  await teacherCtx.close();
  await studentCtx.close();
});
