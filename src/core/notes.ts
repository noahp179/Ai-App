import { z } from 'zod';
import type { Folder, Note, NoteDraft, NoteFormat, NoteQuery, NoteSummary } from '../shared/types';
import type { Db } from './db/database';
import { bool, ftsQuery } from './db/database';
import { type Clock, NotFoundError, UserError, cleanLine, cleanTags, excerpt, newId } from './util';

const MAX_BODY = 2_000_000;

interface NoteRow {
  id: string;
  title: string;
  body: string;
  format: NoteFormat;
  folder_id: string | null;
  pinned: number;
  favorite: number;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  revision: number;
  tags: string | null;
}

const NoteCreate = z.object({
  title: z.string().max(500).optional(),
  body: z.string().max(MAX_BODY).optional(),
  format: z.enum(['markdown', 'plain']).optional(),
  folderId: z.string().max(64).nullable().optional(),
  tags: z.array(z.string().max(60)).max(50).optional(),
  pinned: z.boolean().optional(),
  favorite: z.boolean().optional(),
});
export type NoteCreateInput = z.infer<typeof NoteCreate>;

const NotePatch = NoteCreate.extend({ expectedRevision: z.number().int().optional() });
export type NotePatchInput = z.infer<typeof NotePatch>;

/** Schema for FlowCompanion's JSON export. Import accepts exactly this shape. */
export const NotesExportSchema = z.object({
  format: z.literal('flowcompanion.notes'),
  version: z.literal(1),
  exportedAt: z.string(),
  folders: z.array(z.object({ id: z.string().max(64), name: z.string().min(1).max(200), parentId: z.string().max(64).nullable() })).max(10_000),
  notes: z
    .array(
      z.object({
        id: z.string().max(64).optional(),
        title: z.string().max(500),
        body: z.string().max(MAX_BODY),
        format: z.enum(['markdown', 'plain']).default('markdown'),
        folderId: z.string().max(64).nullable().default(null),
        tags: z.array(z.string().max(60)).max(50).default([]),
        pinned: z.boolean().default(false),
        favorite: z.boolean().default(false),
        archived: z.boolean().default(false),
        createdAt: z.string().max(40).optional(),
        updatedAt: z.string().max(40).optional(),
      }),
    )
    .max(50_000),
});
export type NotesExport = z.infer<typeof NotesExportSchema>;

export interface ImportReport {
  imported: number;
  skipped: number;
  errors: string[];
}

function isIsoDate(s: string | undefined): s is string {
  return !!s && !Number.isNaN(Date.parse(s));
}

