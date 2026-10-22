import { randomUUID } from 'node:crypto';
import type { Db } from '../src/core/db/database';

/**
 * Optional sample content for trying the marketplace. Every item is flagged demo = 1, credited to an
 * obviously fictional sample creator, and shown with a "Demo" label in the app. No reviews or sales are invented.
 */
export function seedDemo(db: Db, nowIso: string): number {
  if (db.get('SELECT 1 FROM creators WHERE demo = 1')) return 0;
  const creator = randomUUID();
  db.run('INSERT INTO creators (id, account_id, display_name, bio, website, demo) VALUES (?, NULL, ?, ?, ?, 1)', [
    creator,
    'Sample creator (demo data)',
    'A fictional creator used to show how the marketplace works. Not a real person or business.',
    '',
  ]);
  const items: [string, string, string, string, string, { type: 'free' } | { type: 'paid'; priceCents: number; currency: 'USD' }, boolean][] = [
    ['Demo: Lesson plan outline', 'study', 'A structured outline for a single lesson on any topic.', 'Outline a lesson on a topic you choose…', 'Create a lesson plan outline for teaching {{topic}} to {{audience:secondary-school students}} in {{minutes:45}} minutes. Include learning objectives, a warm-up, the main activity, a check for understanding and a short homework idea.', { type: 'free' }, false],
    ['Demo: Weekly review', 'productivity', 'A guided weekly review of what went well and what to change.', 'Reflect on your week with a few focused questions…', 'Guide me through a weekly review. Ask me, one at a time: what I finished, what is still open, what drained my energy, what I want to focus on next week, and one thing to stop doing. Then summarise my answers as a short plan.', { type: 'free' }, false],
    ['Demo: Grant proposal reviewer', 'business', 'Paid sample listing used to demonstrate trials. Payments are not enabled on the reference server.', 'Get structured feedback on a grant proposal draft…', 'Review the grant proposal below as an experienced reviewer would. Score clarity, feasibility, impact and budget justification from 1 to 5 with reasons, list the three biggest weaknesses with suggested fixes, and note anything a funder would likely ask about.\n\n"""\n{{proposal}}\n"""', { type: 'paid', priceCents: 499, currency: 'USD' }, true],
  ];
  db.tx(() => {
    for (const [title, category, summary, preview, body, pricing, trial] of items) {
      const id = randomUUID();
      db.run(
        `INSERT INTO listings (id, creator_id, title, summary, preview, body, category, tags, providers, pricing, trial_eligible, version, status, demo, created_at, updated_at, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '["demo"]', '["any"]', ?, ?, '1.0.0', 'published', 1, ?, ?, ?)`,
        [id, creator, title, summary, preview, body, category, JSON.stringify(pricing), trial ? 1 : 0, nowIso, nowIso, nowIso],
      );
      db.run('INSERT INTO listing_versions (id, listing_id, version, body, changelog, created_at) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), id, '1.0.0', body, 'Sample data', nowIso]);
    }
  });
  return items.length;
}
