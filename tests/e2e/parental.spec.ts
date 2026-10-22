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

const settingsNav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name, exact: true });

test('parental learning controls: off by default, explicit setup, indicators, copy limits, sessions, PIN, turn off', async () => {
  const l = await launch();
  try {
    const { page } = l;
    // PA: off by default.
    await expect(page.locator('.banner-strip.parental')).toHaveCount(0);
    expect(await invoke<{ copied: boolean }>(page, 'app.copyText', 'AI answer', 'ai')).toMatchObject({ copied: true });

    // PB: explicit setup with scope explanation, PIN and acknowledgement.
    await nav(page, 'Settings').click();
    await settingsNav(page, 'Parental Learning Controls').click();
    await expect(page.getByText('What they do not do')).toBeVisible();
    await expect(page.getByText(/no documented way for an app to keep its windows out of screenshots/).first()).toBeVisible();
    await expect(page.getByRole('switch', { name: /Screen-capture privacy/ })).toBeDisabled();
    const turnOn = page.getByRole('button', { name: 'Turn on parental learning controls' });
    await page.getByLabel('PIN or passphrase').fill('2468');
    await page.getByLabel('Repeat PIN').fill('2468');
    await expect(turnOn).toBeDisabled();
    await page.getByText('I am the parent or guardian setting this up openly').click();
    await turnOn.click();
    const code = await page.getByTestId('recovery-code').textContent();
    expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    await page.getByLabel('I have saved the recovery code.').check();
    await page.getByRole('button', { name: 'Done' }).click();

    // PC: visible indicator.
    await expect(page.locator('.banner-strip.parental')).toBeVisible();
    await expect(page.getByText('· copying limited in the AI workspace')).toBeVisible();

    // PD/PE: copying AI answers is refused; other content still copies.
    expect(await invoke<{ copied: boolean; reason: string }>(page, 'app.copyText', 'AI answer', 'ai')).toMatchObject({ copied: false, reason: expect.stringMatching(/turned off by Parental Learning Controls/) });
    expect(await invoke<{ copied: boolean }>(page, 'app.copyText', 'My note', 'notes')).toMatchObject({ copied: true });

    // PK: start a supervised session (wrong PIN first).
    await page.getByLabel('Goal (optional)').fill('Fractions homework');
    const chips = page.getByRole('group', { name: 'Session sections', exact: true });
    for (const name of ['AI Workspace', 'Calendar', 'Productivity', 'Notes']) {
      const chip = chips.getByRole('button', { name, exact: true });
      if ((await chip.getAttribute('aria-pressed')) === 'true') await chip.click();
    }
    await page.getByRole('button', { name: 'Start session' }).click();
    await page.getByLabel('Parent PIN').fill('0000');
    await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText(/Wrong PIN\. 4 attempts left/)).toBeVisible();
    await page.getByLabel('Parent PIN').fill('2468');
    await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText(/Study session: Fractions homework/)).toBeVisible();
    await nav(page, 'Games').click();
    await expect(page.getByRole('heading', { name: 'Games is paused during this study session' })).toBeVisible();
    await nav(page, 'Learning Hub').click();
    await expect(page.getByRole('tab', { name: 'Library' })).toBeVisible();
  } finally {
    await close(l);
  }

  // PM: survives a restart, still in session.
  const again = await launch(l.dataDir);
  try {
    const { page } = again;
    await expect(page.locator('.banner-strip.parental')).toBeVisible();
    await expect(page.getByText(/Study session: Fractions homework/)).toBeVisible();
    await nav(page, 'AI Workspace').click();
    await expect(page.getByRole('heading', { name: 'AI Workspace is paused during this study session' })).toBeVisible();

    // PL: end early with the PIN from the banner.
    await page.getByRole('button', { name: 'End session' }).first().click();
    await page.getByLabel('Parent PIN').fill('2468');
    await page.getByRole('dialog').getByRole('button', { name: 'End session' }).click();
    await expect(page.getByText(/Study session: Fractions homework/)).toHaveCount(0);
    await nav(page, 'Games').click();
    await expect(page.getByRole('button', { name: /^Word guess/ })).toBeVisible();

    // PI: turn off with the PIN removes the indicator and limits.
    await nav(page, 'Settings').click();
    await settingsNav(page, 'Parental Learning Controls').click();
    await page.getByRole('button', { name: 'Turn off parental learning controls' }).click();
    await page.getByLabel('Parent PIN').fill('2468');
    await page.getByRole('dialog').getByRole('button', { name: 'Turn off' }).click();
    await expect(page.locator('.banner-strip.parental')).toHaveCount(0);
    expect(await invoke<{ copied: boolean }>(page, 'app.copyText', 'AI answer', 'ai')).toMatchObject({ copied: true });
  } finally {
    await close(again);
  }
});
