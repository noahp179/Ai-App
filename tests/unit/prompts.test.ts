import { describe, expect, it } from 'vitest';
import { PromptsService } from '../../src/core/prompts';
import { fillVariables, parseVariables } from '../../src/shared/prompts';
import { FakeClock, memoryDb } from '../helpers/db';

function setup() {
  const db = memoryDb();
  const clock = new FakeClock('2026-10-20T10:00:00Z');
  return { db, clock, svc: new PromptsService(db, clock) };
}

describe('prompt variables', () => {
  it('finds distinct variables with defaults, case-insensitively', () => {
    expect(parseVariables('Explain {{topic}} at a {{level:beginner}} level. More on {{Topic}}. {{ tone : friendly }}')).toEqual([
      { name: 'topic', defaultValue: null, required: true },
      { name: 'level', defaultValue: 'beginner', required: false },
      { name: 'tone', defaultValue: 'friendly', required: false },
    ]);
    expect(parseVariables('No variables, just {braces} and {{ }} and {{1bad}}')).toEqual([]);
  });

  it('fills values, falls back to defaults and reports what is missing', () => {
    const body = 'Write about {{topic}} for {{audience:students}} in a {{tone}} tone. Again: {{topic}}.';
    expect(fillVariables(body, { topic: 'tides', tone: 'calm' })).toEqual({ text: 'Write about tides for students in a calm tone. Again: tides.', missing: [] });
    expect(fillVariables(body, { topic: 'tides', tone: '   ' })).toEqual({ text: 'Write about tides for students in a {{tone}} tone. Again: tides.', missing: ['tone'] });
  });

  it('does not treat replacement values as patterns', () => {
    expect(fillVariables('Say {{x}}', { x: '$& {{y}} $1' }).text).toBe('Say $& {{y}} $1');
  });
});

describe('PromptsService', () => {
  it('creates prompts with a first version and normalised fields', () => {
    const { svc } = setup();
    const p = svc.create({ title: '  Summarise  ', body: 'Summarise {{text}}', tags: ['#Reading', 'reading'], providers: ['anthropic', 'any'], category: 'Research' });
    expect(p).toMatchObject({ title: 'Summarise', version: 1, tags: ['reading'], providers: ['any'], category: 'research', origin: 'user' });
    expect(svc.versions(p.id)).toEqual([expect.objectContaining({ version: 1, note: 'Created' })]);
    expect(() => svc.create({ title: 'Empty', body: '   ' })).toThrow(/prompt text/);
    expect(svc.create({ body: 'A prompt with no title given' }).title).toBe('A prompt with no title given');
  });

  it('versions content changes only, and restores without losing history', () => {
    const { svc, clock } = setup();
    const p = svc.create({ title: 'Plan', body: 'v1 text' });
    clock.advance(1000);
    expect(svc.update(p.id, { tags: ['x'], favorite: true }).version).toBe(1);
    expect(svc.update(p.id, { body: 'v2 text' }, 'clearer').version).toBe(2);
    expect(svc.update(p.id, { title: 'Plan B' }).version).toBe(3);
    const restored = svc.restoreVersion(p.id, 1);
    expect(restored).toMatchObject({ version: 4, title: 'Plan', body: 'v1 text', favorite: true, tags: ['x'] });
    expect(svc.versions(p.id).map((v) => [v.version, v.note])).toEqual([
      [4, 'Restored from version 1'],
      [3, ''],
      [2, 'clearer'],
      [1, 'Created'],
    ]);
    expect(() => svc.restoreVersion(p.id, 99)).toThrow(/Version 99/);
  });

  it('lists with search, category, favourites, provider and sort', () => {
    const { svc, clock } = setup();
    const a = svc.create({ title: 'Alpha', body: 'about cats', category: 'writing', providers: ['openai'] });
    clock.advance(1000);
    const b = svc.create({ title: 'Beta', body: 'about dogs', category: 'study' });
    svc.setFavorite(a.id, true);
    svc.recordUse(b.id);
    svc.recordUse(b.id);
    expect(svc.list({ search: 'dogs' }).map((p) => p.id)).toEqual([b.id]);
    expect(svc.list({ category: 'writing' }).map((p) => p.id)).toEqual([a.id]);
    expect(svc.list({ favorite: true }).map((p) => p.id)).toEqual([a.id]);
    expect(svc.list({ provider: 'anthropic' }).map((p) => p.id)).toEqual([b.id]);
    expect(svc.list({ provider: 'openai' }).map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
    expect(svc.list({ search: '100%' })).toEqual([]);
    expect(svc.get(b.id)).toMatchObject({ useCount: 2, lastUsedAt: expect.any(String) });
    expect(svc.categories().find((c) => c.category === 'writing')?.count).toBe(1);
  });

  it('exports and re-imports, skipping duplicates and rejecting foreign files', () => {
    const { svc } = setup();
    svc.create({ title: 'One', body: 'first {{x}}', tags: ['t'] });
    svc.create({ title: 'Two', body: 'second' });
    const doc = JSON.parse(JSON.stringify(svc.exportDoc()));
    expect(doc.prompts).toHaveLength(2);
    expect(svc.importDoc(doc)).toEqual({ imported: 0, skipped: 2, errors: [] });
    const other = setup().svc;
    expect(other.importDoc(doc)).toEqual({ imported: 2, skipped: 0, errors: [] });
    expect(other.list({ sort: 'title' }).map((p) => p.title)).toEqual(['One', 'Two']);
    expect(other.importDoc({ format: 'something-else', prompts: [] }).errors[0]).toMatch(/not a FlowCompanion prompts file/);
  });

  it('deletes prompts with their versions and links', () => {
    const { svc, db } = setup();
    const p = svc.create({ title: 'Gone', body: 'soon' });
    db.run("INSERT INTO links (id, from_type, from_id, to_type, to_id, created_at) VALUES ('l1', 'prompt', ?, 'note', 'n1', 'x')", [p.id]);
    svc.delete(p.id);
    expect(db.get('SELECT 1 FROM prompt_versions WHERE prompt_id = ?', [p.id])).toBeUndefined();
    expect(db.get("SELECT 1 FROM links WHERE id = 'l1'")).toBeUndefined();
    expect(() => svc.get(p.id)).toThrow();
  });

  it('is found by global search through the full-text index', () => {
    const { svc, db } = setup();
    svc.create({ title: 'Lesson planner', description: 'for teachers', body: 'Plan a lesson about {{topic}}' });
    expect(db.all("SELECT title FROM search_index WHERE search_index MATCH 'teachers'")).toEqual([{ title: 'Lesson planner' }]);
  });
});
