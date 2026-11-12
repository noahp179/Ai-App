import { expect, test, type Page } from '@playwright/test';
import { seedClass, startClassroom, type TestClassroom } from '../helpers/classroom';
import { close, launch, nav, type Launched } from './launch';

/**
 * The Classroom section of the desktop app against a classroom server running in this process (scripted AI).
 * The same screens as the browser build; here requests, streaming and the session token go through the main process.
 */
let k: TestClassroom;
let l: Launched;

async function invoke(page: Page, method: string, ...args: unknown[]) {
  return page.evaluate(async ({ method, args }) => window.fc.invoke(method, args), { method, args });
}

test.beforeAll(async () => {
  k = await startClassroom();
  k.ai.onChat = () => ({ text: 'Mitochondria release energy the cell can use.' });
});
test.afterAll(async () => {
  if (l) await close(l);
  await k?.close();
});

test('a student connects, takes an assessment with the assistant, and the app refuses to copy while it is open', async () => {
  const s = await seedClass(k, { evaluateAiUse: false });
  l = await launch();
  const { page } = l;
  await nav(page, 'Classroom').click();

  // Only http on this computer or a local network; otherwise https.
  await page.getByLabel('Classroom server address').fill('http://example.com');
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByText(/Use an https:\/\/ address/)).toBeVisible();
  await page.getByLabel('Classroom server address').fill(k.base);
  await page.getByRole('button', { name: 'Connect' }).click();

  await page.getByRole('tab', { name: 'Sign in' }).click();
  await page.getByLabel('Email or username').fill('ana.lee@school.test');
  await page.getByLabel('Password').fill('student-pass-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Ana Lee · Student · Maple Ridge Secondary')).toBeVisible();

  // The session token stays in the main process: the page only learns that it is signed in.
  const st = (await invoke(page, 'classroom.status')) as { ok: true; value: { url: string; signedIn: boolean } };
  expect(st.value).toEqual({ url: k.base, signedIn: true });
  const me = (await invoke(page, 'classroom.request', 'POST', '/sessions', { login: 'ana.lee@school.test', password: 'student-pass-1' })) as { ok: true; value: { token: string } };
  expect(me.value.token).toBe('');

  await page.getByRole('button', { name: /Grade 9 Science/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByLabel('I have read what is recorded during this assessment.').check();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'Cells quiz' })).toBeVisible();

  // Streaming through the main process.
  await page.getByLabel('Message to the assistant').fill('What do mitochondria do?');
  await page.getByRole('button', { name: 'Ask' }).click();
  await expect(page.locator('.chat-msg.assistant').last()).toContainText('Mitochondria release energy the cell can use.');
  expect(k.ai.chats.at(-1)!.turns.at(-1)!.text).toContain('What do mitochondria do?');

  // While the assessment is open the whole app refuses to copy, not just this page.
  const blocked = (await invoke(page, 'app.copyText', 'some text', 'general')) as { ok: true; value: { copied: boolean; reason: string } };
  expect(blocked.value).toEqual({ copied: false, reason: 'Copying is turned off while an assessment is open.' });
  await nav(page, 'Home').click();
  const after = (await invoke(page, 'app.copyText', 'some text', 'general')) as { ok: true; value: { copied: boolean } };
  expect(after.value.copied).toBe(true);

  // Continue later and submit.
  await nav(page, 'Classroom').click();
  await page.getByRole('button', { name: /Grade 9 Science/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'Cell membrane' }).check();
  await page.getByRole('button', { name: 'Submit' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Your answers were received')).toBeVisible();
  expect(k.srv.db.get<{ status: string }>('SELECT status FROM attempts')!.status).toBe('submitted');
  void s;
});
