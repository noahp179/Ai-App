import { expect, test, type Page } from '@playwright/test';
import { startMockProviders } from '../helpers/mockProviders';
import { close, launch, nav } from './launch';

async function invoke<T>(page: Page, method: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    async ({ method, args }) => {
      const r = await window.fc.invoke(method, args);
      if (!r.ok) throw new Error(r.error.message);
      return r.value;
    },
    { method, args },
  ) as Promise<T>;
}

async function invokeError(page: Page, method: string, ...args: unknown[]): Promise<string | null> {
  return page.evaluate(
    async ({ method, args }) => {
      const r = await window.fc.invoke(method, args);
      return r.ok ? null : r.error.message;
    },
    { method, args },
  );
}

const studyNav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Student Learning sections' }).getByRole('button', { name, exact: true });
const go = (page: Page, path: string) => page.evaluate((p) => (location.hash = `#${p}`), path);

const G7 = 'on-elementary-mathematics-g7-math';
const SIMPLIFY = `${G7}:B1.4`;

interface Q {
  id: string;
  type: string;
  choices?: { id: string }[];
  blanks?: unknown[];
  left?: { id: string }[];
  right?: { id: string }[];
  items?: { id: string }[];
}

/** Some readable answer for any question type. Whether it is right does not matter to these tests. */
function anyResponse(q: Q): unknown {
  switch (q.type) {
    case 'multiple_choice':
      return { type: 'choice', choice: q.choices![0]!.id };
    case 'multiple_select':
      return { type: 'choices', choices: [q.choices![0]!.id] };
    case 'true_false':
      return { type: 'bool', value: true };
    case 'fill_blank':
      return { type: 'blanks', values: q.blanks!.map(() => '1') };
    case 'matching':
      return { type: 'pairs', pairs: Object.fromEntries(q.left!.map((l, i) => [l.id, q.right![i]!.id])) };
    case 'ordering':
      return { type: 'order', order: q.items!.map((i) => i.id) };
    case 'written':
      return { type: 'written', text: 'My answer in a few words.' };
    default:
      return { type: 'text', text: '1' };
  }
}