export function titleFromBody(body: string, fallback = 'Untitled'): string {
  const first = body.split('\n').find((l) => l.trim().length > 0) ?? '';
  return cleanLine(first.replace(/^#+\s*/, ''), 120) || fallback;
}

export class NotesService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  private now(): string {
    return this.clock.now().toISOString();
  }

  private row(id: string): NoteRow {
    const r = this.db.get<NoteRow>(
      `SELECT n.*, (SELECT json_group_array(tag) FROM note_tags t WHERE t.note_id = n.id) AS tags FROM notes n WHERE n.id = ?`,
      [id],
    );
    if (!r) throw new NotFoundError('That note');
    return r;
  }

  private toSummary(r: NoteRow): NoteSummary {
    return {
      id: r.id,
      title: r.title,
      excerpt: excerpt(r.body),
      format: r.format,
      folderId: r.folder_id,
      tags: r.tags ? (JSON.parse(r.tags) as string[]).sort() : [],
      pinned: bool(r.pinned),
      favorite: bool(r.favorite),
      archivedAt: r.archived_at,
      deletedAt: r.deleted_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      revision: r.revision,
    };
  }

  private toNote(r: NoteRow): Note {
    return { ...this.toSummary(r), body: r.body };
  }

  private setTags(noteId: string, tags: string[]): void {
    this.db.run('DELETE FROM note_tags WHERE note_id = ?', [noteId]);
    for (const tag of cleanTags(tags)) this.db.run('INSERT OR IGNORE INTO note_tags (note_id, tag) VALUES (?, ?)', [noteId, tag]);
  }

  private assertFolder(folderId: string | null | undefined): void {
    if (folderId && !this.db.get('SELECT 1 FROM folders WHERE id = ?', [folderId])) throw new NotFoundError('That folder');
  }

  list(query: NoteQuery = {}): NoteSummary[] {
    const where: string[] = [];
    const params: (string | null)[] = [];
    const view = query.view ?? 'all';
    if (view === 'trash') where.push('n.deleted_at IS NOT NULL');
    else {
      where.push('n.deleted_at IS NULL');
      if (view === 'archived') where.push('n.archived_at IS NOT NULL');
      else where.push('n.archived_at IS NULL');
      if (view === 'pinned') where.push('n.pinned = 1');
      if (view === 'favorites') where.push('n.favorite = 1');
    }
    if (query.folderId !== undefined && view !== 'trash') {
      if (query.folderId === null) where.push('n.folder_id IS NULL');
      else {
        where.push('n.folder_id = ?');
        params.push(query.folderId);
      }
    }
    if (query.tag) {
      where.push('EXISTS (SELECT 1 FROM note_tags t WHERE t.note_id = n.id AND t.tag = ?)');
      params.push(query.tag.toLowerCase());
    }
    if (query.search?.trim()) {
      const fts = ftsQuery(query.search);
      if (fts) {
        // The index only holds live notes, so trash search falls back to LIKE.
        if (view === 'trash') {
          where.push('(n.title LIKE ? OR n.body LIKE ?)');
          const like = `%${query.search.trim().replace(/[%_]/g, '')}%`;
          params.push(like, like);
        } else {
          where.push("n.id IN (SELECT ref_id FROM search_index WHERE search_index MATCH ? AND type = 'note')");
          params.push(fts);
        }
      }
    }
    const order =
      query.sort === 'title' ? 'n.title COLLATE NOCASE ASC' : query.sort === 'created' ? 'n.created_at DESC' : 'n.updated_at DESC';
    const pinnedFirst = view === 'all' || view === 'favorites' ? 'n.pinned DESC, ' : '';
    const rows = this.db.all<NoteRow>(
      `SELECT n.*, (SELECT json_group_array(tag) FROM note_tags t WHERE t.note_id = n.id) AS tags
       FROM notes n WHERE ${where.join(' AND ')} ORDER BY ${pinnedFirst}${order} LIMIT 2000`,
      params,
    );
    return rows.map((r) => this.toSummary(r));
  }

  get(id: string): Note {
    return this.toNote(this.row(id));
  }

  create(input: unknown = {}, settings?: { defaultFormat: NoteFormat }): Note {
    const data = NoteCreate.parse(input);
    this.assertFolder(data.folderId);
    const id = newId();
    const now = this.now();
    const body = data.body ?? '';
    const title = data.title !== undefined ? cleanLine(data.title, 500) : body ? titleFromBody(body) : '';
    this.db.tx(() => {
      this.db.run(
        `INSERT INTO notes (id, title, body, format, folder_id, pinned, favorite, created_at, updated_at, revision)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [id, title, body, data.format ?? settings?.defaultFormat ?? 'markdown', data.folderId ?? null, data.pinned ?? false, data.favorite ?? false, now, now],
      );
      if (data.tags) this.setTags(id, data.tags);
    });
    return this.get(id);
  }

  /**
   * Updates a note. When `expectedRevision` is given and the note changed
   * elsewhere in the meantime, nothing is overwritten and a conflict is reported.
   */
  update(id: string, patch: unknown): Note {
    const data = NotePatch.parse(patch);
    const current = this.row(id);
    if (data.expectedRevision !== undefined && data.expectedRevision !== current.revision) {
      throw new UserError('This note was changed in another window. Reload it to see the latest version before saving.', 'conflict');
    }
    this.assertFolder(data.folderId);
    const contentChanged =
      (data.title !== undefined && cleanLine(data.title, 500) !== current.title) ||
      (data.body !== undefined && data.body !== current.body) ||
      (data.format !== undefined && data.format !== current.format);
    this.db.tx(() => {
      this.db.run(
        `UPDATE notes SET
           title = COALESCE(?, title), body = COALESCE(?, body), format = COALESCE(?, format),
           folder_id = CASE WHEN ? THEN ? ELSE folder_id END,
           pinned = COALESCE(?, pinned), favorite = COALESCE(?, favorite),
           updated_at = ?, revision = revision + ?
         WHERE id = ?`,
        [
          data.title !== undefined ? cleanLine(data.title, 500) : null,
          data.body ?? null,
          data.format ?? null,
          data.folderId !== undefined,
          data.folderId ?? null,
          data.pinned === undefined ? null : data.pinned,
          data.favorite === undefined ? null : data.favorite,
          contentChanged || data.tags || data.folderId !== undefined ? this.now() : current.updated_at,
          contentChanged ? 1 : 0,
          id,
        ],
      );
      if (data.tags) this.setTags(id, data.tags);
      if (data.body !== undefined || data.title !== undefined) this.db.run('DELETE FROM note_drafts WHERE note_id = ?', [id]);
    });
    return this.get(id);
  }

  duplicate(id: string): Note {
    const n = this.get(id);
    return this.create({ title: `${n.title || 'Untitled'} (copy)`, body: n.body, format: n.format, folderId: n.folderId, tags: n.tags });
  }

  archive(id: string): Note {
    this.row(id);
    this.db.run('UPDATE notes SET archived_at = ?, pinned = 0 WHERE id = ?', [this.now(), id]);
    return this.get(id);
  }

  unarchive(id: string): Note {
    this.row(id);
    this.db.run('UPDATE notes SET archived_at = NULL WHERE id = ?', [id]);
    return this.get(id);
  }

  /** Moves to trash. Notes stay recoverable until the trash is emptied or they expire. */
  trash(id: string): void {
    this.row(id);
    this.db.run('UPDATE notes SET deleted_at = ?, pinned = 0 WHERE id = ?', [this.now(), id]);
  }

  restore(id: string): Note {
    this.row(id);
    this.db.run('UPDATE notes SET deleted_at = NULL WHERE id = ?', [id]);
    return this.get(id);
  }

  deletePermanently(id: string): void {
    this.row(id);
    this.db.tx(() => {
      this.db.run("DELETE FROM links WHERE (from_type = 'note' AND from_id = ?) OR (to_type = 'note' AND to_id = ?)", [id, id]);
      this.db.run('DELETE FROM notes WHERE id = ?', [id]);
    });
  }

  emptyTrash(): number {
    return this.db.tx(() => {
      this.db.run("DELETE FROM links WHERE (from_type = 'note' AND from_id IN (SELECT id FROM notes WHERE deleted_at IS NOT NULL)) OR (to_type = 'note' AND to_id IN (SELECT id FROM notes WHERE deleted_at IS NOT NULL))");
      return this.db.run('DELETE FROM notes WHERE deleted_at IS NOT NULL').changes;
    });
  }

  purgeTrash(olderThanDays: number): number {
    const cutoff = new Date(this.clock.now().getTime() - olderThanDays * 86_400_000).toISOString();
    return this.db.run('DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ?', [cutoff]).changes;
  }

  tags(): { tag: string; count: number }[] {
    return this.db.all<{ tag: string; count: number }>(
      `SELECT t.tag, COUNT(*) AS count FROM note_tags t JOIN notes n ON n.id = t.note_id
       WHERE n.deleted_at IS NULL GROUP BY t.tag ORDER BY t.tag`,
    );
  }

  // ─────────── Folders ───────────

  folders(): (Folder & { noteCount: number })[] {
    return this.db
      .all<{ id: string; name: string; parent_id: string | null; created_at: string; updated_at: string; note_count: number }>(
        `SELECT f.*, (SELECT COUNT(*) FROM notes n WHERE n.folder_id = f.id AND n.deleted_at IS NULL AND n.archived_at IS NULL) AS note_count
         FROM folders f ORDER BY f.name COLLATE NOCASE`,
      )
      .map((r) => ({ id: r.id, name: r.name, parentId: r.parent_id, createdAt: r.created_at, updatedAt: r.updated_at, noteCount: r.note_count }));
  }

  createFolder(name: string, parentId: string | null = null): Folder {
    const clean = cleanLine(String(name ?? ''), 120);
    if (!clean) throw new UserError('Folder name cannot be empty.');
    this.assertFolder(parentId);
    const id = newId();
    const now = this.now();
    this.db.run('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [id, clean, parentId, now, now]);
    return { id, name: clean, parentId, createdAt: now, updatedAt: now };
  }

  renameFolder(id: string, name: string): void {
    const clean = cleanLine(String(name ?? ''), 120);
    if (!clean) throw new UserError('Folder name cannot be empty.');
    if (this.db.run('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?', [clean, this.now(), id]).changes === 0) throw new NotFoundError('That folder');
  }

  /** Deletes a folder; its notes move to "no folder" rather than being deleted. */
  deleteFolder(id: string): void {
    if (this.db.run('DELETE FROM folders WHERE id = ?', [id]).changes === 0) throw new NotFoundError('That folder');
  }

  // ─────────── Drafts (crash recovery) ───────────

  /** Records unsaved editor content so it survives a crash or forced quit. */
  saveDraft(noteId: string, title: string, body: string, baseRevision: number): void {
    if (typeof body !== 'string' || body.length > MAX_BODY) throw new UserError('Draft is too large.');
    this.row(noteId);
    this.db.run(
      `INSERT INTO note_drafts (note_id, title, body, base_revision, saved_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(note_id) DO UPDATE SET title = excluded.title, body = excluded.body, base_revision = excluded.base_revision, saved_at = excluded.saved_at`,
      [noteId, String(title ?? '').slice(0, 500), body, Math.trunc(Number(baseRevision) || 0), this.now()],
    );
  }

  drafts(): (NoteDraft & { noteTitle: string; differs: boolean })[] {
    return this.db
      .all<{ note_id: string; title: string; body: string; base_revision: number; saved_at: string; note_title: string; note_body: string }>(
        `SELECT d.*, n.title AS note_title, n.body AS note_body FROM note_drafts d JOIN notes n ON n.id = d.note_id ORDER BY d.saved_at DESC`,
      )
      .map((r) => ({
        noteId: r.note_id,
        title: r.title,
        body: r.body,
        baseRevision: r.base_revision,
        savedAt: r.saved_at,
        noteTitle: r.note_title,
        differs: r.body !== r.note_body || r.title !== r.note_title,
      }));
  }

  draftFor(noteId: string): NoteDraft | null {
    return this.drafts().find((d) => d.noteId === noteId && d.differs) ?? null;
  }

  discardDraft(noteId: string): void {
    this.db.run('DELETE FROM note_drafts WHERE note_id = ?', [noteId]);
  }

  /** Applies a recovered draft as the note's content. */
  recoverDraft(noteId: string): Note {
    const d = this.db.get<{ title: string; body: string }>('SELECT title, body FROM note_drafts WHERE note_id = ?', [noteId]);
    if (!d) throw new NotFoundError('That draft');
    return this.update(noteId, { title: d.title, body: d.body });
  }

  // ─────────── Import / export ───────────

  exportNote(id: string, format: 'markdown' | 'text' | 'json'): { filename: string; content: string } {
    const n = this.get(id);
    const base = (n.title || 'untitled').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 80) || 'note';
    if (format === 'json') {
      const doc: NotesExport = {
        format: 'flowcompanion.notes',
        version: 1,
        exportedAt: this.now(),
        folders: [],
        notes: [{ id: n.id, title: n.title, body: n.body, format: n.format, folderId: null, tags: n.tags, pinned: n.pinned, favorite: n.favorite, archived: !!n.archivedAt, createdAt: n.createdAt, updatedAt: n.updatedAt }],
      };
      return { filename: `${base}.json`, content: JSON.stringify(doc, null, 2) };
    }
    if (format === 'text') return { filename: `${base}.txt`, content: n.title ? `${n.title}\n\n${n.body}` : n.body };
    const front = n.tags.length ? `---\ntags: [${n.tags.join(', ')}]\ncreated: ${n.createdAt}\nupdated: ${n.updatedAt}\n---\n\n` : '';
    const heading = n.body.trimStart().startsWith('#') || !n.title ? '' : `# ${n.title}\n\n`;
    return { filename: `${base}.md`, content: `${front}${heading}${n.body}` };
  }

  exportAll(includeArchived = true): NotesExport {
    const folders = this.folders().map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }));
    const notes = this.db
      .all<NoteRow>(
        `SELECT n.*, (SELECT json_group_array(tag) FROM note_tags t WHERE t.note_id = n.id) AS tags FROM notes n
         WHERE n.deleted_at IS NULL ${includeArchived ? '' : 'AND n.archived_at IS NULL'} ORDER BY n.created_at`,
      )
      .map((r) => {
        const n = this.toNote(r);
        return { id: n.id, title: n.title, body: n.body, format: n.format, folderId: n.folderId, tags: n.tags, pinned: n.pinned, favorite: n.favorite, archived: !!n.archivedAt, createdAt: n.createdAt, updatedAt: n.updatedAt };
      });
    return { format: 'flowcompanion.notes', version: 1, exportedAt: this.now(), folders, notes };
  }

  /**
   * Imports a FlowCompanion notes export. The whole file is validated before
   * anything is written; imported notes always get new IDs so nothing existing
   * is overwritten.
   */
  importJson(data: unknown): ImportReport {
    const parsed = NotesExportSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new UserError(`This is not a valid FlowCompanion notes export (${issue ? `${issue.path.join('.') || 'file'}: ${issue.message}` : 'unknown error'}). Nothing was imported.`);
    }
    const doc = parsed.data;
    const report: ImportReport = { imported: 0, skipped: 0, errors: [] };
    this.db.tx(() => {
      const folderMap = new Map<string, string>();
      for (const f of doc.folders) {
        const existing = this.db.get<{ id: string }>('SELECT id FROM folders WHERE name = ? COLLATE NOCASE', [f.name]);
        folderMap.set(f.id, existing?.id ?? this.createFolder(f.name).id);
      }
      for (const n of doc.notes) {
        const id = newId();
        const created = isIsoDate(n.createdAt) ? new Date(n.createdAt).toISOString() : this.now();
        const updated = isIsoDate(n.updatedAt) ? new Date(n.updatedAt).toISOString() : created;
        this.db.run(
          `INSERT INTO notes (id, title, body, format, folder_id, pinned, favorite, archived_at, created_at, updated_at, revision)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [id, cleanLine(n.title, 500), n.body, n.format, n.folderId ? (folderMap.get(n.folderId) ?? null) : null, n.pinned, n.favorite, n.archived ? this.now() : null, created, updated],
        );
        this.setTags(id, n.tags);
        report.imported++;
      }
    });
    return report;
  }

  /** Imports Markdown or plain-text files, one note per file. */
  importFiles(files: { name: string; content: string }[]): ImportReport {
    const report: ImportReport = { imported: 0, skipped: 0, errors: [] };
    if (!Array.isArray(files)) throw new UserError('No files to import.');
    this.db.tx(() => {
      for (const f of files.slice(0, 5000)) {
        if (typeof f?.content !== 'string' || typeof f?.name !== 'string') {
          report.skipped++;
          continue;
        }
        if (f.content.length > MAX_BODY) {
          report.skipped++;
          report.errors.push(`${f.name}: larger than 2 MB, skipped`);
          continue;
        }
        if (f.content.includes('\u0000')) {
          report.skipped++;
          report.errors.push(`${f.name}: looks like a binary file, skipped`);
          continue;
        }
        let body = f.content.replace(/\r\n/g, '\n');
        let tags: string[] = [];
        const fm = /^---\n([\s\S]*?)\n---\n?/.exec(body);
        if (fm) {
          const tagLine = /^tags:\s*\[?([^\]\n]*)\]?/m.exec(fm[1] ?? '');
          if (tagLine?.[1]) tags = tagLine[1].split(',').map((t) => t.trim());
          body = body.slice(fm[0].length);
        }
        const isMd = /\.(md|markdown)$/i.test(f.name);
        const base = f.name.replace(/\.[^.]+$/, '');
        let title = cleanLine(base, 200);
        const h1 = /^#\s+(.+)\n?/.exec(body.trimStart());
        if (isMd && h1?.[1]) {
          title = cleanLine(h1[1], 200);
          body = body.trimStart().slice(h1[0].length).replace(/^\n+/, '');
        }
        this.create({ title, body, format: isMd ? 'markdown' : 'plain', tags });
        report.imported++;
      }
    });
    return report;
  }
}
