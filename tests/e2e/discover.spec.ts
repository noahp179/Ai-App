import { expect, test } from '@playwright/test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { close, launch, nav } from './launch';

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Local Test Feed</title><link>http://127.0.0.1/</link>
<item><title>Lighthouse keepers return to Skerryvore</title><link>http://127.0.0.1/a</link><guid>a</guid><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;A short preview &lt;script&gt;alert(1)&lt;/script&gt;of the story.&lt;/p&gt;</description></item>
<item><title>Second local headline</title><link>http://127.0.0.1/b</link><guid>b</guid><pubDate>Wed, 21 Oct 2026 09:00:00 GMT</pubDate></item>
</channel></rss>`;

test('news: add a feed, search it, save an item', async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/rss+xml' });
    res.end(RSS);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  const l = await launch();
  try {
    const { page } = l;
    await nav(page, 'News').click();
    await page.getByRole('tab', { name: 'Sources' }).click();
    await page.getByLabel('Feed address').fill(`http://127.0.0.1:${port}/feed.xml`);
    await page.getByLabel('Feed name').fill('Local Test Feed');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText(/Added Local Test Feed \(2 items\)/)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('tab', { name: 'Headlines' }).click();
    await page.getByLabel('Search headlines').fill('Skerryvore');
    const article = page.getByRole('article').filter({ hasText: 'Lighthouse keepers' });
    await expect(article).toBeVisible();
    await expect(article).toContainText('Local Test Feed');
    await expect(article).not.toContainText('alert(1)');
    await article.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('tab', { name: 'Saved' }).click();
    await expect(page.getByRole('article').filter({ hasText: 'Lighthouse keepers' })).toBeVisible();
  } finally {
    await close(l);
    server.close();
  }
});

test('games: trivia round records a score; sudoku progress survives a restart', async () => {
  const l = await launch();
  let filled = '';
  try {
    const { page } = l;
    await nav(page, 'Games').click();
    await expect(page.getByRole('button', { name: /^Word guess/ })).toBeVisible();
    await page.getByRole('button', { name: /^AI trivia/ }).click();
    for (let i = 0; i < 10; i++) {
      await expect(page.getByText(`Question ${i + 1} of 10`, { exact: true })).toBeVisible();
      await page.keyboard.press('1');
      await page.getByRole('button', { name: i === 9 ? 'See results' : 'Next question' }).click();
    }
    await expect(page.getByRole('status')).toContainText('/ 10 correct');
    await page.getByRole('button', { name: 'All games' }).click();
    await expect(page.getByRole('button', { name: /^AI trivia/ })).toContainText('Played 1');

    await page.getByRole('button', { name: /^Sudoku/ }).click();
    const empty = page.getByRole('gridcell', { name: /: empty$/ }).first();
    const label = (await empty.getAttribute('aria-label'))!;
    const where = label.split(':')[0]!;
    await empty.click();
    await page.keyboard.press('5');
    filled = `${where}: 5`;
    await expect(page.getByRole('gridcell', { name: new RegExp(`^${filled}`) })).toBeVisible();
    await page.waitForTimeout(800); // state is saved shortly after each move
  } finally {
    await close(l);
  }
  const again = await launch(l.dataDir);
  try {
    const { page } = again;
    await nav(page, 'Games').click();
    await page.getByRole('button', { name: /^Sudoku/ }).click();
    await expect(page.getByRole('gridcell', { name: new RegExp(`^${filled}`) })).toBeVisible();
  } finally {
    await close(again);
  }
});

test('games: word guess, memory and reaction time are playable with keyboard and mouse', async () => {
  const l = await launch();
  try {
    const { page } = l;
    await nav(page, 'Games').click();

    await page.getByRole('button', { name: /^Word guess/ }).click();
    await page.keyboard.type('crane');
    await page.keyboard.press('Enter');
    // Either feedback for each letter, or (1 in 771) solved on the first try.
    await expect(page.getByRole('grid', { name: 'Guesses' }).getByRole('gridcell', { name: /^C, / }).first()).toBeVisible();
    if (!(await page.getByText(/Solved in 1/).isVisible())) {
      await page.keyboard.type('qzxv');
      await page.keyboard.press('Enter');
      await expect(page.getByText('Use five letters.')).toBeVisible();
    }
    await page.getByRole('button', { name: 'All games' }).click();

    await page.getByRole('button', { name: /^Memory match/ }).click();
    const cards = page.getByRole('grid', { name: 'Cards' }).getByRole('gridcell');
    await expect(cards).toHaveCount(16);
    await cards.nth(0).click();
    await cards.nth(1).click();
    await expect(page.getByText(/^Moves 1 ·/)).toBeVisible();
    await page.getByRole('button', { name: 'All games' }).click();

    await page.getByRole('button', { name: /^Reaction time/ }).click();
    const panel = page.getByRole('button', { name: /Click or press Space to start/ });
    await panel.click();
    await expect(page.getByRole('button', { name: /Wait for green/ })).toBeVisible();
    await page.getByRole('button', { name: /Wait for green/ }).click();
    await expect(page.getByRole('button', { name: /Too soon/ })).toBeVisible();
  } finally {
    await close(l);
  }
});
