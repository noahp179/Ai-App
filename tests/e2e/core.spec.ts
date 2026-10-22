import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

test('settings persist across restarts and apply immediately', async () => {
  const l = await launch();
  try {
    await nav(l.page, 'Settings').click();
    await l.page.getByRole('button', { name: 'Appearance' }).click();
    await l.page.getByLabel('Theme').selectOption('light');
    await expect(l.page.locator('html')).toHaveAttribute('data-theme', 'light');
    await l.page.getByLabel('Accent colour').selectOption('teal');
    await l.page.getByRole('button', { name: 'Modules' }).click();
    await l.page.getByRole('switch', { name: /Games/ }).uncheck();
    await expect(nav(l.page, 'Games')).toHaveCount(0);
  } finally {
    await close(l);
  }
  const again = await launch(l.dataDir);
  try {
    await expect(again.page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(again.page.locator('html')).toHaveAttribute('data-accent', 'teal');
    await expect(nav(again.page, 'Games')).toHaveCount(0);
  } finally {
    await close(again);
  }
});

test('notes: create, autosave, search, survive restart, trash and restore', async () => {
  const l = await launch();
  try {
    const { page } = l;
    await nav(page, 'Notes').click();
    await page.getByRole('button', { name: 'New note' }).first().click();
    await page.getByLabel('Title').fill('Trip to Lisbon');
    await page.getByLabel('Note body').fill('# Packing\n- passport\n- sunscreen');
    await expect(page.getByTestId('save-status')).toContainText('Saved', { timeout: 10_000 });
    await page.getByLabel('Search notes').fill('sunscr');
    await expect(page.getByRole('button', { name: /Trip to Lisbon/ })).toBeVisible();
  } finally {
    await close(l);
  }
  const again = await launch(l.dataDir);
  try {
    const { page } = again;
    await nav(page, 'Notes').click();
    await page.getByRole('button', { name: /Trip to Lisbon/ }).click();
    await expect(page.getByLabel('Note body')).toHaveValue('# Packing\n- passport\n- sunscreen');
    await page.getByRole('button', { name: 'Note actions' }).click();
    await page.getByRole('menuitem', { name: 'Move to trash' }).click();
    await expect(page.getByRole('button', { name: /Trip to Lisbon/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Trash' }).click();
    await page.getByRole('button', { name: /Trip to Lisbon/ }).click();
    await page.getByRole('button', { name: 'Restore' }).click();
    await page.getByRole('button', { name: 'All notes' }).click();
    await expect(page.getByRole('button', { name: /Trip to Lisbon/ })).toBeVisible();
  } finally {
    await close(again);
  }
});

test('notes: unsaved edits are recovered after the app is killed', async () => {
  const l = await launch();
  const { page } = l;
  await invoke(page, 'settings.update', { notes: { autosaveDelayMs: 5000 } });
  await nav(page, 'Notes').click();
  await page.getByRole('button', { name: 'New note' }).first().click();
  await page.getByLabel('Title').fill('Draft');
  await expect(page.getByTestId('save-status')).toContainText('Saved', { timeout: 10_000 });
  await page.getByLabel('Note body').fill('words that were never saved');
  await page.waitForTimeout(800); // draft written (250 ms), autosave not yet (5 s)
  l.app.process().kill('SIGKILL');
  await l.app.close().catch(() => {});

  const again = await launch(l.dataDir);
  try {
    await expect(again.page.getByText('Unsaved note edits were recovered')).toBeVisible();
    await again.page.getByRole('note').filter({ hasText: 'Unsaved note edits were recovered' }).getByRole('button', { name: 'Draft' }).click();
    await expect(again.page.getByText('Unsaved changes were recovered')).toBeVisible();
    await again.page.getByRole('button', { name: 'Restore my edits' }).click();
    await expect(again.page.getByLabel('Note body')).toHaveValue('words that were never saved');
  } finally {
    await close(again);
  }
});

test('notes export writes a Markdown file', async () => {
  const l = await launch();
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fc-exp-')), 'note.md');
  try {
    const { page, app } = l;
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath: file })) as typeof dialog.showSaveDialog;
    }, out);
    const note = await invoke<{ id: string }>(page, 'notes.create', { title: 'Export me', body: 'Body text', tags: ['x'] });
    const r = await invoke<{ saved: boolean }>(page, 'notes.exportNote', note.id, 'markdown');
    expect(r.saved).toBe(true);
    expect(fs.readFileSync(out, 'utf8')).toContain('# Export me\n\nBody text');
  } finally {
    await close(l);
  }
});

