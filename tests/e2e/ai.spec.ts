import { expect, test } from '@playwright/test';
import { startMockProviders } from '../helpers/mockProviders';
import { close, launch } from './launch';

test('AI workspace shows an honest setup screen, then chats through a connected provider', async () => {
  const mock = await startMockProviders();
  const l = await launch();
  try {
    const { page } = l;
    await page.getByRole('button', { name: 'AI Workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Connect an AI provider' })).toBeVisible();
    await expect(page.getByText('it never makes up responses')).toBeVisible();

    await page.getByRole('button', { name: /OpenAI-compatible/ }).click();
    await page.getByLabel('Address').fill(`${mock.base}/openai/v1`);
    await page.getByRole('button', { name: 'Connect and test' }).click();
    await expect(page.getByText(/connected$/)).toBeVisible();
    // Once a provider works, the workspace switches from setup to chat.
    await page.getByRole('button', { name: 'New conversation' }).first().click();
    await page.getByLabel('Model').selectOption('gpt-test');
    await page.getByLabel('Message').fill('Hello there');
    await page.getByLabel('Message').press('Enter');
    await expect(page.getByLabel('Assistant message').getByText('Hello, world')).toBeVisible();
    await expect(page.getByText(/Sent to OpenAI-compatible/)).toBeVisible();

    // The conversation is searchable and survives a restart.
    await close(l);
    const again = await launch(l.dataDir);
    try {
      await again.page.getByRole('button', { name: 'AI Workspace' }).click();
      await again.page.getByLabel('Search conversations').fill('hello');
      await expect(again.page.getByRole('button', { name: /Hello there/ })).toBeVisible();
      await again.page.getByRole('button', { name: /Hello there/ }).click();
      await expect(again.page.getByLabel('Assistant message').getByText('Hello, world')).toBeVisible();
    } finally {
      await close(again);
    }
  } finally {
    await close(l);
    await mock.close();
  }
});

test('provider errors are shown with guidance and can be retried on another model', async () => {
  const mock = await startMockProviders();
  const l = await launch();
  try {
    const { page } = l;
    await page.getByRole('button', { name: 'AI Workspace' }).click();
    await page.getByRole('button', { name: /OpenAI-compatible/ }).click();
    await page.getByLabel('Address').fill(`${mock.base}/openai/v1`);
    await page.getByRole('button', { name: 'Connect and test' }).click();
    await page.getByRole('button', { name: 'New conversation' }).first().click();
    await page.getByLabel('Model').selectOption('text-embedding-3-small');
    await page.getByLabel('Message').fill('Hello');
    await page.getByLabel('Message').press('Enter');
    const assistant = page.getByLabel('Assistant message');
    await expect(assistant.getByRole('alert')).toContainText('could not find that model');
    await expect(assistant.getByText('Pick a different model from the selector above.')).toBeVisible();
    await page.getByLabel('Model').selectOption('gpt-test');
    await assistant.getByRole('button', { name: 'Retry' }).click();
    await expect(assistant.getByText('Hello, world')).toBeVisible();
    await expect(assistant.getByRole('alert')).toHaveCount(0);
  } finally {
    await close(l);
    await mock.close();
  }
});

const live = process.env.FC_LIVE_OPENAI_COMPAT_URL;
test('live: a real local model answers through the FlowCompanion UI', async () => {
  test.skip(!live, 'Set FC_LIVE_OPENAI_COMPAT_URL to a running OpenAI-compatible server');
  const l = await launch();
  try {
    const { page } = l;
    await page.getByRole('button', { name: 'AI Workspace' }).click();
    await page.getByRole('button', { name: /OpenAI-compatible/ }).click();
    await page.getByLabel('Address').fill(live!);
    await page.getByRole('button', { name: 'Connect and test' }).click();
    await expect(page.getByText(/connected$/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'New conversation' }).first().click();
    const model = page.getByLabel('Model');
    await model.selectOption({ index: 1 }).catch(() => undefined);
    await page.getByLabel('Message').fill('Reply with exactly one word: what is the capital of France?');
    await page.getByLabel('Message').press('Enter');
    const answer = page.getByLabel('Assistant message').last();
    await expect(answer).toContainText(/paris/i, { timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0, { timeout: 60_000 });
    await page.screenshot({ path: 'test-results/live-local-model.png' });
  } finally {
    await close(l);
  }
});
