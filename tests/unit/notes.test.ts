import { describe, expect, it } from 'vitest';
import { LinksService } from '../../src/core/links';
import { NotesService } from '../../src/core/notes';
import { TasksService } from '../../src/core/tasks';
import { FakeClock, memoryDb } from '../helpers/db';

function setup() {
  const db = memoryDb();
  const clock = new FakeClock();
  return { db, clock, notes: new NotesService(db, clock), tasks: new TasksService(db, clock, () => 'UTC') };
}

describe('notes', () => {
  it('creates, edits, renames and reads back a note', () => {
    const { notes, clock } = setup();
    const n = notes.create({ body: '# Groceries\n- milk' });
    expect(n.title).toBe('Groceries');
    expect(n.revision).toBe(1);
    clock.advanceMinutes(1);
    const u = notes.update(n.id, { body: '# Groceries\n- milk\n- eggs', tags: ['Home', '#errands', 'home'] });
    expect(u.revision).toBe(2);
    expect(u.tags).toEqual(['errands', 'home']);
    expect(u.updatedAt > n.updatedAt).toBe(true);
    expect(notes.update(n.id, { title: 'Shopping' }).title).toBe('Shopping');
  });

  it('refuses to overwrite a note changed elsewhere', () => {
    const { notes } = setup();
    const n = notes.create({ title: 'a', body: 'one' });
    notes.update(n.id, { body: 'two', expectedRevision: 1 });
    expect(() => notes.update(n.id, { body: 'stale', expectedRevision: 1 })).toThrow(/another window/);
    expect(notes.get(n.id).body).toBe('two');
  });

  it('does not bump the revision for pin/favorite changes', () => {
    const { notes } = setup();
    const n = notes.create({ title: 'a' });
    expect(notes.update(n.id, { pinned: true }).revision).toBe(1);
    expect(notes.list({ view: 'pinned' }).map((x) => x.id)).toEqual([n.id]);
  });

  it('searches with full-text prefix matching and filters by view, folder and tag', () => {
    const { notes } = setup();
    const f = notes.createFolder('Work');
    const a = notes.create({ title: 'Quarterly roadmap', body: 'Budget planning for Q3', folderId: f.id, tags: ['planning'] });
    notes.create({ title: 'Recipes', body: 'pancakes' });
    expect(notes.list({ search: 'budg' }).map((x) => x.id)).toEqual([a.id]);
    expect(notes.list({ search: 'roadmap planning' }).map((x) => x.id)).toEqual([a.id]);
    expect(notes.list({ folderId: f.id })).toHaveLength(1);
    expect(notes.list({ folderId: null })).toHaveLength(1);
    expect(notes.list({ tag: 'planning' })).toHaveLength(1);
    expect(notes.list({ search: '"; DROP TABLE notes; --' })).toEqual([]);
  });

  it('archives, trashes, restores and permanently deletes', () => {
    const { notes, clock } = setup();
    const n = notes.create({ title: 'temp', body: 'findme' });
    notes.archive(n.id);
    expect(notes.list()).toHaveLength(0);
    expect(notes.list({ view: 'archived' })).toHaveLength(1);
    notes.unarchive(n.id);
    notes.trash(n.id);
    expect(notes.list({ search: 'findme' })).toHaveLength(0);
    expect(notes.list({ view: 'trash' })).toHaveLength(1);
    expect(notes.list({ view: 'trash', search: 'findme' })).toHaveLength(1);
    notes.restore(n.id);
    expect(notes.list({ search: 'findme' })).toHaveLength(1);
    notes.trash(n.id);
    clock.advance(31 * 86_400_000);
    expect(notes.purgeTrash(30)).toBe(1);
    expect(() => notes.get(n.id)).toThrow(/not found/);
  });

  it('duplicates a note with tags', () => {
    const { notes } = setup();
    const n = notes.create({ title: 'Plan', body: 'x', tags: ['a'] });
    const d = notes.duplicate(n.id);
    expect(d.id).not.toBe(n.id);
    expect(d.title).toBe('Plan (copy)');
    expect(d.tags).toEqual(['a']);
  });

  it('keeps drafts for crash recovery and clears them on save', () => {
    const { notes } = setup();
    const n = notes.create({ title: 'Essay', body: 'v1' });
    notes.saveDraft(n.id, 'Essay', 'v1 plus unsaved words', 1);
    expect(notes.drafts()).toHaveLength(1);
    expect(notes.draftFor(n.id)?.body).toBe('v1 plus unsaved words');
    const recovered = notes.recoverDraft(n.id);
    expect(recovered.body).toBe('v1 plus unsaved words');
    expect(notes.drafts()).toHaveLength(0);
    notes.saveDraft(n.id, 'Essay', 'another', 2);
    notes.update(n.id, { body: 'saved normally' });
    expect(notes.drafts()).toHaveLength(0);
  });

  it('round-trips a JSON export through import without overwriting', () => {
    const { notes } = setup();
    const f = notes.createFolder('Ideas');
    notes.create({ title: 'One', body: 'alpha', tags: ['x'], folderId: f.id, pinned: true });
    notes.create({ title: 'Two', body: 'beta' });
    const exported = JSON.parse(JSON.stringify(notes.exportAll()));
    const r = notes.importJson(exported);
    expect(r.imported).toBe(2);
    expect(notes.list()).toHaveLength(4);
    expect(notes.folders()).toHaveLength(1);
    expect(notes.list({ folderId: f.id })).toHaveLength(2);
  });

  it('rejects invalid or corrupt imports without writing anything', () => {
    const { notes } = setup();
    expect(() => notes.importJson({ format: 'something-else' })).toThrow(/not a valid FlowCompanion notes export/);
    expect(() => notes.importJson(null)).toThrow(/Nothing was imported/);
    expect(() =>
      notes.importJson({ format: 'flowcompanion.notes', version: 1, exportedAt: 'x', folders: [], notes: [{ title: 'ok', body: 'ok' }, { title: 5 }] }),
    ).toThrow(/notes.1.title/);
    expect(notes.list()).toHaveLength(0);
  });

  it('imports markdown files with front matter and headings', () => {
    const { notes } = setup();
    const r = notes.importFiles([
      { name: 'trip.md', content: '---\ntags: [travel, summer]\n---\n# Lisbon trip\n\nPack light.' },
      { name: 'plain.txt', content: 'just text' },
      { name: 'bin.md', content: 'a\u0000b' },
    ]);
    expect(r).toMatchObject({ imported: 2, skipped: 1 });
    const trip = notes.list({ search: 'Lisbon' })[0]!;
    expect(trip.title).toBe('Lisbon trip');
    expect(trip.tags).toEqual(['summer', 'travel']);
    expect(notes.get(trip.id).body).toBe('Pack light.');
  });

  it('exports markdown and plain text', () => {
    const { notes } = setup();
    const n = notes.create({ title: 'Hello', body: 'World', tags: ['t'] });
    expect(notes.exportNote(n.id, 'markdown').content).toContain('# Hello\n\nWorld');
    expect(notes.exportNote(n.id, 'markdown').content).toContain('tags: [t]');
    expect(notes.exportNote(n.id, 'text')).toEqual({ filename: 'Hello.txt', content: 'Hello\n\nWorld' });
  });

  it('moves notes out of a deleted folder instead of deleting them', () => {
    const { notes } = setup();
    const f = notes.createFolder('Old');
    const n = notes.create({ title: 'keep', folderId: f.id });
    notes.deleteFolder(f.id);
    expect(notes.get(n.id).folderId).toBeNull();
  });
});

describe('links', () => {
  it('links notes and tasks in both directions and cleans up on delete', () => {
    const { db, clock, notes, tasks } = setup();
    const links = new LinksService(db, clock, () => null);
    const n = notes.create({ title: 'Spec' });
    const t = tasks.create({ title: 'Write spec' });
    links.link('note', n.id, 'task', t.id);
    links.link('task', t.id, 'note', n.id); // same link, not duplicated
    expect(links.linksFor('note', n.id)).toMatchObject([{ toType: 'task', toId: t.id, title: 'Write spec' }]);
    expect(links.linksFor('task', t.id)).toMatchObject([{ toType: 'note', toId: n.id, title: 'Spec' }]);
    tasks.delete(t.id);
    expect(links.linksFor('note', n.id)).toEqual([]);
    expect(() => links.link('note', n.id, 'note', n.id)).toThrow(/itself/);
    expect(() => links.link('note', n.id, 'task', 'missing')).toThrow(/no longer exists/);
  });
});
