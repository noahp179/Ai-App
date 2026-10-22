import { expect, test, type Page } from '@playwright/test';
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

function storedNotes(page: Page, id: string): Promise<string> {
  return invoke<{ progress: { notes: string } | null }>(page, 'learning.resource', id).then((r) => r.progress?.notes ?? '');
}

test('learning hub: browse, track progress, take notes, schedule study time, survive restart', async () => {
  const l = await launch();
  try {
    const { page } = l;
    await nav(page, 'Learning Hub').click();
    await expect(page.getByText(/\d+ of \d+ links verified on \d{4}-\d{2}-\d{2}/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Good places to start' }).or(page.getByRole('heading', { name: 'Suggested for you' }))).toBeVisible();

    await page.getByRole('tab', { name: 'Library' }).click();
    await page.getByLabel('Search learning resources').fill('illustrated transformer');
    const card = page.getByRole('article', { name: 'The Illustrated Transformer' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'The Illustrated Transformer', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'The Illustrated Transformer' })).toBeVisible();
    await expect(page.getByText(/Link checked on \d{4}-\d{2}-\d{2}/)).toBeVisible();
    await page.getByRole('radio', { name: 'In progress' }).or(page.getByRole('button', { name: 'In progress', exact: true })).first().click();
    await page.getByLabel('Your notes on this resource').fill('Self-attention compares every token with every other token.');
    // The status starts out as "Saved", so wait for the note to actually be stored.
    await expect.poll(() => storedNotes(page, 'illustrated-transformer'), { timeout: 10_000 }).toContain('Self-attention');
    await expect(page.getByTestId('learning-notes-status')).toHaveText('Saved');

    await page.getByRole('button', { name: 'Schedule study time' }).click();
    const dialog = page.getByRole('dialog', { name: 'Schedule study time' });
    await dialog.getByLabel('Date').fill('2026-12-01');
    await dialog.getByLabel('Time').fill('18:30');
    await dialog.getByRole('button', { name: 'Add to calendar' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Study: The Illustrated Transformer')).toBeVisible();

    const events = await invoke<{ title: string; category: string }[]>(page, 'calendar.occurrences', '2026-12-01T00:00:00Z', '2026-12-03T00:00:00Z');
    expect(events).toEqual([expect.objectContaining({ title: 'Study: The Illustrated Transformer', category: 'study' })]);

    const hits = await invoke<{ type: string; id: string }[]>(page, 'search.query', 'illustrated transformer');
    expect(hits.some((h) => h.type === 'resource' && h.id === 'illustrated-transformer')).toBe(true);
  } finally {
    await close(l);
  }

  const again = await launch(l.dataDir);
  try {
    const { page } = again;
    await nav(page, 'Learning Hub').click();
    await expect(page.getByRole('region', { name: 'Continue learning' }).getByRole('article', { name: 'The Illustrated Transformer' })).toBeVisible();
    await page.getByRole('tab', { name: 'My learning' }).click();
    await page.getByRole('tab', { name: 'In progress' }).click();
    await page.getByRole('article', { name: 'The Illustrated Transformer' }).getByRole('button', { name: 'The Illustrated Transformer', exact: true }).click();
    await expect(page.getByLabel('Your notes on this resource')).toHaveValue(/Self-attention/);
  } finally {
    await close(again);
  }
});

test('learning notes typed just before quitting are kept', async () => {
  const l = await launch();
  try {
    const { page } = l;
    await nav(page, 'Learning Hub').click();
    await page.getByRole('tab', { name: 'Library' }).click();
    await page.getByLabel('Search learning resources').fill('illustrated transformer');
    await page.getByRole('article', { name: 'The Illustrated Transformer' }).getByRole('button', { name: 'The Illustrated Transformer', exact: true }).click();
    await page.getByLabel('Your notes on this resource').fill('Written a moment before closing.');
    // Quit immediately, inside the autosave delay.
  } finally {
    await close(l);
  }
  const again = await launch(l.dataDir);
  try {
    expect(await storedNotes(again.page, 'illustrated-transformer')).toBe('Written a moment before closing.');
  } finally {
    await close(again);
  }
});

test('learning paths show progress and learning goals change suggestions', async () => {
  const l = await launch();
  try {
    const { page } = l;
    await nav(page, 'Learning Hub').click();
    await page.getByRole('tab', { name: 'Paths' }).click();
    for (const name of ['AI fundamentals', 'Prompt engineering', 'AI for students', 'Writing and research with AI', 'AI for small businesses', 'Programming for AI', 'Generative AI', 'Responsible AI', 'Machine learning']) {
      await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
    }
    await page.getByRole('button', { name: /^Responsible AI/ }).click();
    await expect(page.getByText('0 of 8 steps completed').first()).toBeVisible();

    await nav(page, 'Settings').click();
    await page.getByRole('button', { name: 'Learning', exact: true }).click();
    await page.getByRole('group', { name: 'Learning goals' }).getByRole('button', { name: 'Responsible AI' }).click();
    await nav(page, 'Learning Hub').click();
    await page.getByRole('tab', { name: 'For you' }).click();
    await expect(page.getByRole('heading', { name: 'Suggested for you' })).toBeVisible();
    await expect(page.getByText('Matches your goal “Responsible AI”')).toBeVisible();
  } finally {
    await close(l);
  }
});
