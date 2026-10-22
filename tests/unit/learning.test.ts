import { describe, expect, it } from 'vitest';
import catalogJson from '../../src/shared/learning/catalog.json';
import linkCheck from '../../src/shared/learning/link-check.json';
import { loadCatalog } from '../../src/shared/learning';
import { LearningService } from '../../src/core/learning';
import { LinksService } from '../../src/core/links';
import { SettingsSchema, type Settings } from '../../src/shared/settings';
import { FakeClock, memoryDb } from '../helpers/db';

function setup(patch: (s: Settings) => void = () => {}) {
  const db = memoryDb();
  const clock = new FakeClock('2026-10-20T10:00:00Z');
  const settings = SettingsSchema.parse({});
  patch(settings);
  return { db, clock, settings, svc: new LearningService(db, clock, () => settings) };
}

describe('learning catalog', () => {
  const c = loadCatalog();

  it('has unique ids, https links and valid path steps', () => {
    expect(c.resources.length).toBeGreaterThanOrEqual(60);
    expect(new Set(c.resources.map((r) => r.id)).size).toBe(c.resources.length);
    for (const r of c.resources) expect(r.url.startsWith('https://')).toBe(true);
    const ids = new Set(c.resources.map((r) => r.id));
    for (const p of c.paths) for (const s of p.steps) expect(ids.has(s.resourceId)).toBe(true);
  });

  it('covers every required learning path', () => {
    const want = ['ai-fundamentals', 'prompt-engineering', 'students', 'writing-research', 'small-business', 'programming', 'generative-ai', 'responsible-ai', 'machine-learning'];
    expect(c.paths.map((p) => p.id).sort()).toEqual([...want].sort());
  });

  it('never claims ratings or durations', () => {
    const text = JSON.stringify({ resources: catalogJson.resources, paths: catalogJson.paths });
    for (const banned of [/\bratings?\b/i, /\bstars?\b/i, /\bduration\b/i, /\b\d+\s*(minutes?|mins?|hours?|hrs?|weeks?|days?)\b/i]) expect(text).not.toMatch(banned);
  });

  it('every bundled link passed the last link check', () => {
    expect(linkCheck.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const failing = c.resources.filter((r) => !r.linkCheck?.ok).map((r) => r.id);
    expect(failing).toEqual([]);
  });

  it('rejects a path that points at a missing resource', () => {
    const broken = { ...catalogJson, paths: [{ id: 'x', title: 'X', audience: 'a', description: 'd', steps: [{ resourceId: 'nope', why: 'w' }, { resourceId: 'nope', why: 'w' }, { resourceId: 'nope', why: 'w' }] }] };
    expect(() => loadCatalog(broken, linkCheck)).toThrow(/unknown resource/);
  });

  it('treats a missing link-check file as unverified, not verified', () => {
    const r = loadCatalog(catalogJson, null);
    expect(r.checkedOn).toBeNull();
    expect(r.resources.every((x) => x.linkCheck === null)).toBe(true);
  });
});

describe('LearningService', () => {
  it('filters and searches, ranking title matches first', () => {
    const { svc } = setup();
    expect(svc.resources({ topic: 'prompting' }).every((r) => r.topics.includes('prompting'))).toBe(true);
    expect(svc.resources({ level: 'advanced' }).every((r) => r.level === 'advanced')).toBe(true);
    expect(svc.resources({ registration: 'none' }).every((r) => r.registration === 'none')).toBe(true);
    const hits = svc.resources({ search: 'transformer' });
    expect(hits[0]!.title.toLowerCase()).toContain('transformer');
    expect(svc.resources({ search: 'zzzz-no-such-thing' })).toEqual([]);
  });

  it('tracks saved state, status timestamps and notes', () => {
    const { svc, clock } = setup();
    svc.setSaved('elements-of-ai', true);
    let p = svc.setStatus('elements-of-ai', 'in_progress');
    expect(p.startedAt).toBe('2026-10-20T10:00:00.000Z');
    expect(p.saved).toBe(true);
    clock.advance(60_000);
    p = svc.setStatus('elements-of-ai', 'completed');
    expect(p.startedAt).toBe('2026-10-20T10:00:00.000Z');
    expect(p.completedAt).toBe('2026-10-20T10:01:00.000Z');
    svc.setNotes('elements-of-ai', 'Search problems and Bayes rule');
    expect(svc.get('elements-of-ai').progress?.notes).toContain('Bayes');
    expect(svc.resources({ search: 'bayes' }).map((r) => r.id)).toEqual(['elements-of-ai']);
    expect(svc.resources({ savedOnly: true }).map((r) => r.id)).toEqual(['elements-of-ai']);
    p = svc.setStatus('elements-of-ai', 'not_started');
    expect(p.startedAt).toBeNull();
    expect(p.completedAt).toBeNull();
  });

  it('opening a resource records the time but never changes progress', () => {
    const { svc } = setup();
    const p = svc.markOpened('d2l');
    expect(p.lastOpenedAt).toBe('2026-10-20T10:00:00.000Z');
    expect(p.status).toBe('not_started');
  });

  it('rejects unknown resources, bad statuses and oversized notes', () => {
    const { svc } = setup();
    expect(() => svc.setSaved('nope', true)).toThrow(/not found|no longer exists|That resource/i);
    expect(() => svc.setStatus('d2l', 'done' as never)).toThrow(/Unknown status/);
    expect(() => svc.setNotes('d2l', 'x'.repeat(20_001))).toThrow(/too long/);
  });

  it('computes path progress and the next step', () => {
    const { svc } = setup();
    const before = svc.path('ai-fundamentals');
    expect(before.completed).toBe(0);
    expect(before.nextResourceId).toBe(before.steps[0]!.resourceId);
    svc.setStatus(before.steps[0]!.resourceId, 'completed');
    const after = svc.path('ai-fundamentals');
    expect(after.completed).toBe(1);
    expect(after.started).toBe(true);
    expect(after.nextResourceId).toBe(before.steps[1]!.resourceId);
    expect(after.resources[0]!.progress?.status).toBe('completed');
  });

  it('gives everyone the same starting points when personalization is off', () => {
    const { svc } = setup((s) => {
      s.privacy.personalization = false;
      s.learning.goals = ['machine-learning'];
    });
    const r = svc.recommendations();
    expect(r.personalized).toBe(false);
    expect(r.items.every((i) => i.pathId === 'ai-fundamentals' && i.reason === 'A good place to start')).toBe(true);
  });

  it('uses goals and level, but not activity unless allowed', () => {
    const { svc, settings } = setup((s) => {
      s.learning.goals = ['machine-learning'];
      s.learning.preferredLevel = 'beginner';
    });
    svc.setStatus('fastai-course', 'in_progress');
    let r = svc.recommendations();
    expect(r.personalized).toBe(true);
    expect(r.items.some((i) => i.reason === 'You started this')).toBe(false);
    const goal = r.items.find((i) => i.pathId === 'machine-learning')!;
    expect(goal.reason).toContain('Machine learning');
    expect(svc.get(goal.resourceId).level).toBe('beginner');

    settings.privacy.useActivityForPersonalization = true;
    r = svc.recommendations();
    expect(r.items[0]).toMatchObject({ resourceId: 'fastai-course', reason: 'You started this' });
  });

  it('exports and deletes learning data, including links to resources', () => {
    const { svc, db, clock } = setup();
    const links = new LinksService(db, clock, (id) => svc.title(id));
    svc.setNotes('cs50x', 'week 0 done');
    db.run("INSERT INTO notes (id, title, body, format, created_at, updated_at) VALUES ('n1', 'CS50', '', 'markdown', ?, ?)", [clock.now().toISOString(), clock.now().toISOString()]);
    links.link('note', 'n1', 'resource', 'cs50x');
    expect(links.linksFor('note', 'n1')[0]!.title).toBe('CS50x: Introduction to Computer Science');
    const ex = svc.exportData();
    expect(ex.format).toBe('flowcompanion.learning');
    expect(ex.progress).toEqual([expect.objectContaining({ resourceId: 'cs50x', notes: 'week 0 done', url: 'https://cs50.harvard.edu/x/' })]);
    expect(svc.deleteData()).toBe(1);
    expect(svc.get('cs50x').progress).toBeNull();
    expect(links.linksFor('note', 'n1')).toEqual([]);
  });

  it('provides global search hits', () => {
    const { svc } = setup();
    const hits = svc.search('prompt engineering', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.type === 'resource')).toBe(true);
    expect(svc.search('   ', 5)).toEqual([]);
  });
});