test('student learning offline: onboarding, official curriculum, resumable lesson, quiz, progress, review, plan, privacy', async () => {
  const l = await launch();
  let lessonId = '';
  let stepIndex = 0;
  try {
    const { page } = l;
    // Onboarding: name and grade only; everything else can be skipped.
    await nav(page, 'Student Learning').click();
    await expect(page.getByRole('heading', { name: 'Set up your learning profile' })).toBeVisible();
    await page.getByLabel('First name or nickname').fill('Ava');
    await page.getByLabel('Grade', { exact: true }).selectOption('7');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('group', { name: 'Courses' }).getByRole('button', { name: 'Mathematics, Grade 7', exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByText('Your learning stays on this computer')).toBeVisible();
    await page.getByRole('button', { name: 'Create profile' }).click();
    await expect(page.getByRole('heading', { name: 'Hi, Ava' })).toBeVisible();
    const me = await invoke<{ aiTutoring: boolean; parentSharing: { enabled: boolean }; courseIds: string[] }>(page, 'study.me');
    expect(me.aiTutoring).toBe(false);
    expect(me.parentSharing.enabled).toBe(false);
    expect(me.courseIds).toEqual([G7]);

    // Official expectation, quoted with its source, and an honest coverage page.
    await go(page, `/study/e/${encodeURIComponent(SIMPLIFY)}`);
    await expect(page.getByLabel('Official expectation B1.4')).toContainText('use equivalent fractions to simplify fractions');
    await expect(page.getByRole('button', { name: /Ministry page/ }).first()).toBeVisible();
    await studyNav(page, 'Coverage').click();
    await expect(page.getByRole('heading', { name: 'Curriculum coverage' })).toBeVisible();
    await expect(page.getByText('Courses only in Ministry PDFs')).toBeVisible();

    // An offline lesson: step forward, pause.
    await go(page, `/study/e/${encodeURIComponent(SIMPLIFY)}`);
    await page.getByRole('button', { name: 'Start lesson' }).click();
    await expect(page.getByRole('list', { name: 'Lesson steps' })).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    const open = await invoke<{ id: string; status: string; stepIndex: number }[]>(page, 'study.lessons', 'open');
    expect(open).toHaveLength(1);
    lessonId = open[0]!.id;
    stepIndex = open[0]!.stepIndex;
    expect(open[0]!.status).toBe('paused');
    expect(stepIndex).toBeGreaterThan(0);
  } finally {
    await close(l);
  }

  const again = await launch(l.dataDir);
  try {
    const { page } = again;
    // The paused lesson survives a restart at the same step and can be resumed.
    await nav(page, 'Student Learning').click();
    await page.getByRole('button', { name: /Ava/ }).click();
    await expect(page.getByRole('heading', { name: 'Hi, Ava' })).toBeVisible();
    await go(page, `/study/lesson/${lessonId}`);
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    expect((await invoke<{ stepIndex: number; status: string }>(page, 'study.lesson', lessonId)).stepIndex).toBe(stepIndex);

    // A practice quiz: questions have no answer keys in the renderer; every answer is checked and recorded.
    const quiz = await invoke<{ id: string; items: { id: string; question: Q & Record<string, unknown> }[] }>(page, 'study.createQuiz', { kind: 'practice', expectationIds: [SIMPLIFY], length: 3 });
    expect(quiz.items).toHaveLength(3);
    for (const it of quiz.items) {
      // Keys and worked solutions stay in the main process until the question is answered.
      expect(['', false, undefined]).toContain(it.question.answer);
      expect(it.question.solution).toEqual([]);
    }
    for (let i = 0; i < quiz.items.length; i++) {
      const cur = await invoke<{ items: { id: string; question: Q }[] }>(page, 'study.quiz', quiz.id);
      const item = cur.items[i]!;
      const r = await invoke<{ result: { correct: boolean | null } | null; answer: string | null }>(page, 'study.answerQuiz', quiz.id, item.id, anyResponse(item.question));
      expect(r.result).not.toBeNull();
      expect(typeof r.answer).toBe('string');
    }
    const done = await invoke<{ status: string }>(page, 'study.finishQuiz', quiz.id);
    expect(done.status).toBe('completed');
    const mastery = await invoke<{ expectationId: string; status: string; attempts: number }[]>(page, 'study.mastery');
    const rec = mastery.find((m) => m.expectationId === SIMPLIFY);
    expect(rec?.status).not.toBe('not_assessed');

    // Progress shows the status with an explanation of what it means and does not mean.
    await studyNav(page, 'Progress').click();
    await page.getByText('How these indicators work').click();
    await expect(page.getByText(/They are not Ontario achievement levels/)).toBeVisible();
    await expect(page.getByRole('table')).toContainText('B1.4');

    // A plan is only a proposal until approved; approval puts sessions on the calendar.
    const plan = await invoke<{ id: string; status: string; sessions: { eventId: string | null }[] }>(page, 'study.proposePlan', { kind: 'weekly', expectationIds: [SIMPLIFY] });
    expect(plan.status).toBe('proposed');
    expect(plan.sessions.length).toBeGreaterThan(0);
    expect(plan.sessions.every((s) => s.eventId === null)).toBe(true);
    const approved = await invoke<{ status: string; sessions: { eventId: string | null }[] }>(page, 'study.approvePlan', plan.id);
    expect(approved.status).toBe('approved');
    expect(approved.sessions.every((s) => s.eventId)).toBe(true);
    const ev = await invoke<{ category: string }>(page, 'calendar.get', approved.sessions[0]!.eventId);
    expect(ev.category).toBe('study');

    // Profiles are separate: a second student with a PIN sees none of Ava's work.
    await invoke(page, 'study.closeProfile');
    await invoke(page, 'study.createProfile', { displayName: 'Ben', grade: 9, onboarded: true }, '4321');
    expect(await invoke<unknown[]>(page, 'study.lessons', 'all')).toHaveLength(0);
    expect(await invoke<unknown[]>(page, 'study.mastery')).toHaveLength(0);
    expect(await invoke<unknown[]>(page, 'study.plans')).toHaveLength(0);
    await invoke(page, 'study.closeProfile');
    const profiles = await invoke<{ id: string; displayName: string }[]>(page, 'study.profiles');
    const ben = profiles.find((p) => p.displayName === 'Ben')!;
    expect(await invokeError(page, 'study.openProfile', ben.id, '0000')).toMatch(/PIN/);
    const ava = profiles.find((p) => p.displayName === 'Ava')!;
    await invoke(page, 'study.openProfile', ava.id, null);

    // Deleting learning records needs typed confirmation, then leaves the profile in place.
    expect(await invokeError(page, 'study.deleteMyLearningData', 'yes')).toBeTruthy();
    expect(await invoke<number>(page, 'study.deleteMyLearningData', 'DELETE')).toBeGreaterThan(0);
    expect(await invoke<unknown[]>(page, 'study.mastery')).toHaveLength(0);
    expect(await invoke<unknown[]>(page, 'study.lessons', 'all')).toHaveLength(0);
    expect((await invoke<{ displayName: string }>(page, 'study.me')).displayName).toBe('Ava');

    // Without an AI provider, AI features say so instead of pretending.
    const ai = await invoke<{ available: boolean; reason: string | null }>(page, 'study.aiStatus');
    expect(ai.available).toBe(false);
    expect(ai.reason).toBeTruthy();
    await go(page, '/study');
    await studyNav(page, 'AI tutor').click();
    await expect(page.getByText('The AI tutor is off')).toBeVisible();
  } finally {
    await close(again);
  }
});

test('student learning with a (mock) AI provider: consent first, the name is never sent, invalid AI output is not shown as a lesson', async () => {
  const mock = await startMockProviders();
  const l = await launch();
  try {
    const { page } = l;
    await nav(page, 'AI Workspace').click();
    await page.getByRole('button', { name: /OpenAI-compatible/ }).click();
    await page.getByLabel('Address').fill(`${mock.base}/openai/v1`);
    await page.getByRole('button', { name: 'Connect and test' }).click();
    await expect(page.getByText(/connected$/)).toBeVisible();

    await nav(page, 'Student Learning').click();
    await invoke(page, 'study.createProfile', { displayName: 'Zephyrine', grade: 7, courseIds: [G7], onboarded: true }, null);
    await page.reload();
    await page.waitForSelector('.shell');
    await go(page, '/study/settings');

    // AI is off until the student agrees, after seeing what is sent.
    expect((await invoke<{ available: boolean }>(page, 'study.aiStatus')).available).toBe(false);
    await page.getByRole('switch', { name: /Use the AI tutor and AI-written lessons/ }).click();
    await expect(page.getByRole('dialog', { name: 'Turn on AI tutoring?' })).toContainText('Your name, PIN');
    await page.getByRole('button', { name: 'Turn on' }).click();
    await expect.poll(async () => (await invoke<{ aiTutoring: boolean }>(page, 'study.me')).aiTutoring).toBe(true);
    // A provider without a default model is reported, not treated as ready.
    const [prov] = await invoke<{ id: string; defaultModel: string | null }[]>(page, 'ai.providers');
    if (!prov!.defaultModel) {
      expect((await invoke<{ available: boolean; reason: string | null }>(page, 'study.aiStatus')).reason).toMatch(/default model/);
      await invoke(page, 'ai.updateProvider', prov!.id, { defaultModel: 'gpt-test' });
    }
    await expect.poll(async () => (await invoke<{ available: boolean }>(page, 'study.aiStatus')).available).toBe(true);

    // The tutor streams an answer; the request carries the grade but never the student's name.
    await studyNav(page, 'AI tutor').click();
    await page.getByRole('button', { name: 'New session' }).click();
    await page.getByLabel('Message to the tutor').fill('How do I simplify 6/8?');
    await page.getByLabel('Message to the tutor').press('Enter');
    await expect
      .poll(async () => {
        const [sess] = await invoke<{ id: string }[]>(page, 'study.tutorSessions');
        const msgs = await invoke<{ role: string; status: string; content: string; error: string | null }[]>(page, 'study.tutorMessages', sess!.id);
        const t = msgs.find((m) => m.role === 'tutor');
        return t ? `${t.status}: ${t.content}${t.error ?? ''}` : 'none';
      })
      .toBe('complete: Hello, world');
    await expect(page.locator('.tutor-msg.tutor').getByText('Hello, world')).toBeVisible();
    const chats = mock.log.filter((r) => r.path.endsWith('/chat/completions'));
    expect(chats.length).toBeGreaterThan(0);
    const sent = JSON.stringify(chats.map((c) => c.body));
    expect(sent).toContain('How do I simplify 6/8?');
    expect(sent).toContain('Grade 7');
    expect(sent).not.toContain('Zephyrine');

    // The mock does not return a valid lesson; the app reports that instead of inventing one.
    const err = await invokeError(page, 'study.startLesson', { expectationId: `${G7}:B1.1`, mode: 'learn', source: 'ai' });
    expect(err).toBeTruthy();
    expect(await invoke<unknown[]>(page, 'study.lessons', 'all')).toHaveLength(0);
  } finally {
    await close(l);
    await mock.close();
  }
});