test('tasks and quick capture work and persist', async () => {
  const l = await launch();
  try {
    const { page } = l;
    await nav(page, 'Productivity').click();
    await page.getByLabel('New task').fill('Buy milk');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByLabel('Complete Buy milk').click();
    await expect(page.getByLabel('Complete Buy milk')).toHaveCount(0);
    await page.getByRole('button', { name: 'Quick capture' }).click();
    await page.getByLabel('Capture text').fill('t: call the plumber');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved as a task: call the plumber/)).toBeVisible();
  } finally {
    await close(l);
  }
  const again = await launch(l.dataDir);
  try {
    const tasks = await invoke<{ title: string; done: boolean }[]>(again.page, 'tasks.list', { listId: 'all', includeDone: true });
    expect(tasks.map((t) => [t.title, t.done]).sort()).toEqual([
      ['Buy milk', true],
      ['call the plumber', false],
    ]);
  } finally {
    await close(again);
  }
});

test('calendar: create an event in the UI and see it after a restart', async () => {
  const l = await launch();
  try {
    const { page } = l;
    await nav(page, 'Calendar').click();
    await page.getByRole('button', { name: 'New event' }).click();
    await page.getByLabel('Event title').fill('Dentist');
    await page.getByLabel('Repeat').selectOption('weekly');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Event created')).toBeVisible();
    await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Agenda' }).click();
    await expect(page.getByRole('button', { name: /Dentist/ }).first()).toBeVisible();
  } finally {
    await close(l);
  }
  const again = await launch(l.dataDir);
  try {
    await nav(again.page, 'Calendar').click();
    await again.page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Agenda' }).click();
    await expect(again.page.getByRole('button', { name: /Dentist/ })).toHaveCount(5);
  } finally {
    await close(again);
  }
});

test('reminders are delivered once and not repeated after a restart', async () => {
  const l = await launch();
  try {
    const { page } = l;
    await invoke(page, 'reminders.create', { title: 'Stretch', fireAt: new Date(Date.now() + 2500).toISOString() });
    await expect(page.getByRole('button', { name: /Notifications, 1 unread/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Notifications/ }).click();
    await expect(page.getByText('Stretch')).toBeVisible();
  } finally {
    await close(l);
  }
  const again = await launch(l.dataDir);
  try {
    await again.page.waitForTimeout(1500);
    const inbox = await invoke<{ title: string }[]>(again.page, 'inbox.list');
    expect(inbox.filter((n) => n.title.includes('Stretch'))).toHaveLength(1);
  } finally {
    await close(again);
  }
});

test('floating companion opens without stealing focus, collapses, and remembers its place', async () => {
  const l = await launch();
  try {
    const { app, page } = l;
    const companionPromise = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Companion' }).click();
    const companion = await companionPromise;
    await companion.waitForSelector('.companion, .launcher');
    await expect(companion.getByRole('button', { name: 'Collapse to launcher' })).toBeVisible();
    await companion.getByRole('button', { name: 'Collapse to launcher' }).click();
    await expect(companion.getByRole('toolbar', { name: 'FlowCompanion launcher' })).toBeVisible();
    const collapsed = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('#/companion'))!.getBounds());
    expect(collapsed.height).toBeLessThan(100);
    await companion.getByRole('button', { name: 'Expand' }).click();
    await expect(companion.getByRole('button', { name: 'Collapse to launcher' })).toBeVisible();
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes('#/companion'))!;
      w.setBounds({ x: 100, y: 120, width: 400, height: 500 });
    });
    await page.waitForTimeout(800);
    await companion.getByLabel('Capture').fill('from the companion');
    await companion.getByRole('button', { name: 'Save' }).click();
    await expect(companion.getByText('Saved as note')).toBeVisible();
  } finally {
    await close(l);
  }
  const again = await launch(l.dataDir);
  try {
    const p = again.app.waitForEvent('window');
    await invoke(again.page, 'window.toggleCompanion');
    const companion = await p;
    await companion.waitForSelector('.companion');
    const b = await again.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('#/companion'))!.getBounds());
    expect(b).toMatchObject({ width: 400, height: 500 });
  } finally {
    await close(again);
  }
});
