import { describe, expect, it } from 'vitest';
import { parseFeed } from '../../src/core/feed/parser';
import { DEFAULT_SOURCES } from '../../src/core/feed/sources';

/** Fetches and parses every built-in source. Run with FC_LIVE_FEEDS=1. */
describe.skipIf(!process.env.FC_LIVE_FEEDS)('live: built-in news sources', () => {
  it.each(DEFAULT_SOURCES.map((s) => [s.name, s.url] as const))('%s parses with items', async (_name, url) => {
    const res = await fetch(url, { headers: { 'User-Agent': 'FlowCompanion/0.1 (+https://github.com/noahp179/Ai-App)' } });
    expect(res.status).toBe(200);
    const feed = parseFeed(await res.text(), url, { previewLength: 220, maxItems: 60 });
    expect(feed.items.length).toBeGreaterThan(0);
    for (const it of feed.items.slice(0, 5)) {
      expect(it.url).toMatch(/^https?:\/\//);
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.summary).not.toMatch(/<[a-z][^>]*>/i);
    }
  }, 30_000);
});
